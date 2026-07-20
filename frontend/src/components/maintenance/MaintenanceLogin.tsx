import { useState } from 'react';
import LanguageSwitcher from '../LanguageSwitcher';
import SmartQRScanner from '../SmartQRScanner';
import { QrCode, LogIn } from 'lucide-react';

interface MaintenanceLoginProps {
  onLogin: (workerId: string, workerName: string, zone: string) => void;
}

const WORKER_HINTS = [
  { id: 'MNT001', name: 'Arun Sharma', zone: 'Banjara Hills / Jubilee Hills' },
  { id: 'MNT002', name: 'Sujatha Devi', zone: 'Begumpet / Secunderabad' },
  { id: 'MNT003', name: 'Ravi Kiran', zone: 'Kukatpally / KPHB' },
  { id: 'MNT004', name: 'Priya Nair', zone: 'LB Nagar / Dilsukhnagar' },
];

export default function MaintenanceLogin({ onLogin }: MaintenanceLoginProps) {
  const [workerId, setWorkerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showQR, setShowQR] = useState(false);

  const handleQRSuccess = (_token: string, data: any) => {
    if (data.entity_type === 'Worker' && data.entity_id) {
      localStorage.setItem('mnt_worker_id', data.entity_id);
      localStorage.setItem('mnt_worker_name', data.worker_name);
      localStorage.setItem('mnt_worker_zone', data.zone || '');
      onLogin(data.entity_id, data.worker_name, data.zone || '');
    } else {
      setError("Invalid QR for Maintenance Worker.");
      setShowQR(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerId.trim()) { setError('Please enter your Worker ID.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/maintenance/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worker_id: workerId.trim().toUpperCase() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Login failed');
      }
      const data = await res.json();
      localStorage.setItem('mnt_worker_id', data.worker_id);
      localStorage.setItem('mnt_worker_name', data.name);
      localStorage.setItem('mnt_worker_zone', data.zone || '');
      onLogin(data.worker_id, data.name, data.zone || '');
    } catch (e: any) {
      setError(e.message || 'Unable to connect to server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f0f4f8 0%, #dce8f0 50%, #e8f4ec 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      padding: '24px',
    }}>
      {/* Background pattern */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(34,197,94,0.06) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(59,130,246,0.06) 0%, transparent 50%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '460px' }}>
        <div style={{ position: 'absolute', top: -40, right: 0 }}>
          <LanguageSwitcher />
        </div>
        {/* Header branding */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '72px', height: '72px', borderRadius: '20px',
            background: 'linear-gradient(135deg, #16a34a, #15803d)',
            boxShadow: '0 8px 32px rgba(22,163,74,0.25)',
            marginBottom: '16px',
          }}>
            <span style={{ fontSize: '32px' }}>🔧</span>
          </div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 700, color: '#1a2e1a', letterSpacing: '-0.4px' }}>
            Maintenance Portal
          </h1>
          <p style={{ margin: '6px 0 0', color: '#5c7a5c', fontSize: '14px' }}>
            EcoBin Smart Waste Management · Field Services
          </p>
        </div>

        {/* Login Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: '20px',
          padding: '40px',
          boxShadow: '0 4px 40px rgba(0,0,0,0.08)',
          border: '1px solid #e8f0e8',
        }}>
          <h2 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 600, color: '#1f3320' }}>
            Worker Sign In
          </h2>
          <p style={{ margin: '0 0 28px', fontSize: '13px', color: '#6b8f6e' }}>
            Enter your assigned Worker ID or Scan QR to access the maintenance dashboard.
          </p>

          {showQR ? (
            <div>
              <SmartQRScanner 
                onScanSuccess={handleQRSuccess} 
                onScanError={(err) => setError(err)}
                title="Scan Worker ID"
              />
              <button 
                onClick={() => setShowQR(false)}
                style={{ marginTop: '16px', width: '100%', padding: '10px', background: 'transparent', border: '1px solid #d1e7d4', color: '#1f3320', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                Cancel QR Scan
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#3d5c40', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Worker ID
                  </label>
                  <input
                    type="text"
                    value={workerId}
                    onChange={e => setWorkerId(e.target.value)}
                    placeholder="e.g. MNT001"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '13px 16px', borderRadius: '10px',
                      border: error ? '1.5px solid #dc2626' : '1.5px solid #d1e7d4',
                      fontSize: '15px', fontFamily: 'inherit',
                      background: '#fafffe', color: '#1a2e1a',
                      outline: 'none', transition: 'border-color 0.2s',
                      letterSpacing: '1px', fontWeight: 500,
                    }}
                    onFocus={e => e.target.style.borderColor = '#16a34a'}
                    onBlur={e => e.target.style.borderColor = error ? '#dc2626' : '#d1e7d4'}
                  />
                  {error && (
                    <div style={{ marginTop: '8px', color: '#dc2626', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>⚠</span> {error}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%', padding: '14px',
                    background: loading ? '#86efac' : 'linear-gradient(135deg, #16a34a, #15803d)',
                    color: '#fff', border: 'none', borderRadius: '10px',
                    fontSize: '15px', fontWeight: 600, fontFamily: 'inherit',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    letterSpacing: '0.3px',
                    boxShadow: loading ? 'none' : '0 4px 14px rgba(22,163,74,0.3)',
                    transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                  }}
                >
                  {loading ? '🔄 Signing in...' : <><LogIn size={18} /> Sign In</>}
                </button>

                <button
                 type="button"
                 onClick={() => setShowQR(true)}
                 style={{
                   width: '100%', marginTop: '12px', padding: '14px',
                   background: 'transparent', color: '#16a34a', border: '1.5px solid #16a34a',
                   borderRadius: '10px', fontSize: '15px', fontWeight: 600, fontFamily: 'inherit',
                   cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                 }}
               >
                 <QrCode size={18} />
                 Scan QR to Login
               </button>
              </form>

              {/* Quick login hints */}
              <div style={{ marginTop: '28px', paddingTop: '24px', borderTop: '1px solid #eef4ee' }}>
                <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#8aaa8d', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Registered Workers
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {WORKER_HINTS.map(w => (
                    <button
                      key={w.id}
                      onClick={() => setWorkerId(w.id)}
                      style={{
                        padding: '10px 12px', borderRadius: '8px',
                        border: '1.5px solid #d1e7d4',
                        background: workerId === w.id ? '#f0fdf4' : '#f9fef9',
                        cursor: 'pointer', textAlign: 'left',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a' }}>{w.id}</div>
                      <div style={{ fontSize: '11px', color: '#4b6e4e', marginTop: '1px' }}>{w.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <a
            href="/"
            style={{ fontSize: '13px', color: '#6b8f6e', textDecoration: 'none', fontWeight: 500 }}
          >
            ← Back to Admin Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
