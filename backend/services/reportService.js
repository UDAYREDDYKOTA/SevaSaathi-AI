const { doc, updateDoc, getDoc } = require('firebase/firestore');
const { db } = require('../config/firebase');

/**
 * Saves AI analysis into the corresponding Firestore report document under the `aiAnalysis` field,
 * along with similar complaints, priority assessment, and incident fusion.
 *
 * @param {string} docId - Firestore document ID
 * @param {Object} aiAnalysis - Validated AI analysis object
 * @param {Object|null} incidentFusion - Incident fusion results
 * @param {Object|null} similarComplaints - Similar complaints linkage
 * @param {Object|null} priorityAssessment - Operational priority assessment
 * @returns {Promise<{ docId: string, aiAnalysis: Object }>}
 */
async function saveAiAnalysisToFirestore(docId, aiAnalysis, incidentFusion = null, similarComplaints = null, priorityAssessment = null) {
  if (!docId) {
    throw new Error('Cannot save AI analysis: Missing Firestore document ID (docId)');
  }

  const reportRef = doc(db, 'reports', docId);

  const updatePayload = {
    aiAnalysis: aiAnalysis,
  };

  if (incidentFusion) {
    updatePayload.incidentFusion = incidentFusion;
  }

  if (similarComplaints) {
    updatePayload.similarComplaints = similarComplaints;
  }

  if (priorityAssessment) {
    updatePayload.priorityAssessment = priorityAssessment;
  }

  // Update only the analyzed fields inside the existing document
  await updateDoc(reportRef, updatePayload);

  return {
    docId,
    aiAnalysis,
    incidentFusion,
    similarComplaints,
    priorityAssessment,
  };
}

module.exports = {
  saveAiAnalysisToFirestore,
};
