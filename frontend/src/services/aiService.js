/**
 * SevaSaathi AI - Frontend Service for Stage 4 Gemini AI Pipeline
 * Sends saved report data to the secure Node.js backend for Gemini classification.
 * The backend securely holds GEMINI_API_KEY and updates Firestore.
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

/**
 * Triggers backend Gemini AI analysis for a report that is ALREADY safely stored in Firestore.
 *
 * @param {Object} params
 * @param {string} params.docId - Firestore document ID
 * @param {string} params.reportId - Human-readable report ID
 * @param {string} params.description - Problem description
 * @param {string} params.category - Selected category
 * @returns {Promise<{ success: boolean, aiAnalysis: Object }>}
 */
export async function requestReportAiAnalysis({
  docId,
  reportId,
  description,
  category,
  address = '',
  latitude = null,
  longitude = null,
  locationStatus = '',
  submittedBy = 'demo-citizen',
  createdAt = null,
}) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/reports/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        docId,
        reportId,
        description,
        category,
        address,
        latitude,
        longitude,
        locationStatus,
        submittedBy,
        createdAt,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Server responded with ${response.status}`);
    }

    return data;
  } catch (error) {
    console.warn('AI analysis request warning:', error.message);
    throw error;
  }
}

/**
 * Triggers Stage 6 AI Probable Root Cause Analysis for a report/incident.
 *
 * @param {string} identifier - Firestore docId or human reportId
 * @returns {Promise<{ success: boolean, rootCauseAnalysis: Object }>}
 */
export async function requestRootCauseAnalysis(identifier) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/reports/${encodeURIComponent(identifier)}/root-cause`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Server responded with ${response.status}`);
    }

    return data;
  } catch (error) {
    console.warn('Root cause analysis request warning:', error.message);
    throw error;
  }
}

/**
 * Triggers Stage 7 Explainable Priority calculation for a report/incident.
 *
 * @param {string} identifier - Firestore docId or human reportId
 * @returns {Promise<{ success: boolean, priorityAssessment: Object }>}
 */
export async function requestPriorityCalculation(identifier) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/reports/${encodeURIComponent(identifier)}/priority`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Server responded with ${response.status}`);
    }

    return data;
  } catch (error) {
    console.warn('Priority calculation request warning:', error.message);
    throw error;
  }
}

/**
 * Triggers Stage 9 AI Action & Resource Recommendation for a report/incident.
 *
 * @param {string} identifier - Firestore docId or human reportId
 * @returns {Promise<{ success: boolean, resourceRecommendation: Object }>}
 */
export async function requestResourceRecommendation(identifier) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/reports/${encodeURIComponent(identifier)}/recommendation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Server responded with ${response.status}`);
    }

    return data;
  } catch (error) {
    console.warn('Resource recommendation request warning:', error.message);
    throw error;
  }
}

/**
 * Stage 10: Human / Officer Approval of AI Resource Recommendation
 *
 * @param {string} identifier - Firestore docId or human reportId
 * @param {string} [officerName='demo-officer']
 * @returns {Promise<{ success: boolean, status: string, resourceRecommendation: Object }>}
 */
export async function approveResourceRecommendation(identifier, officerName = 'demo-officer') {
  try {
    const response = await fetch(`${BACKEND_URL}/api/reports/${encodeURIComponent(identifier)}/approve-recommendation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ officerName }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Server responded with ${response.status}`);
    }

    return data;
  } catch (error) {
    console.warn('Approve recommendation warning:', error.message);
    throw error;
  }
}

/**
 * Stage 10: Human / Officer Rejection of AI Resource Recommendation
 *
 * @param {string} identifier - Firestore docId or human reportId
 * @param {string} reason - Rejection rationale
 * @param {string} [officerName='demo-officer']
 * @returns {Promise<{ success: boolean, resourceRecommendation: Object }>}
 */
export async function rejectResourceRecommendation(identifier, reason, officerName = 'demo-officer') {
  try {
    const response = await fetch(`${BACKEND_URL}/api/reports/${encodeURIComponent(identifier)}/reject-recommendation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason, officerName }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Server responded with ${response.status}`);
    }

    return data;
  } catch (error) {
    console.warn('Reject recommendation warning:', error.message);
    throw error;
  }
}

/**
 * Stage 11: Field Worker Workflow Status Update (accepted | in_progress)
 */
