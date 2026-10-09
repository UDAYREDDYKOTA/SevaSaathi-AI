import { collection, doc, setDoc, serverTimestamp, getDocs, query, where, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from './config';

/**
 * Creates and saves a new civic problem report to the Firestore 'reports' collection.
 * Strictly requires an authenticated citizen UID matching request.auth.uid.
 * Follows SAVE-BEFORE-AI architectural principle.
 *
 * @param {Object} reportData
 * @param {string} reportData.description - Citizen's description of the problem
 * @param {string} reportData.category - Problem category (Roads, Drainage, Water, etc.)
 * @param {number|null} [reportData.latitude=null] - Latitude coordinate
 * @param {number|null} [reportData.longitude=null] - Longitude coordinate
 * @param {string} [reportData.locationStatus] - Status of location detection
 * @param {string} reportData.submittedBy - Authenticated citizen UID
 * @returns {Promise<{ docId: string, reportId: string }>} Resolves with Firestore doc ID and generated unique report ID
 */
export async function submitReportToFirestore({
  description = '',
  category = '',
  address = '',
  imageUrl = null,
  photoDataUrl = null,
  latitude = null,
  longitude = null,
  locationStatus = 'Location will be detected here',
  submittedBy,
  validationStatus = 'MATCH',
  aiValidation = null,
  detectedProblem = null,
  detectedCategory = null,
  department = null,
  priority = null,
  severity = null,
  safetyRisk = null,
}) {
  if (!isFirebaseConfigured) {
    throw new Error(
      'Firebase configuration is missing in frontend/.env. Please supply actual project credentials.'
    );
  }

  // Ensure submittedBy always reflects the authenticated Firebase user UID when active
  const effectiveUid = auth?.currentUser?.uid || submittedBy;

  if (!effectiveUid) {
    throw new Error('Authentication required: submittedBy UID is missing.');
  }

  // Reference the 'reports' collection
  const reportsCol = collection(db, 'reports');

  // Create a document reference with a cryptographically unique 128-bit Firestore ID
  const reportDocRef = doc(reportsCol);
  const docId = reportDocRef.id;

  // Resolve canonical AI-detected category
  const resolvedCategory = detectedCategory || aiValidation?.category || category || 'Other';
  const categoryCode = resolvedCategory ? resolvedCategory.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() : 'CIV';

  // Build a reliable, collision-free human-readable civic report ID
  const currentYear = new Date().getFullYear();
  const humanReportId = `SS-${currentYear}-${categoryCode || 'CIV'}-${docId.slice(0, 6).toUpperCase()}`;

  // Sanitize image payload: avoid massive base64 strings exceeding Firestore 1MB document limit
  let safeImageUrl = null;
  const rawPhoto = photoDataUrl || imageUrl;
  if (rawPhoto && typeof rawPhoto === 'string' && rawPhoto.length < 400000) {
    safeImageUrl = rawPhoto;
  }

  const nowIso = new Date().toISOString();

  // Construct structured report payload matching strict Firestore security rules
  const reportPayload = {
    reportId: humanReportId,
    description: description.trim(),
    category: resolvedCategory,
    detectedCategory: resolvedCategory,
    detectedProblem: detectedProblem || aiValidation?.detectedProblem || `${resolvedCategory} Grievance`,
    department: department || aiValidation?.department || null,
    priority: priority || aiValidation?.priority || 'Medium',
    severity: severity || aiValidation?.severity || 'Medium',
    safetyRisk: safetyRisk || aiValidation?.safetyRisk || 'Medium',
    address: address.trim(),
    latitude: typeof latitude === 'number' ? latitude : null,
    longitude: typeof longitude === 'number' ? longitude : null,
    locationStatus: address.trim() || locationStatus || 'Location will be detected here',
    imageUrl: safeImageUrl,
    photoDataUrl: safeImageUrl && !safeImageUrl.startsWith('data:') ? safeImageUrl : null,
    status: 'submitted',
    validationStatus: validationStatus || 'MATCH',
    aiValidation: aiValidation || null,
    auditTrail: [
      {
        stage: 'citizen_submitted',
        action: 'Report submitted by citizen',
        by: effectiveUid,
        validationStatus: validationStatus || 'MATCH',
        detectedCategory: resolvedCategory,
        timestamp: nowIso,
      },
    ],
    createdAt: serverTimestamp(),
    submittedBy: effectiveUid,
  };

  const createTimeout = (ms = 15000) =>
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error('Firestore operation timed out. Please check your network connection.')),
        ms
      )
    );

  // Commit document to Firestore with photo size safety retry
  try {
    await Promise.race([
      setDoc(reportDocRef, reportPayload),
      createTimeout(15000),
    ]);
  } catch (initialErr) {
    // If write with photo was rejected due to size or timeout, retry text-only with fresh timeout
    if (reportPayload.imageUrl || reportPayload.photoDataUrl) {
      console.warn('[Firestore] Write with photo failed, retrying text-only write:', initialErr.message);
      const textOnlyPayload = {
        ...reportPayload,
        imageUrl: null,
        photoDataUrl: null,
      };
      await Promise.race([
        setDoc(reportDocRef, textOnlyPayload),
        createTimeout(15000),
      ]);
      return {
        docId,
        reportId: humanReportId,
        ...textOnlyPayload,
      };
    }
    throw initialErr;
  }

  return {
    docId,
    reportId: humanReportId,
    ...reportPayload,
  };
}

