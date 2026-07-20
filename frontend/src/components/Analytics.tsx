import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend, AreaChart, Area, 
  LineChart, Line 
} from 'recharts';
import { ShieldAlert, TrendingUp, Sparkles, Mail, X } from 'lucide-react';
import { useState } from 'react';
import { sendEmailAlert } from '../utils/emailjs';

interface ComparisonMetric {
  distance_km: number;
  fuel_liters: number;
  overflow_bins: number;
  duration_hours: number;
  truck_utilization_pct: number;
  bins_collected: number;
}

interface MLEvalResult {
  MAE: number;
  RMSE: number;
  MAPE: number;
  R2: number;
}

interface AreaBreakdown {
  area_type: string;
  waste_tons: number;
}

interface AnalyticsProps {
  comparison: {
    AI: ComparisonMetric;
    Fixed: ComparisonMetric;
  };
  savings: {
    distance_km: number;
    fuel_liters: number;
    co2_kg: number;
  };
  ml_evaluation: {
    [modelName: string]: MLEvalResult;
  } | null;
  area_breakdown: AreaBreakdown[];
}

const Analytics = ({ comparison, savings, ml_evaluation, area_breakdown }: AnalyticsProps) => {
  
  const [showExport, setShowExport] = useState(false);
  const [exportEmail, setExportEmail] = useState('');
  const [exportOptions, setExportOptions] = useState({
    routing: true,
    overflow: true,
    waste: true,
    ml: true
  });
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!exportEmail.trim() || !exportEmail.includes('@')) {
      alert('Please enter a valid email address.');
      return;
    }
    setExporting(true);
    let details = 'Smart Waste Management - Analytics Data Report\n\n';
    
    if (exportOptions.routing) {
      details += `▶ ROUTING EFFICIENCY\n- AI Optimized Distance: ${comparison.AI.distance_km.toFixed(1)} km (vs Fixed ${comparison.Fixed.distance_km.toFixed(1)} km)\n- AI Fuel Usage: ${comparison.AI.fuel_liters.toFixed(1)} Liters (vs Fixed ${comparison.Fixed.fuel_liters.toFixed(1)} Liters)\n- Time: ${comparison.AI.duration_hours.toFixed(1)}h (vs ${comparison.Fixed.duration_hours.toFixed(1)}h)\n\n`;
    }
    if (exportOptions.overflow) {
      details += `▶ OVERFLOW PREVENTION\n- AI Route Overflows: ${comparison.AI.overflow_bins}\n- Fixed Route Overflows: ${comparison.Fixed.overflow_bins}\n- Total Prevented: ${comparison.Fixed.overflow_bins - comparison.AI.overflow_bins}\n\n`;
    }
    if (exportOptions.waste) {
      details += `▶ WASTE GENERATION BY AREA\n${area_breakdown.map(a => `  - ${a.area_type}: ${a.waste_tons} Tons`).join('\n')}\n\n`;
    }
    if (exportOptions.ml && ml_evaluation) {
      details += `▶ PREDICTIVE MODEL BENCHMARKS\n`;
      Object.keys(ml_evaluation).forEach(model => {
        details += `  - ${model}:\n      MAE: ${ml_evaluation[model].MAE.toFixed(2)}\n      RMSE: ${ml_evaluation[model].RMSE.toFixed(2)}\n      Accuracy (R2): ${(ml_evaluation[model].R2 * 100).toFixed(1)}%\n`;
      });
      details += `\n`;
    }

    const success = await sendEmailAlert(
      '📊 Smart Waste Analytics Report',
      'Hello,',
      'Attached is the analytics export you requested from the dashboard.',
      details,
      exportEmail.trim()
    );

    setExporting(false);
    if (success) {
      alert('Analytics data successfully sent to ' + exportEmail);
      setShowExport(false);
      setExportEmail('');
    } else {
      alert('Failed to send email. Check configuration.');
    }
  };

  // Format comparison data for Recharts
  const routingCompareData = [
    {
      name: 'Distance (km)',
      AI: comparison.AI.distance_km,
      Fixed: comparison.Fixed.distance_km,
    },
    {
      name: 'Fuel (L)',
      AI: comparison.AI.fuel_liters,
      Fixed: comparison.Fixed.fuel_liters,
    },
    {
      name: 'Collect Time (h)',
      AI: comparison.AI.duration_hours,
      Fixed: comparison.Fixed.duration_hours,
    }
  ];

  const overflowCompareData = [
    {
      name: 'Overflowing Bins',
      AI: comparison.AI.overflow_bins,
      Fixed: comparison.Fixed.overflow_bins,
    }
  ];

  // Format ML comparison data
  const mlCompareData = ml_evaluation ? Object.keys(ml_evaluation).map((modelName: string) => ({
    name: modelName.replace(' Regressor', '').replace(' (Persistence)', ''),
    MAE: parseFloat(ml_evaluation[modelName].MAE.toFixed(2)),
    RMSE: parseFloat(ml_evaluation[modelName].RMSE.toFixed(2)),
    R2: parseFloat((ml_evaluation[modelName].R2 * 100).toFixed(1))
  })) : [];

  // Custom tooltips to match dark theme aesthetics
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-glass)',
          padding: '10px 14px',
          borderRadius: '8px',
          fontFamily: 'Inter',
          fontSize: '12px',
          boxShadow: 'var(--shadow-premium)'
        }}>
          <p style={{ fontWeight: 'bold', marginBottom: '6px', color: '#f8fafc' }}>{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color, margin: '2px 0' }}>
              {entry.name}: <strong style={{ color: '#fff' }}>{entry.value}</strong>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', height: '100%', paddingRight: '4px', position: 'relative' }}>
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-10px' }}>
        <button
          onClick={() => setShowExport(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'var(--accent-purple)', color: 'white',
            border: 'none', padding: '8px 16px', borderRadius: '8px',
            fontWeight: 600, fontSize: '13px', cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(168, 85, 247, 0.3)',
            transition: 'opacity 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
          onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
        >
          <Mail size={16} /> Export Data
        </button>
      </div>

      {/* Savings Summary Banner */}
      <div className="glass-panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', padding: '16px', gap: '16px', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute',
          top: '-20px',
          right: '-20px',
          width: '80px',
          height: '80px',
          background: 'rgba(6, 182, 212, 0.1)',
          filter: 'blur(30px)',
          borderRadius: '50%'
        }}></div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Distance Reduced</span>
          <strong style={{ fontFamily: 'Outfit', fontSize: '24px', color: 'var(--accent-cyan)' }}>-{savings.distance_km} km</strong>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Per collection cycle</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '1px solid var(--border-glass)', paddingLeft: '16px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fuel Preserved</span>
          <strong style={{ fontFamily: 'Outfit', fontSize: '24px', color: 'var(--color-success)' }}>-{savings.fuel_liters} Liters</strong>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>~{Math.round(savings.fuel_liters / (comparison.Fixed.fuel_liters || 1) * 100)}% savings rate</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '1px solid var(--border-glass)', paddingLeft: '16px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CO₂ Emissions Offset</span>
          <strong style={{ fontFamily: 'Outfit', fontSize: '24px', color: 'var(--accent-purple)' }}>-{savings.co2_kg} kg</strong>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Greenhouse footprint reduction</span>
        </div>
      </div>

      {/* Row 1: Efficiency & Overflow Comparisons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Resource Comparison Chart */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ fontFamily: 'Outfit', fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} color="var(--accent-cyan)" /> Route Resource Efficiency
          </h4>
          <div style={{ width: '100%', height: '220px' }} className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={routingCompareData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="#64748b" style={{ fontSize: '11px' }} />
                <YAxis stroke="#64748b" style={{ fontSize: '11px' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend style={{ fontSize: '11px' }} />
                <Bar dataKey="Fixed" fill="var(--text-muted)" name="Fixed Schedule" radius={[4, 4, 0, 0]} />
                <Bar dataKey="AI" fill="url(#cyanGrad)" name="AI Optimized" radius={[4, 4, 0, 0]} />
                <defs>
                  <linearGradient id="cyanGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-cyan)" stopOpacity={0.9}/>
                    <stop offset="95%" stopColor="var(--accent-cyan)" stopOpacity={0.3}/>
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Overflow Bins Chart */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ fontFamily: 'Outfit', fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={16} color="var(--color-danger)" /> Overflows Prevented
          </h4>
          <div style={{ width: '100%', height: '220px' }} className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overflowCompareData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="#64748b" style={{ fontSize: '11px' }} />
                <YAxis stroke="#64748b" style={{ fontSize: '11px' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend style={{ fontSize: '11px' }} />
                <Bar dataKey="Fixed" fill="url(#dangerGrad)" name="Fixed (Rigid Rotation)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="AI" fill="var(--color-success)" name="AI (Proactive Targeting)" radius={[6, 6, 0, 0]} />
                <defs>
                  <linearGradient id="dangerGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-danger)" stopOpacity={0.9}/>
                    <stop offset="95%" stopColor="var(--color-danger)" stopOpacity={0.4}/>
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Waste Generated by Area Type (Volume breakdown) */}
      <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h4 style={{ fontFamily: 'Outfit', fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingUp size={16} color="var(--accent-purple)" /> Total Waste Generated by Area Type
        </h4>
        <div style={{ width: '100%', height: '220px' }} className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={area_breakdown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorWaste" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-purple)" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="var(--accent-purple)" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis dataKey="area_type" stroke="#64748b" style={{ fontSize: '9px' }} angle={-15} textAnchor="end" height={45} />
              <YAxis stroke="#64748b" style={{ fontSize: '11px' }} label={{ value: 'Tons', angle: -90, position: 'insideLeft', fill: '#64748b', style: { fontSize: '10px' } }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="waste_tons" stroke="var(--accent-purple)" fillOpacity={1} fill="url(#colorWaste)" name="Waste Volume (Tons)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3: ML Model Accuracy Evaluations (Only if trained) */}
      {mlCompareData.length > 0 && (
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ fontFamily: 'Outfit', fontSize: '15px', fontWeight: 'bold' }}>
            🔮 Forecast Model Training Benchmarks
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
            <div style={{ height: '220px' }} className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mlCompareData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#64748b" style={{ fontSize: '11px' }} />
                  <YAxis stroke="#64748b" style={{ fontSize: '11px' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend style={{ fontSize: '11px' }} />
                  <Line type="monotone" dataKey="MAE" stroke="var(--accent-orange)" name="MAE (lower is better)" strokeWidth={2} activeDot={{ r: 8 }} />
                  <Line type="monotone" dataKey="RMSE" stroke="var(--accent-pink)" name="RMSE (lower is better)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Best Model:</span>
              <strong style={{ fontFamily: 'Outfit', fontSize: '20px', color: 'var(--color-success)' }}>XGBoost Regressor</strong>
              <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Testing R² Score:</span>
                  <span style={{ fontWeight: 'bold' }}>
                    {mlCompareData.find(d => d.name === 'XGBoost')?.R2}%
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Target Window:</span>
                  <span style={{ fontWeight: 'bold' }}>24 Hours Ahead</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExport && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 3000,
          backdropFilter: 'blur(5px)'
        }}>
          <div style={{
            background: 'var(--bg-primary)', border: '1px solid var(--border-glass)',
            padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '400px',
            boxShadow: 'var(--shadow-xl)', display: 'flex', flexDirection: 'column', gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mail size={20} color="var(--accent-cyan)" /> Export Analytics Data
              </h3>
              <button onClick={() => setShowExport(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
              Select the data categories you want to export. The report will be sent to the email provided below.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={exportOptions.routing} onChange={e => setExportOptions({...exportOptions, routing: e.target.checked})} style={{ cursor: 'pointer' }} /> Routing Efficiency Metrics
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={exportOptions.overflow} onChange={e => setExportOptions({...exportOptions, overflow: e.target.checked})} style={{ cursor: 'pointer' }} /> Overflow Prevention Data
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={exportOptions.waste} onChange={e => setExportOptions({...exportOptions, waste: e.target.checked})} style={{ cursor: 'pointer' }} /> Waste Generation by Area
              </label>
              {ml_evaluation && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={exportOptions.ml} onChange={e => setExportOptions({...exportOptions, ml: e.target.checked})} style={{ cursor: 'pointer' }} /> Predictive Model Benchmarks
                </label>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>Recipient Email</label>
              <input 
                type="email" 
                value={exportEmail} 
                onChange={e => setExportEmail(e.target.value)} 
                placeholder="admin@example.com"
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '12px',
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)',
                  borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none'
                }}
              />
            </div>

            <button
              onClick={handleExport}
              disabled={exporting || (!exportOptions.routing && !exportOptions.overflow && !exportOptions.waste && !exportOptions.ml)}
              style={{
                width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
                background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
                color: 'white', fontWeight: 700, fontSize: '15px', cursor: exporting ? 'not-allowed' : 'pointer',
                opacity: exporting ? 0.7 : 1, marginTop: '8px'
              }}
            >
              {exporting ? 'Sending Report...' : 'Send Export Report'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
