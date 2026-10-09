/**
 * SevaSaathi AI - Stage 9: AI Action & Resource Recommendation Service
 *
 * For a prioritized incident, recommends the most appropriate municipal response team
 * and operational action.
 *
 * CRITICAL SAFETY RULES:
 * - AI only RECOMMENDS.
 * - Do NOT automatically dispatch or assign any team.
 * - Recommendation status is strictly "pending_officer_approval".
 * - Team availability, department, workload, and distance are deterministic data;
 *   Gemini generates the operational action and contextual reasoning.
 */

const { GoogleGenAI } = require('@google/genai');
const { doc, getDoc, getDocs, collection, query, where, updateDoc, setDoc } = require('firebase/firestore');
const path = require('path');
const { db } = require('../config/firebase');
const { createNotification } = require('./notificationService');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

// Simulated/Demo Municipal Teams Dataset
const DEFAULT_DEMO_TEAMS = [
  {
    teamId: 'DEMO-TEAM-DRA-01',
    teamName: 'Drainage Rapid Response Unit A',
    department: 'Stormwater & Drainage',
    specialization: 'Stormwater drain de-silting & surface flood extraction',
    availability: 'Available',
    currentWorkload: 0,
    location: {
      latitude: 12.978,
      longitude: 77.598,
      areaName: 'Central Ward Operations Depot',
    },
    estimatedResponseMinutes: 15,
    isSimulated: true,
  },
  {
    teamId: 'DEMO-TEAM-DRA-02',
    teamName: 'Drainage Heavy Equipment Team B',
    department: 'Stormwater & Drainage',
    specialization: 'Culvert excavator & main sewer line breach remediation',
    availability: 'Busy',
    currentWorkload: 2,
    location: {
      latitude: 12.99,
      longitude: 77.58,
      areaName: 'North Ward Maintenance Yard',
    },
    estimatedResponseMinutes: 45,
    isSimulated: true,
  },
  {
    teamId: 'DEMO-TEAM-WAT-01',
    teamName: 'Water Works Pipeline Emergency Team',
    department: 'Water Supply & Sewerage',
    specialization: 'Pressurized water main rupture & valve repairs',
    availability: 'Available',
    currentWorkload: 1,
    location: {
      latitude: 12.965,
      longitude: 77.6,
      areaName: 'South Water Supply Depot',
    },
    estimatedResponseMinutes: 20,
    isSimulated: true,
  },
  {
    teamId: 'DEMO-TEAM-ROA-01',
    teamName: 'Roads Rapid Asphalt Patching Unit',
    department: 'Roads & Infrastructure',
    specialization: 'Pothole filling & roadbed erosion containment',
    availability: 'Available',
    currentWorkload: 0,
    location: {
      latitude: 12.973,
      longitude: 77.59,
      areaName: 'Civic Engineering Division 1',
    },
    estimatedResponseMinutes: 25,
    isSimulated: true,
  },
  {
    teamId: 'DEMO-TEAM-SAN-01',
    teamName: 'Sanitation Debris Clearing Crew',
    department: 'Solid Waste Management',
    specialization: 'Municipal garbage overflow & obstruction removal',
    availability: 'Available',
    currentWorkload: 1,
    location: {
      latitude: 12.98,
      longitude: 77.585,
      areaName: 'Sanitation Transfer Station',
    },
    estimatedResponseMinutes: 30,
    isSimulated: true,
  },
  {
    teamId: 'DEMO-TEAM-ELE-01',
    teamName: 'Streetlight & Cable Emergency Unit',
    department: 'Electrical & Street Lighting',
    specialization: 'High-voltage wire exposure & pole replacement',
    availability: 'Available',
    currentWorkload: 0,
    location: {
      latitude: 12.97,
      longitude: 77.61,
      areaName: 'East Power Substation Depot',
    },
    estimatedResponseMinutes: 20,
    isSimulated: true,
  },
];

