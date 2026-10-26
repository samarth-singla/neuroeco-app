import { Router } from 'express';
import type { DB } from '../db';
import {
  createParticipant,
  getParticipant,
  insertEvents,
  publicParticipant,
  setStep,
  upsertResponses,
  type EventInput,
  type ResponseInput,
} from '../store';
import {
  ID_RE,
  isObject,
  MAX_BATCH,
  MAX_PAYLOAD_CHARS,
  MAX_VALUE_CHARS,
  NAME_RE,
  SCREEN_RE,
  STEP_RE,
} from '../validate';

export function apiRouter(db: DB): Router {
  const r = Router();

  // Created only after consent; no record exists for people who do not agree.
  r.post('/participants', (req, res) => {
    const body = isObject(req.body) ? req.body : {};
    if (body.consented !== true) {
      res.status(400).json({ error: 'consent required' });
      return;
    }
    const p = createParticipant(db);
    res.status(201).json(publicParticipant(p));
  });

  r.get('/participants/:id', (req, res) => {
    const p = ID_RE.test(req.params.id) ? getParticipant(db, req.params.id) : undefined;
    if (!p) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(publicParticipant(p));
  });

  r.post('/participants/:id/step', (req, res) => {
    const id = req.params.id;
    const step = isObject(req.body) ? req.body.step : undefined;
    if (typeof step !== 'string' || !STEP_RE.test(step)) {
      res.status(400).json({ error: 'invalid step' });
      return;
    }
    if (!ID_RE.test(id) || !getParticipant(db, id)) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    setStep(db, id, step);
    res.json({ ok: true });
  });

  r.post('/events', (req, res) => {
    const body = isObject(req.body) ? req.body : {};
    const id = body.participant_id;
    const list = body.events;
    if (
      typeof id !== 'string' ||
      !ID_RE.test(id) ||
      !Array.isArray(list) ||
      list.length > MAX_BATCH
    ) {
      res.status(400).json({ error: 'invalid body' });
      return;
    }
    const events: EventInput[] = [];
    for (const e of list) {
      if (!isObject(e) || typeof e.event_type !== 'string' || !NAME_RE.test(e.event_type)) {
        res.status(400).json({ error: 'invalid event_type' });
        return;
      }
      if (typeof e.screen !== 'string' || !SCREEN_RE.test(e.screen)) {
        res.status(400).json({ error: 'invalid screen' });
        return;
      }
      if (e.payload !== undefined && JSON.stringify(e.payload).length > MAX_PAYLOAD_CHARS) {
        res.status(400).json({ error: 'payload too large' });
        return;
      }
      const clientTs =
        typeof e.client_ts === 'number' && Number.isFinite(e.client_ts) ? e.client_ts : null;
      events.push({
        client_ts: clientTs,
        screen: e.screen,
        event_type: e.event_type,
        payload: e.payload,
      });
    }
    if (!getParticipant(db, id)) {
      res.status(404).json({ error: 'participant not found' });
      return;
    }
    res.json({ saved: insertEvents(db, id, events) });
  });

  r.post('/responses', (req, res) => {
    const body = isObject(req.body) ? req.body : {};
    const id = body.participant_id;
    const list = body.responses;
    if (
      typeof id !== 'string' ||
      !ID_RE.test(id) ||
      !Array.isArray(list) ||
      list.length > MAX_BATCH
    ) {
      res.status(400).json({ error: 'invalid body' });
      return;
    }
    const responses: ResponseInput[] = [];
    for (const item of list) {
      if (!isObject(item) || typeof item.item_id !== 'string' || !NAME_RE.test(item.item_id)) {
        res.status(400).json({ error: 'invalid item_id' });
        return;
      }
      const v = item.value;
      const okType = v === null || ['string', 'number', 'boolean'].includes(typeof v);
      if (!okType || String(v).length > MAX_VALUE_CHARS) {
        res.status(400).json({ error: `invalid value for ${item.item_id}` });
        return;
      }
      responses.push({ item_id: item.item_id, value: v as ResponseInput['value'] });
    }
    if (!getParticipant(db, id)) {
      res.status(404).json({ error: 'participant not found' });
      return;
    }
    res.json({ saved: upsertResponses(db, id, responses) });
  });

  return r;
}
