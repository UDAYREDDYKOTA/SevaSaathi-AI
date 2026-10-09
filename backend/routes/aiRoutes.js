const express = require('express');
const router = express.Router();
const { doc, updateDoc, getDoc, collection, query, where, getDocs } = require('firebase/firestore');
const { db } = require('../config/firebase');
const { analyzeReportWithGemini, validateComplaintWithGemini } = require('../services/geminiService');
const { saveAiAnalysisToFirestore } = require('../services/reportService');
const { performIncidentFusion } = require('../services/fusionService');
const { analyzeAndSaveRootCause } = require('../services/rootCauseService');
const { calculateAndSavePriority, evaluatePriorityFactors } = require('../services/priorityService');
const {
  generateAndSaveResourceRecommendation,
  approveRecommendation,
  rejectRecommendation,
} = require('../services/resourceRecommendationService');
const {
  assessAndSaveResolution,
  updateWorkerJobStatus,
  confirmOfficerResolution,
} = require('../services/resolutionAssessmentService');
const { getCivicMemoryAnalysis } = require('../services/civicMemoryService');
const {
  getPredictiveRiskAssessments,
  generateAndPersistPredictiveRiskAssessments,
} = require('../services/predictiveRiskService');
const {
  createNotification,
  getNotificationsForUser,
  markNotificationAsRead,
} = require('../services/notificationService');

/**
 * POST /api/reports/validate & /api/reports/validate-complaint
 * Pre-submission AI validation comparing citizen text, category, location, and optional photo.
 * Outcomes:
 * - MATCH: Allow submission
 * - MISMATCH: Block submission with clear explanation and suggestion
 * - UNCERTAIN: Send for officer review; do not automatically reject
 * Missing optional photo is never treated as a mismatch.
 */
async function handleValidateComplaint(req, res) {
  const { description, category, address, locationStatus, latitude, longitude, photoDataUrl, imageUrl } = req.body;

  if (!description || !description.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Please describe the problem you are experiencing.',
    });
  }

  try {
    const validation = await validateComplaintWithGemini({
      description: description.trim(),
      category: category || '',
      address: address || '',
      locationStatus: locationStatus || '',
      latitude: typeof latitude === 'number' ? latitude : null,
      longitude: typeof longitude === 'number' ? longitude : null,
      photoDataUrl: photoDataUrl || null,
      imageUrl: imageUrl || null,
    });

    return res.status(200).json({
      success: true,
      validation,
    });
  } catch (err) {
    console.error('[AI Route] Validation error:', err);
    return res.status(200).json({
      success: true,
      validation: {
        decision: 'FLAGGED_FOR_REVIEW',
        status: 'UNCERTAIN',
        confidence: 60,
        detectedProblem: description.slice(0, 80) || 'Civic Issue',
        category: 'Other',
        department: 'Municipal Administration',
        severity: 'Medium',
        safetyRisk: 'Medium',
        priority: 'Medium',
        layers: {
          description: { status: 'PASSED', clarity: 'Medium', civicRelevance: true, missingDetails: [], explanation: 'Text received.' },
          image: { status: photoDataUrl || imageUrl ? 'UNCLEAR' : 'OPTIONAL_OMITTED', isProvided: Boolean(photoDataUrl || imageUrl), explanation: 'Image check offline.' },
          location: { status: 'UNVERIFIED', hasCoordinates: Boolean(latitude && longitude), isPlausible: true, explanation: 'Location check offline.' },
          crossValidation: { status: 'UNCERTAIN', contradictionFlags: [], explanation: 'Automated cross-validation offline.' },
          classification: { detectedProblem: 'Civic Grievance', category: 'Other', department: 'Municipal Administration', severity: 'Medium', safetyRisk: 'Medium', suggestedPriority: 'Medium' },
          duplicatesAndAbuse: { status: 'CLEAN', isDuplicate: false, isSpam: false, explanation: 'Duplicate check offline.' },
        },
        missingInfo: [],
        issues: ['Automated verification offline; queued for municipal officer review.'],
        contradictionFlags: [],
        recommendedNextAction: 'Your report will be reviewed directly by the Municipal Officer.',
        canSubmit: true,
        requiresOfficerReview: true,
        summary: 'Automated AI check offline. Report flagged for Municipal Officer manual review.',
      },
    });
  }
}

router.post('/validate', handleValidateComplaint);
router.post('/validate-complaint', handleValidateComplaint);

