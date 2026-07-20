import React, { useState, useEffect } from 'react';
import { 
  LogOut, Navigation2, CheckCircle2, AlertCircle, 
  Volume2, VolumeX, Play, Square, Pause, Wrench, Compass, QrCode 
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../LanguageSwitcher';
import SmartQRScanner from '../SmartQRScanner';

interface DriverDashboardProps {
  truckId: string;
  driverName: string;
  onLogout: () => void;
}

// Haversine formula to compute distance in meters
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // Earth radius in meters
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in meters
};

// Map recentering component
const MapRecenter: React.FC<{ position: [number, number] | null }> = ({ position }) => {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView(position, map.getZoom(), { animate: true });
    }
  }, [position, map]);
  return null;
};

// Custom Marker Icons
const depotIcon = L.divIcon({
  html: `<div style="
    width:24px; height:24px;
    background:linear-gradient(135deg,#06b6d4,#8b5cf6);
    border:2px solid #f8fafc; border-radius:8px;
    box-shadow:0 0 16px rgba(6,182,212,0.6);
    display:flex; align-items:center; justify-content:center;
    color:white; font-size:12px; font-weight:bold;
  ">🏛</div>`,
  className: 'custom-depot-marker',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const truckIcon = L.divIcon({
  html: `<div style="
    width:32px; height:32px;
    background:linear-gradient(135deg,#ef4444,#ea580c);
    border:2px solid #ffffff; border-radius:50%;
    box-shadow:0 0 20px rgba(239,68,68,0.7);
    display:flex; align-items:center; justify-content:center;
    color:white; font-size:16px;
  ">🚚</div>`,
  className: 'custom-truck-marker',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const createBinIcon = (status: string, isNext: boolean) => {
  const isCollected = status === 'Collected';
  const isMaintenance = status === 'Maintenance';
  
  let color = '#f59e0b'; // default yellow
  if (isCollected) color = '#64748b'; // slate/gray
  else if (isMaintenance) color = '#ef4444'; // red
  else if (isNext) color = '#10b981'; // green

  const glow = isNext ? `box-shadow: 0 0 0 4px rgba(16,185,129,0.3), 0 0 16px ${color};` : '';
  const markerChar = isCollected ? '✓' : isMaintenance ? '⚠' : '';
  
  const html = `<div style="
    width: 20px; height: 20px;
    background: ${color}; border: 2px solid white;
    border-radius: 50%; ${glow}
    display: flex; align-items: center; justify-content: center;
    color: white; font-size: 10px; font-weight: bold;
  ">${markerChar}</div>`;

  return L.divIcon({
    html,
    className: 'custom-bin-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

const DriverDashboard: React.FC<DriverDashboardProps> = ({ truckId, driverName, onLogout }) => {
  const { t } = useTranslation();
  const [routeData, setRouteData] = useState<any>(null);
  const [streetRoute, setStreetRoute] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Simulation & Navigation States
  const [truckPosition, setTruckPosition] = useState<[number, number] | null>(null);
  const [currentCoordIndex, setCurrentCoordIndex] = useState<number>(0);
  const [isDriving, setIsDriving] = useState(false);
  const [streetCoords, setStreetCoords] = useState<[number, number][]>([]);
  const [navigationSteps, setNavigationSteps] = useState<any[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [truckLoad, setTruckLoad] = useState<number>(0); // in Liters
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Issue Reporting States
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueBinId, setIssueBinId] = useState<string | null>(null);
  const [issueType, setIssueType] = useState('Damaged Lid');
  const [issueNotes, setIssueNotes] = useState('');
  const [reportingIssue, setReportingIssue] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  useEffect(() => {
    fetchRouteData();
  }, [truckId]);

  const speakText = (text: string) => {
    if (isMuted) return;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const fetchRouteData = async () => {
    try {
      // 1. Fetch route assigned to this truck
      const res = await fetch(`/api/driver/${truckId}/route`);
      if (!res.ok) throw new Error('Failed to load route');
      const data = await res.json();
      setRouteData(data);

      if (data.has_route && data.route.path.length > 1) {
        // Fetch OSRM route with steps
        const stops = data.route.path.filter((n: any) => n.latitude && n.longitude);
        const coordStr = stops.map((s: any) => `${s.longitude},${s.latitude}`).join(';');
        const osrmRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson&steps=true`);
        
        if (osrmRes.ok) {
          const osrmData = await osrmRes.json();
          if (osrmData.code === 'Ok' && osrmData.routes?.[0]) {
            const coords = osrmData.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
            setStreetRoute({ 
              coords, 
              distance: osrmData.routes[0].distance, 
              duration: osrmData.routes[0].duration 
            });
            setStreetCoords(coords);
            
            if (coords.length > 0) {
              setTruckPosition(coords[0]);
            }
            
            // Extract OSRM turn-by-turn directions
            const allSteps: any[] = [];
            if (osrmData.routes[0].legs) {
              osrmData.routes[0].legs.forEach((leg: any, legIdx: number) => {
                leg.steps.forEach((step: any) => {
                  allSteps.push({
                    instruction: step.maneuver.instruction,
                    distance: step.distance,
                    duration: step.duration,
                    coordinate: [step.maneuver.location[1], step.maneuver.location[0]],
                    legIndex: legIdx
                  });
                });
              });
            }
            setNavigationSteps(allSteps);
          }
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const path = routeData?.route?.path || [];
  const uncollectedBins = path.filter((n: any) => n.type === 'bin' && n.status !== 'Collected' && n.status !== 'Maintenance');
  const nextBin = uncollectedBins.length > 0 ? uncollectedBins[0] : null;

  // Real-time GPS movement simulation loop
  useEffect(() => {
    let interval: any = null;
    if (isDriving && streetCoords.length > 0) {
      interval = setInterval(() => {
        let nextIndex = currentCoordIndex + 1;
        if (nextIndex >= streetCoords.length) {
          setIsDriving(false);
          clearInterval(interval);
          speakText("Route completed. Returning to depot.");
          return;
        }

        setCurrentCoordIndex(nextIndex);
        const newPos = streetCoords[nextIndex];
        setTruckPosition(newPos);

        // Update current navigation step instruction
        const nextStepIdx = navigationSteps.findIndex((step, idx) => {
          if (idx <= currentStepIndex) return false;
          const dist = getDistance(newPos[0], newPos[1], step.coordinate[0], step.coordinate[1]);
          return dist < 30; // 30 meters vicinity
        });
        if (nextStepIdx !== -1) {
          setCurrentStepIndex(nextStepIdx);
          speakText(navigationSteps[nextStepIdx].instruction);
        }

        // Arrived at target bin
        if (nextBin && nextBin.latitude && nextBin.longitude) {
          const distToBin = getDistance(newPos[0], newPos[1], nextBin.latitude, nextBin.longitude);
          if (distToBin < 25) { // 25 meters vicinity
            setIsDriving(false);
            clearInterval(interval);
            speakText(`Arrived at bin ${nextBin.bin_id}. Ready for collection.`);
          }
        } else {
          // Check Depot arrival
          const lastNode = path[path.length - 1];
          if (lastNode && lastNode.latitude) {
            const distToDepot = getDistance(newPos[0], newPos[1], lastNode.latitude, lastNode.longitude);
            if (distToDepot < 25 && nextIndex >= streetCoords.length - 5) {
              setIsDriving(false);
              clearInterval(interval);
              speakText("Arrived at depot. Route complete.");
            }
          }
        }
      }, 250); // tick interval
    }
    return () => clearInterval(interval);
  }, [isDriving, streetCoords, currentCoordIndex, navigationSteps, currentStepIndex, nextBin, path]);

  // Telemetry details
  const totalBinsCount = path.filter((n: any) => n.type === 'bin').length;
  const collectedBinsCount = path.filter((n: any) => n.type === 'bin' && n.status === 'Collected').length;
  
  const distanceRemaining = streetRoute ? Math.max(0, (streetRoute.distance * (1 - currentCoordIndex / streetCoords.length)) / 1000) : 0;
  const durationRemaining = streetRoute ? Math.max(0, (streetRoute.duration * (1 - currentCoordIndex / streetCoords.length)) / 60) : 0;

  const markCollected = async (binId: string) => {
    try {
      const response = await fetch('/api/driver/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bin_id: binId, truck_id: truckId }),
      });
      
      if (!response.ok) throw new Error('Database collection endpoint failed');

      setRouteData((prev: any) => {
        const newPath = prev.route.path.map((node: any) => {
          if (node.bin_id === binId) return { ...node, status: 'Collected' };
          return node;
        });
        return { ...prev, route: { ...prev.route, path: newPath } };
      });
      
      const targetBin = path.find((n: any) => n.bin_id === binId);
      if (targetBin) {
        setTruckLoad((prev) => Math.min(5000, prev + (targetBin.capacity || 240)));
      }
      
      speakText(`Bin ${binId} successfully collected.`);
    } catch (err: any) {
      alert('Error updating collection: ' + err.message);
    }
  };

  const reportIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueBinId) return;

    setReportingIssue(true);
    try {
      const response = await fetch('/api/driver/report-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bin_id: issueBinId,
          issue_type: issueType,
          notes: issueNotes
        }),
      });

      if (!response.ok) throw new Error('Database reporting endpoint failed');

      setRouteData((prev: any) => {
        const newPath = prev.route.path.map((node: any) => {
          if (node.bin_id === issueBinId) return { ...node, status: 'Maintenance' };
          return node;
        });
        return { ...prev, route: { ...prev.route, path: newPath } };
      });

      speakText(`Issue reported. Bin ${issueBinId} flagged for maintenance.`);
      setShowIssueModal(false);
      setIssueNotes('');
    } catch (err: any) {
      alert('Error reporting issue: ' + err.message);
    } finally {
      setReportingIssue(false);
    }
  };

  const handleStartSimulation = () => {
    if (streetCoords.length === 0) return;
    setIsDriving(true);
    speakText("Navigation simulation active. Driving to next stop.");
  };

  const handlePauseSimulation = () => {
    setIsDriving(false);
    speakText("Navigation simulation paused.");
  };

  const handleResetSimulation = () => {
    setIsDriving(false);
    setCurrentCoordIndex(0);
    setCurrentStepIndex(0);
    if (streetCoords.length > 0) {
      setTruckPosition(streetCoords[0]);
    }
    speakText("Navigation simulation reset.");
  };

  const handleMuteToggle = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (!nextMute) {
      setTimeout(() => speakText("Voice guidance active."), 100);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ border: '4px solid var(--bg-tertiary)', borderTop: '4px solid var(--accent-cyan)', borderRadius: '50%', width: '40px', height: '40px', margin: '0 auto 16px auto', animation: 'spin 1s linear infinite' }} />
          <div style={{ fontWeight: 600 }}>Loading Route...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', color: 'var(--text-primary)', flexDirection: 'column', gap: '16px', fontFamily: 'Outfit, sans-serif' }}>
        <AlertCircle size={48} color="var(--color-danger)" />
        <div style={{ fontSize: '18px', fontWeight: 600 }}>{error}</div>
        <button onClick={onLogout} style={{ padding: '10px 20px', borderRadius: '8px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', cursor: 'pointer', fontWeight: 600 }}>Go Back</button>
      </div>
    );
  }

  if (!routeData?.has_route) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', color: 'var(--text-primary)', flexDirection: 'column', gap: '20px', fontFamily: 'Outfit, sans-serif' }}>
        <CheckCircle2 size={64} color="var(--color-success)" />
        <h2 style={{ margin: 0, fontWeight: 800 }}>No Active Route</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>All clear. No garbage bins assigned to your truck fleet today.</p>
        <button onClick={onLogout} style={{ padding: '10px 24px', borderRadius: '8px', background: 'var(--accent-cyan)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, boxShadow: 'var(--shadow-md)' }}>Logout</button>
      </div>
    );
  }

  const activeStep = navigationSteps[currentStepIndex];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-base)', fontFamily: 'Outfit, sans-serif', color: 'var(--text-primary)' }}>
      
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-glass)', boxShadow: 'var(--shadow-sm)', zIndex: 100 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
            <Navigation2 color="var(--accent-cyan)" style={{ transform: 'rotate(45deg)' }} />
            EcoBin Fleet Navigator
          </h1>
          <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>
            Driver: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{driverName}</span> • Vehicle: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{truckId}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <LanguageSwitcher />
          <button 
            onClick={handleMuteToggle}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '10px', borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            title={isMuted ? "Unmute Voice Guidance" : "Mute Voice Guidance"}
          >
            {isMuted ? <VolumeX size={18} color="var(--color-danger)" /> : <Volume2 size={18} color="var(--color-success)" />}
          </button>
          <button onClick={onLogout} style={{ background: 'transparent', border: '1px solid var(--color-danger)', padding: '8px 16px', borderRadius: '8px', color: 'var(--color-danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', flexDirection: 'column' }}>
        
        {/* Next Pickup Banner */}
        {nextBin ? (
          <div style={{ background: 'linear-gradient(90deg, var(--color-success-dim), var(--accent-cyan-dim))', padding: '16px 24px', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Target Stop</div>
              <div style={{ fontSize: '18px', color: 'var(--text-primary)', fontWeight: 800 }}>{nextBin.bin_id}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>{nextBin.street_name || nextBin.area_name}</div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => { setIssueBinId(nextBin.bin_id); setShowIssueModal(true); }}
                style={{ background: 'var(--color-danger-dim)', color: 'var(--color-danger)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '12px 18px', borderRadius: '8px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Wrench size={16} /> Flag Issue
              </button>
              <button 
                onClick={() => setShowQRModal(true)}
                style={{ background: 'var(--color-success)', color: 'white', border: 'none', padding: '12px 22px', borderRadius: '8px', fontWeight: 800, fontSize: '14px', cursor: 'pointer', boxShadow: 'var(--shadow-md)', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <QrCode size={16} /> {t('scanBin')}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ background: 'var(--color-success-dim)', padding: '16px 24px', borderBottom: '1px solid var(--border-glass)', color: 'var(--color-success)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px' }}>
            <CheckCircle2 color="var(--color-success)" /> All bin collections successfully completed for this shift! Returning to depot.
          </div>
        )}

        {/* Main Workspace */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', flexDirection: 'row' }}>
          
          {/* Side Control & Directions Panel */}
          <div style={{ width: '380px', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-glass)', overflowY: 'auto' }}>
            
            {/* Simulation Controls */}
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-secondary)' }}>
              <h3 style={{ margin: '0 0 12px 0', color: 'var(--text-primary)', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 850 }}>
                Route Telemetry & Controls
              </h3>
              
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                {!isDriving ? (
                  <button 
                    onClick={handleStartSimulation}
                    disabled={streetCoords.length === 0}
                    style={{ flex: 1, background: 'linear-gradient(135deg, var(--accent-cyan), var(--color-info))', color: 'white', border: 'none', padding: '10px 14px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px' }}
                  >
                    <Play size={14} fill="white" /> Start Navigation
                  </button>
                ) : (
                  <button 
                    onClick={handlePauseSimulation}
                    style={{ flex: 1, background: 'var(--color-warning)', color: 'white', border: 'none', padding: '10px 14px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px' }}
                  >
                    <Pause size={14} fill="currentColor" /> Pause Navigation
                  </button>
                )}
                
                <button 
                  onClick={handleResetSimulation}
                  style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)', padding: '10px 14px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}
                >
                  <Square size={12} fill="currentColor" style={{ marginRight: '6px' }} /> Reset
                </button>
              </div>

              {/* Stats Block */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                <div style={{ background: 'var(--bg-primary)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Remaining Dist.</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--accent-cyan)', marginTop: '4px' }}>{distanceRemaining.toFixed(2)} km</div>
                </div>
                <div style={{ background: 'var(--bg-primary)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Remaining Time</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--accent-cyan)', marginTop: '4px' }}>{durationRemaining.toFixed(1)} mins</div>
                </div>
              </div>

              {/* Truck Capacity Progress Bar */}
              <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '6px' }}>
                  <span>Truck Waste Load</span>
                  <span>{truckLoad} / 5000 Liters</span>
                </div>
                <div style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${(truckLoad / 5000) * 100}%`, height: '100%', background: 'linear-gradient(90deg, var(--color-info), var(--accent-cyan))', borderRadius: '4px', transition: 'width 0.4s ease' }} />
                </div>
              </div>
            </div>

            {/* Turn-by-Turn Instruction Panel */}
            {streetRoute && (
              <div style={{ padding: '20px', borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-secondary)' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Compass size={14} /> Active Instruction
                </h4>
                {activeStep ? (
                  <div>
                    <div style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: 700, lineHeight: 1.4 }}>
                      {activeStep.instruction}
                    </div>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <span>Distance: {activeStep.distance.toFixed(0)}m</span>
                      <span>Est: {Math.ceil(activeStep.duration)}s</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Route completed. Return to depot safely.</div>
                )}
              </div>
            )}

            {/* List Stops Panel */}
            <div style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 14px 0', color: 'var(--text-primary)', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>
                Assigned Stops ({collectedBinsCount}/{totalBinsCount} Collected)
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {path.map((node: any, idx: number) => {
                  if (node.type === 'depot') {
                    return (
                      <div key={`depot-${idx}`} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--accent-purple-dim)', color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                          🏛
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '13px' }}>Hyderabad Municipal Depot</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{idx === 0 ? 'Start Terminal' : 'Return Terminal'}</div>
                        </div>
                      </div>
                    );
                  }

                  const isCollected = node.status === 'Collected';
                  const isMaintenance = node.status === 'Maintenance';
                  const isNext = nextBin?.bin_id === node.bin_id;

                  return (
                    <div 
                      key={node.bin_id} 
                      style={{ 
                        display: 'flex', gap: '12px', padding: '12px', borderRadius: '10px', 
                        background: isNext ? 'var(--color-success-dim)' : 'var(--bg-secondary)',
                        border: isNext ? '1.5px solid var(--color-success)' : isMaintenance ? '1px solid var(--color-danger)' : '1px solid var(--border-glass)',
                        opacity: isCollected || isMaintenance ? 0.6 : 1
                      }}
                    >
                      <div style={{ 
                        width: '28px', height: '28px', borderRadius: '50%', 
                        background: isCollected ? 'var(--bg-tertiary)' : isMaintenance ? 'var(--color-danger)' : isNext ? 'var(--color-success)' : 'var(--accent-cyan)', 
                        color: isCollected ? 'var(--text-muted)' : 'white', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        fontWeight: 'bold', fontSize: '12px', flexShrink: 0 
                      }}>
                        {idx}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '13px', textDecoration: isCollected ? 'line-through' : 'none' }}>
                            {node.bin_id}
                          </div>
                          {isCollected && <CheckCircle2 size={13} color="var(--color-success)" />}
                          {isMaintenance && <span style={{ fontSize: '10px', color: 'var(--color-danger)', background: 'var(--color-danger-dim)', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>Maintenance</span>}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '2px' }}>{node.street_name || node.area_name}</div>
                        
                        {!isCollected && !isMaintenance && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                            <div style={{ flex: 1, height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ width: `${node.current_fill_percentage}%`, height: '100%', background: node.current_fill_percentage >= 80 ? 'var(--color-danger)' : 'var(--color-warning)' }} />
                            </div>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700 }}>{node.current_fill_percentage}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Leaflet Map Viewer */}
          <div style={{ flex: 1, position: 'relative' }}>
            <MapContainer 
              center={[17.3850, 78.4867]} 
              zoom={13} 
              style={{ width: '100%', height: '100%' }}
              zoomControl={false}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                attribution="&copy; OpenStreetMap contributors &copy; CARTO"
              />
              
              <MapRecenter position={truckPosition} />

              {/* OSRM Route Line */}
              {streetRoute ? (
                <Polyline positions={streetRoute.coords} color="#06b6d4" weight={5} opacity={0.8} />
              ) : (
                <Polyline 
                  positions={path.filter((n: any) => n.latitude).map((n: any) => [n.latitude, n.longitude] as [number, number])} 
                  color="#64748b" 
                  weight={4} 
                  dashArray="10, 8" 
                  opacity={0.6} 
                />
              )}

              {/* Start/End Depot Marker */}
              {path.map((node: any, idx: number) => {
                if (!node.latitude || !node.longitude) return null;
                
                if (node.type === 'depot') {
                  return (
                    <Marker key={`depot-marker-${idx}`} position={[node.latitude, node.longitude]} icon={depotIcon}>
                      <Popup><div style={{ color: '#0f172a', fontWeight: 'bold' }}>Hyderabad Depot</div></Popup>
                    </Marker>
                  );
                }

                const isNext = nextBin?.bin_id === node.bin_id;
                return (
                  <Marker 
                    key={`marker-${node.bin_id}`} 
                    position={[node.latitude, node.longitude]} 
                    icon={createBinIcon(node.status, isNext)}
                  >
                    <Popup>
                      <div style={{ color: '#0f172a', fontFamily: 'Outfit, sans-serif' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{node.bin_id}</div>
                        <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>{node.street_name}</div>
                        <div style={{ fontSize: '11px', fontWeight: 600, marginTop: '4px' }}>Fill Level: {node.current_fill_percentage}%</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>Capacity: {node.capacity}L</div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

              {/* Animated Truck Position Marker */}
              {truckPosition && (
                <Marker position={truckPosition} icon={truckIcon}>
                  <Popup>
                    <div style={{ color: '#0f172a', fontWeight: 'bold', fontFamily: 'Outfit, sans-serif' }}>
                      Active Fleet Truck: {truckId}
                    </div>
                  </Popup>
                </Marker>
              )}
            </MapContainer>
          </div>
        </div>
      </div>

      {/* Flag Maintenance/Issue Reporting Modal */}
      {showIssueModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'var(--bg-primary)', border: '1px solid var(--border-glass)',
            padding: '30px', borderRadius: '16px', width: '100%', maxWidth: '440px',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: 'var(--text-primary)', fontWeight: 800 }}>Report Issue: {issueBinId}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 20px 0' }}>Report issues encountered at the bin location. This will put the bin into Maintenance mode.</p>
            
            <form onSubmit={reportIssue}>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Issue Type
                </label>
                <select
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-glass)', borderRadius: '8px',
                    color: 'var(--text-primary)', fontSize: '14px', outline: 'none'
                  }}
                >
                  <option value="Damaged Lid" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Damaged Lid / Hinge</option>
                  <option value="Blocked Access" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Blocked Access (Cars / Debris)</option>
                  <option value="Sensor Failure" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Sensor Malfunction (No signal)</option>
                  <option value="Vandalism" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Vandalism / Physical Damage</option>
                  <option value="Wrong Waste Type" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Wrong Waste Type Contamination</option>
                </select>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Notes / Details
                </label>
                <textarea
                  value={issueNotes}
                  onChange={(e) => setIssueNotes(e.target.value)}
                  placeholder="Provide additional details for the maintenance team..."
                  rows={4}
                  style={{
                    width: '100%', padding: '10px 12px', background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-glass)', borderRadius: '8px',
                    color: 'var(--text-primary)', fontSize: '14px', outline: 'none', resize: 'none',
                    boxSizing: 'border-box', fontFamily: 'Outfit, sans-serif'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  style={{ padding: '10px 18px', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reportingIssue}
                  style={{ padding: '10px 22px', background: 'var(--color-danger)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 800, fontSize: '13px', boxShadow: 'var(--shadow-sm)' }}
                >
                  {reportingIssue ? 'Submitting...' : 'Submit Alert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Scanner Modal */}
      {showQRModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 2000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'var(--bg-primary)', border: '1px solid var(--border-glass)',
            padding: '30px', borderRadius: '16px', width: '100%', maxWidth: '440px',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <SmartQRScanner 
              onScanSuccess={(_token, data) => {
                if (data.entity_type === 'Bin' && data.entity_id === nextBin?.bin_id) {
                  markCollected(nextBin.bin_id);
                  setShowQRModal(false);
                } else {
                  alert('Scanned QR does not match the target bin!');
                }
              }} 
              title={t('scanBin')}
            />
            <button
              onClick={() => setShowQRModal(false)}
              style={{ marginTop: '16px', width: '100%', padding: '10px', background: 'transparent', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', borderRadius: '8px', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverDashboard;
