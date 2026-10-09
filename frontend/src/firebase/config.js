import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Read configuration from environment variables (Vite requires VITE_ prefix)
const cleanEnv = (val) => (val ? String(val).trim().replace(/^["']|["']$/g, '') : '');

const firebaseConfig = {
  apiKey: cleanEnv(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: cleanEnv(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: cleanEnv(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: cleanEnv(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: cleanEnv(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: cleanEnv(import.meta.env.VITE_FIREBASE_APP_ID),
};

// Check if actual configuration has been provided
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  !firebaseConfig.apiKey.includes('your_api_key_here')
);

// Safe config for initialization so the frontend bundle initializes cleanly
const activeConfig = isFirebaseConfigured
  ? firebaseConfig
  : {
      apiKey: firebaseConfig.apiKey || 'AIzaSyDemoPlaceholderKey123456789',
      authDomain: firebaseConfig.authDomain || 'sevasaathi-ai-demo.firebaseapp.com',
      projectId: firebaseConfig.projectId || 'sevasaathi-ai-demo',
      storageBucket: firebaseConfig.storageBucket || 'sevasaathi-ai-demo.appspot.com',
      messagingSenderId: firebaseConfig.messagingSenderId || '102938475612',
      appId: firebaseConfig.appId || '1:102938475612:web:demo123456789abcdef',
    };

const app = getApps().length > 0 ? getApp() : initializeApp(activeConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

/**
 * Returns currently signed-in user's UID or 'demo-citizen' fallback.
 */
export function getCurrentUserUid() {
  try {
    const auth = getAuth(app);
    if (auth?.currentUser?.uid) {
      return auth.currentUser.uid;
    }
  } catch {
    // Auth is optional in Stage 3
  }
  return 'demo-citizen';
}

export default app;
