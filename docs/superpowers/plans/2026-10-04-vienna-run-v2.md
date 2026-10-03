# Vienna Run v2 Implementation Plan (settings, Vietnamese, Supabase leaderboard)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a PIN-protected staff settings menu (difficulty, points, gifts, questions), make the game Vietnamese-first with an EN toggle, and add an offline-first Supabase leaderboard with name entry, built and deployed in that order.

**Architecture:**
- **Settings:** a pure `Settings` model in `src/core/settings.ts` becomes a `GameConfig` through `buildConfig`. The core (route, spawner, run) reads only `GameConfig`, so tuning never touches gameplay code.
- **Translation:** a typed dictionary `src/i18n/strings.ts` plus a bilingual question bank. Every screen gets `setLang`.
- **Scores:** `src/scores/` holds a local-first `ScoreStore`. It keeps a persistent upload queue and a cache of the remote board, and talks to Supabase through plain `fetch` with timeouts.
- **Database:** a `vercel-build` migration step creates the Supabase table and its security rules.

**Tech Stack:** existing Vite 8 + TypeScript + Three.js + Vitest/jsdom + Playwright. New: `@fontsource/josefin-sans`, `@fontsource/be-vietnam-pro`, `pg` + `@types/pg` (build-time migration only).

**Spec:** `docs/superpowers/specs/2026-10-03-vienna-run-v2-settings-vietnamese-leaderboard-design.md` (builds on `docs/superpowers/specs/2026-10-03-vienna-run-design.md`).

## Global Constraints

- **Order of work:** Settings (Tasks 1–6, deploy) → Vietnamese (Tasks 7–10, deploy) → Leaderboard (Tasks 11–16, deploy).
- **The game never waits on the network.** Every Supabase request has a 5 s timeout, and failures only change the sync status.
- **`src/core/` stays pure:** no `three`, no DOM, and no imports from `src/render|ui|app|input|scores`.
- **Staff screens** (settings, PIN, self-check) are English. **Visitor-facing text** comes from `I18n.t(key)` (`src/i18n/`).
- **Defaults:**
  - Vietnamese language, PIN `2468`, board `booth`, questions on, gifts hidden, leaderboard on.
  - Normal preset: 38 s, 50→63 km/h, 11 obstacles, 31 treats, random mode.
- **Code names:** match `^[A-Za-z0-9 _-]{1,12}$`. Board names match `^[a-z0-9-]{1,24}$`.
- **Secrets never reach the browser.** Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) are exposed to the bundle. `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY` and the `POSTGRES_*` variables are build-time only.
- **USB build** (`--mode offline`): no Supabase, local-only leaderboard, no network calls.
- **Supabase table** `public.vienna_run_scores`: `anon` may insert and select only (no update or delete).
- **Deploy:** `git push origin main`, then the Vercel MCP `create_deployment` with
  `{"name":"vienna-run","project":"prj_gshtFpWvq4PA8x4sfGWAh7EZnTum","target":"production","gitSource":{"type":"github","org":"danila6231","repo":"vienna-run","ref":"main"}}`
  and `teamId` `team_PId8IZyyEpIgnn7vskfrxpMf`.
- **Commits:** every commit message ends with the session's required attribution trailer lines.

## Review Focus

1. **Bad or missing internet:** no network, DNS failure, a hanging request, a captive portal answering `200` with HTML, or the Supabase table missing (`404`). Play stays smooth, scores stay queued (nothing is marked uploaded by mistake), and the board shows the last cached copy. Tests: `tests/scores/remote.test.ts` (Task 12) and `tests/scores/store.test.ts` (Task 13).
2. **Typing in a text field while the game listens to the keyboard:** a name, a board name, a PIN or a share code. Letters like `a`/`d`, Space and Enter must never move lanes or start a round. Tests: `tests/input/touch.test.ts` (Task 5) and `tests/ui/results.test.ts` (Task 15).
3. **Impossible or extreme settings:** a 20 s round with 5 questions, 40 obstacles and 80 treats, end speed below start, garbage share codes, old or corrupted saved settings. The menu explains the problem, and the game never crashes or deadlocks. Tests: `tests/core/settings.test.ts` (Task 3), `tests/core/spawner.test.ts` (Task 2), `tests/app/settingsStore.test.ts` (Task 4).
4. **A visitor wanders off mid-name-entry, or staff leave the leaderboard open on results:** the results screen waits while someone types, then resets on its own. Tests: `tests/ui/results.test.ts` and `tests/app/game.test.ts` (Task 15), `tests/ui/board.test.ts` (Task 14).
5. **Corrupted or full browser storage for the score log or queue:** the game still plays, and the leaderboard degrades to "unavailable" instead of throwing. Test: `tests/scores/store.test.ts` (Task 13).

---

## Phase A: Settings menu

### Task 1: Route stops as fractions of the route length

**Files:**
- Modify: `src/core/route.ts` (full replacement), `src/core/run.ts`, `src/render/street.ts`, `src/render/landmarks.ts`, `src/render/world.ts`
- Test: `tests/core/route.test.ts` (full replacement), `tests/core/run.test.ts` (add one test)

**Interfaces:**
- Produces:
  - `interface Landmark { id: LandmarkId; at: number; side: -1 | 1; plaza: [number, number] | null }`
  - `interface Route { length: number; landmarks: readonly Landmark[]; inPlaza(p: number, side: -1 | 1, margin?: number): boolean }`
  - `buildRoute(length: number): Route`
  - `Run.route: Route`
  - `Street.update(dist: number, route: Route)`, `Landmarks.update(dist: number, time: number, route: Route)`
- Removes: `LANDMARKS`, `inPlaza` exports (all users updated in this task)

- [ ] **Step 1: Write the failing tests**

Replace `tests/core/route.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buildRoute } from '../../src/core/route';

describe('buildRoute', () => {
  it.each([300, 600, 1200])('puts the Riesenrad at the finish of a %i m route', (len) => {
    const r = buildRoute(len);
    expect(r.length).toBe(len);
    expect(r.landmarks.find((l) => l.id === 'riesenrad')?.at).toBe(len);
  });
  it('spaces the stops in proportion to the route length', () => {
    expect(buildRoute(600).landmarks[0].at).toBe(65);
    expect(buildRoute(1200).landmarks[0].at).toBe(130);
  });
  it('opens a plaza only on the landmark side', () => {
    const r = buildRoute(600);
    expect(r.inPlaza(65, 1)).toBe(true);
    expect(r.inPlaza(65, -1)).toBe(false);
    expect(r.inPlaza(150, 1)).toBe(false);
  });
  it('widens plazas by the margin', () => {
    const r = buildRoute(600);
    expect(r.inPlaza(65 + 18, 1)).toBe(false);
    expect(r.inPlaza(65 + 18, 1, 4)).toBe(true);
  });
});
```

Add inside `describe('Run', …)` in `tests/core/run.test.ts`:
```ts
  it('builds its route from the run length', () => {
    const run = new Run({ seed: 1, config: { ...CONFIG, runLength: 900 }, items: [], slots: [] });
    expect(run.route.landmarks.at(-1)?.at).toBe(900);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/core/route.test.ts tests/core/run.test.ts`
Expected: FAIL. `buildRoute` isn't exported, and `run.route` is undefined.

- [ ] **Step 3: Replace `src/core/route.ts`**

```ts
export type LandmarkId = 'stephansdom' | 'tram' | 'karlskirche' | 'hofburg' | 'riesenrad';

export interface Landmark {
  id: LandmarkId;
  /** Route distance of the landmark, in metres from the start line. */
  at: number;
  /** -1 = left side of the street, 1 = right side. */
  side: -1 | 1;
  /** Open plaza around the landmark (metres before/after `at`) where facade rows break. */
  plaza: [number, number] | null;
}

export interface Route {
  length: number;
  landmarks: readonly Landmark[];
  /** Is route position `p` inside a landmark's open plaza on this side of the street? */
  inPlaza(p: number, side: -1 | 1, margin?: number): boolean;
}

/** The authored route as fractions of its length, so any round length keeps the Riesenrad at the finish. */
const STOPS: ReadonlyArray<Omit<Landmark, 'at'> & { frac: number }> = [
  { id: 'stephansdom', frac: 65 / 600, side: 1, plaza: [-24, 16] },
  { id: 'tram', frac: 175 / 600, side: -1, plaza: null },
  { id: 'karlskirche', frac: 270 / 600, side: -1, plaza: [-24, 16] },
  { id: 'hofburg', frac: 410 / 600, side: 1, plaza: [-26, 16] },
  { id: 'riesenrad', frac: 1, side: 1, plaza: [-40, 40] },
];

export function buildRoute(length: number): Route {
  const landmarks: Landmark[] = STOPS.map(({ frac, ...stop }) => ({ ...stop, at: Math.round(frac * length) }));
  return {
    length,
    landmarks,
    inPlaza(p, side, margin = 0) {
      for (const lm of landmarks) {
        if (!lm.plaza || lm.side !== side) continue;
        const d = p - lm.at;
        if (d > lm.plaza[0] - margin && d < lm.plaza[1] + margin) return true;
      }
      return false;
    },
  };
}
```

- [ ] **Step 4: Give `Run` its route** (edit `src/core/run.ts`)

Add the import beside the others:
```ts
import { buildRoute, type Route } from './route';
```
Add the field after `readonly slots: number[];`:
```ts
  readonly route: Route;
```
Add as the last line of the constructor:
```ts
    this.route = buildRoute(this.cfg.runLength);
```

- [ ] **Step 5: Render from the run's route**

In `src/render/street.ts`:
- Replace `import { inPlaza } from '../core/route';` with `import type { Route } from '../core/route';`
- In `interface Street`, change `update(dist: number): void;` to `update(dist: number, route: Route): void;`
- Change `    update(dist) {` to `    update(dist, route) {`
- Change `!inPlaza(p, row.side,` to `!route.inPlaza(p, row.side,`

In `src/render/landmarks.ts`:
- Replace `import { LANDMARKS, type LandmarkId } from '../core/route';` with `import type { LandmarkId, Route } from '../core/route';`
- In `interface Landmarks`, change `update(dist: number, time: number): void;` to `update(dist: number, time: number, route: Route): void;`
- Delete the line `  const finishAt = LANDMARKS.find((l) => l.id === 'riesenrad')?.at ?? 600;`
- Change `    update(dist, time) {` to `    update(dist, time, route) {`
- Change `      for (const lm of LANDMARKS) {` to `      for (const lm of route.landmarks) {`
- Change `      const fr = finishAt - dist;` to `      const fr = route.length - dist;`

In `src/render/world.ts`, replace
```ts
      street.update(run.dist);
      landmarks.update(run.dist, time);
```
with
```ts
      street.update(run.dist, run.route);
      landmarks.update(run.dist, time, run.route);
```

- [ ] **Step 6: Run the tests and the type check**

Run: `npx vitest run tests/core && npx tsc --noEmit`
Expected: PASS, and no type errors (`grep -rn "LANDMARKS\|inPlaza(" src` finds only `route.ts` and the `route.inPlaza` call).

- [ ] **Step 7: Commit**

```bash
git add src/core/route.ts src/core/run.ts src/render/street.ts src/render/landmarks.ts src/render/world.ts tests/core/route.test.ts tests/core/run.test.ts
git commit -m "refactor(core): route stops as fractions of the run length"
```

---

### Task 2: Spawner driven by obstacle and treat counts

**Files:**
- Modify: `src/config.ts` (`GameConfig.spawn` + `CONFIG.spawn`), `src/core/spawner.ts` (full replacement)
- Test: `tests/core/spawner.test.ts` (full replacement)

**Interfaces:**
- Consumes: `buildRoute` (Task 1, indirectly via `Run`); `Rng` helpers
- Produces:
  - `GameConfig.spawn = { firstAt: number; finishClear: number; obstacles: number; treats: number; mode: 'random' | 'fixed' }`
  - `generateItems(rng, cfg): Item[]` (same signature)
  - `MIN_PATTERN_SPACING = 14`

- [ ] **Step 1: Write the failing tests** (replace `tests/core/spawner.test.ts`)

```ts
import { describe, expect, it } from 'vitest';
import { CONFIG, type GameConfig } from '../../src/config';
import { createRng } from '../../src/core/rng';
import { generateItems } from '../../src/core/spawner';
import type { Item } from '../../src/core/types';

const seeds = Array.from({ length: 200 }, (_, i) => i + 1);
const withSpawn = (spawn: Partial<GameConfig['spawn']>, extra: Partial<GameConfig> = {}): GameConfig => ({ ...CONFIG, ...extra, spawn: { ...CONFIG.spawn, ...spawn } });
const run = (seed: number, cfg: GameConfig = CONFIG) => generateItems(createRng(seed), cfg);
const good = (items: Item[]) => items.filter((i) => CONFIG.items[i.type].good);
const bad = (items: Item[]) => items.filter((i) => !CONFIG.items[i.type].good);
/** Obstacles grouped by position: each group is one obstacle pattern. */
const obstacleGroups = (items: Item[]) => {
  const groups: Item[][] = [];
  for (const o of bad(items)) {
    const g = groups.find((x) => Math.abs(x[0].at - o.at) < 0.5);
    if (g) g.push(o);
    else groups.push([o]);
  }
  return groups.sort((a, b) => a[0].at - b[0].at);
};

describe('generateItems', () => {
  it('is deterministic for a seed', () => {
    expect(run(11)).toEqual(run(11));
  });
  it.each(['random', 'fixed'] as const)('keeps items inside the playable stretch (%s mode)', (mode) => {
    const cfg = withSpawn({ mode });
    for (const s of seeds) for (const it of run(s, cfg)) {
      expect(it.at).toBeGreaterThanOrEqual(cfg.spawn.firstAt);
      expect(it.at).toBeLessThan(cfg.runLength - cfg.spawn.finishClear);
    }
  });
  it('returns items sorted by distance', () => {
    for (const s of seeds) {
      const items = run(s);
      for (let i = 1; i < items.length; i++) expect(items[i].at).toBeGreaterThanOrEqual(items[i - 1].at);
    }
  });
  it('never blocks all three lanes with obstacles', () => {
    for (const mode of ['random', 'fixed'] as const) for (const s of seeds) {
      const items = bad(run(s, withSpawn({ mode, obstacles: 30 })));
      for (const b of items) {
        const lanes = new Set(items.filter((o) => Math.abs(o.at - b.at) < 3).map((o) => o.lane));
        expect(lanes.size).toBeLessThan(3);
      }
    }
  });
  it('keeps the next escape lane within one step of the previous one', () => {
    for (const s of seeds) {
      const groups = obstacleGroups(run(s, withSpawn({ mode: 'fixed', obstacles: 20 })));
      const free = groups.map((g) => [-1, 0, 1].filter((l) => !g.some((o) => o.lane === l)));
      for (let i = 1; i < free.length; i++) {
        expect(free[i].some((f) => free[i - 1].some((p) => Math.abs(f - p) <= 1))).toBe(true);
      }
    }
  });
  it.each([[10, 30], [0, 20], [20, 5], [11, 31]])('fixed mode places exactly %i obstacles and %i treats', (o, t) => {
    const cfg = withSpawn({ mode: 'fixed', obstacles: o, treats: t });
    for (const s of seeds.slice(0, 50)) {
      const items = run(s, cfg);
      expect(bad(items)).toHaveLength(o);
      expect(good(items)).toHaveLength(t);
    }
  });
  it('random mode varies each round around the targets', () => {
    const counts = seeds.map((s) => run(s)).map((items) => [bad(items).length, good(items).length]);
    const avgBad = counts.reduce((a, [b]) => a + b, 0) / counts.length;
    const avgGood = counts.reduce((a, [, g]) => a + g, 0) / counts.length;
    expect(avgBad).toBeGreaterThan(CONFIG.spawn.obstacles * 0.9);
    expect(avgBad).toBeLessThan(CONFIG.spawn.obstacles * 1.1);
    expect(avgGood).toBeGreaterThan(CONFIG.spawn.treats * 0.9);
    expect(avgGood).toBeLessThan(CONFIG.spawn.treats * 1.1);
    const bads = counts.map(([b]) => b);
    expect(Math.max(...bads) - Math.min(...bads)).toBeGreaterThanOrEqual(4);
  });
  it('thins out settings too crowded for a short route so obstacles stay readable', () => {
    const cfg = withSpawn({ mode: 'fixed', obstacles: 40, treats: 80 }, { runLength: 300 });
    for (const s of seeds.slice(0, 50)) {
      const items = run(s, cfg);
      expect(bad(items).length).toBeLessThanOrEqual(40);
      const groups = obstacleGroups(items);
      for (let i = 1; i < groups.length; i++) expect(groups[i][0].at - groups[i - 1][0].at).toBeGreaterThan(9);
    }
  });
  it('places enough treats for every question slot', () => {
    for (const s of seeds) expect(good(run(s)).length).toBeGreaterThanOrEqual(14);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/core/spawner.test.ts`
Expected: FAIL. TypeScript/Vitest reports unknown `obstacles`/`mode` spawn fields, and the fixed-count tests fail.

- [ ] **Step 3: Extend the config** (edit `src/config.ts`)

Replace `  spawn: { firstAt: number; finishClear: number };` with:
```ts
  /** Item layout: exact counts in 'fixed' mode, targets that vary ±35% per round in 'random' mode. */
  spawn: { firstAt: number; finishClear: number; obstacles: number; treats: number; mode: 'random' | 'fixed' };
```
Replace `  spawn: { firstAt: 34, finishClear: 36 },` with:
```ts
  spawn: { firstAt: 34, finishClear: 36, obstacles: 11, treats: 31, mode: 'random' },
```

- [ ] **Step 4: Replace `src/core/spawner.ts`**

```ts
import type { GameConfig } from '../config';
import { pick, randRange, shuffle, type Rng } from './rng';
import { BAD_TYPES, type Item, type ItemType, type Lane } from './types';

const LANES: readonly Lane[] = [-1, 0, 1];
// Cheap treats appear more often than the Sachertorte.
const GOOD_WEIGHTED: readonly ItemType[] = ['sacher', 'kipferl', 'kipferl', 'melange', 'melange', 'melange', 'mozart', 'mozart', 'mozart'];
/** Closest two patterns may sit, in metres, so every obstacle stays readable and dodgeable. */
export const MIN_PATTERN_SPACING = 14;

type Pattern = { kind: 'obstacle'; size: 1 | 2; reward: boolean } | { kind: 'line' } | { kind: 'zigzag' } | { kind: 'single' };

const clampLane = (l: number): Lane => Math.max(-1, Math.min(1, l)) as Lane;

/**
 * Lays out every item for one run, front to back. Same seed, same layout.
 * 'fixed' mode places exactly `spawn.obstacles` obstacles and `spawn.treats` treats (only positions vary);
 * 'random' mode first draws this round's counts within ±35% of those targets.
 * Never blocks all three lanes, keeps the start and the finish clear, and thins out crowded settings.
 */
export function generateItems(rng: Rng, cfg: GameConfig): Item[] {
  const { firstAt, finishClear, mode } = cfg.spawn;
  const lastAt = cfg.runLength - finishClear;
  const span = lastAt - firstAt;
  if (span <= 0) return [];
  const vary = (n: number) => Math.max(0, mode === 'fixed' ? Math.round(n) : Math.round(n * randRange(rng, 0.65, 1.35)));
  let bad = vary(cfg.spawn.obstacles);
  let good = vary(cfg.spawn.treats);

  // 1. Obstacle patterns: one or two obstacles side by side; a single one may carry a reward treat in a free lane.
  const patterns: Pattern[] = [];
  while (bad > 0) {
    const size: 1 | 2 = bad >= 2 && rng() < 0.3 ? 2 : 1;
    const reward = size === 1 && good > 0 && rng() < 0.5;
    if (reward) good--;
    patterns.push({ kind: 'obstacle', size, reward });
    bad -= size;
  }
  // 2. Treat patterns: lines and zigzags of three, and singles.
  while (good > 0) {
    if (good >= 3 && rng() < 0.6) {
      patterns.push({ kind: rng() < 0.5 ? 'line' : 'zigzag' });
      good -= 3;
    } else {
      patterns.push({ kind: 'single' });
      good--;
    }
  }
  // 3. Too crowded for this route? Drop treat patterns first, then obstacles.
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
  shuffle(rng, patterns);

  // 4. Spread the patterns evenly along the playable stretch, with a little jitter.
  const spacing = span / Math.max(1, patterns.length);
  const lineStep = Math.min(4, spacing / 4);
  const zigStep = Math.min(5.5, spacing / 4);
  const items: Item[] = [];
  let id = 0;
  const add = (at: number, lane: Lane, type: ItemType) => {
    items.push({ id: ++id, at, lane, type, state: 'live', t: 0, question: false });
  };
  let lastFree: Lane | null = null;
  patterns.forEach((p, i) => {
    const extent = p.kind === 'line' ? 2 * lineStep : p.kind === 'zigzag' ? 2 * zigStep : p.kind === 'obstacle' && p.reward ? 2 : 0;
    const centre = firstAt + spacing * (i + 0.5) + randRange(rng, -0.15, 0.15) * spacing;
    const at = Math.min(Math.max(centre, firstAt), lastAt - extent - 0.5);
    if (p.kind === 'obstacle') {
      // Keep the escape lane within one step of the previous one, so every gap can be reached in time.
      const free: Lane = lastFree === null ? pick(rng, LANES) : clampLane(lastFree + pick(rng, [-1, 0, 1]));
      const blocked = shuffle(rng, LANES.filter((l) => l !== free)).slice(0, p.size);
      for (const l of blocked) add(at, l, pick(rng, BAD_TYPES));
      if (p.reward) add(at + 2, free, pick(rng, GOOD_WEIGHTED));
      lastFree = free;
    } else if (p.kind === 'line') {
      const lane = pick(rng, LANES);
      const type = pick(rng, GOOD_WEIGHTED);
      for (let k = 0; k < 3; k++) add(at + k * lineStep, lane, type);
    } else if (p.kind === 'zigzag') {
      let lane = pick(rng, LANES);
      for (let k = 0; k < 3; k++) {
        add(at + k * zigStep, lane, pick(rng, GOOD_WEIGHTED));
        lane = clampLane(lane + (rng() < 0.5 ? -1 : 1));
      }
    } else {
      add(at, pick(rng, LANES), pick(rng, GOOD_WEIGHTED));
    }
  });
  return items.sort((a, b) => a.at - b.at);
}
```

- [ ] **Step 5: Run the spawner tests and the full suite**

Run: `npx vitest run tests/core/spawner.test.ts && npm test`
Expected: PASS everywhere. The bot test "gives an average player the full set of questions in almost every run" still passes (about 31 treats per run). If it does not, record the measured share in the ledger and investigate before continuing.

- [ ] **Step 6: Re-run the simulator and commit**

Run: `npm run simulate -- 500`
Expected: the table prints. Means stay in the same range as before (about 180–225).

```bash
git add src/config.ts src/core/spawner.ts tests/core/spawner.test.ts docs/simulation-report.md
git commit -m "feat(core): count-driven spawner with fixed and random modes"
```

---

### Task 3: Settings model, presets, validation, `buildConfig`, share codes

**Files:**
- Create: `src/core/settings.ts`
- Test: `tests/core/settings.test.ts`

**Interfaces:**
- Consumes: `CONFIG`, `GameConfig`, `Tier` (`src/config.ts`); `ItemType` (`src/core/types.ts`)
- Produces:
  - `type Preset = 'easy' | 'normal' | 'hard' | 'custom'`, `type Mode = 'random' | 'fixed'`
  - `interface Settings { version: 1; preset; roundSeconds; startSpeedKmh; endSpeedKmh; mode; obstacles; treats; points: Record<ItemType, number>; tiers: Tier[]; showGifts; questions: { enabled; perRun; timeLimit }; leaderboard: { enabled; board }; pin }`
  - `interface Features { showGifts: boolean; leaderboard: boolean }`, `featuresOf(s): Features`
  - `PRESETS`, `LIMITS`
  - `defaultSettings()`, `applyPreset(s, p)`, `detectPreset(s)`, `sanitize(raw)`, `validate(s): string[]`, `minRoundSeconds(perRun)`
  - `buildConfig(s, base?): GameConfig`
  - `toShareCode(s)`, `fromShareCode(code, current): Settings | null`

- [ ] **Step 1: Write the failing tests** (`tests/core/settings.test.ts`)

```ts
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { scheduleSlots } from '../../src/core/questions';
import { createRng } from '../../src/core/rng';
import { Run } from '../../src/core/run';
import {
  applyPreset, buildConfig, defaultSettings, detectPreset, featuresOf, fromShareCode, minRoundSeconds, sanitize, toShareCode, validate,
} from '../../src/core/settings';

describe('defaults', () => {
  it('reproduce today\'s game', () => {
    const cfg = buildConfig(defaultSettings());
    expect(cfg.baseSpeed).toBeCloseTo(50 / 3.6);
    expect(cfg.baseSpeed * (1 + cfg.speedRamp)).toBeCloseTo(63 / 3.6);
    expect(cfg.runLength).toBeGreaterThan(590);
    expect(cfg.runLength).toBeLessThan(605);
    expect(cfg.spawn).toMatchObject({ obstacles: 11, treats: 31, mode: 'random' });
    expect(cfg.questions).toMatchObject({ perRun: 3, timeLimit: 10 });
    for (const [k, v] of Object.entries(CONFIG.items)) expect(cfg.items[k as keyof typeof CONFIG.items].points).toBe(v.points);
  });
  it('start in Normal with gifts hidden, questions and leaderboard on, PIN 2468, board "booth"', () => {
    const s = defaultSettings();
    expect(s.preset).toBe('normal');
    expect(featuresOf(s)).toEqual({ showGifts: false, leaderboard: true });
    expect(s.questions.enabled).toBe(true);
    expect(s.pin).toBe('2468');
    expect(s.leaderboard.board).toBe('booth');
  });
});

describe('presets', () => {
  it('fill the difficulty values', () => {
    const hard = applyPreset(defaultSettings(), 'hard');
    expect(hard).toMatchObject({ preset: 'hard', startSpeedKmh: 58, endSpeedKmh: 76, obstacles: 16, treats: 28 });
  });
  it('turn into Custom once a value is edited', () => {
    const s = { ...applyPreset(defaultSettings(), 'easy'), obstacles: 9 };
    expect(detectPreset(s)).toBe('custom');
  });
});

describe('buildConfig', () => {
  it('switches questions off completely', () => {
    const cfg = buildConfig({ ...defaultSettings(), questions: { enabled: false, perRun: 3, timeLimit: 10 } });
    expect(cfg.questions.perRun).toBe(0);
    expect(scheduleSlots(createRng(1), cfg.questions)).toEqual([]);
  });
  it('scales the run length and question window with the round length', () => {
    const cfg = buildConfig({ ...defaultSettings(), roundSeconds: 60 });
    expect(cfg.runLength).toBeGreaterThan(900);
    expect(cfg.questions.windowEnd).toBe(52);
  });
  it('never builds a round that crashes, even from settings that failed validation', () => {
    const s = { ...defaultSettings(), roundSeconds: 20, questions: { enabled: true, perRun: 5, timeLimit: 10 } };
    expect(validate(s).length).toBeGreaterThan(0);
    expect(() => new Run({ seed: 1, config: buildConfig(s) })).not.toThrow();
  });
});

describe('validate', () => {
  it('explains when the round is too short for the questions', () => {
    const s = { ...defaultSettings(), roundSeconds: 20, questions: { enabled: true, perRun: 5, timeLimit: 10 } };
    expect(validate(s)).toContain(`5 questions need a round of at least ${minRoundSeconds(5)} s.`);
    expect(validate(defaultSettings())).toEqual([]);
  });
  it('rejects a bad PIN, board name or gift ladder', () => {
    expect(validate({ ...defaultSettings(), pin: '12a4' }).length).toBe(1);
    expect(validate({ ...defaultSettings(), leaderboard: { enabled: true, board: 'Booth 1' } }).length).toBe(1);
    expect(validate({ ...defaultSettings(), tiers: [{ name: 'A', min: 0 }, { name: 'B', min: 0 }] }).length).toBe(1);
    expect(validate({ ...defaultSettings(), tiers: [{ name: 'A', min: 0 }, { name: 'B', min: 1500 }] }).length).toBe(1);
  });
});

describe('sanitize', () => {
  it('turns garbage into defaults', () => {
    expect(sanitize(null)).toEqual(defaultSettings());
    expect(sanitize('nope')).toEqual(defaultSettings());
    expect(sanitize({ roundSeconds: 'x', tiers: 7, pin: 1234, leaderboard: { board: '!!' } })).toEqual(defaultSettings());
  });
  it('clamps values into range and keeps end speed ≥ start speed', () => {
    const s = sanitize({ ...defaultSettings(), roundSeconds: 500, startSpeedKmh: 80, endSpeedKmh: 40, obstacles: -3 });
    expect(s.roundSeconds).toBe(90);
    expect(s.endSpeedKmh).toBe(80);
    expect(s.obstacles).toBe(0);
  });
  it('re-detects the preset instead of trusting the stored label', () => {
    expect(sanitize({ ...defaultSettings(), preset: 'hard' }).preset).toBe('normal');
  });
});

describe('share codes', () => {
  it('round-trip every setting except the PIN', () => {
    const tuned = { ...applyPreset(defaultSettings(), 'hard'), obstacles: 20, pin: '9999', tiers: [{ name: 'Bánh quy', min: 0 }, { name: 'Gấu bông', min: 150 }] };
    const code = toShareCode(tuned);
    expect(code.startsWith('VR1-')).toBe(true);
    expect(code).not.toContain('9999');
    const loaded = fromShareCode(code, defaultSettings());
    expect(loaded).toEqual({ ...tuned, preset: 'custom', pin: '2468' });
  });
  it('reject codes that are not ours', () => {
    expect(fromShareCode('hello', defaultSettings())).toBeNull();
    expect(fromShareCode('VR1-!!!', defaultSettings())).toBeNull();
    expect(fromShareCode('VR1-NDI', defaultSettings())).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/core/settings.test.ts`
Expected: FAIL. `src/core/settings` can't be resolved.

- [ ] **Step 3: Write `src/core/settings.ts`**

