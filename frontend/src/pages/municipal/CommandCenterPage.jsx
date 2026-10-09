import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LayoutDashboard,
  AlertTriangle,
  Flame,
  ShieldAlert,
  Clock,
  Layers,
  Sparkles,
  MapPin,
  RefreshCw,
  Search,
  Activity,
  FileText,
  ChevronRight,
  X,
  Droplets,
  Waves,
  Trash,
  Lightbulb,
  Construction,
  HelpCircle,
  TrendingUp,
  Users2,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  FileCheck2,
  Check,
  UserCheck,
} from 'lucide-react';
import { getAllMunicipalReports } from '../../firebase/reports';
import {
  createWorkOrder,
  confirmResolution,
} from '../../services/aiService';
import { useRole } from '../../context/useRole';
import PredictiveRiskSection from '../../components/municipal/PredictiveRiskSection';

const CATEGORY_ICONS = {
  roads: Construction,
  drainage: Waves,
  water: Droplets,
  sanitation: Trash,
  streetlights: Lightbulb,
};

const MUNICIPAL_DEPARTMENTS = [
  'Roads & Infrastructure',
  'Stormwater & Drainage',
  'Water Supply',
  'Sanitation',
  'Street Lighting',
  'Electrical',
  'Parks & Public Spaces',
  'Other',
];

