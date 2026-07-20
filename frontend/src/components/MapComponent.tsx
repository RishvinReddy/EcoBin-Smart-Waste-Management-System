import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ─── Icon Factories ──────────────────────────────────────────

const getFillClass = (fill: number) => {
  if (fill >= 80) return 'red';
  if (fill >= 50) return 'yellow';
  return 'green';
};

const getFillColor = (fill: number) => {
  if (fill >= 80) return '#ef4444';
  if (fill >= 50) return '#f59e0b';
  return '#10b981';
};

const createBinIcon = (fill: number, isSelected: boolean, isCollected: boolean) => {
  let color = isCollected ? '#60a5fa' : getFillColor(fill);
  let border = isCollected ? '#1d4ed8' : (fill >= 80 ? '#b91c1c' : fill >= 50 ? '#d97706' : '#047857');
  let size = fill >= 80 ? 20 : fill >= 50 ? 16 : 14;
  if (isSelected) size += 4;
  const pulse = fill >= 80 && !isCollected ? 'pulse-critical' : '';
  const glow = isSelected
    ? `box-shadow: 0 0 0 3px rgba(255,255,255,0.5), 0 0 16px ${color};`
    : `box-shadow: 0 0 10px ${color}80;`;

  const html = `<div style="
    width:${size}px; height:${size}px;
    background:${color}; border:2px solid ${border};
    border-radius:50%; ${glow}
  " class="${pulse}"></div>`;

  return L.divIcon({
    html,
    className: 'custom-bin-marker',
    iconSize: [size + 4, size + 4],
    iconAnchor: [(size + 4) / 2, (size + 4) / 2],
  });
};

