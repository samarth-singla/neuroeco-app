/**
 * Optional sound effects, synthesised with the Web Audio API (no audio files).
 * Off by default; the mute toggle is remembered in localStorage.
 */
const KEY = 'zentrade:sound';
let ctx: AudioContext | null = null;

export function soundOn(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
}

export function setSound(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // ignore
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, gain = 0.08) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + dur + 0.02);
}

export function play(kind: 'coin' | 'cash' | 'tap' | 'loss') {
  if (!soundOn()) return;
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (kind === 'coin') {
      tone(988, 0, 0.08, 'square', 0.05);
      tone(1319, 0.08, 0.25, 'square', 0.05);
    } else if (kind === 'cash') {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.18, 'triangle'));
    } else if (kind === 'tap') {
      tone(660, 0, 0.05, 'sine', 0.04);
    } else {
      tone(220, 0, 0.25, 'sawtooth', 0.05);
      tone(165, 0.2, 0.35, 'sawtooth', 0.05);
    }
  } catch {
    // audio not available
  }
}

/** Short vibration on supporting phones (fraud skin's CTA). */
export function haptic(ms = 30) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // ignore
  }
}
