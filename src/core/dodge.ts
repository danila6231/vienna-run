import type { GameConfig } from '../config';
import { isGood, type Item, type Lane } from './types';

/**
 * The dodge check: replays a street step by step the way the game runs it and asks whether some series of swipes,
 * never two closer together than the fastest move, gets through without hitting an obstacle. Rewards and ❓ rows
 * are left out: they never stop the runner.
 */

/** The game's fixed simulation step (see FixedStepper in app/loop.ts). */
const DT = 1 / 60;
/**
 * Steps after a swipe during which the runner may still be hit in the lane it is leaving. It slides out on the third
 * step (Run.update eases it over at a rate of 16 per second); one more for safety. The check counts both lanes as hit
 * for these steps, so it only ever finds ways that work in the game.
 */
const SETTLE = 4;

/** One lane change: `run.move(dir)` just before simulation step `step` (the first step is 1). */
export interface Swipe {
  step: number;
  dir: -1 | 1;
}

/**
 * Whether an item `r` metres ahead (after a step of `step` metres) is level with the runner: inside the hit window,
 * or the whole window fell between this step and the last, which still counts (at 390 km/h and up).
 */
export function inHitWindow(r: number, step: number, c: GameConfig['collision']): boolean {
  return r <= c.ahead && (r >= -c.behind || r + step > c.ahead);
}

const isObstacle = (it: Item) => it.type !== 'question' && !isGood(it.type);
const bit = (lane: number) => 1 << (lane + 1);

/** Where the runner is after each step (index 0 is the start line), the same for every player: speed only depends on distance. */
function distances(cfg: GameConfig): Float64Array {
  const out = [0];
  let dist = 0;
  while (dist < cfg.runLength) {
    const speed = cfg.baseSpeed * (1 + cfg.speedRamp * Math.min(1, dist / cfg.runLength));
    dist += speed * DT;
    out.push(dist);
  }
  return Float64Array.from(out);
}

/**
 * Every state the runner can be in after a step: its lane, steps since its last swipe (capped), and for a fresh
 * swipe the way it went (so the lane it left is known). `moves[s]` are the states one step later, each with the lanes
 * the runner could be hit in there.
 */
class Model {
  /** Fewest steps between two swipes. */
  readonly gap: number;
  readonly size: number;
  readonly start: number;
  readonly moves: Array<Array<{ to: number; lanes: number }>> = [];
  readonly lane: Int8Array;
  readonly fresh: Uint8Array;

  constructor(fastestMove: number) {
    this.gap = Math.max(SETTLE + 1, Math.round(fastestMove / DT));
    this.size = 3 * (this.gap + 1) * 2;
    this.lane = new Int8Array(this.size);
    this.fresh = new Uint8Array(this.size);
    const id = (lane: number, since: number, dir: number) => ((lane + 1) * (this.gap + 1) + since) * 2 + (since <= SETTLE && dir > 0 ? 1 : 0);
    const lanesAt = (lane: number, since: number, dir: number) => bit(lane) | (since <= SETTLE ? bit(lane - dir) : 0);
    this.start = id(0, this.gap, 0);
    for (let s = 0; s < this.size; s++) this.moves.push([]);
    for (const lane of [-1, 0, 1]) {
      for (let since = 1; since <= this.gap; since++) {
        for (const dir of since <= SETTLE ? [-1, 1] : [1]) {
          const s = id(lane, since, dir);
          this.lane[s] = lane;
          this.fresh[s] = since === 1 ? 1 : 0;
          const stay = Math.min(this.gap, since + 1);
          this.moves[s].push({ to: id(lane, stay, dir), lanes: lanesAt(lane, stay, dir) });
          if (since < this.gap) continue;
          for (const d of [-1, 1]) {
            if (Math.abs(lane + d) <= 1) this.moves[s].push({ to: id(lane + d, 1, d), lanes: lanesAt(lane + d, 1, d) });
          }
        }
      }
    }
  }

  /** One step: every state reachable from `from` without being hit in the `blocked` lanes. Returns whether any is. */
  step(from: Uint8Array, to: Uint8Array, blocked: number, prev?: Int16Array): boolean {
    to.fill(0);
    let any = false;
    for (let s = 0; s < this.size; s++) {
      if (!from[s]) continue;
      for (const m of this.moves[s]) {
        if (m.lanes & blocked || to[m.to]) continue;
        to[m.to] = 1;
        if (prev) prev[m.to] = s;
        any = true;
      }
    }
    return any;
  }
}

/** The steps whose hit check meets an item at `at` metres: [first, last], or null past the finish line. */
function windowOf(cfg: GameConfig, dist: Float64Array, at: number): [number, number] | null {
  let lo = 1, hi = dist.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (dist[mid] >= at - cfg.collision.ahead) hi = mid;
    else lo = mid + 1;
  }
  if (lo >= dist.length) return null;
  let last = lo;
  while (last + 1 < dist.length && inHitWindow(at - dist[last + 1], dist[last + 1] - dist[last], cfg.collision)) last++;
  return [lo, last];
}

/** Lanes blocked at each step, kept as counts so obstacles can be taken away again. */
class Blocked {
  private readonly counts: Uint16Array;
  constructor(steps: number) {
    this.counts = new Uint16Array(steps * 3);
  }
  add(w: [number, number], lane: Lane, n = 1): void {
    for (let k = w[0]; k <= w[1]; k++) this.counts[k * 3 + lane + 1] += n;
  }
  at(k: number): number {
    return (this.counts[k * 3] ? 1 : 0) | (this.counts[k * 3 + 1] ? 2 : 0) | (this.counts[k * 3 + 2] ? 4 : 0);
  }
}

