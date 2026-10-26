import type { GameConfig } from '../config';
import { DodgeTrack, findDodge, laneAlong, makeDodgeable } from './dodge';
import { pick, randRange, shuffle, type Rng } from './rng';
import { BAD_TYPES, type Item, type Lane, type QuestionLevel, type RoadType } from './types';

const LANES: readonly Lane[] = [-1, 0, 1];
// Cheap rewards appear more often than the piano.
const GOOD_WEIGHTED: readonly RoadType[] = ['piano', 'violin', 'violin', 'sheet', 'sheet', 'sheet', 'notes', 'notes', 'notes'];
/** Closest two patterns may sit on average, in metres, so items never pile up (an item is 1.7 m across). */
export const MIN_PATTERN_SPACING = 4;
/** Seconds of road kept free of obstacles and rewards before and after each ❓ row. */
export const ROW_CLEAR = { before: 0.75, after: 1 };
/** What keeps a round from being lazy: */
export const PACE = {
  /** Share of obstacle patterns that block two lanes, leaving one way through. */
  doubles: 0.5,
  /** The first seconds of a round only have single obstacles, to get a feel for it. */
  gentleSeconds: 8,
  /** A lane clear for longer than this gets the next obstacle, so standing still never lasts. */
  restSeconds: 1.5,
  /** The escape lane may stay put for this many obstacle patterns in a row, then it moves… */
  sameFreeLane: 2,
  /** …unless the next obstacle is closer than this, too close to change lanes in time. */
  moveSeconds: 0.5,
  /** Share of rewards placed to lead into the next escape lane (the rest go anywhere, to tempt). */
  lead: 0.65,
  /** Never more rewards than this in a row in one lane. */
  maxLine: 3,
};
/** Bomb walls: rows of obstacles that leave one gap, closing in towards the finish. */
export const WALLS = {
  /** Rows come this many times as often (in time) at the finish as at the start. */
  denser: 3,
  /** Share of rows two lanes wide: the late ones, and fewer and fewer of the early ones. */
  wide: 0.8,
  /** Chance the gap moves on from one row to the next, when it can be reached in time… */
  move: 0.8,
  /** …and, moving from a side lane, chance it jumps straight to the other side. */
  far: 0.3,
  /** Share of rewards on a way through; the rest lie anywhere, some only for the brave. */
  onWay: 0.4,
};

type Pattern = { kind: 'obstacle'; size: 1 | 2; reward: boolean } | { kind: 'line' } | { kind: 'zigzag' } | { kind: 'single' };

const clampLane = (l: number): Lane => Math.max(-1, Math.min(1, l)) as Lane;

/** Seconds from the start line to `d` metres: the speed ramps up evenly with distance (see Run.update). */
export function timeAt(cfg: GameConfig, d: number): number {
  const r = cfg.speedRamp;
  return r > 1e-9 ? (cfg.runLength / (cfg.baseSpeed * r)) * Math.log(1 + (r * d) / cfg.runLength) : d / cfg.baseSpeed;
}

/** Metres from the start line after `t` seconds: the inverse of timeAt. */
export function distAt(cfg: GameConfig, t: number): number {
  const r = cfg.speedRamp;
  return r > 1e-9 ? (cfg.runLength / r) * (Math.exp((t * cfg.baseSpeed * r) / cfg.runLength) - 1) : t * cfg.baseSpeed;
}

/** Where the ❓ rows cross the road: halfway (Level 1) and `lastRowLead` seconds before the finish line (Level 2). */
export function questionRows(cfg: GameConfig): Array<{ at: number; level: QuestionLevel }> {
  if (!cfg.questions.enabled) return [];
  const endSpeed = cfg.baseSpeed * (1 + cfg.speedRamp);
  return [
    { at: cfg.runLength / 2, level: 1 },
    { at: cfg.runLength - cfg.questions.lastRowLead * endSpeed, level: 2 },
  ];
}

