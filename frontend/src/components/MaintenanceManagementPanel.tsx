import React, { useState, useEffect } from 'react';
import { Wrench, CheckCircle, Clock, AlertTriangle, Users, MapPin, QrCode } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

interface Stats {
  total_open: number;
  in_progress: number;
  resolved_today: number;
  avg_resolution_hours: number;
  bins_in_maintenance: number;
  total_workers: number;
  workers_on_job: number;
}

interface Worker {
  worker_id: string;
  name: string;
  zone: string;
  status: string;
  open_jobs: number;
  resolved_total: number;
}

interface Job {
  log_id: number;
  bin_id: string;
  issue_type: string;
  status: string;
  priority: string;
  reported_at: string;
  worker_id: string | null;
  worker_name: string | null;
}

const MaintenanceManagementPanel: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [qrModalWorker, setQrModalWorker] = useState<Worker | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [loadingQR, setLoadingQR] = useState(false);

  const [assignModalJob, setAssignModalJob] = useState<Job | null>(null);
  const [assigningWorkerId, setAssigningWorkerId] = useState<string>('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [stRes, wRes, jRes] = await Promise.all([
        fetch('/api/maintenance/stats'),
        fetch('/api/maintenance/workers'),
        fetch('/api/maintenance/jobs')
      ]);
      const stData = await stRes.json();
      const wData = await wRes.json();
      const jData = await jRes.json();
      
      setStats(stData);
      setWorkers(wData);
      setJobs(jData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchQRToken = async (worker: Worker) => {
    setQrModalWorker(worker);
    setLoadingQR(true);
    setQrToken(null);
    try {
      const res = await fetch(`/api/qr/token/Worker/${worker.worker_id}`);
      const data = await res.json();
      if (data.status === 'success') {
        setQrToken(data.token);
      } else {
        alert("Could not generate QR code.");
      }
    } catch (e) {
      console.error(e);
      alert("Error fetching QR token.");
    } finally {
      setLoadingQR(false);
    }
  };

  const handleAssignJob = async () => {
    if (!assignModalJob || !assigningWorkerId) return;
    try {
      const res = await fetch(`/api/maintenance/jobs/${assignModalJob.log_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worker_id: assigningWorkerId, status: 'In Progress' })
      });
      if (res.ok) {
        setAssignModalJob(null);
        fetchData();
      } else {
        alert("Failed to assign job.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Loading maintenance data...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px', overflowY: 'auto' }}>
      <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 24px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Wrench size={24} color="var(--accent-orange)" />
        Maintenance Management
      </h2>

      {/* KPI Cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={14} /> Open / In Progress
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)' }}>
              {stats.total_open} <span style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-muted)' }}>/ {stats.in_progress}</span>
            </div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle size={14} /> Resolved Today
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent-green)' }}>
              {stats.resolved_today}
            </div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={14} /> Active Workers
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent-cyan)' }}>
              {stats.workers_on_job} <span style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-muted)' }}>/ {stats.total_workers}</span>
            </div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={14} /> Avg Resolution
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent-purple)' }}>
              {stats.avg_resolution_hours.toFixed(1)} <span style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-muted)' }}>hrs</span>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Workers List */}
        <div style={{ background: 'var(--bg-secondary)', borderRadius: '16px', padding: '24px', border: '1px solid var(--border-glass)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} /> Field Team
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {workers.map(w => (
              <div key={w.worker_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{w.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                    <MapPin size={12} /> {w.zone}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: w.status === 'On Job' ? 'var(--accent-orange)' : 'var(--accent-green)' }}>
                      {w.status}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {w.open_jobs} active
                    </div>
                  </div>
                  <button 
                    onClick={() => fetchQRToken(w)}
                    style={{ background: 'var(--accent-cyan-dim)', color: 'var(--accent-cyan)', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Show Worker QR"
                  >
                    <QrCode size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Jobs List */}
        <div style={{ background: 'var(--bg-secondary)', borderRadius: '16px', padding: '24px', border: '1px solid var(--border-glass)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} /> Recent Jobs
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {jobs.map(j => (
              <div key={j.log_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', cursor: j.status === 'Open' ? 'pointer' : 'default' }} onClick={() => j.status === 'Open' && setAssignModalJob(j)}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {j.bin_id} <span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>{j.issue_type}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                    {new Date(j.reported_at).toLocaleString()}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: j.status === 'Resolved' ? 'var(--accent-green)' : j.status === 'In Progress' ? 'var(--accent-orange)' : 'var(--color-danger)' }}>
                    {j.status}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {j.worker_name || 'Unassigned'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* QR Modal */}
      {qrModalWorker && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 2000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'var(--bg-primary)', border: '1px solid var(--border-glass)',
            padding: '30px', borderRadius: '16px', width: '100%', maxWidth: '340px',
            boxShadow: 'var(--shadow-lg)', textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: 'var(--text-primary)', fontWeight: 800 }}>
              Worker QR Code
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 20px 0' }}>
              {qrModalWorker.name} ({qrModalWorker.worker_id})
            </p>
            
            {loadingQR ? (
              <div style={{ color: 'var(--accent-cyan)' }}>Generating Secure QR...</div>
            ) : qrToken ? (
              <div style={{ background: 'white', padding: '16px', borderRadius: '12px', display: 'inline-block' }}>
                <QRCodeCanvas value={qrToken} size={200} level="H" />
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={() => {
                  const canvas = document.querySelector('canvas');
                  if (canvas) {
                    const dataUrl = canvas.toDataURL('image/png');
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(`
                        <html>
                          <head><title>Print Worker QR</title></head>
                          <body style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;margin:0;font-family:sans-serif;">
                            <h2>Worker: ${qrModalWorker.name} (${qrModalWorker.worker_id})</h2>
                            <img src="${dataUrl}" style="width: 300px; height: 300px;" onload="window.print();window.close()" />
                          </body>
                        </html>
                      `);
                      printWindow.document.close();
                    }
                  }
                }}
                style={{ flex: 1, padding: '10px', background: 'var(--accent-cyan)', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                Print QR
              </button>
              <button
                onClick={() => setQrModalWorker(null)}
                style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {assignModalJob && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 2000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'var(--bg-primary)', border: '1px solid var(--border-glass)',
            padding: '30px', borderRadius: '16px', width: '100%', maxWidth: '340px',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: 'var(--text-primary)', fontWeight: 800 }}>
              Assign Job
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 20px 0' }}>
              Bin: {assignModalJob.bin_id} <br/> Issue: {assignModalJob.issue_type}
            </p>

            <select 
              value={assigningWorkerId} 
              onChange={e => setAssigningWorkerId(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', marginBottom: '20px' }}
            >
              <option value="">Select Worker...</option>
              {workers.map(w => (
                <option key={w.worker_id} value={w.worker_id}>{w.name} ({w.zone})</option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setAssignModalJob(null)}
                style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                onClick={handleAssignJob}
                disabled={!assigningWorkerId}
                style={{ flex: 1, padding: '10px', background: 'var(--accent-orange)', border: 'none', color: '#fff', borderRadius: '8px', cursor: assigningWorkerId ? 'pointer' : 'not-allowed', fontWeight: 600, opacity: assigningWorkerId ? 1 : 0.5 }}
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaintenanceManagementPanel;
