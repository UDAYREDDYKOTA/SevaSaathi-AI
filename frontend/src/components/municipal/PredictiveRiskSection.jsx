import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Flame,
  ShieldAlert,
  RotateCcw,
  Sparkles,
  MapPin,
  Clock,
  Layers,
  Activity,
  X,
  FileText,
  HelpCircle,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { fetchPredictiveRiskAssessments, recalculatePredictiveRisk } from '../../services/aiService';

export default function PredictiveRiskSection({ compact = false }) {
  const [assessments, setAssessments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [error, setError] = useState(null);
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [filterLevel, setFilterLevel] = useState('ALL');

  const loadAssessments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchPredictiveRiskAssessments();
      if (res?.assessments) {
        setAssessments(res.assessments);
      } else {
        setAssessments([]);
      }
    } catch (err) {
      console.error('Failed to load predictive risk assessments:', err);
      setError('Unable to load predictive civic risk forecasts. Ensure backend is operational.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const res = await fetchPredictiveRiskAssessments();
        if (isMounted) {
          setAssessments(res?.assessments || []);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to load predictive risk assessments:', err);
          setError('Unable to load predictive civic risk forecasts. Ensure backend is operational.');
          setIsLoading(false);
        }
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      const res = await recalculatePredictiveRisk();
      if (res?.assessments) {
        setAssessments(res.assessments);
      }
    } catch (err) {
      console.error('Failed to recalculate predictive risk:', err);
      setError('Failed to trigger risk recalculation.');
    } finally {
      setIsRecalculating(false);
    }
  };

  const filteredAssessments = assessments.filter((a) => {
    if (filterLevel === 'ALL') return true;
    return (a.riskLevel || '').toUpperCase() === filterLevel;
  });

  const getRiskColor = (level) => {
    switch ((level || '').toUpperCase()) {
      case 'CRITICAL':
        return { text: '#dc2626', bg: '#fef2f2', border: '#fca5a5', icon: Flame };
      case 'HIGH':
        return { text: '#ea580c', bg: '#fff7ed', border: '#fdba74', icon: AlertTriangle };
      case 'MEDIUM':
        return { text: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: Activity };
      default:
        return { text: '#059669', bg: '#ecfdf5', border: '#a7f3d0', icon: ShieldCheck };
    }
  };

  return (
    <section className="predictive-risk-wrapper" aria-label="Predictive Civic Risk Engine">
      {/* Top Section Header */}
      <div className="predictive-section-header">
        <div className="predictive-title-area">
          <div className="predictive-badge">
            <TrendingUp size={15} />
            <span>STAGE 16 CIVIC INTELLIGENCE</span>
          </div>
          <h2 className="predictive-main-title">PREDICTIVE CIVIC RISK</h2>
          <p className="predictive-subtitle">
            Analyzes multi-month historical municipal reports to forecast where civic infrastructure defects are likely to recur or become high-risk.
          </p>
        </div>

        <div className="predictive-controls">
          <div className="predictive-filter-tabs">
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setFilterLevel(lvl)}
                className={`predictive-filter-btn ${filterLevel === lvl ? 'active' : ''}`}
              >
                {lvl}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleRecalculate}
            disabled={isRecalculating || isLoading}
            className="btn-predictive-recalc"
            title="Recalculate Area Risks from Live Records"
          >
            <RotateCcw size={14} className={isRecalculating ? 'animate-spin' : ''} />
            <span>{isRecalculating ? 'Forecasting…' : 'Recalculate Predictions'}</span>
          </button>
        </div>
      </div>

      {/* Mandatory Advisory Banner */}
      <div className="predictive-advisory-banner">
        <div className="advisory-icon-wrap">
          <HelpCircle size={16} />
        </div>
        <div className="advisory-text-block">
          <strong>AI Advisory Forecast — Not a Confirmed Future Event:</strong>
          <span> Area predictions are derived deterministically from historical municipal records. Officers retain final authority over maintenance dispatches.</span>
        </div>
      </div>

      {/* Content State: Loading, Error, or Cards */}
      {isLoading ? (
        <div className="predictive-loading-card">
          <Activity size={24} className="animate-spin" color="var(--civic-blue)" />
          <p>Evaluating spatial clustering & temporal recurrence across city sectors…</p>
        </div>
      ) : error ? (
        <div className="predictive-error-card">
          <AlertTriangle size={24} color="#dc2626" />
          <p>{error}</p>
          <button type="button" onClick={loadAssessments} className="btn btn-secondary">
            Retry Loading
          </button>
        </div>
      ) : filteredAssessments.length === 0 ? (
        <div className="predictive-empty-card">
          <ShieldCheck size={28} color="#059669" />
          <p>No civic zones currently match the selected risk criteria ({filterLevel}).</p>
        </div>
      ) : (
        <div className={`predictive-cards-grid ${compact ? 'compact' : ''}`}>
          {filteredAssessments.map((item) => {
            const riskConfig = getRiskColor(item.riskLevel);
            const RiskIcon = riskConfig.icon;
            const factor = item.factorScores || {};

            return (
              <article key={item.riskId || item.clusterId} className="predictive-risk-card animate-fade-in">
                {/* Header */}
                <div className="risk-card-top">
                  <div
                    className="risk-level-indicator"
                    style={{
                      color: riskConfig.text,
                      backgroundColor: riskConfig.bg,
                      borderColor: riskConfig.border,
                    }}
                  >
                    <RiskIcon size={14} />
                    <span>{item.riskLevel} FUTURE RISK</span>
                  </div>

                  <div className="risk-score-display">
                    <span className="risk-score-label">Risk Score:</span>
                    <strong className="risk-score-val" style={{ color: riskConfig.text }}>
                      {item.riskScore}/100
                    </strong>
                  </div>
                </div>

                {/* Area & Category */}
                <div className="risk-card-location">
                  <div className="location-name-row">
                    <MapPin size={16} color="var(--civic-blue)" />
                    <h3 className="risk-area-title">{item.areaName}</h3>
                  </div>
                  <span className="risk-category-badge">{item.category}</span>
                </div>

                {/* Historical Telemetry Badges */}
                <div className="risk-telemetry-strip">
                  <div className="telemetry-pill">
                    <FileText size={12} />
                    <span>{item.incidentCount} incidents</span>
                  </div>
                  <div className="telemetry-pill">
                    <Clock size={12} />
                    <span>{item.timeWindow} history</span>
                  </div>
                  <div className="telemetry-pill">
                    <Layers size={12} />
                    <span>
                      {factor.recurrenceRate >= 14 ? 'High recurrence' : 'Periodic recurrence'}
                    </span>
                  </div>
                  {factor.locationSensitivity >= 8 && (
                    <div className="telemetry-pill highlight">
                      <ShieldAlert size={12} />
                      <span>Sensitive Zone (Schools/Hospitals)</span>
                    </div>
                  )}
                </div>

                {/* Body: Predicted Risk & Preventive Recommendation */}
                <div className="risk-card-body">
                  <div className="risk-info-box">
                    <span className="info-box-label">
                      <Sparkles size={13} color="var(--ai-cyan)" />
                      <span>Predicted Risk:</span>
                    </span>
                    <p className="info-box-text highlight">
                      {item.aiInterpretation?.probableRisk || 'Recurring infrastructure breakdown'}
                    </p>
                  </div>

                  <div className="risk-info-box action">
                    <span className="info-box-label">
                      <CheckCircle2 size={13} color="#059669" />
                      <span>Recommended Preventive Action:</span>
                    </span>
                    <p className="info-box-text">
                      {item.aiInterpretation?.recommendedPreventiveAction ||
                        'Schedule proactive inspection to assess corridor for permanent rehabilitation.'}
                    </p>
                  </div>
                </div>

                {/* Footer: Sources & View Evidence CTA */}
                <div className="risk-card-footer">
                  <div className="footer-origin-note">
                    <span className="dot-origin"></span>
                    <span>Risk based on historical municipal records</span>
                  </div>

                  <button
                    type="button"
                    className="btn-view-evidence"
                    onClick={() => setSelectedAssessment(item)}
                    aria-label={`View explainable deterministic evidence for ${item.areaName}`}
                  >
                    <span>View Evidence</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* EXPLAINABLE EVIDENCE MODAL */}
      {selectedAssessment && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setSelectedAssessment(null)}>
          <div className="modal-dialog-box evidence-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="modal-header">
              <div className="modal-title-wrap">
                <ShieldCheck size={22} color="var(--civic-blue)" />
                <div>
                  <h3 className="modal-title">Explainable Civic Risk Evidence</h3>
                  <span className="modal-subtitle">
                    {selectedAssessment.areaName} &middot; {selectedAssessment.category}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setSelectedAssessment(null)}
                aria-label="Close evidence panel"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="modal-body evidence-body">
              {/* Score Summary Banner */}
              <div className="evidence-score-banner">
                <div className="banner-score-circle">
                  <span className="circle-val">{selectedAssessment.riskScore}</span>
                  <span className="circle-sub">/ 100</span>
                </div>
                <div className="banner-score-text">
                  <div className="level-tag-wrap">
                    <span
                      className="modal-level-tag"
                      style={{
                        color: getRiskColor(selectedAssessment.riskLevel).text,
                        backgroundColor: getRiskColor(selectedAssessment.riskLevel).bg,
                        borderColor: getRiskColor(selectedAssessment.riskLevel).border,
                      }}
                    >
                      {selectedAssessment.riskLevel} FUTURE RISK
                    </span>
                    <span className="data-sufficiency-tag">
                      {selectedAssessment.dataSufficiency === 'SUFFICIENT' ? '✓ Data Baseline Sufficient' : '⚠ Limited Data'}
                    </span>
                  </div>
                  <p className="evidence-banner-desc">
                    Deterministic 8-factor formula output based on {selectedAssessment.incidentCount} historical incident records across {selectedAssessment.timeWindow}.
                  </p>
                </div>
              </div>

              {/* SECTION: 8 DETERMINISTIC RISK FACTORS BREAKDOWN */}
              <div className="evidence-factors-section">
                <h4 className="factors-title">
                  <Layers size={16} />
                  <span>DETERMINISTIC FACTOR SCORES (100% FORMULA)</span>
                </h4>

                <div className="factors-grid">
                  {/* Factor 1: Incident Frequency (20%) */}
                  <div className="factor-metric-card">
                    <div className="factor-metric-top">
                      <span className="factor-metric-label">Incident Frequency</span>
                      <strong className="factor-metric-score">
                        {selectedAssessment.factorScores?.incidentFrequency || 0}/20
                      </strong>
                    </div>
                    <div className="factor-progress-bar">
                      <div
                        className="factor-progress-fill"
                        style={{
                          width: `${((selectedAssessment.factorScores?.incidentFrequency || 0) / 20) * 100}%`,
                          backgroundColor: 'var(--civic-blue)',
                        }}
                      ></div>
                    </div>
                    <span className="factor-metric-hint">Weight: 20% &middot; Incident recurrence volume</span>
                  </div>

                  {/* Factor 2: Recurrence Rate (20%) */}
                  <div className="factor-metric-card">
                    <div className="factor-metric-top">
                      <span className="factor-metric-label">Recurrence Rate</span>
                      <strong className="factor-metric-score">
                        {selectedAssessment.factorScores?.recurrenceRate || 0}/20
                      </strong>
                    </div>
                    <div className="factor-progress-bar">
                      <div
                        className="factor-progress-fill"
                        style={{
                          width: `${((selectedAssessment.factorScores?.recurrenceRate || 0) / 20) * 100}%`,
                          backgroundColor: '#0891b2',
                        }}
                      ></div>
                    </div>
                    <span className="factor-metric-hint">Weight: 20% &middot; Persistent multi-month patterns</span>
                  </div>

                  {/* Factor 3: Recent Activity (15%) */}
                  <div className="factor-metric-card">
                    <div className="factor-metric-top">
                      <span className="factor-metric-label">Recent Incident Activity</span>
                      <strong className="factor-metric-score">
                        {selectedAssessment.factorScores?.recentActivity || 0}/15
                      </strong>
                    </div>
                    <div className="factor-progress-bar">
                      <div
                        className="factor-progress-fill"
                        style={{
                          width: `${((selectedAssessment.factorScores?.recentActivity || 0) / 15) * 100}%`,
                          backgroundColor: '#f59e0b',
                        }}
                      ></div>
                    </div>
                    <span className="factor-metric-hint">Weight: 15% &middot; Recency within 7d–30d window</span>
                  </div>

                  {/* Factor 4: Geographic Concentration (15%) */}
                  <div className="factor-metric-card">
                    <div className="factor-metric-top">
                      <span className="factor-metric-label">Geographic Concentration</span>
                      <strong className="factor-metric-score">
                        {selectedAssessment.factorScores?.geographicConcentration || 0}/15
                      </strong>
                    </div>
                    <div className="factor-progress-bar">
                      <div
                        className="factor-progress-fill"
                        style={{
                          width: `${((selectedAssessment.factorScores?.geographicConcentration || 0) / 15) * 100}%`,
                          backgroundColor: '#8b5cf6',
                        }}
                      ></div>
                    </div>
                    <span className="factor-metric-hint">Weight: 15% &middot; Haversine &lt;500m clustering</span>
                  </div>

                  {/* Factor 5: Unresolved Problems (10%) */}
                  <div className="factor-metric-card">
                    <div className="factor-metric-top">
                      <span className="factor-metric-label">Unresolved / Repeated Problems</span>
                      <strong className="factor-metric-score">
                        {selectedAssessment.factorScores?.unresolvedProblems || 0}/10
                      </strong>
                    </div>
                    <div className="factor-progress-bar">
                      <div
                        className="factor-progress-fill"
                        style={{
                          width: `${((selectedAssessment.factorScores?.unresolvedProblems || 0) / 10) * 100}%`,
                          backgroundColor: '#ef4444',
                        }}
                      ></div>
                    </div>
                    <span className="factor-metric-hint">Weight: 10% &middot; Open/unaddressed grievance ratio</span>
                  </div>

                  {/* Factor 6: Location Sensitivity (10%) */}
                  <div className="factor-metric-card">
                    <div className="factor-metric-top">
                      <span className="factor-metric-label">Location Sensitivity</span>
                      <strong className="factor-metric-score">
                        {selectedAssessment.factorScores?.locationSensitivity || 0}/10
                      </strong>
                    </div>
                    <div className="factor-progress-bar">
                      <div
                        className="factor-progress-fill"
                        style={{
                          width: `${((selectedAssessment.factorScores?.locationSensitivity || 0) / 10) * 100}%`,
                          backgroundColor: '#ec4899',
                        }}
                      ></div>
                    </div>
                    <span className="factor-metric-hint">Weight: 10% &middot; School/Hospital/Transit proximity</span>
                  </div>

                  {/* Factor 7: Historical Severity (5%) */}
                  <div className="factor-metric-card">
                    <div className="factor-metric-top">
                      <span className="factor-metric-label">Historical Severity</span>
                      <strong className="factor-metric-score">
                        {selectedAssessment.factorScores?.historicalSeverity || 0}/5
                      </strong>
                    </div>
                    <div className="factor-progress-bar">
                      <div
                        className="factor-progress-fill"
                        style={{
                          width: `${((selectedAssessment.factorScores?.historicalSeverity || 0) / 5) * 100}%`,
                          backgroundColor: '#f97316',
                        }}
                      ></div>
                    </div>
                    <span className="factor-metric-hint">Weight: 5% &middot; Average incident severity</span>
                  </div>

                  {/* Factor 8: Safety Risk (5%) */}
                  <div className="factor-metric-card">
                    <div className="factor-metric-top">
                      <span className="factor-metric-label">Historical Safety Risk</span>
                      <strong className="factor-metric-score">
                        {selectedAssessment.factorScores?.safetyRisk || 0}/5
                      </strong>
                    </div>
                    <div className="factor-progress-bar">
                      <div
                        className="factor-progress-fill"
                        style={{
                          width: `${((selectedAssessment.factorScores?.safetyRisk || 0) / 5) * 100}%`,
                          backgroundColor: '#dc2626',
                        }}
                      ></div>
                    </div>
                    <span className="factor-metric-hint">Weight: 5% &middot; Pedestrian & public safety hazard</span>
                  </div>
                </div>

                <div className="factors-total-row">
                  <span>FINAL DETERMINISTIC FORMULA SCORE:</span>
                  <strong>{selectedAssessment.riskScore}/100 &mdash; {selectedAssessment.riskLevel}</strong>
                </div>
              </div>

              {/* SECTION: AI INTERPRETATION & EVIDENCE STATEMENTS */}
              <div className="evidence-ai-section">
                <h4 className="ai-evidence-title">
                  <Sparkles size={16} color="var(--ai-cyan)" />
                  <span>AI INTERPRETATION OF DETERMINISTIC EVIDENCE</span>
                </h4>

                <p className="ai-summary-lead">
                  {selectedAssessment.aiInterpretation?.summary}
                </p>

                <div className="evidence-bullets-wrap">
                  <span className="bullets-title">Audited Historical Evidence:</span>
                  <ul className="evidence-bullet-list">
                    {selectedAssessment.aiInterpretation?.evidence?.map((item, i) => (
                      <li key={i} className="evidence-bullet-item">
                        <CheckCircle2 size={15} color="#059669" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Contributing factors chips */}
                {selectedAssessment.aiInterpretation?.contributingFactors?.length > 0 && (
                  <div className="contributing-factors-row">
                    <span className="contrib-label">Key Drivers:</span>
                    <div className="contrib-chips">
                      {selectedAssessment.aiInterpretation.contributingFactors.map((c, i) => (
                        <span key={i} className="factor-chip">{c}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION: LINKED REPORT IDENTIFIERS */}
              <div className="evidence-linked-reports-section">
                <h4 className="linked-title">
                  <FileText size={15} />
                  <span>Linked Historical Municipal Report IDs ({selectedAssessment.relatedReportIds?.length || 0})</span>
                </h4>
                <div className="linked-chips-container">
                  {selectedAssessment.relatedReportIds?.map((id, idx) => (
                    <span key={idx} className="linked-report-id-chip">
                      {id}
                    </span>
                  ))}
                </div>
              </div>

              {/* Disclaimer Notice */}
              <div className="modal-disclaimer-box">
                <HelpCircle size={15} />
                <span>
                  <strong>Advisory Notice:</strong> {selectedAssessment.disclaimer || 'AI advisory — not a confirmed future event. Risk based on historical municipal records.'}
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedAssessment(null)}
              >
                Close Evidence Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
