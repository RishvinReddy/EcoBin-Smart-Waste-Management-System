import { useState } from 'react';
import { Truck as TruckIcon, Navigation, User, MapPin, Gauge } from 'lucide-react';

interface RoutePathNode {
  bin_id: string;
  latitude: number;
  longitude: number;
  load_at_node: number;
}

interface RouteData {
  truck_id: string;
  driver: string;
  distance_km: number;
  fuel_liters: number;
  duration_hours: number;
  path: RoutePathNode[];
}

interface RouteViewerProps {
  routes: RouteData[];
  onSelectBin: (binId: string) => void;
}

const ROUTE_COLORS = [
  '#06b6d4', // Cyan
  '#8b5cf6', // Purple
  '#f97316', // Orange
  '#ec4899', // Pink
  '#10b981'  // Emerald
];

const RouteViewer = ({ routes, onSelectBin }: RouteViewerProps) => {
  const [activeRouteId, setActiveRouteId] = useState<string | null>(
    routes.length > 0 ? routes[0].truck_id : null
  );

  if (routes.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
        <TruckIcon size={48} style={{ marginBottom: '12px', strokeWidth: 1.5 }} />
        <p style={{ fontFamily: 'Outfit', fontWeight: '500' }}>No active collection routes generated.</p>
        <p style={{ fontSize: '12px', marginTop: '4px' }}>Proactive collections are not required today.</p>
      </div>
    );
  }

  const activeRoute = routes.find(r => r.truck_id === activeRouteId) || routes[0];
  const activeIndex = routes.findIndex(r => r.truck_id === activeRouteId);
  const routeColor = ROUTE_COLORS[activeIndex >= 0 ? activeIndex % ROUTE_COLORS.length : 0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      {/* Route Selector Tabs */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        {routes.map((route: RouteData, idx: number) => {
          const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
          const isActive = route.truck_id === activeRouteId;
          
          return (
            <button
              key={route.truck_id}
              onClick={() => setActiveRouteId(route.truck_id)}
              style={{
                background: isActive ? color : 'var(--bg-secondary)',
                color: isActive ? '#0b0f19' : 'var(--text-primary)',
                border: isActive ? `1px solid ${color}` : '1px solid var(--border-glass)',
                padding: '8px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontFamily: 'Outfit',
                fontWeight: 'bold',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                transition: 'var(--transition-smooth)'
              }}
            >
              <TruckIcon size={14} />
              {route.truck_id}
            </button>
          );
        })}
      </div>

      {/* Active Route Details */}
      {activeRoute && (
        <div className="glass-panel" style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          <div style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'Outfit', fontSize: '18px', fontWeight: 'bold', color: routeColor }}>
                Route Operations: {activeRoute.truck_id}
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {activeRoute.path.length - 2} Collections
              </span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <User size={14} />
                Driver: <strong style={{ color: 'var(--text-primary)' }}>{activeRoute.driver}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <Navigation size={14} />
                Distance: <strong style={{ color: 'var(--text-primary)' }}>{activeRoute.distance_km} km</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <Gauge size={14} />
                Est. Fuel: <strong style={{ color: 'var(--text-primary)' }}>{activeRoute.fuel_liters} L</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <Navigation size={14} />
                Duration: <strong style={{ color: 'var(--text-primary)' }}>{activeRoute.duration_hours} hrs</strong>
              </div>
            </div>
          </div>

          {/* Sequence Step-by-Step */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ fontFamily: 'Outfit', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
              Collection Sequence
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingLeft: '20px' }}>
              {/* Connecting Line */}
              <div style={{
                position: 'absolute',
                top: '12px',
                bottom: '12px',
                left: '6px',
                width: '2px',
                background: `linear-gradient(180deg, ${routeColor} 70%, transparent)`,
                zIndex: 0
              }}></div>

              {activeRoute.path.map((node: RoutePathNode, index: number) => {
                const isDepot = node.bin_id === 'DEPOT';
                const isStart = index === 0;
                
                return (
                  <div 
                    key={index} 
                    style={{ 
                      position: 'relative', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      paddingBottom: '20px',
                      zIndex: 1
                    }}
                  >
                    {/* Circle Node indicator */}
                    <div style={{
                      position: 'absolute',
                      left: '-20px',
                      top: '4px',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      background: isDepot ? '#06b6d4' : 'var(--bg-primary)',
                      border: `3px solid ${routeColor}`,
                      boxShadow: isDepot ? '0 0 6px #06b6d4' : 'none'
                    }}></div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        {isDepot ? (
                          <span style={{ fontFamily: 'Outfit', fontWeight: 'bold', fontSize: '13px', color: '#f8fafc' }}>
                            {isStart ? '🚀 Central Depot (Departure)' : '🏁 Central Depot (Return)'}
                          </span>
                        ) : (
                          <button
                            onClick={() => onSelectBin(node.bin_id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-primary)',
                              cursor: 'pointer',
                              fontFamily: 'Outfit',
                              fontWeight: 'bold',
                              fontSize: '13px',
                              textAlign: 'left',
                              padding: 0,
                              textDecoration: 'underline'
                            }}
                          >
                            Stop {index}: {node.bin_id}
                          </button>
                        )}
                        
                        {!isDepot && (
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            <MapPin size={10} />
                            {node.latitude.toFixed(4)}, {node.longitude.toFixed(4)}
                          </div>
                        )}
                      </div>

                      <div style={{ textAlign: 'right', fontSize: '12px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Load:</span>{' '}
                        <strong style={{ color: 'var(--text-primary)' }}>{Math.round(node.load_at_node)} L</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteViewer;
