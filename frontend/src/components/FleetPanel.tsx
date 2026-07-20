import React, { useState } from 'react';
import { Truck, User, MapPin, Navigation, Gauge, CheckCircle, QrCode } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

interface TruckData {
  truck_id: string;
  plate_number?: string;
  capacity: number;
  driver: string;
  status: string;
  current_latitude?: number;
  current_longitude?: number;
  has_route: boolean;
  route_bins: number;
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

interface FleetPanelProps {
  trucks: TruckData[];
  routes: RouteData[];
  onSelectBin: (binId: string) => void;
  onEditTruck?: (truck: TruckData) => void;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  'Idle':        { color: 'var(--accent-cyan)',    bg: 'var(--accent-cyan-dim)',    label: 'Idle' },
  'En Route':    { color: 'var(--accent-purple)',  bg: 'var(--accent-purple-dim)',  label: 'En Route' },
  'Collecting':  { color: 'var(--color-warning)',  bg: 'var(--color-warning-dim)',  label: 'Collecting' },
  'Maintenance': { color: 'var(--text-muted)',     bg: 'rgba(100,116,139,0.1)',     label: 'Maintenance' },
  'Inactive':    { color: 'var(--color-danger)',   bg: 'var(--color-danger-dim)',   label: 'Inactive' },
};

const ROUTE_COLORS = ['#06b6d4', '#8b5cf6', '#f97316', '#ec4899', '#10b981'];

const FleetPanel: React.FC<FleetPanelProps> = ({ trucks, routes, onSelectBin, onEditTruck }) => {
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(
    trucks.length > 0 ? trucks[0].truck_id : null
  );

  const [qrModalDriver, setQrModalDriver] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [loadingQR, setLoadingQR] = useState(false);

  const fetchQRToken = async (driverName: string) => {
    setQrModalDriver(driverName);
    setLoadingQR(true);
    setQrToken(null);
    try {
      const res = await fetch(`/api/qr/token/Driver/${encodeURIComponent(driverName)}`);
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

  const selectedRoute = routes.find(r => r.truck_id === selectedTruckId);
  const routeIdx = routes.findIndex(r => r.truck_id === selectedTruckId);
  const routeColor = ROUTE_COLORS[routeIdx >= 0 ? routeIdx % ROUTE_COLORS.length : 0];

  const activeCount = trucks.filter(t => ['Idle', 'En Route', 'Collecting'].includes(t.status)).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px', overflow: 'hidden' }}>
      
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', flexShrink: 0 }}>
        {[
          { label: 'Total Fleet', value: trucks.length, color: 'var(--accent-cyan)' },
          { label: 'Active Trucks', value: activeCount, color: 'var(--color-success)' },
          { label: 'Routes Today', value: routes.length, color: 'var(--accent-purple)' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--bg-glass)', border: '1px solid var(--border-glass)',
            borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px'
          }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{s.label}</span>
            <span style={{ fontFamily: 'Outfit', fontSize: '26px', fontWeight: 800, color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '14px' }}>
        
        {/* Truck Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', paddingRight: '4px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', flexShrink: 0 }}>Fleet Status</div>
          {trucks.map((truck) => {
            const statusCfg = STATUS_CONFIG[truck.status] || STATUS_CONFIG['Idle'];
            const isSelected = truck.truck_id === selectedTruckId;
            const tColor = ROUTE_COLORS[routes.findIndex(r => r.truck_id === truck.truck_id) % ROUTE_COLORS.length] || '#64748b';

            return (
              <div
                key={truck.truck_id}
                onClick={() => setSelectedTruckId(truck.truck_id)}
                style={{
                  padding: '14px', borderRadius: '12px', cursor: 'pointer',
                  border: `1px solid ${isSelected ? tColor + '60' : 'var(--border-glass)'}`,
                  background: isSelected ? `${tColor}10` : 'var(--bg-glass)',
                  transition: 'all 0.2s ease',
                  flexShrink: 0
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '8px',
                      background: `${tColor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px'
                    }}>🚚</div>
                    <div>
                      <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{truck.truck_id}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{truck.plate_number || '—'}</div>
                    </div>
                  </div>
                  <span style={{
                    padding: '3px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 700,
                    background: statusCfg.bg, color: statusCfg.color
                  }}>{statusCfg.label}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '4px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '11px', color: 'var(--text-secondary)', flex: 1 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <User size={10} /> {truck.driver}
                      <button 
                        onClick={(e) => { e.stopPropagation(); fetchQRToken(truck.driver); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-cyan)', padding: '2px', display: 'flex', alignItems: 'center' }}
                        title="Show Driver QR"
                      ><QrCode size={12} /></button>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Gauge size={10} /> {truck.capacity.toLocaleString()}L</span>
                    {truck.has_route && (
                      <span style={{ color: tColor, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={10} /> {truck.route_bins} bins
                      </span>
                    )}
                  </div>
                  {onEditTruck && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditTruck(truck);
                      }}
                      style={{
                        padding: '3px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)',
                        borderRadius: '6px', cursor: 'pointer', fontSize: '10px', color: 'var(--text-primary)',
                        fontWeight: 700, outline: 'none'
                      }}
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Route Detail */}
        <div style={{ overflowY: 'auto', paddingRight: '4px' }}>
          {selectedRoute ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Route: {selectedRoute.truck_id}
              </div>

              {/* Route Stats */}
              <div style={{
                background: 'var(--bg-glass)', border: '1px solid var(--border-glass)',
                borderRadius: '12px', padding: '14px', display: 'grid',
                gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px'
              }}>
                {[
                  { icon: <Navigation size={12} />, label: 'Distance', value: `${selectedRoute.distance_km} km` },
                  { icon: <Gauge size={12} />, label: 'Est. Fuel', value: `${selectedRoute.fuel_liters} L` },
                  { icon: <User size={12} />, label: 'Driver', value: selectedRoute.driver },
                  { icon: <CheckCircle size={12} />, label: 'Stops', value: `${selectedRoute.path.length - 2} bins` },
                ].map((s, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>{s.icon} {s.label}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{s.value}</span>
                  </div>
                ))}
              </div>

              {/* Sequence */}
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Collection Sequence
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '16px', position: 'relative' }}>
                <div style={{
                  position: 'absolute', top: '12px', bottom: '12px', left: '6px',
                  width: '2px', background: `linear-gradient(180deg, ${routeColor} 70%, transparent)`
                }} />
                {selectedRoute.path.map((node, idx) => {
                  const isDepot = node.bin_id === 'DEPOT';
                  return (
                    <div key={idx} style={{ position: 'relative', paddingBottom: '14px', zIndex: 1 }}>
                      <div style={{
                        position: 'absolute', left: '-16px', top: '4px',
                        width: '12px', height: '12px', borderRadius: '50%',
                        background: isDepot ? routeColor : 'var(--bg-primary)',
                        border: `2px solid ${routeColor}`,
                        boxShadow: isDepot ? `0 0 8px ${routeColor}` : 'none'
                      }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          {isDepot ? (
                            <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-primary)' }}>
                              {idx === 0 ? '🚀 GHMC Depot (Start)' : '🏁 GHMC Depot (Return)'}
                            </span>
                          ) : (
                            <button onClick={() => onSelectBin(node.bin_id)} style={{
                              background: 'none', border: 'none', color: routeColor,
                              cursor: 'pointer', fontWeight: 700, fontSize: '12px',
                              fontFamily: 'JetBrains Mono, monospace', padding: 0, textDecoration: 'underline'
                            }}>
                              Stop {idx}: {node.bin_id}
                            </button>
                          )}
                          {!isDepot && (
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
                              {node.latitude.toFixed(4)}, {node.longitude.toFixed(4)}
                            </div>
                          )}
                        </div>
                        {!isDepot && (
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {Math.round(node.load_at_node)}L
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: '10px'
            }}>
              <Truck size={40} style={{ strokeWidth: 1.2 }} />
              <p style={{ fontSize: '13px', textAlign: 'center' }}>
                {routes.length === 0
                  ? 'No routes generated. Click "Optimize Routes" to generate.'
                  : 'Select a truck to view route sequence.'}
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* QR Code Modal for Fleet Manager */}
      {qrModalDriver && (
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
              Driver QR Code
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 20px 0' }}>
              {qrModalDriver}
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
                          <head><title>Print Driver QR</title></head>
                          <body style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;margin:0;font-family:sans-serif;">
                            <h2>Driver: ${qrModalDriver}</h2>
                            <img src="${dataUrl}" style="width: 300px; height: 300px;" onload="window.print();window.close()" />
                          </body>
                        </html>
                      `);
                      printWindow.document.close();
                    }
                  }
                }}
                style={{ flex: 1, padding: '10px', background: 'var(--accent-purple)', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                Print QR
              </button>
              <button
                onClick={() => setQrModalDriver(null)}
                style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FleetPanel;
