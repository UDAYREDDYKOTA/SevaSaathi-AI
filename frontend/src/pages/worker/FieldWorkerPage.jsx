import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench,
  CheckCircle2,
  Clock,
  MapPin,
  AlertTriangle,
  Play,
  RotateCcw,
  LogOut,
  Camera,
  Layers,
  FileCheck2,
  Eye,
  X,
  User,
  Shield,
  Upload,
} from 'lucide-react';
import {
  getAllMunicipalReports,
  acceptFieldWorkOrder,
  startFieldWorkOrder,
  completeFieldWorkOrder,
} from '../../firebase/reports';
import { useRole } from '../../context/useRole';
import HyderabadMap from '../../components/common/HyderabadMap';

// Sample repair completion evidence photos for demo testing
const SAMPLE_COMPLETION_PHOTOS = [
  { label: 'Cleared Stormwater Channel & Extracted Silt', url: 'https://images.unsplash.com/photo-1584467735815-f778f274e296?w=600&auto=format&fit=crop&q=80' },
  { label: 'Fresh Hot-Mix Asphalt Patch Compaction', url: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600&auto=format&fit=crop&q=80' },
  { label: 'Repaired High-Pressure Valve & Resealed Main', url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&auto=format&fit=crop&q=80' },
  { label: 'Installed New LED Streetlight Luminaire', url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=600&auto=format&fit=crop&q=80' },
];

// Client-side image compression to keep Firestore document well under 1MB
function compressImageFile(file, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatReportDate(timestamp) {
  if (!timestamp) return 'Recently assigned';
  let dateObj = null;
  if (typeof timestamp.toDate === 'function') {
    dateObj = timestamp.toDate();
  } else if (timestamp.seconds) {
    dateObj = new Date(timestamp.seconds * 1000);
  } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
    dateObj = new Date(timestamp);
  }
  if (!dateObj || isNaN(dateObj.getTime())) return 'Recently assigned';
  return dateObj.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FieldWorkerPage() {
  const { authUser, logout } = useRole();
  const navigate = useNavigate();

  // Active view tab: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED'
  const [activeTab, setActiveTab] = useState('ASSIGNED');

  // Work Orders state
  const [workOrders, setWorkOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  // Field Work Completion Form state
  const [workerNotes, setWorkerNotes] = useState('');
  const [completionPhoto, setCompletionPhoto] = useState(SAMPLE_COMPLETION_PHOTOS[0].url);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState('');

  // Modals
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [lightboxPhotoUrl, setLightboxPhotoUrl] = useState(null);

  const workerName = authUser?.name || 'Field Operative';
  const workerUid = authUser?.uid || 'worker';
  const workerEmail = authUser?.email || 'worker@sevasaathi.gov.in';

  // Fetch approved work orders from Firestore
  const loadWorkOrders = useCallback(async (selectDocId = null) => {
    setIsLoading(true);
    setError(null);
    try {
      const allReports = await getAllMunicipalReports();
      // Only show work orders created/approved by Municipal Officer
      const approvedOrders = allReports.filter((r) =>
        ['approved', 'assigned', 'accepted', 'in_progress', 'completed', 'resolved'].includes(
          (r.status || '').toLowerCase()
        )
      );

      setWorkOrders(approvedOrders);

      if (selectDocId) {
        setSelectedOrderId(selectDocId);
      } else if (approvedOrders.length > 0) {
        setSelectedOrderId((prev) =>
          approvedOrders.some((o) => o.docId === prev) ? prev : approvedOrders[0].docId
        );
      }
    } catch (err) {
      console.error('Failed to load field work orders:', err);
      setError('Unable to load assigned municipal work orders. Please verify connection.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    getAllMunicipalReports()
      .then((allReports) => {
        if (active) {
          const approvedOrders = allReports.filter((r) =>
            ['approved', 'assigned', 'accepted', 'in_progress', 'completed', 'resolved'].includes(
              (r.status || '').toLowerCase()
            )
          );
          setWorkOrders(approvedOrders);
          if (approvedOrders.length > 0) {
            setSelectedOrderId(approvedOrders[0].docId);
          }
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          console.error('Initial load failed:', err);
          setError('Unable to load work orders from Firestore.');
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // Compute status counts for the header
  const counts = useMemo(() => {
    let assigned = 0;
    let inProgress = 0;
    let completed = 0;

    workOrders.forEach((w) => {
      const st = (w.status || '').toLowerCase();
      if (st === 'approved' || st === 'assigned' || st === 'accepted') {
        assigned++;
      } else if (st === 'in_progress') {
        inProgress++;
      } else if (st === 'completed' || st === 'resolved') {
        completed++;
      }
    });

    return { assigned, inProgress, completed, total: workOrders.length };
  }, [workOrders]);

  // Filter orders by active navigation tab
  const filteredOrders = useMemo(() => {
    return workOrders.filter((w) => {
      const st = (w.status || '').toLowerCase();
      if (activeTab === 'ASSIGNED') {
        return st === 'approved' || st === 'assigned' || st === 'accepted';
      }
      if (activeTab === 'IN_PROGRESS') {
        return st === 'in_progress';
      }
      if (activeTab === 'COMPLETED') {
        return st === 'completed' || st === 'resolved';
      }
      return true;
    });
  }, [workOrders, activeTab]);

  // Active selected work order
  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) {
      return filteredOrders.length > 0 ? filteredOrders[0] : null;
    }
    return workOrders.find((w) => w.docId === selectedOrderId) || null;
  }, [workOrders, selectedOrderId, filteredOrders]);

  // Track previous selection to sync completion form without useEffect cascading renders
  const [prevSelectedDocId, setPrevSelectedDocId] = useState(null);
  if (selectedOrder && selectedOrder.docId !== prevSelectedDocId) {
    setPrevSelectedDocId(selectedOrder.docId);
    setWorkerNotes(selectedOrder.workerNotes || '');
    setCompletionPhoto(selectedOrder.completionPhoto || SAMPLE_COMPLETION_PHOTOS[0].url);
    setActionSuccessMessage('');
  }

  // 1. ACTION: Accept Work (transitions to 'accepted')
  const handleAcceptWork = async () => {
    if (!selectedOrder) return;
    setIsSubmittingAction(true);
    setActionSuccessMessage('');

    try {
      await acceptFieldWorkOrder({
        docId: selectedOrder.docId,
        reportId: selectedOrder.reportId,
        workerName,
        workerUid,
        department: selectedOrder.assignedDepartment || selectedOrder.department || 'Operations',
        submittedBy: selectedOrder.submittedBy || 'demo-citizen',
      });

      setWorkOrders((prev) =>
        prev.map((w) =>
          w.docId === selectedOrder.docId
            ? { ...w, status: 'accepted', acceptedBy: workerName, acceptedAt: new Date().toISOString() }
            : w
        )
      );

      setActionSuccessMessage(`Work Order ${selectedOrder.reportId} accepted! You can now start on-site repair.`);
    } catch (err) {
      console.error('Accept work error:', err);
      alert(`Could not accept work order: ${err.message}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // 2. ACTION: Start Work (transitions to 'in_progress')
  const handleStartWork = async () => {
    if (!selectedOrder) return;
    setIsSubmittingAction(true);
    setActionSuccessMessage('');

    try {
      await startFieldWorkOrder({
        docId: selectedOrder.docId,
        reportId: selectedOrder.reportId,
        workerName,
        workerUid,
        submittedBy: selectedOrder.submittedBy || 'demo-citizen',
      });

      setWorkOrders((prev) =>
        prev.map((w) =>
          w.docId === selectedOrder.docId
            ? { ...w, status: 'in_progress', workStartedBy: workerName, workStartedAt: new Date().toISOString() }
            : w
        )
      );

      setActiveTab('IN_PROGRESS');
      setActionSuccessMessage(`Status updated to IN PROGRESS. Citizen and Municipal Officer have been notified.`);
    } catch (err) {
      console.error('Start work error:', err);
      alert(`Could not start work: ${err.message}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // 3. ACTION: Mark Work Completed (transitions to 'completed')
  const handleCompleteWork = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;

    if (!workerNotes.trim()) {
      alert('Please add work performed notes before completing.');
      return;
    }

    setIsSubmittingAction(true);
    setActionSuccessMessage('');

    try {
      const nowIso = new Date().toISOString();
      await completeFieldWorkOrder({
        docId: selectedOrder.docId,
        reportId: selectedOrder.reportId,
        workerName,
        workerUid,
        workerNotes: workerNotes.trim(),
        completionPhoto,
        submittedBy: selectedOrder.submittedBy || 'demo-citizen',
      });

      setWorkOrders((prev) =>
        prev.map((w) =>
          w.docId === selectedOrder.docId
            ? {
                ...w,
                status: 'completed',
                completedBy: workerName,
                completedByUid: workerUid,
                completedAt: nowIso,
                workerNotes: workerNotes.trim(),
                completionPhoto,
              }
            : w
        )
      );

      setActiveTab('COMPLETED');
      setActionSuccessMessage(
        `Work order ${selectedOrder.reportId} marked completed! Completion details recorded and citizen informed.`
      );
    } catch (err) {
      console.error('Complete work error:', err);
      alert(`Could not complete work order: ${err.message}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Handle custom photo upload with client-side compression
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImageFile(file, 800, 0.7);
      setCompletionPhoto(compressed);
    } catch (err) {
      console.warn('Image compression failed:', err);
      alert('Could not process photo file. Please try another image.');
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.warn('Logout notice:', err);
    }
    navigate('/worker/login');
  };

  // Status Badge UI
  const getStatusBadge = (status) => {
    const st = (status || '').toLowerCase();
    switch (st) {
      case 'approved':
      case 'assigned':
        return <span className="worker-badge status-approved">APPROVED</span>;
      case 'accepted':
        return <span className="worker-badge status-accepted">ACCEPTED</span>;
      case 'in_progress':
        return <span className="worker-badge status-inprogress">IN PROGRESS</span>;
      case 'completed':
      case 'resolved':
        return <span className="worker-badge status-completed">COMPLETED</span>;
      default:
        return <span className="worker-badge status-default">{st.toUpperCase()}</span>;
    }
  };

  // Priority Badge UI
  const getPriorityBadge = (prio) => {
    const p = (prio || 'Medium').toLowerCase();
    if (p === 'critical') return <span className="worker-prio-badge prio-critical">CRITICAL</span>;
    if (p === 'high') return <span className="worker-prio-badge prio-high">HIGH</span>;
    if (p === 'medium') return <span className="worker-prio-badge prio-medium">MEDIUM</span>;
    return <span className="worker-prio-badge prio-low">LOW</span>;
  };

  return (
    <div className="worker-console-wrapper animate-fade-in">
      {/* SIDEBAR NAVIGATION (Section 8: Only Assigned, In Progress, Completed, Profile, Logout) */}
      <aside className="worker-nav-sidebar" aria-label="Field Worker navigation">
        <div className="worker-sidebar-header">
          <div className="worker-dept-badge">Field Operations</div>
          <div className="worker-portal-brand">
            <Wrench size={20} color="#d97706" />
            <span>Field Worker</span>
          </div>
        </div>

        <nav className="worker-nav-menu">
          <button
            type="button"
            onClick={() => setActiveTab('ASSIGNED')}
            className={`worker-nav-item ${activeTab === 'ASSIGNED' ? 'active' : ''}`}
          >
            <Clock size={18} />
            <span>Assigned Work</span>
            {counts.assigned > 0 && <span className="nav-counter-pill">{counts.assigned}</span>}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('IN_PROGRESS')}
            className={`worker-nav-item ${activeTab === 'IN_PROGRESS' ? 'active' : ''}`}
          >
            <Play size={18} />
            <span>In Progress</span>
            {counts.inProgress > 0 && <span className="nav-counter-pill inprogress">{counts.inProgress}</span>}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('COMPLETED')}
            className={`worker-nav-item ${activeTab === 'COMPLETED' ? 'active' : ''}`}
          >
            <CheckCircle2 size={18} />
            <span>Completed</span>
            {counts.completed > 0 && <span className="nav-counter-pill completed">{counts.completed}</span>}
          </button>
        </nav>

        {/* Sidebar Footer: Profile & Logout */}
        <div className="worker-sidebar-footer">
          <button
            type="button"
            onClick={() => setIsProfileModalOpen(true)}
            className="worker-user-profile-btn"
            title="View Field Worker Profile"
          >
            <div className="worker-avatar">
              <User size={18} />
            </div>
            <div className="worker-meta">
              <span className="worker-name-label">{workerName}</span>
              <span className="worker-role-sublabel">Field Operative</span>
            </div>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="btn-worker-logout"
            title="Sign out of Field Worker Console"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="worker-main-content">
        {/* Top Header Bar */}
        <header className="worker-top-bar">
          <div className="worker-greeting-wrap">
            <h1 className="worker-header-greeting">Hello, {workerName} 👋</h1>
            <p className="worker-header-subtext">
              Active Municipal Work Orders &bull; Ground Dispatch Console
            </p>
          </div>

          <div className="worker-header-stat-row">
            <div
              className={`worker-stat-chip ${activeTab === 'ASSIGNED' ? 'active' : ''}`}
              onClick={() => setActiveTab('ASSIGNED')}
            >
              <span className="stat-label">Assigned Work</span>
              <span className="stat-val">{counts.assigned}</span>
            </div>

            <div
              className={`worker-stat-chip ${activeTab === 'IN_PROGRESS' ? 'active' : ''}`}
              onClick={() => setActiveTab('IN_PROGRESS')}
            >
              <span className="stat-label">In Progress</span>
              <span className="stat-val">{counts.inProgress}</span>
            </div>

            <div
              className={`worker-stat-chip ${activeTab === 'COMPLETED' ? 'active' : ''}`}
              onClick={() => setActiveTab('COMPLETED')}
            >
              <span className="stat-label">Completed</span>
              <span className="stat-val">{counts.completed}</span>
            </div>

            <button
              type="button"
              onClick={() => loadWorkOrders(selectedOrderId)}
              className="btn-worker-sync"
              disabled={isLoading}
              title="Refresh Work Orders from Firestore"
            >
              <RotateCcw size={15} className={isLoading ? 'animate-spin' : ''} />
              <span>Sync</span>
            </button>
          </div>
        </header>

        {/* Action Success Alert Banner */}
        {actionSuccessMessage && (
          <div className="worker-action-banner animate-fade-in">
            <CheckCircle2 size={20} color="#059669" />
            <span>{actionSuccessMessage}</span>
            <button
              type="button"
              onClick={() => setActionSuccessMessage('')}
              className="btn-banner-dismiss"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* WORK ORDERS WORKSPACE: TWO COLUMNS (QUEUE & DETAIL) */}
        <div className="worker-workspace-layout">
          {/* Left Column: Work Orders List */}
          <section className="worker-queue-column" aria-label="Work Orders Queue">
            <div className="worker-queue-header">
              <h2 className="worker-queue-title">
                {activeTab === 'ASSIGNED' && 'Assigned Work Orders'}
                {activeTab === 'IN_PROGRESS' && 'Work Orders In Progress'}
                {activeTab === 'COMPLETED' && 'Completed Work Orders'}
                {' '}({filteredOrders.length})
              </h2>
              <span className="worker-queue-badge">Approved by Officer</span>
            </div>

            {isLoading ? (
              <div className="worker-empty-box">
                <RotateCcw className="animate-spin" size={24} color="#d97706" />
                <p>Loading officer-approved work orders...</p>
              </div>
            ) : error ? (
              <div className="worker-empty-box error">
                <AlertTriangle size={24} color="#ef4444" />
                <p>{error}</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="worker-empty-box">
                <FileCheck2 size={36} color="#94a3b8" />
                <h3>No Work Orders in this stage</h3>
                <p>
                  {activeTab === 'ASSIGNED' && 'When a Municipal Officer approves a citizen report and creates a work order, it will appear here.'}
                  {activeTab === 'IN_PROGRESS' && 'No work currently marked in progress. Start an accepted work order to see it here.'}
                  {activeTab === 'COMPLETED' && 'No completed work orders yet in this session.'}
                </p>
              </div>
            ) : (
              <div className="worker-cards-container">
                {filteredOrders.map((order) => {
                  const isSelected = selectedOrder?.docId === order.docId;
                  const problemTitle = order.aiAnalysis?.issueType || (order.category ? `${order.category.toUpperCase()} Issue` : 'Municipal Grievance');
                  const dept = order.assignedDepartment || order.department || order.category || 'Operations';
                  const workersNum = order.workersRequired || 2;
                  const prio = order.priority || order.priorityAssessment?.level || order.aiAnalysis?.severity || 'Medium';

                  return (
                    <div
                      key={order.docId}
                      className={`worker-order-card ${isSelected ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedOrderId(order.docId);
                        setActionSuccessMessage('');
                      }}
                    >
                      {/* Top Header: ID & Status */}
                      <div className="order-card-top">
                        <span className="order-id-badge">{order.reportId}</span>
                        {getStatusBadge(order.status)}
                      </div>

                      {/* Main Problem */}
                      <h3 className="order-problem-heading">{problemTitle}</h3>
                      <p className="order-desc-snippet">
                        {order.description ? order.description.slice(0, 85) + (order.description.length > 85 ? '...' : '') : 'No description provided.'}
                      </p>

                      {/* Key Officer Assignments (READ-ONLY) */}
                      <div className="order-card-specs">
                        <div className="spec-pill dept-pill">
                          <strong>Category:</strong> {order.detectedCategory || order.category || 'Roads'}
                        </div>
                        <div className="spec-pill dept-pill">
                          <strong>Dept:</strong> {dept}
                        </div>
                        <div className="spec-pill workers-pill">
                          <strong>Workers:</strong> {workersNum}
                        </div>
                        {getPriorityBadge(prio)}
                      </div>

                      {/* Location & Time */}
                      <div className="order-card-footer-meta">
                        <span className="footer-loc" title={order.address || order.locationStatus || 'Location'}>
                          <MapPin size={12} />
                          <span>{(order.address || order.locationStatus || 'Site location').slice(0, 24)}</span>
                        </span>
                        <span className="footer-time">
                          <Clock size={12} />
                          <span>{formatReportDate(order.approvedAt || order.createdAt)}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Right Column: Work Order Details & Action Panel */}
          <section className="worker-detail-column" aria-label="Active Work Order Details">
            {selectedOrder ? (
              <div className="worker-order-detail-card">
                {/* Header Block */}
                <div className="order-detail-header">
                  <div>
                    <span className="detail-eyebrow">Official Municipal Work Order</span>
                    <h2 className="detail-order-id">{selectedOrder.reportId}</h2>
                  </div>
                  <div className="detail-header-badges">
                    {getStatusBadge(selectedOrder.status)}
                    {getPriorityBadge(selectedOrder.priority || selectedOrder.priorityAssessment?.level || selectedOrder.aiAnalysis?.severity || 'Medium')}
                  </div>
                </div>

                {/* Core Assignment Box: PROBLEM, LOCATION, DEPARTMENT, WORKERS, INSTRUCTIONS */}
                <div className="work-order-official-box">
                  <div className="official-box-header">
                    <Shield size={16} color="#d97706" />
                    <span>Officer Work Order Specification</span>
                  </div>

                  <div className="official-specs-grid">
                    {/* Problem */}
                    <div className="spec-grid-item full-row">
                      <span className="spec-label">Problem / Issue:</span>
                      <span className="spec-val-highlight">
                        {selectedOrder.detectedProblem || selectedOrder.aiAnalysis?.issueType || (selectedOrder.category ? `${selectedOrder.category.toUpperCase()} Issue` : 'Municipal Grievance')}
                      </span>
                    </div>

                    {/* AI-Classified Category (READ ONLY) */}
                    <div className="spec-grid-item">
                      <span className="spec-label">AI Category:</span>
                      <span className="spec-val-badge">
                        {selectedOrder.detectedCategory || selectedOrder.category || 'Roads'}
                      </span>
                    </div>

                    {/* Department Assigned by Officer (READ ONLY) */}
                    <div className="spec-grid-item">
                      <span className="spec-label">Department Assigned:</span>
                      <span className="spec-val-badge">
                        {selectedOrder.assignedDepartment || selectedOrder.department || selectedOrder.category || 'Operations'}
                      </span>
                    </div>

                    {/* Workers Required (READ ONLY) */}
                    <div className="spec-grid-item">
                      <span className="spec-label">Workers Required:</span>
                      <span className="spec-val-badge workers">
                        {selectedOrder.workersRequired || 2} Personnel
                      </span>
                    </div>

                    {/* Location */}
                    <div className="spec-grid-item full-row">
                      <span className="spec-label">Address / Location:</span>
                      <span className="spec-val-location">
                        <MapPin size={15} color="#d97706" />
                        <span>{selectedOrder.address || selectedOrder.locationStatus || 'Location specified by citizen'}</span>
                        {selectedOrder.latitude && selectedOrder.longitude && (
                          <span className="coords-text">
                            ({selectedOrder.latitude.toFixed(5)}, {selectedOrder.longitude.toFixed(5)})
                          </span>
                        )}
                      </span>

                      {/* Interactive Hyderabad Map Display for Field Worker Dispatch per Requirement 6 */}
                      <div style={{ marginTop: '0.65rem', width: '100%' }}>
                        <HyderabadMap
                          readOnly={true}
                          latitude={selectedOrder.latitude}
                          longitude={selectedOrder.longitude}
                          address={selectedOrder.address || selectedOrder.locationStatus || 'Hyderabad, Telangana'}
                          height="200px"
                          showSearch={false}
                        />
                      </div>
                    </div>

                    {/* Officer Instructions (READ ONLY) */}
                    <div className="spec-grid-item full-row">
                      <span className="spec-label">Officer Instructions:</span>
                      <div className="spec-instructions-box">
                        {selectedOrder.officerInstructions ? (
                          <p>"{selectedOrder.officerInstructions}"</p>
                        ) : (
                          <span className="text-muted">Standard protocol: Inspect on-site and clear reported civic obstruction.</span>
                        )}
                      </div>
                    </div>

                    {/* Date/Time Assigned */}
                    <div className="spec-grid-item full-row">
                      <span className="spec-label">Date Assigned by Officer:</span>
                      <span className="spec-val">
                        {formatReportDate(selectedOrder.approvedAt || selectedOrder.reviewedAt || selectedOrder.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Citizen Complaint Description & Evidence Photo */}
                <div className="citizen-evidence-card">
                  <h4 className="card-subhead">Citizen Complaint Description & Photo</h4>
                  <p className="citizen-desc-quote">"{selectedOrder.description || 'No complaint text provided.'}"</p>

                  {(selectedOrder.imageUrl || selectedOrder.photoDataUrl) ? (
                    <div className="citizen-photo-preview-wrap">
                      <span className="photo-label">Uploaded Complaint Evidence:</span>
                      <div
                        className="photo-thumb-container"
                        onClick={() => setLightboxPhotoUrl(selectedOrder.imageUrl || selectedOrder.photoDataUrl)}
                        title="Click to view full photo evidence"
                      >
                        <img
                          src={selectedOrder.imageUrl || selectedOrder.photoDataUrl}
                          alt="Citizen evidence"
                          className="citizen-evidence-img"
                        />
                        <div className="photo-enlarge-overlay">
                          <Eye size={16} />
                          <span>Inspect Photo</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="photo-none-note">
                      <Camera size={16} color="#94a3b8" />
                      <span>No photo attached with original citizen report.</span>
                    </div>
                  )}
                </div>

                {/* LIFECYCLE ACTION CONTROL PANEL (Section 4 & 5) */}
                <div className="worker-lifecycle-panel">
                  <h4 className="lifecycle-panel-title">Field Work Progress & Actions</h4>

                  {/* STAGE 1: APPROVED / ASSIGNED -> ACCEPT WORK */}
                  {((selectedOrder.status || '').toLowerCase() === 'approved' ||
                    (selectedOrder.status || '').toLowerCase() === 'assigned') && (
                    <div className="lifecycle-action-box">
                      <div className="lifecycle-status-desc">
                        <Clock size={18} color="#d97706" />
                        <div>
                          <strong>Work Order Assigned</strong>
                          <p>Review the officer instructions and accept this work order to commence operations.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleAcceptWork}
                        disabled={isSubmittingAction}
                        className="btn-worker-action btn-accept-work"
                      >
                        <CheckCircle2 size={18} />
                        <span>{isSubmittingAction ? 'Accepting...' : 'Accept Work Order'}</span>
                      </button>
                    </div>
                  )}

                  {/* STAGE 2: ACCEPTED -> START WORK */}
                  {(selectedOrder.status || '').toLowerCase() === 'accepted' && (
                    <div className="lifecycle-action-box">
                      <div className="lifecycle-status-desc">
                        <CheckCircle2 size={18} color="#0284c7" />
                        <div>
                          <strong>Work Order Accepted by {selectedOrder.acceptedBy || workerName}</strong>
                          <p>Dispatched personnel ready on-site. Click below to begin repair work.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleStartWork}
                        disabled={isSubmittingAction}
                        className="btn-worker-action btn-start-work"
                      >
                        <Play size={18} />
                        <span>{isSubmittingAction ? 'Starting...' : 'Start Work (Work In Progress)'}</span>
                      </button>
                    </div>
                  )}

                  {/* STAGE 3: IN PROGRESS -> COMPLETE WORK FORM (Section 5) */}
                  {(selectedOrder.status || '').toLowerCase() === 'in_progress' && (
                    <form onSubmit={handleCompleteWork} className="lifecycle-progress-form">
                      <div className="in-progress-header">
                        <span className="live-pulse-dot" />
                        <strong>Work In Progress</strong>
                        <span className="live-sub">Operative active on-site</span>
                      </div>

                      {/* Work Notes / Performed Description */}
                      <div className="form-group">
                        <label htmlFor="worker-notes-input" className="form-label">
                          Work Performed / Notes <span className="req-star">*</span>
                        </label>
                        <textarea
                          id="worker-notes-input"
                          rows={3}
                          className="worker-notes-textarea"
                          placeholder="Describe corrective actions taken on site (e.g., cleared 30m stormwater drain, extracted debris and verified flow)..."
                          value={workerNotes}
                          onChange={(e) => setWorkerNotes(e.target.value)}
                          required
                        />
                      </div>

                      {/* Completion Photo Evidence */}
                      <div className="form-group">
                        <label className="form-label">
                          Completion Photo Evidence <span className="opt-label">(Optional)</span>
                        </label>

                        {/* Photo sample picker or custom upload */}
                        <div className="completion-photo-controls">
                          {completionPhoto && (
                            <div className="completion-preview-box">
                              <img src={completionPhoto} alt="Work completed preview" className="completion-preview-img" />
                            </div>
                          )}

                          <div className="photo-selection-options">
                            <span className="photo-options-label">Select Demo Completion Photo:</span>
                            <select
                              value={completionPhoto}
                              onChange={(e) => setCompletionPhoto(e.target.value)}
                              className="worker-photo-select"
                            >
                              {SAMPLE_COMPLETION_PHOTOS.map((p, idx) => (
                                <option key={idx} value={p.url}>
                                  {p.label}
                                </option>
                              ))}
                            </select>

                            <div className="upload-file-button-wrap">
                              <label htmlFor="custom-photo-file" className="btn-upload-file">
                                <Upload size={14} />
                                <span>Upload On-Site Photo</span>
                              </label>
                              <input
                                id="custom-photo-file"
                                type="file"
                                accept="image/*"
                                onChange={handlePhotoUpload}
                                style={{ display: 'none' }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Submit Button: Mark Work Completed */}
                      <button
                        type="submit"
                        disabled={isSubmittingAction || !workerNotes.trim()}
                        className="btn-worker-action btn-complete-work"
                      >
                        <CheckCircle2 size={18} />
                        <span>{isSubmittingAction ? 'Marking Completed...' : 'Mark Work Completed'}</span>
                      </button>
                    </form>
                  )}

                  {/* STAGE 4: COMPLETED SUMMARY */}
                  {((selectedOrder.status || '').toLowerCase() === 'completed' ||
                    (selectedOrder.status || '').toLowerCase() === 'resolved') && (
                    <div className="lifecycle-completed-summary">
                      <div className="completed-summary-header">
                        <CheckCircle2 size={20} color="#059669" />
                        <h4>Work Order Completed</h4>
                      </div>

                      <div className="completed-meta-grid">
                        <div>
                          <strong>Completed By:</strong> {selectedOrder.completedBy || workerName}
                        </div>
                        <div>
                          <strong>Completed On:</strong> {formatReportDate(selectedOrder.completedAt)}
                        </div>
                        <div className="full-col">
                          <strong>Work Notes:</strong> "{selectedOrder.workerNotes || 'Repair work successfully performed.'}"
                        </div>
                      </div>

                      {selectedOrder.completionPhoto && (
                        <div className="completed-photo-box">
                          <span className="photo-label">Verified Repair Photo Evidence:</span>
                          <div
                            className="completion-photo-thumb-container"
                            onClick={() => setLightboxPhotoUrl(selectedOrder.completionPhoto)}
                          >
                            <img
                              src={selectedOrder.completionPhoto}
                              alt="Verified completion"
                              className="completion-evidence-img"
                            />
                            <div className="photo-enlarge-overlay">
                              <Eye size={16} />
                              <span>View Full Evidence</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="worker-no-selection-card">
                <Layers size={44} color="#94a3b8" />
                <h3>Select a Work Order</h3>
                <p>Choose any work order on the left to inspect municipal specifications, accept dispatch, or submit completion evidence.</p>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* MODAL: FIELD WORKER PROFILE */}
      {isProfileModalOpen && (
        <div className="worker-modal-backdrop animate-fade-in" onClick={() => setIsProfileModalOpen(false)}>
          <div className="worker-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="worker-modal-header">
              <div className="modal-title-wrap">
                <User size={18} color="#d97706" />
                <h3>Field Operative Profile</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="btn-modal-close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="worker-modal-body">
              <div className="profile-detail-row">
                <span className="profile-label">Name:</span>
                <span className="profile-value">{workerName}</span>
              </div>
              <div className="profile-detail-row">
                <span className="profile-label">Email:</span>
                <span className="profile-value">{workerEmail}</span>
              </div>
              <div className="profile-detail-row">
                <span className="profile-label">Role:</span>
                <span className="profile-value badge">field_worker</span>
              </div>
              <div className="profile-detail-row">
                <span className="profile-label">UID:</span>
                <span className="profile-value mono">{workerUid}</span>
              </div>
              <div className="profile-detail-row">
                <span className="profile-label">Assigned Orders:</span>
                <span className="profile-value font-bold">{workOrders.length}</span>
              </div>
            </div>
            <div className="worker-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsProfileModalOpen(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleLogout}
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LIGHTBOX PHOTO PREVIEW */}
      {lightboxPhotoUrl && (
        <div className="worker-modal-backdrop animate-fade-in" onClick={() => setLightboxPhotoUrl(null)}>
          <div className="worker-lightbox-box" onClick={(e) => e.stopPropagation()}>
            <div className="lightbox-header">
              <span>Photographic Evidence</span>
              <button
                type="button"
                onClick={() => setLightboxPhotoUrl(null)}
                className="btn-modal-close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="lightbox-body">
              <img src={lightboxPhotoUrl} alt="Photographic Evidence" className="lightbox-full-img" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
