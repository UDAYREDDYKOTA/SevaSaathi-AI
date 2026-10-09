import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Calendar, ShieldCheck, LogOut, FileText, CheckCircle2 } from 'lucide-react';
import { useRole } from '../../context/useRole';
import { getCitizenReports } from '../../firebase/reports';

export default function CitizenProfilePage() {
  const navigate = useNavigate();
  const { authUser, logout } = useRole();
  const [reportCount, setReportCount] = useState(0);
  const [resolvedCount, setResolvedCount] = useState(0);

  const citizenUid = authUser?.uid || 'demo-citizen';

  useEffect(() => {
    async function loadStats() {
      try {
        const reports = await getCitizenReports(citizenUid);
        setReportCount(reports.length);
        setResolvedCount(reports.filter((r) => r.status === 'resolved').length);
      } catch (e) {
        console.warn('Failed to load user stats:', e);
      }
    }
    loadStats();
  }, [citizenUid]);

  const handleSignOut = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="citizen-page animate-fade-in">
      <div className="module-header">
        <div className="module-title-wrap">
          <div className="module-pretitle">
            <User size={16} />
            <span>Citizen Workspace</span>
          </div>
          <h1 className="module-title">Citizen Profile</h1>
          <p className="module-description">
            Your registered civic identity and community participation record.
          </p>
        </div>
      </div>

      <div className="citizen-profile-container">
        {/* Profile Card */}
        <div className="profile-identity-card">
          <div className="profile-avatar-circle">
            <User size={48} />
          </div>
          <h2 className="profile-name">{authUser?.name || 'Varshith'}</h2>
          <span className="profile-role-tag">Public Citizen</span>

          <div className="profile-info-grid">
            <div className="profile-info-row">
              <Mail size={18} />
              <div>
                <span className="info-label">Email Address</span>
                <span className="info-val">{authUser?.email || 'citizen@sevasaathi.gov.in'}</span>
              </div>
            </div>

            <div className="profile-info-row">
              <Calendar size={18} />
              <div>
                <span className="info-label">Age</span>
                <span className="info-val">{authUser?.age || '24'} Years</span>
              </div>
            </div>

            <div className="profile-info-row">
              <ShieldCheck size={18} />
              <div>
                <span className="info-label">Access Jurisdiction</span>
                <span className="info-val">Public Grievance Portal</span>
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="profile-stats-row">
            <div className="stat-card">
              <FileText size={20} color="var(--civic-blue)" />
              <div className="stat-num">{reportCount}</div>
              <div className="stat-desc">Reports Filed</div>
            </div>

            <div className="stat-card">
              <CheckCircle2 size={20} color="var(--success-emerald)" />
              <div className="stat-num">{resolvedCount}</div>
              <div className="stat-desc">Problems Resolved</div>
            </div>
          </div>

          <div className="profile-actions-row">
            <button
              type="button"
              className="btn btn-secondary sign-out-full-btn"
              onClick={handleSignOut}
            >
              <LogOut size={16} />
              <span>Sign Out of Portal</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
