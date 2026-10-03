import { randRange, type Rng } from './rng';
import type { Run } from './run';
import type { Lane } from './types';

export interface BotSkill {
  name: string;
  /** How far ahead (metres) the bot looks. */
  lookahead: number;
  /** Seconds between lane changes (min, max). */
  reaction: [number, number];
  /** Chance of hesitating when it wants to switch lanes. */
  mistakeRate: number;
  /** Chance of answering a bonus question right. */
  answerAccuracy: number;
}

export const BOT_SKILLS: Record<'casual' | 'average' | 'skilled', BotSkill> = {
  // Tuned so profiles separate in `npm run simulate`; casual is the closest to a first-time booth visitor.
  casual: { name: 'casual', lookahead: 10, reaction: [0.5, 0.9], mistakeRate: 0.45, answerAccuracy: 0.55 },
  average: { name: 'average', lookahead: 16, reaction: [0.3, 0.55], mistakeRate: 0.2, answerAccuracy: 0.7 },
  skilled: { name: 'skilled', lookahead: 22, reaction: [0.14, 0.24], mistakeRate: 0.04, answerAccuracy: 0.85 },
};

/** Plays a run like a person would: drifts toward treats, away from obstacles. */
export class Bot {
  private cool = 0;

  constructor(private readonly rng: Rng, readonly skill: BotSkill) {}

  step(run: Run, dt: number): void {
    this.cool -= dt;
    if (this.cool > 0 || run.paused || run.finished) return;
    const scores = [0, 0, 0];
    // Lanes with an obstacle level with the runner (or a few metres ahead) are unsafe to step into right now.
    const blocked = [false, false, false];
    const { ahead, behind } = run.cfg.collision;
    for (const it of run.items) {
      if (it.state !== 'live') continue;
      const r = it.at - run.dist;
      if (r < -behind) continue;
      if (r > this.skill.lookahead) break;
      const p = run.cfg.items[it.type].points;
      if (p < 0) {
        if (r < ahead + 4) blocked[it.lane + 1] = true;
        scores[it.lane + 1] += -12 * (1 - Math.max(r, 0) / 36);
      } else if (r >= 1) {
        scores[it.lane + 1] += (p / 5) * (1 - r / 40);
      }
    }
    scores[run.lane + 1] += 0.4;
    let best: Lane = run.lane;
    let bestScore = -Infinity;
    for (const l of [-1, 0, 1] as Lane[]) {
      const v = scores[l + 1] - Math.abs(l - run.lane) * 0.3;
      if (v > bestScore) {
        bestScore = v;
        best = l;
      }
    }
    const next = run.lane + Math.sign(best - run.lane);
    if (best !== run.lane && !blocked[next + 1] && this.rng() > this.skill.mistakeRate) {
      run.move(best > run.lane ? 1 : -1);
      this.cool = randRange(this.rng, this.skill.reaction[0], this.skill.reaction[1]);
    } else {
      this.cool = 0.08;
    }
  }

  answer(): boolean {
    return this.rng() < this.skill.answerAccuracy;
  }
}
