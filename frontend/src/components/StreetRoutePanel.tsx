import React, { useState } from 'react';
import { Navigation, ChevronDown, ChevronUp, AlertTriangle, CheckCircle } from 'lucide-react';

// ─── Interfaces ──────────────────────────────────────────────

interface OsrmStep {
  name: string;
  distance: number;   // metres
  duration: number;   // seconds
  maneuver: { type: string; modifier?: string };
}

interface StreetRoute {
  coords: [number, number][];
  steps: OsrmStep[];
  totalDistanceM: number;
  totalDurationS: number;
  snapped: boolean;
}

interface RouteData {
  route_id?: number;
  truck_id: string;
  driver: string;
  distance_km: number;
  fuel_liters: number;
  duration_hours: number;
  path: { bin_id: string; latitude: number; longitude: number; load_at_node: number }[];
}

interface StreetRoutePanelProps {
  routes: RouteData[];
  streetRoutes: Record<string, StreetRoute>;
  fetchingRoutes: boolean;
}

// ─── Utilities ───────────────────────────────────────────────

const ROUTE_COLORS = ['#06b6d4', '#8b5cf6', '#f97316', '#ec4899', '#10b981'];

const formatDuration = (s: number): string => {
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return `${h}h ${m}m`;
};

const formatDistance = (m: number): string => {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
};

const maneuverIcon = (step: OsrmStep): string => {
  const { type, modifier } = step.maneuver;
  if (type === 'depart') return '🚀';
  if (type === 'arrive') return '🏁';
  if (type === 'turn') {
    if (modifier === 'left' || modifier === 'sharp left') return '↰';
    if (modifier === 'right' || modifier === 'sharp right') return '↱';
    if (modifier === 'slight left') return '↖';
    if (modifier === 'slight right') return '↗';
    return '⬆';
  }
  if (type === 'new name' || type === 'continue') return '⬆';
  if (type === 'merge') return '⤵';
  if (type === 'roundabout' || type === 'rotary') return '🔄';
  if (type === 'fork') return '⑂';
  if (type === 'end of road') return '⬆';
  return '⬆';
};

// ─── Single Route Card ────────────────────────────────────────

interface RouteCardProps {
  route: RouteData;
  sr: StreetRoute | undefined;
  color: string;
}

