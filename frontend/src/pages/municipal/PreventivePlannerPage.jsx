import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Building2,
  Users2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import {
  fetchPreventiveActionPlans,
  updatePreventivePlanStatus,
} from '../../services/aiService';

export default function PreventivePlannerPage() {
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [activeHorizon, setActiveHorizon] = useState('ALL'); // ALL, IMMEDIATE, NEAR_TERM, LONG_TERM
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);

  const loadPlans = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchPreventiveActionPlans();
      if (data?.plans) {
        setPlans(data.plans);
        setSelectedPlanId((prev) => {
          if (prev) return prev;
          const schoolPlan = data.plans.find((p) => p.category === 'drainage') || data.plans[0];
          return schoolPlan?.planId || null;
        });
      }
    } catch (err) {
      console.error('Failed to load preventive plans:', err);
      setError('Unable to retrieve preventive action plans. Ensure backend server is running.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchPreventiveActionPlans()
      .then((data) => {
        if (isMounted && data?.plans) {
          setPlans(data.plans);
          setSelectedPlanId((prev) => {
            if (prev) return prev;
            const schoolPlan = data.plans.find((p) => p.category === 'drainage') || data.plans[0];
            return schoolPlan?.planId || null;
          });
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to load preventive plans:', err);
          setError('Unable to retrieve preventive action plans. Ensure backend server is running.');
          setIsLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const selectedPlan = plans.find((p) => p.planId === selectedPlanId) || plans[0];

  const handleStatusUpdate = async (status) => {
    if (!selectedPlan) return;
    setIsUpdating(true);
    setStatusMessage(null);
    try {
      const res = await updatePreventivePlanStatus(selectedPlan.planId, {
        status,
        approvedBy: 'demo-officer',
        notes: approvalNotes || `Officer action: marked ${status}`,
      });
      if (res?.plan) {
        // Update local plan list
        setPlans((prev) =>
          prev.map((p) => (p.planId === res.plan.planId ? res.plan : p))
        );
        setStatusMessage(`Plan ${selectedPlan.planId} successfully updated to: ${status}`);
        setApprovalNotes('');
      }
    } catch (err) {
      console.error('Failed to update plan status:', err);
      setStatusMessage(`Error: ${err.message || 'Status update failed'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredActions = (selectedPlan?.actions || []).filter((act) => {
    if (activeHorizon === 'ALL') return true;
    return act.horizon === activeHorizon;
  });

  const getSufficiencyBadge = (level) => {
    if (level === 'SUFFICIENT') {
      return <span className="kg-badge kg-badge-resolved">SUFFICIENT DATA</span>;
    }
    if (level === 'LIMITED') {
      return <span className="kg-badge kg-badge-active" style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308' }}>LIMITED DATA</span>;
    }
    return <span className="kg-badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>INSUFFICIENT DATA</span>;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return <span className="kg-badge kg-badge-resolved">APPROVED</span>;
      case 'ACKNOWLEDGED':
        return <span className="kg-badge" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>ACKNOWLEDGED</span>;
      case 'REJECTED':
        return <span className="kg-badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>REJECTED</span>;
      case 'COMPLETED':
        return <span className="kg-badge" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>COMPLETED</span>;
      default:
        return <span className="kg-badge kg-badge-active">PENDING REVIEW</span>;
    }
  };

  return (
    <div className="municipal-page-container">
      {/* Disclaimer Trust Banner */}
      <div className="kg-trust-banner">
        <div className="kg-trust-content">
          <span className="kg-trust-badge">STAGE 18 PREVENTIVE INTELLIGENCE</span>
          <span className="kg-trust-text">
            DEMO ENVIRONMENT — SIMULATED MUNICIPAL DATA &middot; AI ADVISORY &middot; OFFICER REVIEW REQUIRED &middot; NO AUTO-DISPATCH
          </span>
        </div>
        <button
          className="kg-btn-secondary"
          onClick={loadPlans}
          disabled={isLoading}
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
        >
          <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
          <span>Refresh Plans</span>
        </button>
      </div>

      {/* Header */}
      <div className="municipal-page-header">
        <div>
          <h1 className="page-title">Preventive Action Planner</h1>
          <p className="page-subtitle">
            Converts Civic Memory, Knowledge Graph, and Predictive Risk into concrete 3-horizon preventive actions (0–7 days, 1–4 weeks, 1–6 months).
          </p>
        </div>
      </div>

      {error && <div className="kg-error-alert">{error}</div>}
      {statusMessage && (
        <div className="kg-status-banner" style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)', color: '#10b981' }}>
          <CheckCircle2 size={16} />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Plan Selection Carousel Tabs */}
      <div className="kg-node-filters" style={{ marginBottom: '1.25rem' }}>
        {plans.map((p) => (
          <button
            key={p.planId}
            className={`kg-filter-chip ${selectedPlan?.planId === p.planId ? 'active' : ''}`}
            onClick={() => setSelectedPlanId(p.planId)}
          >
            <span style={{ fontWeight: 600 }}>{p.areaName}</span>
            <span style={{ opacity: 0.7, fontSize: '0.75rem', marginLeft: '0.4rem' }}>
              ({p.riskScore}/100 {p.riskLevel})
            </span>
          </button>
        ))}
      </div>

      {selectedPlan && (
        <div className="kg-dashboard-grid">
          {/* Left Column: Plan Overview & Actions Matrix */}
          <div className="kg-panel">
            <div className="kg-panel-header">
              <div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span className="kg-badge kg-badge-type">{selectedPlan.category.toUpperCase()}</span>
                  {getStatusBadge(selectedPlan.officerStatus)}
                  {getSufficiencyBadge(selectedPlan.dataSufficiency)}
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {selectedPlan.areaName}
                </h2>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Plan ID: <code>{selectedPlan.planId}</code> &middot; Incident: <code>{selectedPlan.incidentId}</code>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: selectedPlan.riskScore >= 80 ? '#ef4444' : '#eab308' }}>
                  {selectedPlan.riskScore}/100
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Predictive Risk Score</div>
              </div>
            </div>

            {/* AI Technical Rationale Card */}
            <div className="kg-ai-story-card" style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
              <div className="kg-ai-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={16} className="text-primary" />
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Engineering Rationale & Summary</span>
                </div>
                <span className="kg-badge kg-badge-type">STAGE 18 ADVISORY</span>
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0.5rem 0' }}>
                {selectedPlan.aiInterpretation?.summary}
              </p>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', padding: '0.6rem', borderRadius: '4px', borderLeft: '2px solid var(--primary)' }}>
                <strong>Why This Action?</strong> {selectedPlan.aiInterpretation?.whyThisAction}
              </div>
            </div>

            {/* Horizon Filter Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {[
                { id: 'ALL', label: 'All Horizons' },
                { id: 'IMMEDIATE', label: 'Immediate (0–7d)' },
                { id: 'NEAR_TERM', label: 'Near-Term (1–4w)' },
                { id: 'LONG_TERM', label: 'Long-Term (1–6m)' },
              ].map((h) => (
                <button
                  key={h.id}
                  onClick={() => setActiveHorizon(h.id)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    border: '1px solid var(--border-color)',
                    background: activeHorizon === h.id ? 'var(--primary)' : 'transparent',
                    color: activeHorizon === h.id ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {h.label}
                </button>
              ))}
            </div>

            {/* Actions List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredActions.map((act) => (
                <div key={act.actionId} className="kg-node-card" style={{ padding: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                    <div>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.2rem' }}>
                        <span className="kg-badge kg-badge-type" style={{ fontSize: '0.7rem' }}>
                          {act.horizonLabel}
                        </span>
                        <span
                          className="kg-badge"
                          style={{
                            fontSize: '0.7rem',
                            background: act.priority === 'CRITICAL' ? 'rgba(239,68,68,0.2)' : 'rgba(234,179,8,0.2)',
                            color: act.priority === 'CRITICAL' ? '#ef4444' : '#eab308',
                          }}
                        >
                          {act.priority}
                        </span>
                      </div>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {act.action}
                      </h3>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {Math.round(act.confidence * 100)}% Confidence
                    </span>
                  </div>

                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.3rem 0' }}>
                    <strong>Municipal Reason:</strong> {act.reason}
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Building2 size={13} />
                      <span>{act.department}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Users2 size={13} />
                      <span>{act.suggestedTeam}</span>
                    </div>
                  </div>

                  {act.evidence && act.evidence.length > 0 && (
                    <div style={{ marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.4rem' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                        Evidence Backing:
                      </div>
                      <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {act.evidence.map((ev, i) => (
                          <li key={i}>{ev}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Evidence Ledger & Officer Review Authorization */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Officer Action Card */}
            <div className="kg-panel">
              <div className="kg-panel-header" style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ShieldCheck size={18} className="text-primary" />
                  <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Officer Review & Approval</h3>
                </div>
              </div>

              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                {selectedPlan.aiInterpretation?.officerAdvisory}
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  Approval / Review Notes (Recorded in Audit Trail):
                </label>
                <textarea
                  className="kg-notes-input"
                  style={{
                    width: '100%',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '0.5rem',
                    fontSize: '0.82rem',
                    color: 'var(--text-primary)',
                    minHeight: '70px',
                    resize: 'vertical',
                  }}
                  placeholder="Enter technical justification or instructions for department engineers..."
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                />
              </div>

              {selectedPlan.approvedBy && (
                <div style={{ fontSize: '0.78rem', color: '#10b981', marginBottom: '0.75rem', background: 'rgba(16,185,129,0.08)', padding: '0.5rem', borderRadius: '4px' }}>
                  <div><strong>Approved By:</strong> {selectedPlan.approvedBy}</div>
                  <div><strong>Approved At:</strong> {new Date(selectedPlan.approvedAt).toLocaleString()}</div>
                  {selectedPlan.approvalNotes && <div><strong>Notes:</strong> {selectedPlan.approvalNotes}</div>}
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <button
                  className="kg-btn-primary"
                  onClick={() => handleStatusUpdate('APPROVED')}
                  disabled={isUpdating}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', background: '#10b981' }}
                >
                  <CheckCircle2 size={15} />
                  <span>Approve Plan</span>
                </button>

                <button
                  className="kg-btn-secondary"
                  onClick={() => handleStatusUpdate('ACKNOWLEDGED')}
                  disabled={isUpdating}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                >
                  <Clock size={15} />
                  <span>Acknowledge</span>
                </button>

                <button
                  className="kg-btn-secondary"
                  onClick={() => handleStatusUpdate('REJECTED')}
                  disabled={isUpdating}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: '#ef4444' }}
                >
                  <XCircle size={15} />
                  <span>Reject</span>
                </button>

                <button
                  className="kg-btn-secondary"
                  onClick={() => handleStatusUpdate('COMPLETED')}
                  disabled={isUpdating}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: '#a855f7' }}
                >
                  <CheckCircle2 size={15} />
                  <span>Mark Done</span>
                </button>
              </div>

              <div style={{ marginTop: '0.75rem', fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                AI recommendations are advisory. Approval initiates workflow without automatic dispatch.
              </div>
            </div>

            {/* Evidence Audit Checklist */}
            <div className="kg-panel">
              <div className="kg-panel-header" style={{ marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <FileText size={16} />
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Supporting Evidence Ledger</h3>
                </div>
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {selectedPlan.evidence?.map((ev, idx) => (
                  <li key={idx}>{ev}</li>
                ))}
              </ul>
            </div>

            {/* Suggested Teams */}
            <div className="kg-panel">
              <div className="kg-panel-header" style={{ marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Users2 size={16} />
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Suggested Response Units</h3>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {selectedPlan.suggestedTeams?.map((tm, idx) => (
                  <span key={idx} className="kg-badge kg-badge-type" style={{ padding: '0.3rem 0.6rem' }}>
                    {tm}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