/**
 * Fetches all reports submitted by the authenticated citizen from the Firestore 'reports' collection.
 * Sorts reports in-memory by newest first.
 *
 * @param {string} citizenUid - Authenticated citizen UID
 * @returns {Promise<Array<Object>>} Resolves with array of report documents
 */
export async function getCitizenReports(citizenUid) {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase configuration is missing in frontend/.env');
  }

  if (!citizenUid) {
    return [];
  }

  const reportsCol = collection(db, 'reports');

  try {
    const q = query(reportsCol, where('submittedBy', '==', citizenUid));
    const snapshot = await getDocs(q);

    const reports = snapshot.docs.map((docSnap) => ({
      docId: docSnap.id,
      ...docSnap.data(),
    }));

    // Sort newest first
    reports.sort((a, b) => {
      const timeA = a.createdAt?.toMillis
        ? a.createdAt.toMillis()
        : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : 0));
      const timeB = b.createdAt?.toMillis
        ? b.createdAt.toMillis()
        : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : 0));
      return timeB - timeA;
    });

    return reports;
  } catch (err) {
    console.warn('Error querying citizen reports:', err.message);
    throw err;
  }
}

/**
 * Fetches all municipal reports from the Firestore 'reports' collection for the Command Center.
 *
 * @returns {Promise<Array<Object>>} Resolves with array of all civic report documents
 */
export async function getAllMunicipalReports() {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase configuration is missing in frontend/.env');
  }

  const reportsCol = collection(db, 'reports');
  const snapshot = await getDocs(reportsCol);

  const reports = snapshot.docs
    .map((docSnap) => ({
      docId: docSnap.id,
      ...docSnap.data(),
    }))
    .filter((r) => !r.docId.includes('probe') && !r.reportId?.includes('PROBE'));

  // Sort newest first
  reports.sort((a, b) => {
    const timeA = a.createdAt?.toMillis
      ? a.createdAt.toMillis()
      : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : 0));
    const timeB = b.createdAt?.toMillis
      ? b.createdAt.toMillis()
      : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : 0));
    return timeB - timeA;
  });

  return reports;
}

/**
 * Municipal Officer Review: Approves a citizen report, updates Firestore,
 * records the officer's chosen department, worker count, instructions, and creates a citizen notification.
 *
 * @param {Object} params
 * @param {string} params.docId - Firestore document ID
 * @param {string} params.reportId - Human-readable report ID
 * @param {string} params.department - Responsible department chosen by officer
 * @param {number} [params.workersRequired=2] - Number of workers required (min 1)
 * @param {string} [params.officerInstructions=''] - Special officer instructions
 * @param {string} [params.officerName='Municipal Officer'] - Officer name
 * @param {string} [params.officerUid=''] - Officer UID
 * @param {string} [params.submittedBy='demo-citizen'] - Citizen UID who submitted the report
 * @returns {Promise<Object>} Updated report payload
 */