/**
 * Calculates Haversine distance in kilometers between two GPS coordinates.
 */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (
    typeof lat1 !== 'number' ||
    typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lon2 !== 'number'
  ) {
    return null;
  }
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Loads available demo municipal teams from Firestore or default seeded dataset.
 */
async function getMunicipalTeams() {
  try {
    const teamsCol = collection(db, 'teams');
    const snap = await getDocs(teamsCol);
    if (!snap.empty) {
      const teams = [];
      snap.forEach((d) => teams.push({ ...d.data(), firestoreId: d.id }));
      return teams;
    }
  } catch (err) {
    console.warn('[Resource Recommendation] Notice on Firestore teams collection:', err.message);
  }
  // Return built-in simulated teams if collection is empty or rules are pending deployment
  return DEFAULT_DEMO_TEAMS;
}

/**
 * Seeds demo teams into Firestore if writable.
 */
async function seedDemoTeamsIfEmpty() {
  try {
    const teamsCol = collection(db, 'teams');
    const snap = await getDocs(teamsCol);
    if (snap.empty) {
      for (const t of DEFAULT_DEMO_TEAMS) {
        await setDoc(doc(teamsCol, t.teamId), t);
      }
      console.log('[Resource Recommendation] Seeded demo municipal teams into Firestore.');
    }
  } catch (_) {
    // Graceful fallback to in-memory dataset
  }
}

/**
 * Matches and ranks municipal teams for an incident based on department,
 * specialization, availability, distance, and workload.
 */
function rankTeamsForIncident(incident, teams) {
  const incDept = (incident.aiAnalysis?.department || incident.category || '').toLowerCase();
  const incText = `${incident.description || ''} ${incident.aiAnalysis?.issueType || ''} ${incident.rootCauseAnalysis?.probableCause || ''}`.toLowerCase();

  const scoredTeams = teams.map((team) => {
    let score = 0;
    const teamDept = (team.department || '').toLowerCase();
    const teamSpec = (team.specialization || '').toLowerCase();

    // 1. Department match (40 pts)
    if (teamDept.includes(incDept) || incDept.includes(teamDept) || (incDept.includes('drain') && teamDept.includes('drain'))) {
      score += 40;
    } else if (incDept.includes('water') && teamDept.includes('water')) {
      score += 35;
    }

    // 2. Availability (30 pts)
    if (team.availability === 'Available') {
      score += 30;
    } else if (team.availability === 'On Patrol') {
      score += 15;
    }

    // 3. Specialization keyword overlap (15 pts)
    const specKeywords = teamSpec.split(/\s+/).filter((w) => w.length > 3);
    const matchesSpec = specKeywords.some((w) => incText.includes(w));
    if (matchesSpec) {
      score += 15;
    }

    // 4. Distance calculation & proximity score (15 pts)
    let distanceKm = null;
    if (typeof incident.latitude === 'number' && typeof incident.longitude === 'number' && team.location) {
      distanceKm = calculateDistanceKm(
        incident.latitude,
        incident.longitude,
        team.location.latitude,
        team.location.longitude
      );
    }

    if (distanceKm !== null) {
      if (distanceKm <= 2.0) score += 15;
      else if (distanceKm <= 5.0) score += 10;
      else if (distanceKm <= 10.0) score += 5;
    } else {
      score += 8; // Baseline proximity if GPS unavailable
    }

    // 5. Workload penalty
    score -= (team.currentWorkload || 0) * 5;

    return {
      team,
      score,
      distanceKm,
    };
  });

  scoredTeams.sort((a, b) => b.score - a.score);
  return scoredTeams;
}

/**
 * Generates an operational action instruction and explainable reasons using Gemini AI.
 */
