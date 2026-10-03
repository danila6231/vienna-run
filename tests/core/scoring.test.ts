import { describe, expect, it } from 'vitest';
import { applyPoints, questionPoints, tierIndex } from '../../src/core/scoring';

const tiers = [
  { min: 0, name: 'Small treat' },
  { min: 80, name: 'Gift B' },
  { min: 100, name: 'Gift C' },
  { min: 120, name: 'Gift D' },
];

describe('scoring', () => {
  it('never lets the score drop below zero', () => {
    expect(applyPoints(10, -15)).toBe(0);
    expect(applyPoints(30, -15)).toBe(15);
    expect(applyPoints(0, 5)).toBe(5);
  });
  it('doubles a question item when right and gives nothing when wrong', () => {
    expect(questionPoints(10, true)).toBe(20);
    expect(questionPoints(15, false)).toBe(0);
  });
  it.each([
    [0, 0], [79, 0], [80, 1], [99, 1], [100, 2], [119, 2], [120, 3], [999, 3],
  ])('score %i lands in tier %i', (score, tier) => {
    expect(tierIndex(score, tiers)).toBe(tier);
  });
  it('handles tiers listed out of order', () => {
    expect(tierIndex(105, [tiers[2], tiers[0], tiers[3], tiers[1]])).toBe(0);
  });
});