export async function updateWorkerJobStatus(identifier, status, { workerName = 'Demo Field Worker', note = '' } = {}) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/reports/${encodeURIComponent(identifier)}/worker-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status, workerName, note }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Server responded with ${response.status}`);
    }

    return data;
  } catch (error) {
    console.warn('Worker status update warning:', error.message);
    throw error;
  }
}

/**
 * Stage 12: Field Worker Marks Resolved -> Triggers AI Resolution Assessment
 */
export async function submitWorkerResolution(identifier, {
  workPerformed = '',
  beforeEvidence = '',
  afterEvidence = '',
  workerName = 'Demo Field Worker',
  teamName = '',
} = {}) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/reports/${encodeURIComponent(identifier)}/resolution-assessment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workPerformed,
        beforeEvidence,
        afterEvidence,
        workerName,
        teamName,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Server responded with ${response.status}`);
    }

    return data;
  } catch (error) {
    console.warn('Resolution assessment request warning:', error.message);
    throw error;
  }
}

/**
 * Stage 12: Municipal Officer Confirms Resolution
 */
export async function confirmResolution(identifier, officerName = 'demo-officer') {
  try {
    const response = await fetch(`${BACKEND_URL}/api/reports/${encodeURIComponent(identifier)}/confirm-resolution`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ officerName }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Server responded with ${response.status}`);
    }

    return data;
  } catch (error) {
    console.warn('Confirm resolution request warning:', error.message);
    throw error;
  }
}

/**
 * Stage 13: Fetch Civic Memory Analysis & Recurring Problems
 */
export async function fetchCivicMemoryAnalysis() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/reports/civic-memory`);
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Server responded with ${response.status}`);
    }
    return data;
  } catch (error) {
    console.warn('Civic memory fetch warning:', error.message);
    throw error;
  }
}

/**
 * Stage 16: Fetch Predictive Civic Risk Assessments
 * Returns area-level predicted civic risks based on historical municipal records.
 */
export async function fetchPredictiveRiskAssessments() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/reports/predictive-risk`);
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Server responded with ${response.status}`);
    }
    return data;
  } catch (error) {
    console.warn('Predictive risk fetch warning:', error.message);
    throw error;
  }
}

/**
 * Stage 16: Recalculate and Persist Predictive Civic Risk
 */
export async function recalculatePredictiveRisk() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/reports/predictive-risk/recalculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Server responded with ${response.status}`);
    }
    return data;
  } catch (error) {
    console.warn('Predictive risk recalculation warning:', error.message);
    throw error;
  }
}

/**
 * Stage 17: Fetch Civic Knowledge Graph (nodes, edges, statistics)
 */
export async function fetchCivicKnowledgeGraph() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/knowledge-graph`);
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Server responded with ${response.status}`);
    }
    return data;
  } catch (error) {
    console.warn('Knowledge graph fetch warning:', error.message);
    throw error;
  }
}

/**
 * Stage 17: Rebuild Civic Knowledge Graph from source ledgers
 */
export async function rebuildCivicKnowledgeGraph() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/knowledge-graph/rebuild`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Server responded with ${response.status}`);
    }
    return data;
  } catch (error) {
    console.warn('Knowledge graph rebuild warning:', error.message);
    throw error;
  }
}

/**
 * Stage 17: Query incident intelligence & explainable causal path
 */
export async function fetchIncidentIntelligence(incidentId) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/knowledge-graph/incident/${encodeURIComponent(incidentId)}`);
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Server responded with ${response.status}`);
    }
    return data;
  } catch (error) {
    console.warn('Incident intelligence fetch warning:', error.message);
    throw error;
  }
}

/**
 * Stage 17: AI Graph Interpretation with Gemini for selected incident chain
 */
export async function requestAiGraphInterpretation(incidentId) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/knowledge-graph/interpret`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ incidentId }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Server responded with ${response.status}`);
    }
    return data;
  } catch (error) {
    console.warn('AI graph interpretation warning:', error.message);
    throw error;
  }
}

/**
 * Stage 18: Preventive Action Planner - Fetch all plans
 */
export async function fetchPreventiveActionPlans() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/preventive-planner`);
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Server responded with ${response.status}`);
    }
    return data;
  } catch (error) {
    console.warn('Preventive action plans fetch warning:', error.message);
    throw error;
  }
}

/**
 * Stage 18: Preventive Action Planner - Fetch single plan
 */
export async function fetchPreventiveActionPlanById(planId) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/preventive-planner/${encodeURIComponent(planId)}`);
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Server responded with ${response.status}`);
    }
    return data;
  } catch (error) {
    console.warn(`Preventive plan ${planId} fetch warning:`, error.message);
    throw error;
  }
}

/**
 * Stage 18: Preventive Action Planner - Update Officer Review Status
 */
