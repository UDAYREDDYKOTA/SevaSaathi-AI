import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, Bell, User, ArrowRight, ShieldCheck } from 'lucide-react';
import { useRole } from '../../context/useRole';

export default function CitizenHomePage() {
  const { authUser } = useRole();
  const citizenName = authUser?.name || 'Citizen';

  return (
    <div className="citizen-page animate-fade-in">
      {/* 1. Header & Subtitle per Requirement 4 */}
      <div className="citizen-home-header">
        <h1 className="citizen-home-greeting">
          Hello, {citizenName} 👋
        </h1>
        <p className="citizen-home-subtitle">
          How can we help improve your community?
        </p>
      </div>

      {/* 2. Primary Large Button: REPORT A PROBLEM */}
      <div className="citizen-hero-report-card">
        <div className="hero-report-content">
          <div className="hero-report-badge">
            <span className="pulse-dot"></span>
            <span>Civic Assistance Active</span>
          </div>
          <h2 className="hero-report-title">
            Spot an issue in your street or neighborhood?
          </h2>
          <p className="hero-report-desc">
            Take a photo and report potholes, blocked drains, water leaks, garbage, or dark streetlights.
            Our AI analyzes and connects your complaint directly to the responsible municipal team.
          </p>

          <Link
            to="/citizen/report"
            className="btn-large-report"
            id="btn-report-problem-primary"
          >
            <span className="report-emoji">🚨</span>
            <span className="report-label">REPORT A PROBLEM</span>
            <ArrowRight size={22} />
          </Link>
        </div>
      </div>

      {/* 3. Other Simple Options Grid */}
      <div className="citizen-simple-options-grid">
        {/* My Reports */}
        <Link to="/citizen/my-reports" className="simple-option-card">
          <div className="option-icon-wrap" style={{ background: '#eff6ff', color: '#2563eb' }}>
            <FileText size={28} />
          </div>
          <div className="option-text-wrap">
            <h3 className="option-title">My Reports</h3>
            <p className="option-desc">
              Track the live progress of your complaints from AI analysis to field resolution.
            </p>
          </div>
          <div className="option-arrow">
            <ArrowRight size={20} />
          </div>
        </Link>

        {/* Notifications */}
        <Link to="/citizen/notifications" className="simple-option-card">
          <div className="option-icon-wrap" style={{ background: '#f0fdf4', color: '#16a34a' }}>
            <Bell size={28} />
          </div>
          <div className="option-text-wrap">
            <h3 className="option-title">Notifications</h3>
            <p className="option-desc">
              Get real-time updates when officers review, crews start work, and issues are resolved.
            </p>
          </div>
          <div className="option-arrow">
            <ArrowRight size={20} />
          </div>
        </Link>

        {/* Profile */}
        <Link to="/citizen/profile" className="simple-option-card">
          <div className="option-icon-wrap" style={{ background: '#faf5ff', color: '#9333ea' }}>
            <User size={28} />
          </div>
          <div className="option-text-wrap">
            <h3 className="option-title">Profile</h3>
            <p className="option-desc">
              View your registered citizen details, age, and account settings.
            </p>
          </div>
          <div className="option-arrow">
            <ArrowRight size={20} />
          </div>
        </Link>
      </div>

      {/* Simple Community Trust Footer Note */}
      <div className="citizen-trust-banner">
        <ShieldCheck size={20} className="trust-icon" />
        <span>
          Every report is logged to the municipal grievance ledger. Complex AI behind the scenes, simple experience in front.
        </span>
      </div>
    </div>
  );
}
