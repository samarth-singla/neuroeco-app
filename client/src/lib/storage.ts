// sessionStorage can throw (private mode, blocked storage), so every access is guarded.

const KEY = 'neuroeco:study:v1';

export function loadSaved<T>(): T | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function save(value: unknown): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // ignore: the study still works, it just cannot resume after a refresh
  }
}

export function clearSaved(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
