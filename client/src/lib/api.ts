import type { AnswerValue, Assignment } from '../types';

export interface ParticipantInfo {
  participant_id: string;
  current_step: string;
  completed: boolean;
  assignment: Assignment;
}

export interface EventOut {
  client_ts: number;
  screen: string;
  event_type: string;
  payload?: unknown;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} failed: ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  createParticipant(pilot: boolean): Promise<ParticipantInfo> {
    return postJson('/api/participants', { consented: true, pilot });
  },

  /** Returns null if the participant no longer exists (e.g. database was reset). */
  async getParticipant(id: string): Promise<ParticipantInfo | null> {
    const res = await fetch(`/api/participants/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`get participant failed: ${res.status}`);
    return (await res.json()) as ParticipantInfo;
  },

  setStep(id: string, step: string): Promise<unknown> {
    return postJson(`/api/participants/${encodeURIComponent(id)}/step`, { step });
  },

  postEvents(participantId: string, events: EventOut[]): Promise<unknown> {
    return postJson('/api/events', { participant_id: participantId, events });
  },

  postResponses(
    participantId: string,
    responses: { item_id: string; value: AnswerValue }[],
  ): Promise<unknown> {
    return postJson('/api/responses', { participant_id: participantId, responses });
  },

  withdrawData(id: string): Promise<unknown> {
    return postJson(`/api/participants/${encodeURIComponent(id)}/withdraw`, {});
  },
};