export async function updatePreventivePlanStatus(planId, { status, approvedBy = 'demo-officer', notes = '' } = {}) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/preventive-planner/${encodeURIComponent(planId)}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status, approvedBy, notes }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Server responded with ${response.status}`);
    }
    return data;
  } catch (error) {
    console.warn(`Update plan ${planId} status warning:`, error.message);
    throw error;
  }
}

/**
 * Stage 19: Municipal What-If Simulator - Fetch scenarios for incident
 */
export async function fetchSimulationScenarios(incidentId = 'cluster_drainage_school_road') {
  try {
    const response = await fetch(`${BACKEND_URL}/api/simulator/scenarios/${encodeURIComponent(incidentId)}`);
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Server responded with ${response.status}`);
    }
    return data;
  } catch (error) {
    console.warn('Simulator scenarios fetch warning:', error.message);
    throw error;
  }
}

/**
 * Stage 19: Municipal What-If Simulator - Evaluate on demand
 */
export async function evaluateScenarioOnDemand(incidentId) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/simulator/evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ incidentId }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Server responded with ${response.status}`);
    }
    return data;
  } catch (error) {
    console.warn('On-demand scenario evaluation warning:', error.message);
    throw error;
  }
}

/**
 * Stage 20: Context-Aware Civic Risk - Fetch all corridors
 */
export async function fetchContextRisks() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/context-risk`);
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Server responded with ${response.status}`);
    }
    return data;
  } catch (error) {
    console.warn('Context risk fetch warning:', error.message);
    throw error;
  }
}

/**
 * Stage 20: Context-Aware Civic Risk - Fetch specific corridor
 */
export async function fetchContextRiskByArea(areaId) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/context-risk/${encodeURIComponent(areaId)}`);
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Server responded with ${response.status}`);
    }
    return data;
  } catch (error) {
    console.warn(`Context risk for ${areaId} fetch warning:`, error.message);
    throw error;
  }
}

/**
 * Stage 21: Municipal AI Copilot - Query assistant
 */
export async function queryMunicipalCopilot(question) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/copilot/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Server responded with ${response.status}`);
    }
    return data;
  } catch (error) {
    console.warn('Municipal Copilot query warning:', error.message);
    throw error;
  }
}

/**
 * Stage 21: Municipal AI Copilot - Fetch suggested questions
 */
export async function fetchCopilotSuggestedQuestions() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/copilot/suggested-questions`);
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Server responded with ${response.status}`);
    }
    return data;
  } catch (error) {
    console.warn('Copilot suggested questions fetch warning:', error.message);
    throw error;
  }
}

/**
 * Fetch notifications for citizen
 */
export async function fetchCitizenNotifications(userId = 'demo-citizen') {
  try {
    const response = await fetch(`${BACKEND_URL}/api/reports/notifications/${encodeURIComponent(userId)}`);
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch notifications');
    }
    return data.notifications || [];
  } catch (error) {
    console.warn('Notifications fetch warning:', error.message);
    return [];
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notifId) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/reports/notifications/${encodeURIComponent(notifId)}/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return await response.json();
  } catch (error) {
    console.warn('Mark notification read warning:', error.message);
    return { success: false };
  }
}

/**
 * Municipal Officer Direct Assignment of Field Unit
 */
export async function directAssignReport(identifier, { teamName, department, officerName = 'demo-officer', notes = '' } = {}) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/reports/${encodeURIComponent(identifier)}/direct-assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamName, department, officerName, notes }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to assign team');
    }
    return data;
  } catch (error) {
    console.warn('Direct assign report warning:', error.message);
    throw error;
  }
}

/**
 * Stage 9 & 10: Municipal Officer Review & Work Order Creation
 */
export async function createWorkOrder(identifier, {
  officerName = 'Municipal Officer',
  officerDecision = 'approved',
  assignedDepartment = 'Stormwater & Drainage',
  priority = null,
  workersRequired = 2,
  officerInstructions = '',
  officerNotes = '',
} = {}) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/reports/${encodeURIComponent(identifier)}/work-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        officerName,
        officerDecision,
        assignedDepartment,
        priority,
        workersRequired,
        officerInstructions,
        officerNotes,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to create work order');
    }
    return data;
  } catch (error) {
    console.warn('Create work order warning:', error.message);
    throw error;
  }
}

/**
 * Fast AI Complaint Pre-Submission Validation using backend Gemini.
 * Compares complaint text, photo, category, and location.
 *
 * @param {Object} params
 * @param {string} params.description
 * @param {string} params.category
 * @param {string} params.address
 * @param {string} [params.locationStatus]
 * @param {string} [params.photoDataUrl]
 * @param {string} [params.imageUrl]
 * @returns {Promise<{ status: 'MATCH'|'MISMATCH'|'UNCERTAIN', confidence: number, reason: string, categoryMatch: boolean, imageMatch: boolean|null, suggestedCategory: string|null, guidance: string }>}
 */
