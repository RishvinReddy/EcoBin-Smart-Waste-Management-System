import React, { useState } from 'react';
import { Truck, LogIn, AlertCircle, QrCode } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../LanguageSwitcher';
import SmartQRScanner from '../SmartQRScanner';

interface DriverLoginProps {
  onLogin: (truckId: string, driverName: string) => void;
}

const DriverLogin: React.FC<DriverLoginProps> = ({ onLogin }) => {
  const { t } = useTranslation();
  const [truckId, setTruckId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);

  const handleQRSuccess = (_token: string, data: any) => {
    if (data.entity_type === 'Driver' && data.truck_id) {
      localStorage.setItem('driver_truck_id', data.truck_id);
      localStorage.setItem('driver_name', data.driver_name);
      onLogin(data.truck_id, data.driver_name);
    } else {
      setError(t('invalidQR'));
      setShowQR(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!truckId.trim()) {
      setError('Please enter a valid Truck ID.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/driver/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ truck_id: truckId.trim() }),
      });

      if (!response.ok) {
        throw new Error('Invalid Truck ID or Truck is inactive.');
      }

      const data = await response.json();
      
      // Store in local storage to keep logged in
      localStorage.setItem('driver_truck_id', data.truck_id);
      localStorage.setItem('driver_name', data.driver);

      onLogin(data.truck_id, data.driver);
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-primary)',
      fontFamily: 'Outfit, sans-serif'
    }}>
      <div style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-glass)',
        padding: '40px',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: 'var(--shadow-lg)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto',
            boxShadow: 'var(--shadow-glow-cyan)'
          }}>
            <Truck size={32} color="white" />
          </div>
          <div style={{ position: 'absolute', top: 16, right: 16 }}>
            <LanguageSwitcher />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>{t('driverDashboard')} {t('login')}</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '14px' }}>
            Enter your assigned Truck ID to view your route (e.g. TRK-01)
          </p>
        </div>
 
        {error && (
          <div style={{
            background: 'var(--color-danger-dim)',
            border: '1px solid var(--color-danger)',
            borderRadius: '8px',
            padding: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--color-danger)',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}
 
        {showQR ? (
          <div>
            <SmartQRScanner 
              onScanSuccess={handleQRSuccess} 
              onScanError={(err) => setError(err)}
              title={t('scanQR')}
            />
            <button 
              onClick={() => setShowQR(false)}
              style={{ marginTop: '16px', width: '100%', padding: '10px', background: 'transparent', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', borderRadius: '8px', cursor: 'pointer' }}
            >
              Cancel QR Scan
            </button>
          </div>
        ) : (
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Truck ID
              </label>
              <input
                type="text"
                value={truckId}
                onChange={(e) => setTruckId(e.target.value)}
                placeholder="e.g. TRK-01"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '16px',
                  fontFamily: 'JetBrains Mono, monospace',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--accent-cyan)'; e.target.style.boxShadow = '0 0 0 2px var(--accent-cyan-glow)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--border-glass)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
   
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: loading ? 0.7 : 1,
                transition: 'opacity 0.2s',
                fontFamily: 'Outfit, sans-serif',
                marginBottom: '12px'
              }}
            >
              {loading ? 'Authenticating...' : (
                <>
                  <LogIn size={20} />
                  {t('login')}
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowQR(true)}
              style={{
                width: '100%',
                padding: '14px',
                background: 'transparent',
                color: 'var(--accent-cyan)',
                border: '1px solid var(--accent-cyan)',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                fontFamily: 'Outfit, sans-serif'
              }}
            >
              <QrCode size={20} />
              {t('scanQR')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default DriverLogin;
