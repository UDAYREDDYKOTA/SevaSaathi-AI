/**
 * SevaSaathi AI - Notification Service
 * Manages citizen notifications for complaint lifecycle events:
 * - Report submission
 * - AI analysis completion
 * - Officer review & assignment
 * - Field worker starting work
 * - Final resolution confirmation
 */

const { collection, doc, setDoc, getDocs, updateDoc } = require('firebase/firestore');
const { db } = require('../config/firebase');

// In-memory fallback ledger to guarantee availability
const memoryNotifications = [
  {
    id: 'notif_welcome_demo',
    recipientUid: 'demo-citizen',
    reportId: 'SS-2026-SYS-INIT',
    title: 'Welcome to SevaSaathi AI',
    message: 'Your citizen portal is active. Report civic issues with photos, and track resolution in real time.',
    type: 'welcome',
    isRead: false,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
];

/**
 * Creates and persists a citizen notification.
 */
async function createNotification({
  recipientUid = 'demo-citizen',
  reportId = '',
  title = '',
  message = '',
  type = 'general',
}) {
  const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const notifData = {
    id: notifId,
    recipientUid: recipientUid || 'demo-citizen',
    reportId: reportId || '',
    title: title || 'Civic Update',
    message: message || '',
    type: type || 'general',
    isRead: false,
    createdAt: new Date().toISOString(),
  };

  // Add to in-memory fallback
  memoryNotifications.unshift(notifData);

  try {
    const notifRef = doc(collection(db, 'notifications'), notifId);
    await setDoc(notifRef, notifData);
    console.log(`[Notification Service] Created notification ${notifId} for user ${recipientUid}: "${title}"`);
  } catch (err) {
    console.warn(`[Notification Service] Firestore save warning:`, err.message);
  }

  return notifData;
}

/**
 * Fetches all notifications for a specific citizen UID.
 */
async function getNotificationsForUser(recipientUid = 'demo-citizen') {
  try {
    const notifsCol = collection(db, 'notifications');
    const snapshot = await getDocs(notifsCol);
    const firestoreNotifs = [];

    snapshot.forEach((d) => {
      const data = d.data();
      if (!recipientUid || data.recipientUid === recipientUid || data.recipientUid === 'demo-citizen' || recipientUid === 'demo-citizen') {
        firestoreNotifs.push({ id: d.id, ...data });
      }
    });

    if (firestoreNotifs.length > 0) {
      // Sort newest first
      firestoreNotifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return firestoreNotifs;
    }
  } catch (err) {
    console.warn('[Notification Service] Query warning:', err.message);
  }

  // Fallback to in-memory notifications
  return memoryNotifications
    .filter((n) => !recipientUid || n.recipientUid === recipientUid || n.recipientUid === 'demo-citizen' || recipientUid === 'demo-citizen')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Marks a notification as read.
 */
async function markNotificationAsRead(notifId) {
  // Update in-memory
  const found = memoryNotifications.find((n) => n.id === notifId);
  if (found) {
    found.isRead = true;
  }

  try {
    const notifRef = doc(db, 'notifications', notifId);
    await updateDoc(notifRef, { isRead: true });
  } catch (err) {
    console.warn('[Notification Service] Mark read warning:', err.message);
  }

  return { success: true, id: notifId };
}

module.exports = {
  createNotification,
  getNotificationsForUser,
  markNotificationAsRead,
};
