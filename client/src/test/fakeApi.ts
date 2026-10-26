import { vi } from 'vitest';
import type { Assignment } from '../types';

export interface FakeApi {
  events: { screen: string; event_type: string; payload?: Record<string, unknown> }[];
  responses: Record<string, unknown>;
  steps: string[];
  withdrawn: boolean;
}

/** Replaces window.fetch with an in-memory version of the server API. */
export function installFakeApi(assignment: Assignment): FakeApi {
  const db: FakeApi = { events: [], responses: {}, steps: [], withdrawn: false };
  const id = '11111111-2222-4333-8444-555555555555';
  const json = (body: unknown, status = 200) =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (url === '/api/participants' && init?.method === 'POST') {
        return json(
          { participant_id: id, current_step: 'app:A1', completed: false, assignment },
          201,
        );
      }
      if (url === `/api/participants/${id}` && !init?.method) {
        return json({ participant_id: id, current_step: 'app:A1', completed: false, assignment });
      }
      if (url.endsWith('/step')) {
        db.steps.push(body.step);
        return json({ ok: true });
      }
      if (url.endsWith('/withdraw')) {
        db.withdrawn = true;
        return json({ ok: true });
      }
      if (url === '/api/events') {
        db.events.push(...body.events);
        return json({ saved: body.events.length });
      }
      if (url === '/api/responses') {
        for (const r of body.responses) db.responses[r.item_id] = r.value;
        return json({ saved: body.responses.length });
      }
      return json({ error: 'not found' }, 404);
    }),
  );
  return db;
}
