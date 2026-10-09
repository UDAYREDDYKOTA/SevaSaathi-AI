import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Building2,
  Lock,
  Mail,
  User,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Zap,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';
import { useRole } from '../../context/useRole';

export default function MunicipalLoginPage() {
  const navigate = useNavigate();
  const { loginOfficer, signupOfficer, requestPasswordReset, demoLogin } = useRole();

  // Mode: 'signin' | 'signup' | 'forgot'
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const resetMessages = () => {
    setError('');
    setSuccessMsg('');
  };

  const handleModeChange = (newMode) => {
    resetMessages();
    setMode(newMode);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    resetMessages();

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Please provide a valid email address.');
      return;
    }

    if (mode === 'forgot') {
      setIsLoading(true);
      try {
        const res = await requestPasswordReset(cleanEmail);
        setSuccessMsg(res?.message || `Password reset link sent to ${cleanEmail}. Please check your inbox.`);
      } catch (err) {
        setError(err.message || 'Could not send password reset email. Please try again.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    if (mode === 'signup') {
      if (!name.trim()) {
        setError('Please enter your full name for the officer registry.');
        return;
      }
      if (password.length < 6) {
        setError('Password must contain at least 6 characters.');
        return;
      }

      setIsLoading(true);
      try {
        await signupOfficer({
          email: cleanEmail,
          password,
          name: name.trim(),
        });
        navigate('/municipal');
      } catch (err) {
        setError(err.message || 'Officer registration failed. Please check your details.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Default: Sign In
    setIsLoading(true);
    try {
      await loginOfficer(cleanEmail, password);
      navigate('/municipal');
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoAccess = () => {
    demoLogin('officer');
    navigate('/municipal');
  };

  return (
    <div className="auth-portal-wrapper animate-fade-in">
      <header className="auth-top-bar">
        <Link to="/" className="auth-top-brand" title="Return to Citizen Portal">
          <div className="auth-brand-logo" style={{ background: '#0e7490' }}>
            <Building2 size={24} />
          </div>
          <div>
            <span className="auth-brand-title">SevaSaathi <span style={{ color: '#0e7490' }}>AI</span></span>
            <span className="auth-brand-badge" style={{ background: '#e0f2fe', color: '#0369a1' }}>Municipal Console</span>
          </div>
        </Link>

        <div className="auth-top-roles">
          <Link to="/" className="role-entry-btn" style={{ borderColor: 'var(--border-subtle)' }}>
            <ArrowLeft size={16} />
            <span>Citizen Portal</span>
          </Link>
          <Link to="/worker/login" className="role-entry-btn worker-entry-btn">
            <span>Field Worker</span>
          </Link>
        </div>
      </header>

      <main className="auth-card-container">
        <div className="auth-brand-hero">
          <div className="auth-logo-badge" style={{ background: 'rgba(14, 116, 144, 0.1)', color: '#0e7490' }}>
            <Building2 size={32} />
          </div>
          <h1 className="auth-portal-heading" style={{ color: '#0e7490' }}>Municipal Command Center</h1>
          <p className="auth-portal-tagline">
            Civic Administration, AI-Assisted Triage & Work Order Management
          </p>
        </div>

        <div className="auth-main-card">
          {/* Mode Switcher Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
            <button
              type="button"
              onClick={() => handleModeChange('signin')}
              style={{
                flex: 1,
                padding: '0.6rem 0.75rem',
                border: 'none',
                background: mode === 'signin' ? '#0e7490' : 'transparent',
                color: mode === 'signin' ? '#ffffff' : '#475569',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              id="tab-officer-signin"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('signup')}
              style={{
                flex: 1,
                padding: '0.6rem 0.75rem',
                border: 'none',
                background: mode === 'signup' ? '#0e7490' : 'transparent',
                color: mode === 'signup' ? '#ffffff' : '#475569',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              id="tab-officer-signup"
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="auth-alert error-alert animate-shake" style={{ marginBottom: '1rem' }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="auth-alert" style={{ background: '#f0fdf4', borderColor: '#86efac', color: '#166534', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: '8px', border: '1px solid #86efac' }}>
              <CheckCircle2 size={18} color="#16a34a" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <div className="auth-form-header">
              <h2 className="auth-title">
                {mode === 'signup'
                  ? 'Create Officer Account'
                  : mode === 'forgot'
                  ? 'Reset Officer Password'
                  : 'Officer Authentication'}
              </h2>
              <p className="auth-subtitle">
                {mode === 'signup'
                  ? 'Register as an authorized Municipal Officer with role verification'
                  : mode === 'forgot'
                  ? 'Enter your official email to receive password reset instructions'
                  : 'Authorized command center personnel & department heads'}
              </p>
            </div>

            {mode === 'signup' && (
              <div className="form-group">
                <label htmlFor="officer-name">Officer Full Name</label>
                <div className="input-with-icon">
                  <User size={18} className="input-icon" />
                  <input
                    id="officer-name"
                    type="text"
                    className="auth-input"
                    placeholder="e.g. Officer Priya Verma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="officer-email">Official Email Address</label>
              <div className="input-with-icon">
                <Mail size={18} className="input-icon" />
                <input
                  id="officer-email"
                  type="email"
                  className="auth-input"
                  placeholder="officer@sevasaathi.gov.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label htmlFor="officer-pass">Security Password</label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => handleModeChange('forgot')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#0e7490',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                        textDecoration: 'underline',
                      }}
                      id="link-officer-forgot"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="input-with-icon">
                  <Lock size={18} className="input-icon" />
                  <input
                    id="officer-pass"
                    type="password"
                    className="auth-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary auth-submit-btn"
              style={{ background: '#0e7490', borderColor: '#0891b2' }}
              disabled={isLoading}
              id="btn-officer-submit"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Processing...</span>
                </>
              ) : mode === 'signup' ? (
                <>
                  <ShieldCheck size={18} />
                  <span>Create Officer Account</span>
                </>
              ) : mode === 'forgot' ? (
                <>
                  <KeyRound size={18} />
                  <span>Send Reset Link</span>
                </>
              ) : (
                <>
                  <span>Sign In as Municipal Officer</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            {mode === 'forgot' && (
              <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => handleModeChange('signin')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  ← Back to Officer Sign In
                </button>
              </div>
            )}

            <div className="auth-demo-divider">
              <span>or</span>
            </div>

            <button
              type="button"
              className="btn btn-secondary auth-demo-btn"
              onClick={handleDemoAccess}
              title="Instant login with demo officer credentials"
              id="btn-officer-demo"
            >
              <Zap size={16} />
              <span>⚡ Instant Demo Officer Access</span>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
