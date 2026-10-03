import type { ItemType } from './core/types';

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
  spawn: { firstAt: number; finishClear: number };
  collision: { ahead: number; behind: number; laneTolerance: number };
  trayMax: number;
  stumbleSeconds: number;
  questions: {
    perRun: number;
    windowStart: number;
    windowEnd: number;
    minGap: number;
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
    sacher: { points: 15, good: true },
    kipferl: { points: 10, good: true },
    melange: { points: 5, good: true },
    mozart: { points: 5, good: true },
    krampus: { points: -10, good: false },
    bomb: { points: -15, good: false },
  },
  spawn: { firstAt: 34, finishClear: 36 },
  collision: { ahead: 0.8, behind: 1.0, laneTolerance: 0.5 },
  trayMax: 6,
  stumbleSeconds: 0.5,
  questions: {
    perRun: 3,
    windowStart: 4,
    // The spec says 35 s; 30 s leaves time to reach a treat before the finish clearing.
    windowEnd: 30,
    minGap: 7,
    timeLimit: 10,
    recentRuns: 5,
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
