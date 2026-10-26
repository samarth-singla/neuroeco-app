// Small hand-written validators for request bodies (keeps dependencies minimal).

export const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const NAME_RE = /^[a-z0-9_]{1,64}$/;
export const STEP_RE = /^[a-z0-9:_-]{1,40}$/i;
export const SCREEN_RE = /^[A-Za-z0-9:_-]{1,64}$/;

export const MAX_BATCH = 500;
export const MAX_PAYLOAD_CHARS = 4000;
export const MAX_VALUE_CHARS = 2000;

export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