/**
 * Lays out every item for one run, front to back. Same seed, same layout.
 * 'fixed' mode places exactly `spawn.obstacles` obstacles and `spawn.treats` treats (run it with `layoutSeed`
 * so their places match too);
 * 'random' mode first draws this round's counts within ±35% of those targets.
 * Never blocks all three lanes, keeps the start and the finish clear, and thins out crowded settings.
 * With questions on, two rows of ❓ cross all three lanes, with a little empty road around each.
 * Classic obstacles keep the player moving (see PACE): no lane stays clear for long, the escape lane moves on, and
 * rewards lead into it. Bomb walls are rows with one gap that keeps moving, closer and closer together (see WALLS).
 * Either way the street can be dodged with swipes `spawn.fastestMove` seconds apart: obstacles that would make that
 * impossible are left out (see makeDodgeable).
 */
export function generateItems(rng: Rng, cfg: GameConfig): Item[] {
  const { firstAt, finishClear, mode } = cfg.spawn;
  const items: Item[] = [];
  let id = 0;
  const add = (at: number, lane: Lane, type: RoadType, level?: QuestionLevel): Item => {
    const it: Item = { id: ++id, at, lane, type, state: 'live', t: 0, level };
    items.push(it);
    return it;
  };
  const rows = questionRows(cfg);
  for (const r of rows) for (const lane of LANES) add(r.at, lane, 'question', r.level);
  // The playable stretch minus the empty road around the rows: patterns go into these segments.
  const speedAt = (d: number) => cfg.baseSpeed * (1 + cfg.speedRamp * (d / cfg.runLength));
  // The finish is kept clear, unless the last row stands in that stretch: then items run on up to its run-up.
  let lastAt = cfg.runLength - finishClear;
  const finalRow = rows.at(-1);
  if (finalRow && finalRow.at > lastAt) lastAt = Math.max(lastAt, finalRow.at - ROW_CLEAR.before * speedAt(finalRow.at));
  const segments: Array<readonly [number, number]> = [];
  let from = firstAt;
  for (const r of rows) {
    const gapStart = Math.min(r.at - ROW_CLEAR.before * speedAt(r.at), lastAt);
    if (gapStart > from) segments.push([from, gapStart]);
    from = Math.max(from, r.at + ROW_CLEAR.after * speedAt(r.at));
  }
  if (lastAt > from) segments.push([from, lastAt]);
  const span = segments.reduce((n, [a, b]) => n + b - a, 0);
  if (span <= 0) return items;
  const vary = (n: number) => Math.max(0, mode === 'fixed' ? Math.round(n) : Math.round(n * randRange(rng, 0.65, 1.35)));
  let bad = vary(cfg.spawn.obstacles);
  let good = vary(cfg.spawn.treats);
  const dodgeableOnly = () => makeDodgeable(cfg, items.sort((a, b) => a.at - b.at), cfg.spawn.fastestMove);
  if (cfg.spawn.style === 'walls') {
    layWalls(rng, cfg, segments, bad, good, add);
    return dodgeableOnly();
  }

  // 1. Obstacle patterns: one or two obstacles side by side; a single one may carry a reward in its free lane.
  const patterns: Pattern[] = [];
  while (bad > 0) {
    const size: 1 | 2 = bad >= 2 && rng() < PACE.doubles ? 2 : 1;
    const reward = size === 1 && good > 0 && rng() < 0.5;
    if (reward) good--;
    patterns.push({ kind: 'obstacle', size, reward });
    bad -= size;
  }
  // 2. Reward patterns: lines and zigzags of three, and singles.
  while (good > 0) {
    if (good >= 3 && rng() < 0.6) {
      patterns.push({ kind: rng() < 0.5 ? 'line' : 'zigzag' });
      good -= 3;
    } else {
      patterns.push({ kind: 'single' });
      good--;
    }
  }
  // 3. Too crowded for this route? Drop reward patterns first, then obstacles.
  while (patterns.length > 0 && span / patterns.length < MIN_PATTERN_SPACING) {
    let drop = patterns.length - 1;
    for (let i = patterns.length - 1; i >= 0; i--) {
      if (patterns[i].kind !== 'obstacle') {
        drop = i;
        break;
      }
    }
    patterns.splice(drop, 1);
  }
  // Obstacles spread evenly between the rewards, with a little give: a plain shuffle can bunch the rewards into
  // long stretches with no obstacle at all, where nobody has to move.
  const obstaclePatterns = shuffle(rng, patterns.filter((p) => p.kind === 'obstacle'));
  const rewardPatterns = shuffle(rng, patterns.filter((p) => p.kind !== 'obstacle'));
  patterns.length = 0;
  for (let o = 0, r = 0; o < obstaclePatterns.length || r < rewardPatterns.length; ) {
    const behind = ((patterns.length + 1) * obstaclePatterns.length) / (obstaclePatterns.length + rewardPatterns.length) - o;
    const obstacleNext = r >= rewardPatterns.length || (o < obstaclePatterns.length && behind + randRange(rng, -0.35, 0.35) > 0.5);
    patterns.push(obstacleNext ? obstaclePatterns[o++] : rewardPatterns[r++]);
  }

  // 4. Spread the patterns evenly along the segments, with a little jitter; `u` is metres of segment road.
  const spacing = span / Math.max(1, patterns.length);
  const lineStep = Math.min(4, spacing / 4);
  const zigStep = Math.min(5.5, spacing / 4);
  const onRoad = (u: number): { d: number; seg: readonly [number, number] } => {
    let left = Math.max(0, u);
    for (const seg of segments) {
      if (left <= seg[1] - seg[0]) return { d: seg[0] + left, seg };
      left -= seg[1] - seg[0];
    }
    const seg = segments[segments.length - 1];
    return { d: seg[1], seg };
  };
  const placed = patterns.map((p, i) => {
    const extent = p.kind === 'line' ? 2 * lineStep : p.kind === 'zigzag' ? 2 * zigStep : p.kind === 'obstacle' && p.reward ? 2 : 0;
    const { d, seg } = onRoad(spacing * (i + 0.5) + randRange(rng, -0.15, 0.15) * spacing);
    return { p, at: Math.min(Math.max(d, seg[0]), seg[1] - extent - 0.5) };
  });

  // 5. A gentle start: two-lane obstacles in the first seconds trade places with later single ones (counts stay exact).
  const gentle = (at: number) => timeAt(cfg, at) < PACE.gentleSeconds;
  const obstacles = placed.filter((x) => x.p.kind === 'obstacle') as Array<{ p: Extract<Pattern, { kind: 'obstacle' }>; at: number }>;
  for (const early of obstacles) {
    if (!gentle(early.at) || early.p.size === 1) continue;
    const late = [...obstacles].reverse().find((x) => !gentle(x.at) && x.p.size === 1);
    if (!late) break;
    [early.p, late.p] = [late.p, early.p];
  }

  // 6. Obstacle lanes, front to back: the escape lane moves at most one lane per pattern (so it can always be
  // reached), stays put at most `sameFreeLane` times in a row, and a lane left clear too long is blocked next.
  const lanesAt = new Map<(typeof placed)[number], { free: Lane; blocked: Lane[] }>();
  const clearSince: Record<Lane, number> = { [-1]: firstAt, 0: firstAt, 1: firstAt } as Record<Lane, number>;
  let lastFree: Lane | null = null;
  let sameRun = 0;
  let lastObstacleAt: number | null = null;
  for (const x of placed) {
    if (x.p.kind !== 'obstacle') continue;
    const size = x.p.size;
    const now = timeAt(cfg, x.at);
    const canMove = lastObstacleAt === null || now - timeAt(cfg, lastObstacleAt) >= PACE.moveSeconds;
    let options: Lane[] = lastFree === null ? [...LANES] : LANES.filter((l) => Math.abs(l - lastFree!) <= 1);
    if (lastFree !== null && !canMove) options = [lastFree];
    else if (lastFree !== null && sameRun >= PACE.sameFreeLane) options = options.filter((l) => l !== lastFree);
    // For each escape lane, the lanes it would block: both others, or the one clear the longest.
    const blockedFor = (f: Lane): Lane[] => {
      const others = shuffle(rng, LANES.filter((l) => l !== f));
      return size === 2 ? others : [others.reduce((a, b) => (clearSince[b] < clearSince[a] ? b : a))];
    };
    const rested = (l: Lane) => !gentle(x.at) && now - timeAt(cfg, clearSince[l]) > PACE.restSeconds;
    const choices = shuffle(rng, options).map((f) => ({ f, blocked: blockedFor(f) }));
    const score = (c: (typeof choices)[number]) => LANES.filter((l) => rested(l) && c.blocked.includes(l)).length - (rested(c.f) ? 0.5 : 0);
    const best = choices.reduce((a, b) => (score(b) > score(a) ? b : a));
    for (const l of best.blocked) {
      add(x.at, l, pick(rng, BAD_TYPES));
      clearSince[l] = x.at;
    }
    sameRun = best.f === lastFree ? sameRun + 1 : 1;
    lastFree = best.f;
    lastObstacleAt = x.at;
    lanesAt.set(x, { free: best.f, blocked: best.blocked });
  }

  // 7. Reward lanes: mostly leading into the next escape lane, never more than `maxLine` rewards in a row in one lane.
  let streakLane: Lane | null = null;
  let streak = 0;
  const reward = (at: number, lane: Lane, type: RoadType) => {
    streak = lane === streakLane ? streak + 1 : 1;
    streakLane = lane;
    add(at, lane, type);
  };
  const roomIn = (lane: Lane, n: number) => (lane === streakLane ? streak : 0) + n <= PACE.maxLine;
  let prevFree: Lane | null = null;
  placed.forEach((x, i) => {
    const { p, at } = x;
    if (p.kind === 'obstacle') {
      const lanes = lanesAt.get(x)!;
      prevFree = lanes.free;
      // The reward behind a single obstacle sits in its escape lane, or in the other free lane if that one is full.
      if (p.reward) {
        const other = LANES.find((l) => l !== lanes.free && !lanes.blocked.includes(l))!;
        reward(at + 2, roomIn(lanes.free, 1) ? lanes.free : other, pick(rng, GOOD_WEIGHTED));
      }
      return;
    }
    const nextObstacle = placed.slice(i + 1).find((y) => y.p.kind === 'obstacle');
    const next = (nextObstacle && lanesAt.get(nextObstacle)?.free) ?? prevFree ?? pick(rng, LANES);
    const leads = rng() < PACE.lead;
    if (p.kind === 'line') {
      const type = pick(rng, GOOD_WEIGHTED);
      const wanted = leads ? next : pick(rng, LANES);
      // A line of three is a breather; it never extends another line into six or nine.
      const lane = roomIn(wanted, 3) ? wanted : shuffle(rng, LANES.filter((l) => l !== streakLane)).sort((a, b) => Math.abs(a - next) - Math.abs(b - next))[0];
      for (let k = 0; k < 3; k++) reward(at + k * lineStep, lane, type);
    } else if (p.kind === 'zigzag') {
      // Three rewards one lane apart, ending in the next escape lane: a diagonal when it is two lanes away, else a bounce.
      const end = leads ? next : pick(rng, LANES);
      const side = end === 0 ? pick(rng, [-1, 1]) : -Math.sign(end);
      const beside = clampLane(end + side);
      // Preferred first; the two bounces start in different lanes, so one always has room.
      const ways: Lane[][] = [[end, beside, end], [beside, end, beside]];
      if (prevFree !== null && Math.abs(prevFree - end) === 2) ways.unshift([prevFree, 0, end]);
      const lanes = ways.find((w) => roomIn(w[0], 1)) ?? ways[0];
      for (let k = 0; k < 3; k++) reward(at + k * zigStep, lanes[k], pick(rng, GOOD_WEIGHTED));
    } else {
      const wanted = leads ? next : pick(rng, LANES);
      const lane = roomIn(wanted, 1) ? wanted : (LANES.filter((l) => l !== wanted).sort((a, b) => Math.abs(a - next) - Math.abs(b - next))[0]);
      reward(at, lane, pick(rng, GOOD_WEIGHTED));
    }
  });
  return dodgeableOnly();
}

