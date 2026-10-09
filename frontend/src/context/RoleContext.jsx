import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ROLES, ROLE_DETAILS } from './roles';
import { RoleContext } from './RoleContextObject';
import {
  getSavedAuthUser,
  setSavedAuthUser,
  loginCitizen,
  signupCitizen,
  initiateCitizenAuth,
  saveCitizenProfile,
  loginOfficer,
  signupOfficer,
  loginWorker,
  signupWorker,
  instantDemoLogin,
  logoutUser,
  requestPasswordReset,
  subscribeToAuthState,
} from '../firebase/authService';

export function RoleProvider({ children }) {
  const [authUser, setAuthUser] = useState(() => {
    return getSavedAuthUser();
  });
  // Must start as true so ProtectedRoute waits for Firebase Auth to finish initial restoration
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Sync with Firebase onAuthStateChanged
  useEffect(() => {
    const unsubscribe = subscribeToAuthState((firebaseUser) => {
      if (firebaseUser) {
        setAuthUser((prev) => {
          const updated = {
            ...prev,
            uid: firebaseUser.uid,
            email: firebaseUser.email || prev?.email || '',
            role: prev?.role || 'citizen',
            name: prev?.name || firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'Citizen'),
            age: prev?.age || '24',
            isAuthenticated: true,
          };
          setSavedAuthUser(updated);
          return updated;
        });
      } else {
        // If no active Firebase user, check if we have a valid role session (officer, municipal_officer, worker, or demo-citizen)
        setAuthUser((prev) => {
          if (prev?.role === 'officer' || prev?.role === 'municipal_officer' || prev?.role === 'field_worker' || prev?.uid === 'demo-citizen') {
            return prev;
          }
          // User is genuinely logged out
          setSavedAuthUser(null);
          return null;
        });
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const currentRole = useMemo(() => {
    if (authUser?.role) return authUser.role;
    return ROLES.CITIZEN;
  }, [authUser]);

  const switchRole = useCallback((role) => {
    if (Object.values(ROLES).includes(role)) {
      const updated = instantDemoLogin(role);
      setAuthUser(updated);
    }
  }, []);

  const handleCitizenLogin = useCallback(async (email, password) => {
    setIsAuthLoading(true);
    try {
      const user = await loginCitizen(email, password);
      setAuthUser(user);
      return user;
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  const handleInitiateCitizenAuth = useCallback(async ({ email, password }) => {
    setIsAuthLoading(true);
    try {
      return await initiateCitizenAuth({ email, password });
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  const handleSaveCitizenProfile = useCallback(async ({ uid, email, name, age }) => {
    setIsAuthLoading(true);
    try {
      const user = await saveCitizenProfile({ uid, email, name, age });
      setAuthUser(user);
      return user;
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  const handleCitizenSignup = useCallback(async ({ email, password, name, age }) => {
    setIsAuthLoading(true);
    try {
      const user = await signupCitizen({ email, password, name, age });
      setAuthUser(user);
      return user;
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  const handleOfficerLogin = useCallback(async (email, password) => {
    setIsAuthLoading(true);
    try {
      const user = await loginOfficer(email, password);
      setAuthUser(user);
      return user;
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  const handleOfficerSignup = useCallback(async ({ email, password, name }) => {
    setIsAuthLoading(true);
    try {
      const user = await signupOfficer({ email, password, name });
      setAuthUser(user);
      return user;
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  const handleWorkerLogin = useCallback(async (workerId, password) => {
    setIsAuthLoading(true);
    try {
      const user = await loginWorker(workerId, password);
      setAuthUser(user);
      return user;
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  const handleWorkerSignup = useCallback(async ({ email, password, name }) => {
    setIsAuthLoading(true);
    try {
      const user = await signupWorker({ email, password, name });
      setAuthUser(user);
      return user;
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  const handleDemoLogin = useCallback((role = 'citizen') => {
    const user = instantDemoLogin(role);
    setAuthUser(user);
    return user;
  }, []);

  const handleLogout = useCallback(async () => {
    await logoutUser();
    setAuthUser(null);
  }, []);

  const value = useMemo(() => ({
    authUser,
    currentRole,
    isAuthLoading,
    isAuthenticated: Boolean(authUser?.isAuthenticated),
    isCitizen: currentRole === ROLES.CITIZEN || currentRole === 'citizen',
    isOfficer: currentRole === ROLES.OFFICER || currentRole === 'officer' || currentRole === 'municipal_officer',
    isFieldWorker: currentRole === ROLES.FIELD_WORKER || currentRole === 'field_worker',
    roleInfo: ROLE_DETAILS[currentRole] || ROLE_DETAILS[ROLES.OFFICER] || ROLE_DETAILS[ROLES.CITIZEN],
    switchRole,
    loginCitizen: handleCitizenLogin,
    initiateCitizenAuth: handleInitiateCitizenAuth,
    saveCitizenProfile: handleSaveCitizenProfile,
    signupCitizen: handleCitizenSignup,
    loginOfficer: handleOfficerLogin,
    signupOfficer: handleOfficerSignup,
    loginWorker: handleWorkerLogin,
    signupWorker: handleWorkerSignup,
    demoLogin: handleDemoLogin,
    logout: handleLogout,
    requestPasswordReset,
    ROLES,
    ROLE_DETAILS,
  }), [
    authUser,
    currentRole,
    isAuthLoading,
    switchRole,
    handleCitizenLogin,
    handleInitiateCitizenAuth,
    handleSaveCitizenProfile,
    handleCitizenSignup,
    handleOfficerLogin,
    handleOfficerSignup,
    handleWorkerLogin,
    handleWorkerSignup,
    handleDemoLogin,
    handleLogout,
  ]);

  return (
    <RoleContext.Provider value={value}>
      {children}
    </RoleContext.Provider>
  );
}
