import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  PlusCircle,
  Construction,
  Waves,
  Droplets,
  Trash,
  Lightbulb,
  HelpCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { getCitizenReports } from '../../firebase/reports';
import { useRole } from '../../context/useRole';
import { auth } from '../../firebase/config';

const CATEGORY_ICONS = {
  roads: Construction,
  drainage: Waves,
  water: Droplets,
  sanitation: Trash,
  streetlights: Lightbulb,
  other: HelpCircle,
};

function formatReportDate(timestamp) {
  if (!timestamp) return 'Recently submitted';
  try {
    let date = null;
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    } else if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      date = new Date(timestamp);
    }
    if (!date || isNaN(date.getTime())) return 'Recently submitted';

    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Recently submitted';
  }
}

/**
 * Calculates which of the 6 timeline steps have been reached:
 * 1. Report Submitted
 * 2. AI Analysis Completed
 * 3. Officer Reviewed
 * 4. Assigned to Field Worker
 * 5. Work Started
 * 6. Resolved
 */
function getTimelineProgress(report) {
  const status = report.status || 'submitted';
  const hasAi = Boolean(report.aiAnalysis?.issueType);
  const isApproved = ['approved', 'assigned', 'accepted', 'in_progress', 'completed', 'pending_ai_assessment', 'resolved'].includes(status);
  const isAssigned = ['assigned', 'accepted', 'in_progress', 'completed', 'pending_ai_assessment', 'resolved'].includes(status);
  const isWorkStarted = ['in_progress', 'completed', 'pending_ai_assessment', 'resolved'].includes(status);
  const isResolved = status === 'resolved' || status === 'completed';

  return [
    { label: 'Report Submitted', completed: true },
    { label: 'AI Analysis Completed', completed: hasAi },
    { label: 'Officer Reviewed', completed: isApproved },
    { label: 'Assigned to Field Worker', completed: isAssigned },
    { label: 'Work Started', completed: isWorkStarted },
    { label: 'Resolved / Completed', completed: isResolved },
  ];
}