export async function approveReportAndCreateWorkOrderInFirestore({
  docId,
  reportId,
  department = 'Roads',
  workersRequired = 2,
  officerInstructions = '',
  officerName = 'Municipal Officer',
  officerUid = '',
  submittedBy = 'demo-citizen',
  overrideReason = '',
  isFlagOverride = false,
}) {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase configuration is missing in frontend/.env');
  }

  const effectiveDocId = docId;
  const reportDocRef = doc(db, 'reports', effectiveDocId);
  const nowIso = new Date().toISOString();
  const numWorkers = Math.max(1, Number(workersRequired) || 1);

  const newAuditEntries = [
    {
      stage: 'officer_work_order_created',
      action: `Work order approved for ${department} (${numWorkers} workers required)`,
      by: officerName,
      reviewer: officerName,
      decision: 'approved',
      department,
      workersRequired: numWorkers,
      instructions: (officerInstructions || '').trim(),
      timestamp: nowIso,
    },
  ];

  if (overrideReason || isFlagOverride) {
    newAuditEntries.push({
      stage: 'officer_flag_override',
      action: 'Officer reviewed flagged evidence and entered override decision',
      by: officerName,
      reviewer: officerName,
      decision: 'flag_override_approved',
      reason: (overrideReason || '').trim() || 'Officer manually confirmed evidence validity.',
      timestamp: nowIso,
    });
  }

  const updatePayload = {
    status: 'approved',
    officerDecision: 'approved',
    assignedDepartment: department,
    department,
    workersRequired: numWorkers,
    officerInstructions: (officerInstructions || '').trim(),
    reviewedBy: officerName,
    reviewedByUid: officerUid || auth?.currentUser?.uid || 'officer',
    reviewedAt: nowIso,
    approvedAt: nowIso,
    approvedBy: officerName,
    overrideReason: overrideReason ? overrideReason.trim() : null,
    flagOverridden: Boolean(overrideReason || isFlagOverride),
    auditTrail: arrayUnion(...newAuditEntries),
  };

  await updateDoc(reportDocRef, updatePayload);

  // Notify citizen in Firestore notifications collection
  try {
    const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const notifRef = doc(collection(db, 'notifications'), notifId);
    await setDoc(notifRef, {
      id: notifId,
      recipientUid: submittedBy || 'demo-citizen',
      reportId: reportId || effectiveDocId,
      title: 'Work Order Approved',
      message: `Your report ${reportId || effectiveDocId} has been approved for ${department}. Dispatching ${numWorkers} personnel.`,
      type: 'approved',
      isRead: false,
      createdAt: nowIso,
    });
  } catch (notifErr) {
    console.warn('[Firestore] Notification emit warning:', notifErr.message);
  }

  return {
    success: true,
    docId: effectiveDocId,
    reportId: reportId || effectiveDocId,
    ...updatePayload,
  };
}

/**
 * Field Worker Action: Accept Work Order.
 * Transitions status: 'approved' -> 'accepted'.
 */
export async function acceptFieldWorkOrder({
  docId,
  reportId,
  workerName = 'Field Operative',
  workerUid = '',
  department = 'Operations',
  submittedBy = 'demo-citizen',
}) {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase configuration is missing in frontend/.env');
  }

  const effectiveDocId = docId;
  const reportDocRef = doc(db, 'reports', effectiveDocId);
  const nowIso = new Date().toISOString();

  const updatePayload = {
    status: 'accepted',
    acceptedBy: workerName,
    acceptedByUid: workerUid || auth?.currentUser?.uid || 'worker',
    acceptedAt: nowIso,
    auditTrail: arrayUnion({
      stage: 'worker_accepted',
      action: `Work order accepted by ${workerName}`,
      by: workerName,
      timestamp: nowIso,
    }),
  };

  await updateDoc(reportDocRef, updatePayload);

  // Notify citizen
  try {
    const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const notifRef = doc(collection(db, 'notifications'), notifId);
    await setDoc(notifRef, {
      id: notifId,
      recipientUid: submittedBy || 'demo-citizen',
      reportId: reportId || effectiveDocId,
      title: 'Work Order Assigned',
      message: `Your report has been assigned to the ${department} department.`,
      type: 'assigned',
      isRead: false,
      createdAt: nowIso,
    });
  } catch (notifErr) {
    console.warn('[Firestore] Notification emit warning:', notifErr.message);
  }

  return { success: true, docId: effectiveDocId, status: 'accepted' };
}

/**
 * Field Worker Action: Start Work.
 * Transitions status: 'accepted' -> 'in_progress'.
 */
export async function startFieldWorkOrder({
  docId,
  reportId,
  workerName = 'Field Operative',
  workerUid = '',
  submittedBy = 'demo-citizen',
}) {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase configuration is missing in frontend/.env');
  }

  const effectiveDocId = docId;
  const reportDocRef = doc(db, 'reports', effectiveDocId);
  const nowIso = new Date().toISOString();

  const updatePayload = {
    status: 'in_progress',
    workStartedBy: workerName,
    workStartedByUid: workerUid || auth?.currentUser?.uid || 'worker',
    workStartedAt: nowIso,
    auditTrail: arrayUnion({
      stage: 'worker_started',
      action: `Work started on-site by ${workerName}`,
      by: workerName,
      timestamp: nowIso,
    }),
  };

  await updateDoc(reportDocRef, updatePayload);

  // Notify citizen
  try {
    const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const notifRef = doc(collection(db, 'notifications'), notifId);
    await setDoc(notifRef, {
      id: notifId,
      recipientUid: submittedBy || 'demo-citizen',
      reportId: reportId || effectiveDocId,
      title: 'Work In Progress',
      message: 'Work has started on your reported issue.',
      type: 'in_progress',
      isRead: false,
      createdAt: nowIso,
    });
  } catch (notifErr) {
    console.warn('[Firestore] Notification emit warning:', notifErr.message);
  }

  return { success: true, docId: effectiveDocId, status: 'in_progress' };
}