async function generateActionWithGemini(incident, selectedTeam, distanceKm) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_gemini_api_key')) {
    throw new Error('GEMINI_API_KEY is not configured in backend/.env');
  }

  const prompt = `You are an expert municipal dispatch strategist for SevaSaathi AI, an Indian civic administration platform.
For the civic problem report below, an optimal municipal response team has been deterministically matched by the system.
Your task is to write a concise, professional RECOMMENDED ACTION instruction for this team, and provide 3-4 bullet reasons explaining why this team was chosen.

INCIDENT DETAILS:
Report ID: ${incident.reportId || incident.docId}
Category: ${incident.category || 'N/A'}
Citizen Description: "${incident.description || 'N/A'}"
AI Issue Type: ${incident.aiAnalysis?.issueType || 'N/A'}
AI Severity: ${incident.aiAnalysis?.severity || 'Medium'}
AI Probable Root Cause: ${incident.rootCauseAnalysis?.probableCause || 'N/A'}
Priority Score: ${incident.priorityAssessment?.score || 'N/A'}/100 (${incident.priorityAssessment?.level || 'N/A'})
Location Area: ${incident.locationStatus || 'N/A'}

DETERMINISTICALLY MATCHED TEAM:
Team ID: ${selectedTeam.teamId}
Team Name: ${selectedTeam.teamName}
Department: ${selectedTeam.department}
Specialization: ${selectedTeam.specialization}
Availability: ${selectedTeam.availability}
Current Workload: ${selectedTeam.currentWorkload} active tasks
Calculated Distance: ${distanceKm !== null ? distanceKm + ' km' : 'Proximity depot'}
Estimated Response Time: ${selectedTeam.estimatedResponseMinutes} minutes

CRITICAL RULES:
1. AI only RECOMMENDS. Do NOT claim the team is already dispatched.
2. Formulate recommendedAction as a direct, actionable field instruction (e.g., "Deploy Drainage Rapid Response Unit A to inspect and clear the blocked stormwater drain near the school road, restoring street drainage.").
3. In "reason", include 3 to 4 clear points noting the team's department match, specialization, availability, and calculated proximity.
4. Respond ONLY with a valid JSON object matching:
{
  "recommendedAction": "Concise operational action instruction",
  "reason": [
    "Reason 1: Correct department",
    "Reason 2: Appropriate specialization",
    "Reason 3: Available",
    "Reason 4: Nearest suitable team"
  ],
  "confidence": 0.0 to 1.0
}`;

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const responseText = response.text || '';
    const cleaned = responseText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    return JSON.parse(cleaned);
  } catch (err) {
    console.warn(`[Resource Recommendation] Primary model error:`, err.message);
    // Fallback model attempt
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
      return JSON.parse(cleaned);
    } catch (inner) {
      // Deterministic fallback if API fails
      return {
        recommendedAction: `Inspect and resolve ${incident.aiAnalysis?.issueType || incident.category || 'civic issue'} at reported location.`,
        reason: [
          `Matched required department: ${selectedTeam.department}`,
          `Specialized in ${selectedTeam.specialization}`,
          `Currently ${selectedTeam.availability.toLowerCase()} with low workload`,
          distanceKm !== null ? `Closest available unit (~${distanceKm} km away)` : 'Nearest operational municipal depot',
        ],
        confidence: 0.85,
      };
    }
  }
}

/**
 * Loads incident from Firestore, ranks teams, calls Gemini for recommended action,
 * and saves resourceRecommendation into Firestore with status "pending_officer_approval".
 *
 * @param {string} identifier - Report docId or human reportId
 * @returns {Promise<Object>} { docId, reportId, resourceRecommendation }
 */
