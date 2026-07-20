import React, { useState } from 'react';
import { Play, Square, RotateCcw, Zap, Info } from 'lucide-react';

interface SimulationControlsProps {
  isRunning: boolean;
  currentSpeed: number;
  onStart: (speed: number) => void;
  onStop: () => void;
  onReset: () => void;
  bins?: { bin_id: string; current_fill_percentage: number; area_type: string }[];
}

const SPEED_OPTIONS = [
  { value: 1, label: '1×', desc: '1 hr/min' },
  { value: 5, label: '5×', desc: '1 hr/12s' },
  { value: 10, label: '10×', desc: '1 hr/6s' },
  { value: 30, label: '30×', desc: '1 hr/2s' },
  { value: 60, label: '60×', desc: 'Max speed' },
];

const SimulationControls: React.FC<SimulationControlsProps> = ({
  isRunning, currentSpeed, onStart, onStop, onReset, bins = []
}) => {
  const [selectedSpeed, setSelectedSpeed] = useState(5);

  const criticalBins = bins.filter(b => b.current_fill_percentage >= 80);
  const warningBins = bins.filter(b => b.current_fill_percentage >= 50 && b.current_fill_percentage < 80);
  const avgFill = bins.length > 0 ? bins.reduce((s, b) => s + (b.current_fill_percentage ?? 0), 0) / bins.length : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '900px' }}>
      
      {/* IoT Architecture Info */}
      <div style={{
        background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.2)',
        borderRadius: '14px', padding: '16px 20px', display: 'flex', gap: '12px', alignItems: 'flex-start'
      }}>
        <Info size={18} color="var(--accent-cyan)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <div style={{ fontFamily: 'Outfit', fontWeight: 700, color: 'var(--accent-cyan)', fontSize: '14px', marginBottom: '4px' }}>
            Hardware-Identical Simulation
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            This simulator calls the <code style={{ fontFamily: 'JetBrains Mono', background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: '4px', color: '#06b6d4' }}>POST /api/bin/update</code> endpoint —
            the exact same endpoint your ESP32 devices will use. When real hardware is ready,
            simply connect your devices and turn off the simulator. <strong style={{ color: '#f0f4f8' }}>Zero backend changes required.</strong>
          </p>
        </div>
      </div>

      {/* Main Control Card */}
      <div className="sim-control-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontFamily: 'Outfit', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Simulation Engine
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {isRunning
                ? `Running at ${currentSpeed}× speed · simulating ${(currentSpeed).toFixed(0)} hours per minute`
                : 'Stopped · Click Start to begin IoT simulation'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className={`sim-dot ${isRunning ? '' : 'stopped'}`} />
            <span style={{ fontSize: '12px', color: isRunning ? 'var(--color-success)' : 'var(--text-muted)', fontWeight: 600 }}>
              {isRunning ? 'LIVE' : 'STOPPED'}
            </span>
          </div>
        </div>

        {/* Speed Selector */}
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: '8px' }}>
            Simulation Speed
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {SPEED_OPTIONS.map(s => (
              <button key={s.value}
                onClick={() => setSelectedSpeed(s.value)}
                className={`speed-btn ${selectedSpeed === s.value ? 'active' : ''}`}
                disabled={isRunning}
                title={s.desc}
              >
                <Zap size={11} style={{ display: 'inline', marginRight: '3px' }} />
                {s.label}
                <span style={{ display: 'block', fontSize: '9px', opacity: 0.7 }}>{s.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Control Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          {!isRunning ? (
            <button onClick={() => onStart(selectedSpeed)} className="btn btn-primary">
              <Play size={15} fill="currentColor" /> Start Simulation
            </button>
          ) : (
            <button onClick={onStop} className="btn btn-danger">
              <Square size={15} fill="currentColor" /> Stop Simulation
            </button>
          )}
          <button onClick={onReset} className="btn btn-secondary" disabled={isRunning}>
            <RotateCcw size={14} /> Reset All Bins
          </button>
        </div>
      </div>

      {/* Live Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Avg. Fill Level</div>
          <div style={{ fontFamily: 'Outfit', fontSize: '32px', fontWeight: 800, color: 'var(--accent-cyan)', marginTop: '4px' }}>
            {avgFill.toFixed(1)}%
          </div>
          <div style={{ marginTop: '8px' }}>
            <div className="fill-bar-container" style={{ height: '8px' }}>
              <div className={`fill-bar ${avgFill >= 80 ? 'red' : avgFill >= 50 ? 'yellow' : 'green'}`} style={{ width: `${avgFill}%` }} />
            </div>
          </div>
        </div>
        <div style={{ background: 'var(--color-danger-dim)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '10px', color: 'var(--color-danger)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Critical Bins</div>
          <div style={{ fontFamily: 'Outfit', fontSize: '32px', fontWeight: 800, color: 'var(--color-danger)', marginTop: '4px' }}>
            {criticalBins.length}
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(239,68,68,0.7)', marginTop: '4px' }}>fill ≥ 80% · need collection</div>
        </div>
        <div style={{ background: 'var(--color-warning-dim)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '10px', color: 'var(--color-warning)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Warning Bins</div>
          <div style={{ fontFamily: 'Outfit', fontSize: '32px', fontWeight: 800, color: 'var(--color-warning)', marginTop: '4px' }}>
            {warningBins.length}
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(245,158,11,0.7)', marginTop: '4px' }}>fill 50–80% · monitor closely</div>
        </div>
      </div>

      {/* ESP32 API Reference */}
      <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', borderRadius: '14px', padding: '18px 20px' }}>
        <div style={{ fontFamily: 'Outfit', fontWeight: 700, marginBottom: '10px', fontSize: '14px', color: 'var(--text-primary)' }}>
          📡 ESP32 Hardware Integration — API Reference
        </div>
        <pre style={{
          background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '10px', padding: '14px', fontSize: '11px',
          fontFamily: 'JetBrains Mono, monospace', color: '#10b981',
          overflowX: 'auto', lineHeight: 1.7
        }}>{`// ESP32 Arduino Code (send every 5 minutes)
HTTPClient http;
http.begin("http://YOUR_SERVER:8000/api/bin/update");
http.addHeader("Content-Type", "application/json");

float distance = sonar.ping_cm();   // HC-SR04
float fill_pct = (1 - distance/MAX_DEPTH) * 100;

String body = "{\\"bin_id\\":\\"BIN034\\",";
body += "\\"fill_percentage\\":" + String(fill_pct) + ",";
body += "\\"battery\\":" + String(battery_level) + ",";
body += "\\"temperature\\":" + String(temp) + ",";
body += "\\"latitude\\":" + String(gps.location.lat()) + ",";
body += "\\"longitude\\":" + String(gps.location.lng()) + "}";

int httpCode = http.POST(body);
// Server responds with: {"status":"accepted","is_critical":false}`}</pre>
      </div>
    </div>
  );
};

export default SimulationControls;