export async function validateComplaintInputs({
  description,
  address = '',
  locationStatus = '',
  latitude = null,
  longitude = null,
  photoDataUrl = null,
  imageUrl = null,
  category = '',
}) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/reports/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description,
        address,
        locationStatus,
        latitude,
        longitude,
        photoDataUrl,
        imageUrl,
        category,
      }),
    });

    const data = await response.json();
    if (data?.success && data?.validation) {
      return data.validation;
    }
    return {
      decision: 'FLAGGED_FOR_REVIEW',
      status: 'UNCERTAIN',
      confidence: 60,
      detectedProblem: description ? description.slice(0, 80) : 'Civic Grievance',
      category: 'Other',
      department: 'Municipal Administration',
      severity: 'Medium',
      safetyRisk: 'Medium',
      priority: 'Medium',
      layers: {
        description: { status: 'PASSED', clarity: 'Medium', civicRelevance: true, missingDetails: [], explanation: 'Text received.' },
        image: { status: photoDataUrl || imageUrl ? 'UNCLEAR' : 'OPTIONAL_OMITTED', isProvided: Boolean(photoDataUrl || imageUrl), explanation: 'Optional photo.' },
        location: { status: 'UNVERIFIED', hasCoordinates: Boolean(latitude && longitude), isPlausible: true, explanation: 'Location recorded.' },
        crossValidation: { status: 'UNCERTAIN', contradictionFlags: [], explanation: 'Validation response incomplete.' },
        classification: { detectedProblem: 'Civic Grievance', category: 'Other', department: 'Municipal Administration', severity: 'Medium', safetyRisk: 'Medium', suggestedPriority: 'Medium' },
        duplicatesAndAbuse: { status: 'CLEAN', isDuplicate: false, isSpam: false, explanation: 'Heuristics clear.' },
      },
      missingInfo: [],
      issues: ['Validation response incomplete; forwarded for manual officer review.'],
      contradictionFlags: [],
      recommendedNextAction: 'Your report will be reviewed directly by the Municipal Officer.',
      canSubmit: true,
      requiresOfficerReview: true,
      summary: 'Validation response incomplete; forwarded for manual officer review.',
      reason: 'Validation response incomplete; forwarded for manual officer review.',
      guidance: 'Your report will be reviewed directly by the Municipal Officer.',
    };
  } catch (err) {
    console.warn('[AI Validation] Backend unreachable, falling back to UNCERTAIN:', err.message);
    return {
      decision: 'FLAGGED_FOR_REVIEW',
      status: 'UNCERTAIN',
      confidence: 60,
      detectedProblem: description ? description.slice(0, 80) : 'Civic Grievance',
      category: 'Other',
      department: 'Municipal Administration',
      severity: 'Medium',
      safetyRisk: 'Medium',
      priority: 'Medium',
      layers: {
        description: { status: 'PASSED', clarity: 'Medium', civicRelevance: true, missingDetails: [], explanation: 'Text received.' },
        image: { status: photoDataUrl || imageUrl ? 'UNCLEAR' : 'OPTIONAL_OMITTED', isProvided: Boolean(photoDataUrl || imageUrl), explanation: 'Offline.' },
        location: { status: 'UNVERIFIED', hasCoordinates: Boolean(latitude && longitude), isPlausible: true, explanation: 'Offline.' },
        crossValidation: { status: 'UNCERTAIN', contradictionFlags: [], explanation: 'Offline.' },
        classification: { detectedProblem: 'Civic Grievance', category: 'Other', department: 'Municipal Administration', severity: 'Medium', safetyRisk: 'Medium', suggestedPriority: 'Medium' },
        duplicatesAndAbuse: { status: 'CLEAN', isDuplicate: false, isSpam: false, explanation: 'Offline.' },
      },
      missingInfo: [],
      issues: ['Automated AI check offline. Report flagged for Municipal Officer manual review.'],
      contradictionFlags: [],
      recommendedNextAction: 'Your report will be reviewed directly by the Municipal Officer.',
      canSubmit: true,
      requiresOfficerReview: true,
      summary: 'Automated AI check offline. Report flagged for Municipal Officer manual review.',
      reason: 'Automated AI check offline. Report flagged for Municipal Officer manual review.',
      guidance: 'Your report will be reviewed directly by the Municipal Officer.',
    };
  }
}



