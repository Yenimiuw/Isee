import { fmtClock } from '../format';

export function Donut({ pct }) {
  const c = 251.3;
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" role="img" aria-label={`${pct} percent of the meeting on the meeting tab`}>
      <circle cx="50" cy="50" r="40" fill="none" stroke="#1b2b18" strokeWidth="12" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="#88f549" strokeWidth="12"
        strokeDasharray={`${(c * pct) / 100} ${c}`} transform="rotate(-90 50 50)" />
      <text x="50" y="56" textAnchor="middle" fill="#b9d6b4" fontSize="20" fontWeight="700">{pct}%</text>
    </svg>
  );
}

// 1 = on the meeting tab, 0 = on another tab.
export function StepTimeline({ timeline, duration }) {
  const W = 600;
  const x = (t) => (duration ? (t / duration) * W : 0);
  const y = (s) => (s === 'in' ? 24 : 74);
  let d = '';
  timeline.forEach((s, i) => { d += (i === 0 ? `M${x(s.start)} ${y(s.state)}` : `V${y(s.state)}`) + `H${x(s.end)}`; });
  return (
    <div>
      <svg viewBox="0 0 600 96" width="100%" role="img" aria-label="Timeline of time on the meeting tab versus other tabs">
        {timeline.filter((s) => s.state === 'away').map((s, i) => (
          <rect key={i} x={x(s.start)} y="12" width={Math.max(1, x(s.end) - x(s.start))} height="70" fill="#58a14c" opacity=".35" />
        ))}
        <path d={d} fill="none" stroke="#88f549" strokeWidth="3" />
        <text x="4" y="10" fill="#b9d6b4" fontSize="11">In meeting</text>
        <text x="4" y="94" fill="#b9d6b4" fontSize="11">Other tab</text>
      </svg>
      <div className="row between muted"><span>0:00</span><span>{fmtClock(duration)}</span></div>
    </div>
  );
}

// values: numbers 0..100 (null = no data). xLabels: optional strings shown under the chart.
export function LineChart({ values, xLabels, label }) {
  const n = values.length;
  const X = (i) => (n > 1 ? 36 + (i * 554) / (n - 1) : 313);
  const Y = (v) => 10 + (100 - v) * 1.3;
  const runs = [];
  values.forEach((v, i) => {
    if (v == null) return;
    if (i > 0 && values[i - 1] != null) runs[runs.length - 1].push([X(i), Y(v)]);
    else runs.push([[X(i), Y(v)]]);
  });
  return (
    <div>
      <svg viewBox="0 0 600 150" width="100%" role="img" aria-label={label}>
        {[0, 50, 100].map((g) => (
          <g key={g}>
            <line x1="32" x2="600" y1={Y(g)} y2={Y(g)} stroke="#58a14c" opacity=".4" />
            <text x="0" y={Y(g) + 4} fill="#b9d6b4" fontSize="11">{g}</text>
          </g>
        ))}
        {runs.map((r, i) => (
          <polyline key={i} points={r.map((p) => p.join(',')).join(' ')} fill="none" stroke="#88f549" strokeWidth="3" />
        ))}
        {n <= 24 && values.map((v, i) => v != null && <circle key={i} cx={X(i)} cy={Y(v)} r="5" fill="#88f549" />)}
      </svg>
      {xLabels && <div className="row between muted">{xLabels.map((l, i) => <span key={i}>{l}</span>)}</div>}
    </div>
  );
}
