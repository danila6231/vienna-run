import type { ItemType, QuestionLevel } from './core/types';

export interface Tier {
  min: number;
  name: string;
}

export interface GameConfig {
  laneWidth: number;
  /** Metres from the start line to the finish line under the Riesenrad. */
  runLength: number;
  /** Forward speed at the start, in m/s. */
  baseSpeed: number;
  /** Extra share of baseSpeed reached at the finish line. */
  speedRamp: number;
  items: Record<ItemType, { points: number; good: boolean }>;
  /**
   * Item layout: exact counts in 'fixed' mode, targets that vary ±35% per round in 'random' mode.
   * `seed` picks the street in 'fixed' mode (see layoutSeed in core/spawner.ts).
   */
  spawn: { firstAt: number; finishClear: number; obstacles: number; treats: number; mode: 'random' | 'fixed'; seed: number };
  collision: { ahead: number; behind: number; laneTolerance: number };
  trayMax: number;
  stumbleSeconds: number;
  questions: {
    /** Two rows of ❓ across all three lanes: halfway (a Level 1 question) and right before the finish line (Level 2). */
    enabled: boolean;
    /** Points for a right answer, by level; a wrong answer or no answer gives 0. */
    points: Record<QuestionLevel, number>;
    /** Seconds before the finish line that the last row stands, at finishing speed. */
    lastRowLead: number;
    timeLimit: number;
    recentRuns: number;
    feedbackSeconds: number;
  };
  flow: {
    howtoSeconds: number;
    countdownSeconds: number;
    finishSeconds: number;
    resultsFallbackSeconds: number;
    holdSeconds: number;
  };
  tiers: Tier[];
  input: { swipeMinPx: number; tapFallbackMs: number };
  watchdog: {
    stallSeconds: number;
    maxReloads: number;
    reloadWindowMs: number;
    reloadEveryRuns: number;
    reloadEveryHours: number;
  };
}

export const CONFIG: GameConfig = {
  laneWidth: 2.6,
  runLength: 600,
  baseSpeed: 14,
  speedRamp: 0.25,
  items: {
    piano: { points: 15, good: true },
    violin: { points: 10, good: true },
    sheet: { points: 5, good: true },
    notes: { points: 5, good: true },
    krampus: { points: -20, good: false },
    bomb: { points: -25, good: false },
  },
  spawn: { firstAt: 34, finishClear: 36, obstacles: 11, treats: 31, mode: 'random', seed: 1 },
  collision: { ahead: 0.8, behind: 1.0, laneTolerance: 0.5 },
  // More than two rewards stacked above the baton hides the road ahead.
  trayMax: 2,
  stumbleSeconds: 0.5,
  questions: {
    enabled: true,
    points: { 1: 15, 2: 20 },
    lastRowLead: 0.5,
    timeLimit: 10,
    // With five questions per level, avoiding the last two players' questions still leaves three to pick from.
    recentRuns: 2,
    feedbackSeconds: 1.5,
  },
  flow: {
    howtoSeconds: 3,
    countdownSeconds: 3,
    finishSeconds: 2.5,
    resultsFallbackSeconds: 60,
    holdSeconds: 1,
  },
  // Placeholder gifts and thresholds. Calibrate with `npm run simulate` once the gift stock is known.
  tiers: [
    { min: 0, name: 'Small treat' },
    { min: 80, name: 'Gift B' },
    { min: 100, name: 'Gift C' },
    { min: 120, name: 'Gift D' },
  ],
  input: { swipeMinPx: 35, tapFallbackMs: 300 },
  watchdog: {
    stallSeconds: 5,
    maxReloads: 5,
    reloadWindowMs: 120_000,
    reloadEveryRuns: 25,
    reloadEveryHours: 2,
  },
};
