import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';

describe('CONFIG', () => {
  it('has a tier for every score, starting at 0 and ascending', () => {
    expect(CONFIG.tiers[0].min).toBe(0);
    for (let i = 1; i < CONFIG.tiers.length; i++) expect(CONFIG.tiers[i].min).toBeGreaterThan(CONFIG.tiers[i - 1].min);
  });
  it('asks questions by default: +15 for Level 1, +20 for Level 2', () => {
    expect(CONFIG.questions).toMatchObject({ enabled: true, points: { 1: 15, 2: 20 } });
  });
  it('makes treats worth points and obstacles cost points', () => {
    for (const v of Object.values(CONFIG.items)) expect(v.good ? v.points > 0 : v.points < 0).toBe(true);
  });
});
