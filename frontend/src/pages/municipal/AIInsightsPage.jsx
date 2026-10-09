import React from 'react';
import {
  BrainCircuit,
  TrendingUp,
  Layers,
  ShieldAlert,
  Database,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import PredictiveRiskSection from '../../components/municipal/PredictiveRiskSection';

export default function AIInsightsPage() {
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
            <BrainCircuit size={16} />
            <span>Civic Intelligence & Predictive Analytics</span>
          </div>
          <h1 className="module-title">AI INSIGHTS & PREDICTIVE RISK</h1>
          <p className="module-description">
            Advanced municipal intelligence workspace. Combines deterministic historical telemetry, spatial clustering, and Gemini AI interpretation to forecast recurring failure corridors before acute breakdowns occur.
          </p>
        </div>

        <div className="module-actions-row">
          <Link to="/municipal/civic-memory" className="btn btn-secondary">
            <Database size={15} />
            <span>View Civic Memory</span>
          </Link>
          <Link to="/municipal" className="btn btn-primary">
            <TrendingUp size={15} />
            <span>Command Center</span>
          </Link>
        </div>
      </div>

      {/* Stage 16 Predictive Civic Risk Engine Section */}
      <PredictiveRiskSection />

      {/* Architectural Explainer Bar */}
      <div className="predictive-architecture-panel">
        <div className="arch-panel-header">
          <Layers size={18} color="var(--civic-blue)" />
          <h3>Predictive Risk Engine Architecture (Stage 16)</h3>
        </div>
        <div className="arch-steps-grid">
          <div className="arch-step-card">
            <div className="step-num-pill">1</div>
            <h4>Historical Ingestion</h4>
            <p>Indexes municipal reports across categories and dates without modifying original citizen ledgers.</p>
          </div>
          <div className="arch-step-card">
            <div className="step-num-pill">2</div>
            <h4>Spatial Clustering</h4>
            <p>Applies pure Haversine distance (&lt;500m local, 500m-1km nearby) without external map dependencies.</p>
          </div>
          <div className="arch-step-card">
            <div className="step-num-pill">3</div>
            <h4>Deterministic Formula</h4>
            <p>Calculates 8 weighted factors (100% total) providing an explainable, auditable 0-100 risk score.</p>
          </div>
          <div className="arch-step-card">
            <div className="step-num-pill">4</div>
            <h4>AI Evidence Interpretation</h4>
            <p>Gemini AI interprets only deterministic evidence and synthesizes actionable preventive recommendations.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
