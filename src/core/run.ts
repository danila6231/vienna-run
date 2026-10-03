import { CONFIG, type GameConfig } from '../config';
import { scheduleSlots } from './questions';
import { createRng } from './rng';
import { applyPoints, questionPoints } from './scoring';
import { generateItems } from './spawner';
import { isGood, type GoodType, type Item, type Lane, type RunEvent } from './types';

export interface RunOptions {
  seed: number;
  config?: GameConfig;
  /** Test hook: use these items instead of generating them. */
  items?: Item[];
  /** Test hook: use these question slots (run-time seconds) instead of random ones. */
  slots?: number[];
}

/** One player's run: pure state, advanced in fixed steps by the app loop. */
export class Run {
  readonly cfg: GameConfig;
  readonly items: Item[];
  readonly slots: number[];
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
  /** The treat whose bonus question is on screen; the run is frozen while set. */
  pending: Item | null = null;
  private armed = 0;
  private nextSlot = 0;

  constructor(opts: RunOptions) {
    this.cfg = opts.config ?? CONFIG;
    const rng = createRng(opts.seed);
    this.items = (opts.items ?? generateItems(rng, this.cfg)).slice().sort((a, b) => a.at - b.at);
    this.slots = opts.slots ?? scheduleSlots(rng, this.cfg.questions);
    this.speed = this.cfg.baseSpeed;
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
    while (this.nextSlot < this.slots.length && this.time >= this.slots[this.nextSlot]) {
      this.armed++;
      this.nextSlot++;
    }
    this.speed = c.baseSpeed * (1 + c.speedRamp * this.progress);
    this.dist += this.speed * dt;
    if (this.stumble > 0) this.stumble = Math.max(0, this.stumble - dt);

    for (const it of this.items) {
      if (it.state !== 'live') continue;
      const r = it.at - this.dist;
      if (r > c.collision.ahead) break; // items are sorted by distance
      if (r < -c.collision.behind) continue;
      if (Math.abs(this.x - it.lane) >= c.collision.laneTolerance) continue;
      const base = c.items[it.type].points;
      it.t = 0;
      if (isGood(it.type)) {
        it.state = 'taken';
        this.tray.push(it.type);
        if (this.tray.length > c.trayMax) this.tray.shift();
        if (this.armed > 0) {
          this.armed--;
          it.question = true;
          this.pending = it;
          ev.push({ kind: 'question', item: it });
          break;
        }
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

  /** Resolves the open bonus question and unfreezes the run. */
  answer(correct: boolean): RunEvent[] {
    const it = this.pending;
    if (!it) return [];
    this.pending = null;
    const points = questionPoints(this.cfg.items[it.type].points, correct);
    this.score = applyPoints(this.score, points);
    return [{ kind: 'answer', item: it, correct, points }];
  }
}