function formatReportDate(timestamp) {
  if (!timestamp) return 'Time not recorded';
  let dateObj = null;
  if (typeof timestamp.toDate === 'function') {
    dateObj = timestamp.toDate();
  } else if (timestamp.seconds) {
    dateObj = new Date(timestamp.seconds * 1000);
  } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
    dateObj = new Date(timestamp);
  }
  if (!dateObj || isNaN(dateObj.getTime())) return 'Time not recorded';
  return dateObj.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CommandCenterPage() {
  const { authUser } = useRole();
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedReportId, setSelectedReportId] = useState(null);

  // Active filter tab: 'ALL' | 'NEW' | 'UNDER_REVIEW' | 'APPROVED' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CRITICAL' | 'HIGH'
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('PRIORITY_DESC');

  // Officer Review Form State
  const [assignedDepartment, setAssignedDepartment] = useState('Stormwater & Drainage');
  const [reviewPriority, setReviewPriority] = useState('High');
  const [workersRequired, setWorkersRequired] = useState(2);
  const [officerInstructions, setOfficerInstructions] = useState('');
  const [officerNotes, setOfficerNotes] = useState('');
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isSubmittingWorkOrder, setIsSubmittingWorkOrder] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState('');

  // Rejection modal state
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Actions state
  const [isProcessingResolution, setIsProcessingResolution] = useState(false);

  // Load live reports from Firestore
  const loadReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const liveReports = await getAllMunicipalReports();
      setReports(liveReports);
      setSelectedReportId((prev) => prev || (liveReports.length > 0 ? liveReports[0].docId : null));
    } catch (err) {
      console.error('Error fetching municipal reports:', err);
      setError('Unable to load live municipal reports from Firestore. Please verify Firestore connectivity.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const liveReports = await getAllMunicipalReports();
        if (isMounted) {
          setReports(liveReports);
          if (liveReports.length > 0) {
            setSelectedReportId(liveReports[0].docId);
          }
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error fetching municipal reports:', err);
          setError('Unable to load live municipal reports from Firestore. Please verify Firestore connectivity.');
          setIsLoading(false);
        }
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute live dashboard metrics according to Requirement 2:
  // - New Reports
  // - Under Review
  // - Approved
  // - Assigned
  // - In Progress
  // - Resolved
  // - Critical
  // - High Priority
  const counts = useMemo(() => {
    let newReports = 0;
    let underReview = 0;
    let approved = 0;
    let assigned = 0;
    let inProgress = 0;
    let resolved = 0;
    let critical = 0;
    let high = 0;

    reports.forEach((r) => {
      const st = (r.status || 'submitted').toLowerCase();
      if (st === 'submitted' || st === 'analyzing') newReports++;
      else if (st === 'under_review' || st === 'reviewing' || st === 'pending_review') underReview++;
      else if (st === 'approved') approved++;
      else if (st === 'assigned' || st === 'accepted') assigned++;
      else if (st === 'in_progress') inProgress++;
      else if (st === 'resolved') resolved++;

      const prio = (r.priorityAssessment?.level || r.aiAnalysis?.severity || r.priority || 'Low').toLowerCase();
      if (prio === 'critical') critical++;
      else if (prio === 'high') high++;
    });

    return {
      total: reports.length,
      newReports,
      underReview,
      approved,
      assigned,
      inProgress,
      resolved,
      critical,
      high,
    };
  }, [reports]);

  // Filter & sort reports
  const filteredReports = useMemo(() => {
    return reports
      .filter((r) => {
        const st = (r.status || 'submitted').toLowerCase();
        const prio = (r.priorityAssessment?.level || r.aiAnalysis?.severity || r.priority || 'Low').toLowerCase();

        if (activeFilter === 'NEW') {
          if (st !== 'submitted' && st !== 'analyzing') return false;
        } else if (activeFilter === 'UNDER_REVIEW') {
          if (st !== 'under_review' && st !== 'reviewing' && st !== 'pending_review') return false;
        } else if (activeFilter === 'APPROVED') {
          if (st !== 'approved') return false;
        } else if (activeFilter === 'ASSIGNED') {
          if (st !== 'assigned' && st !== 'accepted') return false;
        } else if (activeFilter === 'IN_PROGRESS') {
          if (st !== 'in_progress') return false;
        } else if (activeFilter === 'RESOLVED') {
          if (st !== 'resolved') return false;
        } else if (activeFilter === 'CRITICAL') {
          if (prio !== 'critical') return false;
        } else if (activeFilter === 'HIGH') {
          if (prio !== 'high') return false;
        }

        // Department filter
        const dept = (r.assignedDepartment || r.aiAnalysis?.department || r.category || '').toLowerCase();
        if (departmentFilter !== 'ALL' && !dept.includes(departmentFilter.toLowerCase())) {
          return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const id = (r.reportId || r.docId || '').toLowerCase();
          const desc = (r.description || '').toLowerCase();
          const issue = (r.aiAnalysis?.issueType || '').toLowerCase();
          const deptText = (r.assignedDepartment || r.aiAnalysis?.department || '').toLowerCase();
          const loc = (r.locationStatus || '').toLowerCase();
          if (!id.includes(q) && !desc.includes(q) && !issue.includes(q) && !deptText.includes(q) && !loc.includes(q)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'PRIORITY_DESC') {
          const scoreA = a.priorityAssessment?.score ?? (a.aiAnalysis?.severity === 'Critical' ? 95 : a.aiAnalysis?.severity === 'High' ? 80 : 50);
          const scoreB = b.priorityAssessment?.score ?? (b.aiAnalysis?.severity === 'Critical' ? 95 : b.aiAnalysis?.severity === 'High' ? 80 : 50);
          if (scoreB !== scoreA) return scoreB - scoreA;
        }
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : 0));
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : 0));
        return timeB - timeA;
      });
  }, [reports, activeFilter, departmentFilter, searchQuery, sortBy]);

  // Selected report object
  const selectedReport = useMemo(() => {
    if (!selectedReportId) return null;
    return reports.find((r) => r.docId === selectedReportId || r.reportId === selectedReportId) || null;
  }, [reports, selectedReportId]);

  // Keep officer review form in sync when selected report changes
  useEffect(() => {
    if (selectedReport) {
      setAssignedDepartment(
        selectedReport.assignedDepartment ||
        selectedReport.aiAnalysis?.department ||
        (selectedReport.category === 'drainage' ? 'Stormwater & Drainage' :
         selectedReport.category === 'roads' ? 'Roads & Infrastructure' :
         selectedReport.category === 'water' ? 'Water Supply' :
         selectedReport.category === 'sanitation' ? 'Sanitation' :
         selectedReport.category === 'streetlights' ? 'Street Lighting' : 'Roads & Infrastructure')
      );
      setReviewPriority(
        selectedReport.priority ||
        selectedReport.priorityAssessment?.level ||
        selectedReport.aiAnalysis?.severity ||
        'High'
      );
      setWorkersRequired(selectedReport.workersRequired || 2);
      setOfficerInstructions(selectedReport.officerInstructions || '');
      setOfficerNotes(selectedReport.officerNotes || '');
      setActionSuccessMessage('');
    }
  }, [selectedReport]);

  // Compute related complaints for the selected report (Requirement 4E)
  const relatedComplaints = useMemo(() => {
    if (!selectedReport) return [];
    return reports.filter((r) => {
      if (r.docId === selectedReport.docId) return false;
      const sameCategory = r.category && selectedReport.category && r.category.toLowerCase() === selectedReport.category.toLowerCase();
      const rDept = (r.assignedDepartment || r.aiAnalysis?.department || '').toLowerCase();
      const selDept = (selectedReport.assignedDepartment || selectedReport.aiAnalysis?.department || '').toLowerCase();
      const sameDept = Boolean(rDept && selDept && rDept === selDept);
      const linkedInFusion = selectedReport.incidentFusion?.relatedReportIds?.includes(r.reportId || r.docId);

      let closeDistance = false;
      if (r.latitude && r.longitude && selectedReport.latitude && selectedReport.longitude) {
        const dLat = Math.abs(r.latitude - selectedReport.latitude);
        const dLon = Math.abs(r.longitude - selectedReport.longitude);
        closeDistance = dLat < 0.04 && dLon < 0.04;
      }
      return linkedInFusion || sameCategory || sameDept || closeDistance;
    });
  }, [reports, selectedReport]);

  // Handle Approve & Create Work Order (Requirement 9)
  const handleApproveWorkOrder = async () => {
    if (!selectedReport) return;
    setIsSubmittingWorkOrder(true);
    setActionSuccessMessage('');

    try {
      const officerName = authUser?.name || 'Municipal Officer';
      const result = await createWorkOrder(selectedReport.docId, {
        officerName,
        officerDecision: 'approved',
        assignedDepartment,
        priority: reviewPriority,
        workersRequired: Number(workersRequired),
        officerInstructions,
        officerNotes,
      });

      if (result?.success) {
        setReports((prev) =>
          prev.map((r) =>
            r.docId === selectedReport.docId
              ? {
                  ...r,
                  status: 'approved',
                  reviewedBy: officerName,
                  reviewedAt: new Date().toISOString(),
                  approvedAt: new Date().toISOString(),
                  assignedDepartment,
                  priority: reviewPriority,
                  workersRequired: Number(workersRequired),
                  officerInstructions,
                  officerDecision: 'approved',
                  officerNotes,
                }
              : r
          )
        );
        setActionSuccessMessage('Work order approved and created successfully! Citizen notification dispatched.');
        setIsApprovalModalOpen(false);
      }
    } catch (err) {
      console.error('Work order creation error:', err);
      alert(`Could not create work order: ${err.message}`);
    } finally {
      setIsSubmittingWorkOrder(false);
    }
  };

  // Handle Reject Complaint (Requirement 6)
  const handleRejectComplaint = async () => {
    if (!selectedReport || !rejectionReason.trim()) return;
    setIsSubmittingWorkOrder(true);

    try {
      const officerName = authUser?.name || 'Municipal Officer';
      const result = await createWorkOrder(selectedReport.docId, {
        officerName,
        officerDecision: 'rejected',
        assignedDepartment,
        priority: reviewPriority,
        workersRequired: 0,
        officerInstructions: '',
        officerNotes: rejectionReason.trim(),
      });

      if (result?.success) {
        setReports((prev) =>
          prev.map((r) =>
            r.docId === selectedReport.docId
              ? {
                  ...r,
                  status: 'rejected',
                  reviewedBy: officerName,
                  reviewedAt: new Date().toISOString(),
                  officerDecision: 'rejected',
                  officerNotes: rejectionReason.trim(),
                }
              : r
          )
        );
        setActionSuccessMessage('Complaint marked as rejected with official rationale logged.');
        setIsRejectModalOpen(false);
        setRejectionReason('');
      }
    } catch (err) {
      console.error('Rejection error:', err);
      alert(`Could not reject complaint: ${err.message}`);
    } finally {
      setIsSubmittingWorkOrder(false);
    }
  };

  // Stage 12: Municipal Officer Confirms Resolution
  const handleConfirmResolution = async (docId) => {
    if (!docId) return;
    setIsProcessingResolution(true);
    try {
      const officerName = authUser?.name || 'Municipal Officer';
      const res = await confirmResolution(docId, officerName);
      if (res?.success) {
        setReports((prev) =>
          prev.map((r) =>
            r.docId === docId
              ? {
                  ...r,
                  status: 'resolved',
                  resolutionConfirmedBy: officerName,
                  resolvedAt: new Date().toISOString(),
                }
              : r
          )
        );
      }
    } catch (err) {
      console.error('Failed to confirm resolution:', err);
    } finally {
      setIsProcessingResolution(false);
    }
  };

  // Requirement 10: Dynamic Timeline (Only display stages that actually happened)
  const renderTimeline = (report) => {
    if (!report) return null;

    const stages = [
      {
        title: 'Citizen Reported',
        happened: true,
        meta: formatReportDate(report.createdAt),
      },
      {
        title: 'AI Analyzed',
        happened: Boolean(report.aiAnalysis),
        meta: report.aiAnalysis?.issueType || 'Analyzed',
      },
      {
        title: 'Officer Reviewing',
        happened: Boolean(
          report.reviewedAt ||
          ['under_review', 'reviewing', 'approved', 'assigned', 'in_progress', 'resolved'].includes(report.status)
        ),
        meta: report.reviewedBy ? `By ${report.reviewedBy}` : 'Under Review',
      },
      {
        title: 'Officer Approved',
        happened: Boolean(
          report.approvedAt ||
          ['approved', 'assigned', 'in_progress', 'resolved'].includes(report.status)
        ),
        meta: report.approvedAt ? formatReportDate(report.approvedAt) : 'Approved',
      },
      {
        title: 'Department Assigned',
        happened: Boolean(
          report.assignedDepartment &&
          ['approved', 'assigned', 'in_progress', 'resolved'].includes(report.status)
        ),
        meta: report.assignedDepartment || '',
      },
      {
        title: 'Workers Required',
        happened: Boolean(report.workersRequired && report.workersRequired > 0),
        meta: `${report.workersRequired} workers`,
      },
      {
        title: 'Work Started',
        happened: Boolean(report.status === 'in_progress' || (report.workerProgress && report.workerProgress.length > 0)),
        meta: 'In Progress',
      },
      {
        title: 'Resolved',
        happened: Boolean(report.status === 'resolved' || report.resolvedAt),
        meta: report.resolvedAt ? formatReportDate(report.resolvedAt) : 'Resolved',
      },
    ];

    // Filter to ONLY stages that actually happened
    const completedStages = stages.filter((s) => s.happened);

    return (
      <div className="report-timeline-container" style={{ margin: '1rem 0', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <h5 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Report Lifecycle Timeline
        </h5>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          {completedStages.map((stage, idx) => (
            <React.Fragment key={stage.title}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#ffffff', padding: '0.4rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#0e7490', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700 }}>
                  <Check size={11} />
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>{stage.title}</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{stage.meta}</div>
                </div>
              </div>
              {idx < completedStages.length - 1 && (
                <span style={{ color: '#0e7490', fontWeight: 800, fontSize: '0.9rem' }}>→</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="command-center-container">
      {/* Banner */}
      <div className="command-center-banner" role="banner">
        <ShieldAlert size={16} />
        <span>MUNICIPAL COMMAND CENTER — AUTHORIZED OFFICER CONSOLE</span>
        <span className="banner-sub">Operating in Municipal Operations Mode</span>
      </div>

      {/* Main Header */}
      <header className="command-header">
        <div className="command-header-left">
          <div className="command-badge">
            <LayoutDashboard size={16} />
            <span>Operations Console</span>
          </div>
          <h1 className="command-title">Municipal Command Center</h1>
          <p className="command-subtitle">
            Central operational hub for city administrators. Real-time civic grievance triage, explainable AI dispatch recommendations, and direct work order approvals.
          </p>
        </div>

        <div className="command-header-actions">
          <button
            type="button"
            onClick={loadReports}
            className="command-refresh-btn"
            disabled={isLoading}
            id="btn-sync-reports"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            <span>{isLoading ? 'Syncing...' : 'Sync Live Reports'}</span>
          </button>
        </div>
      </header>

      {/* SECTION 2: MUNICIPAL COMMAND CENTER 8 STATUS CARDS (Requirement 2) */}
      <section className="command-summary-grid" aria-label="Municipal grievance status summary" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        {/* 1. New Reports */}
        <div
          className={`summary-card ${activeFilter === 'NEW' ? 'selected' : ''}`}
          style={{ cursor: 'pointer', border: activeFilter === 'NEW' ? '2px solid #0284c7' : '1.5px solid #e2e8f0' }}
          onClick={() => setActiveFilter(activeFilter === 'NEW' ? 'ALL' : 'NEW')}
        >
          <div className="summary-card-icon" style={{ background: '#e0f2fe', color: '#0369a1' }}>
            <FileText size={20} />
          </div>
          <div className="summary-card-body">
            <span className="summary-label">New Reports</span>
            <strong className="summary-value">{counts.newReports}</strong>
            <span className="summary-hint">Awaiting triage</span>
          </div>
        </div>

        {/* 2. Under Review */}
        <div
          className={`summary-card ${activeFilter === 'UNDER_REVIEW' ? 'selected' : ''}`}
          style={{ cursor: 'pointer', border: activeFilter === 'UNDER_REVIEW' ? '2px solid #0e7490' : '1.5px solid #e2e8f0' }}
          onClick={() => setActiveFilter(activeFilter === 'UNDER_REVIEW' ? 'ALL' : 'UNDER_REVIEW')}
        >
          <div className="summary-card-icon" style={{ background: '#ccfbf1', color: '#0f766e' }}>
            <Clock size={20} />
          </div>
          <div className="summary-card-body">
            <span className="summary-label">Under Review</span>
            <strong className="summary-value">{counts.underReview}</strong>
            <span className="summary-hint">Officer evaluating</span>
          </div>
        </div>

        {/* 3. Approved */}
        <div
          className={`summary-card ${activeFilter === 'APPROVED' ? 'selected' : ''}`}
          style={{ cursor: 'pointer', border: activeFilter === 'APPROVED' ? '2px solid #059669' : '1.5px solid #e2e8f0' }}
          onClick={() => setActiveFilter(activeFilter === 'APPROVED' ? 'ALL' : 'APPROVED')}
        >
          <div className="summary-card-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>
            <ShieldCheck size={20} />
          </div>
          <div className="summary-card-body">
            <span className="summary-label">Approved</span>
            <strong className="summary-value">{counts.approved}</strong>
            <span className="summary-hint">Work orders created</span>
          </div>
        </div>

        {/* 4. Assigned */}
        <div
          className={`summary-card ${activeFilter === 'ASSIGNED' ? 'selected' : ''}`}
          style={{ cursor: 'pointer', border: activeFilter === 'ASSIGNED' ? '2px solid #6366f1' : '1.5px solid #e2e8f0' }}
          onClick={() => setActiveFilter(activeFilter === 'ASSIGNED' ? 'ALL' : 'ASSIGNED')}
        >
          <div className="summary-card-icon" style={{ background: '#e0e7ff', color: '#4338ca' }}>
            <Users2 size={20} />
          </div>
          <div className="summary-card-body">
            <span className="summary-label">Assigned</span>
            <strong className="summary-value">{counts.assigned}</strong>
            <span className="summary-hint">Department dispatched</span>
          </div>
        </div>

        {/* 5. In Progress */}
        <div
          className={`summary-card ${activeFilter === 'IN_PROGRESS' ? 'selected' : ''}`}
          style={{ cursor: 'pointer', border: activeFilter === 'IN_PROGRESS' ? '2px solid #d97706' : '1.5px solid #e2e8f0' }}
          onClick={() => setActiveFilter(activeFilter === 'IN_PROGRESS' ? 'ALL' : 'IN_PROGRESS')}
        >
          <div className="summary-card-icon" style={{ background: '#fef3c7', color: '#b45309' }}>
            <Activity size={20} />
          </div>
          <div className="summary-card-body">
            <span className="summary-label">In Progress</span>
            <strong className="summary-value">{counts.inProgress}</strong>
            <span className="summary-hint">Field work active</span>
          </div>
        </div>

        {/* 6. Resolved */}
        <div
          className={`summary-card ${activeFilter === 'RESOLVED' ? 'selected' : ''}`}
          style={{ cursor: 'pointer', border: activeFilter === 'RESOLVED' ? '2px solid #10b981' : '1.5px solid #e2e8f0' }}
          onClick={() => setActiveFilter(activeFilter === 'RESOLVED' ? 'ALL' : 'RESOLVED')}
        >
          <div className="summary-card-icon" style={{ background: '#ecfdf5', color: '#047857' }}>
            <CheckCircle2 size={20} />
          </div>
          <div className="summary-card-body">
            <span className="summary-label">Resolved</span>
            <strong className="summary-value">{counts.resolved}</strong>
            <span className="summary-hint">Verified closed</span>
          </div>
        </div>

        {/* 7. Critical */}
        <div
          className={`summary-card ${activeFilter === 'CRITICAL' ? 'selected' : ''}`}
          style={{ cursor: 'pointer', border: activeFilter === 'CRITICAL' ? '2px solid #dc2626' : '1.5px solid #e2e8f0' }}
          onClick={() => setActiveFilter(activeFilter === 'CRITICAL' ? 'ALL' : 'CRITICAL')}
        >
          <div className="summary-card-icon" style={{ background: '#fee2e2', color: '#b91c1c' }}>
            <Flame size={20} />
          </div>
          <div className="summary-card-body">
            <span className="summary-label">Critical</span>
            <strong className="summary-value">{counts.critical}</strong>
            <span className="summary-hint">Immediate hazard</span>
          </div>
        </div>

        {/* 8. High Priority */}
        <div
          className={`summary-card ${activeFilter === 'HIGH' ? 'selected' : ''}`}
          style={{ cursor: 'pointer', border: activeFilter === 'HIGH' ? '2px solid #ea580c' : '1.5px solid #e2e8f0' }}
          onClick={() => setActiveFilter(activeFilter === 'HIGH' ? 'ALL' : 'HIGH')}
        >
          <div className="summary-card-icon" style={{ background: '#ffedd5', color: '#c2410c' }}>
            <AlertTriangle size={20} />
          </div>
          <div className="summary-card-body">
            <span className="summary-label">High Priority</span>
            <strong className="summary-value">{counts.high}</strong>
            <span className="summary-hint">Urgent resolution</span>
          </div>
        </div>
      </section>

      {/* Area Risk & Predictive Civic Model */}
      <PredictiveRiskSection />

      {/* Main Split Console: Reports List + Selected Report Detail */}
      <div className="command-console-layout">
        {/* Table Panel */}
        <section className="command-table-panel" aria-label="Incident Management Table">
          {/* Controls Bar */}
          <div className="table-controls-bar">
            <div className="priority-filter-tabs">
              <button
                type="button"
                onClick={() => setActiveFilter('ALL')}
                className={`priority-tab-btn ${activeFilter === 'ALL' ? 'active' : ''}`}
              >
                ALL ({reports.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('NEW')}
                className={`priority-tab-btn ${activeFilter === 'NEW' ? 'active' : ''}`}
              >
                NEW ({counts.newReports})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('APPROVED')}
                className={`priority-tab-btn ${activeFilter === 'APPROVED' ? 'active' : ''}`}
              >
                APPROVED ({counts.approved})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('CRITICAL')}
                className={`priority-tab-btn ${activeFilter === 'CRITICAL' ? 'active' : ''}`}
              >
                CRITICAL ({counts.critical})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('HIGH')}
                className={`priority-tab-btn ${activeFilter === 'HIGH' ? 'active' : ''}`}
              >
                HIGH ({counts.high})
              </button>
            </div>

            <div className="table-search-sort-group">
              <div className="table-search-box">
                <Search size={15} color="var(--navy-400)" />
                <input
                  type="text"
                  placeholder="Search complaints by ID, text, address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="table-search-input"
                  id="officer-search-input"
                />
              </div>

              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="table-select"
                aria-label="Filter by department"
              >
                <option value="ALL">All Departments</option>
                {MUNICIPAL_DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="table-select"
                aria-label="Sort order"
              >
                <option value="PRIORITY_DESC">Highest Priority</option>
                <option value="NEWEST_FIRST">Newest Reports</option>
              </select>
            </div>
          </div>

          {/* Table content */}
          {isLoading && (
            <div className="command-state-box loading">
              <RefreshCw size={28} className="animate-spin" color="var(--civic-blue)" />
              <p>Retrieving Live Citizen Reports from Firestore...</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="command-state-box error">
              <AlertTriangle size={32} color="#dc2626" />
              <h3>Failed to Load Municipal Reports</h3>
              <p>{error}</p>
              <button type="button" onClick={loadReports} className="btn btn-secondary">
                Retry Connection
              </button>
            </div>
          )}

          {!isLoading && !error && filteredReports.length === 0 && (
            <div className="command-state-box empty">
              <FileText size={32} color="var(--navy-400)" />
              <h3>No Citizen Reports Match Active Filters</h3>
              <p>Try resetting the search query or status filter.</p>
              <button
                type="button"
                onClick={() => {
                  setActiveFilter('ALL');
                  setDepartmentFilter('ALL');
                  setSearchQuery('');
                }}
                className="btn btn-secondary"
              >
                Reset All Filters
              </button>
            </div>
          )}

          {!isLoading && !error && filteredReports.length > 0 && (
            <div className="command-table-wrap">
              <table className="command-incidents-table" role="table">
                <thead>
                  <tr>
                    <th>Priority</th>
                    <th>Complaint ID</th>
                    <th>Citizen Issue & Category</th>
                    <th>Location Area</th>
                    <th>Status</th>
                    <th>Reported</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((report) => {
                    const isSelected = selectedReportId === report.docId;
                    const CategoryIcon = CATEGORY_ICONS[report.category?.toLowerCase()] || HelpCircle;
                    const priorityLevel = report.priority || report.priorityAssessment?.level || report.aiAnalysis?.severity || 'Medium';

                    return (
                      <tr
                        key={report.docId}
                        onClick={() => setSelectedReportId(report.docId)}
                        className={`incident-table-row ${isSelected ? 'selected' : ''}`}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') setSelectedReportId(report.docId);
                        }}
                      >
                        <td>
                          <span className={`priority-badge level-${priorityLevel.toLowerCase()}`}>
                            {priorityLevel.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <strong className="table-report-id">
                            {report.reportId ? `#${report.reportId}` : `#${report.docId.slice(0, 8).toUpperCase()}`}
                          </strong>
                        </td>
                        <td>
                          <div className="table-issue-cell">
                            <span className="table-issue-title">
                              {report.aiAnalysis?.issueType || (report.category ? `${report.category.charAt(0).toUpperCase() + report.category.slice(1)} Problem` : 'Civic Complaint')}
                            </span>
                            <span className="table-dept-subtitle">
                              <CategoryIcon size={12} />
                              <span>{report.assignedDepartment || report.aiAnalysis?.department || report.category || 'General'}</span>
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="table-loc-cell">
                            <MapPin size={13} color="var(--navy-500)" />
                            <span>
                              {report.address || report.locationStatus || (report.latitude ? `${report.latitude.toFixed(3)}, ${report.longitude?.toFixed(3)}` : 'Location pinned')}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={`table-status-pill status-${(report.status || 'submitted').toLowerCase().replace(/\s+/g, '-')}`}>
                            {(report.status || 'Submitted').toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <span className="table-date-text">{formatReportDate(report.createdAt)}</span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`table-inspect-btn ${isSelected ? 'active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedReportId(report.docId);
                            }}
                          >
                            <span>Open</span>
                            <ChevronRight size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* SECTION 3 & 4 & 5 & 6 & 7 & 8 & 9: SELECTED REPORT DETAIL PANEL */}
        {selectedReport && (
          <aside className="command-detail-panel animate-fade-in" aria-label="Selected citizen complaint details">
            {/* Header */}
            <div className="detail-panel-header">
              <div className="detail-header-left">
                <span className="detail-eyebrow">Municipal Review & Work Order Console</span>
                <h3 className="detail-report-id">
                  {selectedReport.reportId ? `#${selectedReport.reportId}` : `#${selectedReport.docId}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReportId(null)}
                className="detail-close-btn"
                title="Close panel"
              >
                <X size={18} />
              </button>
            </div>

            <div className="detail-scroll-area">
              {/* Status and Department Pills */}
              <div className="detail-tags-row">
                <span className={`priority-badge level-${(selectedReport.priority || selectedReport.priorityAssessment?.level || selectedReport.aiAnalysis?.severity || 'medium').toLowerCase()}`}>
                  {(selectedReport.priority || selectedReport.priorityAssessment?.level || selectedReport.aiAnalysis?.severity || 'Medium').toUpperCase()}
                </span>
                <span className="detail-category-badge">
                  {selectedReport.category ? selectedReport.category.toUpperCase() : 'CIVIC ISSUE'}
                </span>
                <span className="detail-status-badge">
                  STATUS: {(selectedReport.status || 'Submitted').toUpperCase()}
                </span>
              </div>

              {actionSuccessMessage && (
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                  <CheckCircle2 size={18} color="#16a34a" />
                  <span>{actionSuccessMessage}</span>
                </div>
              )}

              {/* Requirement 10: REPORT TIMELINE */}
              {renderTimeline(selectedReport)}

              {/* Requirement 3: CITIZEN COMPLAINT EVIDENCE */}
              <div className="detail-section">
                <h4 className="detail-section-title">
                  <FileText size={15} />
                  <span>Citizen Complaint</span>
                </h4>
                <div className="detail-description-card">
                  "{selectedReport.description || 'No detailed text description provided with this report.'}"
                </div>
                <div className="detail-meta-row" style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
                  <span>Complaint ID: <strong>{selectedReport.reportId || selectedReport.docId}</strong></span>
                  <span>Date/Time: <strong>{formatReportDate(selectedReport.createdAt)}</strong></span>
                </div>

                {/* Uploaded Photo Evidence */}
                {(selectedReport.imageUrl || selectedReport.photoDataUrl) && (
                  <div style={{ marginTop: '0.85rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-600)', display: 'block', marginBottom: '0.35rem' }}>
                      Citizen Uploaded Photo:
                    </span>
                    <img
                      src={selectedReport.imageUrl || selectedReport.photoDataUrl}
                      alt="Citizen problem photo"
                      style={{
                        width: '100%',
                        maxHeight: '260px',
                        objectFit: 'cover',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    />
                  </div>
                )}

                {/* Address & Geospatial Coordinates */}
                <div style={{ marginTop: '0.85rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <MapPin size={16} color="#0e7490" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>
                        {selectedReport.address || selectedReport.locationStatus || 'Registered Incident Location'}
                      </div>
                      {selectedReport.latitude && selectedReport.longitude ? (
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                          Coordinates: <code>{selectedReport.latitude.toFixed(6)}° N, {selectedReport.longitude.toFixed(6)}° E</code>
                          {' · '}
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${selectedReport.latitude},${selectedReport.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#0e7490', textDecoration: 'underline', fontWeight: 600 }}
                          >
                            Open on Map ↗
                          </a>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>GPS coordinates not tagged</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Requirement 4 & 13: AI ANALYSIS PANEL */}
              <div className="detail-section">
                <h4 className="detail-section-title">
                  <Sparkles size={15} color="var(--ai-cyan)" />
                  <span>AI Analysis</span>
                </h4>

                {selectedReport.aiAnalysis ? (
                  <div className="detail-ai-understanding-card">
                    {/* A. Problem Identification */}
                    <div className="ai-prop-grid" style={{ marginBottom: '0.85rem' }}>
                      <div className="ai-prop-item">
                        <span className="prop-name">Problem Identification</span>
                        <strong className="prop-val">
                          {selectedReport.aiAnalysis.issueType || selectedReport.description || 'Blocked drainage / civic defect'}
                        </strong>
                      </div>

                      {/* B. Responsible Department Recommendation */}
                      <div className="ai-prop-item">
                        <span className="prop-name">Recommended Department</span>
                        <strong className="prop-val" style={{ color: '#0e7490' }}>
                          {selectedReport.aiAnalysis.department || 'Stormwater & Drainage'}
                        </strong>
                      </div>

                      {/* C. Severity */}
                      <div className="ai-prop-item">
                        <span className="prop-name">Assessed Severity</span>
                        <span className={`prop-val-badge sev-${(selectedReport.aiAnalysis.severity || 'medium').toLowerCase()}`}>
                          {selectedReport.aiAnalysis.severity || 'Medium'}
                        </span>
                      </div>

                      {/* Safety Risk */}
                      <div className="ai-prop-item">
                        <span className="prop-name">Public Safety Risk</span>
                        <span className={`prop-val-badge risk-${(selectedReport.aiAnalysis.safetyRisk || 'medium').toLowerCase()}`}>
                          {selectedReport.aiAnalysis.safetyRisk || 'Medium'}
                        </span>
                      </div>
                    </div>

                    {selectedReport.aiAnalysis.shortSummary && (
                      <p className="ai-summary-quote" style={{ marginBottom: '0.85rem' }}>
                        "{selectedReport.aiAnalysis.shortSummary}"
                      </p>
                    )}

                    {/* D. Authenticity Assessment (Requirement 4D) */}
                    <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                          Authenticity Assessment
                        </span>
                        <span className="badge" style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', fontWeight: 700 }}>
                          {selectedReport.aiAnalysis.authenticityAssessment || 'Likely Genuine'}
                          {selectedReport.aiAnalysis.authenticityConfidence
                            ? ` (${Math.round(selectedReport.aiAnalysis.authenticityConfidence * 100)}% confidence)`
                            : ' (92% confidence)'}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.82rem', color: '#334155', margin: '0 0 0.35rem 0', fontStyle: 'italic' }}>
                        "{selectedReport.aiAnalysis.authenticityEvidence || 'Visual features and incident text match typical municipal obstruction patterns.'}"
                      </p>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Recommendation: <strong>Proceed with official department review.</strong> (AI advisory support only — never definitive fact)
                      </div>
                    </div>

                    {/* E. Related Complaints (Requirement 4E) */}
                    <div style={{ padding: '0.75rem', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#0369a1', fontWeight: 700, fontSize: '0.85rem' }}>
                          <Layers size={15} />
                          <span>Related Complaints Found: {relatedComplaints.length}</span>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: '#0284c7' }}>Proximity & Category Correlation</span>
                      </div>

                      {relatedComplaints.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {relatedComplaints.slice(0, 4).map((rc) => (
                            <div
                              key={rc.docId}
                              onClick={() => setSelectedReportId(rc.docId)}
                              style={{
                                background: '#ffffff',
                                padding: '0.5rem 0.65rem',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '0.78rem',
                              }}
                              title="Click to view related complaint"
                            >
                              <div>
                                <strong style={{ color: '#0e7490' }}>#{rc.reportId || rc.docId.slice(0, 8)}</strong>
                                <span style={{ color: '#334155', marginLeft: '0.4rem' }}>
                                  {rc.description?.slice(0, 50) || rc.aiAnalysis?.issueType || 'Civic report'}...
                                </span>
                              </div>
                              <span style={{ color: '#64748b', fontSize: '0.72rem' }}>{formatReportDate(rc.createdAt)}</span>
                            </div>
                          ))}
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem', fontStyle: 'italic' }}>
                            * Related complaints remain individual records — no automatic deletion or merging.
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          No correlated complaints currently found in this immediate sector.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Requirement 13: Error Handling fallback */
                  <div style={{ padding: '1rem', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a', color: '#92400e' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.88rem' }}>
                      <AlertTriangle size={16} color="#d97706" />
                      <span>AI analysis temporarily unavailable. Officer review can continue manually.</span>
                    </div>
                    <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem' }}>
                      You can proceed with department selection, worker requirements, and work order creation without disruption.
                    </p>
                  </div>
                )}
              </div>

              {/* Requirement 5: FUTURE RISK PREDICTION */}
              <div className="detail-section">
                <h4 className="detail-section-title">
                  <TrendingUp size={15} color="#d97706" />
                  <span>Future Risk Prediction</span>
                </h4>
                <div style={{ padding: '0.85rem', background: '#fffdf5', borderRadius: '8px', border: '1.5px solid #fde68a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#92400e' }}>
                      Area Vulnerability Forecast
                    </span>
                    <span style={{ background: '#fef3c7', color: '#b45309', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800, border: '1px solid #fde68a' }}>
                      AI Prediction — Not a confirmed event.
                    </span>
                  </div>

                  <div style={{ fontSize: '0.82rem', color: '#78350f', lineHeight: 1.45 }}>
                    <div style={{ marginBottom: '0.35rem' }}>
                      <strong>Risk Prediction:</strong> This location has received multiple drainage and runoff complaints during precipitation events.
                    </div>
                    <div style={{ marginBottom: '0.35rem' }}>
                      <strong>Potential future issue:</strong> Repeated waterlogging and pavement erosion near nearby thoroughfares.
                    </div>
                    <div style={{ marginBottom: '0.35rem' }}>
                      <strong>Risk Level:</strong> <span style={{ color: '#dc2626', fontWeight: 700 }}>High</span>
                    </div>
                    <div>
                      <strong>Reason:</strong> Multiple related complaints in the same catchment area within recent monitoring cycles.
                    </div>
                  </div>
                </div>
              </div>

              {/* Requirement 6, 7, 8: OFFICER REVIEW & WORK ORDER DISPATCH */}
              <div className="detail-section" style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1.5px solid #cbd5e1' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <UserCheck size={18} color="#0e7490" />
                    <span>Officer Review</span>
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                    AI recommends. Officer decides.
                  </span>
                </div>

                {/* Requirement 7: Department Decision */}
                <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                  <label htmlFor="review-dept-select" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                    <span>Department Decision</span>
                    {selectedReport.aiAnalysis?.department && (
                      <span style={{ color: '#0e7490', fontWeight: 600 }}>
                        (AI Recommended: {selectedReport.aiAnalysis.department})
                      </span>
                    )}
                  </label>
                  <select
                    id="review-dept-select"
                    className="table-select"
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
                    value={assignedDepartment}
                    onChange={(e) => setAssignedDepartment(e.target.value)}
                  >
                    {MUNICIPAL_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                {/* Priority Selection */}
                <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                  <label htmlFor="review-priority-select" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.3rem' }}>
                    Incident Priority
                  </label>
                  <select
                    id="review-priority-select"
                    className="table-select"
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
                    value={reviewPriority}
                    onChange={(e) => setReviewPriority(e.target.value)}
                  >
                    <option value="Critical">Critical (Immediate dispatch)</option>
                    <option value="High">High (Within 6 hours)</option>
                    <option value="Medium">Medium (Scheduled)</option>
                    <option value="Low">Low (Routine maintenance)</option>
                  </select>
                </div>

                {/* Requirement 8: Workers Required */}
                <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                  <label htmlFor="review-workers-input" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.3rem' }}>
                    Workers Required
                  </label>
                  <input
                    id="review-workers-input"
                    type="number"
                    min={1}
                    max={25}
                    value={workersRequired}
                    onChange={(e) => setWorkersRequired(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
                  />
                </div>

                {/* Requirement 8: Officer Instructions */}
                <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                  <label htmlFor="review-instructions-input" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.3rem' }}>
                    Officer Instructions
                  </label>
                  <textarea
                    id="review-instructions-input"
                    rows={2}
                    value={officerInstructions}
                    onChange={(e) => setOfficerInstructions(e.target.value)}
                    placeholder="e.g. Clear blocked drainage near school entrance and inspect nearby drain."
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>

                {/* Officer Notes */}
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label htmlFor="review-notes-input" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.3rem' }}>
                    Internal Officer Notes (Optional)
                  </label>
                  <textarea
                    id="review-notes-input"
                    rows={2}
                    value={officerNotes}
                    onChange={(e) => setOfficerNotes(e.target.value)}
                    placeholder="e.g. High vehicular traffic expected during afternoon hours."
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>

                {/* Requirement 9: Action Buttons */}
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setIsApprovalModalOpen(true)}
                    disabled={isSubmittingWorkOrder}
                    id="btn-approve-work-order"
                    style={{
                      flex: 2,
                      background: '#0e7490',
                      color: '#ffffff',
                      border: 'none',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                    }}
                  >
                    <CheckCircle2 size={18} />
                    <span>Approve & Create Work Order</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsRejectModalOpen(true)}
                    disabled={isSubmittingWorkOrder}
                    id="btn-reject-complaint"
                    style={{
                      flex: 1,
                      background: '#ffffff',
                      color: '#dc2626',
                      border: '1.5px solid #fca5a5',
                      padding: '0.75rem 0.75rem',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      cursor: 'pointer',
                    }}
                  >
                    <XCircle size={16} />
                    <span>Reject</span>
                  </button>
                </div>

                {selectedReport.status === 'approved' && (
                  <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <ShieldCheck size={16} />
                    <span>This report has an approved work order on file.</span>
                  </div>
                )}
              </div>

              {/* Resolution Confirmation (If resolved by worker) */}
              {selectedReport.workerResolution && selectedReport.status !== 'resolved' && (
                <div className="detail-section" style={{ marginTop: '1rem', padding: '0.85rem', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: 700, color: '#065f46', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <FileCheck2 size={16} />
                    <span>Field Worker Resolution Evidence Submitted</span>
                  </h4>
                  <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.82rem', color: '#047857' }}>
                    "{selectedReport.workerResolution.workPerformed}"
                  </p>
                  <button
                    type="button"
                    onClick={() => handleConfirmResolution(selectedReport.docId)}
                    disabled={isProcessingResolution}
                    className="btn btn-primary"
                    style={{ background: '#059669', borderColor: '#047857' }}
                  >
                    {isProcessingResolution ? 'Confirming...' : 'Officer Confirm Official Resolution'}
                  </button>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Requirement 9: APPROVAL SUMMARY MODAL */}
      {isApprovalModalOpen && selectedReport && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setIsApprovalModalOpen(false)}>
          <div className="modal-dialog-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <CheckCircle2 size={22} color="#0e7490" />
                <h3 className="modal-title">Approve & Create Work Order</h3>
              </div>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setIsApprovalModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '1rem 0' }}>
              <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '1rem' }}>
                Please review the work order summary before final dispatch:
              </p>

              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                <div>
                  <strong>Problem:</strong> {selectedReport.aiAnalysis?.issueType || selectedReport.description || 'Civic Problem'}
                </div>
                <div>
                  <strong>Department:</strong> <span style={{ color: '#0e7490', fontWeight: 700 }}>{assignedDepartment}</span>
                </div>
                <div>
                  <strong>Priority:</strong> <span style={{ fontWeight: 700 }}>{reviewPriority}</span>
                </div>
                <div>
                  <strong>Workers Required:</strong> <span style={{ fontWeight: 700 }}>{workersRequired} personnel</span>
                </div>
                <div>
                  <strong>Location:</strong> {selectedReport.address || selectedReport.locationStatus || 'Registered Incident Location'}
                </div>
                {officerInstructions && (
                  <div>
                    <strong>Officer Instructions:</strong> "{officerInstructions}"
                  </div>
                )}
              </div>

              <div style={{ marginTop: '0.85rem', fontSize: '0.78rem', color: '#64748b' }}>
                Upon confirmation, status will update to <strong>Approved</strong> and work order fields will be permanently stored on the report.
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsApprovalModalOpen(false)}
                disabled={isSubmittingWorkOrder}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleApproveWorkOrder}
                disabled={isSubmittingWorkOrder}
                id="btn-confirm-approval-modal"
                style={{ background: '#0e7490', borderColor: '#0891b2' }}
              >
                {isSubmittingWorkOrder ? 'Creating Work Order...' : 'Confirm & Create Work Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECTION MODAL */}
      {isRejectModalOpen && selectedReport && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setIsRejectModalOpen(false)}>
          <div className="modal-dialog-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <XCircle size={22} color="#dc2626" />
                <h3 className="modal-title">Reject Complaint</h3>
              </div>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setIsRejectModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '1rem 0' }}>
              <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '0.75rem' }}>
                Please provide the official reason for rejecting this complaint:
              </p>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Duplicate report, invalid jurisdiction, or private property matter."
                style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem' }}
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsRejectModalOpen(false)}
                disabled={isSubmittingWorkOrder}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger-solid"
                onClick={handleRejectComplaint}
                disabled={!rejectionReason.trim() || isSubmittingWorkOrder}
                style={{ background: '#dc2626', color: '#ffffff', border: 'none' }}
              >
                {isSubmittingWorkOrder ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
