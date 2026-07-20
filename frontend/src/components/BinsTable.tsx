import React, { useState } from 'react';
import { Search, ChevronUp, ChevronDown } from 'lucide-react';

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
  status?: string;
  last_updated?: string;
}

interface BinsTableProps {
  bins: BinData[];
  onSelectBin: (binId: string) => void;
  selectedBinId: string | null;
}

type SortKey = 'bin_id' | 'current_fill_percentage' | 'priority_score' | 'battery_level' | 'area_type';
type SortDir = 'asc' | 'desc';

const getFillColor = (fill: number) => {
  if (fill >= 80) return 'red';
  if (fill >= 50) return 'yellow';
  return 'green';
};

const AREA_TYPES = ['All', 'Residential', 'Commercial', 'Market', 'Hospital', 'School',
  'Restaurant', 'Mall', 'Bus Stand', 'Railway Station', 'Park', 'Industrial'];

const BinsTable: React.FC<BinsTableProps> = ({ bins, onSelectBin, selectedBinId }) => {
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'critical' | 'warning' | 'normal'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('current_fill_percentage');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const filtered = bins
    .filter(b => {
      const fill = b.current_fill_percentage ?? 0;
      const matchSearch = b.bin_id.toLowerCase().includes(search.toLowerCase()) ||
        (b.street_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (b.area_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (b.ward || '').toLowerCase().includes(search.toLowerCase());
      const matchArea = areaFilter === 'All' || b.area_type === areaFilter;
      const matchStatus = statusFilter === 'all' ? true :
        statusFilter === 'critical' ? fill >= 80 :
        statusFilter === 'warning' ? fill >= 50 && fill < 80 :
        fill < 50;
      return matchSearch && matchArea && matchStatus;
    })
    .sort((a, b) => {
      let aVal: any = a[sortKey] ?? 0;
      let bVal: any = b[sortKey] ?? 0;
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const SortIcon: React.FC<{ col: SortKey }> = ({ col }) => {
    if (sortKey !== col) return <span style={{ opacity: 0.3 }}>↕</span>;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  const criticalCount = bins.filter(b => (b.current_fill_percentage ?? 0) >= 80).length;
  const warningCount = bins.filter(b => { const f = b.current_fill_percentage ?? 0; return f >= 50 && f < 80; }).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '14px', overflow: 'hidden' }}>
      
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', flexShrink: 0 }}>
        {[
          { label: 'Total Bins', value: bins.length, color: 'var(--accent-cyan)', key: 'all' },
          { label: 'Critical (≥80%)', value: criticalCount, color: 'var(--color-danger)', key: 'critical' },
          { label: 'Warning (50-80%)', value: warningCount, color: 'var(--color-warning)', key: 'warning' },
          { label: 'Normal (<50%)', value: bins.length - criticalCount - warningCount, color: 'var(--color-success)', key: 'normal' },
        ].map(c => (
          <button key={c.key}
            onClick={() => setStatusFilter(statusFilter === c.key ? 'all' : c.key as any)}
            style={{
              background: statusFilter === c.key ? `${c.color}20` : 'var(--bg-glass)',
              border: `1px solid ${statusFilter === c.key ? c.color + '50' : 'var(--border-glass)'}`,
              borderRadius: '12px', padding: '12px 14px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left',
              transition: 'all 0.2s ease'
            }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{c.label}</span>
            <span style={{ fontFamily: 'Outfit', fontSize: '22px', fontWeight: 800, color: c.color }}>{c.value}</span>
          </button>
        ))}
      </div>

      {/* Search + Filters */}
      <div style={{ display: 'flex', gap: '10px', flexShrink: 0, alignItems: 'center' }}>
        <div className="search-wrapper" style={{ flex: 1 }}>
          <Search size={14} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by Bin ID, street, area, ward..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          value={areaFilter}
          onChange={e => setAreaFilter(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-glass)',
            borderRadius: '8px', color: 'var(--text-primary)', padding: '7px 10px',
            fontSize: '13px', outline: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-sans)'
          }}
        >
          {AREA_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {filtered.length} of {bins.length} bins
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', borderRadius: '12px', border: '1px solid var(--border-glass)', background: 'var(--bg-glass)' }}>
        <table className="data-table" style={{ minWidth: '900px' }}>
          <thead>
            <tr>
              {[
                { key: 'bin_id', label: 'Bin ID' },
                { key: null, label: 'Location' },
                { key: 'area_type', label: 'Area Type' },
                { key: 'current_fill_percentage', label: 'Current Fill' },
                { key: 'priority_score', label: 'Priority' },
                { key: 'battery_level', label: 'Battery' },
                { key: null, label: 'Signal' },
                { key: null, label: 'Status' },
                { key: null, label: 'Actions' },
              ].map((col, i) => (
                <th key={i} onClick={col.key ? () => handleSort(col.key as SortKey) : undefined}
                  style={{ cursor: col.key ? 'pointer' : 'default' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {col.label} {col.key && <SortIcon col={col.key as SortKey} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(bin => {
              const fill = bin.current_fill_percentage ?? 0;
              const fillClass = getFillColor(fill);
              const isSelected = bin.bin_id === selectedBinId;

              return (
                <tr key={bin.bin_id}
                  style={{ background: isSelected ? 'rgba(6,182,212,0.06)' : undefined, cursor: 'pointer' }}
                  onClick={() => onSelectBin(bin.bin_id)}>
                  <td>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: 'var(--text-primary)', fontSize: '13px' }}>
                      {bin.bin_id}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: '12px' }}>
                      <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{bin.street_name || '—'}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{bin.ward} · {bin.area_name}</div>
                    </div>
                  </td>
                  <td>
                    <span style={{
                      padding: '2px 7px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
                      background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)'
                    }}>{bin.area_type}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '100px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className={`fill-badge ${fillClass}`}>{fill.toFixed(1)}%</span>
                      </div>
                      <div className="fill-bar-container">
                        <div className={`fill-bar ${fillClass}`} style={{ width: `${fill}%` }} />
                      </div>
                    </div>
                  </td>
                  <td>
                    {bin.priority_score !== undefined ? (
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', fontWeight: 700,
                        color: (bin.priority_score ?? 0) >= 75 ? 'var(--color-danger)' :
                               (bin.priority_score ?? 0) >= 50 ? 'var(--color-warning)' : 'var(--color-success)'
                      }}>{bin.priority_score.toFixed(1)}</span>
                    ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '60px' }}>
                      <span style={{ fontSize: '12px', color: (bin.battery_level ?? 100) < 20 ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                        🔋 {(bin.battery_level ?? 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      📡 {bin.signal_strength ?? 90}%
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${bin.status === 'Active' ? 'active' : 'offline'}`}>
                      {bin.status || 'Active'}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={e => { e.stopPropagation(); onSelectBin(bin.bin_id); }}
                      className="btn btn-secondary btn-sm"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No bins match the current filter criteria.
          </div>
        )}
      </div>
    </div>
  );
};

export default BinsTable;
