import { CONFIG, type GameConfig } from '../config';
import { inHitWindow } from './dodge';
import { createRng } from './rng';
import { buildRoute, type Route } from './route';
import { applyPoints, questionPoints } from './scoring';
import { generateItems } from './spawner';
import { isGood, type GoodType, type Item, type Lane, type RunEvent } from './types';

export interface RunOptions {
  seed: number;
  config?: GameConfig;
  /** Test hook: use these items instead of generating them. */
  items?: Item[];
}

/** One player's run: pure state, advanced in fixed steps by the app loop. */
export class Run {
  readonly cfg: GameConfig;
  readonly items: Item[];
  readonly route: Route;
  dist = 0;
  time = 0;
  speed: number;
  lane: Lane = 0;
  /** Smoothed lane position, -1..1 (renderers multiply by the lane width). */
  x = 0;
  score = 0;
  stumble = 0;
  tray: GoodType[] = [];
  finished = false;
  /** The ❓ whose question is on screen; the run is frozen while set. */
  pending: Item | null = null;

  constructor(opts: RunOptions) {
    this.cfg = opts.config ?? CONFIG;
    this.items = (opts.items ?? generateItems(createRng(opts.seed), this.cfg)).slice().sort((a, b) => a.at - b.at);
    this.speed = this.cfg.baseSpeed;
    this.route = buildRoute(this.cfg.runLength);
  }

  get progress(): number {
    return Math.min(1, this.dist / this.cfg.runLength);
  }

  get paused(): boolean {
    return this.pending !== null;
  }

  move(dir: -1 | 1): void {
    if (this.finished || this.paused) return;
    this.lane = Math.max(-1, Math.min(1, this.lane + dir)) as Lane;
  }

  update(dt: number): RunEvent[] {
    const ev: RunEvent[] = [];
    if (this.paused) return ev;
    for (const it of this.items) if (it.state !== 'live') it.t += dt;
    this.x += (this.lane - this.x) * (1 - Math.exp(-dt * 16));
    if (this.finished) {
      this.speed *= Math.exp(-dt * 2.5);
      this.dist += this.speed * dt;
      return ev;
    }
    const c = this.cfg;
    this.time += dt;
    this.speed = c.baseSpeed * (1 + c.speedRamp * this.progress);
    const step = this.speed * dt;
    this.dist += step;
    if (this.stumble > 0) this.stumble = Math.max(0, this.stumble - dt);

    for (const it of this.items) {
      if (it.state !== 'live') continue;
      const r = it.at - this.dist;
      if (r > c.collision.ahead) break; // items are sorted by distance
      if (!inHitWindow(r, step, c.collision)) continue;
      if (Math.abs(this.x - it.lane) >= c.collision.laneTolerance) continue;
      it.t = 0;
      if (it.type === 'question') {
        // The whole row goes: one question per row, whichever lane the player was in.
        for (const q of this.items) if (q.type === 'question' && q.level === it.level && q.state === 'live') q.state = 'taken';
        this.pending = it;
        ev.push({ kind: 'question', item: it });
        break;
      }
      const base = c.items[it.type].points;
      if (isGood(it.type)) {
        it.state = 'taken';
        this.tray.push(it.type);
        if (this.tray.length > c.trayMax) this.tray.shift();
        this.score = applyPoints(this.score, base);
        ev.push({ kind: 'collect', item: it, points: base });
      } else {
        it.state = 'hit';
        this.score = applyPoints(this.score, base);
        this.stumble = c.stumbleSeconds;
        this.tray.pop();
        ev.push({ kind: 'hit', item: it, points: base });
      }
    }

    if (!this.paused && this.dist >= c.runLength) {
      this.finished = true;
      ev.push({ kind: 'finish', score: this.score });
    }
    return ev;
  }

  /** Resolves the open question and unfreezes the run. */
  answer(correct: boolean): RunEvent[] {
    const it = this.pending;
    if (!it) return [];
    this.pending = null;
    const points = questionPoints(this.cfg.questions.points[it.level ?? 1], correct);
    this.score = applyPoints(this.score, points);
    return [{ kind: 'answer', item: it, correct, points }];
  }
}
