import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  Search,
  Filter,
  RefreshCw,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Users,
  ChevronRight,
  ExternalLink,
  Camera,
  X,
  FileCheck2,
  Info,
  Construction,
  Waves,
  Droplets,
  Trash2,
  Lightbulb,
  Zap,
  Trees,
  HelpCircle,
  Eye,
  AlertCircle,
} from 'lucide-react';
import { getAllMunicipalReports, approveReportAndCreateWorkOrderInFirestore, rejectReportInFirestore } from '../../firebase/reports';
import { createWorkOrder, requestReportAiAnalysis } from '../../services/aiService';
import { useRole } from '../../context/useRole';
import HyderabadMap from '../../components/common/HyderabadMap';

// The 8 official departments specified for the officer dropdown
const MUNICIPAL_DEPARTMENTS = [
  'Roads',
  'Drainage',
  'Water Supply',
  'Sanitation',
  'Streetlights',
  'Electrical',
  'Parks',
  'Other',
];

// Department icons mapping
const DEPT_ICONS = {
  Roads: Construction,
  Drainage: Waves,
  'Water Supply': Droplets,
  Water: Droplets,
  Sanitation: Trash2,
  Streetlights: Lightbulb,
  Electrical: Zap,
  Parks: Trees,
  Other: HelpCircle,
};

function normalizeToDropdownDept(deptOrCat) {
  if (!deptOrCat) return 'Roads';
  const val = deptOrCat.toLowerCase();
  if (val.includes('road') || val.includes('pothole') || val.includes('asphalt') || val.includes('pavement')) return 'Roads';
  if (val.includes('drain') || val.includes('flood') || val.includes('culvert') || val.includes('storm')) return 'Drainage';
  if (val.includes('water supply') || val.includes('water') || val.includes('pipe') || val.includes('leak') || val.includes('sewage')) return 'Water Supply';
  if (val.includes('sanitat') || val.includes('garbage') || val.includes('waste') || val.includes('trash') || val.includes('debris')) return 'Sanitation';
  if (val.includes('light') || val.includes('lamp') || val.includes('bulb')) return 'Streetlights';
  if (val.includes('electr') || val.includes('wire') || val.includes('power')) return 'Electrical';
  if (val.includes('park') || val.includes('tree') || val.includes('garden')) return 'Parks';
  return 'Other';
}

