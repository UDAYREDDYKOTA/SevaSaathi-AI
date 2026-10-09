import React from 'react';
import { Link } from 'react-router-dom';
import {
  User,
  Building2,
  ArrowRight,
  Sparkles,
  Layers,
  Cpu,
  CheckCircle2,
  Wrench,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="landing-wrapper animate-fade-in">
      {/* Hero Section */}
      <section className="landing-hero">
        <div className="hero-pill-badge">
          <span className="hero-pill-dot"></span>
          <span>Next-Generation Civic Intelligence</span>
        </div>

        <h1 className="landing-title">
          SevaSaathi <span className="title-accent">AI</span>
        </h1>

        <p className="landing-tagline">
          Smarter Civic Service, Simpler for Everyone.
        </p>

        <p className="landing-description">
          A unified platform bridging citizens and municipal administration.
          Engineered to streamline civic grievances, automate departmental coordination,
          and cultivate institutional memory for modern urban governance.
        </p>

        {/* Two Clear Mode Selection Buttons / Cards */}
        <div className="mode-selection-grid">
          {/* Citizen Mode Card */}
          <div className="mode-card citizen">
            <div className="mode-card-icon-wrap">
              <User size={28} />
            </div>
            <span className="badge badge-civic mode-card-badge">Public Portal</span>
            <h2 className="mode-card-title">Citizen Mode</h2>
            <p className="mode-card-desc">
              Empowering residents to submit civic reports, track resolution progress in real time, explore local municipal works, and manage their profile.
            </p>
            <ul className="mode-card-modules-list">
              <li><CheckCircle2 size={16} /> Community Home & Quick Actions</li>
              <li><CheckCircle2 size={16} /> Geo-Tagged Problem Reporting</li>
              <li><CheckCircle2 size={16} /> Personal Grievance Tracking</li>
              <li><CheckCircle2 size={16} /> Nearby Civic Activity Feed</li>
            </ul>
            <Link to="/citizen" className="btn btn-primary" id="btn-citizen-mode">
              <span>Enter Citizen Mode</span>
              <ArrowRight size={18} />
            </Link>
          </div>

          {/* Municipal Mode Card */}
          <div className="mode-card municipal">
            <div className="mode-card-icon-wrap">
              <Building2 size={28} />
            </div>
            <span className="badge badge-stage mode-card-badge">Administrative Console</span>
            <h2 className="mode-card-title">Municipal Mode</h2>
            <p className="mode-card-desc">
              Centralized command center for city administrators, department heads, and field teams to coordinate operations and leverage AI triage insights.
            </p>
            <ul className="mode-card-modules-list">
              <li><CheckCircle2 size={16} /> City Operations Command Center</li>
              <li><CheckCircle2 size={16} /> Department Incident Dispatch</li>
              <li><CheckCircle2 size={16} /> AI Pattern Triage & Analytics</li>
              <li><CheckCircle2 size={16} /> Institutional Civic Memory</li>
            </ul>
            <Link to="/municipal" className="btn btn-secondary" id="btn-municipal-mode">
              <span>Enter Municipal Mode</span>
              <ArrowRight size={18} />
            </Link>
          </div>

          {/* Field Worker Mode Card */}
          <div className="mode-card worker">
            <div className="mode-card-icon-wrap" style={{ background: 'rgba(217, 119, 6, 0.1)', color: '#d97706' }}>
              <Wrench size={28} />
            </div>
            <span className="badge mode-card-badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>Field Operations</span>
            <h2 className="mode-card-title">Field Worker Mode</h2>
            <p className="mode-card-desc">
              Dedicated mobile-friendly console for municipal response teams to accept dispatches, navigate to site coordinates, log before/after repair photos, and submit completion reports.
            </p>
            <ul className="mode-card-modules-list">
              <li><CheckCircle2 size={16} /> Real-Time Work Order Queue</li>
              <li><CheckCircle2 size={16} /> Site Coordinate GPS Navigation</li>
              <li><CheckCircle2 size={16} /> Before & After Photographic Evidence</li>
              <li><CheckCircle2 size={16} /> AI Resolution Verification Pipeline</li>
            </ul>
            <Link to="/worker" className="btn btn-warning-solid" id="btn-worker-mode" style={{ background: '#d97706', color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.8rem 1.4rem', borderRadius: 'var(--radius-md)', fontWeight: 700, textDecoration: 'none' }}>
              <span>Enter Worker Mode</span>
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Architecture Foundations Section */}
      <section className="landing-pillars-section">
        <div className="pillars-container">
          <div className="section-header">
            <div className="section-tag">Platform Foundation</div>
            <h2 className="section-title">Built for Scalable Civic Infrastructure</h2>
            <p className="section-subtitle">
              Architected with clean separation of concerns, ready for AI services, Firebase persistence, and live city data pipelines.
            </p>
          </div>

          <div className="pillars-grid">
            <div className="pillar-card">
              <div className="pillar-icon-box">
                <Layers size={22} />
              </div>
              <h3 className="pillar-title">Clean Modular Architecture</h3>
              <p className="pillar-desc">
                Organized component hierarchy allowing independent development of citizen self-service and municipal operations consoles.
              </p>
            </div>

            <div className="pillar-card">
              <div className="pillar-icon-box">
                <Sparkles size={22} />
              </div>
              <h3 className="pillar-title">AI Integration Ready</h3>
              <p className="pillar-desc">
                Prepared data slots for upcoming Gemini multimodal analysis, automated severity categorization, and intelligent routing.
              </p>
            </div>

            <div className="pillar-card">
              <div className="pillar-icon-box">
                <Cpu size={22} />
              </div>
              <h3 className="pillar-title">Institutional Civic Memory</h3>
              <p className="pillar-desc">
                Framework designed to build long-term repository knowledge for repetitive municipal issues and infrastructure durability.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
