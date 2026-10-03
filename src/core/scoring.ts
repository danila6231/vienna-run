import type { Tier } from '../config';

/** Adds points but never lets the score go below zero. */
export function applyPoints(score: number, delta: number): number {
  return Math.max(0, score + delta);
}

/** A bonus-question treat is worth double when answered right and nothing otherwise. */
export function questionPoints(base: number, correct: boolean): number {
  return correct ? base * 2 : 0;
}

/** Index of the highest tier whose minimum the score reaches. */
export function tierIndex(score: number, tiers: readonly Tier[]): number {
  let best = -1;
  for (let i = 0; i < tiers.length; i++) {
    if (score >= tiers[i].min && (best < 0 || tiers[i].min > tiers[best].min)) best = i;
  }
  return Math.max(0, best);
}
