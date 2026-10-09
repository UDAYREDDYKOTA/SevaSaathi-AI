const { GoogleGenAI } = require('@google/genai');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

// The 8 Canonical Civic Categories per User Specification
const CANONICAL_CATEGORIES = [
  'Roads',
  'Drainage',
  'Water Supply',
  'Sanitation',
  'Streetlights',
  'Electrical',
  'Parks',
  'Other',
];

// Department Mapping for Official Municipal Routing
const CATEGORY_DEPARTMENT_MAP = {
  'Roads': 'Roads & Infrastructure',
  'Drainage': 'Stormwater & Drainage',
  'Water Supply': 'Water Supply & Sewerage',
  'Sanitation': 'Solid Waste Management',
  'Streetlights': 'Electrical & Street Lighting',
  'Electrical': 'Electrical & Street Lighting',
  'Parks': 'Horticulture & Parks',
  'Other': 'Municipal Administration',
};

/**
 * Normalizes any category string into one of the 8 canonical categories.
 */
function normalizeCanonicalCategory(rawCat = '') {
  if (!rawCat) return 'Other';
  const str = String(rawCat).trim();
  const directMatch = CANONICAL_CATEGORIES.find(
    (c) => c.toLowerCase() === str.toLowerCase()
  );
  if (directMatch) return directMatch;

  const lower = str.toLowerCase();
  if (lower.includes('road') || lower.includes('pothole') || lower.includes('asphalt') || lower.includes('pavement')) return 'Roads';
  if (lower.includes('drain') || lower.includes('flood') || lower.includes('waterlog') || lower.includes('culvert') || lower.includes('storm')) return 'Drainage';
  if (lower.includes('water supply') || lower.includes('drinking') || lower.includes('pipe') || lower.includes('water') || lower.includes('sewer') || lower.includes('leak')) return 'Water Supply';
  if (lower.includes('sanitat') || lower.includes('garbage') || lower.includes('waste') || lower.includes('trash') || lower.includes('dump') || lower.includes('clean')) return 'Sanitation';
  if (lower.includes('streetlight') || lower.includes('street light') || lower.includes('lamp') || lower.includes('light pole')) return 'Streetlights';
  if (lower.includes('electr') || lower.includes('wire') || lower.includes('cable') || lower.includes('transformer') || lower.includes('power')) return 'Electrical';
  if (lower.includes('park') || lower.includes('tree') || lower.includes('garden') || lower.includes('branch') || lower.includes('greenery')) return 'Parks';
  return 'Other';
}

/**
 * Validates and normalizes Gemini AI post-submission analysis payload.
 */