/**
 * Bomb walls along the segments: rows of obstacles, more and more often and more and more of them two lanes wide,
 * the gap moving on whenever it can still be reached (checked row by row with DodgeTrack), then the rewards.
 */
function layWalls(
  rng: Rng,
  cfg: GameConfig,
  segments: ReadonlyArray<readonly [number, number]>,
  bad: number,
  good: number,
  add: (at: number, lane: Lane, type: RoadType) => Item,
): void {
  // The segments in seconds since the start; `at(u)` is the spot a share `u` of the way along them, in time.
  const spans = segments.map(([a, b]) => [timeAt(cfg, a), timeAt(cfg, b)] as const);
  const total = spans.reduce((n, [a, b]) => n + b - a, 0);
  const at = (u: number) => {
    let left = Math.min(1, Math.max(0, u)) * total;
    for (const [a, b] of spans) {
      if (left <= b - a) return distAt(cfg, a + left);
      left -= b - a;
    }
    return distAt(cfg, spans[spans.length - 1][1]);
  };

  // 1. Rows, `k + 1` times as dense at the finish as at the start, with exactly `bad` obstacles between them:
  // the late rows are the wide ones.
  const k = WALLS.denser - 1;
  const count = Math.min(bad, Math.max(Math.ceil(bad / 2), Math.round(bad / (1 + WALLS.wide))));
  const rows = Array.from({ length: count }, (_, j) => {
    const c = ((1 + k / 2) * (j + 0.5 + randRange(rng, -0.3, 0.3))) / count;
    const u = k > 0 ? (Math.sqrt(1 + 2 * k * c) - 1) / k : c;
    return { u, wide: false, key: u + randRange(rng, -0.3, 0.3) };
  });
  for (const r of [...rows].sort((a, b) => b.key - a.key).slice(0, bad - count)) r.wide = true;

  // 2. Front to back, each row only where the runner can still get through it.
  const track = new DodgeTrack(cfg, cfg.spawn.fastestMove);
  const obstacles: Item[] = [];
  const others = (l: Lane) => LANES.filter((x) => x !== l);
  let gap: Lane = 0;
  for (const row of rows) {
    const d = at(row.u);
    // Where the gap may go: the next lane first, now and then straight across.
    const moves: Lane[] = shuffle(rng, others(gap)).sort((a, b) => Math.abs(a - gap) - Math.abs(b - gap));
    if (Math.abs(moves[1] - gap) === 2 && rng() < WALLS.far) moves.reverse();
    const moving = rng() < WALLS.move;
    const wide: Lane | undefined = row.wide ? (moving ? [...moves, gap] : [gap, ...moves]).find((f) => track.tryRow(d, others(f))) : undefined;
    if (wide !== undefined) {
      for (const l of others(wide)) obstacles.push(add(d, l, pick(rng, BAD_TYPES)));
      gap = wide;
      continue;
    }
    // A single obstacle, mostly right in the gap so far, so the runner still has to move.
    const single = (moving ? [gap, ...moves] : [...moves, gap]).find((l) => track.tryRow(d, [l]));
    if (single === undefined) continue;
    obstacles.push(add(d, single, pick(rng, BAD_TYPES)));
    if (single === gap) gap = gap === 0 ? pick(rng, [-1, 1] as const) : 0;
  }

  // 3. Rewards anywhere in time, some on a way through, never on top of an obstacle or another reward.
  const way = laneAlong(cfg, findDodge(cfg, obstacles, cfg.spawn.fastestMove) ?? []);
  const rewards: Item[] = [];
  const free = (d: number, lane: Lane) =>
    !obstacles.some((o) => o.lane === lane && Math.abs(o.at - d) < 2.5) && !rewards.some((r) => r.lane === lane && Math.abs(r.at - d) < 2);
  for (let n = 0; n < good; n++) {
    for (let tries = 0; tries < 8; tries++) {
      const d = at(rng());
      const lane = rng() < WALLS.onWay ? way(d) : pick(rng, LANES);
      if (!free(d, lane)) continue;
      rewards.push(add(d, lane, pick(rng, GOOD_WEIGHTED)));
      break;
    }
  }
}

/**
 * The seed for 'fixed' mode: a hash of the staff's layout seed and every setting that shapes a run (route length,
 * item counts and clear stretches, the ❓ rows; round length and speeds set these), so every round on every
 * device with the same settings plays the same street. Points and prizes don't move anything, so they leave it alone.
 */
export function layoutSeed(cfg: GameConfig): number {
  const { runLength, spawn: s, questions: q } = cfg;
  // Bomb walls depend on the fastest move too; classic streets keep the key they always had.
  const key = JSON.stringify([s.seed, runLength, s.firstAt, s.finishClear, s.obstacles, s.treats, q.enabled, ...(s.style === 'walls' ? ['walls', s.fastestMove] : [])]);
  // FNV-1a
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
  return h >>> 0;
}
