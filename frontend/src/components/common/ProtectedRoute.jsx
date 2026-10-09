import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useRole } from '../../context/useRole';

export default function ProtectedRoute({ children, allowedRole }) {
  const { currentRole, isAuthenticated, isAuthLoading } = useRole();
  const location = useLocation();

  // If auth is actively resolving, show non-blocking loading state
  if (isAuthLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', color: '#64748b' }}>
        <div className="animate-spin" style={{ width: '28px', height: '28px', border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%' }} />
        <p style={{ fontSize: '0.95rem', fontWeight: 500 }}>Preparing your account...</p>
      </div>
    );
  }

  // If no allowedRole specified, require any authenticated user
  if (!allowedRole) {
    if (!isAuthenticated) {
      return <Navigate to="/" state={{ from: location }} replace />;
    }
    return children;
  }

  // Role: citizen
  if (allowedRole === 'citizen') {
    if (!isAuthenticated || currentRole !== 'citizen') {
      return <Navigate to="/" state={{ from: location }} replace />;
    }
    return children;
  }

  // Role: officer / municipal_officer
  if (allowedRole === 'officer' || allowedRole === 'municipal_officer') {
    if (!isAuthenticated || (currentRole !== 'officer' && currentRole !== 'municipal_officer' && currentRole !== 'admin')) {
      return <Navigate to="/municipal/login" state={{ from: location }} replace />;
    }
    return children;
  }

  // Role: field_worker
  if (allowedRole === 'field_worker') {
    if (!isAuthenticated || (currentRole !== 'field_worker' && currentRole !== 'admin')) {
      return <Navigate to="/worker/login" state={{ from: location }} replace />;
    }
    return children;
  }

  return children;
}