function validateAiAnalysis(rawData, fallbackDescription = '', fallbackCategory = '', modelName = GEMINI_MODEL) {
  if (!rawData || typeof rawData !== 'object') {
    throw new Error('Gemini response is not a valid JSON object');
  }

  const validSeverities = ['Critical', 'High', 'Medium', 'Low'];
  const validRisks = ['High', 'Medium', 'Low'];
  const validAuthenticity = ['Likely Genuine', 'Likely Suspicious', 'Insufficient Evidence'];

  let severity = (rawData.severity || 'Medium').toString().trim();
  severity = validSeverities.find((s) => s.toLowerCase() === severity.toLowerCase()) || 'Medium';

  let safetyRisk = (rawData.safetyRisk || 'Medium').toString().trim();
  safetyRisk = validRisks.find((r) => r.toLowerCase() === safetyRisk.toLowerCase()) || 'Medium';

  let authenticityAssessment = (rawData.authenticityAssessment || 'Likely Genuine').toString().trim();
  authenticityAssessment = validAuthenticity.find((a) => a.toLowerCase() === authenticityAssessment.toLowerCase()) || 'Likely Genuine';

  let authenticityConfidence = parseFloat(rawData.authenticityConfidence ?? rawData.confidence);
  if (isNaN(authenticityConfidence) || authenticityConfidence < 0) authenticityConfidence = 0.92;
  if (authenticityConfidence > 1) authenticityConfidence = 1.0;
  authenticityConfidence = Math.round(authenticityConfidence * 100) / 100;

  const authenticityEvidence = (rawData.authenticityEvidence && String(rawData.authenticityEvidence).trim()) ||
    'Uploaded description and report context are consistent with reported civic conditions.';

  let confidence = parseFloat(rawData.confidence);
  if (isNaN(confidence) || confidence < 0) confidence = 0.88;
  if (confidence > 1) confidence = 1.0;
  confidence = Math.round(confidence * 100) / 100;

  const category = normalizeCanonicalCategory(rawData.category || fallbackCategory || '');
  const department = (rawData.department && String(rawData.department).trim()) ||
    CATEGORY_DEPARTMENT_MAP[category] ||
    'Municipal Administration';

  const issueType = (rawData.issueType && String(rawData.issueType).trim()) ||
    (rawData.detectedProblem && String(rawData.detectedProblem).trim()) ||
    `${category} Issue`;

  const shortSummary = (rawData.shortSummary && String(rawData.shortSummary).trim()) ||
    (fallbackDescription.slice(0, 120) || 'Citizen report pending detailed assessment');

  const evidence = (rawData.evidence && String(rawData.evidence).trim()) ||
    `Identified from citizen report stating: "${fallbackDescription.slice(0, 100)}..."`;

  return {
    issueType,
    detectedProblem: issueType,
    category,
    department,
    severity,
    safetyRisk,
    priority: severity === 'Critical' ? 'High' : severity === 'Low' ? 'Low' : 'Medium',
    authenticityAssessment,
    authenticityConfidence,
    authenticityEvidence,
    shortSummary,
    confidence,
    evidence,
    isAiAssessment: true,
    disclaimer: 'AI-generated assessment for municipal decision support. It is not an official municipal determination.',
    model: modelName,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Analyzes a civic report using Gemini AI (Stage 4 & subsequent pipelines).
 */
async function analyzeReportWithGemini({ description = '', category = '', address = '', locationStatus = '' }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_gemini_api_key')) {
    throw new Error('GEMINI_API_KEY is not configured in backend/.env');
  }

  const locationContext = address || locationStatus || 'Hyderabad, Telangana';

  const prompt = `You are an expert municipal AI classifier for SevaSaathi AI, an Indian civic grievance assistance system.
Analyze the following citizen civic problem report and provide an objective AI assessment.

Citizen Description: "${description || 'No description provided'}"
Report Location: "${locationContext}"
Optional Hint: "${category || 'None'}"

You must classify the grievance into EXACTLY one of these 8 categories:
- Roads
- Drainage
- Water Supply
- Sanitation
- Streetlights
- Electrical
- Parks
- Other

You must respond ONLY with a raw JSON object containing the following keys (no markdown code blocks, no text outside JSON):
{
  "issueType": "Specific civic problem name (e.g., Deep Road Pothole, Stormwater Drain Clog, Low Water Pressure, Overflowing Garbage)",
  "category": "Roads" | "Drainage" | "Water Supply" | "Sanitation" | "Streetlights" | "Electrical" | "Parks" | "Other",
  "department": "Roads & Infrastructure" | "Stormwater & Drainage" | "Water Supply & Sewerage" | "Solid Waste Management" | "Electrical & Street Lighting" | "Horticulture & Parks" | "Municipal Administration",
  "severity": "Critical" | "High" | "Medium" | "Low",
  "safetyRisk": "High" | "Medium" | "Low",
  "authenticityAssessment": "Likely Genuine" | "Likely Suspicious" | "Insufficient Evidence",
  "authenticityConfidence": 0.0 to 1.0,
  "authenticityEvidence": "Reasoning explaining why this report is Likely Genuine, Likely Suspicious, or Insufficient Evidence",
  "shortSummary": "A concise 1-sentence summary of the issue for municipal field workers",
  "confidence": 0.0 to 1.0,
  "evidence": "Brief excerpt or rationale from citizen description supporting this classification"
}`;

  const primaryModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const candidateModels = [
    primaryModel,
    'gemini-3.6-flash',
    'gemini-flash-lite-latest',
    'gemini-flash-latest',
  ];
  const modelsToTry = [...new Set(candidateModels)];

  let lastError = null;
  for (const currentModel of modelsToTry) {
    try {
      const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
      const response = await ai.models.generateContent({
        model: currentModel,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const responseText = response.text || '';
      if (!responseText) throw new Error(`Empty response from Gemini model ${currentModel}`);

      const cleanedJson = responseText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

      const parsedData = JSON.parse(cleanedJson);
      return validateAiAnalysis(parsedData, description, category, currentModel);
    } catch (modelError) {
      console.warn(`[Gemini Service] Model ${currentModel} failed (${modelError.message?.slice(0, 100)}). Trying next candidate model...`);
      lastError = modelError;
    }
  }

  throw new Error(`Gemini API error across all candidate models: ${lastError?.message || 'Service unavailable'}`);
}

/**
 * Validates citizen complaint inputs, automatically identifies problem, classifies category,
 * determines department, compares text and image consistency, and assesses severity & priority.
 *
 * Requirements:
 * 1. Identify the civic problem from text and image.
 * 2. Classify into Roads, Drainage, Water Supply, Sanitation, Streetlights, Electrical, Parks, or Other.
 * 3. Identify responsible municipal department.
 * 4. Compare text and image consistency.
 * 5. Assess severity, safety risk, and priority.
 * 6. Flag irrelevant images, unclear evidence, or conflicting information.
 * 7. If text and image clearly contradict each other, set status = 'MISMATCH'.
 * 8. If image is missing, analyze text without falsely declaring a mismatch.
 */
async function validateComplaintWithGemini({
  description = '',
  address = '',
  locationStatus = '',
  latitude = null,
  longitude = null,
  photoDataUrl = null,
  imageUrl = null,
  category = '', // optional legacy hint
}) {
  const { verifyComplaintPipeline } = require('./complaintVerificationService');
  return verifyComplaintPipeline({
    description,
    address,
    locationStatus,
    latitude,
    longitude,
    photoDataUrl,
    imageUrl,
    category,
  });
}

module.exports = {
  CANONICAL_CATEGORIES,
  CATEGORY_DEPARTMENT_MAP,
  normalizeCanonicalCategory,
  analyzeReportWithGemini,
  validateAiAnalysis,
  validateComplaintWithGemini,
};

