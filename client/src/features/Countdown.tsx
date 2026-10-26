import { useEffect, useRef, useState } from 'react';
import { URGENCY } from '../config/session';

function mmss(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * H1a countdown. It really ticks, but never blocks anything: at zero it shows
 * "New slots opening…" for a few seconds and starts again.
 */
export function Countdown({ onReset }: { onReset?: () => void }) {
  const [tick, setTick] = useState(0);
  const onResetRef = useRef(onReset);
  useEffect(() => {
    onResetRef.current = onReset;
  });

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const cycle = URGENCY.timerSeconds + URGENCY.resetPauseSeconds;
  const pos = tick % cycle;
  const resetting = pos >= URGENCY.timerSeconds;

  useEffect(() => {
    if (tick > 0 && pos === URGENCY.timerSeconds) onResetRef.current?.();
  }, [tick, pos]);

  return (
    <span className="font-mono font-semibold tabular-nums" data-testid="countdown">
      {resetting ? URGENCY.resetLabel : mmss(URGENCY.timerSeconds - pos)}
    </span>
  );
}
