import { describe, expect, it } from 'vitest';
import { runSimulation } from '../scripts/simulate';

describe('end-to-end simulation (scripts/simulate.ts)', () => {
  it('runs 40 participants through the API and produces a complete wide.csv', async () => {
    const r = await runSimulation(40);
    expect(r.errors).toEqual([]);
    expect(r.completed).toBe(36);
    expect(r.wideRows).toBe(r.completed - r.withdrawn);
    expect(r.withdrawn).toBeGreaterThan(0);
  }, 60000);
});
