import { useEffect, useMemo, useState } from 'react';
import type { Skin } from '../../config/game';

/** Small deterministic random walk so a round's chart looks the same after a refresh. */
function walk(seed: number, n: number, end: number): number[] {
  let x = seed * 9301 + 49297;
  const rnd = () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
  const pts = [0];
  for (let i = 1; i < n; i++) pts.push(pts[i - 1] + (rnd() - 0.5) * 0.06);
  // Bend the walk so it finishes exactly on the scripted result
  const drift = (end - pts[n - 1]) / (n - 1);
  return pts.map((p, i) => p + drift * i);
}

/**
 * Animated price chart. It only visualises the scripted result (`rate`): the line draws itself over
 * `ms` and ends on +rate%. `idle` shows a gently moving market without a result.
 */
export function LiveChart({
  skin,
  rate,
  seed,
  ms,
  running,
  height = 140,
}: {
  skin: Skin;
  rate: number;
  seed: number;
  ms: number;
  running: boolean;
  height?: number;
}) {
  const pts = useMemo(() => walk(seed, 40, rate), [seed, rate]);
  const [drawn, setDrawn] = useState(running ? 0 : 1);
  useEffect(() => {
    if (!running) {
      setDrawn(1);
      return;
    }
    setDrawn(0);
    const id = requestAnimationFrame(() => setDrawn(1));
    return () => cancelAnimationFrame(id);
  }, [running, seed]);

  const w = 320;
  const min = Math.min(...pts, -0.05);
  const max = Math.max(...pts, 0.05);
  const y = (v: number) => height - 8 - ((v - min) / (max - min)) * (height - 16);
  const d = pts
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i / (pts.length - 1)) * w} ${y(v)}`)
    .join(' ');
  const up = rate >= 0;
  const fraud = skin === 'fraud';
  const stroke = fraud ? (up ? '#22ff88' : '#f87171') : up ? '#15803d' : '#b91c1c';
  const length = 900;

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label="Market chart"
    >
      <line
        x1="0"
        x2={w}
        y1={y(0)}
        y2={y(0)}
        stroke={fraud ? 'rgba(255,255,255,0.12)' : '#e2e8f0'}
        strokeDasharray="4 4"
      />
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={fraud ? 3 : 2}
        strokeLinejoin="round"
        strokeDasharray={length}
        strokeDashoffset={drawn ? 0 : length}
        style={{
          transition: `stroke-dashoffset ${running ? ms : 0}ms linear`,
          filter: fraud ? `drop-shadow(0 0 6px ${stroke})` : undefined,
        }}
      />
    </svg>
  );
}
