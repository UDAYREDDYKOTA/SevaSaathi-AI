import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Shield,
  Building2,
  Wrench,
  Mail,
  Lock,
  User,
  Calendar,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useRole } from '../context/useRole';
import IntroAnimation from '../components/common/IntroAnimation';

export default function CitizenAuthPage() {
  const navigate = useNavigate();
  const { loginCitizen, signupCitizen, initiateCitizenAuth, saveCitizenProfile, demoLogin, requestPasswordReset } = useRole();

  // Mode: 'login' | 'signup' | 'forgot'
  const [mode, setMode] = useState('login');

  // SevaSaathi AI Intro launch animation controller
  const [showIntro, setShowIntro] = useState(() => {
    if (typeof window !== 'undefined') {
      const navEntry = window.performance?.getEntriesByType?.('navigation')?.[0];
      if (navEntry && navEntry.type === 'reload') {
        try {
          sessionStorage.removeItem('sevasaathi_intro_dismissed');
        } catch {
          // ignore
        }
        return true;
      }
      try {
        return sessionStorage.getItem('sevasaathi_intro_dismissed') !== 'true';
      } catch {
        return true;
      }
    }
    return true;
  });

  const handleIntroComplete = () => {
    try {
      sessionStorage.setItem('sevasaathi_intro_dismissed', 'true');
    } catch {
      // ignore
    }
    setShowIntro(false);
  };

  // Sign up step: 1 (credentials) | 2 (name) | 3 (age)
  const [signupStep, setSignupStep] = useState(1);
  const [pendingUid, setPendingUid] = useState('');

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Handle Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!email.trim() || !password) {
      setError('Please enter both your email address and password.');
      return;
    }

    setIsLoading(true);
    try {
      await loginCitizen(email.trim(), password);
      navigate('/citizen');
    } catch (err) {
      setError(err.message || 'Unable to sign in. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 1: Firebase Auth user creation / verification per Requirement
  const handleSignupStep1 = async (e) => {
    e.preventDefault();
    setError('');
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Please provide a valid email address (e.g. name@example.com).');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must contain at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify your password confirmation.');
      return;
    }

    setIsLoading(true);
    try {
      const authResult = await initiateCitizenAuth({ email: cleanEmail, password });
      if (authResult?.uid) {
        setPendingUid(authResult.uid);
      }
      setSignupStep(2);
    } catch (err) {
      setError(err.message || 'Account creation failed. Please check your email and password.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2 Validation (Signup)
  const handleSignupStep2 = (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    setSignupStep(3);
  };

  // Step 3 Completion: Save citizen profile to Firestore and enter Citizen Home
  const handleSignupStep3 = async (e) => {
    e.preventDefault();
    setError('');
    const parsedAge = parseInt(age, 10);
    if (!age || isNaN(parsedAge) || parsedAge < 10 || parsedAge > 120) {
      setError('Please enter a valid age (between 10 and 120).');
      return;
    }

    setIsLoading(true);
    try {
      await saveCitizenProfile({
        uid: pendingUid,
        email: email.trim(),
        name: name.trim(),
        age: String(parsedAge),
      });
      navigate('/citizen');
    } catch (err) {
      console.warn('Profile save direct attempt notice:', err.message);
      try {
        await signupCitizen({
          email: email.trim(),
          password,
          name: name.trim(),
          age: String(parsedAge),
        });
        navigate('/citizen');
      } catch (retryErr) {
        setError(retryErr.message || "Your account was created, but we couldn't save your profile. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Forgot Password
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!email.trim()) {
      setError('Please enter your registered email address.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await requestPasswordReset(email.trim());
      setSuccessMessage(res.message || 'Password reset link sent to your email.');
    } catch (err) {
      setError(err.message || 'Could not send reset link. Please check the email entered.');
    } finally {
      setIsLoading(false);
    }
  };

  // Instant Demo Login
  const handleQuickDemo = () => {
    demoLogin('citizen');
    navigate('/citizen');
  };

  return (
    <>
      {showIntro && <IntroAnimation onComplete={handleIntroComplete} />}
      <div className="auth-portal-wrapper animate-fade-in">
      {/* Top Header with Brand and Top-Right Role Access Buttons */}
      <header className="auth-top-bar">
        <div className="auth-top-brand">
          <div className="auth-brand-logo">
            <Shield size={24} strokeWidth={2.5} />
          </div>
          <div>
            <span className="auth-brand-title">SevaSaathi <span className="text-accent">AI</span></span>
            <span className="auth-brand-badge">Public Portal</span>
          </div>
        </div>

        {/* TOP-RIGHT ROLE ACCESS PER REQUIREMENT 2 */}
        <div className="auth-top-roles" aria-label="Administrative access">
          <button
            type="button"
            className="role-entry-btn"
            style={{ background: 'transparent', border: '1px solid rgba(226, 232, 240, 0.8)', color: '#475569' }}
            onClick={() => setShowIntro(true)}
            title="Watch SevaSaathi AI Intro Animation"
            id="btn-replay-intro"
          >
            <Sparkles size={15} style={{ color: '#0ea5e9' }} />
            <span>Intro</span>
          </button>
          <Link
            to="/municipal/login"
            className="role-entry-btn officer-entry-btn"
            id="btn-access-municipal"
            title="Access Municipal Officer Portal"
          >
            <Building2 size={16} />
            <span>Municipal Officer</span>
          </Link>
          <Link
            to="/worker/login"
            className="role-entry-btn worker-entry-btn"
            id="btn-access-worker"
            title="Access Field Worker Console"
          >
            <Wrench size={16} />
            <span>Field Worker</span>
          </Link>
        </div>
      </header>

      {/* Main Authentication Container */}
      <main className="auth-card-container">
        {/* Portal Branding Banner */}
        <div className="auth-brand-hero">
          <div className="auth-logo-badge">
            <Shield size={32} />
          </div>
          <h1 className="auth-portal-heading">SEVASAATHI AI</h1>
          <p className="auth-portal-tagline">
            Smarter Civic Service, Simpler for Everyone.
          </p>
        </div>

        {/* Card Body */}
        <div className="auth-main-card">
          {/* Friendly Alerts */}
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

          {/* ========================================================================= */}
          {/* MODE 1: CITIZEN LOGIN                                                     */}
          {/* ========================================================================= */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="auth-form" noValidate>
              <div className="auth-form-header">
                <h2 className="auth-title">Citizen Login</h2>
                <p className="auth-subtitle">Sign in to report civic problems and track resolution</p>
              </div>

              <div className="form-group">
                <label htmlFor="login-email">Email</label>
                <div className="input-with-icon">
                  <Mail size={18} className="input-icon" />
                  <input
                    id="login-email"
                    type="email"
                    className="auth-input"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="form-group">
                <div className="label-with-link">
                  <label htmlFor="login-password">Password</label>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => {
                      setMode('forgot');
                      setError('');
                      setSuccessMessage('');
                    }}
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="input-with-icon">
                  <Lock size={18} className="input-icon" />
                  <input
                    id="login-password"
                    type="password"
                    className="auth-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary auth-submit-btn"
                disabled={isLoading}
                id="btn-citizen-sign-in"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              {/* Instant Demo Access for Evaluators */}
              <div className="auth-demo-divider">
                <span>or</span>
              </div>

              <button
                type="button"
                className="btn btn-secondary auth-demo-btn"
                onClick={handleQuickDemo}
                title="Instant login with demo citizen profile"
              >
                <Zap size={16} />
                <span>Instant Demo Citizen Login</span>
              </button>

              <div className="auth-switch-prompt">
                <span>Don't have an account?</span>
                <button
                  type="button"
                  className="switch-mode-btn"
                  onClick={() => {
                    setMode('signup');
                    setSignupStep(1);
                    setError('');
                    setSuccessMessage('');
                  }}
                  id="btn-goto-signup"
                >
                  Create Account
                </button>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* MODE 2: CITIZEN SIGN-UP FLOW (Steps 1, 2, 3)                              */}
          {/* ========================================================================= */}
          {mode === 'signup' && (
            <div className="auth-signup-flow">
              <div className="auth-form-header">
                <h2 className="auth-title">Create Citizen Account</h2>
                <div className="signup-step-indicator">
                  <span className={`step-dot ${signupStep >= 1 ? 'active' : ''}`}>1</span>
                  <span className="step-line"></span>
                  <span className={`step-dot ${signupStep >= 2 ? 'active' : ''}`}>2</span>
                  <span className="step-line"></span>
                  <span className={`step-dot ${signupStep >= 3 ? 'active' : ''}`}>3</span>
                </div>
                <p className="auth-subtitle">
                  {signupStep === 1 && 'Step 1: Account credentials'}
                  {signupStep === 2 && 'Step 2: Tell us your name'}
                  {signupStep === 3 && 'Step 3: Tell us your age'}
                </p>
              </div>

              {/* STEP 1: Credentials */}
              {signupStep === 1 && (
                <form onSubmit={handleSignupStep1} className="auth-form" noValidate>
                  <div className="form-group">
                    <label htmlFor="signup-email">Email</label>
                    <div className="input-with-icon">
                      <Mail size={18} className="input-icon" />
                      <input
                        id="signup-email"
                        type="email"
                        className="auth-input"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="signup-password">Password</label>
                    <div className="input-with-icon">
                      <Lock size={18} className="input-icon" />
                      <input
                        id="signup-password"
                        type="password"
                        className="auth-input"
                        placeholder="At least 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="signup-confirm-password">Confirm Password</label>
                    <div className="input-with-icon">
                      <Lock size={18} className="input-icon" />
                      <input
                        id="signup-confirm-password"
                        type="password"
                        className="auth-input"
                        placeholder="Repeat your password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary auth-submit-btn"
                    id="btn-signup-step1"
                  >
                    <span>Continue to Step 2</span>
                    <ArrowRight size={18} />
                  </button>

                  <div className="auth-switch-prompt">
                    <span>Already have an account?</span>
                    <button
                      type="button"
                      className="switch-mode-btn"
                      onClick={() => {
                        setMode('login');
                        setError('');
                      }}
                    >
                      Sign In
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 2: Name */}
              {signupStep === 2 && (
                <form onSubmit={handleSignupStep2} className="auth-form" noValidate>
                  <div className="onboarding-question-box">
                    <User size={36} className="onboarding-icon" />
                    <h3 className="onboarding-prompt">What is your name?</h3>
                    <p className="onboarding-hint">We will use this to address you on reports and notifications.</p>
                  </div>

                  <div className="form-group">
                    <label htmlFor="signup-name">Full Name</label>
                    <input
                      id="signup-name"
                      type="text"
                      className="auth-input large-input"
                      placeholder="e.g. Varshith"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="stepper-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setSignupStep(1)}
                    >
                      <ArrowLeft size={16} />
                      <span>Back</span>
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      id="btn-signup-step2"
                    >
                      <span>Continue to Step 3</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 3: Age */}
              {signupStep === 3 && (
                <form onSubmit={handleSignupStep3} className="auth-form" noValidate>
                  <div className="onboarding-question-box">
                    <Calendar size={36} className="onboarding-icon" />
                    <h3 className="onboarding-prompt">How old are you?</h3>
                    <p className="onboarding-hint">To personalize accessibility and community communications.</p>
                  </div>

                  <div className="form-group">
                    <label htmlFor="signup-age">Age (Years)</label>
                    <input
                      id="signup-age"
                      type="number"
                      min="10"
                      max="120"
                      className="auth-input large-input"
                      placeholder="e.g. 24"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="stepper-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setSignupStep(2)}
                      disabled={isLoading}
                    >
                      <ArrowLeft size={16} />
                      <span>Back</span>
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isLoading}
                      id="btn-signup-step3"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Creating Account...</span>
                        </>
                      ) : (
                        <>
                          <span>Enter Citizen Home</span>
                          <Sparkles size={16} />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODE 3: FORGOT PASSWORD                                                   */}
          {/* ========================================================================= */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotSubmit} className="auth-form" noValidate>
              <div className="auth-form-header">
                <h2 className="auth-title">Reset Password</h2>
                <p className="auth-subtitle">
                  Enter your email address and we will send you a password reset link
                </p>
              </div>

              <div className="form-group">
                <label htmlFor="forgot-email">Registered Email</label>
                <div className="input-with-icon">
                  <Mail size={18} className="input-icon" />
                  <input
                    id="forgot-email"
                    type="email"
                    className="auth-input"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary auth-submit-btn"
                disabled={isLoading}
                id="btn-reset-password"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Sending Reset Link...</span>
                  </>
                ) : (
                  <span>Send Password Reset Link</span>
                )}
              </button>

              <div className="auth-switch-prompt">
                <button
                  type="button"
                  className="switch-mode-btn"
                  onClick={() => {
                    setMode('login');
                    setError('');
                    setSuccessMessage('');
                  }}
                >
                  ← Back to Citizen Login
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
    </>
  );
}
