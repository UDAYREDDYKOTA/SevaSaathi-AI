import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Shield, LogOut, Bell } from 'lucide-react';
import { useRole } from '../../context/useRole';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const { authUser, logout } = useRole();

  // On authentication entry portals, the page renders its own designated header
  if (path === '/' || path === '/municipal/login' || path === '/worker/login') {
    return null;
  }

  const isCitizen = path.startsWith('/citizen');
  const isMunicipal = path.startsWith('/municipal');
  const isWorker = path.startsWith('/worker') || path.startsWith('/field-worker');

  const handleSignOut = async () => {
    await logout();
    if (isMunicipal) {
      navigate('/municipal/login');
    } else if (isWorker) {
      navigate('/worker/login');
    } else {
      navigate('/');
    }
  };

  return (
    <header className="global-header">
      <div className="header-inner">
        {/* Brand Link */}
        <Link
          to={isCitizen ? '/citizen' : isMunicipal ? '/municipal' : '/worker'}
          className="brand-link"
          title="SevaSaathi AI"
        >
          <div
            className="brand-logo-icon"
            style={{
              background: isMunicipal ? '#0e7490' : isWorker ? '#d97706' : 'var(--civic-blue)',
            }}
          >
            <Shield size={22} strokeWidth={2.4} />
          </div>
          <div className="brand-title-wrap">
            <span className="brand-name">
              SevaSaathi <span>AI</span>
            </span>
            <span className="brand-subtext">
              {isCitizen && 'Citizen Portal'}
              {isMunicipal && 'Municipal Operations Console'}
              {isWorker && 'Field Response Console'}
            </span>
          </div>
        </Link>

        {/* Portal-Specific Right Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          {isCitizen && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Link
                to="/citizen/notifications"
                className="nav-icon-badge-btn"
                title="Notifications"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'var(--navy-100)',
                  color: 'var(--navy-800)',
                  textDecoration: 'none',
                }}
              >
                <Bell size={18} />
              </Link>

              <div
                style={{
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: 'var(--navy-800)',
                  background: 'var(--navy-50)',
                  padding: '0.35rem 0.85rem',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                Hello, {authUser?.name || 'Citizen'} 👋
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                className="btn btn-secondary"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', gap: '0.4rem' }}
                title="Sign out of Citizen Portal"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          )}

          {isMunicipal && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#0e7490',
                  background: '#e0f2fe',
                  padding: '0.35rem 0.85rem',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid #bae6fd',
                }}
              >
                🏛️ {authUser?.name || 'Municipal Officer'}
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                className="btn btn-secondary"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', gap: '0.4rem' }}
                title="Exit Municipal Console"
              >
                <LogOut size={14} />
                <span>Exit</span>
              </button>
            </div>
          )}

          {isWorker && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#92400e',
                  background: '#fef3c7',
                  padding: '0.35rem 0.85rem',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid #fde68a',
                }}
              >
                🔧 {authUser?.name || 'Field Operative'}
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                className="btn btn-secondary"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', gap: '0.4rem' }}
                title="Exit Field Console"
              >
                <LogOut size={14} />
                <span>Exit</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
