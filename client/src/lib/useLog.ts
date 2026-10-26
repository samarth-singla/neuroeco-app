import { useCallback, useEffect, useRef } from 'react';
import { clientNow, logEvent } from './logger';

/**
 * Logs `screen_view` once when a screen mounts and returns `log(eventType, payload)`
 * for that screen. (The ref stops React StrictMode's double effect from logging twice.)
 */
export function useLog(screen: string) {
  const viewed = useRef(false);
  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    logEvent(screen, 'screen_view');
  }, [screen]);

  return useCallback(
    (eventType: string, payload?: Record<string, unknown>) => logEvent(screen, eventType, payload),
    [screen],
  );
}

/**
 * Decision timer: time from a screen's first render to the first decisive click
 * (`invest_click` or `exit_click`). Call `decide()` in the click handler and put the result
 * in the event payload. Later calls report `first_decision: false`.
 */
export function useDecisionTimer() {
  const start = useRef<number | null>(null);
  if (start.current === null) start.current = clientNow();
  const decided = useRef(false);

  return useCallback(() => {
    const decision_ms = Math.round(clientNow() - (start.current ?? 0));
    const first_decision = !decided.current;
    decided.current = true;
    return { decision_ms, first_decision };
  }, []);
}
