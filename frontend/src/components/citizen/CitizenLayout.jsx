import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Home, AlertCircle, FileText, Bell, User } from 'lucide-react';

export default function CitizenLayout() {
  const navItems = [
    { to: '/citizen', label: 'Home', icon: Home, end: true },
    { to: '/citizen/report', label: 'Report a Problem', icon: AlertCircle },
    { to: '/citizen/my-reports', label: 'My Reports', icon: FileText },
    { to: '/citizen/notifications', label: 'Notifications', icon: Bell },
    { to: '/citizen/profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="citizen-layout animate-fade-in">
      {/* Citizen Navigation Bar */}
      <nav className="citizen-nav-bar" aria-label="Citizen portal navigation">
        <div className="citizen-nav-inner">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `citizen-nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="citizen-main-content">
        <Outlet />
      </main>
    </div>
  );
}
