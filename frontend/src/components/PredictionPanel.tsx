import React from 'react';
import { Sparkles, AlertTriangle, CheckCircle } from 'lucide-react';

interface PredictionItem {
  bin_id: string;
  street_name?: string;
  area_name?: string;
  ward?: string;
  area_type: string;
  capacity: number;
  current_fill_percentage: number;
  predicted_fill: number;
  overflow_probability: number;
  priority_score: number;
  latitude: number;
  longitude: number;
}

interface PredictionPanelProps {
  predictions: PredictionItem[];
  onSelectBin: (binId: string) => void;
}

const getFillColor = (fill: number) => {
  if (fill >= 80) return 'var(--color-danger)';
  if (fill >= 50) return 'var(--color-warning)';
  return 'var(--color-success)';
};

const getFillClass = (fill: number) => {
  if (fill >= 80) return 'red';
  if (fill >= 50) return 'yellow';
  return 'green';
};

const PredictionPanel: React.FC<PredictionPanelProps> = ({ predictions, onSelectBin }) => {
  const [sortBy, setSortBy] = React.useState<'overflow' | 'fill' | 'priority'>('overflow');
  const [showOnlyCritical, setShowOnlyCritical] = React.useState(false);

  const criticalCount = predictions.filter(p => p.predicted_fill >= 80).length;
  const highRiskCount = predictions.filter(p => p.overflow_probability >= 70).length;
  const avgFill = predictions.length > 0 ? predictions.reduce((s, p) => s + p.predicted_fill, 0) / predictions.length : 0;

  const sorted = [...predictions]
    .filter(p => showOnlyCritical ? p.predicted_fill >= 80 : true)
    .sort((a, b) => {
      if (sortBy === 'overflow') return b.overflow_probability - a.overflow_probability;
      if (sortBy === 'fill') return b.predicted_fill - a.predicted_fill;
      return b.priority_score - a.priority_score;
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '14px', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Sparkles size={18} color="var(--accent-orange)" />
          <div>
            <h2 style={{ fontFamily: 'Outfit', fontSize: '18px', fontWeight: 700 }}>AI Prediction — 24h Forecast</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>XGBoost model · Tomorrow's fill levels</p>
          </div>
        </div>
      </div>

      {/* Summary KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', flexShrink: 0 }}>
        <div style={{ background: 'var(--color-danger-dim)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontSize: '10px', color: 'var(--color-danger)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Predicted Overflow</div>
          <div style={{ fontFamily: 'Outfit', fontSize: '28px', fontWeight: 800, color: 'var(--color-danger)' }}>{criticalCount}</div>
          <div style={{ fontSize: '11px', color: 'rgba(239,68,68,0.7)' }}>bins ≥ 80% tomorrow</div>
        </div>
        <div style={{ background: 'var(--color-warning-dim)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontSize: '10px', color: 'var(--color-warning)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>High Risk</div>
          <div style={{ fontFamily: 'Outfit', fontSize: '28px', fontWeight: 800, color: 'var(--color-warning)' }}>{highRiskCount}</div>
          <div style={{ fontSize: '11px', color: 'rgba(245,158,11,0.7)' }}>bins ≥ 70% overflow prob</div>
        </div>
        <div style={{ background: 'var(--accent-cyan-dim)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontSize: '10px', color: 'var(--accent-cyan)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Avg Predicted Fill</div>
          <div style={{ fontFamily: 'Outfit', fontSize: '28px', fontWeight: 800, color: 'var(--accent-cyan)' }}>{avgFill.toFixed(1)}%</div>
          <div style={{ fontSize: '11px', color: 'rgba(6,182,212,0.7)' }}>across all {predictions.length} bins</div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sort by:</span>
        {[
          { key: 'overflow', label: 'Overflow Risk' },
          { key: 'fill', label: 'Fill Level' },
          { key: 'priority', label: 'Priority Score' },
        ].map(s => (
          <button key={s.key} onClick={() => setSortBy(s.key as any)} style={{
            padding: '5px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer',
            fontSize: '12px', fontWeight: 600,
            background: sortBy === s.key ? 'var(--accent-cyan-dim)' : 'rgba(255,255,255,0.04)',
            color: sortBy === s.key ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            transition: 'all 0.15s ease'
          }}>{s.label}</button>
        ))}
        <button onClick={() => setShowOnlyCritical(!showOnlyCritical)} style={{
          padding: '5px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer',
          fontSize: '12px', fontWeight: 600, marginLeft: 'auto',
          background: showOnlyCritical ? 'var(--color-danger-dim)' : 'rgba(255,255,255,0.04)',
          color: showOnlyCritical ? 'var(--color-danger)' : 'var(--text-secondary)',
          transition: 'all 0.15s ease'
        }}>
          {showOnlyCritical ? '⚠ Critical Only' : 'All Bins'}
        </button>
      </div>

      {/* Prediction Table */}
      <div style={{ flex: 1, overflow: 'auto', borderRadius: '12px', border: '1px solid var(--border-glass)', background: 'var(--bg-glass)' }}>
        {sorted.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Sparkles size={32} style={{ marginBottom: '10px', opacity: 0.5 }} />
            <p>No predictions available. Click "Compute Predictions" to generate.</p>
          </div>
        ) : (
          <table className="data-table" style={{ minWidth: '800px' }}>
            <thead>
              <tr>
                <th>Bin ID</th>
                <th>Location</th>
                <th>Current Fill</th>
                <th>Predicted (24h)</th>
                <th>Overflow Risk</th>
                <th>Priority Score</th>
                <th>Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(p => {
                const fillClass = getFillClass(p.predicted_fill);
                const needsCollection = p.predicted_fill >= 80 || p.priority_score >= 75;
                const riskColor = p.overflow_probability >= 80 ? 'var(--color-danger)' : p.overflow_probability >= 50 ? 'var(--color-warning)' : 'var(--color-success)';

                return (
                  <tr key={p.bin_id} style={{ cursor: 'pointer' }} onClick={() => onSelectBin(p.bin_id)}>
                    <td>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: 'var(--text-primary)', fontSize: '13px' }}>
                        {p.bin_id}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '12px' }}>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{p.street_name || '—'}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{p.ward}</div>
                      </div>
                    </td>
                    <td>
                      <span className={`fill-badge ${getFillClass(p.current_fill_percentage)}`}>
                        {p.current_fill_percentage.toFixed(1)}%
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '90px' }}>
                        <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '14px', color: getFillColor(p.predicted_fill) }}>
                          {p.predicted_fill.toFixed(1)}%
                        </span>
                        <div className="fill-bar-container">
                          <div className={`fill-bar ${fillClass}`} style={{ width: `${p.predicted_fill}%` }} />
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '80px' }}>
                        <span style={{ fontFamily: 'Outfit', fontWeight: 700, color: riskColor, fontSize: '14px' }}>
                          {p.overflow_probability.toFixed(1)}%
                        </span>
                        <div className="fill-bar-container">
                          <div style={{
                            height: '100%', borderRadius: '3px', background: riskColor,
                            width: `${p.overflow_probability}%`, transition: 'width 0.5s ease'
                          }} />
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '13px',
                        color: p.priority_score >= 75 ? 'var(--color-danger)' : p.priority_score >= 50 ? 'var(--color-warning)' : 'var(--color-success)'
                      }}>{p.priority_score.toFixed(1)}</span>
                    </td>
                    <td>
                      {needsCollection ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-danger)', fontSize: '11px', fontWeight: 700 }}>
                          <AlertTriangle size={12} /> Collect Tomorrow
                        </span>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-success)', fontSize: '11px' }}>
                          <CheckCircle size={12} /> No Action Needed
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default PredictionPanel;