```ts
import { CONFIG, type GameConfig, type Tier } from '../config';
import type { ItemType } from './types';

export type Preset = 'easy' | 'normal' | 'hard' | 'custom';
export type Mode = 'random' | 'fixed';

export interface Settings {
  version: 1;
  preset: Preset;
  roundSeconds: number;
  startSpeedKmh: number;
  endSpeedKmh: number;
  mode: Mode;
  obstacles: number;
  treats: number;
  points: Record<ItemType, number>;
  tiers: Tier[];
  showGifts: boolean;
  questions: { enabled: boolean; perRun: number; timeLimit: number };
  leaderboard: { enabled: boolean; board: string };
  /** 4 digits, stored as is: a 4-digit PIN has only 10,000 values, so hashing would add nothing. */
  pin: string;
}

/** Switches that change what the screens show (not the rules). */
export interface Features {
  showGifts: boolean;
  leaderboard: boolean;
}

type Difficulty = Pick<Settings, 'roundSeconds' | 'startSpeedKmh' | 'endSpeedKmh' | 'mode' | 'obstacles' | 'treats'>;
const DIFFICULTY_KEYS: ReadonlyArray<keyof Difficulty> = ['roundSeconds', 'startSpeedKmh', 'endSpeedKmh', 'mode', 'obstacles', 'treats'];

export const PRESETS: Record<Exclude<Preset, 'custom'>, Difficulty> = {
  easy: { roundSeconds: 38, startSpeedKmh: 40, endSpeedKmh: 50, mode: 'random', obstacles: 7, treats: 34 },
  normal: { roundSeconds: 38, startSpeedKmh: 50, endSpeedKmh: 63, mode: 'random', obstacles: 11, treats: 31 },
  hard: { roundSeconds: 38, startSpeedKmh: 58, endSpeedKmh: 76, mode: 'random', obstacles: 16, treats: 28 },
};

export const LIMITS = {
  roundSeconds: [20, 90],
  startSpeedKmh: [30, 90],
  endSpeedKmh: [30, 110],
  obstacles: [0, 40],
  treats: [5, 80],
  goodPoints: [1, 50],
  badPoints: [-50, -1],
  tierMin: [0, 999],
  perRun: [1, 5],
  timeLimit: [5, 15],
} as const;

const BOARD_RE = /^[a-z0-9-]{1,24}$/;
const PIN_RE = /^\d{4}$/;

export function defaultSettings(): Settings {
  return {
    version: 1,
    preset: 'normal',
    ...PRESETS.normal,
    points: Object.fromEntries(Object.entries(CONFIG.items).map(([k, v]) => [k, v.points])) as Record<ItemType, number>,
    tiers: CONFIG.tiers.map((t) => ({ ...t })),
    showGifts: false,
    questions: { enabled: true, perRun: CONFIG.questions.perRun, timeLimit: CONFIG.questions.timeLimit },
    leaderboard: { enabled: true, board: 'booth' },
    pin: '2468',
  };
}

export function featuresOf(s: Settings): Features {
  return { showGifts: s.showGifts, leaderboard: s.leaderboard.enabled };
}

export function applyPreset(s: Settings, preset: Exclude<Preset, 'custom'>): Settings {
  return { ...s, ...PRESETS[preset], preset };
}

/** The named preset whose difficulty values all match, otherwise 'custom'. */
export function detectPreset(s: Settings): Preset {
  for (const p of ['easy', 'normal', 'hard'] as const) {
    if (DIFFICULTY_KEYS.every((k) => s[k] === PRESETS[p][k])) return p;
  }
  return 'custom';
}

/** Shortest round (seconds) that fits `perRun` question slots at least 4 s apart inside the question window. */
export function minRoundSeconds(perRun: number): number {
  return 12 + 4 * Math.max(0, perRun - 1);
}

const clamp = (v: unknown, range: readonly [number, number], fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(range[1], Math.max(range[0], Math.round(v))) : fallback;

function sanitizeTiers(raw: unknown): Tier[] | null {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 6) return null;
  const tiers: Tier[] = [];
  for (const entry of raw) {
    const o = entry as Partial<Tier>;
    if (typeof o.name !== 'string' || !o.name.trim() || o.name.trim().length > 24) return null;
    if (typeof o.min !== 'number' || !Number.isFinite(o.min)) return null;
    tiers.push({ name: o.name.trim(), min: clamp(o.min, LIMITS.tierMin, 0) });
  }
  tiers[0].min = 0;
  for (let i = 1; i < tiers.length; i++) if (tiers[i].min <= tiers[i - 1].min) return null;
  return tiers;
}

/** Anything (stored JSON, a pasted code) → valid settings. Bad fields fall back to defaults; numbers are clamped. */
export function sanitize(raw: unknown): Settings {
  const d = defaultSettings();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  const rawPoints = (r.points && typeof r.points === 'object' ? r.points : {}) as Record<string, unknown>;
  const points = { ...d.points };
  for (const k of Object.keys(points) as ItemType[]) {
    points[k] = clamp(rawPoints[k], CONFIG.items[k].good ? LIMITS.goodPoints : LIMITS.badPoints, d.points[k]);
  }
  const q = (r.questions && typeof r.questions === 'object' ? r.questions : {}) as Record<string, unknown>;
  const lb = (r.leaderboard && typeof r.leaderboard === 'object' ? r.leaderboard : {}) as Record<string, unknown>;
  const start = clamp(r.startSpeedKmh, LIMITS.startSpeedKmh, d.startSpeedKmh);
  const s: Settings = {
    version: 1,
    preset: 'normal',
    roundSeconds: clamp(r.roundSeconds, LIMITS.roundSeconds, d.roundSeconds),
    startSpeedKmh: start,
    endSpeedKmh: Math.max(start, clamp(r.endSpeedKmh, LIMITS.endSpeedKmh, d.endSpeedKmh)),
    mode: r.mode === 'fixed' ? 'fixed' : 'random',
    obstacles: clamp(r.obstacles, LIMITS.obstacles, d.obstacles),
    treats: clamp(r.treats, LIMITS.treats, d.treats),
    points,
    tiers: sanitizeTiers(r.tiers) ?? d.tiers,
    showGifts: typeof r.showGifts === 'boolean' ? r.showGifts : d.showGifts,
    questions: {
      enabled: typeof q.enabled === 'boolean' ? q.enabled : d.questions.enabled,
      perRun: clamp(q.perRun, LIMITS.perRun, d.questions.perRun),
      timeLimit: clamp(q.timeLimit, LIMITS.timeLimit, d.questions.timeLimit),
    },
    leaderboard: {
      enabled: typeof lb.enabled === 'boolean' ? lb.enabled : d.leaderboard.enabled,
      board: typeof lb.board === 'string' && BOARD_RE.test(lb.board) ? lb.board : d.leaderboard.board,
    },
    pin: typeof r.pin === 'string' && PIN_RE.test(r.pin) ? r.pin : d.pin,
  };
  s.preset = detectPreset(s);
  return s;
}

/** Human-readable reasons the menu must not save these settings (empty = fine). */
export function validate(s: Settings): string[] {
  const problems: string[] = [];
  if (s.questions.enabled && s.roundSeconds < minRoundSeconds(s.questions.perRun)) {
    problems.push(`${s.questions.perRun} questions need a round of at least ${minRoundSeconds(s.questions.perRun)} s.`);
  }
  if (s.endSpeedKmh < s.startSpeedKmh) problems.push('End speed must be at least the start speed.');
  if (!PIN_RE.test(s.pin)) problems.push('The PIN must be exactly 4 digits.');
  if (!BOARD_RE.test(s.leaderboard.board)) problems.push('Board name: 1–24 lowercase letters, digits or "-".');
  const tiersOk =
    s.tiers.length >= 1 && s.tiers.length <= 6 && s.tiers[0].min === 0 &&
    s.tiers.every((t, i) => t.name.trim().length > 0 && t.name.trim().length <= 24 && Number.isInteger(t.min) && t.min <= LIMITS.tierMin[1] && (i === 0 || t.min > s.tiers[i - 1].min));
  if (!tiersOk) problems.push('Gift tiers need names and rising minimum scores, starting at 0.');
  return problems;
}

/** Settings → the config the rules run on. Always returns a playable config, even from unsaved/invalid input. */
export function buildConfig(s: Settings, base: GameConfig = CONFIG): GameConfig {
  const start = s.startSpeedKmh / 3.6;
  const end = Math.max(start, s.endSpeedKmh / 3.6);
  const runLength = Math.round((s.roundSeconds * (start + end)) / 2);
  const windowStart = 4;
  const windowEnd = Math.max(windowStart, s.roundSeconds - 8);
  let perRun = s.questions.enabled ? s.questions.perRun : 0;
  const minGap = perRun > 1 ? Math.max(4, Math.min(7, (windowEnd - windowStart) / (perRun - 1))) : 7;
  // Defensive: never ask scheduleSlots for more slots than fit (it throws), whatever got past validation.
  while (perRun > 1 && windowEnd - windowStart < (perRun - 1) * minGap) perRun--;
  const items = Object.fromEntries(
    Object.entries(base.items).map(([k, v]) => [k, { ...v, points: s.points[k as ItemType] ?? v.points }]),
  ) as GameConfig['items'];
  return {
    ...base,
    baseSpeed: start,
    speedRamp: end / start - 1,
    runLength,
    items,
    spawn: { firstAt: Math.round(start * 2.4), finishClear: Math.round(end * 2.4), obstacles: s.obstacles, treats: s.treats, mode: s.mode },
    questions: { ...base.questions, perRun, windowStart, windowEnd, minGap, timeLimit: s.questions.timeLimit },
    tiers: s.tiers.map((t) => ({ ...t })),
  };
}

const SHARE_PREFIX = 'VR1-';

function toBase64Url(text: string): string {
  let bin = '';
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code: string): string {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** A copy/paste code with every setting except the PIN. */
export function toShareCode(s: Settings): string {
  const copy: Partial<Settings> = { ...s };
  delete copy.pin;
  return SHARE_PREFIX + toBase64Url(JSON.stringify(copy));
}

/** Settings from a share code (keeping the current PIN), or null if the code is not valid. */
export function fromShareCode(code: string, current: Settings): Settings | null {
  const c = code.trim();
  if (!c.startsWith(SHARE_PREFIX)) return null;
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(c.slice(SHARE_PREFIX.length)));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return sanitize({ ...(parsed as object), pin: current.pin });
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/core/settings.test.ts && npx tsc --noEmit`
Expected: PASS. `VR1-NDI` decodes to `42`, which isn't an object, so it returns null. `VR1-!!!` makes `atob` throw, so it also returns null.

- [ ] **Step 5: Commit**

```bash
git add src/core/settings.ts tests/core/settings.test.ts
git commit -m "feat(core): settings model with presets, validation, buildConfig and share codes"
```


---

### Task 4: Saved settings, live reconfiguration, questions-off and gift switch in the game

**Files:**
- Create: `src/app/settingsStore.ts`
- Modify: `src/app/flow.ts`, `src/app/game.ts`, `src/ui/attract.ts`, `src/ui/howto.ts`, `src/ui/results.ts`, `src/ui/styles.css`, `src/main.ts` (constructor calls only)
- Test: `tests/app/settingsStore.test.ts` (new), `tests/app/flow.test.ts`, `tests/app/game.test.ts`, `tests/ui/attract.test.ts`, `tests/ui/results.test.ts`, `tests/ui/howto.test.ts` (new)

**Interfaces:**
- Consumes:
  - `Settings`, `Features`, `sanitize`, `buildConfig`, `defaultSettings`, `applyPreset` (Task 3)
  - `readJson`, `writeJson`, `safeLocalStorage` (`src/app/storage.ts`)
  - `tierIndex` (`src/core/scoring.ts`)
- Produces:
  - `SETTINGS_KEY = 'vienna-run:settings'`
  - `loadSettings(storage?): Settings`, `saveSettings(s, storage?): void`
  - `Flow.setConfig(cfg)`
  - `Game.configure(cfg, features)`, `Game.config` getter
  - `GameOptions.features?`, `GameOptions.giftUrl?`
  - `GameUi.attract.configure(cfg, features)`
  - `GameUi.howto.showHowto(questionsOn: boolean)`
  - `GameUi.results.show(info: ResultsInfo, onDone)`
  - `ResultsInfo = { score: number; gift: GiftInfo | null }`, `GiftInfo = { tiers: readonly Tier[]; index: number; url: string | null }` (exported from `src/ui/results.ts`)
  - `new AttractScreen(parent, icons, logoUrl)`

- [ ] **Step 1: Write the failing tests**

`tests/app/settingsStore.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { loadSettings, saveSettings, SETTINGS_KEY } from '../../src/app/settingsStore';
import { applyPreset, defaultSettings } from '../../src/core/settings';

const memory = (init: Record<string, string> = {}) => {
  const data = { ...init };
  return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; }, data };
};
const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); } };

describe('settings store', () => {
  it('round-trips saved settings', () => {
    const s = memory();
    const hard = applyPreset(defaultSettings(), 'hard');
    saveSettings(hard, s);
    expect(loadSettings(s)).toEqual(hard);
  });
  it('falls back to defaults when nothing, garbage or a broken storage is found', () => {
    expect(loadSettings(memory())).toEqual(defaultSettings());
    expect(loadSettings(memory({ [SETTINGS_KEY]: '{oops' }))).toEqual(defaultSettings());
    expect(loadSettings(broken)).toEqual(defaultSettings());
    expect(loadSettings(null)).toEqual(defaultSettings());
    expect(() => saveSettings(defaultSettings(), broken)).not.toThrow();
  });
  it('repairs a stored file with bad values instead of rejecting it', () => {
    const s = memory({ [SETTINGS_KEY]: JSON.stringify({ ...defaultSettings(), obstacles: 999, pin: 'abcd' }) });
    expect(loadSettings(s)).toMatchObject({ obstacles: 40, pin: '2468' });
  });
});
```

Add to `tests/app/flow.test.ts` inside `describe('Flow', …)`:
```ts
  it('uses new timings after setConfig', () => {
    const { flow, answered, tick } = setup();
    flow.setConfig({ ...CONFIG, questions: { ...CONFIG.questions, timeLimit: 5 } });
    flow.press();
    tick(6.1);
    flow.questionAsked();
    tick(5);
    expect(answered).toHaveBeenCalledExactlyOnceWith(false);
  });
```

`tests/ui/howto.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { HowtoScreen } from '../../src/ui/howto';

const visibleSteps = (s: HowtoScreen) => [...s.root.querySelectorAll('li')].filter((li) => !li.hidden);

describe('HowtoScreen', () => {
  it('explains bonus questions only when they are switched on', () => {
    const s = new HowtoScreen(document.body);
    s.showHowto(true);
    expect(visibleSteps(s)).toHaveLength(3);
    s.showHowto(false);
    expect(visibleSteps(s)).toHaveLength(2);
    expect(visibleSteps(s).map((li) => li.textContent).join(' ')).not.toMatch(/question/i);
  });
});
```

Replace `tests/ui/attract.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { AttractScreen } from '../../src/ui/attract';

const icons = { sacher: 'a.png', kipferl: 'b.png', melange: 'c.png', mozart: 'd.png', krampus: 'e.png', bomb: 'f.png' };
const noGifts = { showGifts: false, leaderboard: false };

describe('AttractScreen', () => {
  it('lists every item with its points', () => {
    const s = new AttractScreen(document.body, icons, null);
    s.configure(CONFIG, noGifts);
    const text = s.root.textContent ?? '';
    expect(text).toContain('Tap anywhere to play');
    expect(text).toContain('Sachertorte');
    expect(text).toContain('+15');
    expect(text).toContain('−10');
    expect(s.root.querySelectorAll('.legend img')).toHaveLength(6);
  });
  it('shows the points from the current settings', () => {
    const s = new AttractScreen(document.body, icons, null);
    s.configure(CONFIG, noGifts);
    s.configure({ ...CONFIG, items: { ...CONFIG.items, sacher: { points: 25, good: true } } }, noGifts);
    expect(s.root.textContent).toContain('+25');
    expect(s.root.querySelectorAll('.legend li')).toHaveLength(6);
  });
  it('does not mention gifts while they are switched off', () => {
    const s = new AttractScreen(document.body, icons, null);
    s.configure(CONFIG, noGifts);
    const text = (s.root.textContent ?? '').toLowerCase();
    for (const t of CONFIG.tiers) expect(text).not.toContain(t.name.toLowerCase());
    expect(text).not.toMatch(/prize|gift/);
  });
  it('shows the gift ladder when gifts are switched on', () => {
    const s = new AttractScreen(document.body, icons, null);
    s.configure(CONFIG, { showGifts: true, leaderboard: false });
    const ladder = s.root.querySelector('.ladder');
    expect(ladder?.hasAttribute('hidden')).toBe(false);
    expect(ladder?.textContent).toContain('80+');
    expect(ladder?.textContent).toContain(CONFIG.tiers[1].name);
  });
  it('uses the logo image when one is provided', () => {
    const s = new AttractScreen(document.body, icons, 'logo.svg');
    expect(s.root.querySelector('img.logo')?.getAttribute('src')).toBe('logo.svg');
  });
});
```

Replace the first test of `tests/ui/results.test.ts` (`'shows the score and nothing about gifts'`) with these two, and change `s.show(50, done)` in the hold test to `s.show({ score: 50, gift: null }, done)`. Add `import { CONFIG } from '../../src/config';`.
```ts
  it('shows the score and nothing about gifts while gifts are switched off', () => {
    const s = new ResultsScreen(document.body, 1000);
    s.show({ score: 105, gift: null }, () => undefined);
    expect(s.root.querySelector('.r-score')?.textContent).toBe('105');
    expect((s.root.textContent ?? '').toLowerCase()).not.toMatch(/prize|gift/);
    expect(s.root.querySelector('.ladder, .r-tier, .r-gift')).toBeNull();
  });

  it('shows the prize and the ladder, with the reached tier marked, when gifts are on', () => {
    const s = new ResultsScreen(document.body, 1000);
    s.show({ score: 105, gift: { tiers: CONFIG.tiers, index: 2, url: 'gift-2.png' } }, () => undefined);
    expect(s.root.querySelector('.r-tier')?.textContent).toBe(CONFIG.tiers[2].name);
    expect(s.root.querySelector('img.r-gift')?.getAttribute('src')).toBe('gift-2.png');
    expect(s.root.querySelector('.ladder li.on')?.textContent).toContain(CONFIG.tiers[2].name);
    s.show({ score: 10, gift: null }, () => undefined);
    expect(s.root.querySelector('.ladder')).toBeNull();
  });
```

In `tests/app/game.test.ts`:
- add imports: `import { applyPreset, buildConfig, defaultSettings } from '../../src/core/settings';` and `import type { ResultsInfo } from '../../src/ui/results';`
- in `fakes()`, change the attract line to `attract: { show: vi.fn(), hide: vi.fn(), configure: vi.fn() },`
- add these tests inside `describe('Game', …)`:
```ts
  it('asks no questions and drops the bonus line when questions are off', () => {
    const { world, ui } = fakes();
    const cfg = buildConfig({ ...defaultSettings(), questions: { enabled: false, perRun: 3, timeLimit: 10 } });
    const game = new Game({ cfg, bank, world, ui, seed: 3, autoplay: true });
    clock(game).run(120);
    expect(game.cycles).toBeGreaterThanOrEqual(1);
    expect(ui.question.show).not.toHaveBeenCalled();
    expect(ui.howto.showHowto).toHaveBeenCalledWith(false);
  });

  it('restarts the start-screen demo with new settings at once', () => {
    const { world, ui } = fakes();
    const game = new Game({ cfg: CONFIG, bank, world, ui, seed: 5 });
    const hard = buildConfig(applyPreset(defaultSettings(), 'hard'));
    const features = { showGifts: true, leaderboard: false };
    game.configure(hard, features);
    expect(game.run.cfg).toBe(hard);
    expect(game.config).toBe(hard);
    expect(ui.attract.configure).toHaveBeenLastCalledWith(hard, features);
  });

  it('never changes the rules of a round in progress', () => {
    const { world, ui } = fakes();
    const game = new Game({ cfg: CONFIG, bank, world, ui, seed: 5 });
    const hard = buildConfig(applyPreset(defaultSettings(), 'hard'));
    game.press();
    clock(game).run(10);
    expect(['run', 'question', 'feedback']).toContain(game.flow.screen);
    game.configure(hard, { showGifts: false, leaderboard: false });
    expect(game.run.cfg).toBe(CONFIG);
    clock(game).run(200);
    expect(game.flow.screen).toBe('attract');
    expect(game.run.cfg).toBe(hard);
  });

  it('passes the gift ladder to the results only when gifts are switched on', () => {
    const off = fakes();
    const gameOff = new Game({ cfg: CONFIG, bank, world: off.world, ui: off.ui, seed: 3, autoplay: true });
    clock(gameOff).run(120);
    const infoOff = (off.ui.results.show as ReturnType<typeof vi.fn>).mock.calls[0][0] as ResultsInfo;
    expect(infoOff.gift).toBeNull();

    const on = fakes();
    const gameOn = new Game({ cfg: CONFIG, bank, world: on.world, ui: on.ui, seed: 3, autoplay: true, features: { showGifts: true, leaderboard: false }, giftUrl: (t) => `gift-${t}.png` });
    clock(gameOn).run(120);
    const infoOn = (on.ui.results.show as ReturnType<typeof vi.fn>).mock.calls[0][0] as ResultsInfo;
    expect(infoOn.gift?.tiers).toBe(CONFIG.tiers);
    expect(infoOn.gift?.url).toBe(`gift-${infoOn.gift?.index}.png`);
    expect(infoOn.score).toBeGreaterThanOrEqual(0);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/app tests/ui`
Expected: FAIL.
- `settingsStore` can't be resolved.
- `flow.setConfig is not a function`.
- `AttractScreen.configure` and `game.configure` are missing.
- The results tests fail because `show` still takes a number.

- [ ] **Step 3: Write `src/app/settingsStore.ts`**

```ts
import { sanitize, type Settings } from '../core/settings';
import { readJson, safeLocalStorage, writeJson } from './storage';

export const SETTINGS_KEY = 'vienna-run:settings';

/** This device's saved settings, repaired if needed; defaults when nothing usable is stored. */
export function loadSettings(storage: Pick<Storage, 'getItem'> | null = safeLocalStorage()): Settings {
  return sanitize(readJson<unknown>(SETTINGS_KEY, null, undefined, storage));
}

export function saveSettings(s: Settings, storage: Pick<Storage, 'setItem'> | null = safeLocalStorage()): void {
  writeJson(SETTINGS_KEY, s, storage);
}
```

- [ ] **Step 4: Let `Flow` take new timings** (edit `src/app/flow.ts`)

Replace
```ts
  constructor(private readonly cfg: GameConfig, private readonly hooks: FlowHooks) {}
```
with
```ts
  constructor(private cfg: GameConfig, private readonly hooks: FlowHooks) {}

  /** New timings from the settings menu (the game only calls this on the start screen). */
  setConfig(cfg: GameConfig): void {
    this.cfg = cfg;
  }
```

- [ ] **Step 5: Teach the screens the new switches**

Replace `src/ui/attract.ts`:
```ts
import type { GameConfig } from '../config';
import type { Features } from '../core/settings';
import { BAD_TYPES, GOOD_TYPES, type ItemType } from '../core/types';
import { el } from './dom';
import { formatPoints, ITEM_LABELS } from './labels';

export class AttractScreen {
  readonly root = el('div', 'screen attract');
  private legend = el('ul', 'legend');
  private ladder = el('ol', 'ladder');

  constructor(parent: HTMLElement, private readonly icons: Record<ItemType, string>, logoUrl: string | null) {
    const card = el('div', 'paper-card attract-card');
    if (logoUrl) {
      const logo = el('img', 'logo');
      logo.src = logoUrl;
      logo.alt = 'Vienna Run';
      card.append(logo);
    } else {
      card.append(el('h1', '', 'Vienna Run'));
    }
    card.append(el('p', 'tagline', 'Race the waiter from Stephansdom to the Riesenrad. Grab Viennese treats and dodge Krampus and the bombs.'));
    this.ladder.hidden = true;
    card.append(this.legend, this.ladder, el('p', 'cta', 'Tap anywhere to play'));
    this.root.append(card);
    this.root.hidden = true;
    parent.append(this.root);
  }

  /** Point values, and the gift ladder when gifts are switched on, from the current settings. */
  configure(cfg: GameConfig, features: Features): void {
    this.legend.replaceChildren(
      ...[...GOOD_TYPES, ...BAD_TYPES].map((type) => {
        const li = el('li', cfg.items[type].good ? '' : 'bad');
        const img = el('img');
        img.src = this.icons[type];
        img.alt = '';
        li.append(img, el('span', '', ITEM_LABELS[type]), el('b', '', formatPoints(cfg.items[type].points)));
        return li;
      }),
    );
    this.ladder.replaceChildren(
      ...(features.showGifts ? cfg.tiers : []).map((t) => {
        const li = el('li');
        li.append(el('b', '', `${t.min}+`), el('span', '', t.name));
        return li;
      }),
    );
    this.ladder.hidden = !features.showGifts;
  }

  show(): void {
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }
}
```

In `src/ui/howto.ts`:
- add the field `  private bonus = el('li', '', 'Some treats hide a bonus question. Answer right for double points.');` below `private count = …`
- replace the constructor's step loop with:
```ts
    const steps = el('ol');
    steps.append(
      el('li', '', 'Tap the left or right side of the screen to switch lanes.'),
      el('li', '', 'Grab the treats. Dodge Krampus and the bombs.'),
      this.bonus,
    );
```
- replace `  showHowto(): void {` with:
```ts
  /** The rules card; the bonus-question line only shows when questions are switched on. */
  showHowto(questionsOn: boolean): void {
    this.bonus.hidden = !questionsOn;
```

Replace `src/ui/results.ts`:
```ts
import type { Tier } from '../config';
import { el } from './dom';

export interface GiftInfo {
  tiers: readonly Tier[];
  /** The tier this score reached. */
  index: number;
  /** Designer gift card image, or null. */
  url: string | null;
}

export interface ResultsInfo {
  score: number;
  /** Null while gifts are switched off. */
  gift: GiftInfo | null;
}

/** End of a round: the score, the prize when gifts are on, and a hold-to-reset button for staff. */
export class ResultsScreen {
  readonly root = el('div', 'screen results');
  private score = el('b', 'r-score');
  private thanks = el('p', 'r-thanks', 'Thanks for playing!');
  private giftBox = el('div', 'r-giftbox');
  private hold = el('button', 'r-hold');
  private holdFill = el('i');
  private holdTimer = 0;
  private onDone: (() => void) | null = null;

  constructor(parent: HTMLElement, private readonly holdMs: number) {
    const card = el('div', 'paper-card results-card');
    const scoreBox = el('div', 'r-scorebox');
    scoreBox.append(el('span', 'lbl', 'Your score'), this.score);
    card.append(scoreBox, this.thanks, this.giftBox);
    this.hold.type = 'button';
    this.hold.append(this.holdFill, el('span', '', 'Hold for next player'));
    const start = (e: Event) => {
      e.preventDefault();
      this.startHold();
    };
    const cancel = () => this.cancelHold();
    this.hold.addEventListener('pointerdown', start);
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) this.hold.addEventListener(ev, cancel);
    this.hold.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') this.startHold();
    });
    this.hold.addEventListener('keyup', cancel);
    this.root.append(card, this.hold);
    this.root.dataset.ui = '';
    this.root.hidden = true;
    parent.append(this.root);
  }

  show(info: ResultsInfo, onDone: () => void): void {
    this.score.textContent = String(info.score);
    this.showGift(info.gift);
    this.cancelHold();
    this.onDone = onDone;
    this.root.hidden = false;
  }

  hide(): void {
    this.cancelHold();
    this.onDone = null;
    this.root.hidden = true;
  }

  private showGift(g: GiftInfo | null): void {
    this.thanks.hidden = g !== null;
    this.giftBox.hidden = g === null;
    if (!g) {
      this.giftBox.replaceChildren();
      return;
    }
    const parts: HTMLElement[] = [el('p', 'lbl', 'Your prize'), el('h2', 'r-tier', g.tiers[g.index].name)];
    if (g.url) {
      const img = el('img', 'r-gift');
      img.src = g.url;
      img.alt = '';
      parts.push(img);
    }
    const ladder = el('ol', 'ladder r-ladder');
    g.tiers.forEach((t, i) => {
      const li = el('li', i === g.index ? 'on' : i < g.index ? 'passed' : '');
      li.append(el('b', '', `${t.min}+`), el('span', '', t.name));
      ladder.append(li);
    });
    parts.push(ladder);
    this.giftBox.replaceChildren(...parts);
  }

  private startHold(): void {
    if (!this.onDone || this.holdTimer) return;
    this.holdFill.style.transitionDuration = `${this.holdMs}ms`;
    this.hold.classList.add('holding');
    this.holdTimer = window.setTimeout(() => {
      this.holdTimer = 0;
      this.hold.classList.remove('holding');
      const cb = this.onDone;
      this.onDone = null;
      cb?.();
    }, this.holdMs);
  }

  private cancelHold(): void {
    if (this.holdTimer) window.clearTimeout(this.holdTimer);
    this.holdTimer = 0;
    this.hold.classList.remove('holding');
  }
}
```

In `src/ui/styles.css`, insert after `.legend .bad b { color: #b3262d; }`:
```css
.ladder { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 1.2cqmin; font-size: 2.2cqmin; }
.ladder li { background: var(--paper-2); padding: 0.8cqmin 1.6cqmin; border-radius: 0.5cqmin; display: flex; gap: 0.8cqmin; align-items: baseline; }
.ladder b { font-family: var(--font-display); font-weight: 400; font-size: 2.8cqmin; }
```
and after `.r-score { … }`:
```css
.r-giftbox { display: grid; justify-items: center; gap: 1.2cqmin; }
.r-tier { margin: 0; font-family: var(--font-display); font-weight: 400; font-size: 8cqmin; color: var(--red); }
.r-gift { width: 22cqmin; height: 22cqmin; object-fit: contain; }
.r-ladder li.on { background: var(--red); color: #fff; }
.r-ladder li.passed { opacity: 0.6; }
```

- [ ] **Step 6: Let the game take new settings** (edit `src/app/game.ts`)

1. Replace the import block's first line and add three imports:
```ts
import type { GameConfig } from '../config';
import { Bot, BOT_SKILLS } from '../core/bot';
import { pickQuestions, updateRecent } from '../core/questions';
import { createRng, randomSeed } from '../core/rng';
import { Run } from '../core/run';
import { tierIndex } from '../core/scoring';
import type { Features } from '../core/settings';
import type { Question, RunEvent } from '../core/types';
import { formatPoints } from '../ui/labels';
import type { GiftInfo, ResultsInfo } from '../ui/results';
```
2. In `interface GameUi`, change the attract, howto and results lines to:
```ts
  attract: { show(): void; hide(): void; configure(cfg: GameConfig, features: Features): void };
  howto: { showHowto(questionsOn: boolean): void; showCount(n: number): void; hide(): void };
```
```ts
  results: { show(info: ResultsInfo, onDone: () => void): void; hide(): void };
```
3. In `interface GameOptions`, add after `ui: GameUi;`:
```ts
  /** What the screens show (gift ladder, leaderboard); both off unless given. */
  features?: Features;
  /** Designer gift card image for a tier, if there is one. */
  giftUrl?: (tier: number) => string | null;
```
4. In `class Game`, add these fields after `cycles = 0;`:
```ts
  private cfg: GameConfig;
  private features: Features;
  /** Settings saved while a round was running; applied when the booth is back on the start screen. */
  private next: { cfg: GameConfig; features: Features } | null = null;
```
5. Replace the constructor with:
```ts
  constructor(private readonly o: GameOptions) {
    this.cfg = o.cfg;
    this.features = o.features ?? { showGifts: false, leaderboard: false };
    this.seed = o.seed ?? randomSeed();
    o.ui.attract.configure(this.cfg, this.features);
    this.run = this.newRun();
    this.flow = new Flow(this.cfg, { enter: (s, prev) => this.enter(s, prev), answered: (c) => this.answered(c) });
    this.flow.start();
  }

  /** The rules in use right now. */
  get config(): GameConfig {
    return this.cfg;
  }

  /**
   * New settings from the staff menu. On the start screen they apply at once (the demo restarts with them);
   * otherwise when the booth next reaches the start screen. A round in progress never changes.
   */
  configure(cfg: GameConfig, features: Features): void {
    this.next = { cfg, features };
    if (this.flow.screen === 'attract') {
      this.applyNext();
      this.startDemo();
    }
  }
```
6. Add this method after `press()`:
```ts
  private applyNext(): void {
    if (!this.next) return;
    this.cfg = this.next.cfg;
    this.features = this.next.features;
    this.next = null;
    this.flow.setConfig(this.cfg);
    this.o.ui.attract.configure(this.cfg, this.features);
  }
```
7. Replace every `this.o.cfg` with `this.cfg`. The destructurings `const { ui, cfg } = this.o;` in `update` and `enter` become:
```ts
    const { ui } = this.o;
    const cfg = this.cfg;
```
8. In `newRun()`, `config: this.o.cfg` becomes `config: this.cfg`.
9. In `enter`, `case 'attract':` add `this.applyNext();` right after `ui.fx.clear();`.
10. In `case 'howto':`, change `ui.howto.showHowto();` to `ui.howto.showHowto(cfg.questions.perRun > 0);`.
11. Replace the `case 'results':` block with:
```ts
      case 'results': {
        ui.hud.show(false);
        const score = this.run.score;
        let gift: GiftInfo | null = null;
        if (this.features.showGifts) {
          const index = tierIndex(score, cfg.tiers);
          gift = { tiers: cfg.tiers, index, url: this.o.giftUrl?.(index) ?? null };
        }
        ui.results.show({ score, gift }, () => this.flow.nextPlayer());
        break;
      }
```

- [ ] **Step 7: Keep `main.ts` compiling** (behaviour unchanged until Task 6)

In `src/main.ts`, change `attract: new AttractScreen(stage, CONFIG, icons, art.url('logo')),` to `attract: new AttractScreen(stage, icons, art.url('logo')),`.

- [ ] **Step 8: Run the tests and the type check**

Run: `npm test && npx tsc --noEmit`
Expected: PASS everywhere, with no type errors.

- [ ] **Step 9: Commit**

```bash
git add src/app/settingsStore.ts src/app/flow.ts src/app/game.ts src/ui/attract.ts src/ui/howto.ts src/ui/results.ts src/ui/styles.css src/main.ts tests/app/settingsStore.test.ts tests/app/flow.test.ts tests/app/game.test.ts tests/ui/attract.test.ts tests/ui/results.test.ts tests/ui/howto.test.ts
git commit -m "feat(app): settings storage, live reconfiguration, questions-off and gift switch"
```

---

### Task 5: Staff screens (corner hold, PIN pad, settings panel) and typing isolation

**Files:**
- Create: `src/ui/staff/fields.ts`, `src/ui/staff/cornerHold.ts`, `src/ui/staff/pinPad.ts`, `src/ui/staff/settingsPanel.ts`, `src/ui/staff.css`
- Modify: `src/input/touch.ts`, `src/app/kiosk.ts`, `src/ui/styles.css`
- Test: `tests/ui/staff/cornerHold.test.ts`, `tests/ui/staff/pinPad.test.ts`, `tests/ui/staff/settingsPanel.test.ts`, `tests/input/touch.test.ts`, `tests/app/kiosk.test.ts`

**Interfaces:**
- Consumes:
  - `Settings`, `LIMITS`, `applyPreset`, `defaultSettings`, `detectPreset`, `sanitize`, `validate`, `toShareCode`, `fromShareCode` (Task 3)
  - `ITEM_LABELS` (`src/ui/labels.ts`)
  - `el` (`src/ui/dom.ts`)
- Produces:
  - `attachCornerHold(parent, ms, onTrigger): HTMLElement`
  - `class PinPad { open(req: PinRequest); isOpen }`, with `PinRequest = { check(pin): boolean; onSuccess(); onCancel() }`
  - `class SettingsPanel { constructor(parent, PanelOptions); open(current: Settings); close(); isOpen }`
  - `PanelOptions = { sections?: Section[]; onSave(s): void; onClose(): void }`
  - `Section = { title: string; render(ctx: PanelContext): HTMLElement }`
  - `PanelContext = { readonly draft: Settings; edit(change, rerender?): void; notice(text): void }`
  - field helpers `button`, `row`, `numberField`, `toggle`, `choice`, `textField`, `note`

- [ ] **Step 1: Write the failing tests**

`tests/ui/staff/cornerHold.test.ts`:
```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachCornerHold } from '../../../src/ui/staff/cornerHold';

const fire = (el: Element, type: string) => el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));

describe('attachCornerHold', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('opens only after a full hold', () => {
    const onTrigger = vi.fn();
    const zone = attachCornerHold(document.body, 3000, onTrigger);
    fire(zone, 'pointerdown');
    vi.advanceTimersByTime(2000);
    fire(zone, 'pointerup');
    vi.advanceTimersByTime(5000);
    expect(onTrigger).not.toHaveBeenCalled();
    fire(zone, 'pointerdown');
    vi.advanceTimersByTime(3000);
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });
  it('is invisible interface, so a press there never starts a game', () => {
    const zone = attachCornerHold(document.body, 3000, () => undefined);
    expect(zone.dataset.ui).toBe('');
    expect(zone.textContent).toBe('');
  });
});
```

`tests/ui/staff/pinPad.test.ts`:
```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PinPad } from '../../../src/ui/staff/pinPad';

const key = (pad: PinPad, label: string) => {
  const b = [...pad.root.querySelectorAll('button')].find((x) => x.textContent === label);
  if (!b) throw new Error(`no key ${label}`);
  b.click();
};
const enter = (pad: PinPad, pin: string) => { for (const d of pin) key(pad, d); };

function setup() {
  const pad = new PinPad(document.body);
  const req = { check: (pin: string) => pin === '2468', onSuccess: vi.fn(), onCancel: vi.fn() };
  pad.open(req);
  return { pad, req };
}

describe('PinPad', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('opens settings on the right PIN', () => {
    const { pad, req } = setup();
    enter(pad, '2468');
    expect(req.onSuccess).toHaveBeenCalledTimes(1);
    expect(pad.isOpen).toBe(false);
  });
  it('clears a wrong PIN and gives up after three tries', () => {
    const { pad, req } = setup();
    enter(pad, '1111');
    expect(pad.isOpen).toBe(true);
    expect(pad.root.querySelectorAll('.pin-dots i.on')).toHaveLength(0);
    enter(pad, '2222');
    enter(pad, '3333');
    expect(req.onCancel).toHaveBeenCalledTimes(1);
    expect(req.onSuccess).not.toHaveBeenCalled();
    expect(pad.isOpen).toBe(false);
  });
  it('closes by itself after 20 seconds without input', () => {
    const { pad, req } = setup();
    key(pad, '2');
    vi.advanceTimersByTime(19_000);
    expect(pad.isOpen).toBe(true);
    vi.advanceTimersByTime(1_500);
    expect(req.onCancel).toHaveBeenCalledTimes(1);
    expect(pad.isOpen).toBe(false);
  });
  it('works with a keyboard, including delete and escape', () => {
    const { pad, req } = setup();
    for (const k of ['2', '4', '9', 'Backspace', '6', '8']) window.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
    expect(req.onSuccess).toHaveBeenCalledTimes(1);
    pad.open(req);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(req.onCancel).toHaveBeenCalledTimes(1);
  });
});
```

