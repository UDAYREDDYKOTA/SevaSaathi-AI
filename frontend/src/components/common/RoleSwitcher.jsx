import React, { useState } from 'react';
import { Shield, ChevronDown, Check, User, Building2, Wrench, Settings } from 'lucide-react';
import { useRole } from '../../context/useRole';
import { ROLES, ROLE_DETAILS } from '../../context/roles';

export default function RoleSwitcher() {
  const { currentRole, switchRole, roleInfo } = useRole();
  const [isOpen, setIsOpen] = useState(false);

  const getRoleIcon = (roleId) => {
    switch (roleId) {
      case ROLES.CITIZEN:
        return <User size={13} />;
      case ROLES.OFFICER:
        return <Building2 size={13} />;
      case ROLES.FIELD_WORKER:
        return <Wrench size={13} />;
      case ROLES.ADMIN:
        return <Settings size={13} />;
      default:
        return <Shield size={13} />;
    }
  };

  return (
    <div className="role-switcher-wrapper">
      <button
        type="button"
        className="role-pill-trigger"
        onClick={() => setIsOpen(!isOpen)}
        title="Switch simulated municipal demo role"
      >
        <span className="role-dot" style={{ backgroundColor: roleInfo?.color || '#2563eb' }} />
        <span className="role-label-name">Role: {roleInfo?.name || 'Citizen'}</span>
        <span className="role-demo-tag">DEMO</span>
        <ChevronDown size={12} className={`role-chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="role-menu-backdrop" onClick={() => setIsOpen(false)} />
          <div className="role-dropdown-menu animate-fade-in">
            <div className="role-dropdown-header">
              <span className="role-dd-title">Simulated Demo Roles</span>
              <span className="role-dd-sub">Stage 14 Security & Role Sandbox</span>
            </div>

            <div className="role-options-list">
              {Object.values(ROLE_DETAILS).map((role) => {
                const isActive = currentRole === role.id;
                return (
                  <div
                    key={role.id}
                    className={`role-option-item ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      switchRole(role.id);
                      setIsOpen(false);
                    }}
                  >
                    <div className="role-item-left">
                      <div className="role-item-icon" style={{ color: role.color }}>
                        {getRoleIcon(role.id)}
                      </div>
                      <div className="role-item-details">
                        <div className="role-item-header">
                          <strong className="role-item-title">{role.name}</strong>
                          <span className="role-item-user">({role.user})</span>
                        </div>
                        <span className="role-item-desc">{role.label}</span>
                      </div>
                    </div>
                    {isActive && <Check size={14} className="role-check-icon" />}
                  </div>
                );
              })}
            </div>

            <div className="role-dropdown-footer">
              <span className="role-note-text">
                Rules enforce permissions per role in Firestore. AI outputs cannot be modified by citizen role.
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
