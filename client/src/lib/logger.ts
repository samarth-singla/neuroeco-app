import { api, type EventOut } from './api';

/**
 * Buffers behaviour events and sends them in batches: every few seconds, on every
 * screen change (`flush()`), and with `sendBeacon` when the page is hidden or closed.
 */

const FLUSH_MS = 3000;

let participantId: string | null = null;
let queue: EventOut[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let sending = false;

export function initLogger(id: string): void {
  participantId = id;
  if (timer === null && typeof window !== 'undefined') {
    timer = setInterval(() => void flush(), FLUSH_MS);
    window.addEventListener('pagehide', beaconFlush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') beaconFlush();
    });
  }
}

/** Time since page load in ms (performance.now-based). */
export function clientNow(): number {
  return Math.round(performance.now() * 10) / 10;
}

export function logEvent(screen: string, eventType: string, payload?: unknown): void {
  queue.push({ client_ts: clientNow(), screen, event_type: eventType, payload });
}

export async function flush(): Promise<void> {
  if (!participantId || sending || queue.length === 0) return;
  const batch = queue;
  queue = [];
  sending = true;
  try {
    await api.postEvents(participantId, batch);
  } catch {
    queue = batch.concat(queue); // keep for the next attempt
  } finally {
    sending = false;
  }
}

function beaconFlush(): void {
  if (!participantId || queue.length === 0) return;
  const body = JSON.stringify({ participant_id: participantId, events: queue });
  const ok =
    typeof navigator.sendBeacon === 'function' &&
    navigator.sendBeacon('/api/events', new Blob([body], { type: 'application/json' }));
  if (ok) queue = [];
  else void flush();
}

/** For tests */
export function _pendingEvents(): EventOut[] {
  return queue;
}

export function _resetLogger(): void {
  queue = [];
  participantId = null;
}