const depotIcon = L.divIcon({
  html: `<div style="
    width:28px; height:28px;
    background:linear-gradient(135deg,#06b6d4,#8b5cf6);
    border:2px solid #f8fafc; border-radius:8px;
    box-shadow:0 0 16px rgba(6,182,212,0.6);
    display:flex; align-items:center; justify-content:center;
    color:white; font-size:14px; font-weight:bold;
  ">🏛</div>`,
  className: 'custom-depot-marker',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const createTruckIcon = (color: string) => L.divIcon({
  html: `<div style="
    width:32px; height:32px;
    background:${color}; border:2px solid white;
    border-radius:50%; display:flex; align-items:center;
    justify-content:center; font-size:16px;
    box-shadow:0 0 20px ${color}99;
    animation:pulse-cyan 1.5s infinite;
  ">🚚</div>`,
  className: 'custom-truck-marker',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const createDistanceBadge = (text: string, color: string) => L.divIcon({
  html: `<div style="
    background:rgba(11,17,32,0.92); color:${color};
    border:1px solid ${color}55; border-radius:10px;
    padding:2px 7px; font-size:10px; font-weight:700;
    font-family:'JetBrains Mono',monospace; white-space:nowrap;
    box-shadow:0 2px 8px rgba(0,0,0,0.5);
    backdrop-filter:blur(8px); pointer-events:none;
  ">${text}</div>`,
  className: 'distance-badge-marker',
  iconAnchor: [40, 10],
});

// ─── Interfaces ──────────────────────────────────────────────

interface BinData {
  bin_id: string;
  latitude: number;
  longitude: number;
  street_name?: string;
  area_name?: string;
  ward?: string;
  area_type: string;
  capacity: number;
  current_fill_percentage?: number;
  predicted_fill?: number;
  overflow_probability?: number;
  priority_score?: number;
  battery_level?: number;
  signal_strength?: number;
  temperature?: number;
  status?: string;
  last_updated?: string;
  last_collection_time?: string;
}

interface RoutePathNode {
  bin_id: string;
  latitude: number;
  longitude: number;
  load_at_node: number;
}

interface RouteData {
  route_id?: number;
  truck_id: string;
  driver: string;
  distance_km: number;
  fuel_liters: number;
  duration_hours: number;
  path: RoutePathNode[];
}

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

interface MapComponentProps {
  bins: BinData[];
  routes: RouteData[];
  selectedBinId: string | null;
  onSelectBin: (binId: string) => void;
  liveUpdates?: Record<string, { fill: number; timestamp: string }>;
  // Pre-computed street routes from Dashboard (shared with StreetRoutePanel)
  streetRoutes?: Record<string, StreetRoute>;
  fetchingRoutes?: boolean;
}

// ─── Constants ───────────────────────────────────────────────

const ROUTE_COLORS = ['#06b6d4', '#8b5cf6', '#f97316', '#ec4899', '#10b981'];
const HYDERABAD_CENTER: [number, number] = [17.3850, 78.4867];

const MAP_LAYERS = {
  light: {
    label: '☀️ Light',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  streets: {
    label: '🗺️ Streets',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  satellite: {
    label: '🛰️ Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
  },
} as const;

type LayerKey = keyof typeof MAP_LAYERS;

// ─── Utilities ───────────────────────────────────────────────

const midpoint = (coords: [number, number][]): [number, number] => {
  const mid = Math.floor(coords.length / 2);
  return coords[mid] || coords[0];
};

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}m`;
};

const formatDistance = (metres: number): string => {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(2)} km`;
};

const uniqueStreets = (steps: OsrmStep[]): { name: string; distance: number }[] => {
  const map = new Map<string, number>();
  for (const s of steps) {
    if (!s.name || s.name === '') continue;
    map.set(s.name, (map.get(s.name) ?? 0) + s.distance);
  }
  return [...map.entries()]
    .map(([name, distance]) => ({ name, distance }))
    .sort((a, b) => b.distance - a.distance);
};

// ─── Sub-components ──────────────────────────────────────────

const AnimatedTruck: React.FC<{ coords: [number, number][]; color: string; truckId: string }> = ({ coords, color, truckId }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (coords.length < 2) return;
    setCurrentIdx(0);
    const stepTime = Math.max(15, Math.min(100, 8000 / coords.length));
    intervalRef.current = setInterval(() => {
      setCurrentIdx(prev => (prev >= coords.length - 1 ? 0 : prev + 1));
    }, stepTime);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [coords]);

  if (coords.length === 0) return null;
  const pos = coords[currentIdx] || coords[0];

  return (
    <Marker position={pos} icon={createTruckIcon(color)}>
      <Popup>
        <div style={{ fontFamily: 'Outfit', fontWeight: 'bold', color }}>🚚 {truckId}</div>
        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
          Patrolling street route · {coords.length} waypoints
        </div>
      </Popup>
    </Marker>
  );
};

// ─── Main Component ───────────────────────────────────────────

const MapComponent: React.FC<MapComponentProps> = ({
  bins,
  routes,
  selectedBinId,
  onSelectBin,
  liveUpdates = {},
  streetRoutes = {},
  fetchingRoutes = false,
}) => {
  const [showRoutes, setShowRoutes] = useState(true);
  const [showTrucks, setShowTrucks] = useState(true);
  const [showDistanceLabels, setShowDistanceLabels] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'critical' | 'warning' | 'normal'>('all');
  const [mapLayer, setMapLayer] = useState<LayerKey>('light');
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);

  // ── Derived counts ─────────────────────────────────────────

  const filteredBins = bins.filter(b => {
    const fill = b.current_fill_percentage ?? b.predicted_fill ?? 0;
    if (filterStatus === 'critical') return fill >= 80;
    if (filterStatus === 'warning') return fill >= 50 && fill < 80;
    if (filterStatus === 'normal') return fill < 50;
    return true;
  });

  const criticalCount = bins.filter(b => (b.current_fill_percentage ?? 0) >= 80).length;
  const warningCount = bins.filter(b => {
    const f = b.current_fill_percentage ?? 0;
    return f >= 50 && f < 80;
  }).length;

  const snappedCount = Object.values(streetRoutes).filter(r => r.snapped).length;
  const layer = MAP_LAYERS[mapLayer];

  // ── Render ─────────────────────────────────────────────────

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', borderRadius: '16px', overflow: 'hidden' }}>

      {/* Controls Overlay */}
      <div style={{
        position: 'absolute', top: '12px', right: '12px', zIndex: 1000,
        display: 'flex', flexDirection: 'column', gap: '8px',
      }}>

        {/* Routing Status */}
        <div style={{
          background: 'rgba(11,17,32,0.92)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '10px', padding: '8px 12px', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', gap: '7px',
        }}>
          {fetchingRoutes ? (
            <>
              <div style={{ width: 8, height: 8, borderRadius: '50%', border: '2px solid #06b6d4', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
              <span style={{ fontSize: '11px', color: '#06b6d4', fontWeight: 600 }}>Fetching street routes…</span>
            </>
          ) : routes.length === 0 ? (
            <>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#64748b' }} />
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>No routes generated</span>
            </>
          ) : (
            <>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: snappedCount > 0 ? '#10b981' : '#f59e0b' }} />
              <span style={{ fontSize: '11px', color: snappedCount > 0 ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                {snappedCount}/{routes.length} street-snapped
              </span>
            </>
          )}
        </div>

        {/* Map Layer Switcher */}
        <div style={{
          background: 'rgba(11,17,32,0.92)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '10px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '3px',
          backdropFilter: 'blur(12px)',
        }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 4px', marginBottom: '2px' }}>
            Map Layer
          </div>
          {(Object.keys(MAP_LAYERS) as LayerKey[]).map(key => (
            <button key={key} onClick={() => setMapLayer(key)} style={{
              padding: '5px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              fontSize: '11px', fontWeight: 600, textAlign: 'left',
              background: mapLayer === key ? 'rgba(6,182,212,0.2)' : 'transparent',
              color: mapLayer === key ? '#06b6d4' : '#94a3b8',
              transition: 'all 0.15s ease',
            }}>
              {MAP_LAYERS[key].label}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div style={{
          background: 'rgba(11,17,32,0.92)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '10px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px',
          backdropFilter: 'blur(12px)', minWidth: '148px',
        }}>
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', marginBottom: '2px' }}>Legend</div>
          {[
            { color: '#10b981', label: 'Normal (0–50%)', count: bins.length - criticalCount - warningCount },
            { color: '#f59e0b', label: 'Warning (50–80%)', count: warningCount },
            { color: '#ef4444', label: 'Critical (≥80%)', count: criticalCount },
            { color: '#60a5fa', label: 'Collected', count: null },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11px' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, boxShadow: `0 0 6px ${item.color}`, flexShrink: 0 }} />
              <span style={{ color: '#94a3b8', flex: 1 }}>{item.label}</span>
              {item.count !== null && <span style={{ color: '#f0f4f8', fontWeight: 700, fontSize: '10px' }}>{item.count}</span>}
            </div>
          ))}
        </div>

        {/* Filter */}
        <div style={{
          background: 'rgba(11,17,32,0.92)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '10px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px',
          backdropFilter: 'blur(12px)',
        }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 4px' }}>Filter</div>
          {[
            { key: 'all', label: `All (${bins.length})` },
            { key: 'critical', label: `Critical (${criticalCount})` },
            { key: 'warning', label: `Warning (${warningCount})` },
            { key: 'normal', label: 'Normal' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilterStatus(f.key as any)} style={{
              padding: '5px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              fontSize: '11px', fontWeight: 600, textAlign: 'left',
              background: filterStatus === f.key ? 'rgba(6,182,212,0.2)' : 'transparent',
              color: filterStatus === f.key ? '#06b6d4' : '#94a3b8',
              transition: 'all 0.15s ease',
            }}>{f.label}</button>
          ))}
        </div>

        {/* Toggles */}
        <div style={{
          background: 'rgba(11,17,32,0.92)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '10px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px',
          backdropFilter: 'blur(12px)',
        }}>
          {[
            { key: 'routes', label: 'Routes', state: showRoutes, setter: setShowRoutes },
            { key: 'trucks', label: 'Trucks', state: showTrucks, setter: setShowTrucks },
            { key: 'dist', label: 'Distances', state: showDistanceLabels, setter: setShowDistanceLabels },
          ].map(t => (
            <button key={t.key} onClick={() => t.setter(!t.state)} style={{
              padding: '5px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              fontSize: '11px', fontWeight: 600, textAlign: 'left',
              background: t.state ? 'rgba(139,92,246,0.15)' : 'transparent',
              color: t.state ? '#8b5cf6' : '#64748b',
            }}>{t.state ? '✓' : '○'} {t.label}</button>
          ))}
        </div>
      </div>

      {/* Leaflet Map */}
      <MapContainer
        center={HYDERABAD_CENTER}
        zoom={12}
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom={true}
        zoomControl={true}
      >
        {/* Tile Layer — swaps on mapLayer change */}
        <TileLayer key={mapLayer} url={layer.url} attribution={layer.attribution} maxZoom={19} />

        {/* Depot Marker */}
        <Marker position={HYDERABAD_CENTER} icon={depotIcon}>
          <Popup>
            <div style={{ fontFamily: 'Outfit', fontWeight: 'bold', fontSize: '14px' }}>🏛 GHMC Depot — Hyderabad</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
              Municipal Corporation Operations HQ<br />
              Lat: {HYDERABAD_CENTER[0].toFixed(4)}, Lon: {HYDERABAD_CENTER[1].toFixed(4)}
            </div>
          </Popup>
        </Marker>

        {/* Bin Markers */}
        {filteredBins.map(bin => {
          const liveFill = liveUpdates[bin.bin_id]?.fill ?? bin.current_fill_percentage ?? 0;
          const isSelected = bin.bin_id === selectedBinId;
          const isCollected = bin.status === 'Collected';
          const fillClass = getFillClass(liveFill);

          return (
            <Marker
              key={bin.bin_id}
              position={[bin.latitude, bin.longitude]}
              icon={createBinIcon(liveFill, isSelected, isCollected)}
              eventHandlers={{ click: () => onSelectBin(bin.bin_id) }}
            >
              <Popup>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontFamily: 'Outfit', fontWeight: 'bold', fontSize: '15px', color: '#f0f4f8' }}>{bin.bin_id}</span>
                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
                      {bin.area_type}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
                    📍 {bin.street_name || '—'}<br />{bin.ward || ''}
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Fill Level</span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: getFillColor(liveFill) }}>{liveFill.toFixed(1)}%</span>
                    </div>
                    <div className="fill-bar-container">
                      <div className={`fill-bar ${fillClass}`} style={{ width: `${liveFill}%` }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
                    <span>🔋 {(bin.battery_level ?? 100).toFixed(0)}%</span>
                    <span>📡 {bin.signal_strength ?? 90}%</span>
                    <span>🌡️ {bin.temperature ? bin.temperature.toFixed(1) : '--'}°C</span>
                    <span>📦 {bin.capacity}L cap</span>
                  </div>
                  <button onClick={() => onSelectBin(bin.bin_id)} style={{
                    width: '100%', padding: '6px', border: 'none', borderRadius: '6px',
                    background: '#06b6d4', color: '#0b1120', fontWeight: 700, fontSize: '12px',
                    cursor: 'pointer', fontFamily: 'Outfit',
                  }}>
                    Inspect Details &amp; History
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Route Polylines + Distance Labels */}
        {showRoutes && routes.map((route, idx) => {
          const sr = streetRoutes[route.truck_id];
          const coords: [number, number][] = sr?.coords ?? route.path
            .filter(n => n.latitude && n.longitude)
            .map(n => [n.latitude, n.longitude] as [number, number]);
          const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
          const isActive = activeRouteId === route.truck_id;
          const snapped = sr?.snapped ?? false;
          const streets = sr ? uniqueStreets(sr.steps) : [];

          return (
            <React.Fragment key={route.truck_id}>
              <Polyline
                positions={coords}
                color={color}
                weight={isActive ? 6 : 4}
                opacity={snapped ? (isActive ? 1 : 0.8) : 0.45}
                dashArray={snapped ? undefined : '10, 6'}
                eventHandlers={{
                  click: () => setActiveRouteId(prev => prev === route.truck_id ? null : route.truck_id),
                }}
              >
                <Popup>
                  <div style={{ minWidth: '210px' }}>
                    <div style={{ fontWeight: 'bold', color, fontFamily: 'Outfit', fontSize: '15px', marginBottom: '6px' }}>
                      🚚 {route.truck_id}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '10px' }}>
                      Driver: <strong style={{ color: '#f0f4f8' }}>{route.driver}</strong><br />
                      Stops: <strong style={{ color: '#f0f4f8' }}>{route.path.length - 2} bins</strong><br />
                      Distance: <strong style={{ color: '#f0f4f8' }}>
                        {sr ? formatDistance(sr.totalDistanceM) : `${route.distance_km} km`}
                      </strong><br />
                      Est. Time: <strong style={{ color: '#f0f4f8' }}>
                        {sr ? formatDuration(sr.totalDurationS) : `${(route.duration_hours * 60).toFixed(0)} min`}
                      </strong><br />
                      Fuel: <strong style={{ color: '#f0f4f8' }}>{route.fuel_liters} L</strong>
                    </div>

                    {/* Route quality badge */}
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      padding: '3px 8px', borderRadius: '12px', marginBottom: streets.length > 0 ? '10px' : '0',
                      background: snapped ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                      border: `1px solid ${snapped ? 'rgba(16,185,129,0.4)' : 'rgba(245,158,11,0.4)'}`,
                      fontSize: '10px', fontWeight: 700,
                      color: snapped ? '#10b981' : '#f59e0b',
                    }}>
                      {snapped ? '✓ Street-snapped via OSRM' : '⚠ Straight-line estimate'}
                    </div>

                    {/* Street name list */}
                    {streets.length > 0 && (
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                          🛣 Roads on this route
                        </div>
                        <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          {streets.slice(0, 15).map((st, i) => (
                            <div key={i} style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              fontSize: '11px', padding: '2px 0',
                              borderBottom: '1px solid rgba(255,255,255,0.04)',
                            }}>
                              <span style={{ color: '#cbd5e1', flex: 1, marginRight: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {st.name}
                              </span>
                              <span style={{ color, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '10px', flexShrink: 0 }}>
                                {formatDistance(st.distance)}
                              </span>
                            </div>
                          ))}
                          {streets.length > 15 && (
                            <div style={{ fontSize: '10px', color: '#64748b', textAlign: 'center', paddingTop: '4px' }}>
                              +{streets.length - 15} more roads…
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </Popup>
              </Polyline>

              {/* Distance label at route midpoint */}
              {showDistanceLabels && sr && coords.length > 2 && (
                <Marker
                  position={midpoint(coords)}
                  icon={createDistanceBadge(
                    `${formatDistance(sr.totalDistanceM)} · ${formatDuration(sr.totalDurationS)}`,
                    color,
                  )}
                  interactive={false}
                />
              )}
            </React.Fragment>
          );
        })}

        {/* Animated Trucks */}
        {showTrucks && routes.map((route, idx) => {
          const sr = streetRoutes[route.truck_id];
          const coords: [number, number][] = sr?.coords ?? route.path
            .filter(n => n.latitude && n.longitude)
            .map(n => [n.latitude, n.longitude] as [number, number]);

          return (
            <AnimatedTruck
              key={`truck-${route.truck_id}`}
              coords={coords}
              color={ROUTE_COLORS[idx % ROUTE_COLORS.length]}
              truckId={route.truck_id}
            />
          );
        })}
      </MapContainer>
    </div>
  );
};

export default MapComponent;
