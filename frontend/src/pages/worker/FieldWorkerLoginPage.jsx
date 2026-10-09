import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Wrench,
  Lock,
  Mail,
  User,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Zap,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useRole } from '../../context/useRole';

export default function FieldWorkerLoginPage() {
  const navigate = useNavigate();
  const { loginWorker, signupWorker, demoLogin, requestPasswordReset } = useRole();

  // Mode: 'login' | 'signup' | 'forgot'
  const [mode, setMode] = useState('login');

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // 1. Handle Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    try {
      await loginWorker(email.trim(), password);
      navigate('/worker');
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify worker credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Handle Signup
  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      setError('Please enter your full name.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify your password confirmation.');
      return;
    }

    setIsLoading(true);
    try {
      await signupWorker({
        email: cleanEmail,
        password,
        name: cleanName,
      });
      navigate('/worker');
    } catch (err) {
      setError(err.message || 'Worker registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Handle Forgot Password
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address to receive password reset instructions.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await requestPasswordReset(email.trim());
      setSuccessMessage(res?.message || 'Password reset link sent to your email.');
    } catch (err) {
      setError(err.message || 'Could not send reset link. Please check the email entered.');
    } finally {
      setIsLoading(false);
    }
  };

  // Demo Login
  const handleDemoAccess = () => {
    demoLogin('field_worker');
    navigate('/worker');
  };

  return (
    <div className="auth-portal-wrapper animate-fade-in">
      {/* Top Header */}
      <header className="auth-top-bar">
        <Link to="/" className="auth-top-brand" title="Return to Citizen Portal">
          <div className="auth-brand-logo" style={{ background: '#d97706' }}>
            <Wrench size={24} />
          </div>
          <div>
            <span className="auth-brand-title">
              SevaSaathi <span style={{ color: '#d97706' }}>AI</span>
            </span>
            <span className="auth-brand-badge" style={{ background: '#fef3c7', color: '#92400e' }}>
              Field Response
            </span>
          </div>
        </Link>

        <div className="auth-top-roles">
          <Link to="/" className="role-entry-btn" style={{ borderColor: 'var(--border-subtle)' }}>
            <ArrowLeft size={16} />
            <span>Citizen Portal</span>
          </Link>
          <Link to="/municipal/login" className="role-entry-btn officer-entry-btn">
            <span>Municipal Officer</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="auth-card-container">
        <div className="auth-brand-hero">
          <div className="auth-logo-badge" style={{ background: 'rgba(217, 119, 6, 0.1)', color: '#d97706' }}>
            <Wrench size={32} />
          </div>
          <h1 className="auth-portal-heading" style={{ color: '#d97706' }}>Field Worker Operations</h1>
          <p className="auth-portal-tagline">
            Ground Response, Site Verification & Evidence Submission
          </p>
        </div>

        <div className="auth-main-card">
          {error && (
            <div className="auth-alert error-alert animate-shake">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="auth-alert success-alert animate-fade-in">
              <CheckCircle2 size={18} />
              <span>{successMessage}</span>
            </div>
          )}

          {/* MODE: LOGIN */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="auth-form" noValidate>
              <div className="auth-form-header">
                <h2 className="auth-title">Operative Sign In</h2>
                <p className="auth-subtitle">Field crews, maintenance teams, and repair operatives</p>
              </div>

              <div className="form-group">
                <label htmlFor="worker-email">Email Address</label>
                <div className="input-with-icon">
                  <Mail size={18} className="input-icon" />
                  <input
                    id="worker-email"
                    type="email"
                    className="auth-input"
                    placeholder="worker@sevasaathi.gov.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label htmlFor="worker-pass">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError('');
                      setSuccessMessage('');
                    }}
                    className="auth-link-btn"
                    style={{ fontSize: '0.8rem', color: '#d97706' }}
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="input-with-icon">
                  <Lock size={18} className="input-icon" />
                  <input
                    id="worker-pass"
                    type="password"
                    className="auth-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary auth-submit-btn"
                style={{ background: '#d97706', borderColor: '#b45309' }}
                disabled={isLoading}
                id="btn-worker-login"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In as Field Worker</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--navy-600)' }}>New field operative? </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError('');
                    setSuccessMessage('');
                  }}
                  className="auth-link-btn"
                  style={{ fontWeight: 700, color: '#d97706' }}
                >
                  Create Field Worker Account
                </button>
              </div>

              <div className="auth-demo-divider">
                <span>or</span>
              </div>

              <button
                type="button"
                className="btn btn-secondary auth-demo-btn"
                onClick={handleDemoAccess}
                title="Instant login with demo field worker profile"
              >
                <Zap size={16} />
                <span>⚡ Instant Demo Field Worker Access</span>
              </button>
            </form>
          )}

          {/* MODE: SIGNUP */}
          {mode === 'signup' && (
            <form onSubmit={handleSignupSubmit} className="auth-form" noValidate>
              <div className="auth-form-header">
                <h2 className="auth-title">Field Worker Registration</h2>
                <p className="auth-subtitle">Create your operative account to receive work orders</p>
              </div>

              <div className="form-group">
                <label htmlFor="worker-signup-name">Full Name</label>
                <div className="input-with-icon">
                  <User size={18} className="input-icon" />
                  <input
                    id="worker-signup-name"
                    type="text"
                    className="auth-input"
                    placeholder="e.g. Ramesh Kumar"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="worker-signup-email">Email Address</label>
                <div className="input-with-icon">
                  <Mail size={18} className="input-icon" />
                  <input
                    id="worker-signup-email"
                    type="email"
                    className="auth-input"
                    placeholder="ramesh@sevasaathi.gov.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="worker-signup-pass">Password</label>
                <div className="input-with-icon">
                  <Lock size={18} className="input-icon" />
                  <input
                    id="worker-signup-pass"
                    type="password"
                    className="auth-input"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="worker-signup-confirm-pass">Confirm Password</label>
                <div className="input-with-icon">
                  <Lock size={18} className="input-icon" />
                  <input
                    id="worker-signup-confirm-pass"
                    type="password"
                    className="auth-input"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary auth-submit-btn"
                style={{ background: '#d97706', borderColor: '#b45309' }}
                disabled={isLoading}
                id="btn-worker-signup"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <span>Register Field Worker</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--navy-600)' }}>Already registered? </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                    setSuccessMessage('');
                  }}
                  className="auth-link-btn"
                  style={{ fontWeight: 700, color: '#d97706' }}
                >
                  Sign In
                </button>
              </div>
            </form>
          )}

          {/* MODE: FORGOT PASSWORD */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotSubmit} className="auth-form" noValidate>
              <div className="auth-form-header">
                <h2 className="auth-title">Password Recovery</h2>
                <p className="auth-subtitle">Enter your registered field operative email</p>
              </div>

              <div className="form-group">
                <label htmlFor="worker-forgot-email">Email Address</label>
                <div className="input-with-icon">
                  <Mail size={18} className="input-icon" />
                  <input
                    id="worker-forgot-email"
                    type="email"
                    className="auth-input"
                    placeholder="worker@sevasaathi.gov.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary auth-submit-btn"
                style={{ background: '#d97706', borderColor: '#b45309' }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Sending reset link...</span>
                  </>
                ) : (
                  <>
                    <span>Send Password Reset Link</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.9rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                    setSuccessMessage('');
                  }}
                  className="auth-link-btn"
                  style={{ fontWeight: 700, color: '#d97706' }}
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
