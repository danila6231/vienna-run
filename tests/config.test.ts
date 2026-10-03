import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';

describe('CONFIG', () => {
  it('has a tier for every score, starting at 0 and ascending', () => {
    expect(CONFIG.tiers[0].min).toBe(0);
    for (let i = 1; i < CONFIG.tiers.length; i++) expect(CONFIG.tiers[i].min).toBeGreaterThan(CONFIG.tiers[i - 1].min);
  });
  it('fits all question slots into the window with the minimum gap', () => {
    const q = CONFIG.questions;
    expect(q.windowEnd - q.windowStart).toBeGreaterThanOrEqual((q.perRun - 1) * q.minGap);
  });
  it('makes treats worth points and obstacles cost points', () => {
    for (const v of Object.values(CONFIG.items)) expect(v.good ? v.points > 0 : v.points < 0).toBe(true);
  });
});