export default function MyReportsPage() {
  const { authUser, isAuthLoading } = useRole();
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(() => Boolean(auth?.currentUser?.uid || authUser?.uid));
  const [error, setError] = useState(null);
  const [expandedDocId, setExpandedDocId] = useState(null);

  const citizenUid = auth?.currentUser?.uid || (authUser?.uid?.startsWith('citizen_') ? 'demo-citizen' : authUser?.uid) || 'demo-citizen';

  const handleRefresh = useCallback(() => {
    if (!citizenUid) return;
    setIsLoading(true);
    setError(null);
    getCitizenReports(citizenUid)
      .then((fetched) => setReports(fetched))
      .catch((err) => {
        console.error('Error fetching citizen reports:', err);
        setError('Unable to load your civic reports at this time. Please check your connection.');
      })
      .finally(() => setIsLoading(false));
  }, [citizenUid]);

  useEffect(() => {
    if (isAuthLoading || !citizenUid) return;
    let active = true;
    getCitizenReports(citizenUid)
      .then((fetched) => {
        if (active) {
          setReports(fetched);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          console.error('Error fetching citizen reports:', err);
          setError('Unable to load your civic reports at this time. Please check your connection.');
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [citizenUid, isAuthLoading]);

  const toggleExpand = (docId) => {
    setExpandedDocId((prev) => (prev === docId ? null : docId));
  };

  if (isAuthLoading) {
    return (
      <div className="citizen-page animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', color: '#64748b' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: '#2563eb' }} />
        <p style={{ fontSize: '0.95rem', fontWeight: 500 }}>Preparing your account...</p>
      </div>
    );
  }

  return (
    <div className="citizen-page animate-fade-in">
      {/* Header */}
      <div className="module-header">
        <div className="module-title-wrap">
          <div className="module-pretitle">
            <FileText size={16} />
            <span>Citizen Portal</span>
          </div>
          <h1 className="module-title">My Reports</h1>
          <p className="module-description">
            Track real-time progress on your submitted complaints from initial report to verified municipal resolution.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleRefresh}
            disabled={isLoading}
            style={{ gap: '0.4rem', padding: '0.6rem 1rem' }}
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <Link
            to="/citizen/report"
            className="btn btn-primary"
            style={{ gap: '0.4rem', padding: '0.6rem 1rem' }}
          >
            <PlusCircle size={16} />
            <span>Report a Problem</span>
          </Link>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="empty-state-card animate-pulse">
          <Loader2 size={32} className="animate-spin text-civic" />
          <h3>Loading your civic reports...</h3>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="auth-alert error-alert" style={{ marginBottom: '2rem' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && reports.length === 0 && (
        <div className="empty-state-card animate-fade-in">
          <FileText size={48} className="text-muted" />
          <h3>No reports submitted yet</h3>
          <p>
            When you report a pothole, drainage choke, or broken streetlight, you can track its progress here.
          </p>
          <Link to="/citizen/report" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            <span>Report Your First Problem</span>
          </Link>
        </div>
      )}

      {/* Reports List */}
      {!isLoading && reports.length > 0 && (
        <div className="my-reports-list">
          {reports.map((report) => {
            const isExpanded = expandedDocId === report.docId;
            const CategoryIcon = CATEGORY_ICONS[report.category] || HelpCircle;
            const problemTitle = report.aiAnalysis?.issueType || `${report.category?.toUpperCase()} Issue`;
            const timeline = getTimelineProgress(report);

            return (
              <div key={report.docId} className="my-report-card animate-fade-in">
                {/* Card Header */}
                <div className="my-report-card-top">
                  <div className="report-card-title-group">
                    <div className="report-category-icon-box">
                      <CategoryIcon size={22} />
                    </div>
                    <div>
                      <h2 className="report-card-problem-title">{problemTitle}</h2>
                      <div className="report-card-meta-line">
                        <span className="report-id-pill">{report.reportId || report.docId.slice(0, 8)}</span>
                        <span>•</span>
                        <span className="report-date-text">
                          <Clock size={13} />
                          {formatReportDate(report.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="report-card-status-badge">
                    {report.status === 'resolved' || report.status === 'completed' ? (
                      <span className="badge badge-success" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
                        Completed ✅
                      </span>
                    ) : report.status === 'in_progress' ? (
                      <span className="badge badge-warning" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
                        Work Started 🔧
                      </span>
                    ) : report.status === 'assigned' || report.status === 'accepted' ? (
                      <span className="badge badge-info" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
                        Assigned to Team 📋
                      </span>
                    ) : report.status === 'approved' ? (
                      <span className="badge badge-success" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem', background: '#dcfce7', color: '#15803d' }}>
                        Approved by Officer 🏛️
                      </span>
                    ) : report.status === 'rejected' ? (
                      <span className="badge" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}>
                        Rejected ❌
                      </span>
                    ) : (
                      <span className="badge badge-stage" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
                        Under Review ⏳
                      </span>
                    )}
                  </div>
                </div>

                {/* Location & Short Description */}
                <div className="my-report-card-loc">
                  <MapPin size={15} />
                  <span>{report.address || report.locationStatus || 'School Road, Ward 12'}</span>
                </div>

                <p className="my-report-desc-preview">
                  "{report.description}"
                </p>

                {report.status === 'rejected' && report.rejectionReason && (
                  <div style={{ marginTop: '0.6rem', padding: '0.6rem 0.85rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '0.85rem', color: '#991b1b' }}>
                    <strong>Officer Decision Note:</strong> {report.rejectionReason}
                  </div>
                )}

                {/* 6-Step Clean Timeline per Requirement 13 */}
                <div className="my-report-timeline-container">
                  <div className="my-timeline-steps">
                    {timeline.map((step, idx) => (
                      <div
                        key={idx}
                        className={`my-timeline-step ${step.completed ? 'completed' : 'pending'}`}
                      >
                        <div className="step-marker">
                          {step.completed ? <CheckCircle2 size={15} /> : <span className="marker-dot"></span>}
                        </div>
                        <span className="step-name">{step.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Expand / Details Toggle Button */}
                <div className="my-report-card-footer">
                  <button
                    type="button"
                    className="card-toggle-details-btn"
                    onClick={() => toggleExpand(report.docId)}
                  >
                    <span>{isExpanded ? 'Hide Details' : 'View AI Triage & Resolution Details'}</span>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>

                {/* Expanded Details Panel */}
                {isExpanded && (
                  <div className="my-report-expanded-panel animate-fade-in">
                    {/* AI Assessment Snapshot */}
                    {report.aiAnalysis && (
                      <div className="citizen-ai-detail-box">
                        <div className="ai-box-header">
                          <Sparkles size={16} color="var(--civic-blue)" />
                          <strong>AI Assessment Summary</strong>
                        </div>
                        <p className="ai-detail-text">
                          {report.aiAnalysis.shortSummary || report.aiAnalysis.evidence}
                        </p>
                        <div className="ai-detail-badges">
                          <span className="badge badge-stage">Department: {report.aiAnalysis.department}</span>
                          <span className="badge badge-stage">Authenticity: {report.aiAnalysis.authenticityAssessment || 'Likely Genuine'}</span>
                          {report.priorityAssessment?.level && (
                            <span className="badge badge-stage">Priority: {report.priorityAssessment.level}</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Resolution Evidence if resolved */}
                    {report.status === 'resolved' && (
                      <div className="citizen-resolution-evidence-box">
                        <div className="res-header">
                          <CheckCircle2 size={18} color="var(--success-emerald)" />
                          <strong>Verified Municipal Resolution</strong>
                        </div>
                        <p className="res-text">
                          {report.workerResolution?.workPerformed ||
                            'Field repairs completed and certified by the municipal response team.'}
                        </p>
                        {report.resolvedAt && (
                          <span className="res-time">
                            Resolved on: {new Date(report.resolvedAt).toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Photo if provided */}
                    {(report.imageUrl || report.photoDataUrl) && (
                      <div className="citizen-report-photo-preview">
                        <span className="photo-label">Attached Photographic Evidence:</span>
                        <img
                          src={report.imageUrl || report.photoDataUrl}
                          alt="Reported problem"
                          className="citizen-attached-img"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
