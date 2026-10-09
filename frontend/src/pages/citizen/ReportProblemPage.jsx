import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  Upload,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Loader2,
  Sparkles,
  ShieldCheck,
  Zap,
  ArrowRight,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react';
import { submitReportToFirestore } from '../../firebase/reports';
import { requestReportAiAnalysis, validateComplaintInputs } from '../../services/aiService';
import { auth } from '../../firebase/config';
import { useRole } from '../../context/useRole';
import HyderabadMap from '../../components/common/HyderabadMap';

// Sample images for testing & desktop users
const DEMO_PHOTOS = [
  {
    label: 'Flooded Road & Blocked Drain',
    url: 'https://images.unsplash.com/photo-1541888946425-d0fbb1861593?w=600&auto=format&fit=crop&q=80',
  },
  {
    label: 'Deep Road Pothole',
    url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=80',
  },
  {
    label: 'Garbage Dump Overflow',
    url: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=600&auto=format&fit=crop&q=80',
  },
];

export default function ReportProblemPage() {
  const navigate = useNavigate();
  const { authUser, isAuthLoading } = useRole();

  // Form Fields (No mandatory manual category selector per requirement)
  const [description, setDescription] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [detectedCategory, setDetectedCategory] = useState('');
  const [detectedProblem, setDetectedProblem] = useState('');
  const [detectedDepartment, setDetectedDepartment] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [locationStatus, setLocationStatus] = useState('');

  // Submission & Pipeline States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidatingAi, setIsValidatingAi] = useState(false);
  const [validationMismatch, setValidationMismatch] = useState(null);
  const [reportValidationResult, setReportValidationResult] = useState(null);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [aiNotice, setAiNotice] = useState('');

  // Results State
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [savedReportId, setSavedReportId] = useState('');
  const [aiResult, setAiResult] = useState(null);
  const [similarComplaintsResult, setSimilarComplaintsResult] = useState(null);
  const [priorityResult, setPriorityResult] = useState(null);

  // Hidden file inputs
  const cameraInputRef = useRef(null);
  const uploadInputRef = useRef(null);

  // Image selection handler with canvas compression
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const MAX = 800;
            let w = img.width;
            let h = img.height;
            if (w > h) {
              if (w > MAX) {
                h = Math.round((h * MAX) / w);
                w = MAX;
              }
            } else {
              if (h > MAX) {
                w = Math.round((h * MAX) / h);
                h = MAX;
              }
            }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            const compressed = canvas.toDataURL('image/jpeg', 0.6);
            setPhotoPreview(compressed);
          } catch {
            setPhotoPreview(reader.result);
          }
        };
        img.onerror = () => {
          setPhotoPreview(reader.result);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
      setSubmitError('');
    }
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (uploadInputRef.current) uploadInputRef.current.value = '';
  };

  // Pre-fill School Road Demo Scenario in Hyderabad
  const handleFillDemoScenario = () => {
    setDescription('There is severe waterlogging on the road near a school because the drain is blocked.');
    setAddress('School Road, Abids, Hyderabad');
    setPhotoPreview(DEMO_PHOTOS[0].url);
    setLatitude(17.3910);
    setLongitude(78.4770);
    setLocationStatus('School Road, Abids, Hyderabad (GPS: 17.3910, 78.4770)');
    setSubmitError('');
    setValidationMismatch(null);
  };

  // Helper to commit report to Firestore and trigger backend Gemini analysis
  const executeFirestoreSubmission = async (valOutcome) => {
    const authenticatedUid = auth?.currentUser?.uid;
    const submittedBy = authenticatedUid || (authUser?.isAuthenticated ? (authUser.uid.startsWith('citizen_') ? (authenticatedUid || 'demo-citizen') : authUser.uid) : null);

    if (!submittedBy) {
      setSubmitError('Authentication required. Please sign in to submit a report.');
      setIsSubmitting(false);
      return;
    }

    let createdDocId = null;
    let createdReportId = null;

    const resolvedCategory = valOutcome?.category || detectedCategory || 'Roads';
    const resolvedProblem = valOutcome?.detectedProblem || detectedProblem || `${resolvedCategory} Grievance`;
    const resolvedDepartment = valOutcome?.department || detectedDepartment || 'Roads & Infrastructure';

    // STEP 1: Save Report to Firestore FIRST
    try {
      console.log('[Report Submit] Submitting to Firestore with UID:', submittedBy);
      const saveResult = await submitReportToFirestore({
        description: description.trim(),
        category: resolvedCategory,
        detectedCategory: resolvedCategory,
        detectedProblem: resolvedProblem,
        department: resolvedDepartment,
        priority: valOutcome?.priority || 'Medium',
        severity: valOutcome?.severity || 'Medium',
        safetyRisk: valOutcome?.safetyRisk || 'Medium',
        address: address.trim(),
        imageUrl: photoPreview,
        photoDataUrl: photoPreview,
        latitude,
        longitude,
        locationStatus: address.trim() || locationStatus || 'Hyderabad, Telangana',
        submittedBy,
        validationStatus: valOutcome?.status || 'MATCH',
        aiValidation: valOutcome || null,
      });

      createdDocId = saveResult.docId;
      createdReportId = saveResult.reportId;
      setSavedReportId(createdReportId);
      setSubmissionSuccess(true);
      console.log(`[Report Submit] Saved to Firestore successfully: ${createdReportId} (${createdDocId})`);
    } catch (saveError) {
      console.error('[Report Submit] Firestore save failure details:', saveError);
      const userMessage = saveError?.code === 'permission-denied'
        ? 'Submission failed: Permission denied. Please ensure you are signed in with an authorized account.'
        : (saveError?.message || 'Your report could not be saved. Please check your connection and try again.');
      setSubmitError(userMessage);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);

    // STEP 2: Start backend Gemini AI analysis ONLY AFTER report is safely saved
    setIsAiAnalyzing(true);
    try {
      const aiResponse = await requestReportAiAnalysis({
        docId: createdDocId,
        reportId: createdReportId,
        description: description.trim(),
        category: resolvedCategory,
        address: address.trim(),
        latitude,
        longitude,
        locationStatus: address.trim() || locationStatus,
        submittedBy,
      });

      if (aiResponse?.aiAnalysis) {
        setAiResult(aiResponse.aiAnalysis);
      }
      if (aiResponse?.similarComplaints) {
        setSimilarComplaintsResult(aiResponse.similarComplaints);
      }
      if (aiResponse?.priorityAssessment) {
        setPriorityResult(aiResponse.priorityAssessment);
      }
    } catch (aiError) {
      console.warn('[Report Submit] Backend AI analysis warning:', aiError.message);
      setAiNotice(
        'Your report was submitted successfully. AI analysis is temporarily unavailable.'
      );
    } finally {
      setIsAiAnalyzing(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // FORM SUBMISSION PIPELINE (No manual category required)
  const handleSubmitReport = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setAiNotice('');

    if (!description.trim()) {
      setSubmitError('Please describe the problem you are experiencing.');
      return;
    }
    if (!address.trim()) {
      setSubmitError('Please enter an address or street name where this issue is located.');
      return;
    }

    setIsSubmitting(true);
    setValidationMismatch(null);

    // Automated Multi-Layer Civic AI Complaint Validation Pipeline
    let valOutcome = null;
    try {
      setIsValidatingAi(true);
      valOutcome = await validateComplaintInputs({
        description: description.trim(),
        address: address.trim(),
        locationStatus: address.trim() || locationStatus || 'Hyderabad, Telangana',
        latitude,
        longitude,
        photoDataUrl: photoPreview,
      });
      setReportValidationResult(valOutcome);
      if (valOutcome?.category) setDetectedCategory(valOutcome.category);
      if (valOutcome?.detectedProblem) setDetectedProblem(valOutcome.detectedProblem);
      if (valOutcome?.department) setDetectedDepartment(valOutcome.department);
    } catch (valErr) {
      console.warn('AI validation warning, falling back to FLAGGED_FOR_REVIEW:', valErr.message);
      valOutcome = {
        decision: 'FLAGGED_FOR_REVIEW',
        status: 'UNCERTAIN',
        confidence: 60,
        detectedProblem: description.trim().slice(0, 80) || 'Civic Grievance',
        category: 'Other',
        department: 'Municipal Administration',
        severity: 'Medium',
        safetyRisk: 'Medium',
        priority: 'Medium',
        layers: {
          description: { status: 'PASSED', clarity: 'Medium', civicRelevance: true, missingDetails: [], explanation: 'Text received.' },
          image: { status: photoPreview ? 'UNCLEAR' : 'OPTIONAL_OMITTED', isProvided: Boolean(photoPreview), explanation: 'Offline.' },
          location: { status: 'UNVERIFIED', hasCoordinates: Boolean(latitude && longitude), isPlausible: true, explanation: 'Offline.' },
          crossValidation: { status: 'UNCERTAIN', contradictionFlags: [], explanation: 'Offline.' },
          classification: { detectedProblem: 'Civic Grievance', category: 'Other', department: 'Municipal Administration', severity: 'Medium', safetyRisk: 'Medium', suggestedPriority: 'Medium' },
          duplicatesAndAbuse: { status: 'CLEAN', isDuplicate: false, isSpam: false, explanation: 'Offline.' },
        },
        missingInfo: [],
        issues: ['Automated check offline; queued for municipal officer review.'],
        contradictionFlags: [],
        recommendedNextAction: 'Your report will be reviewed directly by the Municipal Officer.',
        canSubmit: true,
        requiresOfficerReview: true,
        summary: 'Automated AI check offline. Report flagged for Municipal Officer manual review.',
      };
      setReportValidationResult(valOutcome);
      setDetectedCategory('Other');
    } finally {
      setIsValidatingAi(false);
    }

    const currentDecision = valOutcome?.decision || (valOutcome?.status === 'MISMATCH' ? 'VALIDATION_FAILED' : valOutcome?.status === 'UNCERTAIN' ? 'FLAGGED_FOR_REVIEW' : 'VALIDATION_PASSED');

    // BLOCK AUTOMATIC SUBMISSION ON VALIDATION FAILED OR NEEDS MORE INFO
    if (currentDecision === 'VALIDATION_FAILED' || currentDecision === 'NEEDS_MORE_INFORMATION') {
      setIsSubmitting(false);
      setValidationMismatch(valOutcome);
      return;
    }

    // IF FLAGGED FOR REVIEW: Inform citizen that officer will manually verify
    if (currentDecision === 'FLAGGED_FOR_REVIEW') {
      setAiNotice('Your complaint was received! It has been routed to the Municipal Officer for manual verification.');
    }

    await executeFirestoreSubmission(valOutcome);
  };

  // Citizen chooses to request manual officer review when flag or contradiction occurs
  const handleRequestHumanReview = async () => {
    setIsSubmitting(true);
    setValidationMismatch(null);
    const forcedOutcome = {
      ...(reportValidationResult || {}),
      decision: 'FLAGGED_FOR_REVIEW',
      status: 'FLAGGED_FOR_REVIEW',
      reason: `Submitted for Municipal Officer manual review at citizen request: ${reportValidationResult?.issues?.join('; ') || reportValidationResult?.summary || 'Citizen requested human verification.'}`,
      requestedHumanReview: true,
    };
    setReportValidationResult(forcedOutcome);
    setAiNotice('Your complaint has been submitted for direct Municipal Officer review as requested.');
    await executeFirestoreSubmission(forcedOutcome);
  };

  // Reset Form
  const handleReset = () => {
    setDescription('');
    setPhotoPreview(null);
    setDetectedCategory('');
    setDetectedProblem('');
    setDetectedDepartment('');
    setAddress('');
    setLatitude(null);
    setLongitude(null);
    setLocationStatus('');
    setSubmissionSuccess(false);
    setSavedReportId('');
    setAiResult(null);
    setSimilarComplaintsResult(null);
    setPriorityResult(null);
    setReportValidationResult(null);
    setValidationMismatch(null);
    setSubmitError('');
    setAiNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isAuthLoading) {
    return (
      <div className="citizen-page animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', color: '#64748b' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: '#2563eb' }} />
        <p style={{ fontSize: '0.95rem', fontWeight: 500 }}>Preparing your account...</p>
      </div>
    );
  }

  // =========================================================================
  // VIEW: SUCCESS & AI ASSESSMENT DISPLAY
  // =========================================================================
  if (submissionSuccess) {
    return (
      <div className="citizen-page animate-fade-in">
        {/* Top Header */}
        <div className="module-header">
          <div className="module-title-wrap">
            <h1 className="module-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <CheckCircle2 size={32} color="var(--success-emerald)" />
              <span>Report Submitted Successfully</span>
            </h1>
            <p className="module-description">
              Your civic grievance has been safely saved and registered into the municipal ledger.
            </p>
          </div>
        </div>

        {/* Report Identification Card */}
        <div className="report-id-card">
          <div className="report-id-header">
            <div>
              <span className="report-id-label">Official Grievance Ticket ID</span>
              <div className="report-id-value" id="submitted-report-id">{savedReportId}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
              <span className="badge badge-success">Saved to Ledger</span>
              {reportValidationResult && (
                <span
                  className="badge"
                  style={{
                    background: reportValidationResult.status === 'MATCH' ? '#ecfdf5' : '#fffbeb',
                    color: reportValidationResult.status === 'MATCH' ? '#047857' : '#b45309',
                    border: reportValidationResult.status === 'MATCH' ? '1px solid #a7f3d0' : '1px solid #fde68a',
                    fontSize: '0.78rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  {reportValidationResult.status === 'MATCH' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                  <span>{reportValidationResult.status === 'MATCH' ? 'AI Validated: Match' : 'Flagged for Officer Review'}</span>
                </span>
              )}
            </div>
          </div>

          <div className="report-id-details">
            <div className="report-detail-item">
              <span className="detail-label">Reported Address</span>
              <span className="detail-val">{address || 'Hyderabad, Telangana'}</span>
            </div>
            <div className="report-detail-item">
              <span className="detail-label">AI-Detected Problem</span>
              <span className="detail-val font-semibold" style={{ color: '#0f172a' }}>
                {reportValidationResult?.detectedProblem || aiResult?.issueType || detectedProblem || 'Civic Infrastructure Grievance'}
              </span>
            </div>
            <div className="report-detail-item">
              <span className="detail-label">AI-Classified Category</span>
              <span className="detail-val font-semibold" style={{ color: '#0284c7' }}>
                {reportValidationResult?.category || aiResult?.category || detectedCategory || 'Roads'}
              </span>
            </div>
            <div className="report-detail-item">
              <span className="detail-label">Responsible Department</span>
              <span className="detail-val">
                {reportValidationResult?.department || aiResult?.department || detectedDepartment || 'Roads & Infrastructure'}
              </span>
            </div>
          </div>
        </div>

        {/* AI Processing Loading State */}
        {isAiAnalyzing && (
          <div className="ai-processing-box animate-pulse">
            <div className="ai-processing-icon">
              <Loader2 size={28} className="animate-spin" />
            </div>
            <div>
              <h3 className="ai-processing-title">SevaSaathi AI is Analyzing Your Report...</h3>
              <p className="ai-processing-desc">
                Identifying civic problem type, evaluating safety risk, verifying authenticity, and detecting similar complaints in your neighborhood.
              </p>
            </div>
          </div>
        )}

        {/* AI Failure Notice (Requirement 6) */}
        {aiNotice && !isAiAnalyzing && (
          <div className="auth-alert success-alert" style={{ margin: '1.5rem 0', padding: '1.25rem' }}>
            <AlertCircle size={22} style={{ color: '#0284c7', flexShrink: 0 }} />
            <div>
              <strong style={{ display: 'block', fontSize: '1rem', marginBottom: '0.2rem' }}>Report Safely Stored</strong>
              <span>{aiNotice}</span>
            </div>
          </div>
        )}

        {/* AI Assessment Card (Requirement 7 & 8 & 9) */}
        {aiResult && !isAiAnalyzing && (
          <div className="ai-assessment-card animate-fade-in">
            <div className="ai-assessment-header">
              <div className="ai-header-left">
                <Sparkles size={22} className="ai-sparkle-icon" />
                <div>
                  <h2 className="ai-card-title">SevaSaathi AI Assessment</h2>
                  <span className="ai-card-subtitle">Real-Time Grievance Understanding & Triage</span>
                </div>
              </div>
              <span className="ai-model-tag">Model: {aiResult.model || 'Gemini 3.5'}</span>
            </div>

            <div className="ai-assessment-body">
              {/* Problem Identification & Department */}
              <div className="ai-metrics-grid">
                <div className="ai-metric-item">
                  <span className="ai-metric-label">Identified Problem</span>
                  <div className="ai-metric-value" id="ai-issue-type">
                    {aiResult.issueType}
                  </div>
                </div>

                <div className="ai-metric-item">
                  <span className="ai-metric-label">Responsible Department</span>
                  <div className="ai-metric-value" id="ai-department">
                    {aiResult.department}
                  </div>
                </div>

                <div className="ai-metric-item">
                  <span className="ai-metric-label">Severity</span>
                  <div>
                    <span className={`badge badge-severity-${aiResult.severity.toLowerCase()}`}>
                      {aiResult.severity}
                    </span>
                  </div>
                </div>

                <div className="ai-metric-item">
                  <span className="ai-metric-label">Safety Risk</span>
                  <div>
                    <span className={`badge badge-risk-${aiResult.safetyRisk.toLowerCase()}`}>
                      {aiResult.safetyRisk} Risk
                    </span>
                  </div>
                </div>
              </div>

              {/* Requirement 7E: Report Authenticity Assessment */}
              <div className="authenticity-section">
                <div className="authenticity-header">
                  <span className="section-label">Report Authenticity Assessment</span>
                  <span className="badge badge-authenticity">
                    {aiResult.authenticityAssessment || 'Likely Genuine'}
                    {aiResult.authenticityConfidence ? ` — ${Math.round(aiResult.authenticityConfidence * 100)}% Confidence` : ''}
                  </span>
                </div>
                <p className="authenticity-evidence">
                  "{aiResult.authenticityEvidence || 'Uploaded description and civic context are consistent with reported conditions.'}"
                </p>
              </div>

              {/* Requirement 7F & 7G: Short AI Summary & Evidence */}
              <div className="ai-summary-section">
                <span className="section-label">Short AI Summary</span>
                <p className="ai-summary-text">
                  {aiResult.shortSummary}
                </p>

                <span className="section-label" style={{ marginTop: '0.85rem' }}>Supporting Evidence</span>
                <p className="ai-evidence-text">
                  {aiResult.evidence}
                </p>
              </div>

              {/* Requirement 8: Explainable Priority */}
              {priorityResult && (
                <div className="priority-summary-section">
                  <div className="priority-header-row">
                    <span className="section-label">Operational Priority (System Calculated)</span>
                    <span className={`badge badge-priority-${priorityResult.level.toLowerCase()}`}>
                      {priorityResult.level.toUpperCase()} PRIORITY
                    </span>
                  </div>
                  {priorityResult.evidence && priorityResult.evidence.length > 0 && (
                    <ul className="priority-reasons-list">
                      {priorityResult.evidence.slice(0, 4).map((factor, idx) => (
                        <li key={idx}>✓ {factor}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Requirement 9: Similar Complaints */}
              {similarComplaintsResult && (
                <div className="similar-complaints-section">
                  <div className="similar-header-row">
                    <span className="section-label">Similar Complaints Nearby</span>
                    <span className="badge badge-similar">
                      {similarComplaintsResult.count} Similar Complaints Found Nearby
                    </span>
                  </div>
                  <p className="similar-summary-text">
                    {similarComplaintsResult.summary}
                  </p>
                </div>
              )}

              {/* Requirement 7H: AI Disclaimer */}
              <div className="ai-disclaimer-box">
                <ShieldCheck size={16} />
                <span>
                  {aiResult.disclaimer || 'AI-generated assessment for municipal decision support. It is not an official municipal determination.'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="report-success-actions">
          <Link to="/citizen/my-reports" className="btn btn-primary" id="btn-view-my-reports">
            <span>View in My Reports</span>
            <ArrowRight size={18} />
          </Link>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleReset}
            id="btn-report-another"
          >
            <span>Report Another Problem</span>
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: NEW SIMPLE REPORT FORM (Requirement 5)
  // =========================================================================
  return (
    <div className="citizen-page animate-fade-in">
      {/* Top Header */}
      <div className="report-form-header">
        <button
          type="button"
          onClick={() => navigate('/citizen')}
          className="back-link-btn"
          title="Back to Citizen Home"
        >
          <ArrowLeft size={18} />
          <span>Home</span>
        </button>

        <h1 className="report-title">Report a Problem</h1>
        <p className="report-subtitle">
          Submit civic grievances in 5 simple steps.
        </p>

        {/* Demo Scenario Shortcut */}
        <div className="demo-helper-bar">
          <button
            type="button"
            className="demo-scenario-btn"
            onClick={handleFillDemoScenario}
            title="Auto-fill with School Road waterlogging demonstration"
          >
            <Zap size={15} />
            <span>⚡ Demo: School Road Waterlogging (Stage 22 Scenario)</span>
          </button>
        </div>
      </div>

      {/* Friendly Form Error Banner */}
      {submitError && (
        <div className="auth-alert error-alert animate-shake" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={18} />
          <span>{submitError}</span>
        </div>
      )}

      {/* Main Submission Form */}
      <form onSubmit={handleSubmitReport} className="clean-report-form" noValidate>
        {/* 1. What is the problem? */}
        <div className="form-section-card">
          <label className="form-card-label" htmlFor="problem-desc">
            1. What is the problem?
          </label>
          <p className="form-card-hint">
            Describe the civic problem clearly (e.g. pothole depth, waterlogging, broken light).
          </p>
          <textarea
            id="problem-desc"
            className="report-textarea"
            rows={4}
            placeholder="e.g. There is severe waterlogging on the road near a school because the drain is blocked."
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setSubmitError('');
            }}
            required
          />
        </div>

        {/* 2. Add a photo */}
        <div className="form-section-card">
          <label className="form-card-label">
            2. Add a photo
          </label>
          <p className="form-card-hint">
            Visual evidence helps response teams bring the right equipment and assess authenticity.
          </p>

          {/* Photo Actions */}
          <div className="photo-actions-row">
            <button
              type="button"
              className="photo-btn"
              onClick={() => cameraInputRef.current?.click()}
              title="Take a photo using camera"
            >
              <Camera size={20} />
              <span>Take Photo</span>
            </button>

            <button
              type="button"
              className="photo-btn"
              onClick={() => uploadInputRef.current?.click()}
              title="Choose photo from device"
            >
              <Upload size={20} />
              <span>Upload Photo</span>
            </button>

            {/* Hidden File Inputs */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>

          {/* Photo Preview if selected */}
          {photoPreview && (
            <div className="photo-preview-wrap animate-fade-in">
              <img
                src={photoPreview}
                alt="Civic problem preview"
                className="photo-preview-img"
              />
              <button
                type="button"
                className="remove-photo-btn"
                onClick={handleRemovePhoto}
                title="Remove photo"
              >
                <Trash2 size={16} />
                <span>Remove Photo</span>
              </button>
            </div>
          )}

          {/* Quick Demo Photo Samples */}
          {!photoPreview && (
            <div className="demo-photo-picker">
              <span className="demo-photo-picker-label">Or select a sample photo:</span>
              <div className="demo-photo-chips">
                {DEMO_PHOTOS.map((dp, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="demo-photo-chip"
                    onClick={() => setPhotoPreview(dp.url)}
                  >
                    <span>📷 {dp.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3. Incident Location in Hyderabad (Leaflet + OpenStreetMap) */}
        <div className="form-section-card">
          <label className="form-card-label">
            3. Incident Location in Hyderabad
          </label>
          <p className="form-card-hint">
            Search a locality, click anywhere on the Hyderabad map, or drag the red pin to mark the exact complaint spot.
          </p>

          <HyderabadMap
            latitude={latitude}
            longitude={longitude}
            address={address}
            onLocationSelect={({ lat, lng, address: selectedAddr }) => {
              setLatitude(lat);
              setLongitude(lng);
              setAddress(selectedAddr);
              setLocationStatus(`${selectedAddr} (GPS: ${lat}, ${lng})`);
              setSubmitError('');
            }}
            readOnly={false}
            height="360px"
            showSearch={true}
          />
        </div>

        {/* 4. Street Address & Landmark Details */}
        <div className="form-section-card">
          <label className="form-card-label" htmlFor="report-address">
            4. Street Address / Landmark Details
          </label>
          <p className="form-card-hint">
            Auto-filled from map selection. You can add specific details (e.g. Near Pillar 45, Opposite Metro Station).
          </p>
          <input
            id="report-address"
            type="text"
            className="report-text-input"
            placeholder="e.g. Near Charminar Gate 2, Old City, Hyderabad"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setSubmitError('');
            }}
            required
          />

          {locationStatus && (
            <div style={{ marginTop: '0.65rem' }}>
              <span className="location-status-badge">
                <CheckCircle2 size={16} />
                <span>{locationStatus}</span>
              </span>
            </div>
          )}
        </div>

        {/* Multi-Layer Civic Complaint Verification Card */}
        {validationMismatch && (
          <div className="validation-mismatch-banner animate-shake" style={{
            background: validationMismatch.decision === 'NEEDS_MORE_INFORMATION' ? '#fffbeb' : '#fff1f2',
            border: validationMismatch.decision === 'NEEDS_MORE_INFORMATION' ? '1.5px solid #fde68a' : '1.5px solid #fda4af',
            borderRadius: '12px',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              {validationMismatch.decision === 'NEEDS_MORE_INFORMATION' ? (
                <HelpCircle size={22} color="#b45309" style={{ flexShrink: 0, marginTop: '2px' }} />
              ) : (
                <AlertCircle size={22} color="#e11d48" style={{ flexShrink: 0, marginTop: '2px' }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0, color: validationMismatch.decision === 'NEEDS_MORE_INFORMATION' ? '#92400e' : '#9f1239', fontSize: '1rem', fontWeight: 700 }}>
                    {validationMismatch.decision === 'NEEDS_MORE_INFORMATION'
                      ? 'Information Needed to Process Complaint'
                      : 'Verification Check: Review Required Before Submission'}
                  </h4>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: validationMismatch.decision === 'NEEDS_MORE_INFORMATION' ? '#fef3c7' : '#ffe4e6',
                    color: validationMismatch.decision === 'NEEDS_MORE_INFORMATION' ? '#b45309' : '#e11d48',
                    border: '1px solid currentColor'
                  }}>
                    {validationMismatch.decision || validationMismatch.status}
                  </span>
                </div>

                {/* 1. Verified Checks */}
                <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.7)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#047857', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 size={14} color="#059669" /> Verified Checks:
                  </span>
                  <ul style={{ margin: '0.25rem 0 0 1.25rem', padding: 0, fontSize: '0.85rem', color: '#065f46' }}>
                    {validationMismatch.layers?.location?.status === 'VALID' && (
                      <li>Location is geographically valid within Hyderabad municipal limits.</li>
                    )}
                    {validationMismatch.layers?.description?.status === 'PASSED' && (
                      <li>Description is legible and civic-related.</li>
                    )}
                    {validationMismatch.layers?.image?.status === 'OPTIONAL_OMITTED' && (
                      <li>Optional photograph omitted (no penalty applied).</li>
                    )}
                    {validationMismatch.layers?.image?.status === 'PASSED' && (
                      <li>Attached photograph visibly supports the reported issue.</li>
                    )}
                    {validationMismatch.layers?.duplicatesAndAbuse?.status === 'CLEAN' && (
                      <li>No duplicate complaint logged for this immediate spot.</li>
                    )}
                  </ul>
                </div>

                {/* 2. Issues Found */}
                {(validationMismatch.issues?.length > 0 || validationMismatch.contradictionFlags?.length > 0 || validationMismatch.reason) && (
                  <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.7)', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertTriangle size={14} color="#dc2626" /> Issues Found:
                    </span>
                    <ul style={{ margin: '0.25rem 0 0 1.25rem', padding: 0, fontSize: '0.85rem', color: '#991b1b' }}>
                      {(validationMismatch.issues && validationMismatch.issues.length > 0)
                        ? validationMismatch.issues.map((iss, idx) => <li key={idx}>{iss}</li>)
                        : <li>{validationMismatch.reason}</li>}
                    </ul>
                  </div>
                )}

                {/* 3. Missing Information (if any) */}
                {validationMismatch.missingInfo?.length > 0 && (
                  <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.7)', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#b45309', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <HelpCircle size={14} color="#d97706" /> Missing Information:
                    </span>
                    <ul style={{ margin: '0.25rem 0 0 1.25rem', padding: 0, fontSize: '0.85rem', color: '#92400e' }}>
                      {validationMismatch.missingInfo.map((info, idx) => (
                        <li key={idx}>{info}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 4. Next Step */}
                <div style={{ marginTop: '0.5rem' }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.84rem', color: '#334155', fontWeight: 600 }}>
                    👉 Next Step: {validationMismatch.recommendedNextAction || 'Please adjust the details above, or request manual officer review.'}
                  </p>

                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setValidationMismatch(null)}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.82rem', padding: '0.45rem 0.9rem' }}
                    >
                      ✏️ Edit Details / Replace Photo
                    </button>

                    <button
                      type="button"
                      onClick={handleRequestHumanReview}
                      className="btn btn-primary"
                      style={{ fontSize: '0.82rem', padding: '0.45rem 0.9rem', background: '#0f766e', borderColor: '#0f766e', color: '#ffffff' }}
                      title="Route directly to Municipal Officer for manual verification"
                    >
                      👮 Request Municipal Officer Review
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="form-submit-row">
          <button
            type="submit"
            className="btn-large-submit"
            disabled={isSubmitting || isValidatingAi}
            id="btn-submit-report"
          >
            {isValidatingAi ? (
              <>
                <Loader2 size={22} className="animate-spin" />
                <span>AI Validating Complaint Inputs...</span>
              </>
            ) : isSubmitting ? (
              <>
                <Loader2 size={22} className="animate-spin" />
                <span>Saving Report Safely...</span>
              </>
            ) : (
              <>
                <span>Submit Report</span>
                <ArrowRight size={22} />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
