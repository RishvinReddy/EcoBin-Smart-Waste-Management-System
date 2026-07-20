import React, { useState } from 'react';
import { AlertTriangle, Info, X, Bell, BellOff, CheckCheck } from 'lucide-react';

interface NotificationItem {
  notification_id: number;
  bin_id: string | null;
  severity: 'Critical' | 'Warning' | 'Info';
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationsPanelProps {
  notifications: NotificationItem[];
  onMarkRead: (id: number) => void;
  onMarkAllRead: () => void;
}

const SEVERITY_CONFIG = {
  Critical: { icon: <AlertTriangle size={14} />, color: 'var(--color-danger)', bg: 'var(--color-danger-dim)', border: 'rgba(239,68,68,0.3)' },
  Warning:  { icon: <AlertTriangle size={14} />, color: 'var(--color-warning)', bg: 'var(--color-warning-dim)', border: 'rgba(245,158,11,0.3)' },
  Info:     { icon: <Info size={14} />, color: 'var(--color-info)', bg: 'var(--color-info-dim)', border: 'rgba(59,130,246,0.25)' },
};

const formatTime = (isoString: string) => {
  const dt = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - dt.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ notifications, onMarkRead, onMarkAllRead }) => {
  const [filter, setFilter] = useState<'all' | 'unread' | 'Critical' | 'Warning' | 'Info'>('all');

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'Critical' || filter === 'Warning' || filter === 'Info') return n.severity === filter;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '14px', overflow: 'hidden' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Bell size={18} color="var(--color-warning)" />
          <div>
            <h2 style={{ fontFamily: 'Outfit', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Notifications
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {unreadCount > 0 ? `${unreadCount} unread alerts` : 'All caught up'}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button onClick={onMarkAllRead} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCheck size={13} /> Mark all read
          </button>
        )}
      </div>

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', flexShrink: 0 }}>
        {[
          { key: 'all', label: 'All', count: notifications.length, color: 'var(--text-secondary)' },
          { key: 'unread', label: 'Unread', count: unreadCount, color: 'var(--accent-cyan)' },
          { key: 'Critical', label: 'Critical', count: notifications.filter(n => n.severity === 'Critical').length, color: 'var(--color-danger)' },
          { key: 'Warning', label: 'Warning', count: notifications.filter(n => n.severity === 'Warning').length, color: 'var(--color-warning)' },
        ].map(s => (
          <button key={s.key}
            onClick={() => setFilter(s.key as any)}
            style={{
              padding: '10px', borderRadius: '10px', cursor: 'pointer', border: 'none',
              background: filter === s.key ? `${s.color}18` : 'var(--bg-glass)',
              display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left',
              outline: filter === s.key ? `1px solid ${s.color}40` : '1px solid var(--border-glass)',
              transition: 'all 0.15s ease'
            }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{s.label}</span>
            <span style={{ fontFamily: 'Outfit', fontSize: '20px', fontWeight: 800, color: s.color }}>{s.count}</span>
          </button>
        ))}
      </div>

      {/* Notification Feed */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '2px' }}>
        {filtered.length === 0 ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', color: 'var(--text-muted)', gap: '10px', padding: '40px'
          }}>
            <BellOff size={40} style={{ strokeWidth: 1.2 }} />
            <p style={{ fontSize: '13px', textAlign: 'center' }}>
              {filter === 'unread' ? 'No unread notifications.' : 'No notifications in this category.'}
            </p>
          </div>
        ) : (
          filtered.map(n => {
            const cfg = SEVERITY_CONFIG[n.severity] || SEVERITY_CONFIG.Info;
            return (
              <div key={n.notification_id}
                className={`notif-item ${!n.is_read ? `unread ${n.severity.toLowerCase()}` : ''}`}
                style={{ borderLeftColor: !n.is_read ? cfg.color : 'transparent' }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: cfg.bg, color: cfg.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${cfg.border}`
                }}>
                  {cfg.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: n.is_read ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                      {n.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {formatTime(n.created_at)}
                      </span>
                      {!n.is_read && (
                        <button onClick={() => onMarkRead(n.notification_id)} style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--text-muted)', padding: '2px', display: 'flex', alignItems: 'center'
                        }} title="Mark as read">
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px', lineHeight: 1.5 }}>
                    {n.message}
                  </div>
                  {n.bin_id && (
                    <div style={{ marginTop: '6px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '10px', padding: '2px 7px', borderRadius: '20px',
                        background: cfg.bg, color: cfg.color, fontWeight: 700,
                        fontFamily: 'JetBrains Mono, monospace'
                      }}>{n.bin_id}</span>
                      <span className={`status-badge ${n.severity.toLowerCase()}`}>{n.severity}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default NotificationsPanel;