`tests/ui/staff/settingsPanel.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { applyPreset, defaultSettings, toShareCode, type Settings } from '../../../src/core/settings';
import { el } from '../../../src/ui/dom';
import { SettingsPanel, type Section } from '../../../src/ui/staff/settingsPanel';

const buttonNamed = (root: ParentNode, name: string) => {
  const b = [...root.querySelectorAll('button')].find((x) => x.textContent === name || x.getAttribute('aria-label') === name);
  if (!b) throw new Error(`no button "${name}"`);
  return b;
};
const click = (root: ParentNode, name: string) => buttonNamed(root, name).click();
const field = (root: ParentNode, label: string) => {
  const f = root.querySelector<HTMLInputElement>(`[aria-label="${label}"]`);
  if (!f) throw new Error(`no field "${label}"`);
  return f;
};
const type = (f: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  f.value = value;
  f.dispatchEvent(new Event('input', { bubbles: true }));
  f.dispatchEvent(new Event('change', { bubbles: true }));
};

function setup(current: Settings = defaultSettings(), sections?: Section[]) {
  const onSave = vi.fn<(s: Settings) => void>();
  const onClose = vi.fn();
  const panel = new SettingsPanel(document.body, { onSave, onClose, sections });
  panel.open(current);
  return { panel, root: panel.root, onSave, onClose };
}

describe('SettingsPanel', () => {
  it('opens on the current settings with the preset marked', () => {
    const { root, panel } = setup();
    expect(panel.isOpen).toBe(true);
    expect(root.querySelector('[data-preset="normal"]')?.classList.contains('on')).toBe(true);
    expect(field(root, 'Obstacles per round').value).toBe('11');
  });
  it('fills every difficulty value from a preset and saves it', () => {
    const { root, onSave, onClose } = setup();
    click(root, 'Hard');
    expect(field(root, 'Obstacles per round').value).toBe('16');
    click(root, 'Save');
    expect(onSave).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ preset: 'hard', startSpeedKmh: 58, endSpeedKmh: 76, obstacles: 16 }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(root.hidden).toBe(true);
  });
  it('marks the difficulty Custom as soon as one value changes', () => {
    const { root } = setup();
    type(field(root, 'Obstacles per round'), '13');
    expect(root.querySelector('[data-preset="custom"]')?.classList.contains('on')).toBe(true);
    expect(root.querySelector('[data-preset="normal"]')?.classList.contains('on')).toBe(false);
  });
  it('keeps typed numbers inside their range', () => {
    const { root } = setup();
    const treats = field(root, 'Treats per round');
    type(treats, '500');
    expect(treats.value).toBe('80');
    click(root, 'Treats per round up');
    expect(treats.value).toBe('80');
  });
  it('refuses to save settings that cannot work, and says why', () => {
    const { root, onSave } = setup();
    type(field(root, 'Round length'), '20');
    type(field(root, 'Questions per round'), '5');
    expect(buttonNamed(root, 'Save').disabled).toBe(true);
    expect(root.textContent).toContain('5 questions need a round of at least 28 s.');
    buttonNamed(root, 'Save').click();
    expect(onSave).not.toHaveBeenCalled();
  });
  it('switches bonus questions off', () => {
    const { root, onSave } = setup();
    click(root, 'Bonus questions');
    click(root, 'Save');
    expect(onSave.mock.calls[0][0].questions.enabled).toBe(false);
  });
  it('edits the gift ladder', () => {
    const { root, onSave } = setup();
    click(root, 'Show gifts to players');
    click(root, 'Add gift tier');
    type(field(root, 'Gift 5 name'), 'Teddy bear');
    type(field(root, 'Gift 5 minimum score'), '200');
    click(root, 'Save');
    const saved = onSave.mock.calls[0][0];
    expect(saved.showGifts).toBe(true);
    expect(saved.tiers.at(-1)).toEqual({ name: 'Teddy bear', min: 200 });
  });
  it('Cancel throws the edits away', () => {
    const { root, onSave, onClose } = setup();
    click(root, 'Hard');
    click(root, 'Cancel');
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('Reset to defaults keeps the PIN and the board name', () => {
    const { root, onSave } = setup({ ...applyPreset(defaultSettings(), 'hard'), pin: '1357', leaderboard: { enabled: true, board: 'booth-2' } });
    click(root, 'Reset to defaults');
    click(root, 'Save');
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ preset: 'normal', pin: '1357', leaderboard: { enabled: true, board: 'booth-2' } }));
  });
  it('loads a share code, and rejects a bad one without changing anything', () => {
    const { root } = setup();
    type(field(root, 'Share code to load'), 'nonsense');
    click(root, 'Load code');
    expect(root.textContent).toContain('That code is not valid');
    expect(field(root, 'Obstacles per round').value).toBe('11');
    type(field(root, 'Share code to load'), toShareCode({ ...defaultSettings(), obstacles: 25 }));
    click(root, 'Load code');
    expect(field(root, 'Obstacles per round').value).toBe('25');
  });
  it('shows a copyable code for this setup', () => {
    const { root } = setup();
    click(root, 'Copy code');
    expect(field(root, 'Share code for this device').value.startsWith('VR1-')).toBe(true);
  });
  it('shows extra sections', () => {
    const extra: Section = { title: 'Leaderboard', render: () => el('p', '', 'board controls') };
    const { root } = setup(defaultSettings(), [extra]);
    expect(root.textContent).toContain('board controls');
  });
});
```

Add to `tests/input/touch.test.ts` inside `describe('attachInput', …)`:
```ts
  it('ignores keys typed into a text field or aimed at a button', () => {
    const field = document.createElement('input');
    const button = document.createElement('button');
    document.body.append(field, button);
    for (const target of [field, button]) {
      for (const key of ['a', 'd', ' ', 'Enter', 'ArrowLeft']) target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    }
    expect(onLane).not.toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();
    field.remove();
    button.remove();
  });
```

Add to `tests/app/kiosk.test.ts` inside `describe('installKiosk', …)`:
```ts
  it('lets people select and paste inside text fields only', () => {
    const field = document.createElement('input');
    document.body.append(field);
    const inField = new Event('selectstart', { bubbles: true, cancelable: true });
    field.dispatchEvent(inField);
    expect(inField.defaultPrevented).toBe(false);
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    field.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(false);
    const outside = new Event('selectstart', { bubbles: true, cancelable: true });
    document.body.dispatchEvent(outside);
    expect(outside.defaultPrevented).toBe(true);
    field.remove();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/ui/staff tests/input tests/app/kiosk.test.ts`
Expected: FAIL.
- The staff modules can't be resolved.
- The new touch test sees `onLane` called.
- The new kiosk test sees `defaultPrevented` true inside the field.

- [ ] **Step 3: Isolate typing from game input**

In `src/input/touch.ts`, add above `export function attachInput`:
```ts
/** Keys typed into a field or aimed at an on-screen control (name entry, settings, PIN) are not game input. */
const isControl = (t: EventTarget | null): boolean =>
  t instanceof Element && t.closest('input, textarea, select, button, [contenteditable="true"], [data-ui]') !== null;
```
and change the first line of `onKey` from `if (e.repeat) return;` to:
```ts
    if (e.repeat || isControl(e.target)) return;
```

Replace `src/app/kiosk.ts`:
```ts
const isField = (t: EventTarget | null): boolean => t instanceof Element && t.closest('input, textarea') !== null;

/** Stops the browser from doing browser things on a public touchscreen (zoom, menus, selection, drag). */
export function installKiosk(doc: Document, opts: { hideCursor: boolean }): void {
  const block = (e: Event) => e.preventDefault();
  // Text fields (name entry, staff settings) still need selection and the paste menu.
  const blockOutsideFields = (e: Event) => {
    if (!isField(e.target)) e.preventDefault();
  };
  for (const type of ['contextmenu', 'selectstart']) doc.addEventListener(type, blockOutsideFields);
  for (const type of ['dragstart', 'gesturestart']) doc.addEventListener(type, block);
  doc.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  doc.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault();
  });
  doc.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  if (opts.hideCursor) doc.body.classList.add('hide-cursor');
}
```

In `src/ui/styles.css`, add after the `body { … }` rule:
```css
input, textarea { user-select: text; -webkit-user-select: text; touch-action: manipulation; }
```

- [ ] **Step 4: Write the staff screens**

`src/ui/staff/fields.ts`:
```ts
import { el } from '../dom';

export function button(label: string, onClick: () => void, cls = 'st-btn'): HTMLButtonElement {
  const b = el('button', cls, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

/** One settings line: the name on the left, its controls on the right. */
export function row(label: string, ...controls: HTMLElement[]): HTMLElement {
  const r = el('div', 'st-row');
  const box = el('div', 'st-controls');
  box.append(...controls);
  r.append(el('span', 'st-label', label), box);
  return r;
}

export function note(text: string): HTMLElement {
  return el('p', 'st-note', text);
}

/** A whole-number field with − and + buttons for touch. Typed values are clamped into range when the field is left. */
export function numberField(label: string, value: number, range: readonly [number, number], onChange: (v: number) => void, unit = ''): HTMLElement {
  const input = el('input', 'st-num');
  input.type = 'number';
  input.inputMode = 'numeric';
  input.min = String(range[0]);
  input.max = String(range[1]);
  input.step = '1';
  input.value = String(value);
  input.setAttribute('aria-label', label);
  const commit = (v: number) => {
    const c = Math.min(range[1], Math.max(range[0], Math.round(Number.isFinite(v) ? v : range[0])));
    input.value = String(c);
    onChange(c);
  };
  input.addEventListener('input', () => {
    const v = Number(input.value);
    if (input.value.trim() !== '' && Number.isInteger(v) && v >= range[0] && v <= range[1]) onChange(v);
  });
  input.addEventListener('change', () => commit(Number(input.value)));
  const down = button('−', () => commit(Number(input.value) - 1), 'st-step');
  down.setAttribute('aria-label', `${label} down`);
  const up = button('+', () => commit(Number(input.value) + 1), 'st-step');
  up.setAttribute('aria-label', `${label} up`);
  return row(label, down, input, up, el('span', 'st-unit', unit));
}

export function toggle(label: string, value: boolean, onChange: (v: boolean) => void): HTMLElement {
  const b = el('button', 'st-toggle');
  b.type = 'button';
  b.setAttribute('aria-label', label);
  let on = value;
  const paint = () => {
    b.textContent = on ? 'On' : 'Off';
    b.setAttribute('aria-pressed', String(on));
    b.classList.toggle('on', on);
  };
  paint();
  b.addEventListener('click', () => {
    on = !on;
    paint();
    onChange(on);
  });
  return row(label, b);
}

export function choice<T extends string>(label: string, options: ReadonlyArray<{ value: T; label: string }>, value: T, onChange: (v: T) => void): HTMLElement {
  const box = el('div', 'st-choice');
  const buttons: HTMLButtonElement[] = [];
  for (const o of options) {
    const b = button(o.label, () => {
      for (const x of buttons) x.classList.toggle('on', x === b);
      onChange(o.value);
    });
    b.classList.toggle('on', o.value === value);
    buttons.push(b);
  }
  box.append(...buttons);
  return row(label, box);
}

export function textField(label: string, value: string, opts: { maxLength: number; inputMode?: string }, onChange: (v: string) => void): HTMLElement {
  const input = el('input', 'st-text');
  input.type = 'text';
  input.value = value;
  input.maxLength = opts.maxLength;
  input.autocomplete = 'off';
  input.spellcheck = false;
  if (opts.inputMode) input.inputMode = opts.inputMode;
  input.setAttribute('aria-label', label);
  input.addEventListener('input', () => onChange(input.value));
  return row(label, input);
}
```

`src/ui/staff/cornerHold.ts`:
```ts
import { el } from '../dom';

/**
 * An invisible square in the top-left corner. Holding it for `ms` calls `onTrigger` (the staff PIN pad).
 * It is marked as interface, so pressing it never starts a game, and visitors see nothing.
 */
export function attachCornerHold(parent: HTMLElement, ms: number, onTrigger: () => void): HTMLElement {
  const zone = el('div', 'corner-hold');
  zone.dataset.ui = '';
  let timer = 0;
  const cancel = () => {
    window.clearTimeout(timer);
    timer = 0;
  };
  zone.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    cancel();
    timer = window.setTimeout(() => {
      timer = 0;
      onTrigger();
    }, ms);
  });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) zone.addEventListener(type, cancel);
  parent.append(zone);
  return zone;
}
```

`src/ui/staff/pinPad.ts`:
```ts
import { el } from '../dom';
import { button } from './fields';

export interface PinRequest {
  check(pin: string): boolean;
  onSuccess(): void;
  onCancel(): void;
}

/** Four-digit PIN entry for staff. Three wrong tries, Cancel, Escape or 20 s without input closes it. */
export class PinPad {
  static readonly IDLE_MS = 20_000;
  static readonly MAX_TRIES = 3;
  readonly root = el('div', 'staff-screen pin-pad');
  private card = el('div', 'paper-card pin-card');
  private dots: HTMLElement[] = [];
  private entered = '';
  private tries = 0;
  private idleTimer = 0;
  private req: PinRequest | null = null;

  constructor(parent: HTMLElement) {
    const dotRow = el('div', 'pin-dots');
    for (let i = 0; i < 4; i++) {
      const d = el('i');
      this.dots.push(d);
      dotRow.append(d);
    }
    const keys = el('div', 'pin-keys');
    for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9']) keys.append(button(k, () => this.digit(k), 'pin-key'));
    const back = button('⌫', () => this.back(), 'pin-key small');
    back.setAttribute('aria-label', 'Delete');
    keys.append(button('Cancel', () => this.cancel(), 'pin-key small'), button('0', () => this.digit('0'), 'pin-key'), back);
    this.card.append(el('h2', '', 'Staff settings'), el('p', 'st-note', 'Enter the PIN'), dotRow, keys);
    this.root.append(this.card);
    this.root.dataset.ui = '';
    this.root.hidden = true;
    parent.append(this.root);
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  open(req: PinRequest): void {
    this.req = req;
    this.entered = '';
    this.tries = 0;
    this.paint();
    this.root.hidden = false;
    this.armIdle();
  }

  private close(): void {
    window.clearTimeout(this.idleTimer);
    this.root.hidden = true;
    this.req = null;
  }

  private cancel(): void {
    const r = this.req;
    this.close();
    r?.onCancel();
  }

  private digit(d: string): void {
    if (!this.req || this.entered.length >= 4) return;
    this.entered += d;
    this.paint();
    this.armIdle();
    if (this.entered.length === 4) this.submit();
  }

  private back(): void {
    this.entered = this.entered.slice(0, -1);
    this.paint();
    this.armIdle();
  }

  private submit(): void {
    const r = this.req;
    if (!r) return;
    if (r.check(this.entered)) {
      this.close();
      r.onSuccess();
      return;
    }
    this.tries++;
    this.entered = '';
    this.paint();
    this.card.classList.remove('wrong');
    void this.card.offsetWidth; // restart the shake animation
    this.card.classList.add('wrong');
    if (this.tries >= PinPad.MAX_TRIES) this.cancel();
  }

  private paint(): void {
    this.dots.forEach((d, i) => d.classList.toggle('on', i < this.entered.length));
  }

  private armIdle(): void {
    window.clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => this.cancel(), PinPad.IDLE_MS);
  }

  private onKey(e: KeyboardEvent): void {
    if (!this.isOpen) return;
    if (/^\d$/.test(e.key)) this.digit(e.key);
    else if (e.key === 'Backspace') this.back();
    else if (e.key === 'Escape') this.cancel();
    else return;
    e.preventDefault();
  }
}
```

`src/ui/staff/settingsPanel.ts`:
```ts
import {
  applyPreset, defaultSettings, detectPreset, fromShareCode, LIMITS, sanitize, toShareCode, validate, type Settings,
} from '../../core/settings';
import { BAD_TYPES, GOOD_TYPES, isGood } from '../../core/types';
import { el } from '../dom';
import { ITEM_LABELS } from '../labels';
import { button, choice, note, numberField, row, textField, toggle } from './fields';

export interface PanelContext {
  /** The settings being edited. Nothing is stored until Save. */
  readonly draft: Settings;
  /** Changes the draft. `rerender` rebuilds every section (for edits that change other fields, like presets). */
  edit(change: (draft: Settings) => void, rerender?: boolean): void;
  /** A short message in the footer. */
  notice(text: string): void;
}

export interface Section {
  title: string;
  render(ctx: PanelContext): HTMLElement;
}

export interface PanelOptions {
  /** Extra sections, shown after the bonus-question section. */
  sections?: Section[];
  onSave(settings: Settings): void;
  onClose(): void;
}

const difficulty: Section = {
  title: 'Difficulty',
  render({ draft: d, edit }) {
    const presets = el('div', 'st-choice');
    for (const p of ['easy', 'normal', 'hard'] as const) {
      const b = button(p[0].toUpperCase() + p.slice(1), () => edit((x) => Object.assign(x, applyPreset(x, p)), true));
      b.dataset.preset = p;
      presets.append(b);
    }
    const custom = el('span', 'st-chip', 'Custom');
    custom.dataset.preset = 'custom';
    presets.append(custom);
    const box = el('div');
    box.append(
      row('Preset', presets),
      numberField('Round length', d.roundSeconds, LIMITS.roundSeconds, (v) => edit((x) => { x.roundSeconds = v; }), 's'),
      numberField('Start speed', d.startSpeedKmh, LIMITS.startSpeedKmh, (v) => edit((x) => { x.startSpeedKmh = v; }), 'km/h'),
      numberField('End speed', d.endSpeedKmh, LIMITS.endSpeedKmh, (v) => edit((x) => { x.endSpeedKmh = v; }), 'km/h'),
      choice('Item layout', [{ value: 'random', label: 'Random each round' }, { value: 'fixed', label: 'Same for everyone' }] as const, d.mode, (v) => edit((x) => { x.mode = v; })),
      numberField('Obstacles per round', d.obstacles, LIMITS.obstacles, (v) => edit((x) => { x.obstacles = v; })),
      numberField('Treats per round', d.treats, LIMITS.treats, (v) => edit((x) => { x.treats = v; })),
      note('Random each round: the counts vary by up to a third either way. Same for everyone: exactly these counts; only their places change.'),
    );
    return box;
  },
};

const pointsAndGifts: Section = {
  title: 'Points and gifts',
  render({ draft: d, edit }) {
    const box = el('div');
    for (const t of [...GOOD_TYPES, ...BAD_TYPES]) {
      box.append(numberField(ITEM_LABELS[t], d.points[t], isGood(t) ? LIMITS.goodPoints : LIMITS.badPoints, (v) => edit((x) => { x.points[t] = v; }), 'points'));
    }
    box.append(toggle('Show gifts to players', d.showGifts, (v) => edit((x) => { x.showGifts = v; })));
    const tiers = el('div', 'st-tiers');
    d.tiers.forEach((tier, i) => {
      const min = el('input', 'st-num');
      min.type = 'number';
      min.inputMode = 'numeric';
      min.value = String(tier.min);
      min.disabled = i === 0;
      min.setAttribute('aria-label', `Gift ${i + 1} minimum score`);
      min.addEventListener('input', () => {
        const v = Number(min.value);
        if (min.value.trim() !== '' && Number.isInteger(v)) edit((x) => { x.tiers[i].min = v; });
      });
      const name = el('input', 'st-text');
      name.type = 'text';
      name.maxLength = 24;
      name.value = tier.name;
      name.setAttribute('aria-label', `Gift ${i + 1} name`);
      name.addEventListener('input', () => edit((x) => { x.tiers[i].name = name.value; }));
      const remove = button('Remove', () => edit((x) => {
        x.tiers.splice(i, 1);
        x.tiers[0].min = 0;
      }, true), 'st-btn small');
      remove.setAttribute('aria-label', `Remove gift ${i + 1}`);
      remove.disabled = d.tiers.length <= 1;
      const line = el('div', 'st-tier');
      line.append(el('span', 'st-unit', 'from'), min, name, remove);
      tiers.append(line);
    });
    const add = button('Add gift tier', () => edit((x) => {
      const last = x.tiers[x.tiers.length - 1];
      x.tiers.push({ name: `Gift ${x.tiers.length + 1}`, min: last.min + 20 });
    }, true));
    add.disabled = d.tiers.length >= 6;
    box.append(row('Gift tiers', tiers), row('', add), note('Each tier needs a name and a higher minimum score than the one before. The first tier starts at 0, so everyone gets something.'));
    return box;
  },
};

const questions: Section = {
  title: 'Bonus questions',
  render({ draft: d, edit }) {
    const box = el('div');
    box.append(
      toggle('Bonus questions', d.questions.enabled, (v) => edit((x) => { x.questions.enabled = v; })),
      numberField('Questions per round', d.questions.perRun, LIMITS.perRun, (v) => edit((x) => { x.questions.perRun = v; })),
      numberField('Time to answer', d.questions.timeLimit, LIMITS.timeLimit, (v) => edit((x) => { x.questions.timeLimit = v; }), 's'),
      note("A right answer doubles that treat's points; a wrong answer or no answer gives 0."),
    );
    return box;
  },
};

const pin: Section = {
  title: 'PIN',
  render({ draft: d, edit }) {
    const box = el('div');
    box.append(
      textField('Settings PIN', d.pin, { maxLength: 4, inputMode: 'numeric' }, (v) => edit((x) => { x.pin = v; })),
      note('4 digits. Write it down: you need it to open this menu. Share codes never include it.'),
    );
    return box;
  },
};

const share: Section = {
  title: 'Share code',
  render(ctx) {
    const out = el('textarea', 'st-code');
    out.readOnly = true;
    out.rows = 3;
    out.hidden = true;
    out.setAttribute('aria-label', 'Share code for this device');
    const copy = button('Copy code', () => {
      const code = toShareCode(ctx.draft);
      out.value = code;
      out.hidden = false;
      out.select();
      const copied = () => ctx.notice('Code copied. Paste it into this menu on the other device.');
      const manual = () => ctx.notice('Select the code below and copy it.');
      try {
        if (navigator.clipboard) navigator.clipboard.writeText(code).then(copied, manual);
        else manual();
      } catch {
        manual();
      }
    });
    const input = el('textarea', 'st-code');
    input.rows = 3;
    input.spellcheck = false;
    input.placeholder = 'Paste a VR1-… code here';
    input.setAttribute('aria-label', 'Share code to load');
    const load = button('Load code', () => {
      const loaded = fromShareCode(input.value, ctx.draft);
      if (!loaded) {
        ctx.notice('That code is not valid. Nothing changed.');
        return;
      }
      ctx.edit((x) => Object.assign(x, loaded), true);
      ctx.notice('Code loaded. Check the values, then press Save.');
    });
    const box = el('div');
    box.append(note('Moves these settings (everything except the PIN) to another device.'), row('This device', copy), out, row('Another device', load), input);
    return box;
  },
};

/** Full-screen staff settings. Edits a copy; Save validates and hands the result back, Cancel throws it away. */
export class SettingsPanel {
  readonly root = el('div', 'staff-screen settings');
  private body = el('div', 'st-body');
  private problems = el('ul', 'st-problems');
  private message = el('p', 'st-message');
  private saveButton: HTMLButtonElement;
  private draft: Settings = defaultSettings();
  private readonly sections: Section[];
  private readonly ctx: PanelContext;

  constructor(parent: HTMLElement, private readonly o: PanelOptions) {
    this.sections = [difficulty, pointsAndGifts, questions, ...(o.sections ?? []), pin, share];
    const panel = this;
    this.ctx = {
      get draft() {
        return panel.draft;
      },
      edit(change, rerender = false) {
        change(panel.draft);
        panel.draft.preset = detectPreset(panel.draft);
        if (rerender) panel.render();
        else panel.refresh();
      },
      notice(text) {
        panel.message.textContent = text;
      },
    };
    this.saveButton = button('Save', () => this.save(), 'st-btn primary');
    const head = el('header', 'st-head');
    head.append(el('h2', '', 'Staff settings'), note('Changes apply from the next round. Only staff should see this screen.'));
    const actions = el('div', 'st-actions');
    actions.append(
      button('Reset to defaults', () => {
        this.ctx.edit((x) => Object.assign(x, { ...defaultSettings(), pin: x.pin, leaderboard: { ...x.leaderboard } }), true);
        this.ctx.notice('Defaults restored (PIN and board name kept). Press Save to keep them.');
      }),
      button('Cancel', () => this.close()),
      this.saveButton,
    );
    const foot = el('footer', 'st-foot');
    foot.append(this.problems, this.message, actions);
    this.root.append(head, this.body, foot);
    this.root.dataset.ui = '';
    this.root.hidden = true;
    parent.append(this.root);
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  open(current: Settings): void {
    this.draft = JSON.parse(JSON.stringify(current)) as Settings;
    this.message.textContent = '';
    this.render();
    this.root.hidden = false;
    this.body.scrollTop = 0;
  }

  close(): void {
    if (this.root.hidden) return;
    this.root.hidden = true;
    this.o.onClose();
  }

  private save(): void {
    if (validate(this.draft).length > 0) return;
    this.o.onSave(sanitize(this.draft));
    this.close();
  }

  private render(): void {
    this.body.replaceChildren(
      ...this.sections.map((s) => {
        const box = el('section', 'st-section');
        box.append(el('h3', '', s.title), s.render(this.ctx));
        return box;
      }),
    );
    this.refresh();
  }

  private refresh(): void {
    for (const b of this.body.querySelectorAll<HTMLElement>('[data-preset]')) b.classList.toggle('on', b.dataset.preset === this.draft.preset);
    const problems = validate(this.draft);
    this.problems.replaceChildren(...problems.map((p) => el('li', '', p)));
    this.saveButton.disabled = problems.length > 0;
  }
}
```

`src/ui/staff.css`:
```css
/* Staff screens: corner hold, PIN pad, settings. English, team only. */
.corner-hold { position: absolute; left: 0; top: 0; width: 12%; height: 12%; z-index: 3; }
.staff-screen { position: absolute; inset: 0; z-index: 8; background: rgba(29, 20, 17, 0.72); font-family: var(--font-body); color: var(--ink); }
.pin-pad { display: grid; place-items: center; }
.pin-card { padding: 3cqmin 4cqmin; display: grid; gap: 1.6cqmin; justify-items: center; }
.pin-card h2 { margin: 0; font-family: var(--font-display); font-weight: 400; font-size: 5cqmin; }
.pin-card.wrong { animation: shake 0.4s; }
@keyframes shake { 20%, 60% { transform: translateX(-1.6cqmin); } 40%, 80% { transform: translateX(1.6cqmin); } }
.pin-dots { display: flex; gap: 2cqmin; }
.pin-dots i { width: 2.6cqmin; height: 2.6cqmin; border-radius: 50%; border: 0.4cqmin solid var(--ink); }
.pin-dots i.on { background: var(--ink); }
.pin-keys { display: grid; grid-template-columns: repeat(3, 12cqmin); gap: 1.4cqmin; }
.pin-key { font: 600 4.4cqmin var(--font-body); height: 10cqmin; border-radius: 1cqmin; border: 0.3cqmin solid var(--ink); background: #fff; color: var(--ink); cursor: pointer; touch-action: manipulation; }
.pin-key.small { font-size: 2.4cqmin; }
.settings { display: grid; grid-template-rows: auto 1fr auto; background: var(--paper); }
.st-head { padding: 2cqmin 4cqmin 1cqmin; border-bottom: 0.2cqmin solid var(--paper-2); }
.st-head h2 { margin: 0; font-family: var(--font-display); font-weight: 400; font-size: 4.4cqmin; }
.st-body { overflow-y: auto; touch-action: pan-y; overscroll-behavior: contain; padding: 1cqmin 4cqmin 3cqmin; font-size: 2.3cqmin; }
.st-section { max-width: 150cqmin; margin: 0 auto; padding: 1.6cqmin 0; border-bottom: 0.2cqmin solid var(--paper-2); }
.st-section h3 { margin: 0 0 1cqmin; font-family: var(--font-display); font-weight: 400; font-size: 3.4cqmin; color: var(--red-ink); }
.st-row { display: grid; grid-template-columns: 34cqmin 1fr; align-items: center; gap: 2cqmin; padding: 0.7cqmin 0; }
.st-controls { display: flex; flex-wrap: wrap; gap: 1cqmin; align-items: center; }
.st-unit { color: var(--muted); min-width: 6cqmin; }
.st-note { margin: 0.4cqmin 0; color: var(--muted); font-size: 2cqmin; line-height: 1.4; }
.st-btn, .st-step, .st-toggle, .st-choice button { font: 600 2.3cqmin var(--font-body); min-height: 6cqmin; padding: 0 2.4cqmin; border-radius: 0.8cqmin; border: 0.25cqmin solid var(--ink); background: #fff; color: var(--ink); cursor: pointer; touch-action: manipulation; }
.st-step { width: 6cqmin; padding: 0; font-size: 3.2cqmin; }
.st-btn.small { min-height: 5cqmin; font-size: 2cqmin; }
.st-btn.primary { background: var(--red); border-color: var(--red); color: #fff; }
.st-btn.danger { border-color: #b3262d; color: #b3262d; }
.st-btn:disabled, .st-step:disabled { opacity: 0.45; cursor: default; }
.st-toggle.on, .st-choice .on { background: var(--green); border-color: var(--green); color: #fff; }
.st-choice { display: flex; flex-wrap: wrap; gap: 1cqmin; align-items: center; }
.st-chip { padding: 0.8cqmin 2cqmin; border-radius: 99cqmin; border: 0.25cqmin dashed var(--muted); color: var(--muted); }
.st-chip.on { border-style: solid; border-color: var(--red-ink); color: var(--red-ink); }
.st-num, .st-text, .st-code { font: 500 2.4cqmin var(--font-body); min-height: 6cqmin; padding: 0 1.4cqmin; border-radius: 0.8cqmin; border: 0.25cqmin solid var(--ink); background: #fff; color: var(--ink); }
.st-num { width: 14cqmin; text-align: center; }
.st-text { width: 36cqmin; }
.st-code { display: block; width: 100%; margin: 0.6cqmin 0; padding: 1cqmin 1.4cqmin; font-family: ui-monospace, monospace; font-size: 1.9cqmin; resize: vertical; }
.st-tiers { display: grid; gap: 1cqmin; }
.st-tier { display: flex; gap: 1cqmin; align-items: center; }
.st-foot { padding: 1.4cqmin 4cqmin 2cqmin; border-top: 0.2cqmin solid var(--paper-2); display: grid; gap: 0.8cqmin; }
.st-problems { margin: 0; padding-left: 3cqmin; color: #b3262d; font-weight: 600; font-size: 2.2cqmin; }
.st-problems:empty, .st-message:empty { display: none; }
.st-message { margin: 0; color: var(--green); font-weight: 600; font-size: 2.2cqmin; }
.st-actions { display: flex; gap: 1.4cqmin; justify-content: flex-end; }
```

- [ ] **Step 5: Run the tests and the type check**

Run: `npm test && npx tsc --noEmit`
Expected: PASS everywhere, with no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/ui/staff src/ui/staff.css src/input/touch.ts src/app/kiosk.ts src/ui/styles.css tests/ui/staff tests/input/touch.test.ts tests/app/kiosk.test.ts
git commit -m "feat(ui): staff corner hold, PIN pad and settings panel; typing never moves the game"
```

---

### Task 6: Wire the settings into the booth, end-to-end test, docs, deploy (Phase A)

**Files:**
- Modify: `src/main.ts`, `README.md`, `docs/SETUP_CHECKLIST.md`, `scripts/simulate.ts`
- Test: `tests/e2e/settings.spec.ts` (new)

**Interfaces:**
- Consumes:
  - `loadSettings`, `saveSettings` (Task 4)
  - `buildConfig`, `featuresOf`, `PRESETS`, `applyPreset`, `defaultSettings` (Task 3)
  - `attachCornerHold`, `PinPad`, `SettingsPanel` (Task 5)
  - `Game.configure` (Task 4)
- Produces:
  - `window.__vr = { cycles, screen, errors, contextLost, baseSpeed }`, now always present (read-only test hook)
  - an exported `CORNER_HOLD_MS = 3000` in `src/main.ts` scope (not exported)

- [ ] **Step 1: Write the failing end-to-end test**

`tests/e2e/settings.spec.ts`:
```ts
import { expect, test } from '@playwright/test';