function blockedBy(cfg: GameConfig, dist: Float64Array, items: Item[]): Blocked {
  const blocked = new Blocked(dist.length);
  for (const it of items) {
    if (!isObstacle(it)) continue;
    const w = windowOf(cfg, dist, it.at);
    if (w) blocked.add(w, it.lane);
  }
  return blocked;
}

/** A series of swipes, none closer together than `fastestMove` seconds, that hits no obstacle; null if there is none. */
export function findDodge(cfg: GameConfig, items: Item[], fastestMove: number): Swipe[] | null {
  const model = new Model(fastestMove);
  const dist = distances(cfg);
  const blocked = blockedBy(cfg, dist, items);
  const steps = dist.length - 1;
  const prev = new Int16Array((steps + 1) * model.size).fill(-1);
  let from = new Uint8Array(model.size);
  let to = new Uint8Array(model.size);
  from[model.start] = 1;
  for (let k = 1; k <= steps; k++) {
    if (!model.step(from, to, blocked.at(k), prev.subarray(k * model.size, (k + 1) * model.size))) return null;
    [from, to] = [to, from];
  }
  const swipes: Swipe[] = [];
  let s = from.indexOf(1);
  for (let k = steps; k >= 1; k--) {
    const p = prev[k * model.size + s];
    if (model.fresh[s]) swipes.push({ step: k, dir: (model.lane[s] - model.lane[p]) as -1 | 1 });
    s = p;
  }
  return swipes.reverse();
}

/** The lane a series of swipes has the runner in (or moving to) at `d` metres. */
export function laneAlong(cfg: GameConfig, swipes: Swipe[]): (d: number) => Lane {
  const dist = distances(cfg);
  return (d) => {
    let lane = 0;
    for (const s of swipes) {
      if (dist[s.step - 1] > d) break;
      lane += s.dir;
    }
    return lane as Lane;
  };
}

/** Whether some series of swipes, none closer together than `fastestMove` seconds, gets through without a hit. */
export function dodgeable(cfg: GameConfig, items: Item[], fastestMove: number): boolean {
  const model = new Model(fastestMove);
  const dist = distances(cfg);
  const blocked = blockedBy(cfg, dist, items);
  let from = new Uint8Array(model.size);
  let to = new Uint8Array(model.size);
  from[model.start] = 1;
  for (let k = 1; k < dist.length; k++) {
    if (!model.step(from, to, blocked.at(k))) return false;
    [from, to] = [to, from];
  }
  return true;
}

/**
 * The street with obstacles taken away until it can be dodged: wherever the runner can no longer get through, the
 * obstacle that came into reach last goes. A street that can already be dodged comes back as it is.
 */
export function makeDodgeable(cfg: GameConfig, items: Item[], fastestMove: number): Item[] {
  const model = new Model(fastestMove);
  const dist = distances(cfg);
  const steps = dist.length - 1;
  const live = items
    .filter(isObstacle)
    .map((it) => ({ it, w: windowOf(cfg, dist, it.at) }))
    .filter((o): o is { it: Item; w: [number, number] } => o.w !== null);
  const blocked = new Blocked(dist.length);
  for (const o of live) blocked.add(o.w, o.it.lane);
  const frontier = new Uint8Array((steps + 1) * model.size);
  frontier[model.start] = 1;
  const removed = new Set<Item>();
  for (let k = 1; k <= steps; ) {
    const from = frontier.subarray((k - 1) * model.size, k * model.size);
    if (model.step(from, frontier.subarray(k * model.size, (k + 1) * model.size), blocked.at(k))) {
      k++;
      continue;
    }
    const culprit = live.filter((o) => !removed.has(o.it) && o.w[0] <= k && o.w[1] >= k).reduce((a, b) => (b.it.at >= a.it.at ? b : a));
    removed.add(culprit.it);
    blocked.add(culprit.w, culprit.it.lane, -1);
    k = culprit.w[0];
  }
  return removed.size === 0 ? items : items.filter((it) => !removed.has(it));
}

/**
 * The dodge check grown one obstacle row at a time, front to back, for building a street that can be dodged: a row
 * is only kept if the runner can still get through it from wherever it may be by then.
 */
export class DodgeTrack {
  private readonly model: Model;
  private readonly dist: Float64Array;
  /** Where the runner may be after the steps checked so far. */
  private from: Uint8Array;
  /** Steps checked so far; the next row's hit window must start after them. */
  private done = 0;

  constructor(private readonly cfg: GameConfig, fastestMove: number) {
    this.model = new Model(fastestMove);
    this.dist = distances(cfg);
    this.from = new Uint8Array(this.model.size);
    this.from[this.model.start] = 1;
  }

  /** Whether a row of obstacles at `at` in `lanes` still leaves a way through after the rows kept so far; keeps it if so. */
  tryRow(at: number, lanes: readonly Lane[]): boolean {
    const w = windowOf(this.cfg, this.dist, at);
    if (!w || w[0] <= this.done) return false;
    let next: Uint8Array = new Uint8Array(this.model.size);
    for (; this.done < w[0] - 1; this.done++) {
      this.model.step(this.from, next, 0);
      [this.from, next] = [next, this.from];
    }
    const mask = lanes.reduce((m: number, l) => m | bit(l), 0);
    let a: Uint8Array = this.from.slice();
    let b = next;
    for (let k = w[0]; k <= w[1]; k++) {
      if (!this.model.step(a, b, mask)) return false;
      [a, b] = [b, a];
    }
    this.from = a;
    this.done = w[1];
    return true;
  }
}
