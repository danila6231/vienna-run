import { CONFIG, type GameConfig, type Tier } from '../config';
import { Bot, type BotSkill } from './bot';
import { createRng } from './rng';
import { Run } from './run';
import { tierIndex } from './scoring';

export interface RunResult {
  score: number;
  hits: number;
  collected: number;
  questions: number;
}

/** Plays one whole run headlessly at 60 steps per second. */
export function simulateRun(seed: number, skill: BotSkill, cfg: GameConfig = CONFIG): RunResult {
  const run = new Run({ seed, config: cfg });
  const bot = new Bot(createRng(seed ^ 0x9e3779b9), skill);
  const dt = 1 / 60;
  let hits = 0, collected = 0, questions = 0;
  for (let i = 0; i < 60 * 120 && !run.finished; i++) {
    bot.step(run, dt);
    for (const e of run.update(dt)) {
      if (e.kind === 'hit') hits++;
      else if (e.kind === 'collect') collected++;
      else if (e.kind === 'question') {
        questions++;
        collected++;
        run.answer(bot.answer());
      }
    }
  }
  return { score: run.score, hits, collected, questions };
}

export interface Summary {
  runs: number;
  mean: number;
  p10: number;
  p50: number;
  p90: number;
  /** Share of players whose final score lands in each tier (same order as the tiers). */
  tierShare: number[];
}

export function summarize(results: readonly RunResult[], tiers: readonly Tier[]): Summary {
  const scores = results.map((r) => r.score).sort((a, b) => a - b);
  const at = (p: number) => scores[Math.min(scores.length - 1, Math.floor(p * scores.length))];
  const counts = tiers.map(() => 0);
  for (const s of scores) counts[tierIndex(s, tiers)]++;
  return {
    runs: scores.length,
    mean: scores.reduce((a, b) => a + b, 0) / scores.length,
    p10: at(0.1),
    p50: at(0.5),
    p90: at(0.9),
    tierShare: counts.map((n) => n / scores.length),
  };
}
