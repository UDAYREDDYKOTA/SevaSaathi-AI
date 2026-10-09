import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { FileText, LogOut, UserCheck } from 'lucide-react';
import { useRole } from '../../context/useRole';

export default function MunicipalLayout() {
  const { authUser, logout } = useRole();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.warn('Logout notice:', err);
    }
    navigate('/municipal/login');
  };

  return (
    <div className="municipal-layout">
      {/* Sidebar for Municipal Officer Interface */}
      <aside className="municipal-sidebar" aria-label="Municipal Officer navigation">
        <div className="municipal-sidebar-header">
          <div className="sidebar-dept-tag">Municipal Corporation</div>
          <div className="sidebar-portal-title">Officer Portal</div>
        </div>

        <ul className="municipal-nav-list">
          <li>
            <NavLink
              to="/municipal"
              end
              className={({ isActive }) => `municipal-nav-link ${isActive ? 'active' : ''}`}
            >
              <FileText size={18} />
              <span>Citizen Reports</span>
            </NavLink>
          </li>
        </ul>

        {/* Officer Profile & Logout */}
        <div className="municipal-sidebar-footer">
          <div className="officer-profile-card">
            <div className="officer-profile-info">
              <div className="officer-avatar-badge">
                <UserCheck size={18} />
              </div>
              <div className="officer-text-details">
                <span className="officer-name">{authUser?.name || 'Municipal Officer'}</span>
                <span className="officer-role-label">Municipal Officer</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="btn-officer-logout"
              title="Logout from Officer Console"
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="municipal-content-area">
        <Outlet />
      </main>
    </div>
  );
}