/**
 * POST /api/reports/analyze
 * Analyzes an existing citizen report with Gemini AI, performs Incident Fusion,
 * deterministic Priority calculation, and Similar Complaint linkage.
 */
router.post('/analyze', async (req, res) => {
  const {
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
  } = req.body;

  // Validate required parameters
  if (!docId) {
    return res.status(400).json({
      success: false,
      error: 'Missing docId. The report must be saved in Firestore before AI analysis.',
    });
  }

  try {
    console.log(`[AI Pipeline] Starting Gemini analysis for report: ${reportId || docId}`);

    // Step 1: Run Gemini analysis with structured JSON schema
    const aiAnalysis = await analyzeReportWithGemini({
      description: description || '',
      category: category || '',
      address: address || '',
      locationStatus: locationStatus || '',
    });

    console.log(`[AI Pipeline] Gemini analysis successful for ${reportId || docId}: ${aiAnalysis.issueType} (${aiAnalysis.severity}, Authenticity: ${aiAnalysis.authenticityAssessment})`);

    // Step 2: Run Incident Fusion against existing Firestore reports
    console.log(`[Incident Fusion] Analyzing incident relationships for ${reportId || docId}...`);
    const incidentFusion = await performIncidentFusion({
      docId,
      reportId,
      description: description || '',
      category: category || '',
      latitude,
      longitude,
      locationStatus: address || locationStatus,
      createdAt,
    });

    console.log(`[Incident Fusion] Result for ${reportId || docId}: ${incidentFusion.fusionStatus} (${incidentFusion.fusionConfidence}%), Related: ${incidentFusion.relatedReportIds.length}`);

    // Step 3: Build structured Similar Complaints per Requirement 9 & 17
    const relatedCount = incidentFusion.relatedReportIds ? incidentFusion.relatedReportIds.length : 0;
    const similarComplaints = {
      count: relatedCount,
      relatedReportIds: incidentFusion.relatedReportIds || [],
      evidence: incidentFusion.evidence || [],
      summary: relatedCount > 0
        ? `${relatedCount} similar complaints found nearby.`
        : 'No similar complaints identified nearby.',
      analyzedAt: new Date().toISOString(),
    };

    // Step 4: Run Explainable Priority Engine (deterministic formula)
    let priorityAssessment = null;
    try {
      console.log(`[AI Pipeline] Running Explainable Priority Calculation for ${reportId || docId}...`);
      const pResult = await calculateAndSavePriority(docId);
      priorityAssessment = pResult.priorityAssessment;
    } catch (pError) {
      console.warn(`[AI Pipeline] Priority calculation skipped/failed for ${docId}:`, pError.message);
      // Fallback: evaluate priority deterministically in-memory
      try {
        const inMemoryReport = {
          reportId,
          description,
          category,
          address,
          aiAnalysis,
          incidentFusion,
          createdAt: createdAt || new Date().toISOString(),
        };
        const related = (incidentFusion.relatedReportIds || []).map((id) => ({ reportId: id }));
        priorityAssessment = evaluatePriorityFactors(inMemoryReport, related);
      } catch (fallbackErr) {
        console.warn('[AI Pipeline] In-memory priority calculation failed:', fallbackErr.message);
      }
    }

    // Step 5: Save AI analysis, incidentFusion, similarComplaints & priorityAssessment to Firestore
    let firestoreSaved = false;
    try {
      await saveAiAnalysisToFirestore(docId, aiAnalysis, incidentFusion, similarComplaints, priorityAssessment);
      firestoreSaved = true;
      console.log(`[AI Pipeline] Successfully saved aiAnalysis & similarComplaints to Firestore document ${docId}`);
    } catch (saveError) {
      console.warn(`[AI Pipeline] Firestore save warning for ${docId}:`, saveError.message);
    }

    // Step 6: AI Probable Root Cause Analysis (if incident has related reports)
    let rootCauseAnalysis = null;
    if (incidentFusion.relatedReportIds && incidentFusion.relatedReportIds.length > 0) {
      try {
        console.log(`[AI Pipeline] Running AI Probable Root Cause Analysis for ${reportId || docId}...`);
        const rcResult = await analyzeAndSaveRootCause(docId);
        rootCauseAnalysis = rcResult.rootCauseAnalysis;
      } catch (rcError) {
        console.warn(`[AI Pipeline] Root cause analysis skipped/failed for ${docId}:`, rcError.message);
      }
    }

    // Step 7: Emit citizen lifecycle notification for analysis
    try {
      await createNotification({
        recipientUid: submittedBy || 'demo-citizen',
        reportId: reportId || docId,
        title: 'Report Triaged & Analyzed',
        message: `Your report for "${aiAnalysis.issueType}" has been analyzed. Department: ${aiAnalysis.department}. Operational Priority: ${priorityAssessment?.level || 'Standard'}.`,
        type: 'analyzed',
      });
    } catch (notifErr) {
      console.warn('[AI Pipeline] Notification emit warning:', notifErr.message);
    }

    return res.json({
      success: true,
      docId,
      reportId,
      aiAnalysis,
      incidentFusion,
      similarComplaints,
      rootCauseAnalysis,
      priorityAssessment,
      firestoreSaved,
    });
  } catch (error) {
    console.error(`[AI Pipeline] Analysis error for ${reportId || docId}:`, error.message);

    // Return safe, sanitized error message (never expose internal keys)
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to process AI analysis',
    });
  }
});