async function generateAndSaveResourceRecommendation(identifier) {
  if (!identifier) {
    throw new Error('Report identifier is required for resource recommendation');
  }

  // 1. Load target report from Firestore
  let targetDocId = null;
  let targetReport = null;

  try {
    const docRef = doc(db, 'reports', identifier);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      targetDocId = snap.id;
      targetReport = snap.data();
    }
  } catch (_) {}

  if (!targetReport) {
    const q = query(collection(db, 'reports'), where('reportId', '==', identifier));
    const snap = await getDocs(q);
    if (!snap.empty) {
      targetDocId = snap.docs[0].id;
      targetReport = snap.docs[0].data();
    }
  }

  if (!targetReport) {
    throw new Error(`Report not found in Firestore for identifier: ${identifier}`);
  }

  // 2. Seed or load municipal teams
  await seedDemoTeamsIfEmpty();
  const allTeams = await getMunicipalTeams();

  // 3. Rank teams deterministically
  const ranked = rankTeamsForIncident(targetReport, allTeams);
  if (ranked.length === 0) {
    throw new Error('No municipal teams available for recommendation');
  }

  const bestMatch = ranked[0];
  const selectedTeam = bestMatch.team;
  const distanceKm = bestMatch.distanceKm;

  // 4. Generate explainable operational action with Gemini
  const aiOutput = await generateActionWithGemini(targetReport, selectedTeam, distanceKm);

  // 5. Build schema-compliant recommendation payload
  const resourceRecommendation = {
    recommendedTeamId: selectedTeam.teamId,
    recommendedTeamName: selectedTeam.teamName,
    department: selectedTeam.department,
    recommendedAction: aiOutput.recommendedAction || `Inspect and resolve issue at reported site.`,
    reason: Array.isArray(aiOutput.reason) ? aiOutput.reason : [
      `Matched department: ${selectedTeam.department}`,
      `Specialized in ${selectedTeam.specialization}`,
      `Currently ${selectedTeam.availability}`,
    ],
    availability: selectedTeam.availability,
    estimatedDistanceKm: distanceKm,
    estimatedResponseMinutes: selectedTeam.estimatedResponseMinutes || 20,
    confidence: typeof aiOutput.confidence === 'number' ? Math.round(aiOutput.confidence * 100) / 100 : 0.9,
    status: 'pending_officer_approval', // Strictly pending officer approval (Requirement)
    isAiRecommendation: true,
    model: GEMINI_MODEL,
    generatedAt: new Date().toISOString(),
  };

  // 6. Save directly to Firestore report document under `resourceRecommendation`
  const reportRef = doc(db, 'reports', targetDocId);
  await updateDoc(reportRef, {
    resourceRecommendation,
  });

  console.log(
    `[Resource Recommendation] Saved for report ${targetReport.reportId || targetDocId}: Team=${selectedTeam.teamName}, Status=${resourceRecommendation.status}`
  );

  return {
    docId: targetDocId,
    reportId: targetReport.reportId || targetDocId,
    resourceRecommendation,
  };
}

/**
 * Stage 10: Human / Officer Approval of AI Resource Recommendation
 * Updates recommendation status to 'approved' and sets incident status to 'assigned'.
 */
