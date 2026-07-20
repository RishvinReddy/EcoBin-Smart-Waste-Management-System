import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Map, Navigation, BarChart3, Trash2, RefreshCw, Sparkles,
  Database, Bell, Settings, Truck, Activity, Play,
  AlertTriangle, TrendingUp, Info, Wind, Plus, Wrench
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';

import MapComponent from './MapComponent';
import Analytics from './Analytics';
import BinsTable from './BinsTable';
import FleetPanel from './FleetPanel';
import PredictionPanel from './PredictionPanel';
import NotificationsPanel from './NotificationsPanel';
import SimulationControls from './SimulationControls';
import StreetRoutePanel from './StreetRoutePanel';
import MaintenanceManagementPanel from './MaintenanceManagementPanel';
import { sendEmailAlert } from '../utils/emailjs';

// ─── Types ────────────────────────────────────────────────────

type Tab = 'overview' | 'map' | 'routes' | 'bins' | 'fleet' | 'prediction' | 'analytics' | 'notifications' | 'simulation' | 'maintenance';

interface OsrmStep {
  name: string;
  distance: number;
  duration: number;
  maneuver: { type: string; modifier?: string };
}

interface StreetRoute {
  coords: [number, number][];
  steps: OsrmStep[];
  totalDistanceM: number;
  totalDurationS: number;
  snapped: boolean;
}

interface BinData {
  bin_id: string; latitude: number; longitude: number;
  street_name?: string; area_name?: string; ward?: string; ward_number?: number;
  area_type: string; capacity: number;
  current_fill_percentage?: number; predicted_fill?: number;
  overflow_probability?: number; priority_score?: number;
  battery_level?: number; signal_strength?: number; temperature?: number;
  status?: string; last_updated?: string; last_collection_time?: string;
  installation_date?: string;
}

interface BinDetail extends BinData {
  history_7d: {
    timestamp: string; fill_percentage: number;
    temperature?: number | null; rainfall?: number; waste_generated?: number;
  }[];
  prediction_tomorrow: { prediction_time: string; predicted_fill: number; overflow_probability: number } | null;
}

interface RouteData {
  route_id?: number; truck_id: string; driver: string;
  distance_km: number; fuel_liters: number; duration_hours: number;
  path: { bin_id: string; latitude: number; longitude: number; load_at_node: number }[];
  plate_number?: string;
}

interface TruckData {
  truck_id: string; plate_number?: string; capacity: number; driver: string;
  status: string; current_latitude?: number; current_longitude?: number;
  has_route: boolean; route_bins: number;
}

interface NotificationItem {
  notification_id: number; bin_id: string | null; severity: 'Critical' | 'Warning' | 'Info';
  title: string; message: string; is_read: boolean; created_at: string;
}

interface PredictionItem {
  bin_id: string; street_name?: string; area_name?: string; ward?: string;
  area_type: string; capacity: number; current_fill_percentage: number;
  predicted_fill: number; overflow_probability: number; priority_score: number;
  latitude: number; longitude: number;
}

// ─── Sparkline ────────────────────────────────────────────────

const SparkChart: React.FC<{ data: { value: number }[]; color: string }> = ({ data, color }) => (
  <ResponsiveContainer width="100%" height={40}>
    <AreaChart data={data} margin={{ top: 2, right: 2, left: -30, bottom: 2 }}>
      <defs>
        <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={color} stopOpacity={0.3} />
          <stop offset="95%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5}
        fill={`url(#sg-${color.replace('#', '')})`} dot={false} />
    </AreaChart>
  </ResponsiveContainer>
);

// ─── Custom Tooltip ───────────────────────────────────────────

const DarkTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="custom-tooltip">
        <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{label}</p>
        {payload.map((e: any, i: number) => (
          <p key={i} style={{ color: e.color }}>{e.name}: <strong style={{ color: '#fff' }}>{e.value}</strong></p>
        ))}
      </div>
    );
  }
  return null;
};