/**
 * POST /api/reports/:id/root-cause
 * Standalone endpoint to run AI Probable Root Cause Analysis on any report by docId or reportId.
 */
router.post('/:id/root-cause', async (req, res) => {
  const identifier = req.params.id;
  if (!identifier) {
    return res.status(400).json({ success: false, error: 'Report identifier is required' });
  }

  try {
    console.log(`[Root Cause Route] Requesting root cause analysis for identifier: ${identifier}`);
    const result = await analyzeAndSaveRootCause(identifier);
    return res.json({
      success: true,
      docId: result.docId,
      reportId: result.reportId,
      rootCauseAnalysis: result.rootCauseAnalysis,
    });
  } catch (error) {
    console.error(`[Root Cause Route] Analysis error for ${identifier}:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze probable root cause',
    });
  }
});

/**
 * POST /api/reports/root-cause
 * Alternative body-based endpoint for root cause analysis.
 */
router.post('/root-cause', async (req, res) => {
  const identifier = req.body.reportId || req.body.docId || req.body.id;
  if (!identifier) {
    return res.status(400).json({
      success: false,
      error: 'Report identifier (reportId, docId, or id) is required in request body',
    });
  }

  try {
    console.log(`[Root Cause Route] Requesting root cause analysis for: ${identifier}`);
    const result = await analyzeAndSaveRootCause(identifier);
    return res.json({
      success: true,
      docId: result.docId,
      reportId: result.reportId,
      rootCauseAnalysis: result.rootCauseAnalysis,
    });
  } catch (error) {
    console.error(`[Root Cause Route] Analysis error for ${identifier}:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze probable root cause',
    });
  }
});

/**
 * POST /api/reports/:id/priority
 * Standalone endpoint to calculate/recalculate deterministic priority for any report.
 */
router.post('/:id/priority', async (req, res) => {
  const identifier = req.params.id;
  if (!identifier) {
    return res.status(400).json({ success: false, error: 'Report identifier is required' });
  }

  try {
    console.log(`[Priority Route] Calculating priority for identifier: ${identifier}`);
    const result = await calculateAndSavePriority(identifier);
    return res.json({
      success: true,
      docId: result.docId,
      reportId: result.reportId,
      priorityAssessment: result.priorityAssessment,
    });
  } catch (error) {
    console.error(`[Priority Route] Error calculating priority for ${identifier}:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to calculate priority',
    });
  }
});

/**
 * POST /api/reports/priority
 * Alternative body-based endpoint for priority calculation.
 */
router.post('/priority', async (req, res) => {
  const identifier = req.body.reportId || req.body.docId || req.body.id;
  if (!identifier) {
    return res.status(400).json({
      success: false,
      error: 'Report identifier (reportId, docId, or id) is required in request body',
    });
  }

  try {
    console.log(`[Priority Route] Calculating priority for: ${identifier}`);
    const result = await calculateAndSavePriority(identifier);
    return res.json({
      success: true,
      docId: result.docId,
      reportId: result.reportId,
      priorityAssessment: result.priorityAssessment,
    });
  } catch (error) {
    console.error(`[Priority Route] Error calculating priority for ${identifier}:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to calculate priority',
    });
  }
});

/**
 * POST /api/reports/:id/recommendation
 * Standalone endpoint to generate AI Action & Resource Recommendation for a report.
 */