test('staff open settings with a corner hold and the PIN, pick Hard, and the next round runs faster', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=4');
  await page.waitForFunction(() => (window as any).__vr?.screen === 'attract', null, { timeout: 60_000 });
  const vp = page.viewportSize()!;

  // A short press in the corner does nothing; a 3-second hold opens the PIN pad.
  await page.mouse.move(vp.width * 0.04, vp.height * 0.05);
  await page.mouse.down();
  await page.waitForTimeout(3300);
  await page.mouse.up();
  await expect(page.locator('.pin-pad')).toBeVisible();
  for (const d of '2468') await page.locator('.pin-key', { hasText: new RegExp(`^${d}$`) }).click();
  await expect(page.locator('.settings')).toBeVisible();

  await page.locator('.settings button', { hasText: /^Hard$/ }).click();
  await page.locator('.settings button', { hasText: /^Save$/ }).click();
  await expect(page.locator('.settings')).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vienna-run:settings') ?? '{}').preset)).toBe('hard');

  await page.mouse.click(vp.width / 2, vp.height / 2);
  await page.waitForFunction(() => (window as any).__vr?.screen === 'run', null, { timeout: 30_000 });
  expect(await page.evaluate(() => (window as any).__vr.baseSpeed)).toBeCloseTo(58 / 3.6, 2);

  // Settings survive a reload.
  await page.reload();
  await page.waitForFunction(() => (window as any).__vr?.screen === 'attract', null, { timeout: 60_000 });
  expect(await page.evaluate(() => (window as any).__vr.baseSpeed)).toBeCloseTo(58 / 3.6, 2);
  expect(errors).toEqual([]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test tests/e2e/settings.spec.ts`
Expected: FAIL. Either `__vr` is undefined (it is only exposed in autoplay mode) or `.pin-pad` never appears.

- [ ] **Step 3: Wire settings into `src/main.ts`**

1. Add the imports:
```ts
import './ui/staff.css';
import { loadSettings, saveSettings } from './app/settingsStore';
import { buildConfig, featuresOf } from './core/settings';
import { attachCornerHold } from './ui/staff/cornerHold';
import { PinPad } from './ui/staff/pinPad';
import { SettingsPanel } from './ui/staff/settingsPanel';
```
2. Add `const CORNER_HOLD_MS = 3000;` below `RECENT_KEY`.
3. After `if (params.check) { … return; }`, add:
```ts
  let settings = loadSettings();
```
4. Replace the `new Game({ … })` call's `cfg: CONFIG,` with:
```ts
    cfg: buildConfig(settings),
    features: featuresOf(settings),
    giftUrl: (tier) => art.url(`gift-${tier}`),
```
5. After the `const game = new Game(...)` statement, add:
```ts
  // Staff settings: hold the top-left corner of the start screen, then the PIN. The game pauses meanwhile.
  let staffOpen = false;
  const pinPad = new PinPad(stage);
  const panel = new SettingsPanel(stage, {
    onSave: (s) => {
      settings = s;
      saveSettings(s);
      game.configure(buildConfig(s), featuresOf(s));
    },
    onClose: () => {
      staffOpen = false;
    },
  });
  attachCornerHold(ui.attract.root, CORNER_HOLD_MS, () => {
    if (staffOpen || game.flow.screen !== 'attract') return;
    staffOpen = true;
    pinPad.open({
      check: (pin) => pin === settings.pin,
      onSuccess: () => panel.open(settings),
      onCancel: () => {
        staffOpen = false;
      },
    });
  });
```
6. Replace the `attachInput(...)` line with:
```ts
  attachInput(stage, CONFIG.input, {
    onLane: (d) => {
      if (!staffOpen) game.lane(d);
    },
    onPress: () => {
      if (!staffOpen) game.press();
    },
  });
```
7. In `startLoop(…)`, replace `(dt) => game.update(dt),` with:
```ts
    (dt) => {
      if (!staffOpen) game.update(dt);
    },
```
8. Replace `if (params.autoplay) exposeDebugHook(game, canvas);` with `exposeDebugHook(game, canvas);`, and update `exposeDebugHook`:
```ts
/** Read-only state for the Playwright tests. */
function exposeDebugHook(game: Game, canvas: HTMLCanvasElement): void {
  const hook = { cycles: 0, screen: 'attract' as string, errors: [] as string[], contextLost: false, baseSpeed: 0 };
  (window as unknown as { __vr: typeof hook }).__vr = hook;
  window.addEventListener('error', (e) => hook.errors.push(e.message));
  canvas.addEventListener('webglcontextlost', () => {
    hook.contextLost = true;
  });
  const sync = () => {
    hook.cycles = game.cycles;
    hook.screen = game.flow.screen;
    hook.baseSpeed = game.run.cfg.baseSpeed;
  };
  sync();
  window.setInterval(sync, 250);
}
```

- [ ] **Step 4: Report scores per preset in the simulator** (replace `scripts/simulate.ts`)

```ts
import { writeFileSync } from 'node:fs';
import { BOT_SKILLS } from '../src/core/bot';
import { applyPreset, buildConfig, defaultSettings, PRESETS } from '../src/core/settings';
import { simulateRun, summarize } from '../src/core/simulate';

const RUNS = Number(process.argv[2] ?? 2000);
const tiers = defaultSettings().tiers;
const lines: string[] = [
  `# Score simulation (${RUNS} runs per player profile and preset)`,
  '',
  `Tiers: ${tiers.map((t) => `${t.name} from ${t.min}`).join(', ')}`,
];
for (const preset of Object.keys(PRESETS) as (keyof typeof PRESETS)[]) {
  const cfg = buildConfig(applyPreset(defaultSettings(), preset));
  lines.push(
    '',
    `## ${preset[0].toUpperCase()}${preset.slice(1)}`,
    '',
    `| Profile | Mean | P10 | Median | P90 | ${tiers.map((t) => t.name).join(' | ')} |`,
    `|---|---|---|---|---|${tiers.map(() => '---|').join('')}`,
  );
  for (const skill of Object.values(BOT_SKILLS)) {
    const s = summarize(Array.from({ length: RUNS }, (_, i) => simulateRun(i + 1, skill, cfg)), tiers);
    lines.push(`| ${skill.name} | ${s.mean.toFixed(0)} | ${s.p10} | ${s.p50} | ${s.p90} | ${s.tierShare.map((x) => `${(x * 100).toFixed(0)}%`).join(' | ')} |`);
  }
}
lines.push(
  '',
  'Tier columns show the share of players whose final score lands in that tier.',
  'Gift tiers are set in the staff settings menu; the defaults above come from `src/config.ts`.',
);
const report = `${lines.join('\n')}\n`;
writeFileSync('docs/simulation-report.md', report);
console.log(report);
```

- [ ] **Step 5: Document the menu**

In `README.md`, insert before `## Changing things`:
```markdown
## Staff settings
On the start screen, **hold the top-left corner for 3 seconds**, then enter the PIN (default **2468**;
change it in the menu). The menu sets:
- **Difficulty:** Easy / Normal / Hard presets; round length, start and end speed, obstacles and treats
  per round; "Random each round" or "Same for everyone".
- **Points and gifts:** item points, the gift tiers, and whether players see gifts.
- **Bonus questions:** on/off, how many per round, seconds to answer.
- **Share code:** copy every setting except the PIN to another device.

Settings are saved on each device and apply from the next round.
```
In the same file, replace the line `- **Points, timings, gift tiers:** `src/config.ts`. After changing tiers, run `npm run simulate` to see how many players land in each tier.` with:
```markdown
- **Points, difficulty, gift tiers:** use the staff settings menu. `src/config.ts` holds the defaults; `npm run simulate` shows the score spread for each preset.
```

In `docs/SETUP_CHECKLIST.md`, insert after step 9 (renumber the following steps):
```markdown
10. **Settings:** on the start screen hold the top-left corner for 3 s and enter the team PIN
    (default 2468; change it and write it down). Load the agreed difficulty with **Share code →
    Load code** (paste the code from the team chat), check the values, press **Save**.
```

- [ ] **Step 6: Run everything**

Run: `npm test && npm run build && npx playwright test tests/e2e/settings.spec.ts tests/e2e/smoke.spec.ts`
Expected: unit tests PASS, the build succeeds, and both browser tests PASS.

Then run: `npm run simulate -- 300`
Expected: the report prints three preset tables. Easy means sit above Normal, and Normal above Hard.

- [ ] **Step 7: Commit and deploy Phase A**

```bash
git add src/main.ts scripts/simulate.ts README.md docs/SETUP_CHECKLIST.md docs/simulation-report.md tests/e2e/settings.spec.ts
git commit -m "feat: staff settings menu on the booth (corner hold + PIN)"
git push origin main
```
Then deploy with the Vercel MCP `create_deployment` (Global Constraints). Wait until the deployment is `READY`, and check that the live bundle contains `Staff settings`:
```bash
curl -s https://vienna-run.vercel.app/ | grep -o 'assets/index-[^"]*\.js' | head -1 | xargs -I{} curl -s https://vienna-run.vercel.app/{} | grep -c 'Staff settings'
```
Expected: `1` or more. Send the user the link and the PIN.

---

## Phase B: Vietnamese

### Task 7: Translation table, `I18n`, and Vietnamese-capable fonts

**Files:**
- Create: `src/i18n/strings.ts`, `src/i18n/i18n.ts`
- Modify:
  - `src/core/types.ts` (add `Lang`)
  - `package.json` and `package-lock.json` (fonts)
  - `src/main.ts` (font imports)
  - `src/ui/styles.css` (font variables)
  - `src/assets/manifest.ts` (font preload)
  - `index.html` (`lang="vi"`)
- Test: `tests/i18n/strings.test.ts`

**Interfaces:**
- Produces:
  - `type Lang = 'vi' | 'en'` (in `src/core/types.ts`), `LANGS: readonly Lang[]`
  - `type StringKey`, `type Vars`, `STRINGS`, `translate(lang, key, vars?)`
  - `class I18n { lang; t(key, vars?); set(lang); onChange(cb): () => void }`

- [ ] **Step 1: Write the failing test** (`tests/i18n/strings.test.ts`)

```ts
import { describe, expect, it, vi } from 'vitest';
import { I18n } from '../../src/i18n/i18n';
import { STRINGS, translate } from '../../src/i18n/strings';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('translation table', () => {
  it('has every text in both languages, none empty, with the same placeholders', () => {
    const keys = Object.keys(STRINGS.en).sort();
    expect(Object.keys(STRINGS.vi).sort()).toEqual(keys);
    for (const k of keys as (keyof typeof STRINGS.en)[]) {
      expect(STRINGS.en[k].trim(), `en ${k}`).not.toBe('');
      expect(STRINGS.vi[k].trim(), `vi ${k}`).not.toBe('');
      expect(placeholders(STRINGS.vi[k]), `placeholders ${k}`).toEqual(placeholders(STRINGS.en[k]));
    }
  });
  it('fills placeholders and leaves unknown ones visible', () => {
    expect(translate('vi', 'finish.points', { score: 120 })).toBe('120 điểm');
    expect(translate('en', 'finish.points')).toBe('{score} points');
  });
  it('gives the Vietnamese hint next to each treat name', () => {
    expect(translate('vi', 'item.sacher')).toBe('Sachertorte · bánh sô-cô-la');
    expect(translate('en', 'item.sacher')).toBe('Sachertorte');
  });
});

describe('I18n', () => {
  it('starts in Vietnamese and tells listeners only about real changes', () => {
    const i18n = new I18n();
    const cb = vi.fn();
    i18n.onChange(cb);
    expect(i18n.lang).toBe('vi');
    expect(i18n.t('attract.cta')).toBe('Chạm vào màn hình để chơi');
    i18n.set('vi');
    expect(cb).not.toHaveBeenCalled();
    i18n.set('en');
    expect(cb).toHaveBeenCalledTimes(1);
    expect(i18n.t('attract.cta')).toBe('Tap anywhere to play');
  });
  it('stops calling a listener after it unsubscribes', () => {
    const i18n = new I18n('en');
    const cb = vi.fn();
    const off = i18n.onChange(cb);
    off();
    i18n.set('vi');
    expect(cb).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/i18n`
Expected: FAIL, because `src/i18n/strings` can't be resolved.

- [ ] **Step 3: Write the translation table**

Add to `src/core/types.ts`:
```ts
export type Lang = 'vi' | 'en';
export const LANGS: readonly Lang[] = ['vi', 'en'];
```

`src/i18n/strings.ts`:
```ts
import type { Lang } from '../core/types';

export type { Lang } from '../core/types';
export { LANGS } from '../core/types';

/** Visitor-facing texts. Staff screens (settings, self-check) stay English and are not listed here. */
const en = {
  'attract.tagline': 'Race the waiter from Stephansdom to the Riesenrad. Grab Viennese treats and dodge Krampus and the bombs.',
  'attract.cta': 'Tap anywhere to play',
  'lang.switch': 'Language',
  'item.sacher': 'Sachertorte',
  'item.kipferl': 'Kipferl',
  'item.melange': 'Melange',
  'item.mozart': 'Mozartkugel',
  'item.krampus': 'Krampus',
  'item.bomb': 'Bomb',
  'howto.title': 'How to play',
  'howto.lanes': 'Tap the left or right side of the screen to switch lanes.',
  'howto.items': 'Grab the treats. Dodge Krampus and the bombs.',
  'howto.bonus': 'Some treats hide a bonus question. Answer right for double points.',
  'howto.go': 'Go!',
  'hud.points': 'Points',
  'hud.route': 'Stephansplatz → Riesenrad',
  'fx.noPoints': 'No points',
  'fx.go': 'Go!',
  'finish.title': 'Finish!',
  'finish.points': '{score} points',
  'question.bonus': 'Bonus question! Right answer = double points ({base} → {double})',
  'question.timeUp': "Time's up! No points this time.",
  'question.right': 'Right! Double points.',
  'question.wrong': 'Not quite. No points this time.',
  'results.score': 'Your score',
  'results.thanks': 'Thanks for playing!',
  'results.prize': 'Your prize',
  'results.hold': 'Hold for next player',
  'watchdog.restart': "Let's restart!",
  'watchdog.staff': 'Short break. Please ask the staff.',
};

export type StringKey = keyof typeof en;

const vi: Record<StringKey, string> = {
  'attract.tagline': 'Cùng anh bồi bàn chạy từ nhà thờ Stephansdom đến vòng đu quay Riesenrad. Nhặt bánh kẹo Vienna, né quỷ Krampus và bom.',
  'attract.cta': 'Chạm vào màn hình để chơi',
  'lang.switch': 'Ngôn ngữ',
  'item.sacher': 'Sachertorte · bánh sô-cô-la',
  'item.kipferl': 'Kipferl · bánh sừng bò',
  'item.melange': 'Melange · cà phê sữa',
  'item.mozart': 'Mozartkugel · kẹo sô-cô-la',
  'item.krampus': 'Krampus · quỷ Krampus',
  'item.bomb': 'Bom',
  'howto.title': 'Cách chơi',
  'howto.lanes': 'Chạm vào bên trái hoặc bên phải màn hình để chuyển làn.',
  'howto.items': 'Nhặt bánh kẹo. Né quỷ Krampus và bom.',
  'howto.bonus': 'Một số món ẩn câu hỏi thưởng. Trả lời đúng để được gấp đôi điểm.',
  'howto.go': 'Chạy!',
  'hud.points': 'Điểm',
  'hud.route': 'Stephansplatz → Riesenrad',
  'fx.noPoints': 'Không có điểm',
  'fx.go': 'Chạy tiếp!',
  'finish.title': 'Về đích!',
  'finish.points': '{score} điểm',
  'question.bonus': 'Câu hỏi thưởng! Trả lời đúng = gấp đôi điểm ({base} → {double})',
  'question.timeUp': 'Hết giờ! Lần này không có điểm.',
  'question.right': 'Chính xác! Gấp đôi điểm.',
  'question.wrong': 'Chưa đúng. Lần này không có điểm.',
  'results.score': 'Điểm của bạn',
  'results.thanks': 'Cảm ơn bạn đã chơi!',
  'results.prize': 'Phần quà của bạn',
  'results.hold': 'Giữ để sang người chơi tiếp theo',
  'watchdog.restart': 'Khởi động lại nhé!',
  'watchdog.staff': 'Tạm nghỉ một chút. Vui lòng gọi nhân viên.',
};

export const STRINGS: Record<Lang, Record<StringKey, string>> = { en, vi };

export type Vars = Record<string, string | number>;

/** The text for `key`, with `{name}` placeholders filled from `vars` (unknown placeholders stay as they are). */
export function translate(lang: Lang, key: StringKey, vars: Vars = {}): string {
  return STRINGS[lang][key].replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}
```

`src/i18n/i18n.ts`:
```ts
import { translate, type Lang, type StringKey, type Vars } from './strings';

/** The booth's current language. Screens listen and re-label when it changes. */
export class I18n {
  private listeners = new Set<() => void>();

  constructor(private current: Lang = 'vi') {}

  get lang(): Lang {
    return this.current;
  }

  t(key: StringKey, vars?: Vars): string {
    return translate(this.current, key, vars);
  }

  set(lang: Lang): void {
    if (lang === this.current) return;
    this.current = lang;
    for (const cb of [...this.listeners]) cb();
  }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/i18n`
Expected: PASS.

- [ ] **Step 5: Switch to fonts that cover Vietnamese**

Run:
```bash
npm install --save-exact @fontsource/josefin-sans@5.3.0 @fontsource/be-vietnam-pro@5.3.0
npm uninstall @fontsource/albert-sans
ls node_modules/@fontsource/josefin-sans/files | grep -c vietnamese
ls node_modules/@fontsource/be-vietnam-pro/files | grep -c vietnamese
```
Expected: both counts are greater than 0. Both families ship a Vietnamese subset.

In `src/main.ts`, replace the three font imports at the top with:
```ts
import '@fontsource/federo';
import '@fontsource/josefin-sans/400.css';
import '@fontsource/josefin-sans/600.css';
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/600.css';
```

In `src/ui/styles.css`, replace the two font variables with:
```css
  --font-display: 'Josefin Sans', 'Be Vietnam Pro', system-ui, sans-serif;
  --font-body: 'Be Vietnam Pro', system-ui, sans-serif;
  --display-weight: 600;
```
Then replace every `font-weight: 400;` in `styles.css` and `src/ui/staff.css` with `font-weight: var(--display-weight);`:
```bash
sed -i '' 's/font-weight: 400;/font-weight: var(--display-weight);/g' src/ui/styles.css src/ui/staff.css
```
Federo stays in use only inside the canvas sign painters (`src/render/placeholders/paint.ts`).

In `src/assets/manifest.ts`, replace the font-loading line:
```ts
    Promise.all(['40px Federo', '24px "Albert Sans"'].map((f) => document.fonts.load(f))),
```
with:
```ts
    // The sample text pulls in the Vietnamese subsets too, so accented letters never flash in a fallback font.
    Promise.all(['40px Federo', '600 40px "Josefin Sans"', '24px "Be Vietnam Pro"', '600 24px "Be Vietnam Pro"'].map((f) => document.fonts.load(f, 'Điểm của bạn ạ ố'))),
```
and change the doc comment above `loadArt` to `/** Loads fonts (Josefin Sans and Be Vietnam Pro for the screens, Federo for the placeholder signs), then every designer file; broken files fall back to placeholders. */`.

In `index.html`, change `<html lang="en">` to `<html lang="vi">`.

- [ ] **Step 6: Run the tests, the type check and the build**

Run: `npm test && npm run build`
Expected: PASS, and the build succeeds. `ls dist/assets | grep -c vietnamese` prints a number greater than 0.

- [ ] **Step 7: Commit**

```bash
git add src/i18n src/core/types.ts package.json package-lock.json src/main.ts src/ui/styles.css src/ui/staff.css src/assets/manifest.ts index.html tests/i18n
git commit -m "feat(i18n): Vietnamese/English text table and Vietnamese-capable fonts"
```

---

### Task 8: Bilingual question bank and question screen

**Files:**
- Modify: `src/core/types.ts`, `src/core/questions.ts`, `src/data/questions.json` (full replacement), `src/ui/question.ts`, `src/main.ts`
- Test: `tests/core/questions.test.ts`, `tests/ui/question.test.ts`

**Interfaces:**
- Consumes: `Lang` (Task 7), `I18n` (Task 7)
- Produces:
  - `interface QuestionText { q: string; options: [string, string, string] }`
  - `interface Question { id: string; answer: 0 | 1 | 2; vi: QuestionText; en: QuestionText }`
  - `validateBank(raw): Question[]`, which checks both languages
  - `new QuestionScreen(parent, i18n)`, which shows `q[i18n.lang]`

- [ ] **Step 1: Write the failing tests**

In `tests/core/questions.test.ts`, replace the `'shuffles the options but keeps the right answer right'` test with:
```ts
  it('shuffles the options the same way in both languages and keeps the right answer right', () => {
    const original = bank[0];
    for (let s = 1; s < 30; s++) {
      const q = shuffleOptions(createRng(s), original);
      for (const lang of ['vi', 'en'] as const) {
        expect(q[lang].options[q.answer]).toBe(original[lang].options[original.answer]);
        expect([...q[lang].options].sort()).toEqual([...original[lang].options].sort());
      }
      expect(q.vi.options.map((o) => original.vi.options.indexOf(o))).toEqual(q.en.options.map((o) => original.en.options.indexOf(o)));
    }
  });
```
and replace `describe('question bank', …)` with:
```ts
describe('question bank', () => {
  it('has at least 30 valid questions, each in Vietnamese and English', () => {
    expect(bank.length).toBeGreaterThanOrEqual(30);
    expect(new Set(bank.map((q) => q.id)).size).toBe(bank.length);
    for (const q of bank) {
      expect(q.vi.q).not.toBe(q.en.q);
      expect(q.vi.options).toHaveLength(3);
    }
  });
  it('rejects malformed entries with a readable message', () => {
    const good = { id: 'x', answer: 0, en: { q: 'Q?', options: ['a', 'b', 'c'] }, vi: { q: 'H?', options: ['a', 'b', 'c'] } };
    expect(validateBank([good])).toHaveLength(1);
    expect(() => validateBank([{ ...good, vi: { q: 'H?', options: ['a', 'a', 'b'] } }])).toThrow(/x \(vi\): options must differ/);
    expect(() => validateBank([{ ...good, en: { q: 'Q?', options: ['a', 'b'] } }])).toThrow(/x \(en\): needs exactly 3 options/);
    expect(() => validateBank([{ ...good, en: { q: ' ', options: ['a', 'b', 'c'] } }])).toThrow(/x \(en\): empty text/);
    expect(() => validateBank([{ id: 'y', answer: 0, en: good.en }])).toThrow(/y \(vi\)/);
    expect(() => validateBank([{ ...good, answer: 3 }])).toThrow(/answer must be 0, 1 or 2/);
  });
});
```
Remove the now-unused `import type { Question } …` line if TypeScript reports it.

Replace `tests/ui/question.test.ts`:
```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Question } from '../../src/core/types';
import { I18n } from '../../src/i18n/i18n';
import { QuestionScreen } from '../../src/ui/question';

const q: Question = {
  id: 'x',
  answer: 0,
  en: { q: 'Which river flows through Vienna?', options: ['Danube', 'Rhine', 'Seine'] },
  vi: { q: 'Con sông nào chảy qua Vienna?', options: ['Sông Danube', 'Sông Rhine', 'Sông Seine'] },
};
const press = (el: Element, type: string) => el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
const options = (s: QuestionScreen) => [...s.root.querySelectorAll('.q-option')].map((b) => b.textContent);

describe('QuestionScreen', () => {
  afterEach(() => vi.useRealTimers());

  it('ignores a tap that lands in the first moment after the question appears', () => {
    vi.useFakeTimers();
    const s = new QuestionScreen(document.body, new I18n('en'));
    const onPick = vi.fn();
    s.show(q, 10, onPick);
    press(s.root.querySelectorAll('.q-option')[2], 'pointerdown');
    expect(onPick).not.toHaveBeenCalled();
    vi.advanceTimersByTime(450);
    press(s.root.querySelectorAll('.q-option')[0], 'pointerdown');
    expect(onPick).toHaveBeenCalledExactlyOnceWith(0);
  });

  it('shows the question, the doubling, and three answers in the current language', () => {
    const i18n = new I18n('en');
    const s = new QuestionScreen(document.body, i18n);
    s.show(q, 10, () => undefined);
    expect(s.root.textContent).toContain('10 → 20');
    expect(options(s)).toEqual(['Danube', 'Rhine', 'Seine']);
    i18n.set('vi');
    s.show(q, 10, () => undefined);
    expect(s.root.textContent).toContain('Câu hỏi thưởng!');
    expect(s.root.textContent).toContain('Con sông nào chảy qua Vienna?');
    expect(options(s)).toEqual(['Sông Danube', 'Sông Rhine', 'Sông Seine']);
  });

  it('takes only the first pick, even when a tap fires both pointerdown and click', () => {
    const s = new QuestionScreen(document.body, new I18n('en'));
    vi.useFakeTimers();
    const onPick = vi.fn();
    s.show(q, 10, onPick);
    vi.advanceTimersByTime(450);
    const b = s.root.querySelectorAll('.q-option')[1];
    press(b, 'pointerdown');
    press(b, 'click');
    press(s.root.querySelectorAll('.q-option')[0], 'pointerdown');
    expect(onPick).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('marks the right and the wrong answer and locks the buttons', () => {
    const s = new QuestionScreen(document.body, new I18n('vi'));
    s.show(q, 10, () => undefined);
    s.reveal(0, 1);
    const buttons = [...s.root.querySelectorAll<HTMLButtonElement>('.q-option')];
    expect(buttons[0].classList.contains('right')).toBe(true);
    expect(buttons[1].classList.contains('wrong')).toBe(true);
    expect(buttons.every((b) => b.disabled)).toBe(true);
    expect(s.root.textContent).toContain('Chưa đúng.');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/core/questions.test.ts tests/ui/question.test.ts`
Expected: FAIL, because the bank entries have no `vi`/`en` and `QuestionScreen` takes no `I18n`.

- [ ] **Step 3: Bilingual types and validation**

In `src/core/types.ts`, replace `interface Question { … }` with:
```ts
export interface QuestionText {
  q: string;
  options: [string, string, string];
}

/** A bonus question in both languages; `answer` indexes the options of either language. */
export interface Question {
  id: string;
  answer: 0 | 1 | 2;
  vi: QuestionText;
  en: QuestionText;
}
```

In `src/core/questions.ts`:
- change the type import to `import type { Lang, Question, QuestionText } from './types';`
- replace `shuffleOptions` with:
```ts
export function shuffleOptions(rng: Rng, q: Question): Question {
  const order = shuffle(rng, [0, 1, 2]);
  const reorder = (t: QuestionText): QuestionText => ({ q: t.q, options: order.map((i) => t.options[i]) as [string, string, string] });
  return { ...q, vi: reorder(q.vi), en: reorder(q.en), answer: order.indexOf(q.answer) as 0 | 1 | 2 };
}
```
- replace `validateBank` with:
```ts
function validateText(id: string, lang: Lang, raw: unknown): QuestionText {
  const t = (raw && typeof raw === 'object' ? raw : {}) as Partial<QuestionText>;
  if (typeof t.q !== 'string' || !t.q.trim()) throw new Error(`question ${id} (${lang}): empty text`);
  if (!Array.isArray(t.options) || t.options.length !== 3 || t.options.some((s) => typeof s !== 'string' || !s.trim())) {
    throw new Error(`question ${id} (${lang}): needs exactly 3 options`);
  }
  if (new Set(t.options).size !== 3) throw new Error(`question ${id} (${lang}): options must differ`);
  return { q: t.q, options: [t.options[0], t.options[1], t.options[2]] };
}

/** Checks the bank file: unique ids, a valid answer index, and full text in both languages. */
export function validateBank(raw: unknown): Question[] {
  if (!Array.isArray(raw)) throw new Error('question bank must be an array');
  const seen = new Set<string>();
  return raw.map((entry, i) => {
    const o = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
    if (typeof o.id !== 'string' || !o.id || seen.has(o.id)) throw new Error(`question ${i}: missing or duplicate id`);
    if (o.answer !== 0 && o.answer !== 1 && o.answer !== 2) throw new Error(`question ${o.id}: answer must be 0, 1 or 2`);
    seen.add(o.id);
    return { id: o.id, answer: o.answer, vi: validateText(o.id, 'vi', o.vi), en: validateText(o.id, 'en', o.en) };
  });
}
```

- [ ] **Step 4: Replace `src/data/questions.json`**

The right answer is still first; the game shuffles. A native speaker must review the `vi` texts before the event.
```json
[
  { "id": "capital", "answer": 0, "en": { "q": "Vienna is the capital of which country?", "options": ["Austria", "Switzerland", "Germany"] }, "vi": { "q": "Vienna là thủ đô của quốc gia nào?", "options": ["Áo", "Thụy Sĩ", "Đức"] } },
  { "id": "danube", "answer": 0, "en": { "q": "Which river flows through Vienna?", "options": ["The Danube", "The Rhine", "The Seine"] }, "vi": { "q": "Con sông nào chảy qua Vienna?", "options": ["Sông Danube", "Sông Rhine", "Sông Seine"] } },
  { "id": "riesenrad", "answer": 0, "en": { "q": "What is the Riesenrad in the Prater?", "options": ["A giant Ferris wheel", "A royal palace", "A chocolate cake"] }, "vi": { "q": "Riesenrad trong công viên Prater là gì?", "options": ["Một vòng đu quay khổng lồ", "Một cung điện hoàng gia", "Một chiếc bánh sô-cô-la"] } },
  { "id": "sachertorte", "answer": 0, "en": { "q": "What is a Sachertorte?", "options": ["A chocolate cake", "A type of sausage", "A horse-drawn carriage"] }, "vi": { "q": "Sachertorte là gì?", "options": ["Một loại bánh sô-cô-la", "Một loại xúc xích", "Một chiếc xe ngựa"] } },
  { "id": "mozart", "answer": 0, "en": { "q": "Which famous composer lived and worked in Vienna?", "options": ["Wolfgang Amadeus Mozart", "Elvis Presley", "Freddie Mercury"] }, "vi": { "q": "Nhà soạn nhạc nổi tiếng nào từng sống và làm việc ở Vienna?", "options": ["Wolfgang Amadeus Mozart", "Elvis Presley", "Freddie Mercury"] } },
  { "id": "stephansdom", "answer": 0, "en": { "q": "What is the Stephansdom?", "options": ["Vienna's great cathedral", "A football stadium", "A ski resort"] }, "vi": { "q": "Stephansdom là gì?", "options": ["Nhà thờ lớn của Vienna", "Một sân vận động bóng đá", "Một khu trượt tuyết"] } },
  { "id": "schnitzel", "answer": 0, "en": { "q": "A classic Wiener Schnitzel is a thin, breaded, fried cutlet of…", "options": ["Veal", "Salmon", "Tofu"] }, "vi": { "q": "Món Wiener Schnitzel truyền thống là miếng thịt mỏng tẩm bột chiên, làm từ…", "options": ["Thịt bê", "Cá hồi", "Đậu phụ"] } },
  { "id": "schoenbrunn", "answer": 0, "en": { "q": "Schönbrunn Palace was the summer home of which royal family?", "options": ["The Habsburgs", "The Tudors", "The Medici"] }, "vi": { "q": "Cung điện Schönbrunn là nơi nghỉ hè của dòng họ hoàng gia nào?", "options": ["Nhà Habsburg", "Nhà Tudor", "Nhà Medici"] } },
  { "id": "waltz", "answer": 0, "en": { "q": "Which dance is Vienna most famous for?", "options": ["The waltz", "The tango", "The salsa"] }, "vi": { "q": "Vienna nổi tiếng nhất với điệu nhảy nào?", "options": ["Điệu valse", "Điệu tango", "Điệu salsa"] } },
  { "id": "currency", "answer": 0, "en": { "q": "Which currency do you pay with in Vienna?", "options": ["Euro", "Swiss franc", "Pound sterling"] }, "vi": { "q": "Ở Vienna, bạn trả tiền bằng đồng tiền nào?", "options": ["Euro", "Franc Thụy Sĩ", "Bảng Anh"] } },
  { "id": "melange", "answer": 0, "en": { "q": "In a Viennese coffee house, a \"Melange\" is…", "options": ["Coffee with milk foam", "A slice of cake", "A newspaper"] }, "vi": { "q": "Trong quán cà phê ở Vienna, \"Melange\" là…", "options": ["Cà phê với bọt sữa", "Một lát bánh ngọt", "Một tờ báo"] } },
  { "id": "fiaker", "answer": 0, "en": { "q": "What is a Fiaker?", "options": ["A horse-drawn carriage", "A pastry", "A tram ticket"] }, "vi": { "q": "Fiaker là gì?", "options": ["Một chiếc xe ngựa", "Một loại bánh ngọt", "Một vé xe điện"] } },
  { "id": "lipizzaner", "answer": 0, "en": { "q": "The Spanish Riding School in Vienna is famous for its white…", "options": ["Lipizzaner horses", "Swans", "Tigers"] }, "vi": { "q": "Trường dạy cưỡi ngựa Tây Ban Nha ở Vienna nổi tiếng với loài vật màu trắng nào?", "options": ["Ngựa Lipizzaner", "Thiên nga", "Hổ"] } },
  { "id": "kipferl", "answer": 0, "en": { "q": "Which famous pastry is said to descend from the Viennese Kipferl?", "options": ["The croissant", "The doughnut", "The muffin"] }, "vi": { "q": "Loại bánh nổi tiếng nào được cho là bắt nguồn từ bánh Kipferl của Vienna?", "options": ["Bánh sừng bò croissant", "Bánh donut", "Bánh muffin"] } },
  { "id": "blue-danube", "answer": 0, "en": { "q": "Who composed \"The Blue Danube\" waltz?", "options": ["Johann Strauss II", "Ludwig van Beethoven", "Taylor Swift"] }, "vi": { "q": "Ai đã sáng tác điệu valse \"Dòng Danube xanh\"?", "options": ["Johann Strauss II", "Ludwig van Beethoven", "Taylor Swift"] } },
  { "id": "ringstrasse", "answer": 0, "en": { "q": "What is the Ringstraße?", "options": ["A grand boulevard around the old town", "A boxing arena", "A shopping app"] }, "vi": { "q": "Ringstraße là gì?", "options": ["Đại lộ lớn bao quanh khu phố cổ", "Một sàn đấu quyền anh", "Một ứng dụng mua sắm"] } },
  { "id": "klimt", "answer": 0, "en": { "q": "Which Viennese painter created \"The Kiss\"?", "options": ["Gustav Klimt", "Pablo Picasso", "Vincent van Gogh"] }, "vi": { "q": "Họa sĩ Vienna nào đã vẽ bức tranh \"Nụ hôn\"?", "options": ["Gustav Klimt", "Pablo Picasso", "Vincent van Gogh"] } },
  { "id": "freud", "answer": 0, "en": { "q": "Which doctor, the father of psychoanalysis, lived in Vienna?", "options": ["Sigmund Freud", "Albert Einstein", "Isaac Newton"] }, "vi": { "q": "Vị bác sĩ nào, cha đẻ của phân tâm học, từng sống ở Vienna?", "options": ["Sigmund Freud", "Albert Einstein", "Isaac Newton"] } },
  { "id": "language", "answer": 0, "en": { "q": "What is the main language spoken in Vienna?", "options": ["German", "French", "Italian"] }, "vi": { "q": "Ngôn ngữ chính ở Vienna là gì?", "options": ["Tiếng Đức", "Tiếng Pháp", "Tiếng Ý"] } },
  { "id": "sisi", "answer": 0, "en": { "q": "Empress Elisabeth of Austria is better known by which nickname?", "options": ["Sisi", "Lady Di", "Queenie"] }, "vi": { "q": "Hoàng hậu Elisabeth của Áo được biết đến nhiều hơn với biệt danh nào?", "options": ["Sisi", "Lady Di", "Queenie"] } },
  { "id": "strudel", "answer": 0, "en": { "q": "What is the main fruit in a classic Apfelstrudel?", "options": ["Apple", "Banana", "Pineapple"] }, "vi": { "q": "Loại quả chính trong bánh Apfelstrudel truyền thống là gì?", "options": ["Táo", "Chuối", "Dứa"] } },
  { "id": "heuriger", "answer": 0, "en": { "q": "A Heuriger is a Viennese tavern that serves this year's new…", "options": ["Wine", "Sushi", "Ice cream"] }, "vi": { "q": "Heuriger là quán ở Vienna chuyên phục vụ thứ gì mới của năm nay?", "options": ["Rượu vang", "Sushi", "Kem"] } },
  { "id": "prater", "answer": 0, "en": { "q": "What is the Prater?", "options": ["A big park with an amusement park", "An opera singer", "A type of pastry"] }, "vi": { "q": "Prater là gì?", "options": ["Một công viên lớn có khu vui chơi", "Một ca sĩ opera", "Một loại bánh ngọt"] } },
  { "id": "opera", "answer": 0, "en": { "q": "Which world-famous opera house is in Vienna?", "options": ["The Vienna State Opera", "The Sydney Opera House", "La Scala"] }, "vi": { "q": "Nhà hát opera nổi tiếng thế giới nào nằm ở Vienna?", "options": ["Nhà hát Opera Quốc gia Vienna", "Nhà hát Opera Sydney", "Nhà hát La Scala"] } },
  { "id": "new-year", "answer": 0, "en": { "q": "The Vienna Philharmonic's most famous concert is held every year on…", "options": ["New Year's Day", "Halloween", "Valentine's Day"] }, "vi": { "q": "Buổi hòa nhạc nổi tiếng nhất của dàn nhạc Vienna Philharmonic diễn ra hằng năm vào…", "options": ["Ngày đầu năm mới", "Lễ Halloween", "Ngày lễ tình nhân"] } },
  { "id": "mozartkugel", "answer": 0, "en": { "q": "What is a Mozartkugel?", "options": ["A chocolate and marzipan sweet", "A musical instrument", "A bowling ball"] }, "vi": { "q": "Mozartkugel là gì?", "options": ["Một loại kẹo sô-cô-la nhân hạnh nhân", "Một nhạc cụ", "Một quả bóng bowling"] } },
  { "id": "tram", "answer": 0, "en": { "q": "What colours are most of Vienna's trams?", "options": ["Red and white", "Green and yellow", "All black"] }, "vi": { "q": "Phần lớn xe điện ở Vienna có màu gì?", "options": ["Đỏ và trắng", "Xanh lá và vàng", "Toàn màu đen"] } },
  { "id": "hofburg", "answer": 0, "en": { "q": "Who lived in the Hofburg palace for centuries?", "options": ["The Habsburg rulers", "Roman gladiators", "Pirates"] }, "vi": { "q": "Ai đã sống trong cung điện Hofburg suốt nhiều thế kỷ?", "options": ["Các vua chúa nhà Habsburg", "Đấu sĩ La Mã", "Cướp biển"] } },
  { "id": "beethoven", "answer": 0, "en": { "q": "Which composer wrote most of his famous symphonies while living in Vienna?", "options": ["Ludwig van Beethoven", "Frédéric Chopin", "Antonio Vivaldi"] }, "vi": { "q": "Nhà soạn nhạc nào đã viết phần lớn các bản giao hưởng nổi tiếng khi sống ở Vienna?", "options": ["Ludwig van Beethoven", "Frédéric Chopin", "Antonio Vivaldi"] } },
  { "id": "snow-globe", "answer": 0, "en": { "q": "Which popular souvenir was invented in Vienna?", "options": ["The snow globe", "The teddy bear", "The yo-yo"] }, "vi": { "q": "Món quà lưu niệm phổ biến nào được phát minh ở Vienna?", "options": ["Quả cầu tuyết", "Gấu bông", "Con quay yo-yo"] } },
  { "id": "water", "answer": 0, "en": { "q": "In a Viennese café, coffee traditionally comes with a small glass of…", "options": ["Water", "Orange juice", "Milk"] }, "vi": { "q": "Ở quán cà phê Vienna, cà phê theo truyền thống được phục vụ kèm một ly nhỏ…", "options": ["Nước lọc", "Nước cam", "Sữa"] } },
  { "id": "districts", "answer": 0, "en": { "q": "Vienna is divided into how many districts?", "options": ["23", "5", "100"] }, "vi": { "q": "Vienna được chia thành bao nhiêu quận?", "options": ["23", "5", "100"] } }
]
```

- [ ] **Step 5: The question screen speaks the current language**

Replace `src/ui/question.ts`:
```ts
import type { Question } from '../core/types';
import type { I18n } from '../i18n/i18n';
import { el } from './dom';

export class QuestionScreen {
  static readonly GRACE_MS = 400;
  readonly root = el('div', 'screen question');
  private title = el('p', 'q-bonus');
  private text = el('h2', 'q-text');
  private ring = el('div', 'q-ring');
  private ringNum = el('span');
  private buttons: HTMLButtonElement[] = [];
  private onPick: ((index: number) => void) | null = null;
  /** Answers are ignored until this time, so a lane tap that coincides with the question popping up can't pick one. */
  private armedAt = 0;

  constructor(parent: HTMLElement, private readonly i18n: I18n) {
    const card = el('div', 'paper-card question-card');
    const options = el('div', 'q-options');
    for (let i = 0; i < 3; i++) {
      const b = el('button', 'q-option');
      b.type = 'button';
      // pointerdown answers instantly on touch frames; click covers mouse and keyboard.
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.pick(i);
      });
      b.addEventListener('click', () => this.pick(i));
      this.buttons.push(b);
      options.append(b);
    }
    this.ring.append(this.ringNum);
    card.append(this.title, this.text, options, this.ring);
    this.root.append(card);
    this.root.dataset.ui = '';
    this.root.hidden = true;
    parent.append(this.root);
  }

  show(q: Question, basePoints: number, onPick: (index: number) => void): void {
    const text = q[this.i18n.lang];
    this.title.textContent = this.i18n.t('question.bonus', { base: basePoints, double: basePoints * 2 });
    this.text.textContent = text.q;
    text.options.forEach((o, i) => {
      const b = this.buttons[i];
      b.textContent = o;
      b.className = 'q-option';
      b.disabled = false;
    });
    this.onPick = onPick;
    this.armedAt = Date.now() + QuestionScreen.GRACE_MS;
    this.tick(1, 10);
    this.root.hidden = false;
  }

  tick(fraction: number, secondsLeft: number): void {
    this.ring.style.setProperty('--p', String(Math.max(0, Math.min(1, fraction))));
    const t = String(Math.ceil(secondsLeft));
    if (this.ringNum.textContent !== t) this.ringNum.textContent = t;
  }

  reveal(correct: number, picked: number | null): void {
    this.onPick = null;
    this.buttons.forEach((b, i) => {
      b.disabled = true;
      if (i === correct) b.classList.add('right');
      else if (i === picked) b.classList.add('wrong');
    });
    this.title.textContent = this.i18n.t(picked === null ? 'question.timeUp' : picked === correct ? 'question.right' : 'question.wrong');
  }

  hide(): void {
    this.onPick = null;
    this.root.hidden = true;
  }

  private pick(i: number): void {
    const cb = this.onPick;
    if (!cb || Date.now() < this.armedAt) return;
    this.onPick = null;
    cb(i);
  }
}
```

In `src/main.ts`:
- add `import { I18n } from './i18n/i18n';`
- add `const i18n = new I18n('vi');` as the first line of `boot()`
- change `question: new QuestionScreen(stage),` to `question: new QuestionScreen(stage, i18n),`.

- [ ] **Step 6: Run the tests and the type check**

Run: `npm test && npx tsc --noEmit`
Expected: PASS everywhere. The game tests still pass because they only read `Question.id`.

- [ ] **Step 7: Commit**

```bash
git add src/core/types.ts src/core/questions.ts src/data/questions.json src/ui/question.ts src/main.ts tests/core/questions.test.ts tests/ui/question.test.ts
git commit -m "feat(i18n): bilingual question bank and question screen"
```

---

### Task 9: Every visitor screen in Vietnamese, the VI | EN pill, and the reset to Vietnamese after each round

**Files:**
- Modify:
  - screens: `src/ui/labels.ts`, `src/ui/attract.ts`, `src/ui/howto.ts`, `src/ui/hud.ts`, `src/ui/results.ts`
  - app: `src/app/game.ts`, `src/app/watchdog.ts`
  - styles: `src/ui/styles.css`
- Test: `tests/ui/attract.test.ts`, `tests/ui/howto.test.ts`, `tests/ui/hud.test.ts`, `tests/ui/results.test.ts`, `tests/app/game.test.ts`, `tests/app/watchdog.test.ts`

**Interfaces:**
- Consumes: `I18n`, `StringKey`, `LANGS` (Task 7)
- Produces:
  - Screen constructors:
    - `new AttractScreen(parent, i18n, icons, logoUrl)`
    - `new HowtoScreen(parent, i18n)`
    - `new Hud(parent, i18n)`
    - `new ResultsScreen(parent, i18n, holdMs)`
  - `itemLabel(i18n, type)`
  - `GameOptions.i18n?: I18n` (default `new I18n('vi')`)
  - `WatchdogDeps.text?: (key: 'restart' | 'staff') => string`

- [ ] **Step 1: Write the failing tests**

Replace `tests/ui/hud.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { I18n } from '../../src/i18n/i18n';
import { Hud } from '../../src/ui/hud';

describe('Hud', () => {
  it('shows the score and route progress', () => {
    const hud = new Hud(document.body, new I18n('en'));
    hud.show(true);
    hud.update(25, 0.5);
    expect(hud.root.hidden).toBe(false);
    expect(hud.root.textContent).toContain('25');
    expect(hud.root.textContent).toContain('Points');
    expect(hud.root.querySelector<HTMLElement>('.bar i')?.style.width).toBe('50%');
  });
  it('re-labels when the language changes', () => {
    const i18n = new I18n('en');
    const hud = new Hud(document.body, i18n);
    i18n.set('vi');
    expect(hud.root.textContent).toContain('Điểm');
  });
});
```

Replace `tests/ui/howto.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { I18n } from '../../src/i18n/i18n';
import { HowtoScreen } from '../../src/ui/howto';

const visibleSteps = (s: HowtoScreen) => [...s.root.querySelectorAll('li')].filter((li) => !li.hidden);

describe('HowtoScreen', () => {
  it('explains bonus questions only when they are switched on', () => {
    const s = new HowtoScreen(document.body, new I18n('en'));
    s.showHowto(true);
    expect(visibleSteps(s)).toHaveLength(3);
    s.showHowto(false);
    expect(visibleSteps(s)).toHaveLength(2);
    expect(visibleSteps(s).map((li) => li.textContent).join(' ')).not.toMatch(/question/i);
  });
  it('speaks Vietnamese, including the "go" of the countdown', () => {
    const s = new HowtoScreen(document.body, new I18n('vi'));
    s.showHowto(true);
    expect(s.root.textContent).toContain('Cách chơi');
    s.showCount(0);
    expect(s.root.querySelector('.countdown')?.textContent).toBe('Chạy!');
  });
});
```

In `tests/ui/attract.test.ts`:
- add `import { I18n } from '../../src/i18n/i18n';`
- replace every `new AttractScreen(document.body, icons, …)` with `new AttractScreen(document.body, new I18n('en'), icons, …)`
- add these tests:
```ts
  it('is in Vietnamese by default, with a hint next to each treat', () => {
    const s = new AttractScreen(document.body, new I18n(), icons, null);
    s.configure(CONFIG, noGifts);
    expect(s.root.textContent).toContain('Chạm vào màn hình để chơi');
    expect(s.root.querySelector('.legend li span')?.textContent).toBe('Sachertortebánh sô-cô-la');
    expect(s.root.querySelector('.legend li small')?.textContent).toBe('bánh sô-cô-la');
  });
  it('switches language with the VI | EN pill without starting a game', () => {
    const i18n = new I18n();
    const s = new AttractScreen(document.body, i18n, icons, null);
    s.configure(CONFIG, noGifts);
    const pill = s.root.querySelector<HTMLButtonElement>('.lang-pill')!;
    expect(pill.closest('[data-ui]')).not.toBeNull();
    pill.click();
    expect(i18n.lang).toBe('en');
    expect(s.root.textContent).toContain('Tap anywhere to play');
    expect(pill.querySelector('.on')?.textContent).toBe('EN');
    pill.click();
    expect(i18n.lang).toBe('vi');
  });
```

In `tests/ui/results.test.ts`:
- add `import { I18n } from '../../src/i18n/i18n';`
- replace every `new ResultsScreen(document.body, 1000)` with `new ResultsScreen(document.body, new I18n('en'), 1000)`
- add:
```ts
  it('thanks the player in Vietnamese by default', () => {
    const s = new ResultsScreen(document.body, new I18n(), 1000);
    s.show({ score: 7, gift: null }, () => undefined);
    expect(s.root.textContent).toContain('Cảm ơn bạn đã chơi!');
    expect(s.root.textContent).toContain('Điểm của bạn');
  });
```

In `tests/app/game.test.ts`:
- add `import { I18n } from '../../src/i18n/i18n';`
- add:
```ts
  it('goes back to Vietnamese after every round', () => {
    const { world, ui } = fakes();
    const i18n = new I18n('vi');
    const game = new Game({ cfg: CONFIG, bank, world, ui, seed: 3, autoplay: true, i18n });
    i18n.set('en');
    clock(game).run(120);
    expect(game.cycles).toBeGreaterThanOrEqual(1);
    expect(i18n.lang).toBe('vi');
  });

  it('writes its popups and the finish banner in the current language', () => {
    const { world, ui } = fakes();
    const game = new Game({ cfg: CONFIG, bank, world, ui, seed: 3, autoplay: true, i18n: new I18n('vi') });
    clock(game).run(80);
    expect(ui.fx.banner).toHaveBeenCalledWith('Về đích!', expect.stringMatching(/^\d+ điểm$/), CONFIG.flow.finishSeconds);
  });
```

In `tests/app/watchdog.test.ts`, add inside `describe('installWatchdog', …)`:
```ts
  it('shows the restart card in the booth language', () => {
    const reload = vi.fn();
    const w = installWatchdog({ cfg: CONFIG.watchdog, canvas: document.createElement('canvas'), lastFrameAt: () => performance.now(), reload, text: (k) => (k === 'restart' ? 'Khởi động lại nhé!' : 'Tạm nghỉ') });
    w.restart('test');
    expect(document.body.textContent).toContain('Khởi động lại nhé!');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/ui tests/app`
Expected: FAIL. The constructors don't take `I18n` yet, there is no `.lang-pill`, the game ignores `i18n`, and the watchdog ignores `text`.

- [ ] **Step 3: Item labels from the translation table** (replace `src/ui/labels.ts`)

```ts
import type { ItemType } from '../core/types';
import type { I18n } from '../i18n/i18n';
import type { StringKey } from '../i18n/strings';

/** Original names, used on the English staff screens. */
export const ITEM_LABELS: Record<ItemType, string> = {
  sacher: 'Sachertorte',
  kipferl: 'Kipferl',
  melange: 'Melange',
  mozart: 'Mozartkugel',
  krampus: 'Krampus',
  bomb: 'Bomb',
};

const ITEM_KEYS: Record<ItemType, StringKey> = {
  sacher: 'item.sacher',
  kipferl: 'item.kipferl',
  melange: 'item.melange',
  mozart: 'item.mozart',
  krampus: 'item.krampus',
  bomb: 'item.bomb',
};

/** Visitor-facing item name: the original name, plus a Vietnamese hint in Vietnamese. */
export const itemLabel = (i18n: I18n, type: ItemType): string => i18n.t(ITEM_KEYS[type]);

/** +15, −10 (true minus sign), 0 */
export const formatPoints = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
```

- [ ] **Step 4: Localize the screens**

Replace `src/ui/hud.ts`:
```ts
import type { I18n } from '../i18n/i18n';
import { el } from './dom';

export class Hud {
  readonly root = el('div', 'hud');
  private scoreLabel = el('span', 'lbl');
  private routeLabel = el('span', 'lbl');
  private scoreEl = el('b', '', '0');
  private fill = el('i');
  private lastScore = -1;
  private lastFill = -1;

  constructor(parent: HTMLElement, private readonly i18n: I18n) {
    const score = el('div', 'hud-score');
    score.append(this.scoreLabel, this.scoreEl);
    const bar = el('div', 'bar');
    bar.append(this.fill);
    const route = el('div', 'hud-route');
    route.append(this.routeLabel, bar);
    this.root.append(score, route);
    this.root.hidden = true;
    parent.append(this.root);
    this.relabel();
    i18n.onChange(() => this.relabel());
  }

  show(on: boolean): void {
    this.root.hidden = !on;
  }

  update(score: number, progress: number): void {
    if (score !== this.lastScore) {
      this.lastScore = score;
      this.scoreEl.textContent = String(score);
    }
    const f = Math.round(progress * 200) / 2;
    if (f !== this.lastFill) {
      this.lastFill = f;
      this.fill.style.width = `${f}%`;
    }
  }

  private relabel(): void {
    this.scoreLabel.textContent = this.i18n.t('hud.points');
    this.routeLabel.textContent = this.i18n.t('hud.route');
  }
}
```

Replace `src/ui/howto.ts`:
```ts
import type { I18n } from '../i18n/i18n';
import { el } from './dom';

export class HowtoScreen {
  readonly root = el('div', 'screen howto');
  private card = el('div', 'paper-card howto-card');
  private count = el('div', 'countdown');
  private title = el('h2');
  private lanes = el('li');
  private items = el('li');
  private bonus = el('li');

  constructor(parent: HTMLElement, private readonly i18n: I18n) {
    const steps = el('ol');
    steps.append(this.lanes, this.items, this.bonus);
    this.card.append(this.title, steps);
    this.root.append(this.card, this.count);
    this.root.hidden = true;
    parent.append(this.root);
    this.relabel();
    i18n.onChange(() => this.relabel());
  }

  /** The rules card; the bonus-question line only shows when questions are switched on. */
  showHowto(questionsOn: boolean): void {
    this.bonus.hidden = !questionsOn;
    this.root.hidden = false;
    this.card.hidden = false;
    this.count.hidden = true;
  }

  /** 3, 2, 1… and "Go!" for 0. */
  showCount(n: number): void {
    const text = n > 0 ? String(n) : this.i18n.t('howto.go');
    this.root.hidden = false;
    this.card.hidden = true;
    this.count.hidden = false;
    if (this.count.textContent !== text) {
      this.count.textContent = text;
      this.count.style.animation = 'none';
      void this.count.offsetWidth;
      this.count.style.animation = '';
    }
  }

  hide(): void {
    this.root.hidden = true;
  }

  private relabel(): void {
    this.title.textContent = this.i18n.t('howto.title');
    this.lanes.textContent = this.i18n.t('howto.lanes');
    this.items.textContent = this.i18n.t('howto.items');
    this.bonus.textContent = this.i18n.t('howto.bonus');
  }
}
```

Replace `src/ui/attract.ts`:
```ts
import type { GameConfig } from '../config';
import type { Features } from '../core/settings';
import { BAD_TYPES, GOOD_TYPES, LANGS, type ItemType } from '../core/types';
import type { I18n } from '../i18n/i18n';
import { el } from './dom';
import { formatPoints, itemLabel } from './labels';

export class AttractScreen {
  readonly root = el('div', 'screen attract');
  private card = el('div', 'paper-card attract-card');
  private tagline = el('p', 'tagline');
  private legend = el('ul', 'legend');
  private ladder = el('ol', 'ladder');
  private cta = el('p', 'cta');
  private pill = el('button', 'lang-pill');
  private cfg: GameConfig | null = null;
  private features: Features = { showGifts: false, leaderboard: false };

  constructor(parent: HTMLElement, private readonly i18n: I18n, private readonly icons: Record<ItemType, string>, logoUrl: string | null) {
    if (logoUrl) {
      const logo = el('img', 'logo');
      logo.src = logoUrl;
      logo.alt = 'Vienna Run';
      this.card.append(logo);
    } else {
      this.card.append(el('h1', '', 'Vienna Run'));
    }
    this.ladder.hidden = true;
    this.card.append(this.tagline, this.legend, this.ladder, this.cta);
    // Language switch: an on-screen control, so pressing it never starts a game.
    this.pill.type = 'button';
    this.pill.dataset.ui = '';
    for (const lang of LANGS) {
      const s = el('span', '', lang.toUpperCase());
      s.dataset.lang = lang;
      this.pill.append(s);
    }
    this.pill.addEventListener('click', () => i18n.set(i18n.lang === 'vi' ? 'en' : 'vi'));
    this.root.append(this.card, this.pill);
    this.root.hidden = true;
    parent.append(this.root);
    this.render();
    i18n.onChange(() => this.render());
  }

  /** Point values, and the gift ladder when gifts are switched on, from the current settings. */
  configure(cfg: GameConfig, features: Features): void {
    this.cfg = cfg;
    this.features = features;
    this.render();
  }

  show(): void {
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  private render(): void {
    const { i18n } = this;
    this.tagline.textContent = i18n.t('attract.tagline');
    this.cta.textContent = i18n.t('attract.cta');
    this.pill.setAttribute('aria-label', i18n.t('lang.switch'));
    for (const s of this.pill.querySelectorAll<HTMLElement>('[data-lang]')) s.classList.toggle('on', s.dataset.lang === i18n.lang);
    const cfg = this.cfg;
    if (!cfg) return;
    this.legend.replaceChildren(
      ...[...GOOD_TYPES, ...BAD_TYPES].map((type) => {
        const li = el('li', cfg.items[type].good ? '' : 'bad');
        const img = el('img');
        img.src = this.icons[type];
        img.alt = '';
        // "Sachertorte · bánh sô-cô-la" shows as the name with the hint on a second, smaller line.
        const [name, hint] = itemLabel(i18n, type).split(' · ');
        const label = el('span', '', name);
        if (hint) label.append(el('small', '', hint));
        li.append(img, label, el('b', '', formatPoints(cfg.items[type].points)));
        return li;
      }),
    );
    this.ladder.replaceChildren(
      ...(this.features.showGifts ? cfg.tiers : []).map((t) => {
        const li = el('li');
        li.append(el('b', '', `${t.min}+`), el('span', '', t.name));
        return li;
      }),
    );
    this.ladder.hidden = !this.features.showGifts;
  }
}
```

In `src/ui/results.ts`:
- add `import type { I18n } from '../i18n/i18n';`
- add fields `private scoreLabel = el('span', 'lbl');` and `private holdLabel = el('span');`, and change the `thanks` field to `private thanks = el('p', 'r-thanks');`
- constructor signature: `constructor(parent: HTMLElement, private readonly i18n: I18n, private readonly holdMs: number) {`
- in the constructor, `scoreBox.append(el('span', 'lbl', 'Your score'), this.score);` becomes `scoreBox.append(this.scoreLabel, this.score);`, and `this.hold.append(this.holdFill, el('span', '', 'Hold for next player'));` becomes `this.hold.append(this.holdFill, this.holdLabel);`
- at the end of the constructor add:
```ts
    this.relabel();
    i18n.onChange(() => this.relabel());
```
- in `showGift`, `el('p', 'lbl', 'Your prize')` becomes `el('p', 'lbl', this.i18n.t('results.prize'))`
- add the method:
```ts
  private relabel(): void {
    this.scoreLabel.textContent = this.i18n.t('results.score');
    this.thanks.textContent = this.i18n.t('results.thanks');
    this.holdLabel.textContent = this.i18n.t('results.hold');
  }
```

In `src/ui/styles.css`, change the `.legend` rule's `grid-template-columns: repeat(6, auto);` to `grid-template-columns: repeat(6, minmax(0, 1fr));` (Vietnamese labels are longer and must wrap), and add after the `.cta` rules:
```css
.legend span { display: grid; text-align: center; line-height: 1.25; }
.legend small { font-size: 0.82em; color: var(--muted); }
.lang-pill { position: absolute; top: 3cqmin; right: 3cqmin; display: flex; padding: 0.5cqmin; gap: 0.4cqmin; border-radius: 99cqmin; border: 0.3cqmin solid var(--paper); background: rgba(29, 20, 17, 0.6); cursor: pointer; touch-action: manipulation; font: 600 2.6cqmin var(--font-body); }
.lang-pill span { padding: 0.8cqmin 2.2cqmin; border-radius: 99cqmin; color: var(--paper); }
.lang-pill span.on { background: var(--paper); color: var(--ink); }
```

- [ ] **Step 5: The game speaks the booth language and resets it** (edit `src/app/game.ts`)

1. Add `import { I18n } from '../i18n/i18n';`.
2. In `GameOptions`, add:
```ts
  /** The booth language; reset to Vietnamese after every round. */
  i18n?: I18n;
```
3. Add a field `private readonly i18n: I18n;`, and set `this.i18n = o.i18n ?? new I18n('vi');` as the first line of the constructor.
4. In `enter`, `case 'attract':`, replace `if (prev === 'results') this.cycles++;` with:
```ts
        if (prev === 'results') {
          this.cycles++;
          this.i18n.set('vi');
        }
```
5. `ui.fx.popup('Go!', 'neutral', …)` becomes `ui.fx.popup(this.i18n.t('fx.go'), 'neutral', this.o.world.playerScreen());`.
6. `ui.fx.banner('Finish!', `${this.run.score} points`, cfg.flow.finishSeconds);` becomes `ui.fx.banner(this.i18n.t('finish.title'), this.i18n.t('finish.points', { score: this.run.score }), cfg.flow.finishSeconds);`.
7. In `answered`, `'No points'` becomes `this.i18n.t('fx.noPoints')`.

- [ ] **Step 6: Watchdog cards in the booth language** (edit `src/app/watchdog.ts`)

Add to `WatchdogDeps`:
```ts
  /** Card texts in the booth language; English when not given. */
  text?: (key: 'restart' | 'staff') => string;
```
In `installWatchdog`, add after `const reload = …`:
```ts
  const text = d.text ?? ((key: 'restart' | 'staff') => (key === 'restart' ? "Let's restart!" : 'Short break. Please ask the staff.'));
```
and change `card("Let's restart!");` to `card(text('restart'));` and `card('Short break. Please ask the staff.');` to `card(text('staff'));`.

- [ ] **Step 7: Keep `main.ts` compiling**

In `src/main.ts`, pass `i18n` to every screen:
```ts
    hud: new Hud(stage, i18n),
    fx: new Fx(stage),
    attract: new AttractScreen(stage, i18n, icons, art.url('logo')),
    howto: new HowtoScreen(stage, i18n),
    question: new QuestionScreen(stage, i18n),
    results: new ResultsScreen(stage, i18n, CONFIG.flow.holdSeconds * 1000),
```

- [ ] **Step 8: Run the unit tests and the type check**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, with no type errors.

- [ ] **Step 9: Commit**

```bash
git add src/ui/labels.ts src/ui/attract.ts src/ui/howto.ts src/ui/hud.ts src/ui/results.ts src/ui/styles.css src/app/game.ts src/app/watchdog.ts src/main.ts tests/ui tests/app
git commit -m "feat(i18n): Vietnamese screens, VI|EN switch, reset to Vietnamese after each round"
```

---

### Task 10: Wire the language into the booth, end-to-end test, deploy (Phase B)

**Files:**
- Modify: `src/main.ts`, `README.md`
- Test: `tests/e2e/language.spec.ts` (new)

**Interfaces:**
- Consumes: everything from Tasks 7–9

- [ ] **Step 1: Write the failing end-to-end test** (`tests/e2e/language.spec.ts`)

```ts
import { expect, test } from '@playwright/test';

test('Vietnamese by default, English on request, and Vietnamese again for the next player', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?speed=8&seed=5');
  await page.waitForFunction(() => (window as any).__vr?.screen === 'attract', null, { timeout: 60_000 });
  const cta = page.locator('.attract .cta');
  await expect(cta).toHaveText('Chạm vào màn hình để chơi');
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('vi');
  expect(await page.evaluate(async () => (await document.fonts.load('16px "Be Vietnam Pro"', 'Điểm')).length)).toBeGreaterThan(0);

  await page.locator('.lang-pill').click();
  await expect(cta).toHaveText('Tap anywhere to play');
  expect(await page.evaluate(() => (window as any).__vr.screen)).toBe('attract');

  const vp = page.viewportSize()!;
  await page.mouse.click(vp.width / 2, vp.height / 2);
  await expect(page.locator('.howto h2')).toHaveText('How to play');
  await page.waitForFunction(() => (window as any).__vr?.cycles >= 1, null, { timeout: 120_000 });
  await expect(cta).toHaveText('Chạm vào màn hình để chơi');
  expect(errors).toEqual([]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test tests/e2e/language.spec.ts`
Expected: FAIL at the last check. The game keeps its own language copy, so the start screen stays in English after the round.

- [ ] **Step 3: Wire it in `src/main.ts`**

1. Add `i18n,` to the `new Game({ … })` options.
2. Give the watchdog the booth language: in `installWatchdog({ … })`, add `text: (k) => i18n.t(k === 'restart' ? 'watchdog.restart' : 'watchdog.staff'),`.
3. After `const i18n = new I18n('vi');`, keep the page language in step for fonts and screen readers:
```ts
  const syncLang = () => {
    document.documentElement.lang = i18n.lang;
  };
  syncLang();
  i18n.onChange(syncLang);
```

In `README.md`, add after the staff settings section:
```markdown
## Languages
The game starts in **Vietnamese**. The **VI | EN** pill on the start screen switches to English for one
player; the game returns to Vietnamese after every round. Texts live in `src/i18n/strings.ts`, and
questions (both languages) in `src/data/questions.json`. The Vietnamese texts were machine-written:
**have a native speaker review them before the event.**
```

- [ ] **Step 4: Run everything**

Run: `npx tsc --noEmit && npm test && npx playwright test tests/e2e/language.spec.ts tests/e2e/settings.spec.ts tests/e2e/smoke.spec.ts`
Expected: no type errors, unit tests PASS, and the three browser tests PASS.

- [ ] **Step 5: Commit and deploy Phase B**

```bash
git add src/main.ts README.md tests/e2e/language.spec.ts
git commit -m "feat: Vietnamese-first booth with a VI|EN switch"
git push origin main
```
Deploy with the Vercel MCP `create_deployment` (Global Constraints). Wait until `READY`, then check the live bundle:
```bash
curl -s https://vienna-run.vercel.app/ | grep -o 'assets/index-[^"]*\.js' | head -1 | xargs -I{} curl -s https://vienna-run.vercel.app/{} | grep -c 'Chạm vào màn hình để chơi'
```
Expected: `1` or more. Send the user the link and remind them about the native-speaker review.

---

## Phase C: Leaderboard (Supabase, offline-first)

### Task 11: Database migration on deploy, and Supabase settings in the hosted build only

**Files:**
- Create: `scripts/migrate-db.ts`, `src/scores/env.ts`
- Modify: `package.json` / `package-lock.json` (`pg`, `@types/pg`, scripts), `vite.config.ts`, `src/vite-env.d.ts`
- Test: `tests/scripts/migrate-db.test.ts`, `tests/scores/env.test.ts`, `tests/build/env-exposure.test.ts`

**Interfaces:**
- Produces:
  - `SQL`, `TABLE`, `databaseUrls(env): string[]`
  - `migrate(urls, log?, factory?): Promise<'migrated' | 'skipped' | 'failed'>`
  - `RemoteConfig = { url: string; key: string }`, `remoteConfigFrom(env): RemoteConfig | null`
  - npm scripts `vercel-build` and `migrate-db`

- [ ] **Step 1: Write the failing tests**

`tests/scripts/migrate-db.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { databaseUrls, migrate, SQL } from '../../scripts/migrate-db';

const client = (over: Partial<{ connect(): Promise<unknown>; query(sql: string): Promise<unknown>; end(): Promise<void> }> = {}) => ({
  connect: async () => undefined,
  query: async () => undefined,
  end: async () => undefined,
  ...over,
});

describe('migrate-db', () => {
  it('skips cleanly without a database address', async () => {
    const log = vi.fn();
    expect(await migrate([], log)).toBe('skipped');
    expect(log.mock.calls[0][0]).toMatch(/skipping/);
  });
  it('prefers the direct connection and falls back to the pooled one', () => {
    expect(databaseUrls({ POSTGRES_URL: 'b', POSTGRES_URL_NON_POOLING: 'a' })).toEqual(['a', 'b']);
    expect(databaseUrls({ POSTGRES_URL: 'b', POSTGRES_URL_NON_POOLING: ' ' })).toEqual(['b']);
    expect(databaseUrls({})).toEqual([]);
  });
  it('runs the SQL once and closes the connection', async () => {
    const queries: string[] = [];
    const end = vi.fn(async () => undefined);
    const factory = () => client({ query: async (sql: string) => queries.push(sql), end });
    expect(await migrate(['postgres://u:secret@db.example.com:5432/postgres'], vi.fn(), factory)).toBe('migrated');
    expect(queries).toEqual([SQL]);
    expect(end).toHaveBeenCalledTimes(1);
  });
  it('tries the next address after a failure, never throws, and never logs the password', async () => {
    const log = vi.fn();
    const factory = (url: string) => client({ connect: async () => { if (url.includes('direct')) throw new Error('ENETUNREACH'); } });
    expect(await migrate(['postgres://u:secret@direct.example.com/db', 'postgres://u:secret@pool.example.com/db'], log, factory)).toBe('migrated');
    const failing = () => client({ connect: async () => { throw new Error('down'); } });
    expect(await migrate(['postgres://u:secret@x.example.com/db'], log, failing)).toBe('failed');
    const all = log.mock.calls.flat().join('\n');
    expect(all).toContain('direct.example.com');
    expect(all).not.toContain('secret');
  });
  it('creates the table with every rule, and lets the public key only add and read scores', () => {
    for (const part of [
      'create table if not exists public.vienna_run_scores',
      'id uuid primary key',
      "board ~ '^[a-z0-9-]{1,24}$'",
      'score between 0 and 5000',
      "name ~ '^[A-Za-z0-9 _-]{1,12}$'",
      "preset in ('easy', 'normal', 'hard', 'custom')",
      "lang in ('vi', 'en')",
      'char_length(device) <= 40',
      'inserted_at timestamptz not null default now()',
      '(board, score desc, created_at)',
      'enable row level security',
      'grant select, insert on table public.vienna_run_scores to anon',
      'for insert to anon with check (true)',
      'for select to anon using (true)',
      "notify pgrst, 'reload schema'",
    ]) expect(SQL).toContain(part);
    expect(SQL).not.toMatch(/grant[^;]*(update|delete)/i);
  });
});
```

`tests/scores/env.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { remoteConfigFrom } from '../../src/scores/env';

describe('remoteConfigFrom', () => {
  it('reads the Supabase address and public key from the Vercel integration', () => {
    expect(remoteConfigFrom({ NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co/', NEXT_PUBLIC_SUPABASE_ANON_KEY: ' k1 ' })).toEqual({ url: 'https://abc.supabase.co', key: 'k1' });
  });
  it('falls back to the publishable key', () => {
    expect(remoteConfigFrom({ NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' })?.key).toBe('sb_publishable_x');
  });
  it('stays local-only without both values, or with an address that is not https', () => {
    expect(remoteConfigFrom({})).toBeNull();
    expect(remoteConfigFrom({ NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co' })).toBeNull();
    expect(remoteConfigFrom({ NEXT_PUBLIC_SUPABASE_URL: 'http://abc.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'k' })).toBeNull();
    expect(remoteConfigFrom({ NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'k' })).toBeNull();
  });
});
```

`tests/build/env-exposure.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import config from '../../vite.config';

type Resolved = { envPrefix?: string | string[] };
const resolve = (mode: string) =>
  (config as unknown as (env: { mode: string; command: 'build'; isSsrBuild: boolean; isPreview: boolean }) => Resolved)({ mode, command: 'build', isSsrBuild: false, isPreview: false });

describe('environment exposure', () => {
  it('gives only the hosted build the public Supabase settings', () => {
    expect(resolve('production').envPrefix).toEqual(['VITE_', 'NEXT_PUBLIC_']);
    expect(resolve('offline').envPrefix).toBe('VITE_');
  });
  it('never exposes server-only secrets to the browser', () => {
    for (const mode of ['production', 'offline']) {
      for (const prefix of [resolve(mode).envPrefix ?? []].flat()) expect(['', 'SUPABASE_', 'POSTGRES_']).not.toContain(prefix);
    }
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/scripts tests/scores tests/build`
Expected: FAIL. The modules can't be resolved, and `envPrefix` is undefined.

- [ ] **Step 3: Install `pg` for the build-time migration**

Run: `npm install --save-dev --save-exact pg@8.23.1 @types/pg@8.23.1`
Expected: both are added to `devDependencies`. If `@types/pg@8.23.1` does not exist, install the newest `@types/pg` 8.x with `--save-exact` and ledger the version.

- [ ] **Step 4: Write `scripts/migrate-db.ts`**

```ts
import { pathToFileURL } from 'node:url';
import pg from 'pg';

export const TABLE = 'vienna_run_scores';

/** Idempotent: safe to run on every deploy. The public (anon) key may only add and read rows. */
export const SQL = `
create table if not exists public.vienna_run_scores (
  id uuid primary key,
  created_at timestamptz not null,
  board text not null check (board ~ '^[a-z0-9-]{1,24}$'),
  score integer not null check (score between 0 and 5000),
  name text check (name is null or name ~ '^[A-Za-z0-9 _-]{1,12}$'),
  preset text not null check (preset in ('easy', 'normal', 'hard', 'custom')),
  lang text not null check (lang in ('vi', 'en')),
  questions_on boolean not null,
  device text not null check (char_length(device) <= 40),
  inserted_at timestamptz not null default now()
);
create index if not exists vienna_run_scores_board_score_idx on public.vienna_run_scores (board, score desc, created_at);
alter table public.vienna_run_scores enable row level security;
revoke all on table public.vienna_run_scores from anon, authenticated;
grant select, insert on table public.vienna_run_scores to anon;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vienna_run_scores' and policyname = 'vienna_run_scores_insert') then
    create policy vienna_run_scores_insert on public.vienna_run_scores for insert to anon with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vienna_run_scores' and policyname = 'vienna_run_scores_select') then
    create policy vienna_run_scores_select on public.vienna_run_scores for select to anon using (true);
  end if;
end
$$;
notify pgrst, 'reload schema';
`;

export interface DbClient {
  connect(): Promise<unknown>;
  query(sql: string): Promise<unknown>;
  end(): Promise<void>;
}
export type ClientFactory = (connectionString: string) => DbClient;

// Supabase certificates are signed by Supabase's own authority: encrypt, but don't verify the chain.
const pgClient: ClientFactory = (url) => {
  const u = new URL(url);
  u.searchParams.delete('sslmode');
  return new pg.Client({ connectionString: u.toString(), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10_000, statement_timeout: 20_000 });
};

/** Database addresses from the Vercel Supabase integration, direct connection first. */
export function databaseUrls(env: Record<string, string | undefined>): string[] {
  return [env.POSTGRES_URL_NON_POOLING, env.POSTGRES_URL].filter((u): u is string => typeof u === 'string' && u.trim() !== '');
}

const hostOf = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return '(unreadable address)';
  }
};

/** Creates the scores table if needed. Never throws: a failed migration must not fail the deploy. */
export async function migrate(urls: readonly string[], log: (msg: string) => void = console.log, factory: ClientFactory = pgClient): Promise<'migrated' | 'skipped' | 'failed'> {
  if (urls.length === 0) {
    log('[migrate-db] No POSTGRES_URL set: skipping (the leaderboard stays on each device).');
    return 'skipped';
  }
  for (const url of urls) {
    let client: DbClient | null = null;
    try {
      client = factory(url);
      await client.connect();
      await client.query(SQL);
      log(`[migrate-db] Table ${TABLE} is ready (via ${hostOf(url)}).`);
      return 'migrated';
    } catch (e) {
      log(`[migrate-db] Could not migrate via ${hostOf(url)}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      await client?.end().catch(() => undefined);
    }
  }
  log('[migrate-db] WARNING: migration failed. The build continues; scores stay on each device until a later deploy succeeds.');
  return 'failed';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void migrate(databaseUrls(process.env)).then(() => process.exit(0));
}
```

- [ ] **Step 5: Expose the public Supabase settings to the hosted build only**

`src/scores/env.ts`:
```ts
export interface RemoteConfig {
  url: string;
  key: string;
}