// ─── Dashboard ───────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [bins, setBins] = useState<BinData[]>([]);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [trucks, setTrucks] = useState<TruckData[]>([]);
  const [predictions, setPredictions] = useState<PredictionItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [selectedBinId, setSelectedBinId] = useState<string | null>(null);
  const [selectedBinDetail, setSelectedBinDetail] = useState<BinDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [simRunning, setSimRunning] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1.0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [liveUpdates, setLiveUpdates] = useState<Record<string, { fill: number; timestamp: string }>>({});
  const [streetRoutes, setStreetRoutes] = useState<Record<string, StreetRoute>>({});
  const [fetchingRoutes, setFetchingRoutes] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Modals state
  const [showAddBinModal, setShowAddBinModal] = useState(false);
  const [showAddTruckModal, setShowAddTruckModal] = useState(false);

  // Edit Mode States
  const [isEditModeBin, setIsEditModeBin] = useState(false);
  const [isEditModeTruck, setIsEditModeTruck] = useState(false);
  const [editBinStatus, setEditBinStatus] = useState('Active');
  const [editTruckStatus, setEditTruckStatus] = useState('Idle');

  // New Bin Form State
  const [newBinId, setNewBinId] = useState('');
  const [newBinLat, setNewBinLat] = useState('17.4156');
  const [newBinLon, setNewBinLon] = useState('78.4486');
  const [newBinStreet, setNewBinStreet] = useState('');
  const [newBinArea, setNewBinArea] = useState('Banjara Hills');
  const [newBinWard, setNewBinWard] = useState('Ward-10');
  const [newBinWardNum, setNewBinWardNum] = useState(10);
  const [newBinAreaType, setNewBinAreaType] = useState('Residential');
  const [newBinCapacity, setNewBinCapacity] = useState(240);
  const [addingBin, setAddingBin] = useState(false);

  // New Truck Form State
  const [newTruckId, setNewTruckId] = useState('');
  const [newTruckPlate, setNewTruckPlate] = useState('');
  const [newTruckCapacity, setNewTruckCapacity] = useState(5000);
  const [newDriverId, setNewDriverId] = useState('');
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverPhone, setNewDriverPhone] = useState('');
  const [newDriverLicense, setNewDriverLicense] = useState('');
  const [addingTruck, setAddingTruck] = useState(false);

  const handleAddBin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBinId.trim()) return alert('Please enter Bin ID');
    setAddingBin(true);
    try {
      const res = await fetch('/api/bins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bin_id: newBinId.trim().toUpperCase(),
          latitude: parseFloat(newBinLat),
          longitude: parseFloat(newBinLon),
          street_name: newBinStreet || 'Main Road',
          area_name: newBinArea,
          ward: newBinWard,
          ward_number: Number(newBinWardNum),
          area_type: newBinAreaType,
          capacity: Number(newBinCapacity)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to add bin');
      
      alert(`Bin ${newBinId.trim().toUpperCase()} added successfully!`);
      setShowAddBinModal(false);
      setNewBinId('');
      setNewBinStreet('');
      fetchAll();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setAddingBin(false);
    }
  };

  const handleAddTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTruckId.trim()) return alert('Please enter Truck ID');
    if (!newDriverId.trim()) return alert('Please enter Driver ID');
    setAddingTruck(true);
    try {
      const res = await fetch('/api/trucks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          truck_id: newTruckId.trim().toUpperCase(),
          plate_number: newTruckPlate.trim().toUpperCase() || 'TS09EA0000',
          capacity: Number(newTruckCapacity),
          driver_id: newDriverId.trim().toUpperCase(),
          driver_name: newDriverName || 'Unnamed Driver',
          driver_phone: newDriverPhone,
          driver_license: newDriverLicense
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to add truck');
      alert(`Truck ${newTruckId.trim().toUpperCase()} and Driver ${newDriverName} added successfully!`);
      
      // Send EmailJS Welcome Notification
      sendEmailAlert(
        "🎉 Welcome to Smart Waste Fleet",
        `Hello ${newDriverName || 'Driver'},`,
        "Your driver account and truck have been successfully registered on the Smart Waste Management System.",
        `Driver ID: ${newDriverId.trim().toUpperCase()}\nTruck ID: ${newTruckId.trim().toUpperCase()}\nPlate Number: ${newTruckPlate.trim().toUpperCase() || 'TS09EA0000'}`
      );
      
      setShowAddTruckModal(false);
      setNewTruckId('');
      setNewTruckPlate('');
      setNewDriverId('');
      setNewDriverName('');
      setNewDriverPhone('');
      setNewDriverLicense('');
      fetchAll();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setAddingTruck(false);
    }
  };

  const handleOpenEditBinModal = (bin: BinDetail) => {
    setNewBinId(bin.bin_id);
    setNewBinLat(String(bin.latitude));
    setNewBinLon(String(bin.longitude));
    setNewBinStreet(bin.street_name || '');
    setNewBinArea(bin.area_name || '');
    setNewBinWard(bin.ward || '');
    setNewBinWardNum(bin.ward_number || 0);
    setNewBinAreaType(bin.area_type);
    setNewBinCapacity(bin.capacity);
    setEditBinStatus(bin.status || 'Active');
    setIsEditModeBin(true);
    setShowAddBinModal(true);
  };

  const handleOpenEditTruckModal = (truck: any) => {
    setNewTruckId(truck.truck_id);
    setNewTruckPlate(truck.plate_number || '');
    setNewTruckCapacity(truck.capacity);
    setNewDriverId(truck.driver_id || '');
    setNewDriverName(truck.driver || '');
    setNewDriverPhone(truck.driver_phone || '');
    setNewDriverLicense(truck.driver_license || '');
    setEditTruckStatus(truck.status || 'Idle');
    setIsEditModeTruck(true);
    setShowAddTruckModal(true);
  };

  const handleEditBin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingBin(true);
    try {
      const res = await fetch(`/api/bins/${newBinId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: parseFloat(newBinLat),
          longitude: parseFloat(newBinLon),
          street_name: newBinStreet || 'Main Road',
          area_name: newBinArea,
          ward: newBinWard,
          ward_number: Number(newBinWardNum),
          area_type: newBinAreaType,
          capacity: Number(newBinCapacity),
          status: editBinStatus
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to update bin');
      
      alert(`Bin ${newBinId} updated successfully!`);
      setShowAddBinModal(false);
      setIsEditModeBin(false);
      setNewBinId('');
      setNewBinStreet('');
      
      if (selectedBinId === newBinId) {
        setSelectedBinId(null);
        setTimeout(() => setSelectedBinId(newBinId), 100);
      }
      fetchAll();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setAddingBin(false);
    }
  };

  const handleEditTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingTruck(true);
    try {
      const res = await fetch(`/api/trucks/${newTruckId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plate_number: newTruckPlate.trim().toUpperCase() || 'TS09EA0000',
          capacity: Number(newTruckCapacity),
          driver_id: newDriverId.trim().toUpperCase(),
          driver_name: newDriverName || 'Unnamed Driver',
          driver_phone: newDriverPhone,
          driver_license: newDriverLicense,
          status: editTruckStatus
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to update truck');
      
      alert(`Truck ${newTruckId} updated successfully!`);
      setShowAddTruckModal(false);
      setIsEditModeTruck(false);
      setNewTruckId('');
      setNewTruckPlate('');
      setNewDriverId('');
      setNewDriverName('');
      setNewDriverPhone('');
      setNewDriverLicense('');
      fetchAll();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setAddingTruck(false);
    }
  };

  // ── Data Fetching ──────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    try {
      const [binsRes, predRes, routesRes, trucksRes, notifRes, analyticsRes] = await Promise.all([
        fetch('/api/bins'), fetch('/api/predictions'), fetch('/api/routes'),
        fetch('/api/trucks'), fetch('/api/notifications?limit=50'),
        fetch('/api/analytics'),
      ]);

      const [binsData, predData, routesData, trucksData, notifData, analyticsVal] = await Promise.all([
        binsRes.json(), predRes.json(), routesRes.json(),
        trucksRes.json(), notifRes.json(), analyticsRes.json(),
      ]);

      const mergedBins = binsData.map((b: BinData) => {
        const pred = predData.find((p: PredictionItem) => p.bin_id === b.bin_id);
        return { ...b, predicted_fill: pred?.predicted_fill, overflow_probability: pred?.overflow_probability, priority_score: pred?.priority_score };
      });

      setBins(mergedBins);
      setRoutes(routesData);
      setTrucks(trucksData);
      setPredictions(predData);
      setNotifications(notifData);
      setAnalyticsData(analyticsVal);
      setUnreadCount(notifData.filter((n: NotificationItem) => !n.is_read).length);

      if (analyticsVal?.system_stats) {
        setSimRunning(analyticsVal.system_stats.simulation_running ?? false);
        setSimSpeed(analyticsVal.system_stats.simulation_speed ?? 1.0);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Periodic refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // ── OSRM Street Route Fetch (shared between Map + StreetRoutePanel) ─

  const fetchStreetRoutes = useCallback(async (routeList: RouteData[]) => {
    if (!routeList || routeList.length === 0) { setStreetRoutes({}); return; }
    setFetchingRoutes(true);

    const results = await Promise.allSettled(
      routeList.map(async (route) => {
        const stops = route.path.filter(n => n.latitude && n.longitude);
        if (stops.length < 2) return { truck_id: route.truck_id, result: null };

        try {
          const coordStr = stops.map(s => `${s.longitude},${s.latitude}`).join(';');
          const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson&steps=true`;
          const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();

          if (data.code === 'Ok' && data.routes?.[0]) {
            const osrmRoute = data.routes[0];
            const coords: [number, number][] = osrmRoute.geometry.coordinates.map(
              (c: [number, number]) => [c[1], c[0]] as [number, number]
            );
            const steps = (osrmRoute.legs ?? []).flatMap((leg: any) =>
              (leg.steps ?? []).map((s: any) => ({
                name: s.name ?? '',
                distance: s.distance ?? 0,
                duration: s.duration ?? 0,
                maneuver: s.maneuver ?? { type: 'straight' },
              }))
            );
            return {
              truck_id: route.truck_id,
              result: {
                coords, steps,
                totalDistanceM: osrmRoute.distance ?? 0,
                totalDurationS: osrmRoute.duration ?? 0,
                snapped: true,
              } as StreetRoute,
            };
          }
        } catch (err) {
          console.warn(`[OSRM] ${route.truck_id}:`, err);
        }

        // Straight-line fallback
        return {
          truck_id: route.truck_id,
          result: {
            coords: stops.map(s => [s.latitude, s.longitude] as [number, number]),
            steps: [],
            totalDistanceM: route.distance_km * 1000,
            totalDurationS: route.duration_hours * 3600,
            snapped: false,
          } as StreetRoute,
        };
      })
    );

    const newRoutes: Record<string, StreetRoute> = {};
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value?.result) {
        newRoutes[r.value.truck_id] = r.value.result;
      }
    }
    setStreetRoutes(newRoutes);
    setFetchingRoutes(false);
  }, []);

  // Trigger OSRM fetch whenever routes change
  useEffect(() => {
    if (routes.length > 0) fetchStreetRoutes(routes);
  }, [routes, fetchStreetRoutes]);

  // ── WebSocket Live Updates ─────────────────────────────────

  useEffect(() => {
    const connectWs = () => {
      const ws = new WebSocket('ws://127.0.0.1:8000/ws/live');
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'bin_update') {
            setLiveUpdates(prev => ({ ...prev, [msg.bin_id]: { fill: msg.fill_percentage, timestamp: msg.timestamp } }));
            setBins(prev => prev.map(b =>
              b.bin_id === msg.bin_id ? { ...b, current_fill_percentage: msg.fill_percentage, last_updated: msg.timestamp } : b
            ));
            if (msg.is_critical) {
              setUnreadCount(c => c + 1);
            }
          }
        } catch { /* ignore parse errors */ }
      };

      ws.onclose = () => setTimeout(connectWs, 3000);
      ws.onerror = () => ws.close();
    };

    connectWs();
    return () => wsRef.current?.close();
  }, []);

  // ── Bin Inspector ──────────────────────────────────────────

  useEffect(() => {
    if (!selectedBinId) { setSelectedBinDetail(null); return; }
    fetch(`/api/bins/${selectedBinId}`)
      .then(r => r.json())
      .then(setSelectedBinDetail)
      .catch(console.error);
  }, [selectedBinId]);

  // ── Actions ────────────────────────────────────────────────

  const runAction = async (key: string, method: string, url: string, body?: object) => {
    setActionLoading(key);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error');
      await fetchAll();
      return data;
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartSim = async (speed: number) => {
    await runAction('sim_start', 'POST', '/api/simulate/start', { speed });
    setSimRunning(true); setSimSpeed(speed);
  };

  const handleStopSim = async () => {
    await runAction('sim_stop', 'POST', '/api/simulate/stop');
    setSimRunning(false);
  };

  const handleResetSim = async () => {
    if (!confirm('Reset all bin fill levels to 0-15%?')) return;
    await runAction('sim_reset', 'POST', '/api/simulate/reset');
  };

  const handleMarkRead = async (id: number) => {
    await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
    setNotifications(prev => prev.map(n => n.notification_id === id ? { ...n, is_read: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));
  };

  const handleMarkAllRead = async () => {
    await fetch('/api/notifications/mark-all-read', { method: 'PUT' });
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  // ── Derived Stats ──────────────────────────────────────────

  const criticalBins = bins.filter(b => (b.current_fill_percentage ?? 0) >= 80).length;
  const avgFill = bins.length > 0 ? bins.reduce((s, b) => s + (b.current_fill_percentage ?? 0), 0) / bins.length : 0;
  const distanceSaved = analyticsData?.savings?.distance_km ?? 48.6;
  const fuelSaved = analyticsData?.savings?.fuel_liters ?? 14.5;
  const co2Saved = analyticsData?.savings?.co2_kg ?? 38.9;
  const criticalPredictions = predictions.filter(p => p.predicted_fill >= 80).length;

  // ── Navigation Config ──────────────────────────────────────

  const NAV_ITEMS: { key: Tab; icon: React.ReactNode; label: string; color?: string; badge?: number }[] = [
    { key: 'overview',      icon: <Activity size={16} />,    label: 'Overview',       color: 'cyan' },
    { key: 'map',           icon: <Map size={16} />,          label: 'Live GIS Map',   color: 'cyan' },
    { key: 'routes',        icon: <Navigation size={16} />,  label: 'Street Routes',  color: 'cyan' },
    { key: 'bins',          icon: <Trash2 size={16} />,       label: 'Smart Bins',     color: 'green' },
    { key: 'fleet',         icon: <Truck size={16} />,        label: 'Fleet Manager',  color: 'purple' },
    { key: 'prediction',    icon: <Sparkles size={16} />,     label: 'AI Prediction',  color: 'orange' },
    { key: 'maintenance',   icon: <Wrench size={16} />,       label: 'Maintenance',    color: 'orange' },
    { key: 'analytics',     icon: <BarChart3 size={16} />,    label: 'Analytics',      color: 'green' },
    { key: 'notifications', icon: <Bell size={16} />,         label: 'Notifications',  color: 'yellow', badge: unreadCount },
    { key: 'simulation',    icon: simRunning ? <Play size={16} /> : <Settings size={16} />, label: 'Simulation', color: simRunning ? 'green' : 'pink' },
  ];

  // ── Render Helper ──────────────────────────────────────────

  const getFillBarColor = (fill: number) => fill >= 80 ? 'red' : fill >= 50 ? 'yellow' : 'green';

  // ── Bin Inspector Panel ────────────────────────────────────

  const renderInspector = () => (
    <div className="inspector-panel">
      <div className="inspector-header">
        <Info size={16} color="var(--accent-cyan)" />
        <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '15px' }}>Bin Inspector</span>
        {selectedBinId && (
          <button onClick={() => setSelectedBinId(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            ✕
          </button>
        )}
      </div>

      {!selectedBinDetail ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', padding: '24px', textAlign: 'center', gap: '10px' }}>
          <Trash2 size={36} style={{ strokeWidth: 1.2 }} />
          <p style={{ fontSize: '13px' }}>Click any bin marker on the map or a bin row in the table to inspect it.</p>
        </div>
      ) : (
        <div className="inspector-body">
          {/* Bin ID + Area */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '20px', color: 'var(--text-primary)' }}>
              {selectedBinDetail.bin_id}
            </span>
            <span style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: 'var(--accent-cyan-dim)', color: 'var(--accent-cyan)' }}>
              {selectedBinDetail.area_type}
            </span>
          </div>

          {/* Current Fill */}
          <div className="inspector-section" style={{ background: selectedBinDetail.current_fill_percentage && selectedBinDetail.current_fill_percentage >= 80 ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.02)' }}>
            <div className="inspector-section-title">Live Fill Level</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Current:</span>
              <span style={{
                fontFamily: 'Outfit', fontSize: '28px', fontWeight: 800,
                color: selectedBinDetail.current_fill_percentage && selectedBinDetail.current_fill_percentage >= 80 ? 'var(--color-danger)' :
                       selectedBinDetail.current_fill_percentage && selectedBinDetail.current_fill_percentage >= 50 ? 'var(--color-warning)' : 'var(--color-success)'
              }}>{(selectedBinDetail.current_fill_percentage ?? 0).toFixed(1)}%</span>
            </div>
            <div className="fill-bar-container" style={{ height: '8px', marginTop: '4px' }}>
              <div className={`fill-bar ${getFillBarColor(selectedBinDetail.current_fill_percentage ?? 0)}`}
                style={{ width: `${selectedBinDetail.current_fill_percentage ?? 0}%` }} />
            </div>
          </div>

          {/* Location */}
          <div className="inspector-section">
            <div className="inspector-section-title">Location</div>
            <div className="inspector-row">
              <span className="inspector-key">Street</span>
              <span className="inspector-val" style={{ fontSize: '11px' }}>{selectedBinDetail.street_name || '—'}</span>
            </div>
            <div className="inspector-row">
              <span className="inspector-key">Area</span>
              <span className="inspector-val">{selectedBinDetail.area_name}</span>
            </div>
            <div className="inspector-row">
              <span className="inspector-key">Ward</span>
              <span className="inspector-val">{selectedBinDetail.ward}</span>
            </div>
            <div className="inspector-row">
              <span className="inspector-key">GPS</span>
              <span className="inspector-val" style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace' }}>
                {selectedBinDetail.latitude?.toFixed(4)}, {selectedBinDetail.longitude?.toFixed(4)}
              </span>
            </div>
          </div>

          {/* IoT Sensor Status */}
          <div className="inspector-section">
            <div className="inspector-section-title">IoT Sensor Status</div>
            {[
              { label: 'Capacity', value: `${selectedBinDetail.capacity} L` },
              { label: 'Battery', value: `${(selectedBinDetail.battery_level ?? 100).toFixed(0)}%` },
              { label: 'Signal', value: `${selectedBinDetail.signal_strength ?? 90}%` },
              { label: 'Temperature', value: selectedBinDetail.temperature ? `${selectedBinDetail.temperature.toFixed(1)}°C` : '—' },
              { label: 'Installed', value: selectedBinDetail.installation_date || '—' },
              { label: 'Last Update', value: selectedBinDetail.last_updated ? new Date(selectedBinDetail.last_updated).toLocaleString('en-IN') : '—' },
              { label: 'Last Collected', value: selectedBinDetail.last_collection_time ? new Date(selectedBinDetail.last_collection_time).toLocaleString('en-IN') : 'Not collected' },
            ].map(r => (
              <div className="inspector-row" key={r.label}>
                <span className="inspector-key">{r.label}</span>
                <span className="inspector-val" style={{ fontSize: '11px' }}>{r.value}</span>
              </div>
            ))}
          </div>

          {/* 24h Prediction */}
          {selectedBinDetail.prediction_tomorrow && (
            <div className="inspector-section" style={{
              background: selectedBinDetail.prediction_tomorrow.predicted_fill >= 80 ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${selectedBinDetail.prediction_tomorrow.predicted_fill >= 80 ? 'rgba(239,68,68,0.2)' : 'var(--border-glass)'}`
            }}>
              <div className="inspector-section-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={11} color="var(--accent-orange)" /> 24h AI Forecast
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Predicted Fill:</span>
                <span style={{
                  fontFamily: 'Outfit', fontSize: '22px', fontWeight: 800,
                  color: selectedBinDetail.prediction_tomorrow.predicted_fill >= 80 ? 'var(--color-danger)' :
                         selectedBinDetail.prediction_tomorrow.predicted_fill >= 50 ? 'var(--color-warning)' : 'var(--color-success)'
                }}>{selectedBinDetail.prediction_tomorrow.predicted_fill.toFixed(1)}%</span>
              </div>
              <div className="inspector-row">
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Overflow Prob:</span>
                <strong style={{ fontSize: '14px', color: selectedBinDetail.prediction_tomorrow.overflow_probability >= 70 ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                  {selectedBinDetail.prediction_tomorrow.overflow_probability.toFixed(1)}%
                </strong>
              </div>
              {selectedBinDetail.prediction_tomorrow.predicted_fill >= 80 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-danger)', fontSize: '11px', fontWeight: 700, marginTop: '4px' }}>
                  <AlertTriangle size={12} /> Scheduled for next collection
                </div>
              )}
            </div>
          )}

          {/* 7-Day History Sparkline */}
          {selectedBinDetail.history_7d && selectedBinDetail.history_7d.length > 0 && (
            <div className="inspector-section">
              <div className="inspector-section-title">7-Day Load Trend</div>
              <div style={{ width: '100%', height: '70px', borderRadius: '8px', overflow: 'hidden', background: 'rgba(0,0,0,0.2)' }}>
                <SparkChart
                  data={selectedBinDetail.history_7d.map(h => ({ value: h.fill_percentage }))}
                  color={selectedBinDetail.prediction_tomorrow && selectedBinDetail.prediction_tomorrow.predicted_fill >= 80 ? '#ef4444' : '#06b6d4'}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                <span>7 days ago</span><span>Now</span>
              </div>
            </div>
          )}

          <div style={{ marginTop: '16px', display: 'flex', gap: '10px', flexShrink: 0 }}>
            <button
              onClick={() => handleOpenEditBinModal(selectedBinDetail)}
              style={{
                width: '100%', padding: '10px', background: 'var(--bg-secondary)',
                border: '1px solid var(--border-glass)', borderRadius: '8px',
                color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 700, fontSize: '13px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
              }}
            >
              Edit Bin Details
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ── Overview Panel ─────────────────────────────────────────

  const renderOverview = () => {
    const areaBreakdown = analyticsData?.area_breakdown ?? [];
    const ml = analyticsData?.ml_evaluation;
    const comparison = analyticsData?.comparison;

    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* KPI Grid */}
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="kpi-card cyan">
            <div className="kpi-label">Total Bins</div>
            <div className="kpi-value">{bins.length}</div>
            <div className="kpi-sub">Active across {analyticsData?.system_stats?.active_bins ?? '—'} wards</div>
          </div>
          <div className="kpi-card red">
            <div className="kpi-label">Critical Now</div>
            <div className="kpi-value" style={{ color: 'var(--color-danger)' }}>{criticalBins}</div>
            <div className="kpi-sub">fill ≥ 80% · needs collection</div>
          </div>
          <div className="kpi-card orange">
            <div className="kpi-label">Predicted Overflow</div>
            <div className="kpi-value" style={{ color: 'var(--accent-orange)' }}>{criticalPredictions}</div>
            <div className="kpi-sub">bins at risk tomorrow</div>
          </div>
          <div className="kpi-card green">
            <div className="kpi-label">Average Fill</div>
            <div className="kpi-value" style={{ color: 'var(--color-success)' }}>{avgFill.toFixed(1)}%</div>
            <div className="kpi-sub">system-wide average</div>
          </div>
        </div>

        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="kpi-card purple">
            <div className="kpi-label">Active Trucks</div>
            <div className="kpi-value" style={{ color: 'var(--accent-purple)' }}>{routes.length}</div>
            <div className="kpi-sub">routes generated</div>
          </div>
          <div className="kpi-card green">
            <div className="kpi-label">Distance Saved</div>
            <div className="kpi-value" style={{ color: 'var(--color-success)' }}>{distanceSaved} km</div>
            <div className="kpi-sub">vs fixed schedule</div>
          </div>
          <div className="kpi-card cyan">
            <div className="kpi-label">Fuel Saved</div>
            <div className="kpi-value">{fuelSaved} L</div>
            <div className="kpi-sub">per collection cycle</div>
          </div>
          <div className="kpi-card green">
            <div className="kpi-label">CO₂ Offset</div>
            <div className="kpi-value" style={{ color: 'var(--color-success)' }}>{co2Saved} kg</div>
            <div className="kpi-sub">greenhouse reduction</div>
          </div>
        </div>

        {/* Charts Row */}
        {comparison && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="glass" style={{ padding: '18px' }}>
              <h3 style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '15px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={14} color="var(--accent-cyan)" /> Route Efficiency Comparison
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={[
                  { name: 'Distance (km)', AI: comparison.AI.distance_km, Fixed: comparison.Fixed.distance_km },
                  { name: 'Fuel (L)', AI: comparison.AI.fuel_liters, Fixed: comparison.Fixed.fuel_liters },
                  { name: 'Duration (h)', AI: comparison.AI.duration_hours, Fixed: comparison.Fixed.duration_hours },
                ]} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                  <CartesianGrid stroke="#1e2d40" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#64748b" style={{ fontSize: '10px' }} />
                  <YAxis stroke="#64748b" style={{ fontSize: '11px' }} />
                  <Tooltip content={<DarkTooltip />} />
                  <Legend style={{ fontSize: '11px' }} />
                  <Bar dataKey="Fixed" fill="#334155" name="Fixed Schedule" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="AI" fill="#06b6d4" name="AI Optimized" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="glass" style={{ padding: '18px' }}>
              <h3 style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '15px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={14} color="var(--accent-purple)" /> Waste by Area Type
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={areaBreakdown} margin={{ top: 5, right: 5, left: -15, bottom: 30 }}>
                  <CartesianGrid stroke="#1e2d40" strokeDasharray="3 3" />
                  <XAxis dataKey="area_type" stroke="#64748b" style={{ fontSize: '9px' }} angle={-30} textAnchor="end" height={50} />
                  <YAxis stroke="#64748b" style={{ fontSize: '11px' }} />
                  <Tooltip content={<DarkTooltip />} />
                  <Bar dataKey="waste_tons" fill="#8b5cf6" name="Waste (Tons)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ML Model Metrics */}
        {ml && (
          <div className="glass" style={{ padding: '18px' }}>
            <h3 style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '15px', marginBottom: '14px' }}>
              🔮 ML Model Performance
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {Object.entries(ml).map(([model, metrics]: any) => (
                <div key={model} style={{
                  background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)',
                  borderRadius: '10px', padding: '14px',
                  borderTop: model === 'XGBoost Regressor' ? '2px solid var(--color-success)' : '2px solid transparent'
                }}>
                  <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '13px', color: model === 'XGBoost Regressor' ? 'var(--color-success)' : 'var(--text-primary)', marginBottom: '8px' }}>
                    {model === 'XGBoost Regressor' ? '⭐ ' : ''}{model}
                  </div>
                  {[
                    { k: 'MAE', v: metrics.MAE?.toFixed(2), note: 'lower better' },
                    { k: 'RMSE', v: metrics.RMSE?.toFixed(2), note: 'lower better' },
                    { k: 'R²', v: `${(metrics.R2 * 100)?.toFixed(1)}%`, note: 'higher better' },
                  ].map(m => (
                    <div key={m.k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{m.k}</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>{m.v}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Render Active Tab ──────────────────────────────────────

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverview();
      case 'map': return (
        <div style={{ flex: 1, overflow: 'hidden', padding: '0 0 16px 0' }}>
          <MapComponent
            bins={bins}
            routes={routes}
            selectedBinId={selectedBinId}
            onSelectBin={setSelectedBinId}
            liveUpdates={liveUpdates}
            streetRoutes={streetRoutes}
            fetchingRoutes={fetchingRoutes}
          />
        </div>
      );
      case 'routes': return (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <StreetRoutePanel
            routes={routes}
            streetRoutes={streetRoutes}
            fetchingRoutes={fetchingRoutes}
          />
        </div>
      );
      case 'bins': return (
        <div style={{ flex: 1, overflow: 'hidden', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
            <button 
              onClick={() => {
                setIsEditModeBin(false);
                setNewBinId('');
                setNewBinLat('17.4156');
                setNewBinLon('78.4486');
                setNewBinStreet('');
                setNewBinArea('Banjara Hills');
                setNewBinWard('Ward-10');
                setNewBinWardNum(10);
                setNewBinAreaType('Residential');
                setNewBinCapacity(240);
                setEditBinStatus('Active');
                setShowAddBinModal(true);
              }}
              style={{
                padding: '8px 16px', background: 'var(--accent-cyan)', color: 'white',
                border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '13px',
                display: 'flex', alignItems: 'center', gap: '6px', boxShadow: 'var(--shadow-sm)'
              }}
            >
              <Plus size={14} /> Add Waste Bin
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <BinsTable bins={bins} onSelectBin={setSelectedBinId} selectedBinId={selectedBinId} />
          </div>
        </div>
      );
      case 'fleet': return (
        <div style={{ flex: 1, overflow: 'hidden', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
            <button 
              onClick={() => {
                setIsEditModeTruck(false);
                setNewTruckId('');
                setNewTruckPlate('');
                setNewTruckCapacity(5000);
                setNewDriverId('');
                setNewDriverName('');
                setNewDriverPhone('');
                setNewDriverLicense('');
                setEditTruckStatus('Idle');
                setShowAddTruckModal(true);
              }}
              style={{
                padding: '8px 16px', background: 'var(--accent-purple)', color: 'white',
                border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '13px',
                display: 'flex', alignItems: 'center', gap: '6px', boxShadow: 'var(--shadow-sm)'
              }}
            >
              <Plus size={14} /> Add Truck & Driver
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <FleetPanel trucks={trucks} routes={routes} onSelectBin={setSelectedBinId} onEditTruck={handleOpenEditTruckModal} />
          </div>
        </div>
      );
      case 'prediction': return (
        <div style={{ flex: 1, overflow: 'hidden', padding: '16px 20px' }}>
          <PredictionPanel predictions={predictions} onSelectBin={setSelectedBinId} />
        </div>
      );
      case 'analytics': return analyticsData ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <Analytics comparison={analyticsData.comparison} savings={analyticsData.savings}
            ml_evaluation={analyticsData.ml_evaluation} area_breakdown={analyticsData.area_breakdown} />
        </div>
      ) : null;
      case 'notifications': return (
        <div style={{ flex: 1, overflow: 'hidden', padding: '16px 20px' }}>
          <NotificationsPanel notifications={notifications} onMarkRead={handleMarkRead} onMarkAllRead={handleMarkAllRead} />
        </div>
      );
      case 'simulation': return (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <SimulationControls
            isRunning={simRunning} currentSpeed={simSpeed}
            onStart={handleStartSim} onStop={handleStopSim} onReset={handleResetSim}
            bins={bins.map(b => ({ bin_id: b.bin_id, current_fill_percentage: b.current_fill_percentage ?? 0, area_type: b.area_type }))}
          />
        </div>
      );
      case 'maintenance': return (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <MaintenanceManagementPanel />
        </div>
      );
      default: return null;
    }
  };

  // ── Main Render ────────────────────────────────────────────

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-brand">
            <div className="sidebar-brand-icon">♻️</div>
            <div className="sidebar-brand-text">
              <h1>EcoBin AI</h1>
              <p>Hyderabad Municipal Corp.</p>
            </div>
          </div>
        </div>

        <nav className="nav-section" style={{ flex: 1 }}>
          <div className="nav-section-label">Navigation</div>
          {NAV_ITEMS.map(item => (
            <button key={item.key} className={`nav-btn ${activeTab === item.key ? `active ${item.color}` : ''}`}
              onClick={() => setActiveTab(item.key)}>
              {item.icon}
              <span>{item.label}</span>
              {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
              {item.key === 'simulation' && (
                <span className="sim-indicator">
                  <span className={`sim-dot ${simRunning ? '' : 'stopped'}`} />
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Admin Actions */}
        <div className="nav-section" style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '12px' }}>
          <div className="nav-section-label">System</div>
          <button onClick={() => runAction('predict', 'POST', '/api/predict')} disabled={actionLoading !== null}
            className="nav-btn" style={{ fontSize: '12px' }}>
            <Sparkles size={14} color="var(--accent-orange)" />
            <span>{actionLoading === 'predict' ? 'Forecasting...' : 'Compute Predictions'}</span>
          </button>
          <button onClick={() => runAction('optimize', 'POST', '/api/optimize')} disabled={actionLoading !== null}
            className="nav-btn" style={{ fontSize: '12px' }}>
            <Navigation size={14} color="var(--accent-cyan)" />
            <span className={actionLoading === 'optimize' ? 'spin' : ''}>{actionLoading === 'optimize' ? 'Optimizing...' : 'Optimize Routes'}</span>
          </button>
          <button onClick={() => runAction('train', 'POST', '/api/train')} disabled={actionLoading !== null}
            className="nav-btn" style={{ fontSize: '12px' }}>
            <RefreshCw size={13} />
            <span>Train ML Models</span>
          </button>
          <button onClick={() => {
            if (!confirm('Regenerate all data? This takes 2–5 minutes.')) return;
            runAction('gendata', 'POST', '/api/generate-data');
          }} disabled={actionLoading !== null}
            className="nav-btn" style={{ fontSize: '12px', color: 'var(--color-danger)' }}>
            <Database size={13} />
            <span>Reset Database</span>
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <div className="main-content">
        {/* Top Bar */}
        <div className="top-bar">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>
              {NAV_ITEMS.find(n => n.key === activeTab)?.label}
            </h2>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              GHMC — Greater Hyderabad Municipal Corporation
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginLeft: 'auto' }}>
            <div className="topbar-stat">
              <div className="live-dot" />
              <span style={{ color: 'var(--color-success)', fontWeight: 600, fontSize: '12px' }}>
                {simRunning ? `Sim ${simSpeed}×` : 'Live Monitor'}
              </span>
            </div>
            <div className="topbar-stat">
              <Trash2 size={12} color="var(--accent-cyan)" />
              <span>{bins.length} bins</span>
            </div>
            <div className="topbar-stat">
              <AlertTriangle size={12} color={criticalBins > 0 ? 'var(--color-danger)' : 'var(--text-muted)'} />
              <span style={{ color: criticalBins > 0 ? 'var(--color-danger)' : undefined }}>{criticalBins} critical</span>
            </div>
            <div className="topbar-stat">
              <Wind size={12} color="var(--color-success)" />
              <span style={{ color: 'var(--color-success)' }}>-{co2Saved} kg CO₂</span>
            </div>
            <button onClick={fetchAll} disabled={loading || actionLoading !== null}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
            </button>
          </div>
        </div>

        {/* Panel Area */}
        <div className="panel-area">
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', color: 'var(--text-muted)' }}>
              <div style={{ width: 40, height: 40, border: '3px solid var(--border-glass)', borderTopColor: 'var(--accent-cyan)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: '13px' }}>Loading Smart Waste Management Platform...</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {renderTabContent()}
              </div>
              {activeTab !== 'simulation' && renderInspector()}
            </div>
          )}
        </div>
      </div>

      {/* Add Waste Bin Modal */}
      {showAddBinModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.4)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'var(--bg-primary)', border: '1px solid var(--border-glass)',
            padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '480px',
            boxShadow: 'var(--shadow-lg)', maxHeight: '90vh', overflowY: 'auto'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: 'var(--text-primary)', fontWeight: 800 }}>
              {isEditModeBin ? 'Edit Waste Bin Details' : 'Add New Waste Bin'}
            </h3>
            
            <form onSubmit={isEditModeBin ? handleEditBin : handleAddBin}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Bin ID</label>
                  <input type="text" placeholder="e.g. BIN101" required value={newBinId} onChange={e => setNewBinId(e.target.value)} disabled={isEditModeBin}
                    style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', opacity: isEditModeBin ? 0.6 : 1 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Capacity (Liters)</label>
                  <input type="number" required value={newBinCapacity} onChange={e => setNewBinCapacity(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Latitude</label>
                  <input type="number" step="0.000001" required value={newBinLat} onChange={e => setNewBinLat(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Longitude</label>
                  <input type="number" step="0.000001" required value={newBinLon} onChange={e => setNewBinLon(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Street Name</label>
                <input type="text" placeholder="e.g. Road No. 10" required value={newBinStreet} onChange={e => setNewBinStreet(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Area Name</label>
                  <input type="text" required value={newBinArea} onChange={e => setNewBinArea(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Area Type</label>
                  <select value={newBinAreaType} onChange={e => setNewBinAreaType(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}>
                    {["Residential", "Commercial", "Market", "Hospital", "School", "Restaurant", "Mall", "Bus Stand", "Railway Station", "Park", "Industrial"].map(t => (
                      <option key={t} value={t} style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Ward</label>
                  <input type="text" placeholder="e.g. Ward-10" required value={newBinWard} onChange={e => setNewBinWard(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Ward Number</label>
                  <input type="number" required value={newBinWardNum} onChange={e => setNewBinWardNum(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                </div>
              </div>

              {isEditModeBin && (
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Status</label>
                  <select value={editBinStatus} onChange={e => setEditBinStatus(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}>
                    {["Active", "Maintenance", "Offline"].map(s => (
                      <option key={s} value={s} style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>{s}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: isEditModeBin ? '0' : '24px' }}>
                <button type="button" onClick={() => setShowAddBinModal(false)}
                  style={{ padding: '8px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                  Cancel
                </button>
                <button type="submit" disabled={addingBin}
                  style={{ padding: '8px 20px', background: 'var(--accent-cyan)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 800, fontSize: '13px', boxShadow: 'var(--shadow-sm)' }}>
                  {addingBin ? (isEditModeBin ? 'Updating...' : 'Adding...') : (isEditModeBin ? 'Update Bin' : 'Add Bin')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Truck Modal */}
      {showAddTruckModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.4)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'var(--bg-primary)', border: '1px solid var(--border-glass)',
            padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '480px',
            boxShadow: 'var(--shadow-lg)', maxHeight: '90vh', overflowY: 'auto'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: 'var(--text-primary)', fontWeight: 800 }}>
              {isEditModeTruck ? 'Edit Truck & Driver Details' : 'Add New Truck & Driver'}
            </h3>
            
            <form onSubmit={isEditModeTruck ? handleEditTruck : handleAddTruck}>
              <h4 style={{ fontSize: '12px', color: 'var(--accent-purple)', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Truck Details</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Truck ID</label>
                  <input type="text" placeholder="e.g. TRK-HYD-06" required value={newTruckId} onChange={e => setNewTruckId(e.target.value)} disabled={isEditModeTruck}
                    style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', opacity: isEditModeTruck ? 0.6 : 1 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Plate Number</label>
                  <input type="text" placeholder="e.g. TS09EA0006" required value={newTruckPlate} onChange={e => setNewTruckPlate(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Capacity (Liters)</label>
                <input type="number" required value={newTruckCapacity} onChange={e => setNewTruckCapacity(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <h4 style={{ fontSize: '12px', color: 'var(--accent-purple)', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '0.05em', borderTop: '1px solid var(--border-glass)', paddingTop: '12px' }}>Driver Details</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Driver ID</label>
                  <input type="text" placeholder="e.g. DRV006" required value={newDriverId} onChange={e => setNewDriverId(e.target.value)} disabled={isEditModeTruck}
                    style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', opacity: isEditModeTruck ? 0.6 : 1 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Driver Name</label>
                  <input type="text" placeholder="e.g. Anil Kumar" required value={newDriverName} onChange={e => setNewDriverName(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Phone Number</label>
                  <input type="text" placeholder="e.g. 9876543215" value={newDriverPhone} onChange={e => setNewDriverPhone(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>License Number</label>
                  <input type="text" placeholder="e.g. TS123461" value={newDriverLicense} onChange={e => setNewDriverLicense(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                </div>
              </div>

              {isEditModeTruck && (
                <div style={{ marginBottom: '24px', borderTop: '1px solid var(--border-glass)', paddingTop: '12px' }}>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Truck Status</label>
                  <select value={editTruckStatus} onChange={e => setEditTruckStatus(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}>
                    {["Idle", "En Route", "Collecting", "Maintenance", "Inactive"].map(s => (
                      <option key={s} value={s} style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>{s}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: isEditModeTruck ? '0' : '24px' }}>
                <button type="button" onClick={() => setShowAddTruckModal(false)}
                  style={{ padding: '8px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                  Cancel
                </button>
                <button type="submit" disabled={addingTruck}
                  style={{ padding: '8px 20px', background: 'var(--accent-purple)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 800, fontSize: '13px', boxShadow: 'var(--shadow-sm)' }}>
                  {addingTruck ? (isEditModeTruck ? 'Updating...' : 'Adding...') : (isEditModeTruck ? 'Update Truck' : 'Add Truck & Driver')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