router.post('/:id/recommendation', async (req, res) => {
  const identifier = req.params.id;
  if (!identifier) {
    return res.status(400).json({ success: false, error: 'Report identifier is required' });
  }

  try {
    console.log(`[Recommendation Route] Generating recommendation for: ${identifier}`);
    const result = await generateAndSaveResourceRecommendation(identifier);
    return res.json({
      success: true,
      docId: result.docId,
      reportId: result.reportId,
      resourceRecommendation: result.resourceRecommendation,
    });
  } catch (error) {
    console.error(`[Recommendation Route] Error generating recommendation for ${identifier}:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate resource recommendation',
    });
  }
});

/**
 * POST /api/reports/recommendation
 * Alternative body-based endpoint for resource recommendation.
 */
router.post('/recommendation', async (req, res) => {
  const identifier = req.body.reportId || req.body.docId || req.body.id;
  if (!identifier) {
    return res.status(400).json({
      success: false,
      error: 'Report identifier (reportId, docId, or id) is required in request body',
    });
  }

  try {
    console.log(`[Recommendation Route] Generating recommendation for: ${identifier}`);
    const result = await generateAndSaveResourceRecommendation(identifier);
    return res.json({
      success: true,
      docId: result.docId,
      reportId: result.reportId,
      resourceRecommendation: result.resourceRecommendation,
    });
  } catch (error) {
    console.error(`[Recommendation Route] Error generating recommendation for ${identifier}:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate resource recommendation',
    });
  }
});

/**
 * POST /api/reports/:id/approve-recommendation
 * Stage 10: Human / Officer Approval of AI Resource Recommendation
 */
router.post('/:id/approve-recommendation', async (req, res) => {
  const identifier = req.params.id;
  const officerName = req.body?.officerName || 'demo-officer';

  if (!identifier) {
    return res.status(400).json({ success: false, error: 'Report identifier is required' });
  }

  try {
    console.log(`[Approval Route] Approving recommendation for: ${identifier} by ${officerName}`);
    const result = await approveRecommendation(identifier, officerName);
    return res.json(result);
  } catch (error) {
    console.error(`[Approval Route] Error approving recommendation for ${identifier}:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to approve recommendation',
    });
  }
});

/**
 * POST /api/reports/:id/reject-recommendation
 * Stage 10: Human / Officer Rejection of AI Resource Recommendation
 */
router.post('/:id/reject-recommendation', async (req, res) => {
  const identifier = req.params.id;
  const { reason, officerName } = req.body || {};

  if (!identifier) {
    return res.status(400).json({ success: false, error: 'Report identifier is required' });
  }

  try {
    console.log(`[Rejection Route] Rejecting recommendation for: ${identifier} by ${officerName || 'demo-officer'}`);
    const result = await rejectRecommendation(identifier, reason, officerName);
    return res.json(result);
  } catch (error) {
    console.error(`[Rejection Route] Error rejecting recommendation for ${identifier}:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to reject recommendation',
    });
  }
});

/**
 * POST /api/reports/:id/worker-status
 * Stage 11: Field Worker Workflow Status Update (accepted | in_progress)
 */
router.post('/:id/worker-status', async (req, res) => {
  const identifier = req.params.id;
  const { status, workerName, note } = req.body || {};

  if (!identifier) {
    return res.status(400).json({ success: false, error: 'Report identifier is required' });
  }

  try {
    console.log(`[Worker Route] Updating worker status for ${identifier} -> ${status}`);
    const result = await updateWorkerJobStatus(identifier, status, { workerName, note });
    return res.json(result);
  } catch (error) {
    console.error(`[Worker Route] Error updating worker status for ${identifier}:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update worker status',
    });
  }
});

/**
 * POST /api/reports/:id/resolution-assessment
 * Stage 12: Field Worker Marks Resolved -> Triggers AI Resolution Assessment
 */
router.post('/:id/resolution-assessment', async (req, res) => {
  const identifier = req.params.id;
  const { workPerformed, beforeEvidence, afterEvidence, workerName, teamName } = req.body || {};

  if (!identifier) {
    return res.status(400).json({ success: false, error: 'Report identifier is required' });
  }

  try {
    console.log(`[Resolution Route] Triggering AI Resolution Assessment for ${identifier}...`);
    const result = await assessAndSaveResolution(identifier, {
      workPerformed,
      beforeEvidence,
      afterEvidence,
      workerName,
      teamName,
    });
    return res.json(result);
  } catch (error) {
    console.error(`[Resolution Route] Error evaluating resolution for ${identifier}:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to assess resolution',
    });
  }
});

/**
 * POST /api/reports/:id/confirm-resolution
 * Stage 12: Municipal Officer Confirms Resolution
 */