/**
 * Field Worker Action: Mark Work Completed.
 * Transitions status: 'in_progress' -> 'completed'.
 * Stores worker notes, completion photo, worker UID, and completion timestamp.
 */
export async function completeFieldWorkOrder({
  docId,
  reportId,
  workerName = 'Field Operative',
  workerUid = '',
  workerNotes = '',
  completionPhoto = null,
  submittedBy = 'demo-citizen',
}) {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase configuration is missing in frontend/.env');
  }

  const effectiveDocId = docId;
  const reportDocRef = doc(db, 'reports', effectiveDocId);
  const nowIso = new Date().toISOString();

  let safePhoto = null;
  if (completionPhoto && typeof completionPhoto === 'string' && completionPhoto.length < 400000) {
    safePhoto = completionPhoto;
  }

  const updatePayload = {
    status: 'completed',
    completedBy: workerName,
    completedByUid: workerUid || auth?.currentUser?.uid || 'worker',
    completedAt: nowIso,
    workerNotes: (workerNotes || '').trim(),
    completionPhoto: safePhoto,
    auditTrail: arrayUnion({
      stage: 'worker_completed',
      action: `Work completed by ${workerName}`,
      by: workerName,
      notes: (workerNotes || '').trim(),
      timestamp: nowIso,
    }),
  };

  await updateDoc(reportDocRef, updatePayload);

  // Notify citizen
  try {
    const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const notifRef = doc(collection(db, 'notifications'), notifId);
    await setDoc(notifRef, {
      id: notifId,
      recipientUid: submittedBy || 'demo-citizen',
      reportId: reportId || effectiveDocId,
      title: 'Work Completed',
      message: 'Your reported issue has been marked as completed.',
      type: 'completed',
      isRead: false,
      createdAt: nowIso,
    });
  } catch (notifErr) {
    console.warn('[Firestore] Notification emit warning:', notifErr.message);
  }

  return { success: true, docId: effectiveDocId, status: 'completed', ...updatePayload };
}

/**
 * Municipal Officer Action: Reject Report.
 * Transitions status: -> 'rejected'.
 * Saves rejectionReason, rejectedBy, rejectedAt, updates auditTrail,
 * and notifies citizen.
 * Crucially: Rejected reports NEVER generate field-worker work orders.
 */
export async function rejectReportInFirestore({
  docId,
  reportId,
  rejectionReason,
  officerName = 'Municipal Officer',
  officerUid = '',
  submittedBy = 'demo-citizen',
}) {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase configuration is missing in frontend/.env');
  }

  const effectiveDocId = docId;
  const reportDocRef = doc(db, 'reports', effectiveDocId);
  const nowIso = new Date().toISOString();

  const cleanReason = (rejectionReason || 'Complaint does not meet municipal criteria or jurisdiction requirements.').trim();

  const updatePayload = {
    status: 'rejected',
    officerDecision: 'rejected',
    rejectedBy: officerName,
    rejectedByUid: officerUid || auth?.currentUser?.uid || 'officer',
    rejectedAt: nowIso,
    rejectionReason: cleanReason,
    auditTrail: arrayUnion({
      stage: 'officer_rejected',
      action: `Report rejected: ${cleanReason}`,
      by: officerName,
      reviewer: officerName,
      decision: 'rejected',
      reason: cleanReason,
      timestamp: nowIso,
    }),
  };

  await updateDoc(reportDocRef, updatePayload);

  // Notify citizen in Firestore notifications collection
  try {
    const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const notifRef = doc(collection(db, 'notifications'), notifId);
    await setDoc(notifRef, {
      id: notifId,
      recipientUid: submittedBy || 'demo-citizen',
      reportId: reportId || effectiveDocId,
      title: 'Report Rejected',
      message: `Your report ${reportId || effectiveDocId} was rejected by the Municipal Officer: ${cleanReason}`,
      type: 'rejected',
      isRead: false,
      createdAt: nowIso,
    });
  } catch (notifErr) {
    console.warn('[Firestore] Notification emit warning:', notifErr.message);
  }

  return {
    success: true,
    docId: effectiveDocId,
    reportId: reportId || effectiveDocId,
    ...updatePayload,
  };
}



