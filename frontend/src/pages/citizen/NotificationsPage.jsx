import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  Clock,
  Sparkles,
  Wrench,
  FileCheck2,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { fetchCitizenNotifications, markNotificationAsRead } from '../../services/aiService';
import { useRole } from '../../context/useRole';

function formatNotifTime(dateStr) {
  if (!dateStr) return 'Just now';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Recently';
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Recently';
  }
}

export default function NotificationsPage() {
  const { authUser } = useRole();
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const citizenUid = authUser?.uid || 'demo-citizen';

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchCitizenNotifications(citizenUid);
      setNotifications(data);
    } catch (err) {
      console.warn('Failed to load notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [citizenUid]);

  useEffect(() => {
    let active = true;
    fetchCitizenNotifications(citizenUid)
      .then((data) => {
        if (active) {
          setNotifications(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          console.warn('Failed to load notifications:', err);
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [citizenUid]);

  const handleMarkRead = async (notifId) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n))
    );
    await markNotificationAsRead(notifId);
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    for (const notif of notifications) {
      if (!notif.isRead) {
        await markNotificationAsRead(notif.id);
      }
    }
  };

  return (
    <div className="citizen-page animate-fade-in">
      {/* Header */}
      <div className="module-header">
        <div className="module-title-wrap">
          <div className="module-pretitle">
            <Bell size={16} />
            <span>Updates & Alerts</span>
          </div>
          <h1 className="module-title">Notifications</h1>
          <p className="module-description">
            Live status alerts regarding your civic reports, officer reviews, and verified resolutions.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadNotifications}
            disabled={isLoading}
            style={{ gap: '0.4rem', padding: '0.6rem 1rem' }}
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {notifications.some((n) => !n.isRead) && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleMarkAllRead}
              style={{ gap: '0.4rem', padding: '0.6rem 1rem' }}
            >
              <CheckCircle2 size={16} />
              <span>Mark All as Read</span>
            </button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="empty-state-card animate-pulse">
          <Loader2 size={32} className="animate-spin text-civic" />
          <h3>Checking for civic updates...</h3>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && notifications.length === 0 && (
        <div className="empty-state-card animate-fade-in">
          <Bell size={48} className="text-muted" />
          <h3>No notifications yet</h3>
          <p>
            When municipal officers review your complaints or crews resolve issues, you will receive friendly notifications here.
          </p>
          <Link to="/citizen/report" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            <span>Report a Civic Problem</span>
          </Link>
        </div>
      )}

      {/* Notifications List */}
      {!isLoading && notifications.length > 0 && (
        <div className="citizen-notifications-list">
          {notifications.map((notif) => {
            const isResolved = notif.type === 'resolved';
            const isWork = notif.type === 'work_started';
            const isAssigned = notif.type === 'assigned';

            return (
              <div
                key={notif.id}
                className={`citizen-notification-card ${notif.isRead ? 'read' : 'unread'} ${isResolved ? 'resolved-card' : ''}`}
                onClick={() => !notif.isRead && handleMarkRead(notif.id)}
              >
                <div className="notif-icon-col">
                  {isResolved ? (
                    <div className="notif-icon-circle resolved">
                      <CheckCircle2 size={24} />
                    </div>
                  ) : isWork ? (
                    <div className="notif-icon-circle work">
                      <Wrench size={22} />
                    </div>
                  ) : isAssigned ? (
                    <div className="notif-icon-circle assigned">
                      <FileCheck2 size={22} />
                    </div>
                  ) : (
                    <div className="notif-icon-circle general">
                      <Sparkles size={22} />
                    </div>
                  )}
                </div>

                <div className="notif-content-col">
                  <div className="notif-title-row">
                    <h3 className="notif-title">{notif.title}</h3>
                    <span className="notif-time">
                      <Clock size={13} />
                      {formatNotifTime(notif.createdAt)}
                    </span>
                  </div>

                  <p className="notif-message-text" style={{ whiteSpace: 'pre-line' }}>
                    {notif.message}
                  </p>

                  <div className="notif-footer-row">
                    {notif.reportId && (
                      <span className="notif-report-ref">
                        Ticket: <strong>{notif.reportId}</strong>
                      </span>
                    )}

                    {!notif.isRead && (
                      <span className="unread-dot-badge">New</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