router.post('/:id/confirm-resolution', async (req, res) => {
  const identifier = req.params.id;
  const officerName = req.body?.officerName || 'demo-officer';

  if (!identifier) {
    return res.status(400).json({ success: false, error: 'Report identifier is required' });
  }

  try {
    console.log(`[Resolution Confirmation Route] Confirming resolution for ${identifier} by ${officerName}`);
    const result = await confirmOfficerResolution(identifier, officerName);
    return res.json(result);
  } catch (error) {
    console.error(`[Resolution Confirmation Route] Error confirming resolution for ${identifier}:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to confirm resolution',
    });
  }
});

/**
 * GET /api/reports/civic-memory
 * Stage 13: Civic Memory & Recurring Problem Identification
 */
router.get('/civic-memory', async (req, res) => {
  try {
    console.log('[Civic Memory Route] Fetching recurring civic patterns...');
    const result = await getCivicMemoryAnalysis();
    return res.json(result);
  } catch (error) {
    console.error('[Civic Memory Route] Error generating civic memory analysis:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate civic memory analysis',
    });
  }
});

/**
 * POST /api/reports/civic-memory
 * Alternative POST route for civic memory
 */
router.post('/civic-memory', async (req, res) => {
  try {
    console.log('[Civic Memory Route] Triggering civic memory analysis...');
    const result = await getCivicMemoryAnalysis();
    return res.json(result);
  } catch (error) {
    console.error('[Civic Memory Route] Error generating civic memory analysis:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate civic memory analysis',
    });
  }
});

/**
 * GET /api/reports/predictive-risk
 * Stage 16: Predictive Civic Risk Engine - Retrieve active area-level risk assessments
 */
router.get('/predictive-risk', async (req, res) => {
  try {
    console.log('[Predictive Risk Route] Fetching predictive civic risk assessments...');
    const result = await getPredictiveRiskAssessments();
    return res.json(result);
  } catch (error) {
    console.error('[Predictive Risk Route] Error retrieving predictive risk assessments:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve predictive risk assessments',
    });
  }
});

/**
 * POST /api/reports/predictive-risk/recalculate
 * Stage 16: Predictive Civic Risk Engine - Recompute & persist risk assessments
 */
router.post('/predictive-risk/recalculate', async (req, res) => {
  try {
    console.log('[Predictive Risk Route] Recalculating predictive civic risk assessments...');
    const result = await generateAndPersistPredictiveRiskAssessments();
    return res.json(result);
  } catch (error) {
    console.error('[Predictive Risk Route] Error recalculating predictive risk assessments:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to recalculate predictive risk assessments',
    });
  }
});

/**
 * GET /api/reports/notifications/:userId
 * Fetch citizen notifications
 */
router.get('/notifications/:userId', async (req, res) => {
  try {
    const notifs = await getNotificationsForUser(req.params.userId);
    return res.json({ success: true, notifications: notifs });
  } catch (err) {
    console.error('[Notifications Route] Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/reports/notifications/:id/read
 * Mark citizen notification as read
 */
router.post('/notifications/:id/read', async (req, res) => {
  try {
    const result = await markNotificationAsRead(req.params.id);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Notifications Route] Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/reports/:id/direct-assign
 * Allows Municipal Officer to assign or update assigned field worker/team
 */
router.post('/:id/direct-assign', async (req, res) => {
  const identifier = req.params.id;
  const { teamName, department, officerName = 'demo-officer', notes = '' } = req.body;

  try {
    let targetDocId = identifier;
    let docRef = doc(db, 'reports', targetDocId);
    let docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      const q = query(collection(db, 'reports'), where('reportId', '==', identifier));
      const snap = await getDocs(q);
      if (snap.empty) {
        return res.status(404).json({ success: false, error: 'Report not found' });
      }
      targetDocId = snap.docs[0].id;
      docRef = doc(db, 'reports', targetDocId);
      docSnap = snap.docs[0];
    }

    const reportData = docSnap.data();
    const assignedTeamName = teamName || 'Rapid Response Unit A';
    const assignedDept = department || reportData.aiAnalysis?.department || reportData.category || 'Municipal Operations';

    const auditTrail = Array.isArray(reportData.auditTrail) ? [...reportData.auditTrail] : [];
    auditTrail.push({
      stage: 'officer_direct_assignment',
      action: `Officer assigned ${assignedTeamName}`,
      by: officerName,
      notes,
      timestamp: new Date().toISOString(),
    });

    const updatePayload = {
      status: 'assigned',
      assignedTeam: {
        teamName: assignedTeamName,
        department: assignedDept,
        assignedAt: new Date().toISOString(),
        assignedBy: officerName,
      },
      auditTrail,
    };

    await updateDoc(docRef, updatePayload);

    // Notify citizen
    try {
      await createNotification({
        recipientUid: reportData.submittedBy || 'demo-citizen',
        reportId: reportData.reportId || targetDocId,
        title: 'Report Assigned',
        message: `Your report ${reportData.reportId || targetDocId} has been assigned to ${assignedTeamName} by the Municipal Officer.`,
        type: 'assigned',
      });
    } catch (notifErr) {
      console.warn('[Direct Assign] Notification warning:', notifErr.message);
    }

    return res.json({
      success: true,
      docId: targetDocId,
      reportId: reportData.reportId || targetDocId,
      status: 'assigned',
      assignedTeam: updatePayload.assignedTeam,
    });
  } catch (err) {
    console.error('[Direct Assign] Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/reports/:id/work-order
 * Municipal Officer Review & Work Order Creation:
 * Approves/rejects complaint, assigns department, sets required workers, and records officer instructions.
 */
router.post('/:id/work-order', async (req, res) => {
  const identifier = req.params.id;
  const {
    officerName = 'Municipal Officer',
    officerDecision = 'approved',
    assignedDepartment = 'Stormwater & Drainage',
    priority = null,
    workersRequired = 2,
    officerInstructions = '',
    officerNotes = '',
  } = req.body || {};

  if (!identifier) {
    return res.status(400).json({ success: false, error: 'Report identifier is required' });
  }

  try {
    const { doc, getDoc, updateDoc, collection, query, where, getDocs } = require('firebase/firestore');
    const { db } = require('../config/firebase');

    let targetDocId = identifier;
    let docRef = doc(db, 'reports', targetDocId);
    let docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      const q = query(collection(db, 'reports'), where('reportId', '==', identifier));
      const snap = await getDocs(q);
      if (snap.empty) {
        return res.status(404).json({ success: false, error: 'Report not found' });
      }
      targetDocId = snap.docs[0].id;
      docRef = doc(db, 'reports', targetDocId);
      docSnap = snap.docs[0];
    }

    const reportData = docSnap.data();
    const isApproved = officerDecision === 'approved';
    const numWorkers = Number(workersRequired) || 1;
    const auditTrail = Array.isArray(reportData.auditTrail) ? [...reportData.auditTrail] : [];

    auditTrail.push({
      stage: isApproved ? 'officer_work_order_created' : 'officer_complaint_rejected',
      action: isApproved
        ? `Officer approved work order for ${assignedDepartment} (${numWorkers} workers required)`
        : 'Officer rejected complaint',
      by: officerName,
      department: assignedDepartment,
      workersRequired: numWorkers,
      instructions: officerInstructions,
      notes: officerNotes,
      timestamp: new Date().toISOString(),
    });

    const updatePayload = {
      status: isApproved ? 'approved' : 'rejected',
      reviewedBy: officerName,
      reviewedAt: new Date().toISOString(),
      approvedAt: isApproved ? new Date().toISOString() : null,
      assignedDepartment,
      workersRequired: numWorkers,
      officerInstructions: officerInstructions || '',
      officerDecision,
      officerNotes: officerNotes || '',
      auditTrail,
    };

    if (priority) {
      updatePayload.priority = priority;
      if (reportData.priorityAssessment) {
        updatePayload.priorityAssessment = {
          ...reportData.priorityAssessment,
          level: priority,
        };
      }
    }

    await updateDoc(docRef, updatePayload);

    // Notify citizen if notification service is available
    try {
      const { createNotification } = require('../services/notificationService');
      await createNotification({
        recipientUid: reportData.submittedBy || 'demo-citizen',
        reportId: reportData.reportId || targetDocId,
        title: isApproved ? 'Work Order Approved' : 'Grievance Review Complete',
        message: isApproved
          ? `Your report ${reportData.reportId || targetDocId} was approved for ${assignedDepartment}. Dispatching ${numWorkers} personnel.`
          : `Your report ${reportData.reportId || targetDocId} has been reviewed by the Municipal Officer.`,
        type: isApproved ? 'approved' : 'review',
      });
    } catch (notifErr) {
      console.warn('[Work Order] Notification notice:', notifErr.message);
    }

    return res.json({
      success: true,
      docId: targetDocId,
      reportId: reportData.reportId || targetDocId,
      ...updatePayload,
    });
  } catch (err) {
    console.error('[Work Order] Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