/**
 * Supabase address and public key from the build environment (the Vercel integration's NEXT_PUBLIC_* values),
 * or null: the USB copy, local builds, or values that look wrong. Null means a local-only leaderboard.
 */
export function remoteConfigFrom(env: Record<string, unknown>): RemoteConfig | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (typeof url !== 'string' || typeof key !== 'string' || !key.trim()) return null;
  const clean = url.trim().replace(/\/+$/, '');
  if (!/^https:\/\/[^/\s]+$/.test(clean)) return null;
  return { url: clean, key: key.trim() };
}
```

In `vite.config.ts`, add inside the returned object, before `define`:
```ts
    // The hosted build gets the Supabase address and public key (NEXT_PUBLIC_*, from the Vercel integration).
    // The USB copy gets nothing, so it runs a local-only leaderboard. Server secrets never match these prefixes.
    envPrefix: offline ? 'VITE_' : ['VITE_', 'NEXT_PUBLIC_'],
```

Append to `src/vite-env.d.ts`:
```ts
interface ImportMetaEnv {
  readonly NEXT_PUBLIC_SUPABASE_URL?: string;
  readonly NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  readonly NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
}
```

In `package.json` `scripts`, add:
```json
    "migrate-db": "tsx scripts/migrate-db.ts",
    "vercel-build": "tsx scripts/migrate-db.ts && npm run build",
