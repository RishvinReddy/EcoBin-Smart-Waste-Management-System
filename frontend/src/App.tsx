import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import DriverLogin from './components/driver/DriverLogin';
import DriverDashboard from './components/driver/DriverDashboard';
import MaintenanceLogin from './components/maintenance/MaintenanceLogin';
import MaintenanceDashboard from './components/maintenance/MaintenanceDashboard';

function App() {
  const [route, setRoute] = useState(window.location.pathname);

  // Driver session state
  const [driverState, setDriverState] = useState<{truckId: string, driverName: string} | null>(() => {
    const truckId = localStorage.getItem('driver_truck_id');
    const driverName = localStorage.getItem('driver_name');
    if (truckId && driverName) return { truckId, driverName };
    return null;
  });

  // Maintenance worker session state
  const [mntState, setMntState] = useState<{workerId: string, workerName: string, zone: string} | null>(() => {
    const workerId = localStorage.getItem('mnt_worker_id');
    const workerName = localStorage.getItem('mnt_worker_name');
    const zone = localStorage.getItem('mnt_worker_zone') || '';
    if (workerId && workerName) return { workerId, workerName, zone };
    return null;
  });

  useEffect(() => {
    const handlePopState = () => setRoute(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setRoute(path);
  };

  // Driver auth handlers
  const handleDriverLogin = (truckId: string, driverName: string) => {
    setDriverState({ truckId, driverName });
    navigate('/driver/dashboard');
  };
  const handleDriverLogout = () => {
    localStorage.removeItem('driver_truck_id');
    localStorage.removeItem('driver_name');
    setDriverState(null);
    navigate('/driver');
  };

  // Maintenance auth handlers
  const handleMntLogin = (workerId: string, workerName: string, zone: string) => {
    setMntState({ workerId, workerName, zone });
    navigate('/maintenance/dashboard');
  };
  const handleMntLogout = () => {
    localStorage.removeItem('mnt_worker_id');
    localStorage.removeItem('mnt_worker_name');
    localStorage.removeItem('mnt_worker_zone');
    setMntState(null);
    navigate('/maintenance');
  };

  // ── Routing ─────────────────────────────────────────────────
  if (route.startsWith('/driver/dashboard')) {
    if (!driverState) { navigate('/driver'); return null; }
    return <DriverDashboard truckId={driverState.truckId} driverName={driverState.driverName} onLogout={handleDriverLogout} />;
  }
  if (route.startsWith('/driver')) {
    if (driverState) { navigate('/driver/dashboard'); return null; }
    return <DriverLogin onLogin={handleDriverLogin} />;
  }

  if (route.startsWith('/maintenance/dashboard')) {
    if (!mntState) { navigate('/maintenance'); return null; }
    return <MaintenanceDashboard workerId={mntState.workerId} workerName={mntState.workerName} zone={mntState.zone} onLogout={handleMntLogout} />;
  }
  if (route.startsWith('/maintenance')) {
    if (mntState) { navigate('/maintenance/dashboard'); return null; }
    return <MaintenanceLogin onLogin={handleMntLogin} />;
  }

  // Admin dashboard (default route)
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Dashboard />
    </div>
  );
}

export default App;

