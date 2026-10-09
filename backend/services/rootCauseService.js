const { GoogleGenAI } = require('@google/genai');
const { doc, getDoc, getDocs, collection, query, where, updateDoc } = require('firebase/firestore');
const path = require('path');
const { db } = require('../config/firebase');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

const DISCLAIMER_TEXT =
  'AI probable cause assessment for municipal decision support. Not an official municipal fact.';

/**
 * Normalizes and validates the root-cause analysis output from Gemini.
 * Enforces confidence between 0.0 and 1.0, disclaimers, and traceable evidence.
 *
 * @param {Object} rawData - Parsed JSON from Gemini
 * @param {string} modelName - Model identifier
 * @returns {Object} Schema-compliant rootCauseAnalysis object
 */
function validateRootCauseAnalysis(rawData, modelName = GEMINI_MODEL) {
  if (!rawData || typeof rawData !== 'object') {
    throw new Error('Root cause analysis response is not a valid JSON object');
  }

  let probableCause = typeof rawData.probableCause === 'string' ? rawData.probableCause.trim() : '';
  if (!probableCause) {
    probableCause = 'Insufficient evidence';
  }

  // Normalize confidence to a float between 0.0 and 1.0
  let confidence = parseFloat(rawData.confidence);
  if (isNaN(confidence)) {
    confidence = probableCause === 'Insufficient evidence' ? 0.2 : 0.75;
  }
  // If model returned percentage like 87 instead of 0.87, convert it
  if (confidence > 1.0 && confidence <= 100.0) {
    confidence = confidence / 100.0;
  }
  // Clamp strictly between 0.0 and 1.0
  confidence = Math.max(0.0, Math.min(1.0, Math.round(confidence * 100) / 100));

  // Sanitize evidence array
  let evidence = [];
  if (Array.isArray(rawData.evidence)) {
    evidence = rawData.evidence
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);
  }
  if (evidence.length === 0) {
    evidence = ['Based on citizen problem descriptions and municipal category patterns.'];
  }

  // Sanitize alternative causes
  let alternativeCauses = [];
  if (Array.isArray(rawData.alternativeCauses)) {
    alternativeCauses = rawData.alternativeCauses
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0 && item !== probableCause);
  }

  return {
    probableCause,
    confidence,
    evidence,
    alternativeCauses,
    disclaimer: DISCLAIMER_TEXT,
    model: modelName,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Creates a standard fallback object when evidence is insufficient.
 *
 * @param {string} reason
 * @returns {Object}
 */
function createInsufficientEvidenceResult(
  reason = 'Single isolated report with no confirmed related incidents to synthesize root cause.'
) {
  return {
    probableCause: 'Insufficient evidence',
    confidence: 0.2,
    evidence: [reason],
    alternativeCauses: [],
    disclaimer: DISCLAIMER_TEXT,
    model: GEMINI_MODEL,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Loads a target report and its related reports from Firestore by docId or reportId.
 *
 * @param {string} identifier - Firestore docId or human reportId (e.g. 'SS-2026-DRA-JMZU5B')
 * @returns {Promise<{ targetDocId: string, targetReport: Object, relatedReports: Array<Object> }>}
 */
async function loadReportAndRelatedReports(identifier) {
  if (!identifier) {
    throw new Error('Report identifier is required to load report and related data');
  }

  let targetDocId = null;
  let targetReport = null;

  // 1. Try finding by direct Firestore document ID
  try {
    const docRef = doc(db, 'reports', identifier);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      targetDocId = snap.id;
      targetReport = snap.data();
    }
  } catch (_) {
    // Continue to check by reportId
  }

  // 2. If not found by docId, query by human reportId
  if (!targetReport) {
    const q = query(collection(db, 'reports'), where('reportId', '==', identifier));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const firstDoc = snap.docs[0];
      targetDocId = firstDoc.id;
      targetReport = firstDoc.data();
    }
  }

  if (!targetReport) {
    throw new Error(`Report not found in Firestore for identifier: ${identifier}`);
  }

  // 3. Find related reports from incidentFusion.relatedReportIds
  const relatedReports = [];
  const relatedReportIds = targetReport.incidentFusion?.relatedReportIds || [];

  for (const relId of relatedReportIds) {
    try {
      // Query by reportId first
      const relQuery = query(collection(db, 'reports'), where('reportId', '==', relId));
      const relSnap = await getDocs(relQuery);
      if (!relSnap.empty) {
        relSnap.forEach((d) => {
          if (d.id !== targetDocId) {
            relatedReports.push({ docId: d.id, ...d.data() });
          }
        });
      } else {
        // Try direct docId
        const directSnap = await getDoc(doc(db, 'reports', relId));
        if (directSnap.exists() && directSnap.id !== targetDocId) {
          relatedReports.push({ docId: directSnap.id, ...directSnap.data() });
        }
      }
    } catch (err) {
      console.warn(`[Root Cause] Failed to load related report ${relId}:`, err.message);
    }
  }

  return { targetDocId, targetReport, relatedReports };
}

/**
 * Evaluates the target report and related reports with Gemini AI to deduce the probable root cause.
 *
 * @param {Object} targetReport - The subject report data
 * @param {Array<Object>} relatedReports - List of related reports
 * @returns {Promise<Object>} Schema-compliant rootCauseAnalysis
 */
async function generateRootCauseWithGemini(targetReport, relatedReports = []) {
  // If there are no related reports or reports list is empty, return Insufficient Evidence
  if (!relatedReports || relatedReports.length === 0) {
    return createInsufficientEvidenceResult(
      'Single isolated report with no confirmed related incidents to synthesize root cause.'
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_gemini_api_key')) {
    throw new Error('GEMINI_API_KEY is not configured in backend/.env');
  }

  // Format related reports summary
  const relatedSummary = relatedReports
    .map(
      (r, idx) =>
        `Related Report #${idx + 1} (${r.reportId || 'ID: ' + r.docId}):\n` +
        `- Category: ${r.category || 'N/A'}\n` +
        `- Description: "${r.description || 'N/A'}"\n` +
        `- AI Issue Type: ${r.aiAnalysis?.issueType || 'N/A'}\n` +
        `- Department: ${r.aiAnalysis?.department || 'N/A'}\n` +
        `- Location: ${r.locationStatus || 'N/A'} (Lat: ${r.latitude ?? 'N/A'}, Lon: ${r.longitude ?? 'N/A'})`
    )
    .join('\n\n');

  // Format fusion context
  const fusionConfidence = targetReport.incidentFusion?.fusionConfidence ?? 0;
  const fusionStatus = targetReport.incidentFusion?.fusionStatus || 'N/A';
  const fusionEvidence = (targetReport.incidentFusion?.evidence || []).join('\n• ');

  const prompt = `You are an expert municipal infrastructure diagnostic AI for SevaSaathi AI, an Indian civic grievance assistance platform.
Your task is to analyze evidence from multiple connected citizen reports describing the same underlying civic incident, and identify the MOST LIKELY PROBABLE ROOT CAUSE.

CRITICAL INSTRUCTIONS & SAFETY RULES:
1. Always designate your output as "AI Probable Cause". NEVER present it as an official municipal fact.
2. Never guarantee that the cause is correct; civic workers must verify physical reality on site.
3. Confidence MUST be a number between 0.0 and 1.0 (for example: 0.87 for 87% confidence).
4. DO NOT invent facts, outside municipal data, or imaginary infrastructure. Every point in "evidence" MUST be directly traceable to the citizen descriptions, categories, AI classifications, locations, or fusion data provided below.
5. If there is insufficient evidence or ambiguity to determine a cause, set "probableCause" to "Insufficient evidence" and "confidence" below 0.3.
6. Suggest 1 to 3 plausible alternative causes if applicable.

EVIDENCE PROVIDED:

--- Target Citizen Report ---
Report ID: ${targetReport.reportId || 'N/A'}
Category: ${targetReport.category || 'N/A'}
Citizen Description: "${targetReport.description || 'N/A'}"
AI Issue Type: ${targetReport.aiAnalysis?.issueType || 'N/A'}
Department: ${targetReport.aiAnalysis?.department || 'N/A'}
Location Info: ${targetReport.locationStatus || 'N/A'} (Lat: ${targetReport.latitude ?? 'N/A'}, Lon: ${targetReport.longitude ?? 'N/A'})

--- Related Incident Reports (${relatedReports.length} related reports) ---
${relatedSummary}

--- Incident Fusion Detection Context ---
Fusion Confidence: ${fusionConfidence}%
Fusion Status: ${fusionStatus}
Fusion Evidence:
• ${fusionEvidence || 'Geographic and textual overlap detected.'}

You must respond ONLY with a raw JSON object matching the following structure (no markdown fences, no text outside the JSON):
{
  "probableCause": "Concise title of probable cause (e.g. Blocked drainage, Main water pipe breach, Structural roadbed failure, Overflowing municipal waste bin)",
  "confidence": 0.0 to 1.0,
  "evidence": [
    "First traceable evidence point derived strictly from the reports",
    "Second traceable evidence point derived strictly from the reports",
    "Third traceable evidence point derived strictly from the reports"
  ],
  "alternativeCauses": [
    "Plausible alternative cause 1"
  ]
}`;

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '';
    if (!responseText) {
      throw new Error('Empty response from Gemini model for root cause analysis');
    }

    const cleanedJson = responseText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const parsedData = JSON.parse(cleanedJson);
    return validateRootCauseAnalysis(parsedData, GEMINI_MODEL);
  } catch (error) {
    console.warn(`[Root Cause] Primary model (${GEMINI_MODEL}) error:`, error.message);
    // Fallback model attempt if primary is busy or unavailable
    try {
      const fallbackModel = 'gemini-3.8-flash';
      const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
      const fallbackRes = await ai.models.generateContent({
        model: fallbackModel,
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });
      const cleaned = (fallbackRes.text || '')
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      return validateRootCauseAnalysis(parsed, fallbackModel);
    } catch (innerErr) {
      throw new Error(`Gemini Root Cause API error: ${innerErr.message || error.message}`);
    }
  }
}

/**
 * Performs AI Probable Root Cause Analysis for a report/incident and saves it to Firestore.
 * Preserves existing aiAnalysis and incidentFusion fields intact.
 *
 * @param {string} identifier - Firestore docId or human reportId
 * @returns {Promise<{ docId: string, reportId: string, rootCauseAnalysis: Object }>}
 */
async function analyzeAndSaveRootCause(identifier) {
  const { targetDocId, targetReport, relatedReports } =
    await loadReportAndRelatedReports(identifier);

  const rootCauseAnalysis = await generateRootCauseWithGemini(targetReport, relatedReports);

  // Save to Firestore under `rootCauseAnalysis` without overwriting other fields
  const reportRef = doc(db, 'reports', targetDocId);
  await updateDoc(reportRef, {
    rootCauseAnalysis,
  });

  console.log(
    `[Root Cause] Successfully saved rootCauseAnalysis for report ${targetReport.reportId || targetDocId}: ${rootCauseAnalysis.probableCause} (${Math.round(rootCauseAnalysis.confidence * 100)}%)`
  );

  return {
    docId: targetDocId,
    reportId: targetReport.reportId || targetDocId,
    rootCauseAnalysis,
  };
}

module.exports = {
  analyzeAndSaveRootCause,
  generateRootCauseWithGemini,
  loadReportAndRelatedReports,
  validateRootCauseAnalysis,
  createInsufficientEvidenceResult,
  DISCLAIMER_TEXT,
};