async function approveRecommendation(identifier, officerName = 'demo-officer') {
  if (!identifier) throw new Error('Report identifier is required for approval.');

  let targetDocId = identifier;
  let docRef = doc(db, 'reports', targetDocId);
  let docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    const q = query(collection(db, 'reports'), where('reportId', '==', identifier));
    const snap = await getDocs(q);
    if (snap.empty) {
      throw new Error(`Report not found with identifier: ${identifier}`);
    }
    const foundDoc = snap.docs[0];
    targetDocId = foundDoc.id;
    docRef = doc(db, 'reports', targetDocId);
    docSnap = foundDoc;
  }

  const reportData = docSnap.data();
  const currentRec = reportData.resourceRecommendation || {};

  const updatedRec = {
    ...currentRec,
    status: 'approved',
    approvedBy: officerName || 'demo-officer',
    approvedAt: new Date().toISOString(),
    approvalDecision: 'approved',
  };

  const auditTrail = Array.isArray(reportData.auditTrail) ? [...reportData.auditTrail] : [];
  auditTrail.push({
    stage: 'officer_approval',
    action: 'Officer approved assignment',
    by: officerName || 'demo-officer',
    assignedTeam: updatedRec.recommendedTeamName || 'Assigned Municipal Team',
    timestamp: new Date().toISOString(),
  });

  const updatePayload = {
    status: 'assigned',
    resourceRecommendation: updatedRec,
    assignedTeam: {
      teamId: updatedRec.recommendedTeamId || 'TEAM-01',
      teamName: updatedRec.recommendedTeamName || 'Assigned Municipal Team',
      department: updatedRec.department || reportData.category || 'Municipal Operations',
      assignedAt: new Date().toISOString(),
      assignedBy: officerName || 'demo-officer',
    },
    auditTrail,
  };

  await updateDoc(docRef, updatePayload);
  console.log(`[Officer Approval] Approved team assignment for ${reportData.reportId || targetDocId}: Status -> assigned`);

  // Create friendly citizen notification on officer review & assignment
  try {
    const teamName = updatedRec.recommendedTeamName || 'Municipal Response Team';
    await createNotification({
      recipientUid: reportData.submittedBy || 'demo-citizen',
      reportId: reportData.reportId || targetDocId,
      title: 'Report Reviewed & Assigned',
      message: `Your report ${reportData.reportId || targetDocId} has been reviewed by the Municipal Officer and assigned to ${teamName}.`,
      type: 'assigned',
    });
  } catch (notifErr) {
    console.warn('[Officer Approval] Notification trigger warning:', notifErr.message);
  }

  return {
    success: true,
    docId: targetDocId,
    reportId: reportData.reportId || targetDocId,
    status: 'assigned',
    resourceRecommendation: updatedRec,
    auditTrail,
  };
}

/**
 * Stage 10: Human / Officer Rejection of AI Resource Recommendation
 * Updates recommendation status to 'rejected' without assigning team.
 */
async function rejectRecommendation(identifier, reason = '', officerName = 'demo-officer') {
  if (!identifier) throw new Error('Report identifier is required for rejection.');

  let targetDocId = identifier;
  let docRef = doc(db, 'reports', targetDocId);
  let docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    const q = query(collection(db, 'reports'), where('reportId', '==', identifier));
    const snap = await getDocs(q);
    if (snap.empty) {
      throw new Error(`Report not found with identifier: ${identifier}`);
    }
    const foundDoc = snap.docs[0];
    targetDocId = foundDoc.id;
    docRef = doc(db, 'reports', targetDocId);
    docSnap = foundDoc;
  }

  const reportData = docSnap.data();
  const currentRec = reportData.resourceRecommendation || {};

  const updatedRec = {
    ...currentRec,
    status: 'rejected',
    rejectedBy: officerName || 'demo-officer',
    rejectedAt: new Date().toISOString(),
    approvalDecision: 'rejected',
    rejectionReason: reason || 'Officer rejected recommendation without specific reason.',
  };

  const auditTrail = Array.isArray(reportData.auditTrail) ? [...reportData.auditTrail] : [];
  auditTrail.push({
    stage: 'officer_rejection',
    action: 'Officer rejected recommendation',
    by: officerName || 'demo-officer',
    rejectionReason: reason || 'Recommendation rejected',
    timestamp: new Date().toISOString(),
  });

  const updatePayload = {
    resourceRecommendation: updatedRec,
    auditTrail,
  };

  await updateDoc(docRef, updatePayload);
  console.log(`[Officer Rejection] Rejected recommendation for ${reportData.reportId || targetDocId}: Reason -> ${reason}`);

  return {
    success: true,
    docId: targetDocId,
    reportId: reportData.reportId || targetDocId,
    resourceRecommendation: updatedRec,
    auditTrail,
  };
}

module.exports = {
  generateAndSaveResourceRecommendation,
  approveRecommendation,
  rejectRecommendation,
  getMunicipalTeams,
  DEFAULT_DEMO_TEAMS,
  calculateDistanceKm,
};
