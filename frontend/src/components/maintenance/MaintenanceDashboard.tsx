import { useState, useEffect, useCallback } from 'react';

// Optional: change API base url if needed, empty string uses relative
const API = '';

interface Job {
  log_id: number;
  bin_id: string;
  bin_street: string;
  bin_area: string;
  bin_ward: string;
  bin_lat: number | null;
  bin_lon: number | null;
  bin_fill: number;
  bin_battery: number;
  issue_type: string;
  notes: string | null;
  priority: string;
  status: string;
  reported_by: string | null;
  worker_id: string | null;
  worker_name: string | null;
  reported_at: string;
  assigned_at: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
}

interface Stats {
  total_open: number;
  in_progress: number;
  resolved_today: number;
  total_resolved: number;
  bins_in_maintenance: number;
  total_workers: number;
  workers_on_job: number;
  avg_resolution_hours: number;
}

interface Worker {
  worker_id: string;
  name: string;
  phone: string;
  zone: string;
  status: string;
  open_jobs: number;
  resolved_total: number;
}

interface Props {
  workerId: string;
  workerName: string;
  zone: string;
  onLogout: () => void;
}

const PRIORITY_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  Critical: { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
  High:     { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' },
  Medium:   { bg: '#fffbeb', text: '#92400e', border: '#fde68a' },
  Low:      { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
};
const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  Open:        { bg: '#fef2f2', text: '#dc2626' },
  'In Progress': { bg: '#eff6ff', text: '#2563eb' },
  Resolved:    { bg: '#f0fdf4', text: '#16a34a' },
};
const PRIORITY_ICON: Record<string, string> = { Critical: '🔴', High: '🟠', Medium: '🟡', Low: '🟢' };

function fmtTime(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function timeSince(iso: string | null) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m ago`;
  return `${m}m ago`;
}

function batteryIcon(pct: number) {
  if (pct > 60) return '🔋';
  if (pct > 20) return '🪫';
  return '⚠️';
}

export default function MaintenanceDashboard({ workerId, workerName, zone, onLogout }: Props) {
  const [tab, setTab] = useState<'myJobs' | 'allJobs' | 'workers' | 'createJob'>('myJobs');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  
  // Create job state
  const [createForm, setCreateForm] = useState({ bin_id: '', issue_type: 'Overflow', notes: '', priority: 'Medium', worker_id: workerId });
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [myRes, allRes, wRes, sRes] = await Promise.all([
        fetch(`${API}/api/maintenance/jobs?worker_id=${workerId}`),
        fetch(`${API}/api/maintenance/jobs`),
        fetch(`${API}/api/maintenance/workers`),
        fetch(`${API}/api/maintenance/stats`),
      ]);
      if (myRes.ok) setJobs(await myRes.json());
      if (allRes.ok) setAllJobs(await allRes.json());
      if (wRes.ok) setWorkers(await wRes.json());
      if (sRes.ok) setStats(await sRes.json());
    } finally {
      setLoading(false);
    }
  }, [workerId]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { const t = setInterval(loadData, 30000); return () => clearInterval(t); }, [loadData]);

  const handleUpdateJob = async (logId: number, status: string) => {
    setActionLoading(true);
    setActionMsg('');
    try {
      const res = await fetch(`${API}/api/maintenance/jobs/${logId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_id: logId, status, worker_id: workerId, resolution_notes: resolveNotes }),
      });
      if (res.ok) {
        setActionMsg(status === 'Resolved' ? '✅ Job resolved! Bin restored to Active.' : '✅ Status updated.');
        setSelectedJob(null);
        setResolveNotes('');
        await loadData();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateJob = async () => {
    setCreateError('');
    setCreateSuccess('');
    if (!createForm.bin_id.trim()) { setCreateError('Bin ID is required.'); return; }
    try {
      const res = await fetch(`${API}/api/maintenance/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      if (res.ok) {
        setCreateSuccess('✅ Maintenance job created successfully.');
        setCreateForm({ ...createForm, bin_id: '', notes: '' });
        await loadData();
      } else {
        const e = await res.json();
        setCreateError(e.detail || 'Failed to create job.');
      }
    } catch {
      setCreateError('Connection error. Is the backend running?');
    }
  };

  const filteredAll = allJobs.filter(j =>
    (filterStatus === '' || j.status === filterStatus) &&
    (filterPriority === '' || j.priority === filterPriority)
  );
  const filteredMy = jobs.filter(j =>
    (filterStatus === '' || j.status === filterStatus) &&
    (filterPriority === '' || j.priority === filterPriority)
  );

  const S = {
    container: {
      minHeight: '100vh', background: '#f5f7fa',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
    } as React.CSSProperties,
    navbar: {
      background: '#fff', borderBottom: '1px solid #e4e9ef',
      padding: '0 28px', height: '62px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      position: 'sticky', top: 0, zIndex: 100,
    } as React.CSSProperties,
    navLeft: { display: 'flex', alignItems: 'center', gap: '14px' } as React.CSSProperties,
    navRight: { display: 'flex', alignItems: 'center', gap: '16px' } as React.CSSProperties,
    logo: {
      width: '36px', height: '36px', borderRadius: '10px',
      background: 'linear-gradient(135deg, #16a34a, #15803d)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '18px',
    } as React.CSSProperties,
    navTitle: { fontSize: '16px', fontWeight: 700, color: '#1a2e1a' } as React.CSSProperties,
    navSub: { fontSize: '12px', color: '#5c7a5c' } as React.CSSProperties,
    badge: (color: string) => ({
      padding: '3px 10px', borderRadius: '20px', fontSize: '11px',
      fontWeight: 600, background: color === 'green' ? '#dcfce7' : '#dbeafe',
      color: color === 'green' ? '#15803d' : '#1d4ed8',
    } as React.CSSProperties),
    logoutBtn: {
      padding: '7px 16px', borderRadius: '8px',
      border: '1.5px solid #e4e9ef', background: '#fff',
      color: '#4b5563', fontSize: '13px', fontWeight: 500,
      cursor: 'pointer', fontFamily: 'inherit',
    } as React.CSSProperties,
    main: { padding: '28px', maxWidth: '1400px', margin: '0 auto' } as React.CSSProperties,
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
      gap: '16px', marginBottom: '28px',
    } as React.CSSProperties,
    statCard: (accent: string) => ({
      background: '#fff', borderRadius: '14px', padding: '20px 22px',
      border: `1.5px solid ${accent}30`,
      borderLeft: `4px solid ${accent}`,
      boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
    } as React.CSSProperties),
    tabs: {
      display: 'flex', gap: '4px', background: '#e9ecef',
      borderRadius: '10px', padding: '4px', marginBottom: '24px',
      width: 'fit-content',
    } as React.CSSProperties,
    tab: (active: boolean) => ({
      padding: '8px 18px', borderRadius: '8px', border: 'none',
      fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
      background: active ? '#fff' : 'transparent',
      color: active ? '#16a34a' : '#6b7280',
      boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
      transition: 'all 0.15s',
    } as React.CSSProperties),
    card: {
      background: '#fff', borderRadius: '14px', padding: '22px',
      border: '1px solid #e4e9ef',
      boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
      marginBottom: '12px',
    } as React.CSSProperties,
    filterBar: {
      display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap' as const,
    } as React.CSSProperties,
    select: {
      padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #d1d5db',
      fontSize: '13px', fontFamily: 'inherit', background: '#fff', color: '#374151',
      outline: 'none', cursor: 'pointer',
    } as React.CSSProperties,
    actionBtn: (color: string, disabled?: boolean) => ({
      padding: '8px 16px', borderRadius: '8px', border: 'none',
      background: disabled ? '#d1fae5' : color === 'green' ? '#16a34a' : color === 'blue' ? '#2563eb' : '#6b7280',
      color: '#fff', fontSize: '13px', fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
      transition: 'all 0.15s', opacity: disabled ? 0.6 : 1,
    } as React.CSSProperties),
  };

  const renderStatCard = (label: string, value: string | number, icon: string, accent: string, sub?: string) => (
    <div style={S.statCard(accent)}>
      <div style={{ fontSize: '22px', marginBottom: '8px' }}>{icon}</div>
      <div style={{ fontSize: '28px', fontWeight: 700, color: '#111827', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: '11px', color: accent, marginTop: '2px' }}>{sub}</div>}
    </div>
  );

  const renderJobCard = (job: Job) => {
    const pc = PRIORITY_COLOR[job.priority] || PRIORITY_COLOR.Medium;
    const sc = STATUS_COLOR[job.status] || STATUS_COLOR.Open;
    const isMyJob = job.worker_id === workerId;
    return (
      <div key={job.log_id} style={{ ...S.card, borderLeft: `4px solid ${pc.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: pc.bg, color: pc.text, border: `1px solid ${pc.border}` }}>
                {PRIORITY_ICON[job.priority]} {job.priority}
              </span>
              <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: sc.bg, color: sc.text }}>
                {job.status}
              </span>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>#{job.log_id}</span>
              {isMyJob && <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>● Assigned to you</span>}
            </div>
            <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 700, color: '#111827' }}>
              🗑 Bin {job.bin_id} — {job.issue_type}
            </h3>
            <div style={{ fontSize: '13px', color: '#4b5563', marginBottom: '4px' }}>
              📍 {job.bin_street}, {job.bin_area} &nbsp;·&nbsp; Ward: {job.bin_ward}
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                Fill: <b style={{ color: job.bin_fill > 80 ? '#dc2626' : '#374151' }}>{job.bin_fill?.toFixed(0)}%</b>
              </span>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                Battery: {batteryIcon(job.bin_battery)} <b style={{ color: job.bin_battery < 20 ? '#dc2626' : '#374151' }}>{job.bin_battery?.toFixed(0)}%</b>
              </span>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                Reported: <b style={{ color: '#374151' }}>{timeSince(job.reported_at)}</b>
              </span>
              {job.notes && (
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                  Notes: <i style={{ color: '#374151' }}>{job.notes}</i>
                </span>
              )}
            </div>
            {job.worker_name && (
              <div style={{ marginTop: '6px', fontSize: '12px', color: '#6b7280' }}>
                👷 Assigned to: <b style={{ color: '#2563eb' }}>{job.worker_name}</b>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '150px' }}>
            {job.status === 'Open' && (
              <button
                onClick={() => handleUpdateJob(job.log_id, 'In Progress')}
                style={S.actionBtn('blue', actionLoading)}
              >
                🔧 Accept Job
              </button>
            )}
            {job.status === 'In Progress' && job.worker_id === workerId && (
              <>
                <button
                  onClick={() => { setSelectedJob(job); setResolveNotes(''); }}
                  style={S.actionBtn('green')}
                >
                  ✅ Mark Resolved
                </button>
              </>
            )}
            {job.status === 'In Progress' && job.worker_id !== workerId && (
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>In progress by {job.worker_name || 'another worker'}</span>
            )}
            {job.status === 'Resolved' && (
              <div style={{ fontSize: '12px', color: '#16a34a' }}>
                ✅ Resolved {fmtTime(job.resolved_at)}
              </div>
            )}
            {job.bin_lat && (
              <a
                href={`https://maps.google.com/?q=${job.bin_lat},${job.bin_lon}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '12px', color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}
              >
                📍 Open in Maps
              </a>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderWorkersTab = () => (
    <div>
      <h3 style={{ margin: '0 0 18px', fontSize: '16px', fontWeight: 700, color: '#111827' }}>Field Team Overview</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {workers.map(w => (
          <div key={w.worker_id} style={{ ...S.card, borderLeft: `4px solid ${w.status === 'On Job' ? '#2563eb' : w.status === 'Off Duty' ? '#9ca3af' : '#16a34a'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>
                  {w.worker_id === workerId ? `👤 ${w.name} (You)` : `👷 ${w.name}`}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>{w.worker_id}</div>
              </div>
              <span style={{
                padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
                background: w.status === 'On Job' ? '#dbeafe' : w.status === 'Off Duty' ? '#f3f4f6' : '#dcfce7',
                color: w.status === 'On Job' ? '#1d4ed8' : w.status === 'Off Duty' ? '#6b7280' : '#15803d',
              }}>
                {w.status}
              </span>
            </div>
            <div style={{ marginTop: '12px', fontSize: '12px', color: '#4b5563', lineHeight: '1.8' }}>
              <div>📞 {w.phone}</div>
              <div>🗺 {w.zone}</div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                <span>🔧 <b style={{ color: '#dc2626' }}>{w.open_jobs}</b> open</span>
                <span>✅ <b style={{ color: '#16a34a' }}>{w.resolved_total}</b> resolved</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderCreateTab = () => (
    <div style={{ maxWidth: '560px' }}>
      <h3 style={{ margin: '0 0 18px', fontSize: '16px', fontWeight: 700, color: '#111827' }}>Log a New Maintenance Job</h3>
      <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', border: '1px solid #e4e9ef', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        {[
          { label: 'Bin ID', field: 'bin_id', type: 'text', placeholder: 'e.g. BIN001', required: true },
        ].map(f => (
          <div key={f.field} style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              {f.label} {f.required && <span style={{ color: '#dc2626' }}>*</span>}
            </label>
            <input
              type={f.type}
              placeholder={f.placeholder}
              value={(createForm as any)[f.field]}
              onChange={e => setCreateForm({ ...createForm, [f.field]: e.target.value })}
              style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: '8px', border: '1.5px solid #d1d5db', fontSize: '14px', fontFamily: 'inherit', outline: 'none' }}
            />
          </div>
        ))}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Issue Type</label>
          <select
            value={createForm.issue_type}
            onChange={e => setCreateForm({ ...createForm, issue_type: e.target.value })}
            style={{ ...S.select, width: '100%' }}
          >
            {['Overflow', 'Damage', 'Sensor Fault', 'Fire Hazard', 'Vandalism', 'Smell / Odour', 'Other'].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: '18px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Priority</label>
          <select
            value={createForm.priority}
            onChange={e => setCreateForm({ ...createForm, priority: e.target.value })}
            style={{ ...S.select, width: '100%' }}
          >
            {['Low', 'Medium', 'High', 'Critical'].map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: '18px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Assign to Worker</label>
          <select
            value={createForm.worker_id}
            onChange={e => setCreateForm({ ...createForm, worker_id: e.target.value })}
            style={{ ...S.select, width: '100%' }}
          >
            <option value="">Unassigned</option>
            {workers.map(w => (
              <option key={w.worker_id} value={w.worker_id}>{w.worker_id} — {w.name}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Notes (optional)</label>
          <textarea
            placeholder="Describe the issue in detail..."
            value={createForm.notes}
            onChange={e => setCreateForm({ ...createForm, notes: e.target.value })}
            rows={3}
            style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: '8px', border: '1.5px solid #d1d5db', fontSize: '14px', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }}
          />
        </div>
        {createError && <div style={{ marginBottom: '14px', padding: '10px 14px', background: '#fef2f2', borderRadius: '8px', color: '#dc2626', fontSize: '13px' }}>⚠ {createError}</div>}
        {createSuccess && <div style={{ marginBottom: '14px', padding: '10px 14px', background: '#f0fdf4', borderRadius: '8px', color: '#16a34a', fontSize: '13px' }}>{createSuccess}</div>}
        <button
          onClick={handleCreateJob}
          style={{ ...S.actionBtn('green'), width: '100%', padding: '13px', fontSize: '14px' }}
        >
          + Create Maintenance Job
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div style={{ ...S.container, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔧</div>
          <div style={{ fontSize: '16px', color: '#6b7280' }}>Loading maintenance portal...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.container}>
      {/* Navbar */}
      <nav style={S.navbar}>
        <div style={S.navLeft}>
          <div style={S.logo}>🔧</div>
          <div>
            <div style={S.navTitle}>EcoBin Maintenance</div>
            <div style={S.navSub}>Municipal Field Services Portal</div>
          </div>
        </div>
        <div style={S.navRight}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{workerName}</div>
            <div style={{ fontSize: '11px', color: '#6b7280' }}>{workerId} · {zone}</div>
          </div>
          <span style={S.badge('green')}>On Duty</span>
          <button onClick={onLogout} style={S.logoutBtn}>Sign Out</button>
        </div>
      </nav>

      <div style={S.main}>
        {/* Stats Row */}
        {stats && (
          <div style={S.statsGrid}>
            {renderStatCard('Open Jobs', stats.total_open, '📂', '#dc2626', 'awaiting action')}
            {renderStatCard('In Progress', stats.in_progress, '🔧', '#2563eb', 'being fixed now')}
            {renderStatCard('Resolved Today', stats.resolved_today, '✅', '#16a34a', 'completed today')}
            {renderStatCard('Bins in Maintenance', stats.bins_in_maintenance, '🗑', '#d97706', 'offline for repair')}
            {renderStatCard('Workers On Job', `${stats.workers_on_job}/${stats.total_workers}`, '👷', '#7c3aed', 'field team')}
            {renderStatCard('Avg Resolution', `${stats.avg_resolution_hours}h`, '⏱', '#0891b2', 'per job')}
          </div>
        )}

        {/* Action Message */}
        {actionMsg && (
          <div style={{ marginBottom: '18px', padding: '12px 18px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0', color: '#15803d', fontSize: '14px', fontWeight: 500 }}>
            {actionMsg}
            <button onClick={() => setActionMsg('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>×</button>
          </div>
        )}

        {/* Resolve Modal */}
        {selectedJob && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} onClick={() => setSelectedJob(null)}>
            <div style={{
              background: '#fff', borderRadius: '16px', padding: '32px', width: '480px', maxWidth: '90vw',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }} onClick={e => e.stopPropagation()}>
              <h3 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 700, color: '#111827' }}>
                ✅ Resolve Maintenance Job
              </h3>
              <p style={{ margin: '0 0 18px', fontSize: '13px', color: '#6b7280' }}>
                Bin <b>{selectedJob.bin_id}</b> — {selectedJob.issue_type} at {selectedJob.bin_street}
              </p>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                  Resolution Notes <span style={{ color: '#9ca3af' }}>(optional but recommended)</span>
                </label>
                <textarea
                  placeholder="Describe what was done to fix the issue..."
                  value={resolveNotes}
                  onChange={e => setResolveNotes(e.target.value)}
                  rows={4}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: '8px', border: '1.5px solid #d1d5db', fontSize: '14px', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => handleUpdateJob(selectedJob.log_id, 'Resolved')}
                  disabled={actionLoading}
                  style={{ ...S.actionBtn('green', actionLoading), flex: 1, padding: '12px' }}
                >
                  {actionLoading ? 'Saving...' : '✅ Confirm Resolved'}
                </button>
                <button onClick={() => setSelectedJob(null)} style={{ ...S.actionBtn('gray'), padding: '12px 20px' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={S.tabs}>
          {([
            { id: 'myJobs', label: `📋 My Jobs (${jobs.filter(j => j.status !== 'Resolved').length})` },
            { id: 'allJobs', label: `📁 All Jobs (${allJobs.length})` },
            { id: 'workers', label: `👷 Team (${workers.length})` },
            { id: 'createJob', label: `+ New Job` },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={S.tab(tab === t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Filter Bar (for job tabs) */}
        {(tab === 'myJobs' || tab === 'allJobs') && (
          <div style={S.filterBar}>
            <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>Filter:</span>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              style={S.select}
            >
              <option value="">All Statuses</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
            </select>
            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
              style={S.select}
            >
              <option value="">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            {(filterStatus || filterPriority) && (
              <button
                onClick={() => { setFilterStatus(''); setFilterPriority(''); }}
                style={{ padding: '8px 14px', borderRadius: '8px', border: '1.5px solid #e4e9ef', background: '#f9fafb', fontSize: '13px', cursor: 'pointer', color: '#6b7280', fontFamily: 'inherit' }}
              >
                Clear Filters ×
              </button>
            )}
            <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: 'auto' }}>
              Auto-refreshes every 30s
            </span>
          </div>
        )}

        {/* Tab Content */}
        {tab === 'myJobs' && (
          <div>
            {filteredMy.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
                <div style={{ fontSize: '15px', fontWeight: 500 }}>No jobs assigned to you</div>
                <div style={{ fontSize: '13px', marginTop: '6px' }}>Accept jobs from the "All Jobs" tab to get started.</div>
              </div>
            ) : (
              filteredMy.map(renderJobCard)
            )}
          </div>
        )}

        {tab === 'allJobs' && (
          <div>
            {filteredAll.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎉</div>
                <div style={{ fontSize: '15px', fontWeight: 500 }}>No maintenance jobs found</div>
                <div style={{ fontSize: '13px', marginTop: '6px' }}>All bins are operating normally.</div>
              </div>
            ) : (
              filteredAll.map(renderJobCard)
            )}
          </div>
        )}

        {tab === 'workers' && renderWorkersTab()}
        {tab === 'createJob' && renderCreateTab()}
      </div>
    </div>
  );
}