```

- [ ] **Step 6: Run the tests, the type check and the script**

Run: `npx vitest run tests/scripts tests/scores tests/build && npx tsc --noEmit && npm run migrate-db`
Expected:
- the tests PASS, with no type errors;
- the script prints `[migrate-db] No POSTGRES_URL set: skipping …` and exits 0.

- [ ] **Step 7: Commit**

```bash
git add scripts/migrate-db.ts src/scores/env.ts vite.config.ts src/vite-env.d.ts package.json package-lock.json tests/scripts tests/scores/env.test.ts tests/build
git commit -m "feat(db): create the Supabase scores table on deploy; public settings in the hosted build only"
```

---

### Task 12: Code names, board names, and the Supabase REST adapter

**Files:**
- Create: `src/scores/types.ts`, `src/scores/names.ts`, `src/scores/remote.ts`
- Modify: `src/core/settings.ts` (export `BOARD_RE`)
- Test: `tests/scores/names.test.ts`, `tests/scores/remote.test.ts`

**Interfaces:**
- Consumes:
  - `RemoteConfig` (Task 11)
  - `Preset`, `BOARD_RE` (Task 3)
  - `Lang` (Task 7)
- Produces:
  - `Range = 'today' | 'all'`
  - `ScoreEntry`
  - `BoardRow = { id; at; name; score }`
  - `SyncStatus = { mode: 'online' | 'offline' | 'local-only' | 'connecting'; pending; lastSyncAt }`
  - `NAME_RE`, `cleanNameInput(raw)`, `finalName(raw): string | null`, `nextBoardName(board)`
  - `FetchFn`, `Remote { insert(entries); top(board, since, n) }`
  - `createSupabaseRemote(cfg, fetchFn?, timeoutMs?)`, `toRow(entry)`

- [ ] **Step 1: Write the failing tests**

`tests/scores/names.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { BOARD_RE } from '../../src/core/settings';
import { cleanNameInput, finalName, nextBoardName } from '../../src/scores/names';

describe('cleanNameInput', () => {
  it.each([
    ['Anna', 'Anna'],
    ['Đức Anh', 'Duc Anh'],
    ['Nguyễn Thị Hương', 'Nguyen Thi H'],
    ['a!@#b', 'ab'],
    ['  lead', 'lead'],
    ['x  y', 'x y'],
    ['team_7-B', 'team_7-B'],
    ['😀Ok', 'Ok'],
    ['<b>x</b>', 'bxb'],
  ])('%s → %s', (raw, out) => {
    expect(cleanNameInput(raw)).toBe(out);
  });
});

describe('finalName', () => {
  it('trims and accepts 1–12 allowed characters', () => {
    expect(finalName(' Bo ')).toBe('Bo');
    expect(finalName('ABCDEFGHIJKLMNOP')).toBe('ABCDEFGHIJKL');
  });
  it('returns null when nothing usable is left', () => {
    expect(finalName('   ')).toBeNull();
    expect(finalName('!!!')).toBeNull();
    expect(finalName('')).toBeNull();
  });
});

describe('nextBoardName', () => {
  it.each([
    ['booth', 'booth-2'],
    ['booth-2', 'booth-3'],
    ['test-9', 'test-10'],
    ['a-b', 'a-b-2'],
  ])('%s → %s', (board, next) => {
    expect(nextBoardName(board)).toBe(next);
  });
  it('always gives a valid board name', () => {
    const long = 'x'.repeat(24);
    expect(nextBoardName(long)).toMatch(BOARD_RE);
    expect(nextBoardName(long)).toHaveLength(24);
  });
});
```

`tests/scores/remote.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { createSupabaseRemote, toRow, type FetchFn } from '../../src/scores/remote';
import type { ScoreEntry } from '../../src/scores/types';

const cfg = { url: 'https://abc.supabase.co', key: 'pub-key' };
const entry = (over: Partial<ScoreEntry> = {}): ScoreEntry => ({
  id: '00000000-0000-4000-8000-000000000001', at: '2026-10-03T03:00:00.000Z', board: 'booth', score: 120, name: 'Anna',
  preset: 'normal', lang: 'vi', questionsOn: true, device: 'dev-1', final: true, uploaded: false, ...over,
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('Supabase remote', () => {
  it('uploads rounds so that repeats of earlier uploads are ignored', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => json([{ id: entry().id }], 201));
    await createSupabaseRemote(cfg, fetchFn).insert([entry()]);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://abc.supabase.co/rest/v1/vienna_run_scores?on_conflict=id&select=id');
    expect(init.method).toBe('POST');
    const h = init.headers as Record<string, string>;
    expect(h.apikey).toBe('pub-key');
    expect(h.Authorization).toBe('Bearer pub-key');
    expect(h.Prefer).toContain('resolution=ignore-duplicates');
    expect(JSON.parse(init.body as string)).toEqual([
      { id: entry().id, created_at: '2026-10-03T03:00:00.000Z', board: 'booth', score: 120, name: 'Anna', preset: 'normal', lang: 'vi', questions_on: true, device: 'dev-1' },
    ]);
  });

  it.each<[string, FetchFn]>([
    ['a server error', async () => json({ message: 'boom' }, 500)],
    ['a missing table', async () => json({ message: 'relation does not exist' }, 404)],
    ['a wrong key', async () => json({ message: 'Invalid API key' }, 401)],
    ['a captive portal page', async () => new Response('<html>Log in to the Wi-Fi</html>', { status: 200 })],
    ['an unexpected answer', async () => json({ ok: true }, 201)],
    ['no network', async () => { throw new TypeError('Failed to fetch'); }],
  ])('treats %s as a failed upload', async (_name, fetchFn) => {
    await expect(createSupabaseRemote(cfg, fetchFn).insert([entry()])).rejects.toThrow();
  });

  it('gives up on a request that hangs', async () => {
    const hang: FetchFn = (_url, init) => new Promise<Response>((_, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
    await expect(createSupabaseRemote(cfg, hang, 30).insert([entry()])).rejects.toThrow();
    await expect(createSupabaseRemote(cfg, hang, 30).top('booth', null, 10)).rejects.toThrow();
  });

  it('asks for the best named rounds of one board', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => json([{ id: 'a', created_at: '2026-10-03T03:00:00+00:00', name: 'Anna', score: 120 }]));
    const rows = await createSupabaseRemote(cfg, fetchFn).top('booth', '2026-10-02T17:00:00.000Z', 10);
    expect(rows).toEqual([{ id: 'a', at: '2026-10-03T03:00:00+00:00', name: 'Anna', score: 120 }]);
    const url = new URL(fetchFn.mock.calls[0][0]);
    expect(url.pathname).toBe('/rest/v1/vienna_run_scores');
    expect(url.searchParams.get('board')).toBe('eq.booth');
    expect(url.searchParams.get('name')).toBe('not.is.null');
    expect(url.searchParams.get('order')).toBe('score.desc,created_at.asc');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(url.searchParams.get('created_at')).toBe('gte.2026-10-02T17:00:00.000Z');
    await createSupabaseRemote(cfg, fetchFn).top('booth', null, 10);
    expect(new URL(fetchFn.mock.calls[1][0]).searchParams.has('created_at')).toBe(false);
  });

  it('rejects a board answer with broken rows', async () => {
    await expect(createSupabaseRemote(cfg, async () => json([{ id: 'a' }])).top('booth', null, 10)).rejects.toThrow();
  });

  it('only sends values the database accepts', () => {
    expect(toRow(entry({ score: 99999, name: 'bad<name>', board: 'Bad Board', device: 'd'.repeat(80) }))).toMatchObject({ score: 5000, name: null, board: 'booth', device: 'd'.repeat(40) });
    expect(toRow(entry({ score: -5 })).score).toBe(0);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/scores/names.test.ts tests/scores/remote.test.ts`
Expected: FAIL, because the modules can't be resolved.

- [ ] **Step 3: Write the modules**

In `src/core/settings.ts`, change `const BOARD_RE = /^[a-z0-9-]{1,24}$/;` to `export const BOARD_RE = /^[a-z0-9-]{1,24}$/;`.

`src/scores/types.ts`:
```ts
import type { Preset } from '../core/settings';
import type { Lang } from '../core/types';

export type Range = 'today' | 'all';

/** One finished round, as kept on this device. */
export interface ScoreEntry {
  id: string;
  /** When the round finished (ISO time). */
  at: string;
  board: string;
  score: number;
  /** Code name, or null if the player did not save one. Only named rounds appear on boards. */
  name: string | null;
  preset: Preset;
  lang: Lang;
  questionsOn: boolean;
  device: string;
  /** The results screen has closed, so the round is ready to upload. */
  final: boolean;
  uploaded: boolean;
}

/** One line of a leaderboard. */
export interface BoardRow {
  id: string;
  at: string;
  name: string;
  score: number;
}

export interface SyncStatus {
  /** 'connecting' until the first attempt finishes; 'local-only' without Supabase details (USB copy). */
  mode: 'online' | 'offline' | 'local-only' | 'connecting';
  /** Finished rounds not uploaded yet. */
  pending: number;
  lastSyncAt: string | null;
}
```

`src/scores/names.ts`:
```ts
export const NAME_RE = /^[A-Za-z0-9 _-]{1,12}$/;

/**
 * What a code name may contain, applied as the player types: Vietnamese letters lose their accents
 * (Đức → Duc), anything else outside A–Z, a–z, 0–9, space, "-" and "_" is dropped, max 12 characters.
 */
export function cleanNameInput(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9 _-]/g, '')
    .replace(/ {2,}/g, ' ')
    .replace(/^ +/, '')
    .slice(0, 12);
}

/** The name to store, or null when nothing usable is left. */
export function finalName(raw: string): string | null {
  const name = cleanNameInput(raw).trim();
  return NAME_RE.test(name) ? name : null;
}

/** "booth" → "booth-2" → "booth-3": a fresh, empty board; old scores stay in the database. */
export function nextBoardName(board: string): string {
  const m = /^(.*?)-(\d+)$/.exec(board);
  const base = m ? m[1] : board;
  const suffix = `-${m ? Number(m[2]) + 1 : 2}`;
  return `${base.slice(0, 24 - suffix.length) || 'board'}${suffix}`;
}
```

`src/scores/remote.ts`:
```ts
import { BOARD_RE } from '../core/settings';
import type { RemoteConfig } from './env';
import { NAME_RE } from './names';
import type { BoardRow, ScoreEntry } from './types';

export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

export interface Remote {
  /** Uploads rounds. Rounds uploaded before are ignored, so a retry never duplicates. Rejects on any failure. */
  insert(entries: readonly ScoreEntry[]): Promise<void>;
  /** A board's best named rounds, best first; `since` keeps only rounds from that time on. Rejects on any failure. */
  top(board: string, since: string | null, n: number): Promise<BoardRow[]>;
}

/** The table row for a round, with every value forced into what the database accepts. */
export function toRow(e: ScoreEntry) {
  return {
    id: e.id,
    created_at: e.at,
    board: BOARD_RE.test(e.board) ? e.board : 'booth',
    score: Math.max(0, Math.min(5000, Math.round(e.score))),
    name: e.name !== null && NAME_RE.test(e.name) ? e.name : null,
    preset: e.preset,
    lang: e.lang,
    questions_on: e.questionsOn,
    device: e.device.slice(0, 40),
  };
}

function toBoardRow(raw: unknown): BoardRow {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.created_at !== 'string' || typeof r.name !== 'string' || typeof r.score !== 'number') {
    throw new Error('Supabase: unexpected row');
  }
  return { id: r.id, at: r.created_at, name: r.name, score: r.score };
}

/** Plain REST calls to Supabase (no SDK). Every request gives up after `timeoutMs`. */
export function createSupabaseRemote(cfg: RemoteConfig, fetchFn: FetchFn = (url, init) => fetch(url, init), timeoutMs = 5000): Remote {
  const endpoint = `${cfg.url}/rest/v1/vienna_run_scores`;
  const auth = { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` };

  async function call(url: string, init: RequestInit): Promise<unknown[]> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchFn(url, { ...init, signal: ctrl.signal, cache: 'no-store' });
      const text = await res.text();
      if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 200)}`);
      // A Wi-Fi login page answers 200 with HTML; only a JSON list counts as success.
      const data: unknown = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error('Supabase: unexpected answer');
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async insert(entries) {
      if (entries.length === 0) return;
      await call(`${endpoint}?on_conflict=id&select=id`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify(entries.map(toRow)),
      });
    },
    async top(board, since, n) {
      const q = new URLSearchParams({ select: 'id,created_at,name,score', board: `eq.${board}`, name: 'not.is.null', order: 'score.desc,created_at.asc', limit: String(n) });
      if (since) q.append('created_at', `gte.${since}`);
      const data = await call(`${endpoint}?${q.toString()}`, { method: 'GET', headers: auth });
      return data.map(toBoardRow);
    },
  };
}
```

- [ ] **Step 4: Run the tests and the type check**

Run: `npx vitest run tests/scores && npx tsc --noEmit`
Expected: PASS, with no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/scores/types.ts src/scores/names.ts src/scores/remote.ts src/core/settings.ts tests/scores/names.test.ts tests/scores/remote.test.ts
git commit -m "feat(scores): code names, board names and the Supabase REST adapter"
```

---

### Task 13: The offline-first score store

**Files:**
- Create: `src/scores/ids.ts`, `src/scores/store.ts`
- Test: `tests/scores/ids.test.ts`, `tests/scores/store.test.ts`

**Interfaces:**
- Consumes:
  - `Remote`, `toRow` (Task 12)
  - `finalName` (Task 12)
  - `ScoreEntry`, `BoardRow`, `Range`, `SyncStatus` (Task 12)
  - `readJson`, `writeJson`, `safeLocalStorage` (`src/app/storage.ts`)
- Produces:
  - `uuid()`, `deviceId(storage?)`
  - `SCORES_KEY`, `BOARD_CACHE_KEY`, `MAX_ENTRIES = 5000`
  - `NewRound = { score; preset; lang; questionsOn }`
  - `dayKey(date)`, `compareRows(a, b)`
  - `class ScoreStore`:
    - fields and lifecycle: `available`, `currentBoard`, `setBoard`, `onChange`
    - rounds: `addRound`, `saveName`, `finalize`, `finalizeStale`
    - boards: `top`, `rankOf`
    - log: `log`, `remove`, `clearLog`, `exportCsv`
    - sync: `status`, `syncNow`, `refresh`, `start`

- [ ] **Step 1: Write the failing tests**

`tests/scores/ids.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { deviceId, uuid } from '../../src/scores/ids';

const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } };
};

describe('ids', () => {
  it('makes version-4 UUIDs the database accepts', () => {
    const ids = new Set(Array.from({ length: 200 }, () => uuid()));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it('keeps one device id per device', () => {
    const s = memory();
    const first = deviceId(s);
    expect(deviceId(s)).toBe(first);
    expect(first.length).toBeLessThanOrEqual(40);
    expect(deviceId(null)).toMatch(/^[0-9a-f-]{36}$/);
  });
});
```

`tests/scores/store.test.ts`:
```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Remote } from '../../src/scores/remote';
import { toRow } from '../../src/scores/remote';
import { BOARD_CACHE_KEY, MAX_ENTRIES, SCORES_KEY, ScoreStore, type NewRound } from '../../src/scores/store';
import type { BoardRow, ScoreEntry } from '../../src/scores/types';

function memoryStorage(init: Record<string, string> = {}) {
  const data = new Map(Object.entries(init));
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); }, data };
}
const brokenStorage = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => undefined };

/** A pretend Supabase: ignores repeated ids like the real upsert, and can go offline or lose answers. */
function fakeSupabase() {
  const rows: ReturnType<typeof toRow>[] = [];
  const posts: string[][] = [];
  const state = { online: true, loseAnswer: false };
  const remote: Remote = {
    async insert(entries) {
      if (!state.online) throw new Error('offline');
      posts.push(entries.map((e) => e.id));
      for (const e of entries) if (!rows.some((r) => r.id === e.id)) rows.push(toRow(e));
      if (state.loseAnswer) throw new Error('answer lost');
    },
    async top(board, since, n) {
      if (!state.online) throw new Error('offline');
      return rows
        .filter((r) => r.board === board && r.name !== null && (!since || Date.parse(r.created_at) >= Date.parse(since)))
        .map((r): BoardRow => ({ id: r.id, at: r.created_at, name: r.name as string, score: r.score }))
        .sort((a, b) => b.score - a.score || Date.parse(a.at) - Date.parse(b.at))
        .slice(0, n);
    },
  };
  return { rows, posts, state, remote };
}

const round = (score = 50): NewRound => ({ score, preset: 'normal', lang: 'vi', questionsOn: true });
let now = new Date(2026, 9, 3, 15, 0, 0);
let counter = 0;
const nextId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;
const make = (deps: Partial<ConstructorParameters<typeof ScoreStore>[0]> = {}) =>
  new ScoreStore({ storage: memoryStorage(), remote: null, board: 'booth', device: 'dev-1', now: () => now, newId: nextId, ...deps });
const entry = (over: Partial<ScoreEntry>): ScoreEntry => ({
  id: nextId(), at: now.toISOString(), board: 'booth', score: 10, name: null, preset: 'normal', lang: 'vi', questionsOn: true,
  device: 'dev-1', final: true, uploaded: true, ...over,
});

describe('ScoreStore', () => {
  beforeEach(() => {
    now = new Date(2026, 9, 3, 15, 0, 0);
    counter = 0;
  });

  it('keeps a round on the device and queues it only when the results screen closes', async () => {
    const sb = fakeSupabase();
    sb.state.online = false;
    const store = make({ remote: sb.remote });
    const id = store.addRound(round(80));
    expect(store.status().pending).toBe(0);
    expect(store.saveName(id, 'Anna')).toBe(true);
    store.finalize(id);
    await store.syncNow();
    expect(store.status()).toMatchObject({ mode: 'offline', pending: 1 });
    expect(store.log()[0]).toMatchObject({ id, score: 80, name: 'Anna', final: true, uploaded: false });
  });

  it('survives a reload and uploads once the connection returns', async () => {
    const sb = fakeSupabase();
    const storage = memoryStorage();
    sb.state.online = false;
    const first = make({ storage, remote: sb.remote });
    first.finalize(first.addRound(round()));
    await first.syncNow();
    const second = make({ storage, remote: sb.remote });
    expect(second.status().pending).toBe(1);
    sb.state.online = true;
    await second.syncNow();
    expect(second.status()).toMatchObject({ mode: 'online', pending: 0 });
    expect(sb.rows).toHaveLength(1);
    expect(second.status().lastSyncAt).not.toBeNull();
  });

  it('re-sends the same round after a lost answer, and the database keeps one copy', async () => {
    const sb = fakeSupabase();
    const store = make({ remote: sb.remote });
    sb.state.loseAnswer = true;
    const id = store.addRound(round());
    store.finalize(id);
    await store.syncNow();
    expect(store.status().pending).toBe(1);
    sb.state.loseAnswer = false;
    await store.syncNow();
    expect(sb.posts.flat()).toEqual([id, id]);
    expect(sb.rows).toHaveLength(1);
    expect(store.status().pending).toBe(0);
    await store.syncNow();
    expect(sb.posts.flat()).toEqual([id, id]);
  });

  it('shows unsent names at once, merged with the downloaded board, best first and earlier first on ties', async () => {
    const sb = fakeSupabase();
    const store = make({ remote: sb.remote });
    sb.rows.push(
      toRow(entry({ name: 'Early', score: 100, at: new Date(2026, 9, 3, 9).toISOString() })),
      toRow(entry({ name: 'Bea', score: 80 })),
    );
    await store.syncNow();
    sb.state.online = false;
    const mine = store.addRound(round(100));
    store.saveName(mine, 'Me');
    expect(store.top('today').map((r) => r.name)).toEqual(['Early', 'Me', 'Bea']);
    expect(store.rankOf(mine)).toBe(2);
  });

  it('keeps boards apart', () => {
    const store = make();
    store.saveName(store.addRound(round(60)), 'Booth');
    store.setBoard('test');
    store.saveName(store.addRound(round(40)), 'Laptop');
    expect(store.top('all').map((r) => r.name)).toEqual(['Laptop']);
    store.setBoard('booth');
    expect(store.top('all').map((r) => r.name)).toEqual(['Booth']);
  });

  it("counts only this device's calendar day as today", () => {
    const store = make();
    now = new Date(2026, 9, 2, 23, 50);
    store.saveName(store.addRound(round(90)), 'Late');
    now = new Date(2026, 9, 3, 0, 10);
    store.saveName(store.addRound(round(20)), 'Early');
    expect(store.top('today').map((r) => r.name)).toEqual(['Early']);
    expect(store.top('all').map((r) => r.name)).toEqual(['Late', 'Early']);
  });

  it('keeps the last downloaded board when the network fails, even after a reload', async () => {
    const sb = fakeSupabase();
    const storage = memoryStorage();
    sb.rows.push(toRow(entry({ name: 'Remote', score: 70 })));
    await make({ storage, remote: sb.remote }).syncNow();
    sb.state.online = false;
    const store = make({ storage, remote: sb.remote });
    await store.syncNow();
    expect(store.status().mode).toBe('offline');
    expect(store.top('today').map((r) => r.name)).toEqual(['Remote']);
    expect(storage.data.has(BOARD_CACHE_KEY)).toBe(true);
  });

  it("forgets yesterday's downloaded today-list", async () => {
    const sb = fakeSupabase();
    const store = make({ remote: sb.remote });
    sb.rows.push(toRow(entry({ name: 'Remote', score: 70 })));
    await store.syncNow();
    sb.state.online = false;
    now = new Date(2026, 9, 4, 9, 0);
    expect(store.top('today')).toEqual([]);
    expect(store.top('all').map((r) => r.name)).toEqual(['Remote']);
  });

  it('works without Supabase details, like the USB copy', async () => {
    const store = make({ remote: null });
    const id = store.addRound(round(30));
    store.saveName(id, 'Usb');
    store.finalize(id);
    await store.syncNow();
    expect(store.status()).toEqual({ mode: 'local-only', pending: 1, lastSyncAt: null });
    expect(store.top('today').map((r) => r.name)).toEqual(['Usb']);
  });

  it('refuses unusable names and names for closed rounds', () => {
    const store = make();
    const id = store.addRound(round());
    expect(store.saveName(id, '!!!')).toBe(false);
    expect(store.saveName('nope', 'Anna')).toBe(false);
    store.finalize(id);
    expect(store.saveName(id, 'Anna')).toBe(false);
    expect(store.log()[0].name).toBeNull();
  });

  it('drops a deleted round from the upload queue', async () => {
    const sb = fakeSupabase();
    sb.state.online = false;
    const store = make({ remote: sb.remote });
    const id = store.addRound(round());
    store.finalize(id);
    store.remove(id);
    sb.state.online = true;
    await store.syncNow();
    expect(sb.rows).toHaveLength(0);
    expect(store.log()).toHaveLength(0);
  });

  it('queues rounds a crash left on the results screen', () => {
    const storage = memoryStorage({
      [SCORES_KEY]: JSON.stringify([
        entry({ at: new Date(2026, 9, 3, 14, 50).toISOString(), final: false, uploaded: false }),
        entry({ at: new Date(2026, 9, 3, 14, 59).toISOString(), final: false, uploaded: false }),
      ]),
    });
    const store = make({ storage });
    store.finalizeStale(120_000);
    expect(store.log().map((e) => e.final)).toEqual([false, true]);
  });

  it('keeps at most 5,000 rounds, dropping the oldest uploaded ones first', () => {
    const old = Array.from({ length: MAX_ENTRIES }, (_, i) => entry({ uploaded: i !== 0, final: true }));
    const storage = memoryStorage({ [SCORES_KEY]: JSON.stringify(old) });
    const store = make({ storage });
    store.addRound(round());
    const kept = JSON.parse(storage.data.get(SCORES_KEY)!) as ScoreEntry[];
    expect(kept).toHaveLength(MAX_ENTRIES);
    expect(kept[0].id).toBe(old[0].id);
    expect(kept.some((e) => e.id === old[1].id)).toBe(false);
  });

  it('ignores damaged saved data and keeps working on a broken storage', () => {
    const good = entry({ name: 'Ok' });
    const storage = memoryStorage({ [SCORES_KEY]: JSON.stringify([{ id: 1 }, 'x', good]), [BOARD_CACHE_KEY]: '{bad' });
    expect(make({ storage }).log().map((e) => e.id)).toEqual([good.id]);
    expect(make({ storage: memoryStorage({ [SCORES_KEY]: '{bad' }) }).log()).toEqual([]);
    const broken = make({ storage: brokenStorage });
    expect(broken.available).toBe(false);
    const id = broken.addRound(round());
    expect(broken.saveName(id, 'Anna')).toBe(true);
    expect(make({ storage: null }).available).toBe(false);
  });

  it('exports the log as CSV, newest first, safe for spreadsheets', () => {
    const store = make({ device: 'pc,1' });
    store.saveName(store.addRound(round(5)), '-Bo');
    now = new Date(2026, 9, 3, 15, 5);
    store.addRound(round(7));
    const lines = store.exportCsv().trim().split('\r\n');
    expect(lines[0]).toBe('time,board,score,name,difficulty,language,questions,device,uploaded');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain(',7,');
    expect(lines[2]).toContain(",'-Bo,");
    expect(lines[2]).toContain('"pc,1"');
  });

  it('tells listeners about changes and survives a listener that throws', () => {
    const store = make();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    store.onChange(() => { throw new Error('ui bug'); });
    const cb = vi.fn();
    store.onChange(cb);
    expect(() => store.addRound(round())).not.toThrow();
    expect(cb).toHaveBeenCalled();
    spy.mockRestore();
  });

  describe('background sync', () => {
    beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
    afterEach(() => vi.useRealTimers());

    it('retries in the background and right when the connection comes back', async () => {
      const sb = fakeSupabase();
      sb.state.online = false;
      const store = make({ remote: sb.remote });
      store.finalize(store.addRound(round()));
      const stop = store.start(window);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(store.status().pending).toBe(1);
      sb.state.online = true;
      window.dispatchEvent(new Event('online'));
      await vi.advanceTimersByTimeAsync(10);
      expect(store.status()).toMatchObject({ mode: 'online', pending: 0 });
      stop();
    });

    it('backs off while offline instead of hammering the network', async () => {
      const sb = fakeSupabase();
      sb.state.online = false;
      let attempts = 0;
      const counting: Remote = { insert: async (e) => { attempts++; return sb.remote.insert(e); }, top: sb.remote.top };
      const store = make({ remote: counting });
      store.finalize(store.addRound(round()));
      const stop = store.start(window);
      await vi.advanceTimersByTimeAsync(5 * 60_000);
      expect(attempts).toBeGreaterThanOrEqual(3);
      expect(attempts).toBeLessThanOrEqual(7);
      stop();
    });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/scores/ids.test.ts tests/scores/store.test.ts`
