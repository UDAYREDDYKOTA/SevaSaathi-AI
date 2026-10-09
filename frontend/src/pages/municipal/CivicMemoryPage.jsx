import React, { useState, useEffect } from 'react';
import {
  Database,
  History,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchCivicMemoryAnalysis } from '../../services/aiService';

export default function CivicMemoryPage() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadCivicMemory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchCivicMemoryAnalysis();
      setData(res);
    } catch (err) {
      console.error('Failed to load civic memory:', err);
      setError('Unable to load institutional civic memory. Please verify backend connectivity.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const res = await fetchCivicMemoryAnalysis();
        if (isMounted) {
          setData(res);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to load civic memory:', err);
          setError('Unable to load institutional civic memory. Please verify backend connectivity.');
          setIsLoading(false);
        }
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="municipal-page animate-fade-in">
      {/* Simulation Banner */}
      <div className="demo-sim-alert-banner">
        <ShieldAlert size={16} />
        <span>DEMO ENVIRONMENT — SIMULATED MUNICIPAL DATA</span>
      </div>

      <div className="module-header">
        <div className="module-title-wrap">
          <div className="module-pretitle">
            <Database size={16} />
            <span>Institutional Knowledge & Chronic Triage</span>
          </div>
          <h1 className="module-title">CIVIC MEMORY</h1>
          <p className="module-description">
            Preserves municipal operational history, analyzes recurring civic failure clusters across seasons, and leverages advisory AI to recommend permanent capital overhauls over repeated emergency dispatches.
          </p>
        </div>
        <button
          type="button"
          onClick={loadCivicMemory}
          className="btn-worker-refresh"
          title="Refresh Civic Memory Analysis"
        >
          <RotateCcw size={16} />
          <span>Refresh Analysis</span>
        </button>
      </div>

      {isLoading ? (
        <div className="worker-empty-card">
          <Clock className="animate-spin" size={28} />
          <p>Analyzing historical incident trends & synthesizing institutional memory…</p>
        </div>
      ) : error ? (
        <div className="worker-empty-card error">
          <AlertTriangle size={28} color="#ef4444" />
          <p>{error}</p>
        </div>
      ) : (
        <div className="civic-memory-content">
          <div className="memory-stats-bar">
            <div className="stat-pill">
              <span className="stat-num">{data?.totalHistoricalIncidentsAnalyzed || 0}</span>
              <span className="stat-txt">Incidents Indexed</span>
            </div>
            <div className="stat-pill highlight">
              <span className="stat-num">{data?.recurringProblemsCount || 0}</span>
              <span className="stat-txt">Recurring Problem Clusters</span>
            </div>
            <div className="stat-pill">
              <span className="stat-num">100%</span>
              <span className="stat-txt">Deterministic Aggregation</span>
            </div>
          </div>

          <div className="recurring-problems-section">
            <div className="section-title-row">
              <History size={18} color="var(--civic-blue)" />
              <h2>Recurring Problems</h2>
            </div>
            <p className="section-subtext">
              The engine automatically groups repeated complaints across locations and timeframes, distinguishing audited historical facts from advisory AI pattern interpretations.
            </p>

            {/* STAGE 16 CIVIC MEMORY -> PREDICTIVE CIVIC RISK BRIDGE */}
            <div className="predictive-memory-bridge-banner">
              <div className="bridge-icon-col">
                <TrendingUp size={20} color="var(--ai-cyan)" />
              </div>
              <div className="bridge-text-col">
                <span className="bridge-pretitle">STAGE 16 PREDICTIVE CIVIC RISK ENGINE ACTIVE</span>
                <h4 className="bridge-title">From Historical Retrospective to Forward Risk Prediction</h4>
                <p className="bridge-desc">
                  Civic Memory catalogs historical repetitions (<em>&quot;8 drainage incidents in School Road&quot;</em>). The Predictive Civic Risk Engine models future failure likelihood and produces deterministic 8-factor risk scores and preventive actions.
                </p>
              </div>
              <Link to="/municipal/ai-insights" className="btn-bridge-cta">
                <span>View Area Predictions</span>
              </Link>
            </div>

            <div className="recurring-cards-grid">
              {data?.recurringProblems?.map((prob, idx) => (
                <div key={idx} className="recurring-problem-card">
                  <div className="problem-card-header">
                    <div className="problem-area-block">
                      <span className="problem-area-tag">{prob.area}</span>
                      <h3 className="problem-issue-title">{prob.issue}</h3>
                    </div>
                    <span className="incident-count-badge">
                      {prob.incidentCount} Related Incidents
                    </span>
                  </div>

                  {/* SIDE-BY-SIDE PANELS: HISTORICAL DATA vs AI INTERPRETATION */}
                  <div className="memory-comparison-grid">
                    {/* PANEL 1: HISTORICAL DATA */}
                    <div className="memory-panel historical-panel">
                      <div className="panel-badge-label historical">
                        <History size={13} />
                        <span>HISTORICAL DATA (DETERMINISTIC)</span>
                      </div>
                      <div className="historical-facts-list">
                        <div className="fact-item">
                          <span className="fact-label">Time Period:</span>
                          <strong className="fact-val">{prob.timePeriod}</strong>
                        </div>
                        <div className="fact-item">
                          <span className="fact-label">Department:</span>
                          <span className="fact-val">{prob.department}</span>
                        </div>
                        <div className="fact-item">
                          <span className="fact-label">Category:</span>
                          <span className="fact-val capitalize">{prob.category}</span>
                        </div>
                        <div className="fact-item related-ids-item">
                          <span className="fact-label">Related Incidents:</span>
                          <div className="fact-chips-wrap">
                            {prob.relatedIncidentIds?.map((id, i) => (
                              <span key={i} className="fact-id-chip">{id}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* PANEL 2: AI INTERPRETATION */}
                    <div className="memory-panel ai-panel">
                      <div className="panel-badge-label ai">
                        <Sparkles size={13} />
                        <span>AI INTERPRETATION (ADVISORY)</span>
                      </div>
                      <div className="ai-insights-block">
                        <div className="insight-row">
                          <span className="insight-title">Probable Recurring Cause:</span>
                          <p className="insight-body cause">"{prob.probableRecurringCause}"</p>
                        </div>

                        <div className="insight-row">
                          <span className="insight-title">AI Institutional Insight:</span>
                          <p className="insight-body advice">"{prob.aiInsight}"</p>
                        </div>

                        {prob.longTermRecommendation && (
                          <div className="insight-row rec-row">
                            <span className="insight-title">Policy Recommendation:</span>
                            <p className="insight-body action">{prob.longTermRecommendation}</p>
                          </div>
                        )}

                        <div className="insight-meta-row">
                          <span className="confidence-pill">
                            Confidence: {Math.round(prob.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mandated advisory disclaimer */}
                  <div className="memory-card-disclaimer">
                    "AI insight is advisory and based on available municipal records."
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