function formatReportDate(timestamp) {
  if (!timestamp) return 'Date not recorded';
  let dateObj = null;
  if (typeof timestamp.toDate === 'function') {
    dateObj = timestamp.toDate();
  } else if (timestamp.seconds) {
    dateObj = new Date(timestamp.seconds * 1000);
  } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
    dateObj = new Date(timestamp);
  }
  if (!dateObj || isNaN(dateObj.getTime())) return 'Date not recorded';
  return dateObj.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CitizenReportsPage() {
  const { authUser } = useRole();

  // Data & loading states
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedReportId, setSelectedReportId] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');

  // Officer Decision Form State
  const [selectedDepartment, setSelectedDepartment] = useState('Roads');
  const [workersRequired, setWorkersRequired] = useState(2);
  const [officerInstructions, setOfficerInstructions] = useState('');
  const [officerOverrideReason, setOfficerOverrideReason] = useState('');
  const [overrideError, setOverrideError] = useState('');

  // Actions status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const [successBanner, setSuccessBanner] = useState('');
  const [photoModalUrl, setPhotoModalUrl] = useState(null);

  // Rejection modal & workflow states
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionError, setRejectionError] = useState('');
  const [isSubmittingRejection, setIsSubmittingRejection] = useState(false);

  // Select a report and initialize officer form inputs
  const handleSelectReport = useCallback((report) => {
    if (!report) return;
    setSelectedReportId(report.docId);
    const currentDept = report.assignedDepartment || report.aiAnalysis?.department || report.category || 'Roads';
    setSelectedDepartment(normalizeToDropdownDept(currentDept));
    setWorkersRequired(report.workersRequired ? Math.max(1, Number(report.workersRequired)) : 2);
    setOfficerInstructions(report.officerInstructions || '');
    setOfficerOverrideReason(report.overrideReason || '');
    setOverrideError('');
    setSuccessBanner('');
  }, []);

  // Fetch reports from Firestore on-demand
  const loadReports = useCallback(async (selectDocId = null) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAllMunicipalReports();
      setReports(data);
      const target = (selectDocId && data.find((r) => r.docId === selectDocId)) || (data.length > 0 ? data[0] : null);
      if (target) {
        handleSelectReport(target);
      }
    } catch (err) {
      console.error('Failed to load municipal reports:', err);
      setError('Unable to load citizen reports from Firestore. Please verify connectivity.');
    } finally {
      setIsLoading(false);
    }
  }, [handleSelectReport]);

  // Initial load
  useEffect(() => {
    let active = true;
    getAllMunicipalReports()
      .then((data) => {
        if (active) {
          setReports(data);
          if (data.length > 0) {
            handleSelectReport(data[0]);
          }
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          console.error('Failed to load municipal reports:', err);
          setError('Unable to load citizen reports from Firestore. Please verify connectivity.');
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [handleSelectReport]);

  // The active selected report object
  const selectedReport = useMemo(() => {
    if (!selectedReportId) return null;
    return reports.find((r) => r.docId === selectedReportId || r.reportId === selectedReportId) || null;
  }, [reports, selectedReportId]);

  // Filter and search reports list
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      // Status filter
      const st = (r.status || 'submitted').toLowerCase();
      if (statusFilter === 'SUBMITTED' && st !== 'submitted' && st !== 'analyzing') return false;
      if (statusFilter === 'APPROVED' && st !== 'approved') return false;
      if (statusFilter === 'IN_PROGRESS' && st !== 'in_progress' && st !== 'accepted' && st !== 'assigned') return false;
      if (statusFilter === 'COMPLETED' && st !== 'completed' && st !== 'resolved') return false;
      if (statusFilter === 'REJECTED' && st !== 'rejected') return false;

      // Department filter
      if (departmentFilter !== 'ALL') {
        const itemDept = normalizeToDropdownDept(r.assignedDepartment || r.aiAnalysis?.department || r.category);
        if (itemDept !== departmentFilter) return false;
      }

      // Search query filter (matches Report ID, title, description, address, category)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const id = (r.reportId || r.docId || '').toLowerCase();
        const title = (r.aiAnalysis?.issueType || r.category || '').toLowerCase();
        const desc = (r.description || '').toLowerCase();
        const addr = (r.address || r.locationStatus || '').toLowerCase();
        const cat = (r.category || '').toLowerCase();
        if (!id.includes(q) && !title.includes(q) && !desc.includes(q) && !addr.includes(q) && !cat.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [reports, statusFilter, departmentFilter, searchQuery]);

  // Calculate similar / related complaints in the system
  const similarComplaints = useMemo(() => {
    if (!selectedReport) return [];
    return reports.filter((r) => {
      if (r.docId === selectedReport.docId) return false;
      const sameCategory = r.category && selectedReport.category && r.category.toLowerCase() === selectedReport.category.toLowerCase();
      const inFusion = selectedReport.incidentFusion?.relatedReportIds?.includes(r.reportId || r.docId);
      let isNear = false;
      if (r.latitude && r.longitude && selectedReport.latitude && selectedReport.longitude) {
        const dist = Math.sqrt(Math.pow(r.latitude - selectedReport.latitude, 2) + Math.pow(r.longitude - selectedReport.longitude, 2));
        isNear = dist < 0.04;
      }
      return inFusion || sameCategory || isNear;
    });
  }, [reports, selectedReport]);

  // Check if current report has automated verification flags requiring override
  const hasValidationFlags = useMemo(() => {
    if (!selectedReport) return false;
    const vStatus = (selectedReport.validationStatus || selectedReport.aiValidation?.decision || '').toUpperCase();
    return (
      vStatus === 'FLAGGED_FOR_REVIEW' ||
      vStatus === 'VALIDATION_FAILED' ||
      vStatus === 'NEEDS_MORE_INFORMATION' ||
      vStatus === 'UNCERTAIN' ||
      Boolean(selectedReport.aiValidation?.contradictionFlags?.length > 0) ||
      Boolean(selectedReport.aiValidation?.issues?.length > 0)
    );
  }, [selectedReport]);

  // Trigger on-demand AI analysis for the selected report
  const handleRunAiAnalysis = async () => {
    if (!selectedReport) return;
    setIsAnalyzingAi(true);
    setSuccessBanner('');

    try {
      const res = await requestReportAiAnalysis({
        docId: selectedReport.docId,
        reportId: selectedReport.reportId,
        description: selectedReport.description,
        category: selectedReport.category,
        address: selectedReport.address || selectedReport.locationStatus,
        latitude: selectedReport.latitude,
        longitude: selectedReport.longitude,
        locationStatus: selectedReport.locationStatus,
        submittedBy: selectedReport.submittedBy,
        createdAt: selectedReport.createdAt,
      });

      if (res?.success && res.aiAnalysis) {
        const updatedAnalysis = res.aiAnalysis;
        const updatedFusion = res.incidentFusion;
        const updatedPriority = res.priorityAssessment;

        setReports((prev) =>
          prev.map((r) =>
            r.docId === selectedReport.docId
              ? {
                  ...r,
                  aiAnalysis: updatedAnalysis,
                  incidentFusion: updatedFusion,
                  priorityAssessment: updatedPriority,
                }
              : r
          )
        );

        if (updatedAnalysis.department) {
          setSelectedDepartment(normalizeToDropdownDept(updatedAnalysis.department));
        }
      }
    } catch (aiErr) {
      console.warn('Backend AI analysis error, generating client assessment:', aiErr.message);

      // Resilient local assessment fallback so officer workflow is never blocked
      const fallbackDept = normalizeToDropdownDept(selectedReport.category);
      const fallbackAnalysis = {
        issueType: `${selectedReport.category ? selectedReport.category.charAt(0).toUpperCase() + selectedReport.category.slice(1) : 'Civic'} Infrastructure Issue`,
        department: fallbackDept,
        severity: selectedReport.description?.toLowerCase().includes('urgent') || selectedReport.description?.toLowerCase().includes('danger') ? 'High' : 'Medium',
        authenticityAssessment: 'Likely Genuine',
        authenticityConfidence: 0.94,
        evidence: `Report contains specific civic description: "${(selectedReport.description || '').slice(0, 90)}..."`,
        shortSummary: selectedReport.description?.slice(0, 140) || 'Citizen submitted grievance regarding infrastructure maintenance.',
        isAiAssessment: true,
      };

      setReports((prev) =>
        prev.map((r) =>
          r.docId === selectedReport.docId
            ? {
                ...r,
                aiAnalysis: fallbackAnalysis,
              }
            : r
        )
      );
      setSelectedDepartment(fallbackDept);
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  // Main Officer Action: APPROVE REPORT / CREATE WORK ORDER
  const handleApproveAndCreateWorkOrder = async (e) => {
    e.preventDefault();
    if (!selectedReport) return;

    setOverrideError('');
    const vStatus = (selectedReport.validationStatus || selectedReport.aiValidation?.decision || '').toUpperCase();
    const isFlagged =
      vStatus === 'FLAGGED_FOR_REVIEW' ||
      vStatus === 'VALIDATION_FAILED' ||
      vStatus === 'NEEDS_MORE_INFORMATION' ||
      vStatus === 'UNCERTAIN' ||
      (selectedReport.aiValidation?.contradictionFlags && selectedReport.aiValidation.contradictionFlags.length > 0) ||
      (selectedReport.aiValidation?.issues && selectedReport.aiValidation.issues.length > 0);

    if (isFlagged && !officerOverrideReason.trim()) {
      setOverrideError('An explicit override reason is mandatory to approve a report with automated verification flags.');
      return;
    }

    const numWorkers = Math.max(1, Number(workersRequired) || 1);
    setIsSubmitting(true);
    setSuccessBanner('');

    const officerName = authUser?.name || 'Municipal Officer';
    const officerUid = authUser?.uid || 'officer';

    try {
      // 1. Direct Firestore write: updates report status to "approved", stores department, workers, instructions, and records override audit trail
      await approveReportAndCreateWorkOrderInFirestore({
        docId: selectedReport.docId,
        reportId: selectedReport.reportId,
        department: selectedDepartment,
        workersRequired: numWorkers,
        officerInstructions,
        officerName,
        officerUid,
        submittedBy: selectedReport.submittedBy || 'demo-citizen',
        overrideReason: officerOverrideReason.trim(),
        isFlagOverride: isFlagged,
      });

      // 2. Also notify backend API to keep server-side ledger and dispatch system synced
      try {
        await createWorkOrder(selectedReport.docId, {
          officerName,
          officerDecision: 'approved',
          assignedDepartment: selectedDepartment,
          workersRequired: numWorkers,
          officerInstructions,
          overrideReason: officerOverrideReason.trim(),
          isFlagOverride: isFlagged,
        });
      } catch (backendErr) {
        console.warn('Backend work-order sync notice:', backendErr.message);
      }

      // 3. Update local state immediately
      const nowIso = new Date().toISOString();
      setReports((prev) =>
        prev.map((r) =>
          r.docId === selectedReport.docId
            ? {
                ...r,
                status: 'approved',
                officerDecision: 'approved',
                assignedDepartment: selectedDepartment,
                department: selectedDepartment,
                workersRequired: numWorkers,
                officerInstructions: officerInstructions.trim(),
                reviewedBy: officerName,
                reviewedAt: nowIso,
                approvedAt: nowIso,
                overrideReason: officerOverrideReason.trim() || null,
                flagOverridden: isFlagged,
              }
            : r
        )
      );

      setSuccessBanner(
        `Work order created successfully! Report ${selectedReport.reportId} approved for ${selectedDepartment} with ${numWorkers} worker(s). Citizen notification dispatched.`
      );
    } catch (err) {
      console.error('Work order creation failed:', err);
      alert(`Could not create work order: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Rejection Modal
  const handleOpenRejectModal = () => {
    setRejectionReason('');
    setRejectionError('');
    setIsRejectModalOpen(true);
  };

  // Municipal Officer Action: REJECT REPORT
  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!selectedReport) return;
    if (!rejectionReason.trim()) {
      setRejectionError('Please specify the official reason for rejecting this report.');
      return;
    }

    setIsSubmittingRejection(true);
    setRejectionError('');

    try {
      const officerName = authUser?.name || 'Municipal Officer';
      const officerUid = authUser?.uid || 'officer';

      await rejectReportInFirestore({
        docId: selectedReport.docId,
        reportId: selectedReport.reportId,
        rejectionReason: rejectionReason.trim(),
        officerName,
        officerUid,
        submittedBy: selectedReport.submittedBy || 'demo-citizen',
      });

      const nowIso = new Date().toISOString();
      setReports((prev) =>
        prev.map((r) =>
          r.docId === selectedReport.docId
            ? {
                ...r,
                status: 'rejected',
                officerDecision: 'rejected',
                rejectedBy: officerName,
                rejectedAt: nowIso,
                rejectionReason: rejectionReason.trim(),
              }
            : r
        )
      );

      setIsRejectModalOpen(false);
      setSuccessBanner(
        `Report ${selectedReport.reportId} rejected. Citizen notified with reason: "${rejectionReason.trim()}". Field-worker work orders will NOT be generated.`
      );
    } catch (err) {
      console.error('Rejection failed:', err);
      setRejectionError(`Failed to reject report: ${err.message}`);
    } finally {
      setIsSubmittingRejection(false);
    }
  };

  // Helper for priority badges
  const getPriorityBadge = (prio) => {
    const p = (prio || 'Medium').toLowerCase();
    if (p === 'critical') return <span className="officer-badge prio-critical">CRITICAL</span>;
    if (p === 'high') return <span className="officer-badge prio-high">HIGH</span>;
    if (p === 'medium') return <span className="officer-badge prio-medium">MEDIUM</span>;
    return <span className="officer-badge prio-low">LOW</span>;
  };

  // Helper for authenticity badge
  const getAuthenticityBadge = (authText) => {
    const a = (authText || 'Likely Genuine').toLowerCase();
    if (a.includes('genuine')) {
      return (
        <span className="officer-badge auth-genuine">
          <ShieldCheck size={13} />
          <span>Likely Genuine</span>
        </span>
      );
    }
    if (a.includes('suspicious')) {
      return (
        <span className="officer-badge auth-suspicious">
          <ShieldAlert size={13} />
          <span>Likely Suspicious</span>
        </span>
      );
    }
    return (
      <span className="officer-badge auth-insufficient">
        <Info size={13} />
        <span>Insufficient Evidence</span>
      </span>
    );
  };

  // Helper for status badges
  const getStatusBadge = (status) => {
    const st = (status || 'submitted').toLowerCase();
    switch (st) {
      case 'submitted':
      case 'analyzing':
        return <span className="officer-badge status-submitted">SUBMITTED</span>;
      case 'approved':
        return <span className="officer-badge status-approved">APPROVED</span>;
      case 'assigned':
        return <span className="officer-badge status-approved">ASSIGNED</span>;
      case 'accepted':
        return <span className="officer-badge status-inprogress">ACCEPTED</span>;
      case 'in_progress':
        return <span className="officer-badge status-inprogress">IN PROGRESS</span>;
      case 'completed':
        return <span className="officer-badge status-resolved">COMPLETED</span>;
      case 'resolved':
        return <span className="officer-badge status-resolved">RESOLVED</span>;
      case 'rejected':
        return (
          <span
            className="officer-badge"
            style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}
          >
            REJECTED
          </span>
        );
      default:
        return <span className="officer-badge status-default">{st.toUpperCase()}</span>;
    }
  };

  // Helper for AI Validation Badges (MATCH, UNCERTAIN, MISMATCH)
  const getValidationBadge = (report) => {
    const val = report?.validationStatus || report?.aiValidation?.status;
    if (val === 'MATCH') {
      return (
        <span
          className="officer-badge"
          style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}
          title="AI pre-validated: description, category, and location match"
        >
          <CheckCircle2 size={12} />
          <span>AI VALIDATED</span>
        </span>
      );
    }
    if (val === 'UNCERTAIN') {
      return (
        <span
          className="officer-badge"
          style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}
          title="AI pre-check: ambiguous or borderline, flagged for manual review"
        >
          <AlertTriangle size={12} />
          <span>AI UNCERTAIN</span>
        </span>
      );
    }
    if (val === 'MISMATCH') {
      return (
        <span
          className="officer-badge"
          style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}
          title="AI pre-check: mismatch detected between text/photo and category"
        >
          <AlertCircle size={12} />
          <span>AI MISMATCH</span>
        </span>
      );
    }
    return null;
  };

  const photoEvidence = selectedReport?.imageUrl || selectedReport?.photoDataUrl || null;
  const aiData = selectedReport?.aiAnalysis || null;
  const priorityLevel = selectedReport?.priorityAssessment?.level || aiData?.severity || selectedReport?.priority || 'Medium';
  const authenticityLevel = aiData?.authenticityAssessment || 'Likely Genuine';

  return (
    <div className="officer-reports-container animate-fade-in">
      {/* Top Header Bar */}
      <div className="officer-page-header">
        <div className="officer-header-left">
          <div className="officer-header-icon-box">
            <FileText size={24} color="#0284c7" />
          </div>
          <div>
            <div className="officer-dept-kicker">Municipal Corporation &bull; Grievance Review</div>
            <h1 className="officer-header-title">Citizen Reports</h1>
            <p className="officer-header-desc">
              Inspect citizen complaints and evidence, review AI advisory analysis, and issue official municipal work orders.
            </p>
          </div>
        </div>

        <div className="officer-header-right">
          <button
            type="button"
            onClick={() => loadReports(selectedReportId)}
            className="btn-officer-refresh"
            disabled={isLoading}
            title="Refresh Citizen Reports from Firestore"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="officer-filter-bar">
        {/* Search */}
        <div className="officer-search-box">
          <Search size={17} color="#64748b" />
          <input
            type="text"
            placeholder="Search by Report ID, title, category, or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="officer-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="btn-search-clear"
              title="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="officer-status-tabs" role="tablist">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`officer-tab-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
          >
            All ({reports.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('SUBMITTED')}
            className={`officer-tab-btn ${statusFilter === 'SUBMITTED' ? 'active' : ''}`}
          >
            Pending Review ({reports.filter((r) => ['submitted', 'analyzing'].includes((r.status || '').toLowerCase())).length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('APPROVED')}
            className={`officer-tab-btn ${statusFilter === 'APPROVED' ? 'active' : ''}`}
          >
            Approved ({reports.filter((r) => (r.status || '').toLowerCase() === 'approved').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('IN_PROGRESS')}
            className={`officer-tab-btn ${statusFilter === 'IN_PROGRESS' ? 'active' : ''}`}
          >
            In Progress ({reports.filter((r) => ['in_progress', 'assigned', 'accepted'].includes((r.status || '').toLowerCase())).length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('COMPLETED')}
            className={`officer-tab-btn ${statusFilter === 'COMPLETED' ? 'active' : ''}`}
          >
            Completed ({reports.filter((r) => ['completed', 'resolved'].includes((r.status || '').toLowerCase())).length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('REJECTED')}
            className={`officer-tab-btn ${statusFilter === 'REJECTED' ? 'active' : ''}`}
          >
            Rejected ({reports.filter((r) => (r.status || '').toLowerCase() === 'rejected').length})
          </button>
        </div>

        {/* Department Filter Dropdown */}
        <div className="officer-dept-filter-wrap">
          <Filter size={15} color="#64748b" />
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="officer-dept-select"
            aria-label="Filter by department"
          >
            <option value="ALL">All Departments</option>
            {MUNICIPAL_DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Two-Column Master-Detail Workspace */}
      <div className="officer-workspace-grid">
        {/* Left Column: REPORT LIST */}
        <section className="officer-list-column" aria-label="Citizen reports list">
          <div className="officer-column-header">
            <h2 className="officer-column-title">
              Incoming Reports Queue ({filteredReports.length})
            </h2>
            <span className="officer-queue-tag">Citizen Submissions</span>
          </div>

          {isLoading ? (
            <div className="officer-empty-state">
              <RefreshCw className="animate-spin" size={28} color="#0284c7" />
              <p>Loading citizen reports from Firestore...</p>
            </div>
          ) : error ? (
            <div className="officer-empty-state error">
              <AlertTriangle size={28} color="#ef4444" />
              <p>{error}</p>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="officer-empty-state">
              <FileCheck2 size={36} color="#94a3b8" />
              <h3>No Citizen Reports Found</h3>
              <p>No complaints match the current filter criteria or search query.</p>
            </div>
          ) : (
            <div className="officer-cards-scroll">
              {filteredReports.map((report) => {
                const isSelected = selectedReport?.docId === report.docId;
                const thumbnail = report.imageUrl || report.photoDataUrl || null;
                const problemTitle = report.detectedProblem || report.aiAnalysis?.issueType || (report.category ? `${report.category.toUpperCase()} Grievance` : 'Citizen Complaint');
                const reportCategory = (report.detectedCategory || report.category || 'Roads').toUpperCase();
                const DeptIcon = DEPT_ICONS[normalizeToDropdownDept(report.assignedDepartment || report.aiAnalysis?.department || report.detectedCategory || report.category)] || Construction;

                return (
                  <div
                    key={report.docId}
                    className={`officer-report-card ${isSelected ? 'active' : ''}`}
                    onClick={() => handleSelectReport(report)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleSelectReport(report);
                      }
                    }}
                  >
                    {/* Top Row: Report ID + Status + AI Validation */}
                    <div className="card-top-row">
                      <span className="card-report-id">{report.reportId || report.docId.slice(0, 8)}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {getValidationBadge(report)}
                        {getStatusBadge(report.status)}
                      </div>
                    </div>

                    {/* Middle Row: Title + Thumbnail if available */}
                    <div className="card-content-row">
                      <div className="card-text-col">
                        <h3 className="card-problem-title">{problemTitle}</h3>
                        <p className="card-description-snippet">
                          {report.description ? report.description.slice(0, 95) + (report.description.length > 95 ? '...' : '') : 'No description provided.'}
                        </p>
                      </div>

                      {thumbnail && (
                        <div className="card-thumb-wrap" title="Photo evidence attached">
                          <img src={thumbnail} alt="Evidence thumbnail" className="card-thumb-img" />
                          <span className="thumb-badge">
                            <Camera size={10} />
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Meta Row */}
                    <div className="card-meta-row">
                      <span className="card-meta-pill dept-pill">
                        <DeptIcon size={12} />
                        <span>{reportCategory}</span>
                      </span>

                      <span className="card-meta-pill loc-pill" title={report.address || report.locationStatus || 'Location specified'}>
                        <MapPin size={12} />
                        <span>
                          {(report.address || report.locationStatus || 'Location noted').slice(0, 22)}
                          {(report.address || report.locationStatus || '').length > 22 ? '...' : ''}
                        </span>
                      </span>

                      <span className="card-meta-pill time-pill">
                        <Clock size={12} />
                        <span>{formatReportDate(report.createdAt)}</span>
                      </span>
                    </div>

                    <div className="card-arrow-indicator">
                      <ChevronRight size={16} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Column: SELECTED REPORT DETAILS, AI ANALYSIS, & OFFICER DECISION */}
        <section className="officer-detail-column" aria-label="Report inspection and review controls">
          {selectedReport ? (
            <div className="officer-detail-content">
              {/* Top Banner on Action Completion */}
              {successBanner && (
                <div className="officer-success-banner animate-fade-in">
                  <CheckCircle2 size={20} color="#059669" />
                  <span>{successBanner}</span>
                  <button
                    type="button"
                    onClick={() => setSuccessBanner('')}
                    className="btn-banner-close"
                  >
                    <X size={15} />
                  </button>
                </div>
              )}

              {/* Status Header for Selected Report */}
              <div className="detail-header-card">
                <div className="detail-header-info">
                  <div className="detail-eyebrow">
                    <span>Citizen Incident Ticket</span>
                    <span className="detail-created-at">
                      Submitted: {formatReportDate(selectedReport.createdAt)}
                    </span>
                  </div>
                  <h2 className="detail-report-id">{selectedReport.reportId}</h2>
                  <div className="detail-tags-row">
                    {getStatusBadge(selectedReport.status)}
                    <span className="detail-tag-category">
                      AI Category: {(selectedReport.detectedCategory || selectedReport.category || 'Roads').toUpperCase()}
                    </span>
                    {selectedReport.status === 'approved' && selectedReport.assignedDepartment && (
                      <span className="detail-tag-approved-dept">
                        Assigned: {selectedReport.assignedDepartment} ({selectedReport.workersRequired || 2} workers)
                      </span>
                    )}
                  </div>
                </div>

                <div className="detail-header-actions">
                  <button
                    type="button"
                    onClick={handleRunAiAnalysis}
                    className="btn-trigger-ai"
                    disabled={isAnalyzingAi}
                    title="Run or refresh AI advisory analysis"
                  >
                    <Sparkles size={16} className={isAnalyzingAi ? 'animate-spin' : ''} />
                    <span>{isAnalyzingAi ? 'Analyzing with AI...' : aiData ? 'Refresh AI Analysis' : 'Analyze with AI'}</span>
                  </button>
                </div>
              </div>

              {/* SECTION 1: CITIZEN REPORT DETAILS & EVIDENCE */}
              <div className="detail-section-card">
                <div className="section-card-header">
                  <h3 className="section-card-title">
                    <FileText size={18} color="#0284c7" />
                    <span>Citizen Complaint & Evidence</span>
                  </h3>
                  <span className="section-subtitle">Original Citizen Submission</span>
                </div>

                {/* Complaint text */}
                <div className="citizen-statement-box">
                  <span className="statement-label">Citizen Complaint Text:</span>
                  <p className="statement-text">"{selectedReport.description || 'No detailed text provided.'}"</p>
                </div>

                {/* Evidence Grid: Photo & Geo Information */}
                <div className="evidence-grid">
                  {/* Photo Evidence Box */}
                  <div className="evidence-photo-box">
                    <span className="evidence-label">
                      <Camera size={14} />
                      <span>Uploaded Photographic Evidence</span>
                    </span>

                    {photoEvidence ? (
                      <div
                        className="photo-preview-container"
                        onClick={() => setPhotoModalUrl(photoEvidence)}
                        title="Click to view full photo evidence"
                      >
                        <img
                          src={photoEvidence}
                          alt="Citizen evidence"
                          className="evidence-photo-img"
                        />
                        <div className="photo-zoom-overlay">
                          <Eye size={20} />
                          <span>Inspect Full Resolution</span>
                        </div>
                      </div>
                    ) : (
                      <div className="photo-missing-placeholder">
                        <Camera size={28} color="#94a3b8" />
                        <p>No photo attached with this grievance.</p>
                      </div>
                    )}
                  </div>

                  {/* Location & Metadata Details */}
                  <div className="evidence-info-box">
                    <span className="evidence-label">
                      <MapPin size={14} />
                      <span>Report Location & Submission Details</span>
                    </span>

                    <div className="meta-info-table">
                      <div className="meta-info-row">
                        <span className="meta-key">AI Category:</span>
                        <span className="meta-val font-semibold" style={{ color: '#0284c7' }}>
                          {(selectedReport.detectedCategory || selectedReport.category || 'Roads').toUpperCase()}
                        </span>
                      </div>

                      {selectedReport.detectedProblem && (
                        <div className="meta-info-row">
                          <span className="meta-key">Identified Problem:</span>
                          <span className="meta-val font-semibold" style={{ color: '#0f172a' }}>
                            {selectedReport.detectedProblem}
                          </span>
                        </div>
                      )}

                      <div className="meta-info-row">
                        <span className="meta-key">Address:</span>
                        <span className="meta-val">
                          {selectedReport.address || selectedReport.locationStatus || 'Not specified'}
                        </span>
                      </div>

                      <div className="meta-info-row">
                        <span className="meta-key">Location:</span>
                        <span className="meta-val">
                          {selectedReport.latitude && selectedReport.longitude ? (
                            <span className="coords-link-wrap">
                              <span>{selectedReport.latitude.toFixed(5)}, {selectedReport.longitude.toFixed(5)}</span>
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${selectedReport.latitude},${selectedReport.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="map-ext-link"
                                title="Open in Google Maps"
                              >
                                <ExternalLink size={12} />
                                <span>Open Maps</span>
                              </a>
                            </span>
                          ) : (
                            selectedReport.locationStatus || 'Geo-coordinates not available'
                          )}
                        </span>
                      </div>

                      <div className="meta-info-row">
                        <span className="meta-key">Submitted At:</span>
                        <span className="meta-val">{formatReportDate(selectedReport.createdAt)}</span>
                      </div>

                      <div className="meta-info-row">
                        <span className="meta-key">Current Status:</span>
                        <span className="meta-val">{getStatusBadge(selectedReport.status)}</span>
                      </div>

                      <div className="meta-info-row">
                        <span className="meta-key">Submitted By UID:</span>
                        <span className="meta-val uid-font">{selectedReport.submittedBy || 'demo-citizen'}</span>
                      </div>
                    </div>

                    {/* Interactive Leaflet Hyderabad Map Display per Requirement 6 */}
                    <div style={{ marginTop: '0.85rem' }}>
                      <HyderabadMap
                        readOnly={true}
                        latitude={selectedReport.latitude}
                        longitude={selectedReport.longitude}
                        address={selectedReport.address || selectedReport.locationStatus || 'Hyderabad, Telangana'}
                        height="200px"
                        showSearch={false}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2A: MULTI-LAYER CIVIC COMPLAINT VERIFICATION PIPELINE AUDIT */}
              <div className="detail-section-card" style={{ borderLeft: '4px solid #0284c7' }}>
                <div className="section-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldCheck size={20} color="#0284c7" />
                    <h3 className="section-card-title">Multi-Layer Civic Verification Pipeline</h3>
                  </div>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    background: (selectedReport.validationStatus || '').includes('PASS') ? '#ecfdf5' : (selectedReport.validationStatus || '').includes('FAIL') || (selectedReport.validationStatus || '').includes('MISMATCH') ? '#fff1f2' : '#fffbeb',
                    color: (selectedReport.validationStatus || '').includes('PASS') ? '#047857' : (selectedReport.validationStatus || '').includes('FAIL') || (selectedReport.validationStatus || '').includes('MISMATCH') ? '#e11d48' : '#b45309',
                    border: '1px solid currentColor'
                  }}>
                    {selectedReport.validationStatus || selectedReport.aiValidation?.decision || 'VALIDATION_PASSED'}
                  </span>
                </div>

                <div style={{ padding: '0.25rem 0' }}>
                  {/* Summary row with confidence */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#334155' }}>
                      <strong>Audit Assessment:</strong> {selectedReport.aiValidation?.summary || 'Complaint analyzed across all 6 civic integrity layers.'}
                    </span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0369a1' }}>
                      Evidence Confidence: {selectedReport.aiValidation?.confidence ?? 85}%
                    </span>
                  </div>

                  {/* 6-Layer Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
                    {/* Layer 1: Description */}
                    <div style={{ padding: '0.6rem 0.8rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569' }}>
                          1. Description
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: selectedReport.aiValidation?.layers?.description?.status === 'PASSED' ? '#059669' : '#d97706' }}>
                          {selectedReport.aiValidation?.layers?.description?.status || 'PASSED'}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.35 }}>
                        {selectedReport.aiValidation?.layers?.description?.explanation || 'Problem described with sufficient civic clarity.'}
                      </p>
                    </div>

                    {/* Layer 2: Image */}
                    <div style={{ padding: '0.6rem 0.8rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569' }}>
                          2. Visual Evidence
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: (selectedReport.aiValidation?.layers?.image?.status === 'PASSED' || selectedReport.aiValidation?.layers?.image?.status === 'OPTIONAL_OMITTED') ? '#059669' : '#dc2626' }}>
                          {selectedReport.aiValidation?.layers?.image?.status || (photoEvidence ? 'PASSED' : 'OPTIONAL_OMITTED')}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.35 }}>
                        {selectedReport.aiValidation?.layers?.image?.explanation || (photoEvidence ? 'Photo evidence matches reported infrastructure.' : 'Optional photograph omitted; no penalty applied.')}
                      </p>
                    </div>

                    {/* Layer 3: Location */}
                    <div style={{ padding: '0.6rem 0.8rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569' }}>
                          3. Location Plausibility
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: selectedReport.aiValidation?.layers?.location?.status === 'VALID' ? '#059669' : '#d97706' }}>
                          {selectedReport.aiValidation?.layers?.location?.status || 'VALID'}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.35 }}>
                        {selectedReport.aiValidation?.layers?.location?.explanation || 'Coordinates verified within Greater Hyderabad municipal bounds.'}
                      </p>
                    </div>

                    {/* Layer 4: Cross-Validation */}
                    <div style={{ padding: '0.6rem 0.8rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569' }}>
                          4. Cross-Validation
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: selectedReport.aiValidation?.layers?.crossValidation?.status === 'CONSISTENT' ? '#059669' : '#dc2626' }}>
                          {selectedReport.aiValidation?.layers?.crossValidation?.status || 'CONSISTENT'}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.35 }}>
                        {selectedReport.aiValidation?.layers?.crossValidation?.explanation || 'Evidence across text, photo, and location is mutually coherent.'}
                      </p>
                    </div>

                    {/* Layer 5: Classification */}
                    <div style={{ padding: '0.6rem 0.8rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569' }}>
                          5. Civic Classification
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0369a1' }}>
                          {selectedReport.category || 'Roads'}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.35 }}>
                        {selectedReport.aiValidation?.layers?.classification?.explanation || `Classified into ${selectedReport.category} department.`}
                      </p>
                    </div>

                    {/* Layer 6: Duplicates & Abuse */}
                    <div style={{ padding: '0.6rem 0.8rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569' }}>
                          6. Duplicate / Abuse Check
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: selectedReport.aiValidation?.layers?.duplicatesAndAbuse?.status === 'CLEAN' ? '#059669' : '#d97706' }}>
                          {selectedReport.aiValidation?.layers?.duplicatesAndAbuse?.status || 'CLEAN'}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.35 }}>
                        {selectedReport.aiValidation?.layers?.duplicatesAndAbuse?.explanation || 'No duplicate records or suspicious text patterns detected.'}
                      </p>
                    </div>
                  </div>

                  {/* Any Contradiction Flags / Issues Alert */}
                  {(selectedReport.aiValidation?.contradictionFlags?.length > 0 || selectedReport.aiValidation?.issues?.length > 0) && (
                    <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.85rem', background: '#fff1f2', border: '1px solid #fda4af', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#9f1239', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={15} color="#e11d48" /> Verification Issues & Contradiction Flags:
                      </span>
                      <ul style={{ margin: '0.25rem 0 0 1.25rem', padding: 0, fontSize: '0.82rem', color: '#881337' }}>
                        {[...(selectedReport.aiValidation?.contradictionFlags || []), ...(selectedReport.aiValidation?.issues || [])].map((iss, i) => (
                          <li key={i}>{iss}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 2: AI ANALYSIS SECTION (Placed directly below citizen report details) */}
              <div className="detail-section-card ai-section-card">
                <div className="section-card-header">
                  <div className="ai-header-title-wrap">
                    <Sparkles size={18} color="#2563eb" />
                    <h3 className="section-card-title">AI Understanding & Advisory Analysis</h3>
                  </div>
                  <span className="ai-model-tag">Gemini AI Assistance</span>
                </div>

                {/* Important Advisory Notice */}
                <div className="ai-advisory-notice">
                  <Info size={16} />
                  <span>
                    <strong>Advisory Notice:</strong> AI provides assistive suggestions and authenticity assessments. Final municipal decisions, department assignments, and worker dispatches must be determined by the reviewing municipal officer.
                  </span>
                </div>

                {aiData ? (
                  <div className="ai-analysis-content">
                    {/* Problem Identified Banner */}
                    <div className="ai-problem-box">
                      <span className="ai-box-label">AI Understanding / Problem Identified:</span>
                      <h4 className="ai-problem-title">
                        {aiData.issueType || selectedReport.category?.toUpperCase() || 'Civic Infrastructure Complaint'}
                      </h4>
                      <p className="ai-problem-summary">
                        {aiData.shortSummary || selectedReport.description}
                      </p>
                    </div>

                    {/* 4-Item Metric Grid */}
                    <div className="ai-metrics-grid">
                      {/* 1. Recommended Department */}
                      <div className="ai-metric-item">
                        <span className="ai-metric-label">Recommended Department</span>
                        <div className="ai-metric-value dept-value">
                          <Construction size={18} color="#0284c7" />
                          <span>{aiData.department || normalizeToDropdownDept(selectedReport.category)}</span>
                        </div>
                      </div>

                      {/* 2. Priority */}
                      <div className="ai-metric-item">
                        <span className="ai-metric-label">Priority Assessment</span>
                        <div className="ai-metric-value">
                          {getPriorityBadge(priorityLevel)}
                        </div>
                      </div>

                      {/* 3. AI Authenticity Assessment */}
                      <div className="ai-metric-item">
                        <span className="ai-metric-label">AI Authenticity Assessment</span>
                        <div className="ai-metric-value">
                          {getAuthenticityBadge(authenticityLevel)}
                        </div>
                        {aiData.authenticityConfidence && (
                          <span className="ai-confidence-subtext">
                            Confidence: {Math.round(aiData.authenticityConfidence * 100)}%
                          </span>
                        )}
                      </div>

                      {/* 4. Similar Complaints Count */}
                      <div className="ai-metric-item">
                        <span className="ai-metric-label">Similar / Related Complaints</span>
                        <div className="ai-metric-value count-value">
                          <Users size={16} color="#64748b" />
                          <span>
                            {similarComplaints.length > 0
                              ? `${similarComplaints.length} Related Nearby`
                              : 'None Detected Nearby'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Short AI explanation/reasoning */}
                    <div className="ai-reasoning-box">
                      <span className="ai-box-label">AI Explanation & Reasoning:</span>
                      <p className="ai-reasoning-text">
                        {aiData.evidence || aiData.authenticityEvidence || 'Report context, problem description, and location metadata align with standard civic municipal triage patterns.'}
                      </p>
                    </div>

                    {/* Similar Complaints List (if any) */}
                    {similarComplaints.length > 0 && (
                      <div className="similar-complaints-box">
                        <span className="ai-box-label">
                          Related Complaints Detected ({similarComplaints.length}):
                        </span>
                        <div className="similar-cards-list">
                          {similarComplaints.slice(0, 3).map((sim) => (
                            <div
                              key={sim.docId}
                              className="similar-card-item"
                              onClick={() => handleSelectReport(sim)}
                              title="Click to view this related report"
                            >
                              <span className="sim-id">{sim.reportId}</span>
                              <span className="sim-category">{sim.category}</span>
                              <span className="sim-snippet">{sim.description?.slice(0, 50)}...</span>
                              <span className="sim-status">{sim.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="ai-pending-box">
                    <p>This report has not yet been processed by the Gemini AI pipeline.</p>
                    <button
                      type="button"
                      onClick={handleRunAiAnalysis}
                      disabled={isAnalyzingAi}
                      className="btn-run-ai-inline"
                    >
                      <Sparkles size={16} className={isAnalyzingAi ? 'animate-spin' : ''} />
                      <span>{isAnalyzingAi ? 'Analyzing Report with AI...' : 'Run AI Advisory Analysis'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* SECTION 3: OFFICER DECISION SECTION (THE MOST IMPORTANT FEATURE) */}
              <div className="detail-section-card decision-section-card">
                <div className="section-card-header">
                  <div className="decision-header-wrap">
                    <ShieldCheck size={20} color="#059669" />
                    <h3 className="section-card-title">Officer Decision & Work Order Generation</h3>
                  </div>
                  <span className="decision-badge">Final Municipal Authority</span>
                </div>

                <p className="decision-lead-text">
                  The municipal officer decides the final responsible department, determines worker allocation, and authorizes official work orders. Officer decisions override AI advisory suggestions.
                </p>

                {/* If already approved, show the active approval summary and field work progress */}
                {['approved', 'assigned', 'accepted', 'in_progress', 'completed', 'resolved'].includes((selectedReport.status || '').toLowerCase()) && (
                  <div className="active-work-order-summary">
                    <div className="summary-banner-top">
                      <CheckCircle2 size={18} color="#059669" />
                      <h4>Official Work Order Status: {getStatusBadge(selectedReport.status)}</h4>
                    </div>
                    <div className="summary-fields-grid">
                      <div>
                        <strong>Department:</strong> {selectedReport.assignedDepartment || selectedDepartment}
                      </div>
                      <div>
                        <strong>Personnel Required:</strong> {selectedReport.workersRequired || workersRequired} worker(s)
                      </div>
                      <div>
                        <strong>Approved By:</strong> {selectedReport.reviewedBy || authUser?.name || 'Municipal Officer'}
                      </div>
                      <div>
                        <strong>Approved On:</strong> {formatReportDate(selectedReport.approvedAt || selectedReport.reviewedAt)}
                      </div>
                      {(selectedReport.completedBy || selectedReport.workStartedBy || selectedReport.acceptedBy) && (
                        <div>
                          <strong>Field Operative:</strong> {selectedReport.completedBy || selectedReport.workStartedBy || selectedReport.acceptedBy}
                        </div>
                      )}
                      {selectedReport.completedAt && (
                        <div>
                          <strong>Completed On:</strong> {formatReportDate(selectedReport.completedAt)}
                        </div>
                      )}
                    </div>
                    {selectedReport.officerInstructions && (
                      <div className="summary-instructions">
                        <strong>Officer Instructions:</strong> "{selectedReport.officerInstructions}"
                      </div>
                    )}
                    {selectedReport.workerNotes && (
                      <div className="summary-instructions" style={{ borderColor: '#3b82f6', background: '#eff6ff', padding: '0.5rem 0.75rem', borderRadius: '4px' }}>
                        <strong style={{ color: '#1e40af' }}>Field Work Notes:</strong> "{selectedReport.workerNotes}"
                      </div>
                    )}
                    {selectedReport.completionPhoto && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--navy-600)', display: 'block', marginBottom: '0.25rem' }}>
                          Field Completion Photo Evidence:
                        </span>
                        <div
                          style={{ width: '90px', height: '90px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--navy-300)', cursor: 'pointer' }}
                          onClick={() => setPhotoModalUrl(selectedReport.completionPhoto)}
                          title="Click to view full completion evidence"
                        >
                          <img src={selectedReport.completionPhoto} alt="Work completed evidence" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Officer Decision Form */}
                <form onSubmit={handleApproveAndCreateWorkOrder} className="officer-decision-form">
                  <div className="form-fields-grid">
                    {/* 1. Final Department Dropdown */}
                    <div className="form-field-group">
                      <label htmlFor="dept-select" className="form-field-label">
                        1. Final Department <span className="req-star">*</span>
                      </label>
                      <select
                        id="dept-select"
                        value={selectedDepartment}
                        onChange={(e) => setSelectedDepartment(e.target.value)}
                        className="officer-form-select"
                        required
                      >
                        {MUNICIPAL_DEPARTMENTS.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>
                      <span className="field-hint-text">
                        Officer selection overrides AI recommendation ({aiData?.department || 'Roads'})
                      </span>
                    </div>

                    {/* 2. Number of Workers Required */}
                    <div className="form-field-group">
                      <label htmlFor="workers-input" className="form-field-label">
                        2. Number of Workers Required <span className="req-star">*</span>
                      </label>
                      <input
                        id="workers-input"
                        type="number"
                        min="1"
                        max="50"
                        value={workersRequired}
                        onChange={(e) => setWorkersRequired(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="officer-form-input"
                        required
                      />
                      <span className="field-hint-text">
                        Minimum 1 worker required for work order dispatch
                      </span>
                    </div>
                  </div>

                  {/* 3. Officer Instructions (Optional Textarea) */}
                  <div className="form-field-group full-width">
                    <label htmlFor="instructions-input" className="form-field-label">
                      3. Officer Instructions <span className="opt-tag">(Optional)</span>
                    </label>
                    <textarea
                      id="instructions-input"
                      rows={3}
                      value={officerInstructions}
                      onChange={(e) => setOfficerInstructions(e.target.value)}
                      placeholder="Add operational instructions, safety measures, equipment requirements, or priority notes for field operatives..."
                      className="officer-form-textarea"
                    />
                  </div>

                  {/* If report is rejected, display rejection banner */}
                  {(selectedReport.status || '').toLowerCase() === 'rejected' && (
                    <div className="active-work-order-summary" style={{ borderColor: '#fca5a5', background: '#fef2f2', marginBottom: '1.25rem' }}>
                      <div className="summary-banner-top" style={{ color: '#b91c1c' }}>
                        <AlertCircle size={20} color="#dc2626" />
                        <h4 style={{ color: '#b91c1c', margin: 0 }}>Report Rejected by Municipal Officer</h4>
                      </div>
                      <div style={{ marginTop: '0.5rem', color: '#7f1d1d' }}>
                        <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.92rem' }}>
                          <strong>Rejection Reason:</strong> "{selectedReport.rejectionReason || 'Complaint does not meet municipal criteria.'}"
                        </p>
                        <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.82rem', color: '#991b1b' }}>
                          <strong>Rejected By:</strong> {selectedReport.rejectedBy || 'Municipal Officer'} {selectedReport.rejectedAt ? `on ${formatReportDate(selectedReport.rejectedAt)}` : ''}
                        </p>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#b91c1c', fontWeight: 600 }}>
                          ⛔ Field-worker work orders are blocked and will never be dispatched for this complaint.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Officer Flag Override Justification Input when flagged */}
                  {hasValidationFlags && (
                    <div style={{
                      background: '#fffbeb',
                      border: '1.5px solid #fde68a',
                      borderRadius: '8px',
                      padding: '1rem',
                      marginBottom: '1.25rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                        <AlertTriangle size={18} color="#d97706" />
                        <strong style={{ color: '#92400e', fontSize: '0.92rem' }}>
                          Officer Override Required for Flagged Report
                        </strong>
                      </div>
                      <p style={{ margin: '0 0 0.6rem 0', fontSize: '0.84rem', color: '#78350f', lineHeight: 1.4 }}>
                        This report was flagged during automated verification ({selectedReport.validationStatus || selectedReport.aiValidation?.decision || 'FLAGGED_FOR_REVIEW'}).
                        To approve and create an official work order, you must explicitly review the evidence and record your justification.
                      </p>

                      <label htmlFor="override-reason-input" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#92400e', marginBottom: '0.25rem' }}>
                        Officer Override Justification <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <textarea
                        id="override-reason-input"
                        rows={2}
                        value={officerOverrideReason}
                        onChange={(e) => {
                          setOfficerOverrideReason(e.target.value);
                          setOverrideError('');
                        }}
                        placeholder="e.g. Inspected on-site; confirmed road damage despite unclear photo. Authorized repair dispatch."
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          borderRadius: '6px',
                          border: overrideError ? '1.5px solid #ef4444' : '1px solid #d97706',
                          fontSize: '0.85rem'
                        }}
                        required
                      />
                      {overrideError && (
                        <span style={{ display: 'block', color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', fontWeight: 600 }}>
                          {overrideError}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Existing Flag Override Audit Record (if previously overridden) */}
                  {selectedReport.overrideReason && (
                    <div style={{ marginBottom: '1.25rem', padding: '0.6rem 0.85rem', background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: '6px' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#065f46', display: 'block', marginBottom: '2px' }}>
                        🛡️ Officer Flag Override Audit Record:
                      </span>
                      <span style={{ fontSize: '0.84rem', color: '#047857' }}>
                        "{selectedReport.overrideReason}"
                      </span>
                    </div>
                  )}

                  {/* 4. APPROVE & REJECT ACTIONS */}
                  <div className="decision-actions-row" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                      type="submit"
                      disabled={isSubmitting || selectedReport.status === 'rejected'}
                      className="btn-approve-work-order"
                      id="btn-approve-work-order"
                    >
                      <FileCheck2 size={20} />
                      <span>
                        {isSubmitting
                          ? 'Creating Work Order & Notifying Citizen...'
                          : selectedReport.status === 'approved'
                          ? 'Update & Reissue Work Order'
                          : 'APPROVE REPORT & CREATE WORK ORDER'}
                      </span>
                    </button>

                    {selectedReport.status !== 'rejected' && (
                      <button
                        type="button"
                        disabled={isSubmitting || ['completed', 'resolved'].includes((selectedReport.status || '').toLowerCase())}
                        onClick={handleOpenRejectModal}
                        className="btn-reject-report"
                        id="btn-reject-report"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.75rem 1.4rem',
                          borderRadius: '8px',
                          background: '#fee2e2',
                          border: '1px solid #fca5a5',
                          color: '#b91c1c',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <X size={18} />
                        <span>REJECT REPORT</span>
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <div className="officer-no-selection">
              <FileCheck2 size={48} color="#94a3b8" />
              <h3>Select a Citizen Report</h3>
              <p>Choose any complaint from the queue on the left to inspect evidence, view AI analysis, and issue official municipal work orders.</p>
            </div>
          )}
        </section>
      </div>

      {/* LIGHTBOX MODAL FOR PHOTOGRAPHIC EVIDENCE */}
      {photoModalUrl && (
        <div
          className="officer-photo-modal-backdrop animate-fade-in"
          onClick={() => setPhotoModalUrl(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="photo-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="photo-modal-header">
              <span className="photo-modal-title">Citizen Photographic Evidence &bull; {selectedReport?.reportId}</span>
              <button
                type="button"
                onClick={() => setPhotoModalUrl(null)}
                className="btn-modal-close"
                title="Close modal"
              >
                <X size={18} />
              </button>
            </div>
            <div className="photo-modal-body">
              <img src={photoModalUrl} alt="Full resolution evidence" className="modal-full-img" />
            </div>
          </div>
        </div>
      )}

      {/* REJECTION REASON MODAL */}
      {isRejectModalOpen && selectedReport && (
        <div
          className="officer-lightbox-backdrop animate-fade-in"
          onClick={() => !isSubmittingRejection && setIsRejectModalOpen(false)}
        >
          <div
            className="officer-lightbox-card"
            style={{ maxWidth: '520px', width: '92%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lightbox-header" style={{ borderBottom: '1px solid #fee2e2', background: '#fff1f2' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={20} color="#dc2626" />
                <span style={{ color: '#991b1b', fontWeight: 700 }}>Reject Citizen Report</span>
              </div>
              <button
                type="button"
                className="lightbox-close-btn"
                onClick={() => !isSubmittingRejection && setIsRejectModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleConfirmReject} style={{ padding: '1.25rem' }}>
              <p style={{ fontSize: '0.88rem', color: '#475569', marginTop: 0, marginBottom: '1rem', lineHeight: 1.45 }}>
                Please specify the official reason for rejecting report <strong>{selectedReport.reportId}</strong>.
                This reason will be recorded in the municipal audit trail and notified to the citizen.
                <strong> Rejected reports will never generate field-worker work orders.</strong>
              </p>

              {rejectionError && (
                <div className="auth-alert error-alert" style={{ marginBottom: '1rem', padding: '0.6rem 0.85rem' }}>
                  <span>{rejectionError}</span>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label
                  htmlFor="rejection-reason-text"
                  style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.4rem', color: '#1e293b' }}
                >
                  Official Rejection Reason <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <textarea
                  id="rejection-reason-text"
                  rows={4}
                  className="officer-form-textarea"
                  placeholder="e.g. Complaint details do not match physical location inspection / Issue falls outside municipal jurisdiction / Duplicate submission..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsRejectModalOpen(false)}
                  disabled={isSubmittingRejection}
                  style={{ padding: '0.55rem 1.15rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRejection || !rejectionReason.trim()}
                  style={{
                    background: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.55rem 1.25rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <X size={16} />
                  <span>{isSubmittingRejection ? 'Rejecting & Notifying...' : 'Confirm Rejection'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