Expected: FAIL, because the modules can't be resolved.

- [ ] **Step 3: Write `src/scores/ids.ts`**

```ts
import { readJson, safeLocalStorage, writeJson } from '../app/storage';

const DEVICE_KEY = 'vienna-run:device';

/** A random version-4 UUID, also where `crypto.randomUUID` is missing (older browsers, file:// pages). */
export function uuid(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) {
    try {
      return c.randomUUID();
    } catch {
      // fall through
    }
  }
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** This device's id, stored on first use, so the score log shows which PC a round came from. */
export function deviceId(storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeLocalStorage()): string {
  const saved = readJson<string>(DEVICE_KEY, '', (v): v is string => typeof v === 'string' && v.length > 0 && v.length <= 40, storage);
  if (saved) return saved;
  const fresh = uuid();
  writeJson(DEVICE_KEY, fresh, storage);
  return fresh;
}
```

- [ ] **Step 4: Write `src/scores/store.ts`**

```ts
import { readJson, writeJson } from '../app/storage';
import type { Preset } from '../core/settings';
import type { Lang } from '../core/types';
import { uuid } from './ids';
import { finalName } from './names';
import type { Remote } from './remote';
import type { BoardRow, Range, ScoreEntry, SyncStatus } from './types';

export const SCORES_KEY = 'vienna-run:scores';
export const BOARD_CACHE_KEY = 'vienna-run:board-cache';
export const MAX_ENTRIES = 5000;
const SYNC_MS = 15_000;
const MAX_BACKOFF_MS = 120_000;
const BATCH = 50;

export interface NewRound {
  score: number;
  preset: Preset;
  lang: Lang;
  questionsOn: boolean;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Timers = Pick<Window, 'setTimeout' | 'clearTimeout' | 'addEventListener' | 'removeEventListener'>;

export interface ScoreStoreDeps {
  storage: StorageLike | null;
  /** Null without Supabase details (the USB copy, local builds, autoplay test runs): a local-only leaderboard. */
  remote: Remote | null;
  board: string;
  device: string;
  now?: () => Date;
  newId?: () => string;
}

interface CachedList {
  /** The local day the list belongs to ('YYYY-MM-DD'), or 'all'. */
  key: string;
  at: string;
  rows: BoardRow[];
}

interface BoardCache {
  board: string;
  today: CachedList;
  all: CachedList;
}

const PRESET_NAMES: readonly string[] = ['easy', 'normal', 'hard', 'custom'];

function isEntry(v: unknown): v is ScoreEntry {
  const e = v as ScoreEntry;
  return (
    !!e && typeof e === 'object' && typeof e.id === 'string' && typeof e.at === 'string' && !Number.isNaN(Date.parse(e.at)) &&
    typeof e.board === 'string' && typeof e.score === 'number' && Number.isFinite(e.score) &&
    (e.name === null || typeof e.name === 'string') && PRESET_NAMES.includes(e.preset) && (e.lang === 'vi' || e.lang === 'en') &&
    typeof e.questionsOn === 'boolean' && typeof e.device === 'string' && typeof e.final === 'boolean' && typeof e.uploaded === 'boolean'
  );
}

function isRow(v: unknown): v is BoardRow {
  const r = v as BoardRow;
  return !!r && typeof r.id === 'string' && typeof r.at === 'string' && typeof r.name === 'string' && typeof r.score === 'number';
}

function isList(v: unknown): v is CachedList {
  const l = v as CachedList;
  return !!l && typeof l.key === 'string' && typeof l.at === 'string' && Array.isArray(l.rows) && l.rows.every(isRow);
}

function isCache(v: unknown): v is BoardCache {
  const c = v as BoardCache;
  return !!c && typeof c === 'object' && typeof c.board === 'string' && isList(c.today) && isList(c.all);
}

function probe(s: StorageLike | null): boolean {
  if (!s) return false;
  try {
    s.setItem('vienna-run:probe', '1');
    s.removeItem('vienna-run:probe');
    return true;
  } catch {
    return false;
  }
}

/** The device's local calendar day, e.g. "2026-10-03". */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Best score first; on a tie, whoever got there first. */
export function compareRows(a: BoardRow, b: BoardRow): number {
  return b.score - a.score || Date.parse(a.at) - Date.parse(b.at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** One CSV cell; values that a spreadsheet would run as a formula get a leading apostrophe. */
function csvCell(v: string): string {
  const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * Every finished round is kept on this device first. Rounds whose results screen has closed are uploaded
 * to Supabase in the background; the board shows the last downloaded lists merged with this device's rounds.
 * Nothing here ever waits on the network for the game, and nothing here ever throws at the game.
 */
export class ScoreStore {
  /** False when the browser storage is blocked or broken: scores then only live until the page reloads. */
  readonly available: boolean;
  private entries: ScoreEntry[];
  private cache: BoardCache | null;
  private board: string;
  private lastResult: 'ok' | 'fail' | null = null;
  private lastSyncAt: string | null = null;
  private lastAttemptAt = Number.NEGATIVE_INFINITY;
  private failures = 0;
  private syncing: Promise<void> | null = null;
  private listeners = new Set<() => void>();

  constructor(private readonly d: ScoreStoreDeps) {
    this.board = d.board;
    this.available = probe(d.storage);
    const raw = readJson<unknown>(SCORES_KEY, null, undefined, d.storage);
    this.entries = Array.isArray(raw) ? raw.filter(isEntry) : [];
    const cache = readJson<unknown>(BOARD_CACHE_KEY, null, undefined, d.storage);
    this.cache = isCache(cache) ? cache : null;
  }

  get currentBoard(): string {
    return this.board;
  }

  setBoard(board: string): void {
    if (board === this.board) return;
    this.board = board;
    this.emit();
  }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  /** Logs a finished round on this device; returns its id. */
  addRound(r: NewRound): string {
    const id = (this.d.newId ?? uuid)();
    this.entries.push({
      id, at: this.now().toISOString(), board: this.board, score: r.score, name: null,
      preset: r.preset, lang: r.lang, questionsOn: r.questionsOn, device: this.d.device, final: false, uploaded: false,
    });
    this.persist();
    this.emit();
    return id;
  }

  /** Attaches a code name to a round still on its results screen. False if the name is unusable or the round has closed. */
  saveName(id: string, raw: string): boolean {
    const e = this.find(id);
    const name = finalName(raw);
    if (!e || e.final || !name) return false;
    e.name = name;
    this.persist();
    this.emit();
    return true;
  }

  /** The results screen closed: the round is queued for upload. */
  finalize(id: string): void {
    const e = this.find(id);
    if (!e || e.final) return;
    e.final = true;
    this.persist();
    this.emit();
    void this.syncNow();
  }

  /** Queues rounds left open longer than `maxAgeMs` (a crash or reload during the results screen). */
  finalizeStale(maxAgeMs: number): void {
    const cutoff = this.now().getTime() - maxAgeMs;
    let changed = false;
    for (const e of this.entries) {
      if (!e.final && Date.parse(e.at) < cutoff) {
        e.final = true;
        changed = true;
      }
    }
    if (changed) {
      this.persist();
      this.emit();
    }
  }

  /** The board for this device's board name: the last downloaded list merged with this device's named rounds. */
  top(range: Range, n = 10): BoardRow[] {
    const today = dayKey(this.now());
    const list = this.cache && this.cache.board === this.board ? this.cache[range] : null;
    const remote = list && (range === 'all' || list.key === today) ? list.rows : [];
    const local = this.entries
      .filter((e) => e.board === this.board && e.name !== null && (range === 'all' || dayKey(new Date(e.at)) === today))
      .map((e): BoardRow => ({ id: e.id, at: e.at, name: e.name as string, score: e.score }));
    const byId = new Map<string, BoardRow>();
    for (const r of [...remote, ...local]) byId.set(r.id, r);
    return [...byId.values()].sort(compareRows).slice(0, n);
  }

  /** A round's place on today's board (1-based), or null when it is not in the top `n`. */
  rankOf(id: string, n = 10): number | null {
    const i = this.top('today', n).findIndex((r) => r.id === id);
    return i < 0 ? null : i + 1;
  }

  /** Every round on this device, newest first. */
  log(): ScoreEntry[] {
    return [...this.entries].reverse();
  }

  /** Deletes a round on this device only (a waiting one is also dropped from the upload queue). */
  remove(id: string): void {
    this.entries = this.entries.filter((e) => e.id !== id);
    this.persist();
    this.emit();
  }

  clearLog(): void {
    this.entries = [];
    this.persist();
    this.emit();
  }

  exportCsv(): string {
    const head = ['time', 'board', 'score', 'name', 'difficulty', 'language', 'questions', 'device', 'uploaded'];
    const rows = this.log().map((e) => [e.at, e.board, String(e.score), e.name ?? '', e.preset, e.lang, e.questionsOn ? 'on' : 'off', e.device, e.uploaded ? 'yes' : 'no']);
    return `${[head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
  }

  status(): SyncStatus {
    const mode = !this.d.remote ? 'local-only' : this.lastResult === null ? 'connecting' : this.lastResult === 'ok' ? 'online' : 'offline';
    return { mode, pending: this.pending().length, lastSyncAt: this.lastSyncAt };
  }

  /** Uploads waiting rounds in batches, then downloads the board lists. Never rejects. */
  syncNow(): Promise<void> {
    const remote = this.d.remote;
    if (!remote) return Promise.resolve();
    if (this.syncing) return this.syncing;
    this.lastAttemptAt = this.now().getTime();
    this.syncing = this.runSync(remote).finally(() => {
      this.syncing = null;
      this.emit();
    });
    return this.syncing;
  }

  /** Re-downloads the board unless that was tried in the last `maxAgeMs` (called from the start screen). */
  refresh(maxAgeMs: number): void {
    if (!this.d.remote || this.syncing) return;
    if (this.now().getTime() - this.lastAttemptAt < maxAgeMs) return;
    void this.syncNow();
  }

  /** Background sync: now, whenever the browser reports the connection back, and every 15 s while rounds wait (backing off to 2 min while failing). */
  start(win: Timers = window): () => void {
    if (!this.d.remote) return () => undefined;
    let stopped = false;
    let timer = 0;
    const schedule = () => {
      if (stopped) return;
      const delay = this.failures > 0 ? Math.min(MAX_BACKOFF_MS, SYNC_MS * 2 ** this.failures) : SYNC_MS;
      timer = win.setTimeout(tick, delay);
    };
    const tick = () => {
      if (stopped) return;
      this.finalizeStale(10 * 60_000);
      void (this.pending().length > 0 ? this.syncNow() : Promise.resolve()).then(schedule);
    };
    const onOnline = () => {
      void this.syncNow();
    };
    win.addEventListener('online', onOnline);
    void this.syncNow().then(schedule);
    return () => {
      stopped = true;
      win.clearTimeout(timer);
      win.removeEventListener('online', onOnline);
    };
  }

  private async runSync(remote: Remote): Promise<void> {
    try {
      for (let batch = this.pending().slice(0, BATCH); batch.length > 0; batch = this.pending().slice(0, BATCH)) {
        await remote.insert(batch);
        for (const sent of batch) {
          const e = this.find(sent.id);
          if (e) e.uploaded = true;
        }
        this.persist();
      }
      await this.fetchLists(remote);
      this.lastResult = 'ok';
      this.lastSyncAt = this.now().toISOString();
      this.failures = 0;
    } catch {
      this.lastResult = 'fail';
      this.failures++;
    }
  }

  private async fetchLists(remote: Remote): Promise<void> {
    const board = this.board;
    const now = this.now();
    const [today, all] = await Promise.all([remote.top(board, startOfDay(now).toISOString(), 10), remote.top(board, null, 10)]);
    if (board !== this.board) return; // the board changed meanwhile; the next sync fetches the new one
    const at = this.now().toISOString();
    this.cache = { board, today: { key: dayKey(now), at, rows: today }, all: { key: 'all', at, rows: all } };
    writeJson(BOARD_CACHE_KEY, this.cache, this.d.storage);
  }

  private pending(): ScoreEntry[] {
    return this.entries.filter((e) => e.final && !e.uploaded);
  }

  private find(id: string): ScoreEntry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  private now(): Date {
    return this.d.now?.() ?? new Date();
  }

  private persist(): void {
    if (this.entries.length > MAX_ENTRIES) {
      // Oldest uploaded rounds go first (they are safe in Supabase), then the oldest of the rest.
      let excess = this.entries.length - MAX_ENTRIES;
      this.entries = this.entries.filter((e) => !(excess > 0 && e.uploaded && excess-- > 0));
      if (this.entries.length > MAX_ENTRIES) this.entries = this.entries.slice(this.entries.length - MAX_ENTRIES);
    }
    writeJson(SCORES_KEY, this.entries, this.d.storage);
  }

  private emit(): void {
    for (const cb of [...this.listeners]) {
      try {
        cb();
      } catch (e) {
        console.error(e);
      }
    }
  }
}
```

- [ ] **Step 5: Run the tests and the type check**

Run: `npx vitest run tests/scores && npx tsc --noEmit`
Expected: PASS, with no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/scores/ids.ts src/scores/store.ts tests/scores/ids.test.ts tests/scores/store.test.ts
git commit -m "feat(scores): offline-first score store with upload queue and cached boards"
```

---

### Task 14: Leaderboard on the start screen and the full leaderboard

**Files:**
- Create: `src/ui/board.ts`, `src/ui/boardModal.ts`
- Modify: `src/i18n/strings.ts`, `src/ui/attract.ts`, `src/ui/styles.css`
- Test: `tests/ui/board.test.ts`

**Interfaces:**
- Consumes:
  - `BoardRow`, `Range`, `SyncStatus` (Task 12)
  - `I18n` (Task 7)
- Produces:
  - `boardList(rows, i18n, highlight?)`
  - `BoardView = { rows: BoardRow[]; state: 'ok' | 'offline' | 'unavailable' }`
  - `AttractScreen.setBoard(view | null)`, and the constructor's 5th argument `onOpenBoard?: () => void`
  - `BoardSource`, and `class BoardModal { open(range?, highlight?); hide(); isOpen }`

- [ ] **Step 1: Write the failing tests** (`tests/ui/board.test.ts`)

```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../../src/config';
import { I18n } from '../../src/i18n/i18n';
import type { BoardRow, Range, SyncStatus } from '../../src/scores/types';
import { AttractScreen } from '../../src/ui/attract';
import { boardList } from '../../src/ui/board';
import { BoardModal, type BoardSource } from '../../src/ui/boardModal';

const icons = { sacher: 'a', kipferl: 'b', melange: 'c', mozart: 'd', krampus: 'e', bomb: 'f' };
const rows: BoardRow[] = [
  { id: 'a', at: '2026-10-03T08:00:00Z', name: 'Anna', score: 150 },
  { id: 'b', at: '2026-10-03T09:00:00Z', name: '<b>Bo</b>', score: 90 },
];

function source(over: Partial<BoardSource> = {}) {
  const listeners: (() => void)[] = [];
  const s = {
    available: true,
    top: vi.fn((range: Range) => (range === 'today' ? rows.slice(0, 1) : rows)),
    status: (): SyncStatus => ({ mode: 'online', pending: 0, lastSyncAt: null }),
    onChange: (cb: () => void) => { listeners.push(cb); return () => undefined; },
    ...over,
  };
  return { s, changed: () => listeners.forEach((cb) => cb()) };
}

describe('boardList', () => {
  it('lists place, name and score, as plain text', () => {
    const list = boardList(rows, new I18n('en'), 'b');
    const items = [...list.querySelectorAll('li')];
    expect(items.map((li) => li.textContent)).toEqual(['1Anna150', '2<b>Bo</b>90']);
    expect(list.querySelector('b b')).toBeNull();
    expect(items[1].classList.contains('me')).toBe(true);
  });
  it('invites the first player when empty', () => {
    expect(boardList([], new I18n()).textContent).toBe('Hãy là người đầu tiên!');
  });
});

describe('start screen leaderboard', () => {
  it("shows today's top 10 beside the title card, with a button for the full board", () => {
    const open = vi.fn();
    const s = new AttractScreen(document.body, new I18n('en'), icons, null, open);
    s.configure(CONFIG, { showGifts: false, leaderboard: true });
    s.setBoard({ rows, state: 'ok' });
    expect(s.root.classList.contains('with-board')).toBe(true);
    expect(s.root.querySelector('.board-panel')?.textContent).toContain('Anna');
    const button = s.root.querySelector<HTMLButtonElement>('.board-open')!;
    expect(button.tagName).toBe('BUTTON');
    button.click();
    expect(open).toHaveBeenCalledTimes(1);
  });
  it('hides the panel and centres the card when the leaderboard is off', () => {
    const s = new AttractScreen(document.body, new I18n('en'), icons, null);
    s.setBoard(null);
    expect(s.root.classList.contains('with-board')).toBe(false);
    expect(s.root.querySelector<HTMLElement>('.board-panel')!.hidden).toBe(true);
  });
  it('says when the board is offline or unavailable', () => {
    const s = new AttractScreen(document.body, new I18n('vi'), icons, null);
    s.setBoard({ rows, state: 'offline' });
    expect(s.root.textContent).toContain('Đang ngoại tuyến');
    s.setBoard({ rows: [], state: 'unavailable' });
    expect(s.root.textContent).toContain('Bảng xếp hạng tạm thời không khả dụng');
  });
});

describe('BoardModal', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('opens on today, switches to all time, and closes', () => {
    const { s } = source();
    const m = new BoardModal(document.body, new I18n('en'), s);
    m.open();
    expect(m.isOpen).toBe(true);
    expect(m.root.querySelectorAll('.board-list li')).toHaveLength(1);
    expect(m.root.closest('[data-ui]')).not.toBeNull();
    [...m.root.querySelectorAll('button')].find((b) => b.textContent === 'All time')!.click();
    expect(m.root.querySelectorAll('.board-list li')).toHaveLength(2);
    m.root.querySelector<HTMLButtonElement>('.board-close')!.click();
    expect(m.isOpen).toBe(false);
  });
  it('closes by itself so the booth never gets stuck on it', () => {
    const m = new BoardModal(document.body, new I18n('en'), source().s);
    m.open();
    vi.advanceTimersByTime(BoardModal.IDLE_MS + 10);
    expect(m.isOpen).toBe(false);
  });
  it('highlights the player and updates when new scores arrive', () => {
    const { s, changed } = source();
    const m = new BoardModal(document.body, new I18n('en'), s);
    m.open('all', 'b');
    expect(m.root.querySelector('li.me')?.textContent).toContain('Bo');
    s.top.mockReturnValue([]);
    changed();
    expect(m.root.textContent).toContain('Be the first!');
  });
  it('explains when the board is unavailable', () => {
    const m = new BoardModal(document.body, new I18n('en'), source({ available: false }).s);
    m.open();
    expect(m.root.textContent).toContain('The leaderboard is unavailable right now');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/ui/board.test.ts`
Expected: FAIL, because `src/ui/board` and `src/ui/boardModal` can't be resolved.

- [ ] **Step 3: Add the leaderboard texts** (edit `src/i18n/strings.ts`)

Add to `en`:
```ts
  'board.title': 'Leaderboard',
  'board.todayTop': "Today's top 10",
  'board.today': 'Today',
  'board.all': 'All time',
  'board.empty': 'Be the first!',
  'board.unavailable': 'The leaderboard is unavailable right now',
  'board.offline': 'Offline · showing the saved copy',
  'board.open': 'Leaderboard',
  'board.close': 'Close',
```
Add to `vi`:
```ts
  'board.title': 'Bảng xếp hạng',
  'board.todayTop': 'Top 10 hôm nay',
  'board.today': 'Hôm nay',
  'board.all': 'Tất cả',
  'board.empty': 'Hãy là người đầu tiên!',
  'board.unavailable': 'Bảng xếp hạng tạm thời không khả dụng',
  'board.offline': 'Đang ngoại tuyến · hiển thị bản đã lưu',
  'board.open': 'Bảng xếp hạng',
  'board.close': 'Đóng',
```

- [ ] **Step 4: Write the board views**

`src/ui/board.ts`:
```ts
import type { I18n } from '../i18n/i18n';
import type { BoardRow } from '../scores/types';
import { el } from './dom';

/** A ranked list (place, name, score), or an invitation when it is empty. Names are always plain text. */
export function boardList(rows: readonly BoardRow[], i18n: I18n, highlight: string | null = null): HTMLElement {
  if (rows.length === 0) return el('p', 'board-empty', i18n.t('board.empty'));
  const list = el('ol', 'board-list');
  rows.forEach((r, i) => {
    const li = el('li', r.id === highlight ? 'me' : '');
    li.append(el('b', 'board-rank', String(i + 1)), el('span', 'board-name', r.name), el('span', 'board-score', String(r.score)));
    list.append(li);
  });
  return list;
}
```

`src/ui/boardModal.ts`:
```ts
import type { I18n } from '../i18n/i18n';
import type { BoardRow, Range, SyncStatus } from '../scores/types';
import { boardList } from './board';
import { el } from './dom';

export interface BoardSource {
  readonly available: boolean;
  top(range: Range, n?: number): BoardRow[];
  status(): SyncStatus;
  onChange(cb: () => void): () => void;
}

/** The full leaderboard over any screen: Today / All time, top 10. It closes itself, so the booth never sticks on it. */
export class BoardModal {
  static readonly IDLE_MS = 45_000;
  readonly root = el('div', 'screen board-modal');
  private title = el('h2');
  private todayTab = el('button');
  private allTab = el('button');
  private body = el('div', 'board-body');
  private note = el('p', 'board-note');
  private closeButton = el('button', 'board-close');
  private range: Range = 'today';
  private highlight: string | null = null;
  private timer = 0;

  constructor(parent: HTMLElement, private readonly i18n: I18n, private readonly source: BoardSource) {
    const tabs = el('div', 'board-tabs');
    for (const [b, r] of [[this.todayTab, 'today'], [this.allTab, 'all']] as const) {
      b.type = 'button';
      b.addEventListener('click', () => {
        this.range = r;
        this.render();
        this.arm();
      });
      tabs.append(b);
    }
    this.closeButton.type = 'button';
    this.closeButton.addEventListener('click', () => this.hide());
    const card = el('div', 'paper-card board-card');
    card.append(this.title, tabs, this.body, this.note, this.closeButton);
    this.root.append(card);
    this.root.dataset.ui = '';
    this.root.hidden = true;
    parent.append(this.root);
    source.onChange(() => {
      if (this.isOpen) this.render();
    });
    i18n.onChange(() => {
      if (this.isOpen) this.render();
    });
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  open(range: Range = 'today', highlight: string | null = null): void {
    this.range = range;
    this.highlight = highlight;
    this.render();
    this.root.hidden = false;
    this.arm();
  }

  hide(): void {
    window.clearTimeout(this.timer);
    this.root.hidden = true;
  }

  private arm(): void {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.hide(), BoardModal.IDLE_MS);
  }

  private render(): void {
    const { i18n } = this;
    this.title.textContent = i18n.t('board.title');
    this.todayTab.textContent = i18n.t('board.today');
    this.allTab.textContent = i18n.t('board.all');
    this.todayTab.classList.toggle('on', this.range === 'today');
    this.allTab.classList.toggle('on', this.range === 'all');
    this.closeButton.textContent = i18n.t('board.close');
    this.body.replaceChildren(
      this.source.available ? boardList(this.source.top(this.range, 10), i18n, this.highlight) : el('p', 'board-empty', i18n.t('board.unavailable')),
    );
    this.note.textContent = this.source.status().mode === 'offline' ? i18n.t('board.offline') : '';
  }
}
```

- [ ] **Step 5: Today's top 10 on the start screen** (edit `src/ui/attract.ts`)

1. Add imports:
```ts
import type { BoardRow } from '../scores/types';
import { boardList } from './board';
```
2. Add above the class:
```ts
/** What the start-screen panel shows; null hides it (leaderboard switched off). */
export interface BoardView {
  rows: BoardRow[];
  state: 'ok' | 'offline' | 'unavailable';
}
```
3. Add fields:
```ts
  private boardPanel = el('div', 'paper-card board-panel');
  private boardTitle = el('h2');
  private boardBody = el('div', 'board-body');
  private boardNote = el('p', 'board-note');
  private boardButton = el('button', 'board-open');
  private board: BoardView | null = null;
```
4. Change the constructor signature to:
```ts
  constructor(parent: HTMLElement, private readonly i18n: I18n, private readonly icons: Record<ItemType, string>, logoUrl: string | null, onOpenBoard?: () => void) {
```
and replace `this.root.append(this.card, this.pill);` with:
```ts
    this.boardButton.type = 'button';
    this.boardButton.addEventListener('click', () => onOpenBoard?.());
    this.boardPanel.hidden = true;
    this.boardPanel.append(this.boardTitle, this.boardBody, this.boardNote, this.boardButton);
    this.root.append(this.card, this.boardPanel, this.pill);
```
5. Add the method:
```ts
  /** Today's top 10 beside the title card, or null to hide the panel (leaderboard switched off). */
  setBoard(view: BoardView | null): void {
    this.board = view;
    this.render();
  }
```
6. In `render()`, insert after the pill lines (before `const cfg = this.cfg;`):
```ts
    const view = this.board;
    this.root.classList.toggle('with-board', view !== null);
    this.boardPanel.hidden = view === null;
    if (view) {
      this.boardTitle.textContent = i18n.t('board.todayTop');
      this.boardBody.replaceChildren(view.state === 'unavailable' ? el('p', 'board-empty', i18n.t('board.unavailable')) : boardList(view.rows, i18n));
      this.boardNote.textContent = view.state === 'offline' ? i18n.t('board.offline') : '';
      this.boardButton.textContent = i18n.t('board.open');
    }
```

In `src/ui/styles.css`, add after the `.lang-pill` rules:
```css
/* Leaderboard */
.attract.with-board { grid-auto-flow: column; justify-content: center; align-items: center; gap: 4cqmin; }
.attract.with-board .attract-card { width: min(60cqw, 104cqmin); }
.board-panel { width: min(30cqw, 58cqmin); padding: 3cqmin 3cqmin 2.6cqmin; display: grid; gap: 1.4cqmin; }
.board-panel h2, .board-card h2 { margin: 0; font-family: var(--font-display); font-weight: var(--display-weight); font-size: 4cqmin; text-align: center; }
.board-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5cqmin; font-size: 2.5cqmin; }
.board-list li { display: grid; grid-template-columns: 4.5cqmin 1fr auto; align-items: baseline; gap: 1.2cqmin; padding: 0.6cqmin 1.2cqmin; border-radius: 0.5cqmin; background: var(--paper-2); }
.board-list li:nth-child(-n + 3) .board-rank { color: var(--red); }
.board-list li.me { background: var(--red); color: #fff; }
.board-list li.me .board-rank { color: #fff; }
.board-rank { font-family: var(--font-display); font-weight: var(--display-weight); text-align: right; }
.board-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.board-score { font-weight: 600; font-variant-numeric: tabular-nums; }
.board-empty { margin: 1cqmin 0; text-align: center; font-family: var(--font-display); font-weight: var(--display-weight); font-size: 3cqmin; color: var(--red-ink); }
.board-note { margin: 0; font-size: 1.8cqmin; color: var(--muted); text-align: center; }
.board-note:empty { display: none; }
.board-open, .board-close { justify-self: center; font: 600 2.4cqmin var(--font-body); padding: 1.2cqmin 3cqmin; border-radius: 99cqmin; border: 0.3cqmin solid var(--ink); background: #fff; color: var(--ink); cursor: pointer; touch-action: manipulation; }
.board-modal { z-index: 6; background: rgba(29, 20, 17, 0.6); }
.board-card { width: min(70cqw, 90cqmin); padding: 3.4cqmin 4cqmin; display: grid; gap: 1.6cqmin; }
.board-card .board-list { font-size: 3cqmin; }
.board-tabs { display: flex; justify-content: center; gap: 1cqmin; }
.board-tabs button { font: 600 2.6cqmin var(--font-body); padding: 1cqmin 3cqmin; border-radius: 99cqmin; border: 0.3cqmin solid var(--ink); background: #fff; color: var(--ink); cursor: pointer; touch-action: manipulation; }
.board-tabs button.on { background: var(--ink); color: var(--paper); }
```