const RouteCard: React.FC<RouteCardProps> = ({ route, sr, color }) => {
  const [expanded, setExpanded] = useState(false);

  const displayedSteps = sr?.steps.filter(s => s.name && s.name !== '') ?? [];
  const totalM = sr?.totalDistanceM ?? route.distance_km * 1000;
  const totalS = sr?.totalDurationS ?? route.duration_hours * 3600;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: `1px solid ${expanded ? color + '55' : 'rgba(255,255,255,0.06)'}`,
      borderRadius: '12px',
      overflow: 'hidden',
      transition: 'border-color 0.2s ease',
    }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(p => !p)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px',
          borderBottom: expanded ? `1px solid ${color}33` : 'none',
        }}
      >
        {/* Colour dot */}
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: color, boxShadow: `0 0 8px ${color}`, flexShrink: 0,
        }} />

        {/* Truck info */}
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '14px', color: '#f0f4f8' }}>
            {route.truck_id}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            👤 {route.driver} · {route.path.length - 2} stops
          </div>
        </div>

        {/* Stats */}
        <div style={{ textAlign: 'right', marginRight: '6px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color, fontFamily: 'JetBrains Mono, monospace' }}>
            {formatDistance(totalM)}
          </div>
          <div style={{ fontSize: '10px', color: '#64748b' }}>
            {formatDuration(totalS)}
          </div>
        </div>

        {/* Snapped badge */}
        <div style={{ flexShrink: 0 }}>
          {sr?.snapped ? (
            <CheckCircle size={14} color="#10b981" />
          ) : (
            <AlertTriangle size={14} color="#f59e0b" />
          )}
        </div>

        {expanded ? <ChevronUp size={14} color="#64748b" /> : <ChevronDown size={14} color="#64748b" />}
      </button>

      {/* Expanded turn-by-turn */}
      {expanded && (
        <div style={{ padding: '0 12px 12px 12px' }}>
          {/* Route quality note */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 10px', borderRadius: '8px', margin: '10px 0',
            background: sr?.snapped ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
            border: `1px solid ${sr?.snapped ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
          }}>
            {sr?.snapped ? (
              <>
                <CheckCircle size={11} color="#10b981" />
                <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 600 }}>Street-snapped via OSRM (real road network)</span>
              </>
            ) : (
              <>
                <AlertTriangle size={11} color="#f59e0b" />
                <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 600 }}>Straight-line estimate (OSRM unavailable)</span>
              </>
            )}
          </div>

          {/* Turn-by-turn list */}
          {displayedSteps.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '280px', overflowY: 'auto' }}>
              {displayedSteps.map((step, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '5px 6px', borderRadius: '6px',
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                }}>
                  {/* Maneuver icon */}
                  <span style={{ fontSize: '13px', width: '18px', textAlign: 'center', flexShrink: 0 }}>
                    {maneuverIcon(step)}
                  </span>

                  {/* Street name */}
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{
                      fontSize: '11px', fontWeight: 600, color: '#e2e8f0',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {step.name || '(unnamed road)'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#475569', marginTop: '1px' }}>
                      {step.maneuver.type}{step.maneuver.modifier ? ` ${step.maneuver.modifier}` : ''}
                    </div>
                  </div>

                  {/* Distance + duration */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color, fontFamily: 'JetBrains Mono, monospace' }}>
                      {formatDistance(step.distance)}
                    </div>
                    <div style={{ fontSize: '9px', color: '#475569' }}>
                      {formatDuration(step.duration)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#475569', fontSize: '12px', padding: '16px' }}>
              No turn-by-turn data available.<br />
              <span style={{ fontSize: '10px' }}>Click "Optimize Routes" to generate street-snapped routes.</span>
            </div>
          )}

          {/* Fuel summary */}
          <div style={{
            display: 'flex', gap: '8px', marginTop: '10px',
          }}>
            {[
              { label: 'Fuel', value: `${route.fuel_liters} L` },
              { label: 'Stops', value: `${route.path.length - 2}` },
              { label: 'Road segments', value: `${displayedSteps.length}` },
            ].map(stat => (
              <div key={stat.label} style={{
                flex: 1, background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '8px', padding: '7px 8px', textAlign: 'center',
              }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#f0f4f8', fontFamily: 'JetBrains Mono, monospace' }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: '9px', color: '#475569', marginTop: '2px' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Panel ───────────────────────────────────────────────

const StreetRoutePanel: React.FC<StreetRoutePanelProps> = ({ routes, streetRoutes, fetchingRoutes }) => {
  const snappedCount = Object.values(streetRoutes).filter(r => r.snapped).length;
  const totalDistanceM = Object.values(streetRoutes).reduce((sum, r) => sum + r.totalDistanceM, 0);
  const totalDurationS = Object.values(streetRoutes).reduce((sum, r) => sum + r.totalDurationS, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Panel header */}
      <div style={{
        padding: '16px 20px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <Navigation size={16} color="var(--accent-cyan, #06b6d4)" />
        <div>
          <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '15px', color: '#f0f4f8' }}>
            Street Route Details
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            Real road distances via OSRM
          </div>
        </div>
        {fetchingRoutes && (
          <div style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '11px', color: '#06b6d4',
          }}>
            <div style={{
              width: 8, height: 8, border: '2px solid #06b6d4',
              borderTopColor: 'transparent', borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
            }} />
            Loading…
          </div>
        )}
      </div>

      {/* Summary bar */}
      {routes.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px', padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}>
          {[
            { label: 'Total Distance', value: formatDistance(totalDistanceM), color: '#06b6d4' },
            { label: 'Est. Total Time', value: formatDuration(totalDurationS), color: '#8b5cf6' },
            { label: 'Street-Snapped', value: `${snappedCount}/${routes.length}`, color: snappedCount === routes.length ? '#10b981' : '#f59e0b' },
          ].map(stat => (
            <div key={stat.label} style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '10px', padding: '10px 12px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color: stat.color, fontFamily: 'Outfit' }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '10px', color: '#475569', marginTop: '3px' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Route cards */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {routes.length === 0 ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: '#475569', textAlign: 'center', gap: '12px', padding: '32px',
          }}>
            <Navigation size={36} style={{ strokeWidth: 1.2 }} />
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                No routes generated yet
              </p>
              <p style={{ fontSize: '12px' }}>
                Click <strong style={{ color: '#06b6d4' }}>Optimize Routes</strong> in the sidebar to generate AI-optimized truck routes with real street distances.
              </p>
            </div>
          </div>
        ) : (
          routes.map((route, idx) => (
            <RouteCard
              key={route.truck_id}
              route={route}
              sr={streetRoutes[route.truck_id]}
              color={ROUTE_COLORS[idx % ROUTE_COLORS.length]}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default StreetRoutePanel;