- [ ] **Step 6: Run the tests and the type check**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, with no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/ui/board.ts src/ui/boardModal.ts src/ui/attract.ts src/ui/styles.css src/i18n/strings.ts tests/ui/board.test.ts
git commit -m "feat(ui): today's top 10 on the start screen and a full leaderboard"
```

---

### Task 15: Name entry on the results screen, and rounds logged by the game

**Files:**
- Modify: `src/ui/results.ts`, `src/ui/styles.css`, `src/i18n/strings.ts`, `src/app/flow.ts`, `src/app/game.ts`
- Test: `tests/ui/results.test.ts`, `tests/app/flow.test.ts`, `tests/app/game.test.ts`

**Interfaces:**
- Consumes: `cleanNameInput`, `finalName` (Task 12)
- Produces:
  - `NameEntry = { save(id, name): number | null | false; open(id): void }`
  - `ResultsInfo.entryId?: string | null`
  - `ResultsScreen` constructor 4th argument `names?: NameEntry | null`, plus `ResultsScreen.busy(now?)`
  - `Flow.holdResults()`
  - `RoundRecord = { score; lang; questionsOn }`, `RoundLog = { addRound(r): string; finalize(id): void }`
  - `GameOptions.scores?: RoundLog`
  - `GameUi.results.busy(): boolean`

- [ ] **Step 1: Write the failing tests**

Add to `tests/ui/results.test.ts` (after the existing tests, inside `describe('ResultsScreen', …)`):
```ts
  function nameSetup(entryId: string | null = 'r1', saveResult: number | null | false = 3) {
    const names = { save: vi.fn<(id: string, name: string) => number | null | false>(() => saveResult), open: vi.fn<(id: string) => void>() };
    const s = new ResultsScreen(document.body, new I18n('en'), 1000, names);
    s.show({ score: 90, gift: null, entryId }, () => undefined);
    const input = s.root.querySelector<HTMLInputElement>('.r-name')!;
    const save = s.root.querySelector<HTMLButtonElement>('.r-save')!;
    return { s, names, input, save };
  }
  const typeInto = (input: HTMLInputElement, text: string) => {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  it('offers name entry only for a round that can be saved', () => {
    expect(nameSetup(null).s.root.querySelector<HTMLElement>('.r-namebox')!.hidden).toBe(true);
    expect(nameSetup('r1').s.root.querySelector<HTMLElement>('.r-namebox')!.hidden).toBe(false);
  });

  it('keeps only code-name characters as the player types', () => {
    const { input, save } = nameSetup();
    expect(save.disabled).toBe(true);
    typeInto(input, 'Đức Anh!!');
    expect(input.value).toBe('Duc Anh');
    expect(save.disabled).toBe(false);
    expect(input.maxLength).toBe(12);
    expect(input.placeholder).toBe('Your name');
  });

  it("saves once, shows today's place, then locks", () => {
    const { s, names, input, save } = nameSetup();
    typeInto(input, 'Anna');
    save.click();
    expect(names.save).toHaveBeenCalledExactlyOnceWith('r1', 'Anna');
    expect(s.root.textContent).toContain("You're #3 today!");
    expect(input.disabled).toBe(true);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    save.click();
    expect(names.save).toHaveBeenCalledTimes(1);
    s.root.querySelector<HTMLButtonElement>('.r-view')!.click();
    expect(names.open).toHaveBeenCalledWith('r1');
  });

  it('saves with the Enter key, and says "Saved!" outside the top 10', () => {
    const { s, names, input } = nameSetup('r2', null);
    typeInto(input, 'Bo');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(names.save).toHaveBeenCalledTimes(1);
    expect(s.root.querySelector('.r-name-msg')?.textContent).toBe('Saved!');
  });

  it('keeps the screen open while someone types, and lets go 20 seconds after the last key', () => {
    const { s, input } = nameSetup();
    expect(s.busy()).toBe(false);
    input.dispatchEvent(new FocusEvent('focus'));
    expect(s.busy()).toBe(true);
    typeInto(input, 'An');
    vi.advanceTimersByTime(19_000);
    expect(s.busy()).toBe(true);
    vi.advanceTimersByTime(2_000);
    expect(s.busy()).toBe(false);
    typeInto(input, 'Ann');
    expect(s.busy()).toBe(true);
  });

  it('is not busy once the name is saved, or when name entry is off', () => {
    const { s, input, save } = nameSetup();
    input.dispatchEvent(new FocusEvent('focus'));
    typeInto(input, 'Anna');
    save.click();
    expect(s.busy()).toBe(false);
    expect(nameSetup(null).s.busy()).toBe(false);
  });
```

Add to `tests/app/flow.test.ts`:
```ts
  it('holds the results screen open while asked to', () => {
    const { flow, tick } = setup();
    flow.press();
    tick(6.1);
    flow.runFinished();
    tick(CONFIG.flow.finishSeconds);
    expect(flow.screen).toBe('results');
    for (let i = 0; i < 3; i++) {
      tick(CONFIG.flow.resultsFallbackSeconds / 2);
      flow.holdResults();
    }
    expect(flow.screen).toBe('results');
    tick(CONFIG.flow.resultsFallbackSeconds);
    expect(flow.screen).toBe('attract');
  });
```

In `tests/app/game.test.ts`:
- change the `results` line in `fakes()` to `results: { show: vi.fn(), hide: vi.fn(), busy: vi.fn(() => false) },`
- change the game import to `import { Game, type GameUi, type GameWorld, type RoundRecord } from '../../src/app/game';`
- add:
```ts
  function roundLog() {
    const records: RoundRecord[] = [];
    const finalized: string[] = [];
    return { records, finalized, log: { addRound: (r: RoundRecord) => { records.push(r); return `id-${records.length}`; }, finalize: (id: string) => { finalized.push(id); } } };
  }

  it('logs every round once and queues it when the results screen closes', () => {
    const { world, ui } = fakes();
    const scores = roundLog();
    const game = new Game({ cfg: CONFIG, bank, world, ui, seed: 5, scores: scores.log, features: { showGifts: false, leaderboard: true } });
    game.press();
    clock(game).run(200);
    expect(game.flow.screen).toBe('attract');
    expect(scores.records).toHaveLength(1);
    expect(scores.records[0]).toMatchObject({ lang: 'vi', questionsOn: true });
    expect(scores.records[0].score).toBeGreaterThanOrEqual(0);
    expect(((ui.results.show as ReturnType<typeof vi.fn>).mock.calls[0][0] as ResultsInfo).entryId).toBe('id-1');
    expect(scores.finalized).toEqual(['id-1']);
  });

  it('still logs rounds, without name entry, while the leaderboard is off', () => {
    const { world, ui } = fakes();
    const scores = roundLog();
    const game = new Game({ cfg: CONFIG, bank, world, ui, seed: 5, scores: scores.log });
    game.press();
    clock(game).run(200);
    expect(scores.records).toHaveLength(1);
    expect(((ui.results.show as ReturnType<typeof vi.fn>).mock.calls[0][0] as ResultsInfo).entryId).toBeNull();
  });

  it('keeps the results screen while a name is being typed, then resets by itself', () => {
    const { world, ui } = fakes();
    let typing = true;
    (ui.results.busy as ReturnType<typeof vi.fn>).mockImplementation(() => typing);
    const game = new Game({ cfg: CONFIG, bank, world, ui, seed: 5 });
    game.press();
    const c = clock(game);
    c.run(200);
    expect(game.flow.screen).toBe('results');
    typing = false;
    c.run(CONFIG.flow.resultsFallbackSeconds + 1);
    expect(game.flow.screen).toBe('attract');
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/ui/results.test.ts tests/app`
Expected: FAIL. There is no `.r-name`, `busy` or `holdResults` yet, and the game never calls `addRound`.

- [ ] **Step 3: Add the name-entry texts** (edit `src/i18n/strings.ts`)

Add to `en`:
```ts
  'results.nameHint': 'Put your code name on the leaderboard (A–Z, 0–9, up to 12)',
  'results.namePlaceholder': 'Your name',
  'results.save': 'Save',
  'results.rank': "You're #{rank} today!",
  'results.saved': 'Saved!',
  'results.viewBoard': 'See the leaderboard',
```
Add to `vi`:
```ts
  'results.nameHint': 'Nhập biệt danh để lên bảng xếp hạng (chữ không dấu, số, tối đa 12 ký tự)',
  'results.namePlaceholder': 'Tên của bạn',
  'results.save': 'Lưu',
  'results.rank': 'Bạn đứng thứ #{rank} hôm nay!',
  'results.saved': 'Đã lưu!',
  'results.viewBoard': 'Xem bảng xếp hạng',
```

- [ ] **Step 4: Name entry on the results screen** (edit `src/ui/results.ts`)

1. Add `import { cleanNameInput, finalName } from '../scores/names';`.
2. Extend `ResultsInfo` and add `NameEntry`:
```ts
export interface ResultsInfo {
  score: number;
  /** Null while gifts are switched off. */
  gift: GiftInfo | null;
  /** The logged round a code name can be saved to; null or missing hides name entry. */
  entryId?: string | null;
}

export interface NameEntry {
  /** Saves the code name: today's place (1–10), null when saved outside the top 10, or false when refused. */
  save(id: string, name: string): number | null | false;
  /** Opens the full leaderboard with this round highlighted. */
  open(id: string): void;
}
```
3. Add fields:
```ts
  /** Without a key press for this long, a half-typed name stops holding the screen open. */
  static readonly TYPING_GRACE_MS = 20_000;
  private nameBox = el('div', 'r-namebox');
  private nameHint = el('p', 'r-name-hint');
  private nameInput = el('input', 'r-name');
  private saveButton = el('button', 'r-save');
  private nameMsg = el('p', 'r-name-msg');
  private viewButton = el('button', 'r-view');
  private entryId: string | null = null;
  private saved = false;
  private focused = false;
  private lastTyped = 0;
```
4. Change the constructor signature to `constructor(parent: HTMLElement, private readonly i18n: I18n, private readonly holdMs: number, private readonly names: NameEntry | null = null) {`. Change `card.append(scoreBox, this.thanks, this.giftBox);` to `card.append(scoreBox, this.thanks, this.nameBox, this.giftBox);`, and add before `this.root.append(card, this.hold);`:
```ts
    const input = this.nameInput;
    input.type = 'text';
    input.maxLength = 12;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.lang = 'en';
    input.enterKeyHint = 'done';
    input.addEventListener('input', () => {
      const clean = cleanNameInput(input.value);
      if (clean !== input.value) input.value = clean;
      this.lastTyped = Date.now();
      this.saveButton.disabled = finalName(clean) === null;
    });
    input.addEventListener('focus', () => {
      this.focused = true;
      this.lastTyped = Date.now();
    });
    input.addEventListener('blur', () => {
      this.focused = false;
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.saveName();
      }
    });
    this.saveButton.type = 'button';
    this.saveButton.addEventListener('click', () => this.saveName());
    this.viewButton.type = 'button';
    this.viewButton.addEventListener('click', () => {
      if (this.entryId) this.names?.open(this.entryId);
    });
    const field = el('div', 'r-namefield');
    field.append(input, this.saveButton);
    this.nameBox.append(this.nameHint, field, this.nameMsg, this.viewButton);
```
5. In `show(info, onDone)`, add after `this.showGift(info.gift);`:
```ts
    this.entryId = this.names ? info.entryId ?? null : null;
    this.saved = false;
    this.focused = false;
    this.lastTyped = 0;
    this.nameInput.value = '';
    this.nameInput.disabled = false;
    this.saveButton.disabled = true;
    this.saveButton.hidden = false;
    this.nameMsg.textContent = '';
    this.viewButton.hidden = true;
    this.nameBox.hidden = this.entryId === null;
```
6. Add the methods:
```ts
  /** True while a player is typing a name, so the results screen should not time out under them. */
  busy(now = Date.now()): boolean {
    if (!this.entryId || this.saved || this.root.hidden) return false;
    const active = this.focused || this.nameInput.value.length > 0;
    return active && now - this.lastTyped < ResultsScreen.TYPING_GRACE_MS;
  }

  private saveName(): void {
    if (!this.names || !this.entryId || this.saved) return;
    const place = this.names.save(this.entryId, this.nameInput.value);
    if (place === false) {
      this.nameMsg.textContent = this.i18n.t('results.nameHint');
      return;
    }
    this.saved = true;
    this.nameInput.disabled = true;
    this.nameInput.blur();
    this.saveButton.hidden = true;
    this.nameMsg.textContent = place === null ? this.i18n.t('results.saved') : this.i18n.t('results.rank', { rank: place });
    this.viewButton.hidden = false;
  }
```
7. In `relabel()`, add:
```ts
    this.nameHint.textContent = this.i18n.t('results.nameHint');
    this.nameInput.placeholder = this.i18n.t('results.namePlaceholder');
    this.saveButton.textContent = this.i18n.t('results.save');
    this.viewButton.textContent = this.i18n.t('results.viewBoard');
```

In `src/ui/styles.css`, add after the `.r-hold span` rule:
```css
.r-namebox { display: grid; justify-items: center; gap: 1cqmin; margin-top: 0.6cqmin; }
.r-name-hint { margin: 0; font-size: 2.2cqmin; color: var(--muted); }
.r-namefield { display: flex; gap: 1.2cqmin; }
.r-name { font: 600 3.4cqmin var(--font-body); width: 36cqmin; padding: 1.2cqmin 2cqmin; border-radius: 1cqmin; border: 0.4cqmin solid var(--ink); background: #fff; color: var(--ink); text-align: center; letter-spacing: 0.04em; }
.r-name:disabled { background: var(--paper-2); }
.r-save, .r-view { font: 600 3cqmin var(--font-body); padding: 1.2cqmin 3.4cqmin; border-radius: 1cqmin; border: 0.4cqmin solid var(--red); background: var(--red); color: #fff; cursor: pointer; touch-action: manipulation; }
.r-save:disabled { opacity: 0.45; cursor: default; }
.r-view { background: #fff; color: var(--red); }
.r-name-msg { margin: 0; font-family: var(--font-display); font-weight: var(--display-weight); font-size: 4.4cqmin; color: var(--red); }
.r-name-msg:empty { display: none; }
```

- [ ] **Step 5: Hold the results screen and log rounds**

In `src/app/flow.ts`, add after `nextPlayer()`:
```ts
  /** Keeps the results screen from timing out (someone is typing a name). */
  holdResults(): void {
    if (this.screen === 'results') this.elapsed = 0;
  }
```

In `src/app/game.ts`:
1. Change the types import to `import type { Lang, Question, RunEvent } from '../core/types';`.
2. Add after `interface RecentStore`:
```ts
/** What the game records about a finished round (the difficulty preset is added by the caller). */
export interface RoundRecord {
  score: number;
  lang: Lang;
  questionsOn: boolean;
}

export interface RoundLog {
  addRound(r: RoundRecord): string;
  /** The results screen closed: the round can be uploaded. */
  finalize(id: string): void;
}
```
3. In `GameUi`, change the results line to:
```ts
  results: { show(info: ResultsInfo, onDone: () => void): void; hide(): void; busy(): boolean };
```
4. In `GameOptions`, add:
```ts
  /** Where finished rounds are logged; left out in autoplay so test rounds never reach the leaderboard. */
  scores?: RoundLog;
```
5. Add a field: `private entryId: string | null = null;`.
6. In `update`, replace the `case 'results':` block with:
```ts
      case 'results':
        if (ui.results.busy()) this.flow.holdResults();
        if (this.o.autoplay && this.flow.elapsed > 2) this.flow.nextPlayer();
        break;
```
7. In `enter`, `case 'attract':`, replace the `if (prev === 'results') { … }` block with:
```ts
        if (prev === 'results') {
          this.cycles++;
          if (this.entryId) this.o.scores?.finalize(this.entryId);
          this.entryId = null;
          this.i18n.set('vi');
        }
```
8. In `case 'finish':`, add as the first line:
```ts
        this.entryId = this.o.scores?.addRound({ score: this.run.score, lang: this.i18n.lang, questionsOn: cfg.questions.perRun > 0 }) ?? null;
```
9. In `case 'results':`, change the `ui.results.show(…)` call to:
```ts
        ui.results.show({ score, gift, entryId: this.features.leaderboard ? this.entryId : null }, () => this.flow.nextPlayer());
```

- [ ] **Step 6: Run the tests and the type check**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, with no type errors. `ResultsScreen.busy` satisfies `GameUi.results.busy`, because its `now` parameter is optional.

- [ ] **Step 7: Commit**

```bash
git add src/ui/results.ts src/ui/styles.css src/i18n/strings.ts src/app/flow.ts src/app/game.ts tests/ui/results.test.ts tests/app/flow.test.ts tests/app/game.test.ts
git commit -m "feat: code-name entry on the results screen; every round logged"
```

---

### Task 16: Leaderboard settings, booth wiring, end-to-end tests, docs, deploy (Phase C)

**Files:**
- Create: `src/ui/staff/leaderboardSection.ts`, `src/ui/staff/download.ts`
- Modify:
  - code: `src/main.ts`, `src/ui/staff.css`
  - tests: `playwright.config.ts`, `tests/e2e/offline.spec.ts`
  - docs: `README.md`, `docs/SETUP_CHECKLIST.md`, `kiosk/OFFLINE-README.txt`
- Test: `tests/ui/staff/leaderboardSection.test.ts`, `tests/e2e/leaderboard.spec.ts`

**Interfaces:**
- Consumes:
  - `ScoreStore`, `deviceId`, `createSupabaseRemote`, `remoteConfigFrom` (Tasks 11–13)
  - `BoardModal`, `AttractScreen.setBoard` (Task 14)
  - `NameEntry` (Task 15)
  - `nextBoardName`, `statusText`
- Produces:
  - `leaderboardSection(source: LogSource, download, now?): Section`
  - `statusText(status): string`
  - `downloadText(filename, text)`

- [ ] **Step 1: Write the failing unit test** (`tests/ui/staff/leaderboardSection.test.ts`)

```ts
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { defaultSettings, type Settings } from '../../../src/core/settings';
import type { ScoreEntry, SyncStatus } from '../../../src/scores/types';
import { leaderboardSection, type LogSource } from '../../../src/ui/staff/leaderboardSection';
import { SettingsPanel } from '../../../src/ui/staff/settingsPanel';

const entry = (id: string, uploaded: boolean): ScoreEntry => ({
  id, at: '2026-10-03T08:00:00.000Z', board: 'booth', score: 42, name: uploaded ? 'Anna' : null, preset: 'normal', lang: 'vi',
  questionsOn: true, device: 'dev', final: true, uploaded,
});

function setup(status: SyncStatus = { mode: 'offline', pending: 1, lastSyncAt: null }) {
  let entries = [entry('a', false), entry('b', true)];
  const source = {
    status: vi.fn(() => status),
    syncNow: vi.fn(async () => undefined),
    log: () => entries,
    remove: vi.fn((id: string) => { entries = entries.filter((e) => e.id !== id); }),
    clearLog: vi.fn(() => { entries = []; }),
    exportCsv: vi.fn(() => 'time,board\r\n'),
  } satisfies LogSource;
  const download = vi.fn<(name: string, text: string) => void>();
  const onSave = vi.fn<(s: Settings) => void>();
  const panel = new SettingsPanel(document.body, { onSave, onClose: vi.fn(), sections: [leaderboardSection(source, download, () => new Date(2026, 9, 3))] });
  panel.open(defaultSettings());
  const click = (name: string) => {
    const b = [...panel.root.querySelectorAll('button')].find((x) => x.textContent === name || x.getAttribute('aria-label') === name);
    if (!b) throw new Error(`no button "${name}"`);
    b.click();
  };
  return { panel, root: panel.root, source, download, onSave, click };
}

describe('leaderboard settings', () => {
  it('shows the sync state and syncs on request', async () => {
    const { root, source, click } = setup();
    expect(root.textContent).toContain('Offline · 1 waiting to upload');
    click('Sync now');
    await Promise.resolve();
    expect(source.syncNow).toHaveBeenCalledTimes(1);
  });
  it('explains the USB copy and disables syncing there', () => {
    const { root } = setup({ mode: 'local-only', pending: 2, lastSyncAt: null });
    expect(root.textContent).toContain('Not connected to Supabase');
    expect([...root.querySelectorAll('button')].find((b) => b.textContent === 'Sync now')!.disabled).toBe(true);
  });
  it('starts a fresh board after a confirm, saved with the settings', () => {
    const { root, click, onSave } = setup();
    click('Clear leaderboard');
    expect(root.textContent).toContain('booth-2');
    click('Start new board');
    click('Save');
    expect(onSave.mock.calls[0][0].leaderboard).toEqual({ enabled: true, board: 'booth-2' });
  });
  it('switches the leaderboard off', () => {
    const { click, onSave } = setup();
    click('Leaderboard');
    click('Save');
    expect(onSave.mock.calls[0][0].leaderboard.enabled).toBe(false);
  });
  it('refuses a board name with capitals or spaces', () => {
    const { root } = setup();
    const f = root.querySelector<HTMLInputElement>('[aria-label="Board name"]')!;
    f.value = 'Booth 1';
    f.dispatchEvent(new Event('input', { bubbles: true }));
    expect([...root.querySelectorAll('button')].find((b) => b.textContent === 'Save')!.disabled).toBe(true);
  });
  it('lists the log with upload state, deletes a round, clears after a confirm, and exports CSV', () => {
    const { root, source, download, click } = setup();
    expect(root.querySelectorAll('.st-logrow')).toHaveLength(2);
    expect(root.textContent).toContain('waiting');
    expect(root.textContent).toContain('uploaded');
    click('Delete round a');
    expect(source.remove).toHaveBeenCalledWith('a');
    expect(root.querySelectorAll('.st-logrow')).toHaveLength(1);
    click('Export CSV');
    expect(download).toHaveBeenCalledWith('vienna-run-scores-2026-10-03.csv', 'time,board\r\n');
    click('Clear log');
    expect(source.clearLog).not.toHaveBeenCalled();
    click('Delete all');
    expect(source.clearLog).toHaveBeenCalledTimes(1);
    expect(root.querySelectorAll('.st-logrow')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/ui/staff/leaderboardSection.test.ts`
Expected: FAIL, because the module can't be resolved.

- [ ] **Step 3: Write the leaderboard section and the download helper**

`src/ui/staff/download.ts`:
```ts
/** Saves text as a file through the browser download (works offline and in the USB copy). */
export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob(['﻿', text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
```

`src/ui/staff/leaderboardSection.ts`:
```ts
import { nextBoardName } from '../../scores/names';
import type { ScoreEntry, SyncStatus } from '../../scores/types';
import { el } from '../dom';
import { button, note, row, textField, toggle } from './fields';
import type { Section } from './settingsPanel';

export interface LogSource {
  status(): SyncStatus;
  syncNow(): Promise<void>;
  log(): ScoreEntry[];
  remove(id: string): void;
  clearLog(): void;
  exportCsv(): string;
}

const SHOWN_ROWS = 100;
const pad = (n: number) => String(n).padStart(2, '0');
const time = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const day = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function statusText(s: SyncStatus): string {
  const waiting = `${s.pending} waiting to upload`;
  const last = s.lastSyncAt ? `last sync ${time(s.lastSyncAt)}` : 'not synced yet';
  switch (s.mode) {
    case 'local-only':
      return 'Not connected to Supabase (USB copy or local build): scores stay on this device.';
    case 'connecting':
      return `Connecting… · ${waiting}`;
    case 'online':
      return `Online · ${waiting} · ${last}`;
    case 'offline':
      return `Offline · ${waiting} · ${last}. Scores upload by themselves when the internet is back.`;
  }
}

/** A button that asks inline before acting (no browser dialogs on a kiosk). */
function confirmAction(label: string, question: () => string, yesLabel: string, onYes: () => void): HTMLElement {
  const box = el('div', 'st-confirm');
  const ask = () => {
    const yes = button(yesLabel, () => {
      box.replaceChildren(start);
      onYes();
    }, 'st-btn danger');
    const no = button('Keep it', () => box.replaceChildren(start));
    box.replaceChildren(el('span', 'st-note', question()), yes, no);
  };
  const start = button(label, ask, 'st-btn danger');
  box.append(start);
  return box;
}

/** Leaderboard switch, board name, sync state and this device's score log. Log actions apply at once (no Save). */
export function leaderboardSection(source: LogSource, download: (filename: string, text: string) => void, now: () => Date = () => new Date()): Section {
  return {
    title: 'Leaderboard and score log',
    render(ctx) {
      const d = ctx.draft;
      const status = el('span', 'st-status', statusText(source.status()));
      const refreshStatus = () => {
        status.textContent = statusText(source.status());
      };
      const sync = button('Sync now', () => {
        sync.disabled = true;
        status.textContent = 'Syncing…';
        void source.syncNow().then(() => {
          refreshStatus();
          sync.disabled = source.status().mode === 'local-only';
        });
      });
      sync.disabled = source.status().mode === 'local-only';

      const logBox = el('div', 'st-log');
      const renderLog = () => {
        const entries = source.log();
        const rows = entries.slice(0, SHOWN_ROWS).map((e) => {
          const line = el('div', 'st-logrow');
          const del = button('Delete', () => {
            source.remove(e.id);
            renderLog();
            refreshStatus();
          }, 'st-btn small');
          del.setAttribute('aria-label', `Delete round ${e.id}`);
          line.append(
            el('span', '', time(e.at)),
            el('b', '', String(e.score)),
            el('span', '', e.name ?? '—'),
            el('span', 'st-unit', `${e.preset} · ${e.lang} · questions ${e.questionsOn ? 'on' : 'off'}`),
            el('span', e.uploaded ? 'st-ok' : 'st-wait', e.uploaded ? '✓ uploaded' : e.final ? '⏳ waiting' : '… on results'),
            del,
          );
          return line;
        });
        const count = entries.length === 0 ? 'No rounds on this device yet.' : `${entries.length} rounds on this device${entries.length > SHOWN_ROWS ? ` (newest ${SHOWN_ROWS} shown)` : ''}.`;
        logBox.replaceChildren(note(count), ...rows);
      };
      renderLog();

      const newBoard = confirmAction(
        'Clear leaderboard',
        () => `Start a new, empty board "${nextBoardName(ctx.draft.leaderboard.board)}"? Old scores stay in the database.`,
        'Start new board',
        () => {
          const next = nextBoardName(ctx.draft.leaderboard.board);
          ctx.edit((x) => { x.leaderboard.board = next; }, true);
          ctx.notice(`New board "${next}" starts when you press Save.`);
        },
      );
      const clear = confirmAction(
        'Clear log',
        () => `Delete all ${source.log().length} rounds from this device? Rounds not uploaded yet are lost.`,
        'Delete all',
        () => {
          source.clearLog();
          renderLog();
          refreshStatus();
        },
      );
      const exportCsv = button('Export CSV', () => download(`vienna-run-scores-${day(now())}.csv`, source.exportCsv()));

      const box = el('div');
      box.append(
        toggle('Leaderboard', d.leaderboard.enabled, (v) => ctx.edit((x) => { x.leaderboard.enabled = v; })),
        textField('Board name', d.leaderboard.board, { maxLength: 24 }, (v) => ctx.edit((x) => { x.leaderboard.board = v; })),
        note('This device shows and uploads scores for this board: "booth" on the booth PC, "test" on team laptops.'),
        row('', newBoard),
        row('Sync', status, sync),
        el('h4', 'st-subhead', 'Score log (this device)'),
        note('These actions happen at once (no Save needed) and only on this device; uploaded scores stay in Supabase.'),
        row('', exportCsv, clear),
        logBox,
      );
      return box;
    },
  };
}
```

Append to `src/ui/staff.css`:
```css
.st-subhead { margin: 2cqmin 0 0.4cqmin; font-family: var(--font-display); font-weight: var(--display-weight); font-size: 2.8cqmin; }
.st-status { font-weight: 600; }
.st-confirm { display: flex; flex-wrap: wrap; gap: 1cqmin; align-items: center; }
.st-log { display: grid; gap: 0.6cqmin; max-height: 60cqmin; overflow-y: auto; touch-action: pan-y; }
.st-logrow { display: grid; grid-template-columns: 16cqmin 8cqmin 18cqmin 1fr 18cqmin auto; gap: 1.2cqmin; align-items: center; padding: 0.6cqmin 1cqmin; border-radius: 0.5cqmin; background: #fff; font-size: 2cqmin; }
.st-ok { color: var(--green); font-weight: 600; }
.st-wait { color: var(--red-ink); font-weight: 600; }
```

- [ ] **Step 4: Run the unit test**

Run: `npx vitest run tests/ui/staff/leaderboardSection.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing end-to-end tests**

In `playwright.config.ts`, add to `webServer`:
```ts
    // A fake Supabase address: the leaderboard e2e test intercepts it. The real one only exists on Vercel.
    env: { NEXT_PUBLIC_SUPABASE_URL: 'https://vr-e2e.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'e2e-public-key' },
```

`tests/e2e/leaderboard.spec.ts`:
```ts
import { expect, test, type Page, type Route } from '@playwright/test';

const API = 'https://vr-e2e.supabase.co/rest/v1/vienna_run_scores';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

async function toResults(page: Page) {
  await page.goto('/?speed=8&seed=3');
  await page.waitForFunction(() => (window as any).__vr?.screen === 'attract', null, { timeout: 60_000 });
  const vp = page.viewportSize()!;
  await page.mouse.click(vp.width / 2, vp.height / 2);
  await page.waitForFunction(() => (window as any).__vr?.screen === 'results', null, { timeout: 120_000 });
}

test('a player saves a code name and sees it on the start screen', async ({ page }) => {
  await page.route(`${API}**`, (route) => route.abort('internetdisconnected'));
  await toResults(page);
  const name = page.locator('.r-name');
  await name.pressSequentially('Anna!!', { delay: 20 });
  await expect(name).toHaveValue('Anna');
  await page.locator('.r-save').click();
  await expect(page.locator('.r-name-msg')).toHaveText('Bạn đứng thứ #1 hôm nay!');
  await page.waitForFunction(() => (window as any).__vr?.screen === 'attract', null, { timeout: 60_000 });
  await expect(page.locator('.board-panel')).toContainText('Anna');
  await page.locator('.board-open').click();
  await expect(page.locator('.board-modal')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__vr.screen)).toBe('attract');
});

test('a score saved offline uploads exactly once when the connection returns', async ({ page }) => {
  let online = false;
  const posted: string[] = [];
  const rows: Record<string, unknown>[] = [];
  await page.route(`${API}**`, async (route: Route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (!online) return route.abort('internetdisconnected');
    if (req.method() === 'POST') {
      const body = JSON.parse(req.postData() ?? '[]') as Record<string, unknown>[];
      for (const r of body) {
        posted.push(String(r.id));
        if (!rows.some((x) => x.id === r.id)) rows.push(r);
      }
      return route.fulfill({ status: 201, headers: CORS, contentType: 'application/json', body: JSON.stringify(body.map((r) => ({ id: r.id }))) });
    }
    const named = rows.filter((r) => r.name !== null).map((r) => ({ id: r.id, created_at: r.created_at, name: r.name, score: r.score }));
    return route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify(named) });
  });
  await toResults(page);
  await page.locator('.r-name').pressSequentially('Bo');
  await page.locator('.r-save').click();
  await page.waitForFunction(() => (window as any).__vr?.screen === 'attract', null, { timeout: 60_000 });
  await page.waitForTimeout(500);
  expect(posted).toEqual([]);

  online = true;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => posted.length, { timeout: 15_000 }).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(1_500);
  expect(posted).toHaveLength(1);
  expect(rows[0]).toMatchObject({ name: 'Bo', board: 'booth', lang: 'vi', preset: 'normal', questions_on: true });
});
```

In `tests/e2e/offline.spec.ts`:
- add `import { readFileSync } from 'node:fs';`
- replace the `beforeAll` body with:
```ts
  // Even with Supabase details in the environment, the USB copy must not contain them.
  execSync('npm run build:offline', { stdio: 'inherit', env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: 'https://vr-e2e.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'e2e-public-key' } });
```
- add at the end of the test:
```ts
  const html = readFileSync('dist-offline/index.html', 'utf8');
  expect(html).not.toContain('vr-e2e');
  expect(html).not.toContain('e2e-public-key');
```

- [ ] **Step 6: Run them to verify they fail**

Run: `npx playwright test tests/e2e/leaderboard.spec.ts`
Expected: FAIL, because nothing logs rounds yet and there is no `.r-name`.

- [ ] **Step 7: Wire the leaderboard into `src/main.ts`**

1. Add imports:
```ts
import { safeLocalStorage } from './app/storage';
import { remoteConfigFrom } from './scores/env';
import { deviceId } from './scores/ids';
import { createSupabaseRemote } from './scores/remote';
import { ScoreStore } from './scores/store';
import type { BoardView } from './ui/attract';
import { BoardModal } from './ui/boardModal';
import { downloadText } from './ui/staff/download';
import { leaderboardSection } from './ui/staff/leaderboardSection';
```
and extend the storage import to `import { readJson, safeLocalStorage, writeJson } from './app/storage';` (drop the separate line above if it duplicates).

2. Right after `let settings = loadSettings();`, add:
```ts
  // Leaderboard: kept on this device first; uploaded to Supabase when the hosted build has its details.
  // Autoplay (bot) rounds never touch it beyond the device, and the USB copy has no details at all.
  const remoteCfg = params.autoplay ? null : remoteConfigFrom(import.meta.env);
  const scores = new ScoreStore({
    storage: safeLocalStorage(),
    remote: remoteCfg ? createSupabaseRemote(remoteCfg) : null,
    board: settings.leaderboard.board,
    device: deviceId(),
  });
  scores.finalizeStale(120_000);
  scores.start();
  const boardModal = new BoardModal(stage, i18n, scores);
```

3. In the `ui` object, change the attract and results lines to:
```ts
    attract: new AttractScreen(stage, i18n, icons, art.url('logo'), () => boardModal.open('today')),
```
```ts
    results: new ResultsScreen(stage, i18n, CONFIG.flow.holdSeconds * 1000, {
      save: (id, name) => (scores.saveName(id, name) ? scores.rankOf(id) : false),
      open: (id) => boardModal.open('today', id),
    }),
```

4. After the `ui` object, add:
```ts
  const pushBoard = () => {
    if (!settings.leaderboard.enabled) {
      ui.attract.setBoard(null);
      return;
    }
    const view: BoardView = {
      rows: scores.top('today', 10),
      state: !scores.available ? 'unavailable' : scores.status().mode === 'offline' ? 'offline' : 'ok',
    };
    ui.attract.setBoard(view);
  };
  scores.onChange(pushBoard);
  pushBoard();
```

5. In `new Game({ … })`, add:
```ts
    scores: params.autoplay ? undefined : { addRound: (r) => scores.addRound({ ...r, preset: settings.preset }), finalize: (id) => scores.finalize(id) },
```
and replace the `onAttract` callback with:
```ts
    onAttract: (cycles) => {
      boardModal.hide();
      scores.refresh(30_000);
      applyUpdateIfReady();
      if (!params.autoplay && shouldRefresh(cycles, performance.now() - bootedAt, CONFIG.watchdog)) location.reload();
    },
```

6. In the `SettingsPanel` options, add `sections: [leaderboardSection(scores, downloadText)],`, and in `onSave`, add after `saveSettings(s);`:
```ts
      scores.setBoard(s.leaderboard.board);
      pushBoard();
```

7. After the `attachCornerHold(…)` call, add:
```ts
  // Other devices' scores appear while the start screen waits for the next player.
  window.setInterval(() => {
    if (!staffOpen && game.flow.screen === 'attract') scores.refresh(30_000);
  }, 30_000);
```

- [ ] **Step 8: Document it**

In `README.md`, add after the Languages section:
```markdown
## Leaderboard
Players can save a code name (A–Z, 0–9, up to 12 characters) on the results screen. The start screen
shows today's top 10; the **Bảng xếp hạng** button opens Today / All time.

- **Offline first:** every round is saved on the device, then uploaded to Supabase in the background.
  With no internet the game plays normally, the board shows the last downloaded copy plus this
  device's own scores, and queued rounds upload by themselves when the connection returns.
- **Database:** table `public.vienna_run_scores` in the `supabase-green-river` database (Vercel →
  Storage). Each Vercel deploy runs `scripts/migrate-db.ts` (`npm run vercel-build`), which creates the
  table and its rules if needed. The public key may only add and read rows.
- **Board names:** each device shows one board (settings → Leaderboard). Use `booth` on the booth PC
  and `test` on team laptops. "Clear leaderboard" switches to a fresh board (`booth-2`, …); old scores
  stay in the database.
- **Score log:** settings → Leaderboard lists every round on this device, with Export CSV.
- **USB copy:** built without Supabase details, so its leaderboard stays on that PC.
```

In `docs/SETUP_CHECKLIST.md`:
- in step 6 (Touch), replace `Settings → Time & language → Typing → Touch keyboard → don't show automatically.` with `Settings → Time & language → Typing → Touch keyboard → **show the touch keyboard when there's no keyboard attached** (players type their code name). Skip this if a physical keyboard is plugged in.`
- add after the Settings step:
```markdown
11. **Leaderboard:** in settings → Leaderboard, check the board name is **booth** (team laptops: **test**).
    Finish one round, type a test name, and check it shows on the start screen. Then delete that round in
    the score log if you don't want it on the board (it stays in the database).
```
- add to "During the event":
```markdown
- **Before packing up:** settings → Leaderboard must read **0 waiting to upload** (connect to the internet
  and press **Sync now** if not), then press **Export CSV** for a local copy of all rounds.
```

In `kiosk/OFFLINE-README.txt`, add before the last paragraph:
```
The leaderboard in this copy stays on this PC (it does not upload).
```

- [ ] **Step 9: Run everything**

Run: `npx tsc --noEmit && npm test && npm run build && npm run e2e`
Expected:
- no type errors;
- all unit tests PASS;
- the build succeeds;
- every browser test PASSES: smoke, offline, soak (20 rounds), settings, language, and both leaderboard tests.

- [ ] **Step 10: Commit, deploy Phase C, and check the live database**

```bash
git add src/main.ts src/ui/staff/leaderboardSection.ts src/ui/staff/download.ts src/ui/staff.css playwright.config.ts tests/e2e/leaderboard.spec.ts tests/e2e/offline.spec.ts tests/ui/staff/leaderboardSection.test.ts README.md docs/SETUP_CHECKLIST.md kiosk/OFFLINE-README.txt
git commit -m "feat: offline-first Supabase leaderboard with name entry and score log"
git push origin main
```
1. With the Vercel MCP `get_project`, check the project's build command. If it is overridden to anything other than the `vercel-build` script, set it to `npm run vercel-build` with `update_project`, and ledger the change.
2. Deploy with `create_deployment` (Global Constraints) and wait for `READY`. In the build events, find the `[migrate-db] Table vienna_run_scores is ready` line, or the warning; on a warning, stop and investigate with systematic-debugging.
3. Check the live database through the public REST API with the public key from the live bundle. That key is public by design, and no secret is decrypted:
```bash
JS=$(curl -s https://vienna-run.vercel.app/ | grep -o 'assets/index-[^"]*\.js' | head -1)
curl -s "https://vienna-run.vercel.app/$JS" > /tmp/vr.js
SB_URL=$(grep -o 'https://[a-z0-9]*\.supabase\.co' /tmp/vr.js | head -1)
SB_KEY=$(grep -oE '(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|sb_publishable_[A-Za-z0-9_-]+)' /tmp/vr.js | head -1)
curl -s -o /dev/null -w '%{http_code}\n' "$SB_URL/rest/v1/vienna_run_scores?select=id&limit=1" -H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY"
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE "$SB_URL/rest/v1/vienna_run_scores?board=eq.nothing" -H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY"
```
Expected: `200` for the read, and `401` or `403` for the delete. `204` would mean deletes are allowed, so stop and fix the policies.

Send the user the link, and say that a real round on the live site will appear in Supabase.
