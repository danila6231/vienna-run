# Vienna Run MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Vienna-themed 3-lane booth runner (pop-up diorama style) as an offline-capable web app that never gets stuck or crashes in front of visitors.

**Architecture:** Game rules live in `src/core/` as pure, deterministic TypeScript (no DOM, no Three.js), fully unit-tested and reused by a headless score simulator. A Three.js layer in `src/render/` draws the paper-cutout street from the core state, with art resolved through a manifest (designer PNG if present, otherwise the prototype's placeholder painters). A DOM/CSS layer in `src/ui/` draws the HUD and screens, and `src/app/` holds the screen state machine, game controller, kiosk hardening and watchdog.

**Tech Stack:** Vite 8, TypeScript (strict), Three.js, Vitest + jsdom, Playwright, vite-plugin-pwa, vite-plugin-singlefile, Fontsource fonts (Federo, Albert Sans), tsx for scripts.

**Spec:** `docs/superpowers/specs/2026-10-03-vienna-run-design.md` (visual reference: `docs/prototypes/style-test.html`, option A)

**Order note:** The spec's milestones put the street first because the style was still undecided. Option A is now chosen, so this plan builds the pure rules first (test-first), then the renderer, UI, reliability layer and delivery. The designer brief stays the first deliverable (Task 2) so art can start immediately.

## Global Constraints

- Landscape 16:9, designed at 1920×1080, everything scales with the stage (`cqmin` units in CSS, camera aspect in 3D).
- English-only UI copy. Use "−" (U+2212) for negative points.
- No runtime network requests: fonts come from `@fontsource/*`, all art is bundled, and no CDN URLs appear anywhere in `src/`.
- Dependencies are installed with `npm install -E` (exact versions) and `package-lock.json` is committed.
- TypeScript `strict`, `noUnusedLocals`, `noUnusedParameters`. The only exception is `src/render/placeholders/paint.ts` (`// @ts-nocheck`, throwaway placeholder art ported verbatim).
- `src/core/` must not import `three`, anything from `src/render|ui|app|input`, or touch `window`/`document`.
- All tunables live in `src/config.ts` (no staff panel).
- Art: flat PNG/WebP/SVG only, max 2048 px per side (downscaled on load if larger), paper edge added in code.
- Sound: silent. The only audio code is the no-op hook in `src/app/audio.ts`.
- Browser target: Chromium (Edge/Chrome) on Windows, in kiosk mode.
- Deviation from the spec: the question window is 4–30 s (spec: 4–35 s). A slot opening at 35 s cannot reach a treat before the finish, which would break "fixed count per player".
- Every commit message ends with the session's required attribution trailer lines.

## Review Focus

1. **Two hands or a palm on the screen (multi-touch):** only the primary pointer may change lanes, one lane per touch, and a second finger must do nothing. → `tests/input/touch.test.ts` (Task 10).
2. **The player walks away at any moment (mid-run, mid-question, on results):** with zero input the booth must return to the attract screen within about 2.5 minutes. → `tests/app/flow.test.ts` (Task 11) and `tests/app/game.test.ts` (Task 16).
3. **Frantic tapping during transitions (how-to, countdown, answer feedback, results):** no skipped screens, no double answers, and a tap must never dismiss the results (only the 1-second hold does). → `tests/app/flow.test.ts` (Task 11), `tests/ui/question.test.ts` and `tests/ui/results.test.ts` (Task 12), `tests/app/game.test.ts` (Task 16).
4. **Browser storage blocked, full or corrupted (private window, wiped kiosk profile, garbage JSON):** the game must run normally; it just can't avoid repeating recent questions. → `tests/app/storage.test.ts` (Task 13).
5. **Designer art that doesn't match the brief exactly (one run frame, missing optional frames, odd aspect ratio, a broken file):** fall back to placeholders per file or group, and size by the image's own aspect. → `tests/assets/resolve.test.ts` (Task 8). Broken files are skipped with a warning in `loadArt`.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`, `src/vite-env.d.ts`, `.gitignore`, `.gitattributes`

**Interfaces:**
- Consumes: nothing
- Produces: npm scripts `dev`, `build`, `preview`, `test`, `test:watch`; Vitest picks up `tests/**/*.test.ts`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "vienna-run",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview --port 4173 --strictPort",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Install pinned dependencies**

Run:
```bash
npm install -E three @fontsource/federo @fontsource/albert-sans
npm install -E -D vite vitest typescript @types/three @types/node jsdom tsx
```
Expected: both finish without errors and `package.json` gains exact versions (no `^`).

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src", "tests", "scripts"]
}
```

- [ ] **Step 4: Write `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 5: Write `index.html`, `src/main.ts`, `src/vite-env.d.ts`**

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
    <title>Vienna Run</title>
  </head>
  <body>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/main.ts` (replaced in Task 9):
```ts
document.body.textContent = 'Vienna Run';
```

`src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
```

- [ ] **Step 6: Write `.gitignore` and `.gitattributes`**

`.gitignore`:
```
node_modules/
dist/
dist-offline/
test-results/
playwright-report/
vienna-run-offline.zip
.vercel/
.DS_Store
```

`.gitattributes`:
```
*.bat text eol=crlf
```

- [ ] **Step 7: Verify the toolchain**

Run: `npm test && npm run build`
Expected: Vitest prints "No test files found, exiting with code 0"; `tsc` passes; Vite writes `dist/index.html`.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src .gitignore .gitattributes
git commit -m "chore: scaffold Vite + TypeScript + Vitest project"
```

---

### Task 2: Designer asset brief

**Files:**
- Create: `docs/ASSET_SPEC.md`, `src/assets/art/.gitkeep`

**Interfaces:**
- Consumes: the asset table in the spec
- Produces: the file IDs that `src/assets/manifest.ts` (Task 8) resolves. **These names are a contract:** `facade-NN`, `back-NN`, `landmark-stephansdom|karlskirche|hofburg|tram`, `riesenrad-wheel|cabin|support`, `item-sacher|kipferl|melange|mozart|krampus|bomb`, `waiter-run-NN`, `waiter-stumble-NN`, `waiter-celebrate-NN`, `prop-lamp`, `banner-finish`, `cloud-NN`, `skyline`, `sky`, `texture-road`, `texture-sidewalk`, `gift-N`, `logo`.

- [ ] **Step 1: Write `docs/ASSET_SPEC.md`**

````markdown
# Vienna Run: art brief

Vienna Run is a 40-second booth game. A Viennese waiter (Herr Ober) runs down a Vienna street
from Stephansdom to the Riesenrad, collecting treats and dodging Krampus and bombs. The look is a
**pop-up book**: flat, illustrated paper cutouts standing in a 3D street. To see it moving, open
`docs/prototypes/style-test.html` (option A) in Chrome. Everything there is placeholder art that
your files will replace.

## The short version
- **Everything is a flat image. No 3D models.** The game handles perspective, movement,
  rotation, bobbing and shadows.
- **Format:** transparent PNG (sRGB). WebP is fine too. Max 2048 px on any side.
- **Hard edges only.** The game cuts each image out at its edge, so soft glows, feathered edges
  and painted-in shadows get clipped off.
- **Leave out:** no white paper border, no drop shadow, no ground shadow. The game adds the
  paper edge and shadow to every cutout so they all match.
- **Padding:** leave about 3% transparent padding on every side of a cutout, so the added paper
  edge has room. Facades and tiling textures are the exception (see below).
- **View:** flat, front-on elevation. No vanishing points.
- **Light:** always from the upper left.
- **Outline:** dark brown ink (`#3A2A22`), about 3–4 px at 1024 px size.
- **Budget:** about 12 MB in total. The offline USB copy packs every image into one file.

## Palette (from the prototype)
| Use | Hex |
|---|---|
| Schönbrunn yellow | `#F1CD68` |
| Cream | `#EFE2C6` |
| Dusty pink | `#EBBFAC` |
| Pale mint | `#C7D7CD` |
| Stone grey | `#DAD5CD` |
| Ochre | `#E8D5A2` |
| Copper-green roofs and domes | `#6F9F8B` |
| Ink outline | `#3A2A22` |
| Austrian red | `#C8102E` |
| Paper white (added by the game) | `#FFFAF0` |

## File list
Put finished files in `src/assets/art/` using exactly these names. Any file you haven't delivered
yet keeps its placeholder, so you can deliver piece by piece.

| File name | Count | Size (px) | Notes |
|---|---|---|---|
| `facade-01.png` … `facade-08.png` | 6–8 | 1024×1536 (2:3) | One building front, 8 m wide × 12 m tall. Ground floor touches the bottom edge. **Left and right edges straight and flush, no padding** (buildings stand side by side). Transparent sky above an interesting roofline (gables, domes, statues). Vary the shop signs: Café, Konditorei, Bäckerei, Apotheke… |
| `back-01.png` … | 4–6 | 640×1024 (5:8) | Buildings in the second row. Simpler and low contrast; the game adds haze. |
| `landmark-stephansdom.png` | 1 | long side 2048 | Shown 33 m tall. Any aspect ratio. The zigzag roof tiles are the signature. |
| `landmark-karlskirche.png` | 1 | long side 2048 | Shown 23.4 m tall. Dome, portico, two big columns. |
| `landmark-hofburg.png` | 1 | long side 2048 | Shown 21 m tall. Michaelertor-style dome. |
| `landmark-tram.png` | 1 | about 2048×512 | Side view of a red-and-white Vienna tram, shown 14 m long. |
| `riesenrad-wheel.png` | 1 | 2048×2048 | The wheel only: rims and spokes, **no cabins**. The wheel's center must be the image center (the game spins it). Shown 29 m wide. |
| `riesenrad-cabin.png` | 1 | 256×256 | One red cabin, hanging upright. The game places 15 of them around the wheel. |
| `riesenrad-support.png` | 1 | 2048 wide | Legs and base building. The hub point is **top center**; the bottom edge is the ground. |
| `item-sacher.png`, `item-kipferl.png`, `item-melange.png`, `item-mozart.png`, `item-krampus.png`, `item-bomb.png` | 6 | 512×512 | Object fills about 70% of the canvas, centered, 3/4 front view. Must read clearly at 60–90 px on screen. Treats warm and tasty-looking; Krampus and the bomb dark/red and instantly "bad". |
| `waiter-run-01.png` … `waiter-run-08.png` | 6–8 | 512×768 per frame | Herr Ober **seen from behind**: black tailcoat, slick hair, right arm raised holding a silver tray, white napkin over the left forearm. One full running cycle. |
| `waiter-stumble-01.png` … | 0–2 | 512×768 | Optional: hit by a bomb. If missing, the game wobbles the run frames instead. |
| `waiter-celebrate-01.png` … | 0–2 | 512×768 | Optional: crossing the finish. |
| `prop-lamp.png` | 1 | about 200×1024 | Ornate Viennese street lantern, shown 4.5 m tall. |
| `banner-finish.png` | 1 | 1024×200 | "ZIEL · FINISH" banner, shown 10.4 m wide. Poles and the checkered line are drawn by the game. |
| `cloud-01.png` … | 1–3 | 512×240 | Paper clouds. |
| `skyline.png` | 1 | 4096×512 | Far-away Vienna skyline silhouette, transparent above. Shown 560 m wide behind haze, so low contrast is fine. |
| `sky.png` | 0–1 | 2048×1024 | Optional painted sky (no transparency). Without it the game uses a soft gradient. |
| `texture-road.png` | 1 | 1024×1024 | **Seamless tiling** cobblestones, no transparency, **no lane lines** (the game draws them). One tile covers 9 m × 9 m (the full 3-lane road width). |
| `texture-sidewalk.png` | 1 | 512×512 | **Seamless tiling** paving slabs; one tile covers 3.4 m × 3.4 m. |
| `gift-0.png`, `gift-1.png` … | 1 per gift tier | 512×512 | Shown on the results screen. `gift-0` is the lowest tier (everyone gets it). |
| `logo.svg` | 0–1 | vector | Optional; replaces the "Vienna Run" title on the start screen. |

## Two anchors that must match across waiter frames
- **Feet:** bottom center of every frame (x = 256, y = 768).
- **Tray center:** the same pixel in every frame, ideally **x = 376, y = 72**. Collected treats
  stack on this point. If you put the tray elsewhere, tell the developer the pixel and they'll
  change one constant (`TRAY` in `src/render/runner.ts`).

## How a file goes live
1. Save it into `src/assets/art/` with the exact name above.
2. Run the game (`npm run dev`). The self-check page (`?check=1`) lists every image and whether
   it's coming from your file or a placeholder.
````

- [ ] **Step 2: Create the art folder placeholder**

Run: `mkdir -p src/assets/art && touch src/assets/art/.gitkeep`

- [ ] **Step 3: Commit**

```bash
git add docs/ASSET_SPEC.md src/assets/art/.gitkeep
git commit -m "docs: add designer art brief"
```

---

### Task 3: Core foundations: config, types, RNG, scoring

**Files:**
- Create: `src/config.ts`, `src/core/types.ts`, `src/core/rng.ts`, `src/core/scoring.ts`
- Test: `tests/config.test.ts`, `tests/core/rng.test.ts`, `tests/core/scoring.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `CONFIG: GameConfig`; `interface Tier { min: number; name: string }`
  - `type Lane = -1 | 0 | 1`, `GoodType`, `BadType`, `ItemType`, `GOOD_TYPES`, `BAD_TYPES`, `isGood(t)`, `ItemState`, `Item`, `RunEvent`, `Question`
  - `type Rng = () => number`, `createRng(seed)`, `randRange(rng, a, b)`, `pick(rng, arr)`, `shuffle(rng, arr)`, `randomSeed()`
  - `applyPoints(score, delta)`, `questionPoints(base, correct)`, `tierIndex(score, tiers)`

- [ ] **Step 1: Write the failing tests**

`tests/core/rng.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createRng, pick, randRange, shuffle } from '../../src/core/rng';

describe('createRng', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = createRng(42), b = createRng(42);
    expect(Array.from({ length: 5 }, () => a())).toEqual(Array.from({ length: 5 }, () => b()));
  });
  it('differs between seeds', () => {
    expect(createRng(1)()).not.toBe(createRng(2)());
  });
  it('stays within [0, 1)', () => {
    const r = createRng(7);
    for (let i = 0; i < 2000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('helpers', () => {
  it('shuffle keeps every element', () => {
    expect(shuffle(createRng(3), [1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
  });
  it('pick returns a member', () => {
    expect(['a', 'b', 'c']).toContain(pick(createRng(9), ['a', 'b', 'c']));
  });
  it('randRange stays inside the range', () => {
    const r = createRng(5);
    for (let i = 0; i < 500; i++) {
      const v = randRange(r, 3, 4);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThan(4);
    }
  });
});
```

`tests/core/scoring.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { applyPoints, questionPoints, tierIndex } from '../../src/core/scoring';

const tiers = [
  { min: 0, name: 'Small treat' },
  { min: 80, name: 'Gift B' },
  { min: 100, name: 'Gift C' },
  { min: 120, name: 'Gift D' },
];

describe('scoring', () => {
  it('never lets the score drop below zero', () => {
    expect(applyPoints(10, -15)).toBe(0);
    expect(applyPoints(30, -15)).toBe(15);
    expect(applyPoints(0, 5)).toBe(5);
  });
  it('doubles a question item when right and gives nothing when wrong', () => {
    expect(questionPoints(10, true)).toBe(20);
    expect(questionPoints(15, false)).toBe(0);
  });
  it.each([
    [0, 0], [79, 0], [80, 1], [99, 1], [100, 2], [119, 2], [120, 3], [999, 3],
  ])('score %i lands in tier %i', (score, tier) => {
    expect(tierIndex(score, tiers)).toBe(tier);
  });
  it('handles tiers listed out of order', () => {
    expect(tierIndex(105, [tiers[2], tiers[0], tiers[3], tiers[1]])).toBe(0);
  });
});
```

`tests/config.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';

describe('CONFIG', () => {
  it('has a tier for every score, starting at 0 and ascending', () => {
    expect(CONFIG.tiers[0].min).toBe(0);
    for (let i = 1; i < CONFIG.tiers.length; i++) expect(CONFIG.tiers[i].min).toBeGreaterThan(CONFIG.tiers[i - 1].min);
  });
  it('fits all question slots into the window with the minimum gap', () => {
    const q = CONFIG.questions;
    expect(q.windowEnd - q.windowStart).toBeGreaterThanOrEqual((q.perRun - 1) * q.minGap);
  });
  it('makes treats worth points and obstacles cost points', () => {
    for (const v of Object.values(CONFIG.items)) expect(v.good ? v.points > 0 : v.points < 0).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/config.test.ts tests/core/rng.test.ts tests/core/scoring.test.ts`
Expected: FAIL. The modules can't be resolved.

- [ ] **Step 3: Write `src/core/types.ts`**

```ts
export type Lane = -1 | 0 | 1;
export type GoodType = 'sacher' | 'kipferl' | 'melange' | 'mozart';
export type BadType = 'krampus' | 'bomb';
export type ItemType = GoodType | BadType;

export const GOOD_TYPES: readonly GoodType[] = ['sacher', 'kipferl', 'melange', 'mozart'];
export const BAD_TYPES: readonly BadType[] = ['krampus', 'bomb'];
export const isGood = (t: ItemType): t is GoodType => (GOOD_TYPES as readonly string[]).includes(t);

export type ItemState = 'live' | 'taken' | 'hit';

export interface Item {
  id: number;
  /** Distance along the route, in metres. */
  at: number;
  lane: Lane;
  type: ItemType;
  state: ItemState;
  /** Seconds since the item was taken or hit (drives its exit animation). */
  t: number;
  /** True when collecting this item opened a bonus question. */
  question: boolean;
}

export type RunEvent =
  | { kind: 'collect'; item: Item; points: number }
  | { kind: 'hit'; item: Item; points: number }
  | { kind: 'question'; item: Item }
  | { kind: 'answer'; item: Item; correct: boolean; points: number }
  | { kind: 'finish'; score: number };

export interface Question {
  id: string;
  q: string;
  options: [string, string, string];
  answer: 0 | 1 | 2;
}
```

- [ ] **Step 4: Write `src/config.ts`**

```ts
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
```

- [ ] **Step 5: Write `src/core/rng.ts`**

```ts
export type Rng = () => number;

/** mulberry32: small, fast, deterministic. Same seed, same game. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randRange = (rng: Rng, a: number, b: number): number => a + rng() * (b - a);

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function shuffle<T>(rng: Rng, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const randomSeed = (): number => Math.floor(Math.random() * 2 ** 31);
```

- [ ] **Step 6: Write `src/core/scoring.ts`**

```ts
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
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/config.test.ts tests/core/rng.test.ts tests/core/scoring.test.ts`
Expected: PASS (all tests green).

- [ ] **Step 8: Commit**

```bash
git add src/config.ts src/core tests/config.test.ts tests/core
git commit -m "feat(core): add config, shared types, seeded RNG and scoring"
```

---

### Task 4: Route and item spawner

**Files:**
- Create: `src/core/route.ts`, `src/core/spawner.ts`
- Test: `tests/core/route.test.ts`, `tests/core/spawner.test.ts`

**Interfaces:**
- Consumes: `GameConfig`, `CONFIG` (Task 3); `Rng`, `pick`, `randRange`, `shuffle`, `createRng` (Task 3); `Item`, `ItemType`, `Lane`, `BAD_TYPES` (Task 3)
- Produces:
  - `type LandmarkId = 'stephansdom' | 'tram' | 'karlskirche' | 'hofburg' | 'riesenrad'`
  - `interface Landmark { id; at: number; side: -1 | 1; plaza: [number, number] | null }`, `LANDMARKS`
  - `inPlaza(p: number, side: -1 | 1, margin?: number): boolean`
  - `generateItems(rng: Rng, cfg: GameConfig): Item[]`, sorted by `at`, ids from 1

- [ ] **Step 1: Write the failing tests**

`tests/core/route.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { inPlaza, LANDMARKS } from '../../src/core/route';

describe('route', () => {
  it('puts the Riesenrad at the finish line', () => {
    expect(LANDMARKS.find((l) => l.id === 'riesenrad')?.at).toBe(CONFIG.runLength);
  });
  it('opens a plaza only on the landmark side', () => {
    expect(inPlaza(65, 1)).toBe(true);
    expect(inPlaza(65, -1)).toBe(false);
    expect(inPlaza(150, 1)).toBe(false);
  });
  it('widens plazas by the margin', () => {
    expect(inPlaza(65 + 18, 1)).toBe(false);
    expect(inPlaza(65 + 18, 1, 4)).toBe(true);
  });
});
```

`tests/core/spawner.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { createRng } from '../../src/core/rng';
import { generateItems } from '../../src/core/spawner';

const seeds = Array.from({ length: 200 }, (_, i) => i + 1);
const run = (seed: number) => generateItems(createRng(seed), CONFIG);

describe('generateItems', () => {
  it('is deterministic for a seed', () => {
    expect(run(11)).toEqual(run(11));
  });
  it('keeps items between the first spawn point and the finish clearing', () => {
    for (const s of seeds) for (const it of run(s)) {
      expect(it.at).toBeGreaterThanOrEqual(CONFIG.spawn.firstAt);
      expect(it.at).toBeLessThan(CONFIG.runLength - CONFIG.spawn.finishClear);
    }
  });
  it('returns items sorted by distance', () => {
    for (const s of seeds) {
      const items = run(s);
      for (let i = 1; i < items.length; i++) expect(items[i].at).toBeGreaterThanOrEqual(items[i - 1].at);
    }
  });
  it('never blocks all three lanes with obstacles', () => {
    for (const s of seeds) {
      const bad = run(s).filter((i) => !CONFIG.items[i.type].good);
      for (const b of bad) {
        const lanes = new Set(bad.filter((o) => Math.abs(o.at - b.at) < 3).map((o) => o.lane));
        expect(lanes.size).toBeLessThan(3);
      }
    }
  });
  it('places enough treats for every question slot, plus some obstacles', () => {
    for (const s of seeds) {
      const items = run(s);
      expect(items.filter((i) => CONFIG.items[i.type].good).length).toBeGreaterThanOrEqual(14);
      expect(items.filter((i) => !CONFIG.items[i.type].good).length).toBeGreaterThanOrEqual(2);
    }
  });
  it('averages near the spec density (about 24 treats and 10 obstacles)', () => {
    const all = seeds.map(run);
    const avg = (f: (n: ReturnType<typeof run>) => number) => all.reduce((a, items) => a + f(items), 0) / all.length;
    const good = avg((items) => items.filter((i) => CONFIG.items[i.type].good).length);
    const bad = avg((items) => items.filter((i) => !CONFIG.items[i.type].good).length);
    expect(good).toBeGreaterThan(20);
    expect(good).toBeLessThan(40);
    expect(bad).toBeGreaterThan(6);
    expect(bad).toBeLessThan(16);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/core/route.test.ts tests/core/spawner.test.ts`
Expected: FAIL. The modules can't be resolved.

- [ ] **Step 3: Write `src/core/route.ts`**

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

/** The authored route, Stephansplatz to the Riesenrad. Reorder or add stops here. */
export const LANDMARKS: readonly Landmark[] = [
  { id: 'stephansdom', at: 65, side: 1, plaza: [-24, 16] },
  { id: 'tram', at: 175, side: -1, plaza: null },
  { id: 'karlskirche', at: 270, side: -1, plaza: [-24, 16] },
  { id: 'hofburg', at: 410, side: 1, plaza: [-26, 16] },
  // Must equal CONFIG.runLength: the finish line sits beside the Riesenrad.
  { id: 'riesenrad', at: 600, side: 1, plaza: [-40, 40] },
];

export function inPlaza(p: number, side: -1 | 1, margin = 0): boolean {
  for (const lm of LANDMARKS) {
    if (!lm.plaza || lm.side !== side) continue;
    const d = p - lm.at;
    if (d > lm.plaza[0] - margin && d < lm.plaza[1] + margin) return true;
  }
  return false;
}
```

- [ ] **Step 4: Write `src/core/spawner.ts`**

```ts
import type { GameConfig } from '../config';
import { pick, randRange, shuffle, type Rng } from './rng';
import { BAD_TYPES, type Item, type ItemType, type Lane } from './types';

const LANES: readonly Lane[] = [-1, 0, 1];
// Cheap treats appear more often than the Sachertorte.
const GOOD_WEIGHTED: readonly ItemType[] = ['sacher', 'kipferl', 'kipferl', 'melange', 'melange', 'melange', 'mozart', 'mozart', 'mozart'];

/**
 * Lays out every item for one run, front to back. Same seed, same layout.
 * Pattern gaps target the spec's density: roughly 25–35 treats and about 10 obstacles per run.
 */
export function generateItems(rng: Rng, cfg: GameConfig): Item[] {
  const items: Item[] = [];
  let id = 0;
  const lastAt = cfg.runLength - cfg.spawn.finishClear;
  const add = (at: number, lane: Lane, type: ItemType) => {
    if (at < lastAt) items.push({ id: ++id, at, lane, type, state: 'live', t: 0, question: false });
  };
  let at = cfg.spawn.firstAt;
  while (at < lastAt) {
    const r = rng();
    if (r < 0.2) {
      // A line of three of the same treat.
      const lane = pick(rng, LANES);
      const type = pick(rng, GOOD_WEIGHTED);
      for (let i = 0; i < 3; i++) add(at + i * 4, lane, type);
      at += randRange(rng, 30, 36);
    } else if (r < 0.6) {
      // Obstacles with at least one open lane.
      const [a, b] = shuffle(rng, [...LANES]);
      add(at, a, pick(rng, BAD_TYPES));
      if (rng() < 0.4) add(at, b, pick(rng, BAD_TYPES));
      else add(at + 2, b, pick(rng, GOOD_WEIGHTED));
      at += randRange(rng, 22, 28);
    } else if (r < 0.75) {
      // A zigzag of treats.
      let lane = pick(rng, LANES);
      for (let i = 0; i < 3; i++) {
        add(at + i * 5.5, lane, pick(rng, GOOD_WEIGHTED));
        lane = Math.max(-1, Math.min(1, lane + (rng() < 0.5 ? -1 : 1))) as Lane;
      }
      at += randRange(rng, 32, 38);
    } else {
      add(at, pick(rng, LANES), pick(rng, GOOD_WEIGHTED));
      at += randRange(rng, 16, 20);
    }
  }
  return items;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/core/route.test.ts tests/core/spawner.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/route.ts src/core/spawner.ts tests/core/route.test.ts tests/core/spawner.test.ts
git commit -m "feat(core): add authored route and fair item spawner"
```

---

### Task 5: Bonus questions: scheduler, picker and question bank

**Files:**
- Create: `src/core/questions.ts`, `src/data/questions.json`
- Test: `tests/core/questions.test.ts`

**Interfaces:**
- Consumes: `GameConfig` (Task 3); `Rng`, `shuffle`, `createRng` (Task 3); `Question` (Task 3)
- Produces:
  - `scheduleSlots(rng: Rng, q: GameConfig['questions']): number[]` (sorted run-time seconds)
  - `pickQuestions(rng: Rng, bank: readonly Question[], count: number, recent: readonly string[]): Question[]`
  - `shuffleOptions(rng: Rng, q: Question): Question`
  - `updateRecent(history: readonly string[][], used: readonly string[], keep: number): string[][]`
  - `validateBank(raw: unknown): Question[]` (throws with a readable message)

- [ ] **Step 1: Write the failing tests**

`tests/core/questions.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { pickQuestions, scheduleSlots, shuffleOptions, updateRecent, validateBank } from '../../src/core/questions';
import { createRng } from '../../src/core/rng';
import type { Question } from '../../src/core/types';
import bankJson from '../../src/data/questions.json';

const bank = validateBank(bankJson);

describe('scheduleSlots', () => {
  it.each([3, 4])('places exactly %i slots inside the window with the minimum gap', (perRun) => {
    const q = { ...CONFIG.questions, perRun };
    for (let s = 1; s <= 500; s++) {
      const slots = scheduleSlots(createRng(s), q);
      expect(slots).toHaveLength(perRun);
      expect(slots[0]).toBeGreaterThanOrEqual(q.windowStart);
      expect(slots[slots.length - 1]).toBeLessThanOrEqual(q.windowEnd);
      for (let i = 1; i < slots.length; i++) expect(slots[i] - slots[i - 1]).toBeGreaterThanOrEqual(q.minGap - 1e-9);
    }
  });
  it('refuses a window too small for the slots', () => {
    expect(() => scheduleSlots(createRng(1), { ...CONFIG.questions, perRun: 6, windowStart: 4, windowEnd: 20 })).toThrow(/window/);
  });
});

describe('pickQuestions', () => {
  it('picks distinct questions', () => {
    const picked = pickQuestions(createRng(4), bank, 3, []);
    expect(new Set(picked.map((q) => q.id)).size).toBe(3);
  });
  it('skips recently used questions when enough remain', () => {
    const recent = bank.slice(0, bank.length - 3).map((q) => q.id);
    const picked = pickQuestions(createRng(4), bank, 3, recent);
    for (const q of picked) expect(recent).not.toContain(q.id);
  });
  it('falls back to the whole bank when too few fresh questions remain', () => {
    const recent = bank.map((q) => q.id);
    expect(pickQuestions(createRng(4), bank, 3, recent)).toHaveLength(3);
  });
  it('shuffles the options but keeps the right answer right', () => {
    const original = bank[0];
    for (let s = 1; s < 30; s++) {
      const q = shuffleOptions(createRng(s), original);
      expect(q.options[q.answer]).toBe(original.options[original.answer]);
      expect([...q.options].sort()).toEqual([...original.options].sort());
    }
  });
});

describe('updateRecent', () => {
  it('keeps only the last N runs', () => {
    expect(updateRecent([['a'], ['b'], ['c']], ['d'], 3)).toEqual([['b'], ['c'], ['d']]);
  });
});

describe('question bank', () => {
  it('has at least 30 valid questions with unique ids', () => {
    expect(bank.length).toBeGreaterThanOrEqual(30);
    expect(new Set(bank.map((q) => q.id)).size).toBe(bank.length);
  });
  it('rejects malformed entries with a readable message', () => {
    const bad: unknown = [{ id: 'x', q: 'Q?', options: ['a', 'a', 'b'], answer: 0 }];
    expect(() => validateBank(bad)).toThrow(/options must differ/);
    const short: Partial<Question>[] = [{ id: 'y', q: 'Q?', options: ['a', 'b'] as unknown as Question['options'], answer: 0 }];
    expect(() => validateBank(short)).toThrow(/exactly 3 options/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/core/questions.test.ts`
Expected: FAIL. The modules can't be resolved.

- [ ] **Step 3: Write `src/data/questions.json`**

Authoring rule: **the correct answer goes first** (`answer: 0`); the game shuffles the options every time.

```json
[
  { "id": "capital", "q": "Vienna is the capital of which country?", "options": ["Austria", "Switzerland", "Germany"], "answer": 0 },
  { "id": "danube", "q": "Which river flows through Vienna?", "options": ["The Danube", "The Rhine", "The Seine"], "answer": 0 },
  { "id": "riesenrad", "q": "What is the Riesenrad in the Prater?", "options": ["A giant Ferris wheel", "A royal palace", "A chocolate cake"], "answer": 0 },
  { "id": "sachertorte", "q": "What is a Sachertorte?", "options": ["A chocolate cake", "A type of sausage", "A horse-drawn carriage"], "answer": 0 },
  { "id": "mozart", "q": "Which famous composer lived and worked in Vienna?", "options": ["Wolfgang Amadeus Mozart", "Elvis Presley", "Freddie Mercury"], "answer": 0 },
  { "id": "stephansdom", "q": "What is the Stephansdom?", "options": ["Vienna's great cathedral", "A football stadium", "A ski resort"], "answer": 0 },
  { "id": "schnitzel", "q": "A classic Wiener Schnitzel is a thin, breaded, fried cutlet of…", "options": ["Veal", "Salmon", "Tofu"], "answer": 0 },
  { "id": "schoenbrunn", "q": "Schönbrunn Palace was the summer home of which royal family?", "options": ["The Habsburgs", "The Tudors", "The Medici"], "answer": 0 },
  { "id": "waltz", "q": "Which dance is Vienna most famous for?", "options": ["The waltz", "The tango", "The salsa"], "answer": 0 },
  { "id": "currency", "q": "Which currency do you pay with in Vienna?", "options": ["Euro", "Swiss franc", "Pound sterling"], "answer": 0 },
  { "id": "melange", "q": "In a Viennese coffee house, a \"Melange\" is…", "options": ["Coffee with milk foam", "A slice of cake", "A newspaper"], "answer": 0 },
  { "id": "fiaker", "q": "What is a Fiaker?", "options": ["A horse-drawn carriage", "A pastry", "A tram ticket"], "answer": 0 },
  { "id": "lipizzaner", "q": "The Spanish Riding School in Vienna is famous for its white…", "options": ["Lipizzaner horses", "Swans", "Tigers"], "answer": 0 },
  { "id": "kipferl", "q": "Which famous pastry is said to descend from the Viennese Kipferl?", "options": ["The croissant", "The doughnut", "The muffin"], "answer": 0 },
  { "id": "blue-danube", "q": "Who composed \"The Blue Danube\" waltz?", "options": ["Johann Strauss II", "Ludwig van Beethoven", "Taylor Swift"], "answer": 0 },
  { "id": "ringstrasse", "q": "What is the Ringstraße?", "options": ["A grand boulevard around the old town", "A boxing arena", "A shopping app"], "answer": 0 },
  { "id": "klimt", "q": "Which Viennese painter created \"The Kiss\"?", "options": ["Gustav Klimt", "Pablo Picasso", "Vincent van Gogh"], "answer": 0 },
  { "id": "freud", "q": "Which doctor, the father of psychoanalysis, lived in Vienna?", "options": ["Sigmund Freud", "Albert Einstein", "Isaac Newton"], "answer": 0 },
  { "id": "language", "q": "What is the main language spoken in Vienna?", "options": ["German", "French", "Italian"], "answer": 0 },
  { "id": "sisi", "q": "Empress Elisabeth of Austria is better known by which nickname?", "options": ["Sisi", "Lady Di", "Queenie"], "answer": 0 },
  { "id": "strudel", "q": "What is the main fruit in a classic Apfelstrudel?", "options": ["Apple", "Banana", "Pineapple"], "answer": 0 },
  { "id": "heuriger", "q": "A Heuriger is a Viennese tavern that serves this year's new…", "options": ["Wine", "Sushi", "Ice cream"], "answer": 0 },
  { "id": "prater", "q": "What is the Prater?", "options": ["A big park with an amusement park", "An opera singer", "A type of pastry"], "answer": 0 },
  { "id": "opera", "q": "Which world-famous opera house is in Vienna?", "options": ["The Vienna State Opera", "The Sydney Opera House", "La Scala"], "answer": 0 },
  { "id": "new-year", "q": "The Vienna Philharmonic's most famous concert is held every year on…", "options": ["New Year's Day", "Halloween", "Valentine's Day"], "answer": 0 },
  { "id": "mozartkugel", "q": "What is a Mozartkugel?", "options": ["A chocolate and marzipan sweet", "A musical instrument", "A bowling ball"], "answer": 0 },
  { "id": "tram", "q": "What colours are most of Vienna's trams?", "options": ["Red and white", "Green and yellow", "All black"], "answer": 0 },
  { "id": "hofburg", "q": "Who lived in the Hofburg palace for centuries?", "options": ["The Habsburg rulers", "Roman gladiators", "Pirates"], "answer": 0 },
  { "id": "beethoven", "q": "Which composer wrote most of his famous symphonies while living in Vienna?", "options": ["Ludwig van Beethoven", "Frédéric Chopin", "Antonio Vivaldi"], "answer": 0 },
  { "id": "snow-globe", "q": "Which popular souvenir was invented in Vienna?", "options": ["The snow globe", "The teddy bear", "The yo-yo"], "answer": 0 },
  { "id": "water", "q": "In a Viennese café, coffee traditionally comes with a small glass of…", "options": ["Water", "Orange juice", "Milk"], "answer": 0 },
  { "id": "districts", "q": "Vienna is divided into how many districts?", "options": ["23", "5", "100"], "answer": 0 }
]
```

- [ ] **Step 4: Write `src/core/questions.ts`**

```ts
import type { GameConfig } from '../config';
import { shuffle, type Rng } from './rng';
import type { Question } from './types';

/**
 * Secret run-time moments (seconds) after which the next treat collected asks a question.
 * Samples in a shrunken window, then re-inserts the gaps, so every slot set is valid.
 */
export function scheduleSlots(rng: Rng, q: GameConfig['questions']): number[] {
  const free = q.windowEnd - q.windowStart - (q.perRun - 1) * q.minGap;
  if (free < 0) throw new Error('question window too small for perRun slots with minGap');
  const base = Array.from({ length: q.perRun }, () => rng() * free).sort((a, b) => a - b);
  return base.map((b, i) => q.windowStart + b + i * q.minGap);
}

export function shuffleOptions(rng: Rng, q: Question): Question {
  const order = shuffle(rng, [0, 1, 2]);
  const options = order.map((i) => q.options[i]) as [string, string, string];
  return { ...q, options, answer: order.indexOf(q.answer) as 0 | 1 | 2 };
}

/** Picks `count` distinct questions, avoiding recent ones while enough fresh ones remain. */
export function pickQuestions(rng: Rng, bank: readonly Question[], count: number, recent: readonly string[]): Question[] {
  const recentSet = new Set(recent);
  const fresh = bank.filter((q) => !recentSet.has(q.id));
  const pool = fresh.length >= count ? fresh : [...bank];
  return shuffle(rng, [...pool]).slice(0, count).map((q) => shuffleOptions(rng, q));
}

export function updateRecent(history: readonly string[][], used: readonly string[], keep: number): string[][] {
  return [...history, [...used]].slice(-keep);
}

export function validateBank(raw: unknown): Question[] {
  if (!Array.isArray(raw)) throw new Error('question bank must be an array');
  const seen = new Set<string>();
  return raw.map((entry, i) => {
    const o = entry as Partial<Question>;
    if (typeof o.id !== 'string' || !o.id || seen.has(o.id)) throw new Error(`question ${i}: missing or duplicate id`);
    if (typeof o.q !== 'string' || !o.q.trim()) throw new Error(`question ${o.id}: empty text`);
    if (!Array.isArray(o.options) || o.options.length !== 3 || o.options.some((s) => typeof s !== 'string' || !s.trim())) {
      throw new Error(`question ${o.id}: needs exactly 3 options`);
    }
    if (new Set(o.options).size !== 3) throw new Error(`question ${o.id}: options must differ`);
    if (o.answer !== 0 && o.answer !== 1 && o.answer !== 2) throw new Error(`question ${o.id}: answer must be 0, 1 or 2`);
    seen.add(o.id);
    return { id: o.id, q: o.q, options: [o.options[0], o.options[1], o.options[2]], answer: o.answer };
  });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/core/questions.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/questions.ts src/data/questions.json tests/core/questions.test.ts
git commit -m "feat(core): add question scheduler, picker and 32-question bank"
```

---

### Task 6: The run simulation

**Files:**
- Create: `src/core/run.ts`
- Test: `tests/core/run.test.ts`

**Interfaces:**
- Consumes: `CONFIG`, `GameConfig` (Task 3); `createRng`, `Rng` (Task 3); `generateItems` (Task 4); `scheduleSlots` (Task 5); `applyPoints`, `questionPoints` (Task 3); `isGood`, `GoodType`, `Item`, `Lane`, `RunEvent` (Task 3)
- Produces: `interface RunOptions { seed: number; config?: GameConfig; items?: Item[]; slots?: number[] }` and `class Run` with:
  - readonly `cfg`, `items`, `slots`
  - state: `dist`, `time`, `speed`, `lane`, `x`, `score`, `stumble`, `tray: GoodType[]`, `finished`, `pending: Item | null`
  - getters `progress` (0..1) and `paused`
  - methods `move(dir: -1 | 1)`, `update(dt): RunEvent[]`, `answer(correct): RunEvent[]`

- [ ] **Step 1: Write the failing tests**

`tests/core/run.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { Run } from '../../src/core/run';
import type { Item, ItemType, Lane, RunEvent } from '../../src/core/types';

const mk = (at: number, lane: Lane, type: ItemType): Item => ({ id: at * 10 + lane + 2, at, lane, type, state: 'live', t: 0, question: false });
const advance = (run: Run, seconds: number): RunEvent[] => {
  const ev: RunEvent[] = [];
  for (let i = 0; i < Math.round(seconds * 60); i++) ev.push(...run.update(1 / 60));
  return ev;
};
const kinds = (ev: RunEvent[]) => ev.map((e) => e.kind);

describe('Run', () => {
  it('moves forward at roughly the base speed', () => {
    const run = new Run({ seed: 1, items: [], slots: [] });
    advance(run, 1);
    expect(run.dist).toBeGreaterThan(14);
    expect(run.dist).toBeLessThan(14.4);
  });

  it('clamps lane changes to the three lanes', () => {
    const run = new Run({ seed: 1, items: [], slots: [] });
    run.move(1); run.move(1);
    expect(run.lane).toBe(1);
    run.move(-1); run.move(-1); run.move(-1);
    expect(run.lane).toBe(-1);
  });

  it('slides smoothly to the new lane', () => {
    const run = new Run({ seed: 1, items: [], slots: [] });
    run.move(1);
    advance(run, 0.3);
    expect(run.x).toBeGreaterThan(0.9);
  });

  it('collects a treat in its lane and puts it on the tray', () => {
    const run = new Run({ seed: 1, items: [mk(5, 0, 'sacher')], slots: [] });
    const ev = advance(run, 1);
    expect(run.score).toBe(15);
    expect(ev).toContainEqual(expect.objectContaining({ kind: 'collect', points: 15 }));
    expect(run.tray).toEqual(['sacher']);
    expect(run.items[0].state).toBe('taken');
  });

  it('ignores items in other lanes', () => {
    const run = new Run({ seed: 1, items: [mk(5, 1, 'sacher')], slots: [] });
    advance(run, 1);
    expect(run.score).toBe(0);
    expect(run.items[0].state).toBe('live');
  });

  it('costs points on an obstacle, never below zero, and knocks a treat off the tray', () => {
    const run = new Run({ seed: 1, items: [mk(5, 0, 'sacher'), mk(15, 0, 'bomb')], slots: [] });
    advance(run, 1.1);
    expect(run.score).toBe(0);
    expect(run.tray).toEqual([]);
    expect(run.stumble).toBeGreaterThan(0);
    const run2 = new Run({ seed: 1, items: [mk(5, 0, 'krampus')], slots: [] });
    advance(run2, 1);
    expect(run2.score).toBe(0);
  });

  it('turns the first treat after a slot into a question and pauses', () => {
    const run = new Run({ seed: 1, items: [mk(10, 0, 'kipferl')], slots: [0.1] });
    const ev = advance(run, 1);
    expect(kinds(ev)).toContain('question');
    expect(run.paused).toBe(true);
    expect(run.score).toBe(0);
    const d = run.dist;
    advance(run, 1);
    expect(run.dist).toBe(d);
    expect(run.answer(true)).toEqual([expect.objectContaining({ kind: 'answer', correct: true, points: 20 })]);
    expect(run.score).toBe(20);
    expect(run.paused).toBe(false);
  });

  it('gives nothing for a wrong answer', () => {
    const run = new Run({ seed: 1, items: [mk(10, 0, 'kipferl')], slots: [0.1] });
    advance(run, 1);
    run.answer(false);
    expect(run.score).toBe(0);
    expect(run.answer(true)).toEqual([]);
  });

  it('finishes exactly once and then coasts to a stop', () => {
    const run = new Run({ seed: 1, config: { ...CONFIG, runLength: 30 }, items: [], slots: [] });
    const ev = advance(run, 5);
    expect(kinds(ev).filter((k) => k === 'finish')).toHaveLength(1);
    expect(run.finished).toBe(true);
    expect(run.speed).toBeLessThan(CONFIG.baseSpeed);
    const d = run.dist;
    expect(advance(run, 1)).toEqual([]);
    expect(run.dist).toBeGreaterThanOrEqual(d);
  });

  it('builds the same run from the same seed', () => {
    const a = new Run({ seed: 5 }), b = new Run({ seed: 5 });
    expect(a.items.map((i) => [i.at, i.lane, i.type])).toEqual(b.items.map((i) => [i.at, i.lane, i.type]));
    expect(a.slots).toEqual(b.slots);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/core/run.test.ts`
Expected: FAIL. `src/core/run` can't be resolved.

- [ ] **Step 3: Write `src/core/run.ts`**

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/core/run.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/run.ts tests/core/run.test.ts
git commit -m "feat(core): add deterministic run simulation with bonus-question pause"
```

---

### Task 7: Autopilot bot and score simulator

**Files:**
- Create: `src/core/bot.ts`, `src/core/simulate.ts`, `scripts/simulate.ts`
- Modify: `package.json` (add the `simulate` script)
- Test: `tests/core/bot.test.ts`

**Interfaces:**
- Consumes: `Run` (Task 6); `Rng`, `createRng`, `randRange` (Task 3); `Lane` (Task 3); `CONFIG`, `GameConfig`, `Tier` (Task 3); `tierIndex` (Task 3)
- Produces:
  - `interface BotSkill { name; lookahead; reaction: [number, number]; mistakeRate; answerAccuracy }`
  - `BOT_SKILLS: Record<'casual' | 'average' | 'skilled', BotSkill>`
  - `class Bot { constructor(rng: Rng, skill: BotSkill); step(run: Run, dt: number): void; answer(): boolean }`
  - `interface RunResult { score; hits; collected; questions }`, `simulateRun(seed, skill, cfg?): RunResult`
  - `interface Summary { runs; mean; p10; p50; p90; tierShare: number[] }`, `summarize(results, tiers): Summary`
  - npm script `simulate` (writes `docs/simulation-report.md`)

- [ ] **Step 1: Write the failing tests**

`tests/core/bot.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { BOT_SKILLS } from '../../src/core/bot';
import { simulateRun, summarize } from '../../src/core/simulate';

const seeds = Array.from({ length: 60 }, (_, i) => i + 1);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('Bot', () => {
  it('scores higher when more skilled', () => {
    const skilled = mean(seeds.map((s) => simulateRun(s, BOT_SKILLS.skilled).score));
    const casual = mean(seeds.map((s) => simulateRun(s, BOT_SKILLS.casual).score));
    expect(skilled).toBeGreaterThan(casual);
  });
  it('hits fewer obstacles when more skilled', () => {
    const skilled = mean(seeds.map((s) => simulateRun(s, BOT_SKILLS.skilled).hits));
    const casual = mean(seeds.map((s) => simulateRun(s, BOT_SKILLS.casual).hits));
    expect(skilled).toBeLessThan(casual);
  });
  it('gives an average player the full set of questions in almost every run', () => {
    const full = Array.from({ length: 100 }, (_, i) => simulateRun(i + 1, BOT_SKILLS.average).questions)
      .filter((n) => n === CONFIG.questions.perRun).length;
    expect(full).toBeGreaterThanOrEqual(85);
  });
});

describe('summarize', () => {
  it('reports percentiles and the share of players per tier', () => {
    const results = [0, 50, 90, 110, 130].map((score) => ({ score, hits: 0, collected: 0, questions: 0 }));
    const s = summarize(results, CONFIG.tiers);
    expect(s.runs).toBe(5);
    expect(s.mean).toBe(76);
    expect(s.tierShare).toEqual([0.4, 0.2, 0.2, 0.2]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/core/bot.test.ts`
Expected: FAIL. The modules can't be resolved.

- [ ] **Step 3: Write `src/core/bot.ts`**

```ts
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
  casual: { name: 'casual', lookahead: 18, reaction: [0.35, 0.6], mistakeRate: 0.25, answerAccuracy: 0.55 },
  average: { name: 'average', lookahead: 24, reaction: [0.22, 0.4], mistakeRate: 0.12, answerAccuracy: 0.7 },
  skilled: { name: 'skilled', lookahead: 30, reaction: [0.14, 0.24], mistakeRate: 0.04, answerAccuracy: 0.85 },
};

/** Plays a run like a person would: drifts toward treats, away from obstacles. */
export class Bot {
  private cool = 0;

  constructor(private readonly rng: Rng, readonly skill: BotSkill) {}

  step(run: Run, dt: number): void {
    this.cool -= dt;
    if (this.cool > 0 || run.paused || run.finished) return;
    const scores = [0, 0, 0];
    for (const it of run.items) {
      if (it.state !== 'live') continue;
      const r = it.at - run.dist;
      if (r < 1) continue;
      if (r > this.skill.lookahead) break;
      const p = run.cfg.items[it.type].points;
      scores[it.lane + 1] += p > 0 ? (p / 5) * (1 - r / 40) : -12 * (1 - r / 36);
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
    if (best !== run.lane && this.rng() > this.skill.mistakeRate) {
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
```

- [ ] **Step 4: Write `src/core/simulate.ts`**

```ts
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/core/bot.test.ts`
Expected: PASS.

- [ ] **Step 6: Write `scripts/simulate.ts` and the npm script**

`scripts/simulate.ts`:
```ts
import { writeFileSync } from 'node:fs';
import { CONFIG } from '../src/config';
import { BOT_SKILLS } from '../src/core/bot';
import { simulateRun, summarize } from '../src/core/simulate';

const RUNS = Number(process.argv[2] ?? 2000);
const lines: string[] = [
  `# Score simulation (${RUNS} runs per player profile)`,
  '',
  `Tiers: ${CONFIG.tiers.map((t) => `${t.name} from ${t.min}`).join(', ')}`,
  '',
  `| Profile | Mean | P10 | Median | P90 | ${CONFIG.tiers.map((t) => t.name).join(' | ')} |`,
  `|---|---|---|---|---|${CONFIG.tiers.map(() => '---|').join('')}`,
];
for (const skill of Object.values(BOT_SKILLS)) {
  const s = summarize(Array.from({ length: RUNS }, (_, i) => simulateRun(i + 1, skill)), CONFIG.tiers);
  lines.push(`| ${skill.name} | ${s.mean.toFixed(0)} | ${s.p10} | ${s.p50} | ${s.p90} | ${s.tierShare.map((x) => `${(x * 100).toFixed(0)}%`).join(' | ')} |`);
}
lines.push(
  '',
  'Tier columns show the share of players whose final score lands in that tier.',
  'To rebalance gifts, change `tiers` in `src/config.ts` and run `npm run simulate` again.',
);
const report = `${lines.join('\n')}\n`;
writeFileSync('docs/simulation-report.md', report);
console.log(report);
```

In `package.json` `scripts`, add:
```json
"simulate": "tsx scripts/simulate.ts"
```

- [ ] **Step 7: Run the simulator**

Run: `npm run simulate -- 500`
Expected: a markdown table with rows `casual`, `average`, `skilled` is printed and written to `docs/simulation-report.md`; skilled has the highest mean. (The placeholder thresholds will probably put most players in the top tier. That's expected until the real gift stock is known.)

- [ ] **Step 8: Commit**

```bash
git add src/core/bot.ts src/core/simulate.ts scripts/simulate.ts package.json tests/core/bot.test.ts docs/simulation-report.md
git commit -m "feat(core): add autopilot bot and score simulator report"
```

---

### Task 8: Art pipeline: placeholder port and manifest

**Files:**
- Create: `src/render/placeholders/paint.ts` (ported), `src/render/canvas.ts`, `src/assets/resolve.ts`, `src/assets/manifest.ts`
- Test: `tests/assets/resolve.test.ts`

**Interfaces:**
- Consumes: `docs/prototypes/style-test.html` lines 227, 233–242 and 456–829 (except 794–795)
- Produces:
  - `paint.ts` exports: `TAU, hash, cnv, mixHex, EMOJI_FONT, silhouette, paperEdge, emojiCanvas, paintWaiterA, paintFacadeA, paintBackA, paintStephansdomA, paintKarlskircheA, paintHofburgA, paintWheelA, paintWheelSupportA, paintCabinA, paintTramA, paintLampA, paintBannerA, paintCheckerA, paintCloudA, paintSkylineA, paintRoadA, paintWalkA, blobCanvas, shadowStrip, grainDataUrl`
  - `canvas.ts`: `toTexture(c: HTMLCanvasElement, repeat?: [number, number]): THREE.CanvasTexture`, `gradientTexture(stops: readonly string[]): THREE.CanvasTexture`
  - `resolve.ts`: `baseName(path)`, `groupIds(prefix, designer, placeholders): { ids: string[]; fromDesigner: boolean }`, `edgeRadius(ratio, w, h)`
  - `manifest.ts`: `interface ArtSet { get(id): HTMLCanvasElement; has(id): boolean; group(prefix): HTMLCanvasElement[]; source(id): 'designer' | 'placeholder' | 'missing'; url(id): string | null; list(): Array<{ id: string; source: 'designer' | 'placeholder' }> }`, `loadArt(): Promise<ArtSet>`

- [ ] **Step 1: Write the failing test for the resolution rules**

`tests/assets/resolve.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { baseName, edgeRadius, groupIds } from '../../src/assets/resolve';

describe('art resolution', () => {
  it('turns a glob path into an asset id', () => {
    expect(baseName('./art/facade-01.png')).toBe('facade-01');
    expect(baseName('/src/assets/art/logo.svg')).toBe('logo');
    expect(baseName('./art/item-sacher.WEBP')).toBe('item-sacher');
  });
  it('prefers designer files for a whole group', () => {
    expect(groupIds('facade-', ['facade-02', 'facade-01', 'item-bomb'], ['facade-01', 'facade-03']))
      .toEqual({ ids: ['facade-01', 'facade-02'], fromDesigner: true });
  });
  it('falls back to placeholders when the designer has none in a group', () => {
    expect(groupIds('waiter-run-', ['facade-01'], ['waiter-run-01', 'waiter-run-02']))
      .toEqual({ ids: ['waiter-run-01', 'waiter-run-02'], fromDesigner: false });
  });
  it('accepts a single-frame group and an empty optional group', () => {
    expect(groupIds('waiter-run-', ['waiter-run-01'], ['waiter-run-01', 'waiter-run-02']).ids).toEqual(['waiter-run-01']);
    expect(groupIds('waiter-stumble-', [], ['waiter-run-01']).ids).toEqual([]);
  });
  it('scales the paper edge with image size but keeps it visible', () => {
    expect(edgeRadius(0.045, 512, 512)).toBe(23);
    expect(edgeRadius(0.001, 100, 50)).toBe(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/assets/resolve.test.ts`
Expected: FAIL. The module can't be resolved.

- [ ] **Step 3: Write `src/assets/resolve.ts`**

```ts
/** './art/facade-01.png' → 'facade-01' */
export function baseName(path: string): string {
  const file = path.split('/').pop() ?? path;
  return file.replace(/\.(png|webp|svg)$/i, '');
}

/** Numbered sets (facade-01…, waiter-run-01…): designer files replace the whole placeholder set. */
export function groupIds(prefix: string, designer: readonly string[], placeholders: readonly string[]): { ids: string[]; fromDesigner: boolean } {
  const fromDesigner = designer.filter((id) => id.startsWith(prefix)).sort();
  if (fromDesigner.length > 0) return { ids: fromDesigner, fromDesigner: true };
  return { ids: placeholders.filter((id) => id.startsWith(prefix)).sort(), fromDesigner: false };
}

/** Paper border width in pixels for an image, as a share of its longest side. */
export function edgeRadius(ratio: number, w: number, h: number): number {
  return Math.max(2, Math.round(ratio * Math.max(w, h)));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/assets/resolve.test.ts`
Expected: PASS.

- [ ] **Step 5: Port the placeholder painters verbatim**

Lines 794–795 of the prototype draw lane dashes into the road texture. They're skipped here because the renderer draws lane lines itself (Task 9), so designer road textures stay plain.

Run:
```bash
mkdir -p src/render/placeholders
{
  printf '%s\n' '// @ts-nocheck' \
    '// Placeholder art, ported verbatim from docs/prototypes/style-test.html (option A painters).' \
    '// Designer PNGs in src/assets/art replace these one by one (see docs/ASSET_SPEC.md).'
  sed -n '227p;233,242p;456,793p;796,829p' docs/prototypes/style-test.html
  printf '%s\n' '' 'export {' \
    '  TAU, hash, cnv, mixHex, EMOJI_FONT, silhouette, paperEdge, emojiCanvas,' \
    '  paintWaiterA, paintFacadeA, paintBackA, paintStephansdomA, paintKarlskircheA, paintHofburgA,' \
    '  paintWheelA, paintWheelSupportA, paintCabinA, paintTramA, paintLampA, paintBannerA, paintCheckerA,' \
    '  paintCloudA, paintSkylineA, paintRoadA, paintWalkA, blobCanvas, shadowStrip, grainDataUrl,' \
    '};'
} > src/render/placeholders/paint.ts
grep -c "fbf6ea'; *$" src/render/placeholders/paint.ts; head -6 src/render/placeholders/paint.ts; tail -3 src/render/placeholders/paint.ts
```
Expected: the `grep -c` prints `0` (the dash lines are gone); the head shows `// @ts-nocheck` then `const TAU = Math.PI * 2;`; the tail shows the export list.

- [ ] **Step 6: Write `src/render/canvas.ts`**

```ts
import * as THREE from 'three';

export function toTexture(c: HTMLCanvasElement, repeat?: [number, number]): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

/** Vertical gradient, top to bottom, for the sky. */
export function gradientTexture(stops: readonly string[]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, 256);
  stops.forEach((s, i) => gr.addColorStop(i / (stops.length - 1), s));
  g.fillStyle = gr;
  g.fillRect(0, 0, 4, 256);
  return toTexture(c);
}
```

- [ ] **Step 7: Write `src/assets/manifest.ts`**

```ts
import * as P from '../render/placeholders/paint';
import { baseName, edgeRadius, groupIds } from './resolve';

type Painter = () => HTMLCanvasElement;
type Source = 'designer' | 'placeholder';

export interface ArtSet {
  /** Canvas for an asset id; designer file if present, otherwise the placeholder. Throws if neither exists. */
  get(id: string): HTMLCanvasElement;
  has(id: string): boolean;
  /** Numbered sets such as facade-01…, waiter-run-01…; an empty array for an optional set nobody drew. */
  group(prefix: string): HTMLCanvasElement[];
  source(id: string): Source | 'missing';
  /** Raw designer file URL (for HTML images such as gift cards and the logo), or null. */
  url(id: string): string | null;
  list(): Array<{ id: string; source: Source }>;
}

/** Paper edge added to designer cutouts: share of the longest side (0 = none) and whether to cast the soft shadow. */
interface Finish { edge: number; shadow: boolean }
const FINISHES: Array<[string, Finish]> = [
  ['item-', { edge: 0.045, shadow: true }],
  ['waiter-', { edge: 0.016, shadow: true }],
  ['riesenrad-cabin', { edge: 0.03, shadow: false }],
  ['prop-', { edge: 0.01, shadow: false }],
  ['facade-', { edge: 0.0065, shadow: false }],
  ['back-', { edge: 0, shadow: false }],
  ['cloud-', { edge: 0.0125, shadow: false }],
  ['texture-', { edge: 0, shadow: false }],
  ['skyline', { edge: 0, shadow: false }],
  ['sky', { edge: 0, shadow: false }],
  ['gift-', { edge: 0, shadow: false }],
  ['logo', { edge: 0, shadow: false }],
];
const DEFAULT_FINISH: Finish = { edge: 0.008, shadow: true };
const finishFor = (id: string): Finish => FINISHES.find(([prefix]) => id.startsWith(prefix))?.[1] ?? DEFAULT_FINISH;
/** HTML-only files: never drawn into the 3D scene. */
const isUiOnly = (id: string) => id.startsWith('gift-') || id === 'logo';

const EMOJI: Record<string, string> = { sacher: '🍰', kipferl: '🥐', melange: '☕', mozart: '🍬', krampus: '👹', bomb: '💣' };
const numbered = (prefix: string, count: number, paint: (i: number) => HTMLCanvasElement): Array<[string, Painter]> =>
  Array.from({ length: count }, (_, i) => [`${prefix}${String(i + 1).padStart(2, '0')}`, () => paint(i)]);

const PLACEHOLDERS: Record<string, Painter> = Object.fromEntries<Painter>([
  ...numbered('facade-', 6, (i) => P.paintFacadeA(i)),
  ...numbered('back-', 5, (i) => P.paintBackA(i)),
  ['landmark-stephansdom', () => P.paintStephansdomA()],
  ['landmark-karlskirche', () => P.paintKarlskircheA()],
  ['landmark-hofburg', () => P.paintHofburgA()],
  ['landmark-tram', () => P.paintTramA()],
  ['riesenrad-wheel', () => P.paintWheelA()],
  ['riesenrad-cabin', () => P.paintCabinA()],
  ['riesenrad-support', () => P.paintWheelSupportA()],
  ...Object.entries(EMOJI).map(([k, e]): [string, Painter] => [`item-${k}`, () => P.paperEdge(P.emojiCanvas(e, 128, 0.6), 6)]),
  ...numbered('waiter-run-', 2, (i) => P.paintWaiterA(i)),
  ['prop-lamp', () => P.paintLampA()],
  ['banner-finish', () => P.paintBannerA()],
  ['cloud-01', () => P.paintCloudA()],
  ['skyline', () => P.paintSkylineA()],
  ['texture-road', () => P.paintRoadA()],
  ['texture-sidewalk', () => P.paintWalkA()],
]);

const DESIGNER_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob('./art/*.{png,webp,svg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>)
    .map(([path, url]) => [baseName(path), url]),
);

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

async function loadDesignerCanvas(id: string, url: string): Promise<HTMLCanvasElement> {
  const img = await loadImage(url);
  const scale = Math.min(1, 2048 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * scale));
  c.height = Math.max(1, Math.round(img.naturalHeight * scale));
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  const f = finishFor(id);
  return f.edge > 0 ? P.paperEdge(c, edgeRadius(f.edge, c.width, c.height), '#fffaf0', f.shadow ? 'rgba(60,35,20,0.32)' : null) : c;
}

/** Loads fonts (placeholder signs use Federo), then every designer file; broken files fall back to placeholders. */
export async function loadArt(): Promise<ArtSet> {
  await Promise.race([
    Promise.all(['40px Federo', '24px "Albert Sans"'].map((f) => document.fonts.load(f))),
    new Promise((resolve) => setTimeout(resolve, 2500)),
  ]).catch(() => undefined);

  const designer = new Map<string, HTMLCanvasElement>();
  await Promise.all(
    Object.entries(DESIGNER_URLS)
      .filter(([id]) => !isUiOnly(id))
      .map(async ([id, url]) => {
        try {
          designer.set(id, await loadDesignerCanvas(id, url));
        } catch (err) {
          console.warn(`[art] ${id}: ${String(err)}. Using the placeholder.`);
        }
      }),
  );

  const painted = new Map<string, HTMLCanvasElement>();
  const get = (id: string): HTMLCanvasElement => {
    const d = designer.get(id);
    if (d) return d;
    let c = painted.get(id);
    if (!c) {
      const paint = PLACEHOLDERS[id];
      if (!paint) throw new Error(`no art for "${id}"`);
      c = paint();
      painted.set(id, c);
    }
    return c;
  };
  const source = (id: string): Source | 'missing' => (designer.has(id) ? 'designer' : id in PLACEHOLDERS ? 'placeholder' : 'missing');
  return {
    get,
    has: (id) => designer.has(id) || id in PLACEHOLDERS,
    group: (prefix) => groupIds(prefix, [...designer.keys()], Object.keys(PLACEHOLDERS)).ids.map(get),
    source,
    url: (id) => DESIGNER_URLS[id] ?? null,
    // A designer file that failed to load is listed as "placeholder", because that's what the booth shows.
    list: () =>
      [...new Set([...Object.keys(PLACEHOLDERS), ...Object.keys(DESIGNER_URLS)])]
        .sort()
        .map((id): { id: string; source: Source } => ({ id, source: designer.has(id) || (isUiOnly(id) && id in DESIGNER_URLS) ? 'designer' : 'placeholder' })),
  };
}
```

- [ ] **Step 8: Type-check and test**

Run: `npx tsc --noEmit && npx vitest run tests/assets/resolve.test.ts`
Expected: no type errors; the tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/render src/assets tests/assets
git commit -m "feat(art): port placeholder painters and add designer-first art manifest"
```

---

### Task 9: World renderer: sky, street and landmarks

**Files:**
- Create: `src/render/rows.ts`, `src/render/sky.ts`, `src/render/street.ts`, `src/render/landmarks.ts`, `src/render/world.ts`
- Modify: `src/main.ts` (temporary visual harness; replaced in Task 16)
- Test: `tests/render/rows.test.ts`

**Interfaces:**
- Consumes: `ArtSet`, `loadArt` (Task 8); `toTexture`, `gradientTexture` (Task 8); paint exports `shadowStrip`, `paintCheckerA` (Task 8); `LANDMARKS`, `inPlaza`, `LandmarkId` (Task 4); `Run` (Task 6); `Bot`, `BOT_SKILLS` (Task 7); `CONFIG` (Task 3)
- Produces:
  - `rows.ts`: `interface RowSpec { count; spacing; offset }`, `initialPositions(spec, behind?)`, `recycle(p, dist, span, behind?)`
  - `createSky(scene, art): { update(dt): void; setDetail(high: boolean): void }`
  - `createStreet(scene, art): { update(dist): void; reset(): void; setDetail(high: boolean): void }`
  - `createLandmarks(scene, art): { update(dist, time): void }`
  - `world.ts` (this task's version): `createWorld(canvas, art, laneWidth): World` with `reset()`, `render(run, frameDt)`, `resize(w, h)`, `shake()`, `playerScreen()`, `renderer`. Task 10 replaces this file with the final version.

- [ ] **Step 1: Write the failing test for row recycling**

`tests/render/rows.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { initialPositions, recycle } from '../../src/render/rows';

describe('pooled rows', () => {
  it('starts the first slot just behind the camera', () => {
    expect(initialPositions({ count: 3, spacing: 8, offset: 4 })).toEqual([-12, -4, 4]);
  });
  it('moves a slot that fell behind the camera to the front of the row', () => {
    expect(recycle(0, 20, 216)).toBe(216);
    expect(recycle(0, 500, 216)).toBe(648);
  });
  it('leaves slots in front of the camera alone', () => {
    expect(recycle(30, 20, 216)).toBe(30);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/render/rows.test.ts`
Expected: FAIL. The module can't be resolved.

- [ ] **Step 3: Write `src/render/rows.ts`**

```ts
export interface RowSpec {
  count: number;
  spacing: number;
  offset: number;
}

/** Route positions for a pooled row; the first slot starts `behind` metres behind the camera. */
export function initialPositions(spec: RowSpec, behind = 16): number[] {
  return Array.from({ length: spec.count }, (_, i) => spec.offset - behind + i * spec.spacing);
}

/** A slot whose position fell more than `behind` metres behind the runner jumps to the front of its row. */
export function recycle(p: number, dist: number, span: number, behind = 16): number {
  while (dist - p > behind) p += span;
  return p;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/render/rows.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `src/render/sky.ts`**

```ts
import * as THREE from 'three';
import type { ArtSet } from '../assets/manifest';
import { gradientTexture, toTexture } from './canvas';

export interface Sky {
  update(dt: number): void;
  setDetail(high: boolean): void;
}

export function createSky(scene: THREE.Scene, art: ArtSet): Sky {
  scene.background = art.has('sky') ? toTexture(art.get('sky')) : gradientTexture(['#97bdd6', '#cbdcdf', '#f3e4c7']);
  scene.fog = new THREE.Fog(0xf2e3c6, 60, 210);

  const sk = art.get('skyline');
  const skyW = 560, skyH = (skyW * sk.height) / sk.width;
  const skyline = new THREE.Mesh(
    new THREE.PlaneGeometry(skyW, skyH),
    new THREE.MeshBasicMaterial({ map: toTexture(sk), transparent: true, fog: false, depthWrite: false }),
  );
  skyline.position.set(0, skyH / 2 - 13, -250);
  scene.add(skyline);

  const cloudArt = art.group('cloud-');
  const cloudMats = cloudArt.map((c) => new THREE.SpriteMaterial({ map: toTexture(c), fog: false }));
  const clouds = Array.from({ length: 7 }, (_, i) => {
    const c = cloudArt[i % cloudArt.length];
    const s = new THREE.Sprite(cloudMats[i % cloudMats.length]);
    s.scale.set(34, (34 * c.height) / c.width, 1);
    s.position.set(-130 + i * 44 + (i % 3) * 7, 36 + ((i * 37) % 22), -240);
    scene.add(s);
    return s;
  });

  return {
    update(dt) {
      clouds.forEach((s, i) => {
        s.position.x += dt * (0.6 + i * 0.1);
        if (s.position.x > 170) s.position.x = -170;
      });
    },
    setDetail(high) {
      clouds.forEach((s) => (s.visible = high));
    },
  };
}
```

- [ ] **Step 6: Write `src/render/street.ts`**

```ts
import * as THREE from 'three';
import type { ArtSet } from '../assets/manifest';
import { inPlaza } from '../core/route';
import { toTexture } from './canvas';
import * as P from './placeholders/paint';
import { initialPositions, recycle, type RowSpec } from './rows';

export interface Street {
  update(dist: number): void;
  reset(): void;
  setDetail(high: boolean): void;
}

interface Row extends RowSpec {
  kind: 'front' | 'back' | 'lamp';
  side: -1 | 1;
  meshes: THREE.Mesh[];
  mats: THREE.Material[];
  p: number[];
}

const LEN = 320; // length of the road strip, metres
const MID = -140; // its centre: from 20 m behind the runner to 300 m ahead
const DASHES = 40; // lane dashes per line, one every 8 m

export function createStreet(scene: THREE.Scene, art: ArtSet): Street {
  const basic = (o: THREE.MeshBasicMaterialParameters) => new THREE.MeshBasicMaterial(o);
  const flat = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    return m;
  };

  const ground = flat(new THREE.PlaneGeometry(700, 700), basic({ color: 0xd8c9ad }));
  ground.position.set(0, -0.05, -200);
  scene.add(ground);
  const roadTex = toTexture(art.get('texture-road'), [1, LEN / 9]);
  const road = flat(new THREE.PlaneGeometry(9, LEN), basic({ map: roadTex }));
  road.position.set(0, 0, MID);
  scene.add(road);
  const walkTex = toTexture(art.get('texture-sidewalk'), [1, LEN / 3.4]);
  for (const s of [-1, 1] as const) {
    const walk = flat(new THREE.PlaneGeometry(3.4, LEN), basic({ map: walkTex }));
    walk.position.set(s * 6.2, 0.02, MID);
    scene.add(walk);
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, LEN), basic({ color: 0xf3ece0 }));
    curb.position.set(s * 4.55, 0.1, MID);
    scene.add(curb);
    const shade = flat(new THREE.PlaneGeometry(1.8, LEN), basic({ map: toTexture(P.shadowStrip(s)), transparent: true, depthWrite: false }));
    shade.position.set(s * 7.0, 0.04, MID);
    scene.add(shade);
  }

  // Lane dashes are drawn here so designer road textures stay plain cobbles.
  const dashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.2, 3), basic({ color: 0xfbf6ea }), DASHES * 2);
  scene.add(dashes);
  const dm = new THREE.Matrix4();
  const flatRot = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
  const updateDashes = (dist: number) => {
    const span = DASHES * 8;
    for (let i = 0; i < DASHES; i++) {
      const z = 14 - ((((i * 8 - dist) % span) + span) % span);
      dm.copy(flatRot).setPosition(-1.3, 0.015, z);
      dashes.setMatrixAt(i, dm);
      dm.copy(flatRot).setPosition(1.3, 0.015, z);
      dashes.setMatrixAt(i + DASHES, dm);
    }
    dashes.instanceMatrix.needsUpdate = true;
  };

  const rows: Row[] = [];
  const addRow = (kind: Row['kind'], side: -1 | 1, spec: RowSpec, geo: THREE.PlaneGeometry, mats: THREE.Material[], x: number, y: number, rotY: number) => {
    const meshes = Array.from({ length: spec.count }, (_, i) => {
      const m = new THREE.Mesh(geo, mats[i % mats.length]);
      m.position.set(x, y, 0);
      m.rotation.y = rotY;
      scene.add(m);
      return m;
    });
    rows.push({ ...spec, kind, side, meshes, mats, p: initialPositions(spec) });
  };

  const facadeTex = art.group('facade-').map((c) => toTexture(c));
  const facadeGeo = new THREE.PlaneGeometry(8, 12);
  // The left side faces away from the light, so it is tinted a little darker.
  addRow('front', -1, { count: 27, spacing: 8, offset: 0 }, facadeGeo, facadeTex.map((t) => basic({ map: t, alphaTest: 0.5, color: 0xe7dfd4 })), -7.9, 6, Math.PI / 2);
  addRow('front', 1, { count: 27, spacing: 8, offset: 4 }, facadeGeo, facadeTex.map((t) => basic({ map: t, alphaTest: 0.5 })), 7.9, 6, -Math.PI / 2);
  const backMats = art.group('back-').map((c) => basic({ map: toTexture(c), alphaTest: 0.5 }));
  const backGeo = new THREE.PlaneGeometry(10, 16);
  addRow('back', -1, { count: 24, spacing: 10, offset: 3 }, backGeo, backMats, -13.5, 8, Math.PI / 2);
  addRow('back', 1, { count: 24, spacing: 10, offset: 8 }, backGeo, backMats, 13.5, 8, -Math.PI / 2);
  const lampArt = art.get('prop-lamp');
  const lampH = 4.5;
  const lampGeo = new THREE.PlaneGeometry((lampH * lampArt.width) / lampArt.height, lampH);
  const lampMats = [basic({ map: toTexture(lampArt), alphaTest: 0.5 })];
  addRow('lamp', -1, { count: 15, spacing: 16, offset: 2 }, lampGeo, lampMats, -5.05, lampH / 2, 0);
  addRow('lamp', 1, { count: 15, spacing: 16, offset: 10 }, lampGeo, lampMats, 5.05, lampH / 2, 0);

  let showBack = true;
  return {
    update(dist) {
      roadTex.offset.y = (dist / 9) % 1;
      walkTex.offset.y = (dist / 3.4) % 1;
      updateDashes(dist);
      for (const row of rows) {
        const span = row.count * row.spacing;
        row.meshes.forEach((m, i) => {
          const p = recycle(row.p[i], dist, span);
          if (p !== row.p[i] && row.kind !== 'lamp') m.material = row.mats[Math.floor(Math.random() * row.mats.length)];
          row.p[i] = p;
          m.position.z = dist - p;
          m.visible = row.kind === 'lamp' || ((row.kind === 'front' || showBack) && !inPlaza(p, row.side, row.kind === 'back' ? 4 : 0));
        });
      }
    },
    reset() {
      for (const row of rows) row.p = initialPositions(row);
    },
    setDetail(high) {
      showBack = high;
    },
  };
}
```

- [ ] **Step 7: Write `src/render/landmarks.ts`**

```ts
import * as THREE from 'three';
import type { ArtSet } from '../assets/manifest';
import { LANDMARKS, type LandmarkId } from '../core/route';
import { toTexture } from './canvas';
import * as P from './placeholders/paint';

export interface Landmarks {
  update(dist: number, time: number): void;
}

interface Placement {
  art: string;
  x: number;
  rotY: number;
  /** World size: give the height (width follows the image aspect) or the width. */
  height?: number;
  width?: number;
  lift?: number;
}

const PLACEMENTS: Record<Exclude<LandmarkId, 'riesenrad'>, Placement> = {
  stephansdom: { art: 'landmark-stephansdom', x: 21.5, rotY: -0.45, height: 33 },
  karlskirche: { art: 'landmark-karlskirche', x: -22.5, rotY: 0.45, height: 23.4 },
  hofburg: { art: 'landmark-hofburg', x: 24, rotY: -0.45, height: 21 },
  tram: { art: 'landmark-tram', x: -6.3, rotY: Math.PI / 2, width: 14, lift: 0.1 },
};

function card(c: HTMLCanvasElement, size: { height?: number; width?: number }): { mesh: THREE.Mesh; w: number; h: number } {
  const aspect = c.width / c.height;
  const h = size.height ?? (size.width ?? 10) / aspect;
  const w = size.width ?? h * aspect;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: toTexture(c), alphaTest: 0.5, side: THREE.DoubleSide }));
  return { mesh, w, h };
}

export function createLandmarks(scene: THREE.Scene, art: ArtSet): Landmarks {
  const objects = new Map<LandmarkId, THREE.Object3D>();
  for (const [id, pl] of Object.entries(PLACEMENTS) as Array<[LandmarkId, Placement]>) {
    const { mesh, h } = card(art.get(pl.art), pl);
    mesh.position.set(pl.x, h / 2 + (pl.lift ?? 0), 0);
    mesh.rotation.y = pl.rotY;
    scene.add(mesh);
    objects.set(id, mesh);
  }

  // Riesenrad: rotating wheel, cabins that stay upright, static support hanging from the hub.
  const D = 29;
  const wheelGroup = new THREE.Group();
  const wheel = card(art.get('riesenrad-wheel'), { width: D }).mesh;
  wheelGroup.add(wheel);
  const support = card(art.get('riesenrad-support'), { width: D });
  support.mesh.position.set(0, -support.h / 2, -0.4);
  wheelGroup.add(support.mesh);
  const cabinArt = art.get('riesenrad-cabin');
  const cabinMat = new THREE.MeshBasicMaterial({ map: toTexture(cabinArt), alphaTest: 0.5, side: THREE.DoubleSide });
  const cabinGeo = new THREE.PlaneGeometry(2.2, (2.2 * cabinArt.height) / cabinArt.width);
  const cabins = Array.from({ length: 15 }, () => {
    const m = new THREE.Mesh(cabinGeo, cabinMat);
    m.position.z = 0.4;
    wheelGroup.add(m);
    return m;
  });
  wheelGroup.position.set(24, support.h, 0);
  wheelGroup.rotation.y = -0.35;
  scene.add(wheelGroup);
  objects.set('riesenrad', wheelGroup);

  const finish = new THREE.Group();
  const banner = card(art.get('banner-finish'), { width: 10.4 }).mesh;
  banner.position.y = 6.2;
  finish.add(banner);
  for (const s of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.28, 7.2, 0.28), new THREE.MeshBasicMaterial({ color: 0x3a2a22 }));
    pole.position.set(s * 5.25, 3.6, 0);
    finish.add(pole);
  }
  const checker = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.1), new THREE.MeshBasicMaterial({ map: toTexture(P.paintCheckerA()) }));
  checker.rotation.x = -Math.PI / 2;
  checker.position.y = 0.04;
  finish.add(checker);
  scene.add(finish);
  const finishAt = LANDMARKS.find((l) => l.id === 'riesenrad')?.at ?? 600;

  return {
    update(dist, time) {
      for (const lm of LANDMARKS) {
        const o = objects.get(lm.id);
        if (!o) continue;
        const r = lm.at - dist + (lm.id === 'riesenrad' ? 8 : 0);
        o.position.z = -r;
        o.visible = r > -60 && r < 280;
      }
      const fr = finishAt - dist;
      finish.position.z = -fr;
      finish.visible = fr > -60 && fr < 280;
      const angle = time * 0.12;
      wheel.rotation.z = angle;
      cabins.forEach((m, i) => {
        const a = angle + (i * Math.PI * 2) / 15;
        m.position.x = Math.cos(a) * D * 0.469;
        m.position.y = Math.sin(a) * D * 0.469 - 1.1;
      });
    },
  };
}
```

- [ ] **Step 8: Write `src/render/world.ts` (this task's version)**

```ts
import * as THREE from 'three';
import type { ArtSet } from '../assets/manifest';
import type { Run } from '../core/run';
import { createLandmarks } from './landmarks';
import { createSky } from './sky';
import { createStreet } from './street';

export interface World {
  readonly renderer: THREE.WebGLRenderer;
  reset(): void;
  render(run: Run, frameDt: number): void;
  resize(w: number, h: number): void;
  shake(): void;
  playerScreen(): { x: number; y: number };
}

export function createWorld(canvas: HTMLCanvasElement, art: ArtSet, laneWidth: number): World {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.5, 600);
  const sky = createSky(scene, art);
  const street = createStreet(scene, art);
  const landmarks = createLandmarks(scene, art);
  const v = new THREE.Vector3();
  let time = 0, shakeT = 0, px = 0;
  return {
    renderer,
    reset() {
      street.reset();
    },
    render(run, frameDt) {
      time += frameDt;
      shakeT = Math.max(0, shakeT - frameDt);
      px = run.x * laneWidth;
      sky.update(frameDt);
      street.update(run.dist);
      landmarks.update(run.dist, time);
      const sx = shakeT > 0 ? (Math.random() - 0.5) * shakeT * 1.4 : 0;
      const sy = shakeT > 0 ? (Math.random() - 0.5) * shakeT : 0;
      camera.position.set(px * 0.35 + sx, 4.4 + sy, 8.2);
      camera.lookAt(px * 0.3, 1.9, -14);
      renderer.render(scene, camera);
    },
    resize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    shake() {
      shakeT = 0.32;
    },
    playerScreen() {
      v.set(px, 3.4, 0).project(camera);
      return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
    },
  };
}
```

- [ ] **Step 9: Replace `src/main.ts` with the visual harness**

```ts
// Temporary visual harness: the street with an autopilot runner. Replaced by the real app in Task 16.
import '@fontsource/federo';
import '@fontsource/albert-sans/400.css';
import { loadArt } from './assets/manifest';
import { CONFIG } from './config';
import { Bot, BOT_SKILLS } from './core/bot';
import { createRng } from './core/rng';
import { Run } from './core/run';
import { createWorld } from './render/world';

async function boot(): Promise<void> {
  document.body.style.margin = '0';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;display:block';
  document.body.append(canvas);
  const art = await loadArt();
  const world = createWorld(canvas, art, CONFIG.laneWidth);
  const fit = () => world.resize(window.innerWidth, window.innerHeight);
  fit();
  window.addEventListener('resize', fit);
  let run = new Run({ seed: 1 });
  let bot = new Bot(createRng(2), BOT_SKILLS.skilled);
  let last = performance.now();
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    bot.step(run, dt);
    for (const e of run.update(dt)) if (e.kind === 'question') run.answer(true);
    if (run.finished && run.speed < 1) {
      run = new Run({ seed: Math.floor(Math.random() * 1e9) });
      bot = new Bot(createRng(3), BOT_SKILLS.skilled);
      world.reset();
    }
    world.render(run, dt);
  };
  requestAnimationFrame(frame);
}

void boot();
```

- [ ] **Step 10: Type-check, test, build and look at it once**

Run: `npm test && npm run build`
Expected: all tests pass, the build succeeds.

Then take one screenshot (macOS Chrome path; on Windows use Edge with the same flags):
```bash
npm run dev -- --port 5173 --strictPort &
sleep 3
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader \
  --window-size=1600,900 --virtual-time-budget=6000 --screenshot=/tmp/vienna-street.png http://localhost:5173/
kill %1
```
Expected: `/tmp/vienna-street.png` shows the cobbled street, facade cards on both sides, lamps, lane dashes, sky and skyline, with the Stephansdom cutout ahead on the right. It should match the prototype minus the runner and items (Task 10).

- [ ] **Step 11: Commit**

```bash
git add src/render src/main.ts tests/render
git commit -m "feat(render): add paper-cutout street, sky and landmark layers"
```

---

### Task 10: Items, the waiter and touch input

**Files:**
- Create: `src/render/items.ts`, `src/render/runner.ts`, `src/input/gestures.ts`, `src/input/touch.ts`
- Modify: `src/render/world.ts` (final version, full replacement), `src/main.ts` (harness gains input)
- Test: `tests/input/gestures.test.ts`, `tests/input/touch.test.ts`

**Interfaces:**
- Consumes: everything from Task 9; `Run` (Task 6); `Item`, `ItemType`, `GOOD_TYPES`, `BAD_TYPES` (Task 3); `GameConfig['input']` (Task 3); paint export `blobCanvas` (Task 8)
- Produces:
  - `createItems(scene, art, laneWidth): ItemsLayer` with `sync(run, px)`, `reset()`, `material(type)`
  - `createRunner(scene, art, items, laneWidth): Runner` with `update(run, frameDt): number` (returns runner x in metres)
  - `world.ts` final: `type QualityLevel = 'high' | 'med' | 'low'`; `World` gains `setQuality(level: QualityLevel): void`
  - `resolveGesture(down: Point, up: Point | null, centerX: number, swipeMinPx: number): -1 | 1`; `interface Point { x; y }`
  - `attachInput(surface: HTMLElement, cfg: GameConfig['input'], h: InputHandlers): () => void`; `interface InputHandlers { onLane(dir: -1 | 1): void; onPress(): void }`

- [ ] **Step 1: Write the failing tests**

`tests/input/gestures.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { resolveGesture } from '../../src/input/gestures';

const C = 500, MIN = 35;

describe('resolveGesture', () => {
  it('treats a tap by screen half', () => {
    expect(resolveGesture({ x: 100, y: 300 }, { x: 102, y: 301 }, C, MIN)).toBe(-1);
    expect(resolveGesture({ x: 900, y: 300 }, { x: 899, y: 300 }, C, MIN)).toBe(1);
  });
  it('follows a horizontal swipe even when it starts on the other half', () => {
    expect(resolveGesture({ x: 100, y: 300 }, { x: 220, y: 310 }, C, MIN)).toBe(1);
    expect(resolveGesture({ x: 900, y: 300 }, { x: 780, y: 290 }, C, MIN)).toBe(-1);
  });
  it('treats a mostly vertical drag as a tap', () => {
    expect(resolveGesture({ x: 900, y: 100 }, { x: 860, y: 400 }, C, MIN)).toBe(1);
  });
  it('falls back to the press position when the screen lost the release', () => {
    expect(resolveGesture({ x: 100, y: 300 }, null, C, MIN)).toBe(-1);
  });
});
```

`tests/input/touch.test.ts`:
```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../../src/config';
import { attachInput } from '../../src/input/touch';

function pointer(target: EventTarget, type: string, x: number, opts: { primary?: boolean; id?: number } = {}) {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(e, {
    clientX: { value: x }, clientY: { value: 300 },
    isPrimary: { value: opts.primary ?? true }, pointerId: { value: opts.id ?? 1 },
  });
  target.dispatchEvent(e);
}

describe('attachInput', () => {
  let surface: HTMLDivElement;
  let onLane: ReturnType<typeof vi.fn>;
  let onPress: ReturnType<typeof vi.fn>;
  let detach: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    surface = document.createElement('div');
    surface.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600, x: 0, y: 0, toJSON: () => ({}) });
    document.body.append(surface);
    onLane = vi.fn();
    onPress = vi.fn();
    detach = attachInput(surface, CONFIG.input, { onLane, onPress });
  });
  afterEach(() => {
    detach();
    surface.remove();
    vi.useRealTimers();
  });

  it('moves one lane per tap', () => {
    pointer(surface, 'pointerdown', 800);
    pointer(surface, 'pointerup', 801);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onLane).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('ignores a second finger or a palm', () => {
    pointer(surface, 'pointerdown', 200, { primary: false, id: 2 });
    pointer(surface, 'pointerup', 200, { primary: false, id: 2 });
    expect(onPress).not.toHaveBeenCalled();
    expect(onLane).not.toHaveBeenCalled();
  });

  it('still moves once when the screen never reports the release', () => {
    pointer(surface, 'pointerdown', 200);
    vi.advanceTimersByTime(CONFIG.input.tapFallbackMs + 10);
    pointer(surface, 'pointerup', 200);
    expect(onLane).toHaveBeenCalledExactlyOnceWith(-1);
  });

  it('ignores presses on interface buttons', () => {
    const button = document.createElement('button');
    surface.append(button);
    pointer(button, 'pointerdown', 800);
    pointer(button, 'pointerup', 800);
    expect(onPress).not.toHaveBeenCalled();
    expect(onLane).not.toHaveBeenCalled();
  });

  it('maps arrow keys to lanes', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(onLane).toHaveBeenCalledExactlyOnceWith(-1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/input`
Expected: FAIL. The modules can't be resolved.

- [ ] **Step 3: Write `src/input/gestures.ts`**

```ts
export interface Point {
  x: number;
  y: number;
}

/** One touch becomes one lane change: a horizontal swipe goes its way, anything else is a tap on a screen half. */
export function resolveGesture(down: Point, up: Point | null, centerX: number, swipeMinPx: number): -1 | 1 {
  if (up) {
    const dx = up.x - down.x, dy = up.y - down.y;
    if (Math.abs(dx) >= swipeMinPx && Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 1 : -1;
  }
  return down.x < centerX ? -1 : 1;
}
```

- [ ] **Step 4: Write `src/input/touch.ts`**

```ts
import type { GameConfig } from '../config';
import { resolveGesture, type Point } from './gestures';

export interface InputHandlers {
  onLane(dir: -1 | 1): void;
  /** Any fresh press on the game surface (starts the game from the attract screen). */
  onPress(): void;
}

/**
 * Pointer + keyboard input. Only the primary pointer counts, so a second hand or a palm does nothing.
 * Cheap IR touch frames sometimes drop the release, so a press resolves on its own after `tapFallbackMs`.
 */
export function attachInput(surface: HTMLElement, cfg: GameConfig['input'], h: InputHandlers): () => void {
  let down: { p: Point; cx: number; id: number; timer: number; done: boolean } | null = null;

  const finish = (up: Point | null) => {
    if (!down || down.done) return;
    down.done = true;
    window.clearTimeout(down.timer);
    h.onLane(resolveGesture(down.p, up, down.cx, cfg.swipeMinPx));
  };
  const onDown = (e: PointerEvent) => {
    if (!e.isPrimary) return;
    const target = e.target as Element | null;
    if (target?.closest?.('button, [data-ui]')) return;
    if (down && !down.done) finish(null);
    h.onPress();
    const r = surface.getBoundingClientRect();
    down = {
      p: { x: e.clientX, y: e.clientY },
      cx: r.left + r.width / 2,
      id: e.pointerId,
      done: false,
      timer: window.setTimeout(() => finish(null), cfg.tapFallbackMs),
    };
  };
  const onUp = (e: PointerEvent) => {
    if (!e.isPrimary || !down || e.pointerId !== down.id) return;
    finish({ x: e.clientX, y: e.clientY });
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (e.key === 'ArrowLeft' || e.key === 'a') {
      h.onPress();
      h.onLane(-1);
      e.preventDefault();
    } else if (e.key === 'ArrowRight' || e.key === 'd') {
      h.onPress();
      h.onLane(1);
      e.preventDefault();
    } else if (e.key === ' ' || e.key === 'Enter') {
      h.onPress();
    }
  };

  surface.addEventListener('pointerdown', onDown);
  surface.addEventListener('pointerup', onUp);
  window.addEventListener('keydown', onKey);
  return () => {
    surface.removeEventListener('pointerdown', onDown);
    surface.removeEventListener('pointerup', onUp);
    window.removeEventListener('keydown', onKey);
  };
}
```

- [ ] **Step 5: Run the input tests to verify they pass**

Run: `npx vitest run tests/input`
Expected: PASS.

- [ ] **Step 6: Write `src/render/items.ts`**

```ts
import * as THREE from 'three';
import type { ArtSet } from '../assets/manifest';
import type { Run } from '../core/run';
import { BAD_TYPES, GOOD_TYPES, type Item, type ItemType } from '../core/types';
import { toTexture } from './canvas';
import * as P from './placeholders/paint';

export interface ItemsLayer {
  sync(run: Run, px: number): void;
  reset(): void;
  material(type: ItemType): THREE.SpriteMaterial;
}

interface Obj {
  sp: THREE.Sprite;
  sh: THREE.Mesh;
}

const SIZE = 1.7;

export function createItems(scene: THREE.Scene, art: ArtSet, laneWidth: number): ItemsLayer {
  const mats = Object.fromEntries(
    [...GOOD_TYPES, ...BAD_TYPES].map((t) => [t, new THREE.SpriteMaterial({ map: toTexture(art.get(`item-${t}`)), alphaTest: 0.3 })]),
  ) as Record<ItemType, THREE.SpriteMaterial>;
  const blobMat = new THREE.MeshBasicMaterial({ map: toTexture(P.blobCanvas()), transparent: true, depthWrite: false });
  const blobGeo = new THREE.PlaneGeometry(1.5, 0.75);
  const pool: Obj[] = [];
  const live = new Map<number, Obj>();

  const take = (type: ItemType): Obj => {
    let o = pool.pop();
    if (!o) {
      const sh = new THREE.Mesh(blobGeo, blobMat);
      sh.rotation.x = -Math.PI / 2;
      o = { sp: new THREE.Sprite(mats[type]), sh };
    }
    o.sp.material = mats[type];
    o.sp.visible = true;
    o.sh.visible = true;
    scene.add(o.sp, o.sh);
    return o;
  };
  const give = (id: number) => {
    const o = live.get(id);
    if (!o) return;
    scene.remove(o.sp, o.sh);
    pool.push(o);
    live.delete(id);
  };
  const place = (o: Obj, it: Item, r: number, px: number, t: number) => {
    const x = it.lane * laneWidth;
    if (it.state === 'live') {
      o.sp.position.set(x, 1.3 + Math.sin(t * 3 + it.id) * 0.16, -r);
      o.sp.scale.set(SIZE, SIZE, 1);
      o.sh.visible = true;
      o.sh.position.set(x, 0.045, -r);
    } else if (it.state === 'taken') {
      // Flies up onto the waiter's tray.
      const k = Math.min(1, it.t / 0.3);
      o.sp.position.set(x + (px + 0.5 - x) * k, 1.3 + 1.9 * k, -r * (1 - k));
      o.sp.scale.set(SIZE - k, SIZE - k, 1);
      o.sh.visible = false;
      o.sp.visible = k < 1;
    } else {
      // Obstacle: puffs up and vanishes.
      const k = Math.min(1, it.t / 0.25);
      o.sp.scale.set(SIZE * (1 + k * 0.8), SIZE * (1 + k * 0.8), 1);
      o.sp.position.set(x, 1.3 + k, -r);
      o.sh.visible = false;
      o.sp.visible = k < 1;
    }
  };

  return {
    material: (t) => mats[t],
    reset() {
      for (const id of [...live.keys()]) give(id);
    },
    sync(run, px) {
      for (const it of run.items) {
        const r = it.at - run.dist;
        const done = it.state !== 'live' && it.t > 0.35;
        if (r > 230 || r < -12 || done) {
          give(it.id);
          continue;
        }
        let o = live.get(it.id);
        if (!o) {
          o = take(it.type);
          live.set(it.id, o);
        }
        place(o, it, r, px, run.time);
      }
    },
  };
}
```

- [ ] **Step 7: Write `src/render/runner.ts`**

```ts
import * as THREE from 'three';
import type { ArtSet } from '../assets/manifest';
import type { Run } from '../core/run';
import type { GoodType } from '../core/types';
import { toTexture } from './canvas';
import type { ItemsLayer } from './items';
import * as P from './placeholders/paint';

export interface Runner {
  /** Draws the waiter for this frame and returns his x position in metres. */
  update(run: Run, frameDt: number): number;
}

/** Tray centre inside a waiter frame: share of width from the left, share of height from the top (docs/ASSET_SPEC.md). */
const TRAY = { u: 0.734, v: 0.094 };
const HEIGHT = 3.0;

export function createRunner(scene: THREE.Scene, art: ArtSet, items: ItemsLayer, laneWidth: number): Runner {
  const runArt = art.group('waiter-run-');
  const runFrames = runArt.map((c) => toTexture(c));
  const stumbleFrames = art.group('waiter-stumble-').map((c) => toTexture(c));
  const celebrateFrames = art.group('waiter-celebrate-').map((c) => toTexture(c));
  const width = (HEIGHT * runArt[0].width) / runArt[0].height;

  const mat = new THREE.SpriteMaterial({ map: runFrames[0], alphaTest: 0.3 });
  const sprite = new THREE.Sprite(mat);
  sprite.center.set(0.5, 0);
  sprite.scale.set(width, HEIGHT, 1);
  scene.add(sprite);
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 0.9),
    new THREE.MeshBasicMaterial({ map: toTexture(P.blobCanvas()), transparent: true, depthWrite: false }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.035;
  scene.add(blob);
  const stack = Array.from({ length: 6 }, () => {
    const s = new THREE.Sprite(items.material('sacher'));
    s.scale.set(0.72, 0.72, 1);
    s.visible = false;
    scene.add(s);
    return s;
  });
  // The treat knocked off the tray by an obstacle tumbles to the ground. It gets its own material copy,
  // because spinning a shared material would spin every treat of that type on the road too.
  const falling = new THREE.Sprite(items.material('sacher').clone());
  falling.scale.set(0.72, 0.72, 1);
  falling.visible = false;
  scene.add(falling);
  let fallT = -1, fallX = 0, fallY = 0;
  let lastTray: GoodType[] = [];
  let animT = 0;

  return {
    update(run, frameDt) {
      if (!run.paused) animT += frameDt;
      const px = run.x * laneWidth;
      const frames = run.finished && celebrateFrames.length ? celebrateFrames : run.stumble > 0 && stumbleFrames.length ? stumbleFrames : runFrames;
      const fps = frames === runFrames ? 3.75 * runFrames.length : 6;
      mat.map = frames[Math.floor(animT * fps) % frames.length];
      const bob = run.finished ? 0 : Math.abs(Math.sin(animT * 7.5 * Math.PI)) * 0.12;
      const wobble = run.stumble > 0 && !stumbleFrames.length ? Math.sin(animT * 40) * run.stumble * 0.5 : 0;
      const lean = (run.lane - run.x) * 0.35 + wobble;
      mat.rotation = -lean;
      sprite.position.set(px, bob, 0);
      blob.position.x = px;

      const lx = (TRAY.u - 0.5) * width, ly = (1 - TRAY.v) * HEIGHT + 0.25;
      const ca = Math.cos(-lean), sa = Math.sin(-lean);
      stack.forEach((s, i) => {
        const type = run.tray[i];
        if (!type) {
          s.visible = false;
          return;
        }
        s.visible = true;
        s.material = items.material(type);
        const ox = lx + Math.sin(i * 2.3) * 0.05, oy = ly + i * 0.36;
        s.position.set(px + ox * ca - oy * sa, bob + ox * sa + oy * ca, 0.1);
      });

      if (run.tray.length < lastTray.length && run.stumble > 0) {
        falling.material.dispose();
        falling.material = items.material(lastTray[lastTray.length - 1]).clone();
        fallT = 0;
        fallX = px + lx;
        fallY = bob + ly + (lastTray.length - 1) * 0.36;
      }
      lastTray = [...run.tray];
      if (fallT >= 0) {
        fallT += frameDt;
        falling.visible = fallT < 0.6;
        falling.position.set(fallX + fallT * 1.6, fallY + fallT * 1.5 - fallT * fallT * 9, 0.2);
        falling.material.rotation = fallT * 9;
        if (fallT >= 0.6) fallT = -1;
      }
      return px;
    },
  };
}
```

- [ ] **Step 8: Replace `src/render/world.ts` with the final version**

```ts
import * as THREE from 'three';
import type { ArtSet } from '../assets/manifest';
import type { Run } from '../core/run';
import { createItems } from './items';
import { createLandmarks } from './landmarks';
import { createRunner } from './runner';
import { createSky } from './sky';
import { createStreet } from './street';

export type QualityLevel = 'high' | 'med' | 'low';

export interface World {
  readonly renderer: THREE.WebGLRenderer;
  reset(): void;
  render(run: Run, frameDt: number): void;
  resize(w: number, h: number): void;
  shake(): void;
  playerScreen(): { x: number; y: number };
  setQuality(level: QualityLevel): void;
}

const PIXEL_RATIO: Record<QualityLevel, number> = { high: 2, med: 1.25, low: 1 };

export function createWorld(canvas: HTMLCanvasElement, art: ArtSet, laneWidth: number): World {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PIXEL_RATIO.high));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.5, 600);
  const sky = createSky(scene, art);
  const street = createStreet(scene, art);
  const landmarks = createLandmarks(scene, art);
  const items = createItems(scene, art, laneWidth);
  const runner = createRunner(scene, art, items, laneWidth);
  const v = new THREE.Vector3();
  let time = 0, shakeT = 0, px = 0, w = 1, h = 1;

  return {
    renderer,
    reset() {
      street.reset();
      items.reset();
    },
    render(run, frameDt) {
      time += frameDt;
      shakeT = Math.max(0, shakeT - frameDt);
      sky.update(frameDt);
      street.update(run.dist);
      landmarks.update(run.dist, time);
      px = runner.update(run, frameDt);
      items.sync(run, px);
      const sx = shakeT > 0 ? (Math.random() - 0.5) * shakeT * 1.4 : 0;
      const sy = shakeT > 0 ? (Math.random() - 0.5) * shakeT : 0;
      camera.position.set(px * 0.35 + sx, 4.4 + sy, 8.2);
      camera.lookAt(px * 0.3, 1.9, -14);
      renderer.render(scene, camera);
    },
    resize(width, height) {
      w = width;
      h = height;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    shake() {
      shakeT = 0.32;
    },
    playerScreen() {
      v.set(px, 3.4, 0).project(camera);
      return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
    },
    setQuality(level) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PIXEL_RATIO[level]));
      renderer.setSize(w, h, false);
      street.setDetail(level !== 'low');
      sky.setDetail(level !== 'low');
    },
  };
}
```

- [ ] **Step 9: Give the harness input (edit `src/main.ts`)**

Add the import after the other imports:
```ts
import { attachInput } from './input/touch';
```
Replace the `frame` callback's first two game lines:
```ts
    bot.step(run, dt);
```
with:
```ts
    if (!manual) bot.step(run, dt);
```
and add, right before `let last = performance.now();`:
```ts
  let manual = false;
  attachInput(document.body, CONFIG.input, {
    onLane: (d) => {
      manual = true;
      run.move(d);
    },
    onPress: () => undefined,
  });
```

- [ ] **Step 10: Test, build and look once**

Run: `npm test && npm run build`
Expected: all tests pass, the build succeeds.
Then repeat the screenshot command from Task 9 Step 10 (writing to `/tmp/vienna-runner.png`).
Expected: the waiter (seen from behind, tray up) runs in a lane with sticker items floating ahead, matching the prototype's option A.

- [ ] **Step 11: Commit**

```bash
git add src/render src/input src/main.ts tests/input
git commit -m "feat: add items, the waiter with tray stack, and touch/keyboard input"
```

---

### Task 11: Screen flow state machine and fixed-step loop

**Files:**
- Create: `src/app/flow.ts`, `src/app/loop.ts`
- Test: `tests/app/flow.test.ts`, `tests/app/loop.test.ts`

**Interfaces:**
- Consumes: `GameConfig`, `CONFIG` (Task 3)
- Produces:
  - `type Screen = 'attract' | 'howto' | 'countdown' | 'run' | 'question' | 'feedback' | 'finish' | 'results'`
  - `interface FlowHooks { enter(screen: Screen, prev: Screen): void; answered(correct: boolean): void }`
  - `class Flow` with `screen`, `elapsed`, `start()`, `update(dt)`, `press()`, `questionAsked()`, `answer(correct)`, `runFinished()`, `nextPlayer()`, getter `questionRemaining`
  - `class FixedStepper { constructor(step?, speed?, maxSteps?); readonly speed; advance(frameSeconds, fn): number }`
  - `interface Loop { lastFrameAt(): number; stop(): void }`, `startLoop(stepper, step, render: (realFrameSeconds: number) => void): Loop`

- [ ] **Step 1: Write the failing tests**

`tests/app/flow.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { Flow, type Screen } from '../../src/app/flow';
import { CONFIG } from '../../src/config';

function setup() {
  const entered: Screen[] = [];
  const answered = vi.fn();
  const flow = new Flow(CONFIG, { enter: (s) => entered.push(s), answered });
  flow.start();
  const tick = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds * 60) + 2; i++) flow.update(1 / 60);
  };
  return { flow, entered, answered, tick };
}

describe('Flow', () => {
  it('starts on the attract screen and only a press there starts a game', () => {
    const { flow, entered } = setup();
    expect(flow.screen).toBe('attract');
    flow.press();
    flow.press();
    expect(entered).toEqual(['attract', 'howto']);
  });

  it('runs how-to and countdown on its own clock', () => {
    const { flow, tick } = setup();
    flow.press();
    tick(CONFIG.flow.howtoSeconds);
    expect(flow.screen).toBe('countdown');
    tick(CONFIG.flow.countdownSeconds);
    expect(flow.screen).toBe('run');
  });

  it('times out an unanswered question as wrong and resumes the run', () => {
    const { flow, answered, tick } = setup();
    flow.press();
    tick(6.1);
    flow.questionAsked();
    expect(flow.screen).toBe('question');
    tick(CONFIG.questions.timeLimit);
    expect(answered).toHaveBeenCalledExactlyOnceWith(false);
    expect(flow.screen).toBe('feedback');
    tick(CONFIG.questions.feedbackSeconds);
    expect(flow.screen).toBe('run');
  });

  it('accepts only the first answer to a question', () => {
    const { flow, answered, tick } = setup();
    flow.press();
    tick(6.1);
    flow.questionAsked();
    flow.answer(true);
    flow.answer(false);
    expect(answered).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('returns to attract by itself when the player walks away from the results', () => {
    const { flow, tick } = setup();
    flow.press();
    tick(6.1);
    flow.runFinished();
    tick(CONFIG.flow.finishSeconds);
    expect(flow.screen).toBe('results');
    flow.press();
    expect(flow.screen).toBe('results');
    tick(CONFIG.flow.resultsFallbackSeconds);
    expect(flow.screen).toBe('attract');
  });

  it('ignores events that do not belong to the current screen', () => {
    const { flow, entered } = setup();
    flow.questionAsked();
    flow.answer(true);
    flow.runFinished();
    flow.nextPlayer();
    expect(entered).toEqual(['attract']);
  });

  it('reports the seconds left on a question', () => {
    const { flow, tick } = setup();
    expect(flow.questionRemaining).toBe(0);
    flow.press();
    tick(6.1);
    flow.questionAsked();
    tick(4);
    expect(flow.questionRemaining).toBeGreaterThan(5.5);
    expect(flow.questionRemaining).toBeLessThan(6.1);
  });
});
```

`tests/app/loop.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { FixedStepper } from '../../src/app/loop';

const count = (s: FixedStepper, frames: number, frameSeconds: number) => {
  let n = 0;
  for (let i = 0; i < frames; i++) n += s.advance(frameSeconds, () => undefined);
  return n;
};

describe('FixedStepper', () => {
  it('runs one step per 60 Hz frame', () => {
    const n = count(new FixedStepper(), 60, 1 / 60);
    expect(n).toBeGreaterThanOrEqual(59);
    expect(n).toBeLessThanOrEqual(60);
  });
  it('runs proportionally more steps at a higher speed', () => {
    const n = count(new FixedStepper(1 / 60, 4, 5), 60, 1 / 60);
    expect(n).toBeGreaterThanOrEqual(238);
    expect(n).toBeLessThanOrEqual(240);
  });
  it('caps the catch-up after a long stall instead of spiralling', () => {
    expect(new FixedStepper(1 / 60, 1, 5).advance(2, () => undefined)).toBe(5);
  });
  it('passes the fixed step to the callback', () => {
    const seen: number[] = [];
    new FixedStepper(1 / 60).advance(1 / 30, (dt) => seen.push(dt));
    expect(seen.every((dt) => dt === 1 / 60)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/app`
Expected: FAIL. The modules can't be resolved.

- [ ] **Step 3: Write `src/app/flow.ts`**

```ts
import type { GameConfig } from '../config';

export type Screen = 'attract' | 'howto' | 'countdown' | 'run' | 'question' | 'feedback' | 'finish' | 'results';

export interface FlowHooks {
  enter(screen: Screen, prev: Screen): void;
  answered(correct: boolean): void;
}

/**
 * The booth's screen sequence. Every screen except 'run' ends on its own clock, and the run always reaches
 * its finish line, so a player who walks away can never leave the booth stuck.
 */
export class Flow {
  screen: Screen = 'attract';
  elapsed = 0;

  constructor(private readonly cfg: GameConfig, private readonly hooks: FlowHooks) {}

  start(): void {
    this.elapsed = 0;
    this.hooks.enter('attract', 'attract');
  }

  update(dt: number): void {
    this.elapsed += dt;
    const f = this.cfg.flow, e = this.elapsed;
    switch (this.screen) {
      case 'howto':
        if (e >= f.howtoSeconds) this.go('countdown');
        break;
      case 'countdown':
        if (e >= f.countdownSeconds) this.go('run');
        break;
      case 'question':
        if (e >= this.cfg.questions.timeLimit) this.answer(false);
        break;
      case 'feedback':
        if (e >= this.cfg.questions.feedbackSeconds) this.go('run');
        break;
      case 'finish':
        if (e >= f.finishSeconds) this.go('results');
        break;
      case 'results':
        if (e >= f.resultsFallbackSeconds) this.go('attract');
        break;
      default:
        break;
    }
  }

  press(): void {
    if (this.screen === 'attract') this.go('howto');
  }

  questionAsked(): void {
    if (this.screen === 'run') this.go('question');
  }

  answer(correct: boolean): void {
    if (this.screen !== 'question') return;
    this.hooks.answered(correct);
    this.go('feedback');
  }

  runFinished(): void {
    if (this.screen === 'run') this.go('finish');
  }

  nextPlayer(): void {
    if (this.screen === 'results') this.go('attract');
  }

  get questionRemaining(): number {
    return this.screen === 'question' ? Math.max(0, this.cfg.questions.timeLimit - this.elapsed) : 0;
  }

  private go(next: Screen): void {
    const prev = this.screen;
    this.screen = next;
    this.elapsed = 0;
    this.hooks.enter(next, prev);
  }
}
```

- [ ] **Step 4: Write `src/app/loop.ts`**

```ts
/** Turns uneven browser frames into even simulation steps (optionally sped up for tests). */
export class FixedStepper {
  private acc = 0;

  constructor(readonly step = 1 / 60, readonly speed = 1, readonly maxSteps = 5) {}

  /** Runs as many fixed steps as the real time (times speed) allows; returns how many ran. */
  advance(frameSeconds: number, fn: (dt: number) => void): number {
    this.acc += Math.min(Math.max(frameSeconds, 0), 0.25) * this.speed;
    const limit = Math.ceil(this.maxSteps * this.speed);
    let n = 0;
    while (this.acc >= this.step - 1e-9 && n < limit) {
      fn(this.step);
      this.acc -= this.step;
      n++;
    }
    if (n === limit) this.acc = 0; // drop the backlog after a stall instead of spiralling
    return n;
  }
}

export interface Loop {
  lastFrameAt(): number;
  stop(): void;
}

/** requestAnimationFrame loop: fixed simulation steps, then one render with the real frame time. */
export function startLoop(stepper: FixedStepper, step: (dt: number) => void, render: (realFrameSeconds: number) => void): Loop {
  let last = performance.now(), lastFrame = last, raf = 0, running = true;
  const frame = (now: number) => {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const sec = Math.max(0, (now - last) / 1000);
    last = now;
    lastFrame = now;
    stepper.advance(sec, step);
    render(sec);
  };
  raf = requestAnimationFrame(frame);
  return {
    lastFrameAt: () => lastFrame,
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/app`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app tests/app
git commit -m "feat(app): add self-timing screen flow and fixed-step loop"
```

---

### Task 12: Screens and HUD (DOM + paper-style CSS)

**Files:**
- Create: `src/ui/styles.css`, `src/ui/dom.ts`, `src/ui/labels.ts`, `src/ui/hud.ts`, `src/ui/fx.ts`, `src/ui/attract.ts`, `src/ui/howto.ts`, `src/ui/question.ts`, `src/ui/results.ts`
- Test: `tests/ui/hud.test.ts`, `tests/ui/attract.test.ts`, `tests/ui/question.test.ts`, `tests/ui/results.test.ts`

**Interfaces:**
- Consumes: `GameConfig`, `Tier` (Task 3); `ItemType`, `Question` (Task 3)
- Produces:
  - `el(tag, cls?, text?)`; `ITEM_LABELS`, `formatPoints(n)`
  - `class Hud { constructor(parent, routeLabel); show(on); update(score, progress) }`
  - `type PopKind = 'plus' | 'minus' | 'neutral'`; `class Fx { constructor(parent); popup(text, kind, at: { x; y }); flash(); banner(title, sub, seconds); confetti(); clear() }`
  - `class AttractScreen { constructor(parent, cfg, icons: Record<ItemType, string>, logoUrl: string | null); show(); hide() }`
  - `class HowtoScreen { constructor(parent); showHowto(); showCount(n: number); hide() }` (`showCount(0)` shows "Go!")
  - `class QuestionScreen { constructor(parent); show(q, basePoints, onPick: (index: number) => void); tick(fraction, secondsLeft); reveal(correct: number, picked: number | null); hide() }`
  - `class ResultsScreen { constructor(parent, holdMs); show(score, tiers, tierIdx, giftUrl: string | null, onDone: () => void); hide() }`

- [ ] **Step 1: Write the failing tests**

`tests/ui/hud.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Hud } from '../../src/ui/hud';

describe('Hud', () => {
  it('shows the score and route progress', () => {
    const hud = new Hud(document.body, 'Stephansplatz → Riesenrad');
    hud.show(true);
    hud.update(25, 0.5);
    expect(hud.root.hidden).toBe(false);
    expect(hud.root.textContent).toContain('25');
    expect(hud.root.querySelector<HTMLElement>('.bar i')?.style.width).toBe('50%');
  });
});
```

`tests/ui/attract.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { AttractScreen } from '../../src/ui/attract';

const icons = { sacher: 'a.png', kipferl: 'b.png', melange: 'c.png', mozart: 'd.png', krampus: 'e.png', bomb: 'f.png' };

describe('AttractScreen', () => {
  it('lists every item with its points and every gift tier', () => {
    const s = new AttractScreen(document.body, CONFIG, icons, null);
    const text = s.root.textContent ?? '';
    expect(text).toContain('Tap anywhere to play');
    expect(text).toContain('Sachertorte');
    expect(text).toContain('+15');
    expect(text).toContain('−10');
    for (const t of CONFIG.tiers) expect(text).toContain(t.name);
    expect(s.root.querySelectorAll('.legend img')).toHaveLength(6);
  });
  it('uses the logo image when one is provided', () => {
    const s = new AttractScreen(document.body, CONFIG, icons, 'logo.svg');
    expect(s.root.querySelector('img.logo')?.getAttribute('src')).toBe('logo.svg');
  });
});
```

`tests/ui/question.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { Question } from '../../src/core/types';
import { QuestionScreen } from '../../src/ui/question';

const q: Question = { id: 'x', q: 'Which river flows through Vienna?', options: ['Danube', 'Rhine', 'Seine'], answer: 0 };
const press = (el: Element, type: string) => el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));

describe('QuestionScreen', () => {
  it('shows the question, the doubling, and three answers', () => {
    const s = new QuestionScreen(document.body);
    s.show(q, 10, () => undefined);
    expect(s.root.textContent).toContain('10 → 20');
    expect([...s.root.querySelectorAll('.q-option')].map((b) => b.textContent)).toEqual(['Danube', 'Rhine', 'Seine']);
  });
  it('takes only the first pick, even when a tap fires both pointerdown and click', () => {
    const s = new QuestionScreen(document.body);
    const onPick = vi.fn();
    s.show(q, 10, onPick);
    const b = s.root.querySelectorAll('.q-option')[1];
    press(b, 'pointerdown');
    press(b, 'click');
    press(s.root.querySelectorAll('.q-option')[0], 'pointerdown');
    expect(onPick).toHaveBeenCalledExactlyOnceWith(1);
  });
  it('marks the right and the wrong answer and locks the buttons', () => {
    const s = new QuestionScreen(document.body);
    s.show(q, 10, () => undefined);
    s.reveal(0, 1);
    const buttons = [...s.root.querySelectorAll<HTMLButtonElement>('.q-option')];
    expect(buttons[0].classList.contains('right')).toBe(true);
    expect(buttons[1].classList.contains('wrong')).toBe(true);
    expect(buttons.every((b) => b.disabled)).toBe(true);
  });
});
```

`tests/ui/results.test.ts`:
```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../../src/config';
import { ResultsScreen } from '../../src/ui/results';

const press = (el: Element, type: string) => el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));

describe('ResultsScreen', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('highlights the tier the player reached', () => {
    const s = new ResultsScreen(document.body, 1000);
    s.show(105, CONFIG.tiers, 2, null, () => undefined);
    expect(s.root.textContent).toContain('105');
    expect(s.root.querySelector('.r-tier')?.textContent).toBe(CONFIG.tiers[2].name);
    expect(s.root.querySelector('.ladder li.on')?.textContent).toContain(CONFIG.tiers[2].name);
  });

  it('needs a full one-second hold; a tap or a short press does nothing', () => {
    const s = new ResultsScreen(document.body, 1000);
    const done = vi.fn();
    s.show(50, CONFIG.tiers, 0, null, done);
    const hold = s.root.querySelector('.r-hold')!;
    press(hold, 'pointerdown');
    vi.advanceTimersByTime(500);
    press(hold, 'pointerup');
    vi.advanceTimersByTime(1000);
    expect(done).not.toHaveBeenCalled();
    press(hold, 'pointerdown');
    vi.advanceTimersByTime(1000);
    expect(done).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/ui`
Expected: FAIL. The modules can't be resolved.

- [ ] **Step 3: Write `src/ui/dom.ts` and `src/ui/labels.ts`**

`src/ui/dom.ts`:
```ts
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
```

`src/ui/labels.ts`:
```ts
import type { ItemType } from '../core/types';

export const ITEM_LABELS: Record<ItemType, string> = {
  sacher: 'Sachertorte',
  kipferl: 'Kipferl',
  melange: 'Melange',
  mozart: 'Mozartkugel',
  krampus: 'Krampus',
  bomb: 'Bomb',
};

/** +15, −10 (true minus sign), 0 */
export const formatPoints = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
```

- [ ] **Step 4: Write `src/ui/hud.ts` and `src/ui/fx.ts`**

`src/ui/hud.ts`:
```ts
import { el } from './dom';

export class Hud {
  readonly root = el('div', 'hud');
  private scoreEl = el('b', '', '0');
  private fill = el('i');
  private lastScore = -1;
  private lastFill = -1;

  constructor(parent: HTMLElement, routeLabel: string) {
    const score = el('div', 'hud-score');
    score.append(el('span', 'lbl', 'Points'), this.scoreEl);
    const bar = el('div', 'bar');
    bar.append(this.fill);
    const route = el('div', 'hud-route');
    route.append(el('span', 'lbl', routeLabel), bar);
    this.root.append(score, route);
    this.root.hidden = true;
    parent.append(this.root);
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
}
```

`src/ui/fx.ts`:
```ts
import { el } from './dom';

export type PopKind = 'plus' | 'minus' | 'neutral';

export class Fx {
  private layer = el('div', 'fx-layer');
  private flashEl = el('div', 'fx-flash');
  private confettiEl = el('div', 'fx-confetti');
  private bannerEl = el('div', 'fx-banner');
  private bannerTimer = 0;
  private confettiTimer = 0;

  constructor(parent: HTMLElement) {
    this.bannerEl.hidden = true;
    parent.append(this.flashEl, this.layer, this.confettiEl, this.bannerEl);
  }

  popup(text: string, kind: PopKind, at: { x: number; y: number }): void {
    const p = el('div', `fx-pop ${kind}`, text);
    p.style.left = `${at.x * 100}%`;
    p.style.top = `${at.y * 100}%`;
    this.layer.append(p);
    window.setTimeout(() => p.remove(), 950);
    while (this.layer.childElementCount > 12) this.layer.firstElementChild?.remove();
  }

  flash(): void {
    this.flashEl.classList.remove('on');
    void this.flashEl.offsetWidth; // restart the CSS animation
    this.flashEl.classList.add('on');
  }

  banner(title: string, sub: string, seconds: number): void {
    this.bannerEl.replaceChildren(el('b', '', title), el('span', '', sub));
    this.bannerEl.hidden = false;
    window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => (this.bannerEl.hidden = true), seconds * 1000);
  }

  confetti(): void {
    const colors = ['#c8102e', '#fbf3e2', '#e2c06a', '#6f9f8b'];
    this.confettiEl.replaceChildren(
      ...Array.from({ length: 60 }, (_, i) => {
        const c = el('i');
        c.style.left = `${(i * 37) % 100}%`;
        c.style.animationDelay = `${(i % 10) * 0.06}s`;
        c.style.background = colors[i % colors.length];
        return c;
      }),
    );
    window.clearTimeout(this.confettiTimer);
    this.confettiTimer = window.setTimeout(() => this.confettiEl.replaceChildren(), 3000);
  }

  clear(): void {
    this.layer.replaceChildren();
    this.confettiEl.replaceChildren();
    this.bannerEl.hidden = true;
  }
}
```

- [ ] **Step 5: Write `src/ui/attract.ts` and `src/ui/howto.ts`**

`src/ui/attract.ts`:
```ts
import type { GameConfig } from '../config';
import { BAD_TYPES, GOOD_TYPES, type ItemType } from '../core/types';
import { el } from './dom';
import { formatPoints, ITEM_LABELS } from './labels';

export class AttractScreen {
  readonly root = el('div', 'screen attract');

  constructor(parent: HTMLElement, cfg: GameConfig, icons: Record<ItemType, string>, logoUrl: string | null) {
    const card = el('div', 'paper-card attract-card');
    if (logoUrl) {
      const logo = el('img', 'logo');
      logo.src = logoUrl;
      logo.alt = 'Vienna Run';
      card.append(logo);
    } else {
      card.append(el('h1', '', 'Vienna Run'));
    }
    card.append(el('p', 'tagline', 'Race the waiter from Stephansdom to the Riesenrad. Grab Viennese treats, dodge Krampus and the bombs, and win a prize.'));

    const legend = el('ul', 'legend');
    for (const type of [...GOOD_TYPES, ...BAD_TYPES]) {
      const li = el('li', cfg.items[type].good ? '' : 'bad');
      const img = el('img');
      img.src = icons[type];
      img.alt = '';
      li.append(img, el('span', '', ITEM_LABELS[type]), el('b', '', formatPoints(cfg.items[type].points)));
      legend.append(li);
    }

    const ladder = el('ol', 'ladder');
    for (const t of cfg.tiers) {
      const li = el('li');
      li.append(el('b', '', `${t.min}+`), el('span', '', t.name));
      ladder.append(li);
    }

    card.append(legend, ladder, el('p', 'cta', 'Tap anywhere to play'));
    this.root.append(card);
    this.root.hidden = true;
    parent.append(this.root);
  }

  show(): void {
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }
}
```

`src/ui/howto.ts`:
```ts
import { el } from './dom';

export class HowtoScreen {
  readonly root = el('div', 'screen howto');
  private card = el('div', 'paper-card howto-card');
  private count = el('div', 'countdown');

  constructor(parent: HTMLElement) {
    const steps = el('ol');
    for (const s of [
      'Tap the left or right side of the screen to switch lanes.',
      'Grab the treats. Dodge Krampus and the bombs.',
      'Some treats hide a bonus question. Answer right for double points.',
    ]) steps.append(el('li', '', s));
    this.card.append(el('h2', '', 'How to play'), steps);
    this.root.append(this.card, this.count);
    this.root.hidden = true;
    parent.append(this.root);
  }

  showHowto(): void {
    this.root.hidden = false;
    this.card.hidden = false;
    this.count.hidden = true;
  }

  /** 3, 2, 1… and "Go!" for 0. */
  showCount(n: number): void {
    const text = n > 0 ? String(n) : 'Go!';
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
}
```

- [ ] **Step 6: Write `src/ui/question.ts` and `src/ui/results.ts`**

`src/ui/question.ts`:
```ts
import type { Question } from '../core/types';
import { el } from './dom';

export class QuestionScreen {
  readonly root = el('div', 'screen question');
  private title = el('p', 'q-bonus');
  private text = el('h2', 'q-text');
  private ring = el('div', 'q-ring');
  private ringNum = el('span');
  private buttons: HTMLButtonElement[] = [];
  private onPick: ((index: number) => void) | null = null;

  constructor(parent: HTMLElement) {
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
    this.title.textContent = `Bonus question! Right answer = double points (${basePoints} → ${basePoints * 2})`;
    this.text.textContent = q.q;
    q.options.forEach((o, i) => {
      const b = this.buttons[i];
      b.textContent = o;
      b.className = 'q-option';
      b.disabled = false;
    });
    this.onPick = onPick;
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
    this.title.textContent = picked === null ? "Time's up! No points this time." : picked === correct ? 'Right! Double points.' : 'Not quite. No points this time.';
  }

  hide(): void {
    this.onPick = null;
    this.root.hidden = true;
  }

  private pick(i: number): void {
    const cb = this.onPick;
    if (!cb) return;
    this.onPick = null;
    cb(i);
  }
}
```

`src/ui/results.ts`:
```ts
import type { Tier } from '../config';
import { el } from './dom';

export class ResultsScreen {
  readonly root = el('div', 'screen results');
  private score = el('b', 'r-score');
  private tierName = el('h2', 'r-tier');
  private gift = el('img', 'r-gift');
  private ladder = el('ol', 'ladder r-ladder');
  private hold = el('button', 'r-hold');
  private holdFill = el('i');
  private holdTimer = 0;
  private onDone: (() => void) | null = null;

  constructor(parent: HTMLElement, private readonly holdMs: number) {
    const card = el('div', 'paper-card results-card');
    const scoreBox = el('div', 'r-scorebox');
    scoreBox.append(el('span', 'lbl', 'Your score'), this.score);
    this.gift.alt = '';
    card.append(scoreBox, el('p', 'lbl', 'Your prize'), this.tierName, this.gift, this.ladder);
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

  show(score: number, tiers: readonly Tier[], tierIdx: number, giftUrl: string | null, onDone: () => void): void {
    this.score.textContent = String(score);
    this.tierName.textContent = tiers[tierIdx].name;
    this.gift.hidden = !giftUrl;
    if (giftUrl) this.gift.src = giftUrl;
    this.ladder.replaceChildren(
      ...tiers.map((t, i) => {
        const li = el('li', i === tierIdx ? 'on' : i < tierIdx ? 'passed' : '');
        li.append(el('b', '', `${t.min}+`), el('span', '', t.name));
        return li;
      }),
    );
    this.cancelHold();
    this.onDone = onDone;
    this.root.hidden = false;
  }

  hide(): void {
    this.cancelHold();
    this.onDone = null;
    this.root.hidden = true;
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

- [ ] **Step 7: Write `src/ui/styles.css`**

```css
:root {
  --paper: #fbf3e2;
  --paper-2: #f0e3c8;
  --ink: #2b1d17;
  --muted: #7a6455;
  --red: #c8102e;
  --red-ink: #9a3b2b;
  --green: #2f6b55;
  --shadow: rgba(60, 35, 20, 0.35);
  --bg: #1d1411;
  --font-display: 'Federo', Georgia, serif;
  --font-body: 'Albert Sans', system-ui, sans-serif;
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
html, body { margin: 0; height: 100%; background: var(--bg); overflow: hidden; overscroll-behavior: none; }
body { font-family: var(--font-body); color: var(--ink); touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
body.hide-cursor, body.hide-cursor * { cursor: none !important; }
#stage { position: fixed; inset: 0; overflow: hidden; container-type: size; }
#stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.overlay-fx { position: absolute; inset: 0; pointer-events: none; }
.grain { mix-blend-mode: multiply; opacity: 0.28; background-size: 220px 220px; }
.vignette { background: radial-gradient(ellipse at 50% 45%, transparent 58%, rgba(60, 35, 20, 0.38)); }
.paper-card { background: var(--paper); color: var(--ink); border-radius: 0.6cqmin; box-shadow: 0.8cqmin 1cqmin 0 var(--shadow); }
.screen { position: absolute; inset: 0; display: grid; place-items: center; }

/* HUD */
.hud { position: absolute; inset: 0; pointer-events: none; padding: 3cqmin 3.4cqmin; display: flex; justify-content: space-between; align-items: flex-start; }
.hud .lbl { font-size: 1.9cqmin; letter-spacing: 0.14em; text-transform: uppercase; color: var(--red-ink); }
.hud-score { background: var(--paper); padding: 1.6cqmin 2.6cqmin 1.8cqmin; border-radius: 0.6cqmin; box-shadow: 0.6cqmin 0.8cqmin 0 var(--shadow); transform: rotate(-2deg); font-family: var(--font-display); display: flex; flex-direction: column; gap: 0.6cqmin; line-height: 1; }
.hud-score b { font-weight: 400; font-size: 7cqmin; font-variant-numeric: tabular-nums; }
.hud-route { background: var(--paper); padding: 1.5cqmin 2.2cqmin; border-radius: 0.6cqmin; box-shadow: 0.6cqmin 0.8cqmin 0 var(--shadow); transform: rotate(1.2deg); font-family: var(--font-display); width: 46cqmin; display: flex; flex-direction: column; align-items: flex-end; gap: 1.1cqmin; }
.hud-route .lbl { color: var(--ink); text-transform: none; letter-spacing: 0.04em; }
.bar { width: 100%; height: 1.5cqmin; border-radius: 1cqmin; background: #e5d8bf; overflow: hidden; }
.bar i { display: block; height: 100%; width: 0; background: var(--red); }

/* Effects */
.fx-layer, .fx-confetti { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.fx-pop { position: absolute; transform: translate(-50%, -50%); font-family: var(--font-display); font-size: 5cqmin; background: var(--paper); padding: 0.3cqmin 1.6cqmin; border-radius: 0.5cqmin; box-shadow: 0.4cqmin 0.5cqmin 0 var(--shadow); white-space: nowrap; animation: rise 0.9s ease-out forwards; }
.fx-pop.minus { background: #b3262d; color: #fff; }
.fx-pop.neutral { background: #e5d8bf; }
@keyframes rise { 0% { opacity: 0; transform: translate(-50%, -30%) scale(0.7); } 15% { opacity: 1; transform: translate(-50%, -60%) scale(1.08); } 100% { opacity: 0; transform: translate(-50%, -190%) scale(1); } }
.fx-flash { position: absolute; inset: 0; pointer-events: none; opacity: 0; box-shadow: inset 0 0 24cqmin 5cqmin rgba(214, 40, 40, 0.85); }
.fx-flash.on { animation: flash 0.5s ease-out; }
@keyframes flash { from { opacity: 1; } to { opacity: 0; } }
.fx-banner { position: absolute; left: 50%; top: 38%; transform: translate(-50%, -50%); pointer-events: none; display: flex; flex-direction: column; align-items: center; gap: 1cqmin; font-family: var(--font-display); background: var(--paper); padding: 2.6cqmin 7cqmin; border-top: 2cqmin solid var(--red); border-bottom: 2cqmin solid var(--red); box-shadow: 1cqmin 1.4cqmin 0 var(--shadow); animation: pop 0.35s ease-out; }
.fx-banner b { font-weight: 400; font-size: 12cqmin; line-height: 1; }
.fx-banner span { font-size: 3.6cqmin; }
@keyframes pop { from { transform: translate(-50%, -50%) scale(0.6); opacity: 0; } to { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
.fx-confetti i { position: absolute; top: -3cqmin; width: 1.4cqmin; height: 2cqmin; animation: fall 2.6s ease-in forwards; }
@keyframes fall { to { transform: translateY(110cqh) rotate(540deg); } }

/* Attract */
.attract { background: rgba(29, 20, 17, 0.18); }
.attract-card { width: min(84cqw, 130cqmin); padding: 4.5cqmin 6cqmin; text-align: center; display: grid; gap: 2.6cqmin; justify-items: center; }
.attract-card h1 { font-family: var(--font-display); font-weight: 400; font-size: 12cqmin; margin: 0; line-height: 1; letter-spacing: 0.02em; }
.attract-card .logo { max-width: 70cqmin; max-height: 18cqmin; }
.tagline { font-size: 2.8cqmin; margin: 0; max-width: 60ch; line-height: 1.4; }
.cta { font-family: var(--font-display); font-size: 5cqmin; margin: 0; color: #fff; background: var(--red); padding: 1.2cqmin 4cqmin; border-radius: 99cqmin; animation: pulse 1.6s ease-in-out infinite; }
@keyframes pulse { 50% { transform: scale(1.06); } }
.legend { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(6, auto); gap: 1.2cqmin 3cqmin; font-size: 2.3cqmin; }
.legend li { display: grid; justify-items: center; gap: 0.4cqmin; }
.legend img { width: 7cqmin; height: 7cqmin; object-fit: contain; }
.legend b { font-variant-numeric: tabular-nums; }
.legend .bad b { color: #b3262d; }
.ladder { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 1.2cqmin; font-size: 2.2cqmin; }
.ladder li { background: var(--paper-2); padding: 0.8cqmin 1.6cqmin; border-radius: 0.5cqmin; display: flex; gap: 0.8cqmin; align-items: baseline; }
.ladder b { font-family: var(--font-display); font-weight: 400; font-size: 2.8cqmin; }

/* How-to and countdown */
.howto-card { padding: 4cqmin 6cqmin; display: grid; gap: 2cqmin; max-width: 110cqmin; }
.howto-card h2 { font-family: var(--font-display); font-weight: 400; font-size: 7cqmin; margin: 0; }
.howto-card ol { margin: 0; padding-left: 4cqmin; font-size: 3.4cqmin; display: grid; gap: 1.2cqmin; }
.countdown { font-family: var(--font-display); font-size: 26cqmin; color: var(--paper); text-shadow: 1cqmin 1.2cqmin 0 var(--shadow); animation: grow 0.4s ease-out; }
@keyframes grow { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }

/* Question */
.question { background: rgba(29, 20, 17, 0.45); }
.question-card { position: relative; width: min(88cqw, 140cqmin); padding: 4cqmin 5cqmin 5cqmin; display: grid; gap: 3cqmin; }
.q-bonus { margin: 0; font-size: 3cqmin; color: var(--red-ink); font-weight: 600; padding-right: 14cqmin; }
.q-text { margin: 0; font-family: var(--font-display); font-weight: 400; font-size: 6cqmin; line-height: 1.15; padding-right: 14cqmin; text-wrap: balance; }
.q-options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2.4cqmin; }
.q-option { font: 600 3.6cqmin var(--font-body); min-height: 12cqmin; padding: 1.6cqmin 2cqmin; border-radius: 1cqmin; border: 0.4cqmin solid var(--ink); background: #fff; color: var(--ink); box-shadow: 0 0.8cqmin 0 var(--ink); cursor: pointer; touch-action: manipulation; }
.q-option:active { transform: translateY(0.5cqmin); box-shadow: 0 0.3cqmin 0 var(--ink); }
.q-option.right { background: var(--green); color: #fff; }
.q-option.wrong { background: #b3262d; color: #fff; }
.q-option:disabled:not(.right):not(.wrong) { opacity: 0.55; }
.q-ring { position: absolute; top: 3cqmin; right: 3.4cqmin; width: 11cqmin; height: 11cqmin; border-radius: 50%; display: grid; place-items: center; background: conic-gradient(var(--red) calc(var(--p, 1) * 360deg), #e5d8bf 0); }
.q-ring span { width: 8.4cqmin; height: 8.4cqmin; border-radius: 50%; background: var(--paper); display: grid; place-items: center; font-family: var(--font-display); font-size: 4.6cqmin; }

/* Results */
.results { background: rgba(29, 20, 17, 0.5); }
.results-card { width: min(80cqw, 120cqmin); padding: 4cqmin 6cqmin; display: grid; justify-items: center; gap: 1.6cqmin; text-align: center; }
.results .lbl { margin: 0; font-size: 2.4cqmin; letter-spacing: 0.14em; text-transform: uppercase; color: var(--red-ink); }
.r-scorebox { display: grid; gap: 0.6cqmin; }
.r-score { font-family: var(--font-display); font-weight: 400; font-size: 16cqmin; line-height: 1; font-variant-numeric: tabular-nums; }
.r-tier { margin: 0; font-family: var(--font-display); font-weight: 400; font-size: 8cqmin; color: var(--red); }
.r-gift { width: 22cqmin; height: 22cqmin; object-fit: contain; }
.r-ladder li.on { background: var(--red); color: #fff; }
.r-ladder li.passed { opacity: 0.6; }
.r-hold { position: absolute; right: 3cqmin; bottom: 3cqmin; font: 600 2.2cqmin var(--font-body); padding: 1.4cqmin 2.6cqmin; border-radius: 99cqmin; border: 0.3cqmin solid var(--paper); background: rgba(29, 20, 17, 0.75); color: var(--paper); overflow: hidden; cursor: pointer; }
.r-hold i { position: absolute; inset: 0; width: 0; background: var(--red); transition: width 0s linear; }
.r-hold.holding i { width: 100%; transition-property: width; }
.r-hold span { position: relative; }

/* Watchdog card (outside #stage) */
.restart-card { position: fixed; inset: 0; display: grid; place-items: center; background: rgba(29, 20, 17, 0.85); font-family: var(--font-display); font-size: 8vmin; color: var(--paper); text-align: center; padding: 4vmin; z-index: 10; }

@media (prefers-reduced-motion: reduce) {
  .cta, .fx-confetti i { animation: none; }
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run tests/ui && npx tsc --noEmit`
Expected: PASS; no type errors.

- [ ] **Step 9: Commit**

```bash
git add src/ui tests/ui
git commit -m "feat(ui): add paper-style HUD, attract, how-to, question and results screens"
```

---

### Task 13: Params, kiosk hardening, safe storage and watchdog

**Files:**
- Create: `src/app/params.ts`, `src/app/kiosk.ts`, `src/app/storage.ts`, `src/app/watchdog.ts`, `src/app/audio.ts`
- Test: `tests/app/params.test.ts`, `tests/app/kiosk.test.ts`, `tests/app/storage.test.ts`, `tests/app/watchdog.test.ts`

**Interfaces:**
- Consumes: `GameConfig`, `CONFIG` (Task 3); `QualityLevel` (Task 10)
- Produces:
  - `interface Params { seed?: number; autoplay: boolean; speed: number; quality?: QualityLevel; check: boolean; cursor: boolean }`, `parseParams(search: string): Params`
  - `installKiosk(doc: Document, opts: { hideCursor: boolean }): void`
  - `safeLocalStorage()`, `safeSessionStorage()`, `readJson<T>(key, fallback, isValid?, storage?)`, `writeJson(key, value, storage?)`
  - `allowReload(history, now, max, windowMs): { allowed: boolean; history: number[] }`, `shouldRefresh(runs, uptimeMs, cfg)`, `installWatchdog(deps): { restart(reason: string): void }`
  - `audio.play(id: 'collect' | 'hit' | 'question' | 'finish'): void` (silent)

- [ ] **Step 1: Write the failing tests**

`tests/app/params.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseParams } from '../../src/app/params';

describe('parseParams', () => {
  it('defaults to a normal booth session', () => {
    expect(parseParams('')).toEqual({ seed: undefined, autoplay: false, speed: 1, quality: undefined, check: false, cursor: false });
  });
  it('reads debug switches', () => {
    expect(parseParams('?seed=7&autoplay=1&speed=8&quality=low&check=1&cursor=1')).toEqual({ seed: 7, autoplay: true, speed: 8, quality: 'low', check: true, cursor: true });
  });
  it('treats bot=1 as autoplay and clamps the speed', () => {
    expect(parseParams('?bot=1&speed=100')).toMatchObject({ autoplay: true, speed: 16 });
  });
  it('ignores junk values', () => {
    expect(parseParams('?seed=abc&quality=ultra&speed=&autoplay=0')).toEqual({ seed: undefined, autoplay: false, speed: 1, quality: undefined, check: false, cursor: false });
  });
});
```

`tests/app/kiosk.test.ts`:
```ts
// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { installKiosk } from '../../src/app/kiosk';

describe('installKiosk', () => {
  beforeAll(() => installKiosk(document, { hideCursor: true }));

  it('blocks the long-press context menu', () => {
    const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    document.body.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });
  it('blocks ctrl+wheel and ctrl+plus zoom but not plain scrolling', () => {
    const zoom = new WheelEvent('wheel', { bubbles: true, cancelable: true, ctrlKey: true });
    document.body.dispatchEvent(zoom);
    expect(zoom.defaultPrevented).toBe(true);
    const plain = new WheelEvent('wheel', { bubbles: true, cancelable: true });
    document.body.dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(false);
    const key = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true, cancelable: true });
    document.body.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(true);
  });
  it('hides the cursor', () => {
    expect(document.body.classList.contains('hide-cursor')).toBe(true);
  });
});
```

`tests/app/storage.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { readJson, writeJson } from '../../src/app/storage';

const memory = (init: Record<string, string> = {}) => {
  const data = { ...init };
  return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; }, data };
};
const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); } };
const isList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

describe('safe storage', () => {
  it('round-trips JSON', () => {
    const s = memory();
    writeJson('k', ['a'], s);
    expect(readJson('k', [] as string[], isList, s)).toEqual(['a']);
  });
  it('falls back when storage is blocked or full', () => {
    expect(readJson('k', ['x'], isList, broken)).toEqual(['x']);
    expect(() => writeJson('k', ['a'], broken)).not.toThrow();
    expect(readJson('k', ['x'], isList, null)).toEqual(['x']);
  });
  it('falls back on garbage or a wrong shape', () => {
    expect(readJson('k', ['x'], isList, memory({ k: '{not json' }))).toEqual(['x']);
    expect(readJson('k', ['x'], isList, memory({ k: '42' }))).toEqual(['x']);
  });
});
```

`tests/app/watchdog.test.ts`:
```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { allowReload, installWatchdog, shouldRefresh } from '../../src/app/watchdog';
import { CONFIG } from '../../src/config';

describe('reload guard', () => {
  it('allows up to the limit inside the window, then stops', () => {
    let h: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = allowReload(h, 1000 + i, 5, 120_000);
      expect(r.allowed).toBe(true);
      h = r.history;
    }
    expect(allowReload(h, 2000, 5, 120_000).allowed).toBe(false);
    expect(allowReload(h, 200_000, 5, 120_000).allowed).toBe(true);
  });
  it('asks for a preventive refresh after enough runs or uptime', () => {
    expect(shouldRefresh(24, 1000, CONFIG.watchdog)).toBe(false);
    expect(shouldRefresh(25, 1000, CONFIG.watchdog)).toBe(true);
    expect(shouldRefresh(1, 2 * 3_600_000, CONFIG.watchdog)).toBe(true);
  });
});

describe('installWatchdog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  it('shows a restart card and reloads after an error', () => {
    const reload = vi.fn();
    const w = installWatchdog({ cfg: CONFIG.watchdog, canvas: document.createElement('canvas'), lastFrameAt: () => performance.now(), reload });
    w.restart('test');
    expect(document.body.textContent).toContain("Let's restart!");
    vi.advanceTimersByTime(1600);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('stops reloading after too many restarts and asks for staff', () => {
    sessionStorage.setItem('vienna-run:reloads', JSON.stringify([Date.now(), Date.now(), Date.now(), Date.now(), Date.now()]));
    const reload = vi.fn();
    installWatchdog({ cfg: CONFIG.watchdog, canvas: document.createElement('canvas'), lastFrameAt: () => performance.now(), reload }).restart('test');
    vi.advanceTimersByTime(5000);
    expect(reload).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('ask the staff');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/app/params.test.ts tests/app/kiosk.test.ts tests/app/storage.test.ts tests/app/watchdog.test.ts`
Expected: FAIL. The modules can't be resolved.

- [ ] **Step 3: Write `src/app/params.ts`**

```ts
import type { QualityLevel } from '../render/world';

export interface Params {
  seed?: number;
  /** The bot plays whole rounds by itself (soak tests, unattended demos). `?bot=1` works too. */
  autoplay: boolean;
  /** Simulation speed multiplier, 0.25 to 16. */
  speed: number;
  quality?: QualityLevel;
  /** Opens the booth self-check screen. */
  check: boolean;
  /** Shows the mouse cursor. */
  cursor: boolean;
}

export function parseParams(search: string): Params {
  const q = new URLSearchParams(search);
  const num = (k: string): number | undefined => {
    const v = q.get(k);
    if (v === null || v.trim() === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const flag = (k: string): boolean => {
    const v = q.get(k);
    return v !== null && v !== '0' && v !== 'false';
  };
  const quality = q.get('quality');
  return {
    seed: num('seed'),
    autoplay: flag('autoplay') || flag('bot'),
    speed: Math.min(16, Math.max(0.25, num('speed') ?? 1)),
    quality: quality === 'high' || quality === 'med' || quality === 'low' ? quality : undefined,
    check: flag('check'),
    cursor: flag('cursor'),
  };
}
```

- [ ] **Step 4: Write `src/app/kiosk.ts`, `src/app/storage.ts` and `src/app/audio.ts`**

`src/app/kiosk.ts`:
```ts
/** Stops the browser from doing browser things on a public touchscreen (zoom, menus, selection, drag). */
export function installKiosk(doc: Document, opts: { hideCursor: boolean }): void {
  const block = (e: Event) => e.preventDefault();
  for (const type of ['contextmenu', 'dragstart', 'selectstart', 'gesturestart']) doc.addEventListener(type, block);
  doc.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  doc.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault();
  });
  doc.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  if (opts.hideCursor) doc.body.classList.add('hide-cursor');
}
```

`src/app/storage.ts`:
```ts
type Reader = Pick<Storage, 'getItem'>;
type Writer = Pick<Storage, 'setItem'>;

export function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function safeSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Reads JSON; any failure (blocked, missing, garbage, wrong shape) returns the fallback. */
export function readJson<T>(key: string, fallback: T, isValid?: (v: unknown) => v is T, storage: Reader | null = safeLocalStorage()): T {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return fallback;
    const value: unknown = JSON.parse(raw);
    if (isValid && !isValid(value)) return fallback;
    return value as T;
  } catch {
    return fallback;
  }
}

/** Writes JSON; storage that is full or blocked is ignored because the game works without it. */
export function writeJson(key: string, value: unknown, storage: Writer | null = safeLocalStorage()): void {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // ignored on purpose
  }
}
```

`src/app/audio.ts`:
```ts
export type SoundId = 'collect' | 'hit' | 'question' | 'finish';

/** Silent for the MVP. Load and play sounds here later; the game already calls every cue. */
export const audio = {
  play(_id: SoundId): void {},
};
```

- [ ] **Step 5: Write `src/app/watchdog.ts`**

```ts
import type { GameConfig } from '../config';
import { readJson, safeSessionStorage, writeJson } from './storage';

const RELOADS_KEY = 'vienna-run:reloads';
const LOG_KEY = 'vienna-run:errors';
const isNumbers = (v: unknown): v is number[] => Array.isArray(v) && v.every((x) => typeof x === 'number');
const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** Records a reload attempt; refuses once `max` reloads happened inside `windowMs` (a crash loop). */
export function allowReload(history: readonly number[], now: number, max: number, windowMs: number): { allowed: boolean; history: number[] } {
  const recent = history.filter((t) => now - t < windowMs);
  if (recent.length >= max) return { allowed: false, history: recent };
  return { allowed: true, history: [...recent, now] };
}

/** Fresh page between players every N runs or hours, to shed any slow leak. */
export function shouldRefresh(runsSinceBoot: number, uptimeMs: number, cfg: GameConfig['watchdog']): boolean {
  return runsSinceBoot >= cfg.reloadEveryRuns || uptimeMs >= cfg.reloadEveryHours * 3_600_000;
}

export interface WatchdogDeps {
  cfg: GameConfig['watchdog'];
  canvas: HTMLCanvasElement;
  lastFrameAt: () => number;
  reload?: () => void;
}

/** Any error, lost GPU context or frozen frame loop → a short card, then a clean reload. */
export function installWatchdog(d: WatchdogDeps): { restart(reason: string): void } {
  const reload = d.reload ?? (() => location.reload());
  let restarting = false;
  const card = (text: string) => {
    const c = document.createElement('div');
    c.className = 'restart-card';
    c.textContent = text;
    document.body.append(c);
  };
  const restart = (reason: string) => {
    if (restarting) return;
    restarting = true;
    const log = readJson<string[]>(LOG_KEY, [], isStrings);
    writeJson(LOG_KEY, [...log, `${new Date().toISOString()} ${reason}`].slice(-50));
    const session = safeSessionStorage();
    const r = allowReload(readJson<number[]>(RELOADS_KEY, [], isNumbers, session), Date.now(), d.cfg.maxReloads, d.cfg.reloadWindowMs);
    writeJson(RELOADS_KEY, r.history, session);
    if (r.allowed) {
      card("Let's restart!");
      window.setTimeout(reload, 1500);
    } else {
      card('Short break. Please ask the staff.');
    }
  };
  window.addEventListener('error', (e) => restart(`error: ${e.message}`));
  window.addEventListener('unhandledrejection', (e) => restart(`rejection: ${String(e.reason)}`));
  d.canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    restart('webgl context lost');
  });
  window.setInterval(() => {
    if (!document.hidden && performance.now() - d.lastFrameAt() > d.cfg.stallSeconds * 1000) restart('frame loop stalled');
  }, 1000);
  return { restart };
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/app && npx tsc --noEmit`
Expected: PASS; no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/app tests/app
git commit -m "feat(app): add URL params, kiosk hardening, safe storage, watchdog and audio hook"
```

---

### Task 14: Auto quality and the booth self-check screen

**Files:**
- Create: `src/render/quality.ts`, `src/ui/selfcheck.ts`
- Modify: `src/ui/styles.css` (append the self-check styles), `src/vite-env.d.ts` (declare `__BUILD__`), `vite.config.ts` (define `__BUILD__`)
- Test: `tests/render/quality.test.ts`, `tests/ui/selfcheck.test.ts`

**Interfaces:**
- Consumes: `QualityLevel`, `World` (Task 10); `ArtSet` (Task 8); `Run` (Task 6); `Bot`, `BOT_SKILLS` (Task 7); `createRng` (Task 3); `el` (Task 12)
- Produces:
  - `class QualityMonitor { level: QualityLevel; constructor(start?, warmup?, window?); sample(frameSeconds): QualityLevel | null }`
  - `createTouchTest(parent: HTMLElement, onComplete: () => void): HTMLElement`
  - `runSelfCheck(stage: HTMLElement, world: World, art: ArtSet): void`
  - global `__BUILD__: string`

- [ ] **Step 1: Write the failing tests**

`tests/render/quality.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { QualityMonitor } from '../../src/render/quality';

const feed = (m: QualityMonitor, fps: number, seconds: number) => {
  const changes: string[] = [];
  for (let i = 0; i < fps * seconds; i++) {
    const c = m.sample(1 / fps);
    if (c) changes.push(c);
  }
  return changes;
};

describe('QualityMonitor', () => {
  it('keeps high quality on a smooth machine', () => {
    const m = new QualityMonitor();
    expect(feed(m, 60, 20)).toEqual([]);
    expect(m.level).toBe('high');
  });
  it('steps down one level at a time on a so-so machine', () => {
    const m = new QualityMonitor();
    expect(feed(m, 40, 20)).toEqual(['med', 'low']);
  });
  it('drops straight to low on a weak machine', () => {
    const m = new QualityMonitor();
    expect(feed(m, 20, 20)).toEqual(['low']);
  });
  it('ignores the warm-up seconds', () => {
    const m = new QualityMonitor();
    expect(feed(m, 20, 2.5)).toEqual([]);
  });
});
```

`tests/ui/selfcheck.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createTouchTest } from '../../src/ui/selfcheck';

describe('createTouchTest', () => {
  it('turns each of the nine zones green and reports when all were touched', () => {
    const done = vi.fn();
    const grid = createTouchTest(document.body, done);
    const cells = [...grid.querySelectorAll('.sc-cell')];
    expect(cells).toHaveLength(9);
    cells.slice(0, 8).forEach((c) => c.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(done).not.toHaveBeenCalled();
    cells[8].dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(cells.every((c) => c.classList.contains('hit'))).toBe(true);
    expect(done).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/render/quality.test.ts tests/ui/selfcheck.test.ts`
Expected: FAIL. The modules can't be resolved.

- [ ] **Step 3: Write `src/render/quality.ts`**

```ts
import type { QualityLevel } from './world';

/**
 * Watches real frame times after a warm-up and lowers the graphics level until the booth PC
 * holds about 50 fps. It never raises the level again, so the picture doesn't flicker between modes.
 */
export class QualityMonitor {
  level: QualityLevel;
  private elapsed = 0;
  private frames: number[] = [];
  private settled = false;

  constructor(start: QualityLevel = 'high', private readonly warmup = 3, private readonly window = 3) {
    this.level = start;
  }

  /** Feed one real frame duration; returns the new level when it changes. */
  sample(frameSeconds: number): QualityLevel | null {
    if (this.settled) return null;
    this.elapsed += frameSeconds;
    if (this.elapsed < this.warmup) return null;
    this.frames.push(frameSeconds);
    const total = this.frames.reduce((a, b) => a + b, 0);
    if (total < this.window) return null;
    const fps = this.frames.length / total;
    this.frames = [];
    if (fps >= 50) {
      this.settled = true;
      return null;
    }
    const next: QualityLevel = fps < 30 ? 'low' : this.level === 'high' ? 'med' : 'low';
    if (next === this.level) {
      this.settled = true;
      return null;
    }
    this.level = next;
    if (next === 'low') this.settled = true;
    return next;
  }
}
```

- [ ] **Step 4: Declare and define `__BUILD__`**

Append to `src/vite-env.d.ts`:
```ts
declare const __BUILD__: string;
```

Replace `vite.config.ts` with:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')) },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 5: Write `src/ui/selfcheck.ts`**

```ts
import type { ArtSet } from '../assets/manifest';
import { Bot, BOT_SKILLS } from '../core/bot';
import { createRng } from '../core/rng';
import { Run } from '../core/run';
import type { World } from '../render/world';
import { el } from './dom';

/** Full-screen 3×3 grid: every zone must register a touch (IR frames often miss the corners). */
export function createTouchTest(parent: HTMLElement, onComplete: () => void): HTMLElement {
  const grid = el('div', 'sc-grid');
  grid.dataset.ui = '';
  let hits = 0;
  for (let i = 0; i < 9; i++) {
    const cell = el('div', 'sc-cell', String(i + 1));
    cell.addEventListener('pointerdown', () => {
      if (cell.classList.contains('hit')) return;
      cell.classList.add('hit');
      if (++hits === 9) onComplete();
    });
    grid.append(cell);
  }
  parent.append(grid);
  return grid;
}

/** `?check=1`: touch test first, then device facts, live frame rate and art sources over a demo run. */
export function runSelfCheck(stage: HTMLElement, world: World, art: ArtSet): void {
  const panel = el('div', 'selfcheck');
  panel.dataset.ui = '';
  panel.hidden = true;
  const fpsEl = el('dd', '', 'measuring…');
  const touchesEl = el('dd', '', '0');
  const gl = world.renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  const facts: Array<[string, string | HTMLElement]> = [
    ['Build', __BUILD__],
    ['Screen', `${screen.width}×${screen.height} at ${devicePixelRatio}x`],
    ['Window', `${innerWidth}×${innerHeight}`],
    ['Graphics card', gpu],
    ['Touch points supported', String(navigator.maxTouchPoints)],
    ['Touches right now', touchesEl],
    ['Frame rate', fpsEl],
    ['Network', navigator.onLine ? 'online' : 'offline (fine)'],
    ['Offline cache', navigator.serviceWorker?.controller ? 'active' : 'not active (normal for the USB copy)'],
  ];
  const dl = el('dl');
  for (const [k, v] of facts) dl.append(el('dt', '', k), typeof v === 'string' ? el('dd', '', v) : v);
  const artList = el('ul', 'sc-art');
  for (const a of art.list()) artList.append(el('li', a.source, `${a.id}: ${a.source === 'designer' ? 'designer file' : 'placeholder'}`));
  const again = el('button', 'sc-button', 'Repeat touch test');
  again.type = 'button';
  const start = el('button', 'sc-button primary', 'Start the game');
  start.type = 'button';
  start.addEventListener('click', () => {
    location.href = location.pathname;
  });
  panel.append(el('h2', '', 'Booth self-check'), dl, el('h3', '', 'Art'), artList, again, start);
  stage.append(panel);

  const showTouchTest = () => {
    panel.hidden = true;
    const grid = createTouchTest(stage, () => {
      window.setTimeout(() => {
        grid.remove();
        panel.hidden = false;
      }, 400);
    });
  };
  again.addEventListener('click', showTouchTest);
  showTouchTest();

  const active = new Set<number>();
  const show = () => (touchesEl.textContent = String(active.size));
  window.addEventListener('pointerdown', (e) => { active.add(e.pointerId); show(); });
  for (const t of ['pointerup', 'pointercancel']) window.addEventListener(t, (e) => { active.delete((e as PointerEvent).pointerId); show(); });

  let run = new Run({ seed: 1 });
  let bot = new Bot(createRng(1), BOT_SKILLS.skilled);
  world.reset();
  let last = performance.now(), frames = 0, acc = 0;
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    frames++;
    acc += dt;
    if (acc >= 1) {
      fpsEl.textContent = `${Math.round(frames / acc)} fps`;
      frames = 0;
      acc = 0;
    }
    bot.step(run, dt);
    for (const e of run.update(dt)) if (e.kind === 'question') run.answer(true);
    if (run.finished && run.speed < 1) {
      run = new Run({ seed: Math.floor(Math.random() * 1e9) });
      bot = new Bot(createRng(2), BOT_SKILLS.skilled);
      world.reset();
    }
    world.render(run, dt);
  };
  requestAnimationFrame(frame);
}
```

- [ ] **Step 6: Append the self-check styles to `src/ui/styles.css`**

```css
/* Self-check (?check=1) */
.sc-grid { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); gap: 0.6cqmin; padding: 0.6cqmin; background: rgba(29, 20, 17, 0.35); z-index: 5; }
.sc-cell { display: grid; place-items: center; background: rgba(251, 243, 226, 0.85); border-radius: 0.6cqmin; font-family: var(--font-display); font-size: 8cqmin; color: var(--ink); }
.sc-cell.hit { background: rgba(47, 107, 85, 0.9); color: #fff; }
.selfcheck { position: absolute; left: 2cqmin; top: 2cqmin; bottom: 2cqmin; width: min(48cqw, 84cqmin); overflow: auto; touch-action: pan-y; background: var(--paper); padding: 2.4cqmin 3cqmin; border-radius: 0.6cqmin; box-shadow: 0.8cqmin 1cqmin 0 var(--shadow); font-size: 2cqmin; display: grid; gap: 1.2cqmin; align-content: start; z-index: 6; }
.selfcheck h2, .selfcheck h3 { font-family: var(--font-display); font-weight: 400; margin: 0; }
.selfcheck h2 { font-size: 4.4cqmin; }
.selfcheck dl { display: grid; grid-template-columns: auto 1fr; gap: 0.5cqmin 2cqmin; margin: 0; }
.selfcheck dt { color: var(--muted); }
.selfcheck dd { margin: 0; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.sc-art { margin: 0; padding-left: 2.4cqmin; columns: 2; font-size: 1.6cqmin; }
.sc-art .designer { color: var(--green); font-weight: 600; }
.sc-button { font: 600 2.4cqmin var(--font-body); padding: 1.4cqmin; border-radius: 0.6cqmin; border: 0.3cqmin solid var(--ink); background: #fff; color: var(--ink); cursor: pointer; }
.sc-button.primary { background: var(--red); border-color: var(--red); color: #fff; }
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/render/quality.test.ts tests/ui/selfcheck.test.ts && npx tsc --noEmit`
Expected: PASS; no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/render/quality.ts src/ui/selfcheck.ts src/ui/styles.css src/vite-env.d.ts vite.config.ts tests/render/quality.test.ts tests/ui/selfcheck.test.ts
git commit -m "feat: add automatic graphics quality and booth self-check screen"
```

---

### Task 15: Offline delivery: PWA cache and single-file build

**Files:**
- Create: `src/app/updates.ts`, `src/app/pwa-stub.ts`
- Modify: `vite.config.ts` (final version), `src/vite-env.d.ts`, `package.json` (add `build:offline`)

**Interfaces:**
- Consumes: nothing from earlier tasks at runtime (wired in Task 16)
- Produces:
  - `setupUpdates(): void`, `applyUpdateIfReady(): void`
  - npm script `build:offline` → `dist-offline/index.html` (one self-contained file)
  - `npm run build` → `dist/` with `sw.js` precaching everything

- [ ] **Step 1: Install the plugins**

Run: `npm install -E -D vite-plugin-pwa vite-plugin-singlefile`
Expected: installs cleanly (both support Vite 8).

- [ ] **Step 2: Write `src/app/pwa-stub.ts` and `src/app/updates.ts`**

`src/app/pwa-stub.ts`:
```ts
/** The offline single-file build has no service worker; this stands in for `virtual:pwa-register`. */
export function registerSW(_options?: unknown): (reload?: boolean) => Promise<void> {
  return async () => undefined;
}
```

`src/app/updates.ts`:
```ts
import { registerSW } from 'virtual:pwa-register';

let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null;
let ready = false;

/** Registers the service worker that caches the whole game for offline use. */
export function setupUpdates(): void {
  if (!('serviceWorker' in navigator)) return;
  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      ready = true;
    },
  });
}

/** Called on the attract screen: switches to a newly deployed version between players, never mid-run. */
export function applyUpdateIfReady(): void {
  if (ready && applyUpdate) void applyUpdate(true);
}
```

- [ ] **Step 3: Replace `vite.config.ts` with the final version**

```ts
import { fileURLToPath } from 'node:url';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const offline = mode === 'offline';
  return {
    define: { __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')) },
    resolve: offline ? { alias: { 'virtual:pwa-register': fileURLToPath(new URL('./src/app/pwa-stub.ts', import.meta.url)) } } : {},
    build: offline
      ? { outDir: 'dist-offline', assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 100_000 }
      : { outDir: 'dist' },
    plugins: offline
      ? [viteSingleFile()]
      : [
          VitePWA({
            registerType: 'prompt',
            injectRegister: false,
            manifest: false,
            workbox: {
              globPatterns: ['**/*.{js,css,html,png,webp,svg,woff,woff2}'],
              maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
              cleanupOutdatedCaches: true,
            },
          }),
        ],
    test: {
      include: ['tests/**/*.test.ts'],
      environment: 'node',
      alias: { 'virtual:pwa-register': fileURLToPath(new URL('./src/app/pwa-stub.ts', import.meta.url)) },
    },
  };
});
```

- [ ] **Step 4: Add types and the script**

Append to `src/vite-env.d.ts`:
```ts
/// <reference types="vite-plugin-pwa/client" />
```

In `package.json` `scripts`, add:
```json
"build:offline": "tsc --noEmit && vite build --mode offline"
```

- [ ] **Step 5: Build both variants and check them**

Run:
```bash
npm run build && ls dist && npm run build:offline && ls dist-offline && grep -c "<script" dist-offline/index.html
```
Expected: `dist/` contains `index.html`, `sw.js` and `assets/`; `dist-offline/` contains only `index.html` (fonts and art inlined); the script count is ≥ 1 and there are no `src="/assets/` references (`grep -c 'src="/assets' dist-offline/index.html` prints `0`).

- [ ] **Step 6: Run the unit tests**

Run: `npm test`
Expected: PASS (the alias keeps `virtual:pwa-register` resolvable under Vitest).

- [ ] **Step 7: Commit**

```bash
git add vite.config.ts src/app/updates.ts src/app/pwa-stub.ts src/vite-env.d.ts package.json package-lock.json
git commit -m "build: add offline PWA cache and single-file offline build"
```

---

### Task 16: Game controller and app entry

**Files:**
- Create: `src/app/game.ts`
- Modify: `src/main.ts` (final version, full replacement)
- Test: `tests/app/game.test.ts`

**Interfaces:**
- Consumes: `Flow`, `Screen` (Task 11); `FixedStepper`, `startLoop`, `Loop` (Task 11); `Run` (Task 6); `Bot`, `BOT_SKILLS` (Task 7); `pickQuestions`, `updateRecent`, `validateBank` (Task 5); `createRng`, `randomSeed` (Task 3); `tierIndex` (Task 3); `formatPoints` (Task 12); all UI classes (Task 12); `audio` (Task 13); `parseParams`, `installKiosk`, `readJson`, `writeJson`, `installWatchdog`, `shouldRefresh` (Task 13); `QualityMonitor` (Task 14); `runSelfCheck` (Task 14); `setupUpdates`, `applyUpdateIfReady` (Task 15); `createWorld` (Task 10); `loadArt` (Task 8); `attachInput` (Task 10); paint `grainDataUrl` (Task 8)
- Produces:
  - `interface GameWorld`, `interface GameUi`, `interface RecentStore`, `interface GameOptions`
  - `class Game { flow; run; cycles; update(dt); render(frameDt); lane(dir); press() }`
  - `window.__vr = { cycles, screen, errors, contextLost }` in autoplay mode (used by Task 17)

- [ ] **Step 1: Write the failing tests**

`tests/app/game.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { Game, type GameUi, type GameWorld } from '../../src/app/game';
import { CONFIG } from '../../src/config';
import { validateBank } from '../../src/core/questions';
import type { Question } from '../../src/core/types';
import bankJson from '../../src/data/questions.json';

const bank = validateBank(bankJson);

function fakes() {
  const world: GameWorld = { reset: vi.fn(), render: vi.fn(), shake: vi.fn(), playerScreen: () => ({ x: 0.5, y: 0.6 }) };
  const ui = {
    hud: { show: vi.fn(), update: vi.fn() },
    fx: { popup: vi.fn(), flash: vi.fn(), banner: vi.fn(), confetti: vi.fn(), clear: vi.fn() },
    attract: { show: vi.fn(), hide: vi.fn() },
    howto: { showHowto: vi.fn(), showCount: vi.fn(), hide: vi.fn() },
    question: { show: vi.fn(), tick: vi.fn(), reveal: vi.fn(), hide: vi.fn() },
    results: { show: vi.fn(), hide: vi.fn() },
  } satisfies GameUi;
  return { world, ui };
}

function clock(game: Game) {
  let t = 0;
  return {
    now: () => t,
    run(seconds: number, each?: (step: number) => void) {
      for (let i = 0; i < Math.round(seconds * 60); i++) {
        each?.(i);
        game.update(1 / 60);
        t += 1 / 60;
      }
    },
  };
}

describe('Game', () => {
  it('plays complete autoplay rounds back to the attract screen', () => {
    const { world, ui } = fakes();
    const game = new Game({ cfg: CONFIG, bank, world, ui, seed: 3, autoplay: true });
    clock(game).run(150);
    expect(game.cycles).toBeGreaterThanOrEqual(1);
    expect(ui.results.show).toHaveBeenCalled();
    expect(ui.question.show).toHaveBeenCalled();
  });

  it('returns the booth to attract when a player walks away mid-game', () => {
    const { world, ui } = fakes();
    const game = new Game({ cfg: CONFIG, bank, world, ui, seed: 5 });
    game.press();
    clock(game).run(200);
    expect(game.flow.screen).toBe('attract');
    expect(game.cycles).toBe(1);
    expect(ui.question.reveal).toHaveBeenCalledTimes((ui.question.show as ReturnType<typeof vi.fn>).mock.calls.length);
  });

  it('survives frantic tapping: no skipped screens, no early results dismissal', () => {
    const { world, ui } = fakes();
    const game = new Game({ cfg: CONFIG, bank, world, ui, seed: 9 });
    const c = clock(game);
    const resultsAt: number[] = [];
    const attractAt: number[] = [];
    (ui.results.show as ReturnType<typeof vi.fn>).mockImplementation(() => resultsAt.push(c.now()));
    (ui.attract.show as ReturnType<typeof vi.fn>).mockImplementation(() => attractAt.push(c.now()));
    expect(() =>
      c.run(220, (i) => {
        game.press();
        game.lane(i % 2 ? 1 : -1);
      }),
    ).not.toThrow();
    expect(resultsAt.length).toBeGreaterThanOrEqual(1);
    const backToAttract = attractAt.find((t) => t > resultsAt[0]);
    expect(backToAttract).toBeDefined();
    expect(backToAttract! - resultsAt[0]).toBeGreaterThanOrEqual(CONFIG.flow.resultsFallbackSeconds - 0.1);
  });

  it('keeps recent questions away from the next players', () => {
    const { world, ui } = fakes();
    let history: string[][] = [];
    const recent = { read: () => history, write: (h: string[][]) => { history = h; } };
    const game = new Game({ cfg: CONFIG, bank, world, ui, seed: 21, autoplay: true, recent });
    clock(game).run(400);
    expect(game.cycles).toBeGreaterThanOrEqual(2);
    const shown = (ui.question.show as ReturnType<typeof vi.fn>).mock.calls.map((call) => (call[0] as Question).id);
    const perRun = CONFIG.questions.perRun;
    const first = new Set(shown.slice(0, perRun));
    const second = shown.slice(perRun, perRun * 2);
    for (const id of second) expect(first.has(id)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/app/game.test.ts`
Expected: FAIL. `src/app/game` can't be resolved.

- [ ] **Step 3: Write `src/app/game.ts`**

```ts
import type { GameConfig, Tier } from '../config';
import { Bot, BOT_SKILLS } from '../core/bot';
import { pickQuestions, updateRecent } from '../core/questions';
import { createRng, randomSeed } from '../core/rng';
import { Run } from '../core/run';
import { tierIndex } from '../core/scoring';
import type { Question, RunEvent } from '../core/types';
import { formatPoints } from '../ui/labels';
import { audio } from './audio';
import { Flow, type Screen } from './flow';

type At = { x: number; y: number };

export interface GameWorld {
  reset(): void;
  render(run: Run, frameDt: number): void;
  shake(): void;
  playerScreen(): At;
}

export interface GameUi {
  hud: { show(on: boolean): void; update(score: number, progress: number): void };
  fx: {
    popup(text: string, kind: 'plus' | 'minus' | 'neutral', at: At): void;
    flash(): void;
    banner(title: string, sub: string, seconds: number): void;
    confetti(): void;
    clear(): void;
  };
  attract: { show(): void; hide(): void };
  howto: { showHowto(): void; showCount(n: number): void; hide(): void };
  question: {
    show(q: Question, basePoints: number, onPick: (index: number) => void): void;
    tick(fraction: number, secondsLeft: number): void;
    reveal(correct: number, picked: number | null): void;
    hide(): void;
  };
  results: { show(score: number, tiers: readonly Tier[], tierIdx: number, giftUrl: string | null, onDone: () => void): void; hide(): void };
}

export interface RecentStore {
  read(): string[][];
  write(history: string[][]): void;
}

export interface GameOptions {
  cfg: GameConfig;
  bank: readonly Question[];
  world: GameWorld;
  ui: GameUi;
  seed?: number;
  /** The bot plays whole rounds: presses start, answers, and dismisses results by itself. */
  autoplay?: boolean;
  recent?: RecentStore;
  giftUrl?: (tier: number) => string | null;
  /** Called every time the attract screen opens, with the number of finished rounds. */
  onAttract?: (cycles: number) => void;
}

/** Connects the run, the screen flow, the 3D world and the DOM screens. */
export class Game {
  readonly flow: Flow;
  run: Run;
  cycles = 0;
  private seed: number;
  private demoBot: Bot | null = null;
  private playerBot: Bot | null = null;
  private questions: Question[] = [];
  private asked = 0;
  private current: Question | null = null;
  private picked: number | null = null;
  private goTimer = 0;
  private autoTimer = 0;

  constructor(private readonly o: GameOptions) {
    this.seed = o.seed ?? randomSeed();
    this.run = this.newRun();
    this.flow = new Flow(o.cfg, { enter: (s, prev) => this.enter(s, prev), answered: (c) => this.answered(c) });
    this.flow.start();
  }

  /** One fixed simulation step. */
  update(dt: number): void {
    const { ui, cfg } = this.o;
    this.flow.update(dt);
    switch (this.flow.screen) {
      case 'attract':
        this.updateDemo(dt);
        break;
      case 'countdown':
        ui.howto.showCount(Math.ceil(cfg.flow.countdownSeconds - this.flow.elapsed));
        break;
      case 'run':
        if (this.goTimer > 0) {
          this.goTimer -= dt;
          if (this.goTimer <= 0) ui.howto.hide();
        }
        this.playerBot?.step(this.run, dt);
        for (const e of this.run.update(dt)) this.onRunEvent(e);
        break;
      case 'question': {
        const left = this.flow.questionRemaining;
        ui.question.tick(left / cfg.questions.timeLimit, left);
        if (this.o.autoplay && this.flow.elapsed > 1 && this.current) {
          const correct = this.playerBot?.answer() ?? true;
          this.picked = correct ? this.current.answer : (this.current.answer + 1) % 3;
          this.flow.answer(correct);
        }
        break;
      }
      case 'finish':
        this.run.update(dt); // coast to a stop under the banner
        break;
      case 'results':
        if (this.o.autoplay && this.flow.elapsed > 2) this.flow.nextPlayer();
        break;
      default:
        break;
    }
    ui.hud.update(this.run.score, this.run.progress);
  }

  render(frameDt: number): void {
    const frozen = this.flow.screen === 'question' || this.flow.screen === 'feedback';
    this.o.world.render(this.run, frozen ? 0 : frameDt);
  }

  /** Lane input from touch or keys; only the player's own run listens. */
  lane(dir: -1 | 1): void {
    if (this.flow.screen === 'run' && !this.o.autoplay) this.run.move(dir);
  }

  /** Any press on the game surface; only the attract screen reacts (it starts a game). */
  press(): void {
    if (!this.o.autoplay) this.flow.press();
  }

  private newRun(): Run {
    const run = new Run({ seed: this.seed++, config: this.o.cfg });
    this.o.world.reset();
    return run;
  }

  private startDemo(): void {
    this.run = this.newRun();
    this.demoBot = new Bot(createRng(this.seed * 3 + 11), BOT_SKILLS.skilled);
    this.playerBot = null;
  }

  private updateDemo(dt: number): void {
    this.demoBot?.step(this.run, dt);
    for (const e of this.run.update(dt)) if (e.kind === 'question') this.run.answer(true);
    if (this.run.finished && this.run.speed < 1) this.startDemo();
    if (this.o.autoplay) {
      this.autoTimer += dt;
      if (this.autoTimer > 1) {
        this.autoTimer = 0;
        this.flow.press();
      }
    }
  }

  private enter(s: Screen, prev: Screen): void {
    const { ui, cfg } = this.o;
    switch (s) {
      case 'attract':
        ui.results.hide();
        ui.question.hide();
        ui.howto.hide();
        ui.hud.show(false);
        ui.fx.clear();
        this.autoTimer = 0;
        this.startDemo();
        ui.attract.show();
        if (prev === 'results') this.cycles++;
        this.o.onAttract?.(this.cycles);
        break;
      case 'howto':
        ui.attract.hide();
        ui.fx.clear();
        this.demoBot = null;
        this.run = this.newRun();
        this.playerBot = this.o.autoplay ? new Bot(createRng(this.seed * 7 + 1), BOT_SKILLS.average) : null;
        this.questions = pickQuestions(createRng(this.seed * 13 + 5), this.o.bank, cfg.questions.perRun, (this.o.recent?.read() ?? []).flat());
        this.asked = 0;
        ui.howto.showHowto();
        ui.hud.update(0, 0);
        ui.hud.show(true);
        break;
      case 'countdown':
        ui.howto.showCount(Math.ceil(cfg.flow.countdownSeconds));
        break;
      case 'run':
        if (prev === 'countdown') {
          ui.howto.showCount(0);
          this.goTimer = 0.7;
        } else {
          ui.question.hide();
          ui.fx.popup('Go!', 'neutral', this.o.world.playerScreen());
        }
        break;
      case 'question': {
        this.current = this.questions[this.asked] ?? null;
        this.picked = null;
        const item = this.run.pending;
        if (!this.current || !item) {
          this.flow.answer(true);
          break;
        }
        this.asked++;
        audio.play('question');
        const q = this.current;
        ui.question.show(q, cfg.items[item.type].points, (i) => {
          this.picked = i;
          this.flow.answer(i === q.answer);
        });
        break;
      }
      case 'feedback':
        if (this.current) ui.question.reveal(this.current.answer, this.picked);
        break;
      case 'finish':
        audio.play('finish');
        ui.fx.banner('Finish!', `${this.run.score} points`, cfg.flow.finishSeconds);
        ui.fx.confetti();
        if (this.o.recent) {
          const used = this.questions.slice(0, this.asked).map((q) => q.id);
          this.o.recent.write(updateRecent(this.o.recent.read(), used, cfg.questions.recentRuns));
        }
        break;
      case 'results': {
        ui.hud.show(false);
        const tier = tierIndex(this.run.score, cfg.tiers);
        ui.results.show(this.run.score, cfg.tiers, tier, this.o.giftUrl?.(tier) ?? null, () => this.flow.nextPlayer());
        break;
      }
    }
  }

  private answered(correct: boolean): void {
    for (const e of this.run.answer(correct)) {
      if (e.kind !== 'answer') continue;
      this.o.ui.fx.popup(e.points > 0 ? formatPoints(e.points) : 'No points', e.points > 0 ? 'plus' : 'neutral', this.o.world.playerScreen());
    }
  }

  private onRunEvent(e: RunEvent): void {
    const { ui, world } = this.o;
    switch (e.kind) {
      case 'collect':
        audio.play('collect');
        ui.fx.popup(formatPoints(e.points), 'plus', world.playerScreen());
        break;
      case 'hit':
        audio.play('hit');
        ui.fx.popup(formatPoints(e.points), 'minus', world.playerScreen());
        ui.fx.flash();
        world.shake();
        break;
      case 'question':
        this.flow.questionAsked();
        break;
      case 'finish':
        this.flow.runFinished();
        break;
      default:
        break;
    }
  }
}
```

- [ ] **Step 4: Run the game tests to verify they pass**

Run: `npx vitest run tests/app/game.test.ts`
Expected: PASS.

- [ ] **Step 5: Replace `src/main.ts` with the final app entry**

```ts
import '@fontsource/federo';
import '@fontsource/albert-sans/400.css';
import '@fontsource/albert-sans/600.css';
import './ui/styles.css';
import { Game } from './app/game';
import { installKiosk } from './app/kiosk';
import { FixedStepper, startLoop, type Loop } from './app/loop';
import { parseParams } from './app/params';
import { readJson, writeJson } from './app/storage';
import { applyUpdateIfReady, setupUpdates } from './app/updates';
import { installWatchdog, shouldRefresh } from './app/watchdog';
import { loadArt } from './assets/manifest';
import { CONFIG } from './config';
import { validateBank } from './core/questions';
import { BAD_TYPES, GOOD_TYPES, type ItemType } from './core/types';
import bankJson from './data/questions.json';
import { attachInput } from './input/touch';
import * as P from './render/placeholders/paint';
import { QualityMonitor } from './render/quality';
import { createWorld } from './render/world';
import { AttractScreen } from './ui/attract';
import { Fx } from './ui/fx';
import { HowtoScreen } from './ui/howto';
import { Hud } from './ui/hud';
import { QuestionScreen } from './ui/question';
import { ResultsScreen } from './ui/results';
import { runSelfCheck } from './ui/selfcheck';

const RECENT_KEY = 'vienna-run:recent-questions';
const isRecent = (v: unknown): v is string[][] => Array.isArray(v) && v.every((r) => Array.isArray(r) && r.every((x) => typeof x === 'string'));

async function boot(): Promise<void> {
  const params = parseParams(location.search);
  installKiosk(document, { hideCursor: !params.cursor && !params.check });

  const stage = document.createElement('div');
  stage.id = 'stage';
  const canvas = document.createElement('canvas');
  stage.append(canvas);
  for (const cls of ['vignette', 'grain']) {
    const layer = document.createElement('div');
    layer.className = `overlay-fx ${cls}`;
    if (cls === 'grain') {
      const url = P.grainDataUrl();
      if (url) layer.style.backgroundImage = `url(${url})`;
    }
    stage.append(layer);
  }
  document.body.append(stage);

  let loop: Loop | null = null;
  installWatchdog({ cfg: CONFIG.watchdog, canvas, lastFrameAt: () => loop?.lastFrameAt() ?? performance.now() });
  setupUpdates();

  const art = await loadArt();
  const world = createWorld(canvas, art, CONFIG.laneWidth);
  const fit = () => world.resize(stage.clientWidth, stage.clientHeight);
  fit();
  new ResizeObserver(fit).observe(stage);
  if (params.quality) world.setQuality(params.quality);
  if (params.check) {
    runSelfCheck(stage, world, art);
    return;
  }

  const icons = Object.fromEntries([...GOOD_TYPES, ...BAD_TYPES].map((t) => [t, art.get(`item-${t}`).toDataURL()])) as Record<ItemType, string>;
  const ui = {
    hud: new Hud(stage, 'Stephansplatz → Riesenrad'),
    fx: new Fx(stage),
    attract: new AttractScreen(stage, CONFIG, icons, art.url('logo')),
    howto: new HowtoScreen(stage),
    question: new QuestionScreen(stage),
    results: new ResultsScreen(stage, CONFIG.flow.holdSeconds * 1000),
  };
  const bootedAt = performance.now();
  const game = new Game({
    cfg: CONFIG,
    bank: validateBank(bankJson),
    world,
    ui,
    seed: params.seed,
    autoplay: params.autoplay,
    giftUrl: (tier) => art.url(`gift-${tier}`),
    recent: { read: () => readJson(RECENT_KEY, [], isRecent), write: (h) => writeJson(RECENT_KEY, h) },
    onAttract: (cycles) => {
      applyUpdateIfReady();
      if (!params.autoplay && shouldRefresh(cycles, performance.now() - bootedAt, CONFIG.watchdog)) location.reload();
    },
  });

  attachInput(stage, CONFIG.input, { onLane: (d) => game.lane(d), onPress: () => game.press() });
  const monitor = params.quality ? null : new QualityMonitor('high');
  const stepper = new FixedStepper(1 / 60, params.speed);
  loop = startLoop(
    stepper,
    (dt) => game.update(dt),
    (sec) => {
      const level = monitor?.sample(sec);
      if (level) world.setQuality(level);
      game.render(Math.min(sec, 0.1) * params.speed);
    },
  );
  if (params.autoplay) exposeDebugHook(game, canvas);
}

/** Read by the Playwright smoke and soak tests (autoplay mode only). */
function exposeDebugHook(game: Game, canvas: HTMLCanvasElement): void {
  const hook = { cycles: 0, screen: 'attract' as string, errors: [] as string[], contextLost: false };
  (window as unknown as { __vr: typeof hook }).__vr = hook;
  window.addEventListener('error', (e) => hook.errors.push(e.message));
  canvas.addEventListener('webglcontextlost', () => {
    hook.contextLost = true;
  });
  window.setInterval(() => {
    hook.cycles = game.cycles;
    hook.screen = game.flow.screen;
  }, 250);
}

void boot();
```

- [ ] **Step 6: Run everything and play it**

Run: `npm test && npm run build`
Expected: every test passes; the build succeeds.

Then play it by hand: `npm run dev`, open `http://localhost:5173/?cursor=1`. Click to start, use ← → to change lanes, answer a question, finish, and hold "Hold for next player" for 1 second. Then open `http://localhost:5173/?autoplay=1&speed=4` and watch two rounds play themselves. Finally open `http://localhost:5173/?check=1` and touch all nine zones.
Expected: every screen appears in order, the HUD counts points, the tray stacks treats, the results show the right tier, and the self-check lists every art file as "placeholder".

- [ ] **Step 7: Commit**

```bash
git add src/app/game.ts src/main.ts tests/app/game.test.ts
git commit -m "feat: wire the full booth game loop with screens, watchdog and auto quality"
```

---

### Task 17: End-to-end smoke, soak and offline tests

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/smoke.spec.ts`, `tests/e2e/soak.spec.ts`, `tests/e2e/offline.spec.ts`
- Modify: `package.json` (add `e2e`, `soak` scripts)

**Interfaces:**
- Consumes: `window.__vr` (Task 16); `npm run build`, `npm run preview`, `npm run build:offline` (Tasks 1 and 15)
- Produces: `npm run e2e` (smoke + offline + a 20-round soak); `npm run soak` (200 rounds)

- [ ] **Step 1: Install Playwright**

Run: `npm install -E -D @playwright/test && npx playwright install chromium`
Expected: Chromium downloads.

- [ ] **Step 2: Write `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 10 * 60_000,
  workers: 1,
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1600, height: 900 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'] },
  },
  webServer: { command: 'npm run build && npm run preview', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 180_000 },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
```

- [ ] **Step 3: Write the tests**

`tests/e2e/smoke.spec.ts`:
```ts
import { expect, test } from '@playwright/test';

test('boots, plays a full round by itself and returns to attract without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/?autoplay=1&speed=8&seed=7');
  await page.waitForFunction(() => (window as any).__vr?.cycles >= 1, null, { timeout: 180_000 });
  await page.screenshot({ path: 'test-results/smoke.png' });
  expect(errors).toEqual([]);
});

test('the hosted build keeps working after the network drops', async ({ page, context }) => {
  await page.goto('/?autoplay=1&speed=8');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => (window as any).__vr?.cycles >= 1, null, { timeout: 180_000 });
});
```

`tests/e2e/soak.spec.ts`:
```ts
import { expect, test } from '@playwright/test';

const ROUNDS = Number(process.env.SOAK_ROUNDS ?? 20);

test(`survives ${ROUNDS} back-to-back rounds without errors, reloads or leaks`, async ({ page }) => {
  test.setTimeout(ROUNDS * 60_000 + 300_000);
  const errors: string[] = [];
  let loads = 0;
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('load', () => loads++);
  await page.goto('/?autoplay=1&speed=8');
  await page.waitForFunction(() => (window as any).__vr?.cycles >= 2, null, { timeout: 300_000 });
  const heapStart: number = await page.evaluate(() => (performance as any).memory?.usedJSHeapSize ?? 0);
  await page.waitForFunction((n) => (window as any).__vr?.cycles >= n, ROUNDS, { timeout: ROUNDS * 60_000 });
  const heapEnd: number = await page.evaluate(() => (performance as any).memory?.usedJSHeapSize ?? 0);
  const state = await page.evaluate(() => (window as any).__vr);
  expect(errors).toEqual([]);
  expect(loads).toBe(1); // no watchdog reloads
  expect(state.contextLost).toBe(false);
  if (heapStart > 0) expect(heapEnd).toBeLessThan(heapStart * 1.5);
});
```

`tests/e2e/offline.spec.ts`:
```ts
import { execSync } from 'node:child_process';
import path from 'node:path';
import { expect, test } from '@playwright/test';

test.beforeAll(() => {
  execSync('npm run build:offline', { stdio: 'inherit' });
});

test('the USB single-file copy runs from disk with no network at all', async ({ page, context }) => {
  await context.setOffline(true);
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => { if (!/^(file|data|blob):/.test(r.url())) external.push(r.url()); });
  await page.goto(`file://${path.resolve('dist-offline/index.html')}?autoplay=1&speed=8&seed=3`);
  await page.waitForFunction(() => (window as any).__vr?.cycles >= 1, null, { timeout: 180_000 });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
```

- [ ] **Step 4: Add the scripts**

In `package.json` `scripts`, add:
```json
"e2e": "playwright test",
"soak": "SOAK_ROUNDS=200 playwright test tests/e2e/soak.spec.ts"
```

- [ ] **Step 5: Run the end-to-end suite**

Run: `npm run e2e`
Expected: 4 tests pass (smoke, offline network drop, USB copy, 20-round soak). Runtime is a few minutes.

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts tests/e2e package.json package-lock.json
git commit -m "test: add Playwright smoke, offline and soak tests"
```

- [ ] **Step 7: Run the long soak once before the event**

Run: `npm run soak`
Expected: 200 rounds pass with zero errors, no reloads and bounded memory. (Roughly 25–40 minutes.)

---

### Task 18: Booth delivery: launchers, setup checklist, README and deploy

**Files:**
- Create: `kiosk/launch-online.bat`, `kiosk/launch-offline.bat`, `kiosk/OFFLINE-README.txt`, `docs/SETUP_CHECKLIST.md`, `README.md`
- Modify: `package.json` (add `package:offline`)

**Interfaces:**
- Consumes: `npm run build`, `npm run build:offline` (Task 15); URL params (Task 13); self-check (Task 14); simulator (Task 7)
- Produces: `vienna-run-offline.zip` (USB copy) and a Vercel production URL

- [ ] **Step 1: Write the launchers**

`kiosk/launch-online.bat`:
```bat
@echo off
rem Vienna Run kiosk launcher (hosted version, works offline after the first load).
rem Set URL to the production address printed by "npx vercel --prod".
set URL=https://vienna-run.vercel.app
start "" msedge --kiosk "%URL%" --edge-kiosk-type=fullscreen --no-first-run --disable-pinch --overscroll-history-navigation=0 --user-data-dir="%LOCALAPPDATA%\ViennaRunKiosk"
```

`kiosk/launch-offline.bat`:
```bat
@echo off
rem Vienna Run kiosk launcher (USB copy). Keep this file next to index.html.
start "" msedge --kiosk "%~dp0index.html" --edge-kiosk-type=fullscreen --no-first-run --disable-pinch --overscroll-history-navigation=0 --user-data-dir="%LOCALAPPDATA%\ViennaRunKioskOffline"
```

`kiosk/OFFLINE-README.txt`:
```
Vienna Run: offline copy

1. Copy this whole folder to the booth PC (for example C:\vienna-run).
2. Double-click launch-offline.bat. The game opens full screen in Microsoft Edge.
3. To leave the game: press Alt+F4.
4. Booth check: open index.html with ?check=1 at the end of the address
   (or press Alt+F4, then run: msedge "C:\vienna-run\index.html?check=1").

No internet is needed. Nothing is installed.
```

- [ ] **Step 2: Write `docs/SETUP_CHECKLIST.md`**

```markdown
# Booth setup checklist (about 10 minutes)

Do these on the booth PC on setup day, in order.

## Windows
1. **Display:** Settings → System → Display. Native resolution, scale **100%**, landscape.
2. **Edge swipes off** (stops the Windows sidebars sliding in from the screen edges):
   - With admin rights: run `gpedit.msc` → Computer Configuration → Administrative Templates →
     Windows Components → Edge UI → "Allow edge swipe" → **Disabled**.
   - Without gpedit: in an admin command prompt run
     `reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\EdgeUI" /v AllowEdgeSwipe /t REG_DWORD /d 0 /f`
   - Sign out and back in.
3. **Notifications off:** Settings → System → Notifications → Do not disturb **on**.
4. **Never sleep:** Settings → System → Power → Screen and sleep → **Never** (plugged in). Screen saver off.
5. **Windows Update:** Settings → Windows Update → **Pause updates** for 1 week.
6. **Touch:** Settings → Bluetooth & devices → Touch / Pen → turn off "press and hold for right-click"
   if offered; Settings → Time & language → Typing → Touch keyboard → don't show automatically.
7. **Volume:** muted (the game is silent).

## Game
8. Copy `vienna-run-offline.zip` to the PC, unzip to `C:\vienna-run`.
   If the venue Wi-Fi is decent, also run `launch-online.bat` once while online (that version updates itself).
9. Run the self-check: open the game with `?check=1` (see `OFFLINE-README.txt`).
   - Touch all 9 squares, especially the corners. All must turn green.
   - Frame rate should read **50 fps or more** after a few seconds (lower is OK: the game reduces detail by itself).
10. Press **Start the game** and play **3 full rounds** yourself: tap both sides, answer a question,
    let one question time out, hold "Hold for next player".
11. Optional: Startup folder (`Win+R` → `shell:startup`), drop a shortcut to the launcher there,
    so the game comes back by itself after a restart.

## During the event
- Stuck or frozen? Press **Alt+F4** and start the launcher again. The game also restarts itself on errors.
- "Short break. Please ask the staff." means it restarted 5 times within 2 minutes. Restart the launcher;
  if it repeats, switch to the other launcher (online ↔ offline).
```

- [ ] **Step 3: Write `README.md`**

````markdown
# Vienna Run

A 40-second Vienna-themed booth runner: tap left/right to switch lanes, grab Viennese treats, dodge Krampus
and bombs, answer surprise questions for double points, and win a gift by score tier.

- Design spec: `docs/superpowers/specs/2026-10-03-vienna-run-design.md`
- Art brief for the designer: `docs/ASSET_SPEC.md`
- Booth setup: `docs/SETUP_CHECKLIST.md`

## Commands
| Command | What it does |
|---|---|
| `npm run dev` | Local dev server at http://localhost:5173 |
| `npm test` | Unit tests (rules, flow, UI, storage, watchdog) |
| `npm run simulate` | Plays thousands of bot rounds and writes `docs/simulation-report.md` (gift tier shares) |
| `npm run build` | Hosted build in `dist/` (works offline after first load) |
| `npm run build:offline` | One self-contained `dist-offline/index.html` |
| `npm run package:offline` | `vienna-run-offline.zip` for the USB stick |
| `npm run e2e` | Browser tests: smoke, offline, 20-round soak |
| `npm run soak` | 200-round soak test (run once before the event) |

## URL switches
`?check=1` booth self-check · `?autoplay=1` the bot plays whole rounds · `?speed=8` fast-forward ·
`?seed=7` fixed item layout · `?quality=low|med|high` force graphics level · `?cursor=1` show the mouse.

## Changing things
- **Points, timings, gift tiers:** `src/config.ts`. After changing tiers, run `npm run simulate` to see how many players land in each tier.
- **Questions:** `src/data/questions.json`. Put the right answer first; the game shuffles. `npm test` validates the file.
- **Route and landmarks:** `src/core/route.ts`.
- **Art:** drop files named as in `docs/ASSET_SPEC.md` into `src/assets/art/`. Anything missing stays a placeholder.
````

- [ ] **Step 4: Add the packaging script and build the USB copy**

In `package.json` `scripts`, add:
```json
"package:offline": "npm run build:offline && cp kiosk/launch-offline.bat kiosk/OFFLINE-README.txt dist-offline/ && cd dist-offline && zip -qr ../vienna-run-offline.zip ."
```

Run: `npm run package:offline && unzip -l vienna-run-offline.zip`
Expected: the zip lists `index.html`, `launch-offline.bat`, `OFFLINE-README.txt`.

- [ ] **Step 5: Commit**

```bash
git add kiosk docs/SETUP_CHECKLIST.md README.md package.json
git commit -m "docs: add kiosk launchers, booth setup checklist and README"
```

- [ ] **Step 6: Deploy to Vercel (needs the user's account; confirm with the user first)**

Ask the user to log in by typing `! npx vercel login` in the prompt. Then run:
```bash
npx vercel --prod
```
Expected: a production URL is printed. Put it in `kiosk/launch-online.bat` (the `set URL=` line). Open
`<url>/?check=1` once to confirm it loads, then commit:
```bash
git add kiosk/launch-online.bat
git commit -m "chore: point the online launcher at the production URL"
```

---

## Self-review notes

- **Spec coverage:** every spec section maps to a task. Decisions table → Tasks 3–16. Game design → Tasks 4–7, 11, 12, 16. Visual approach → Tasks 8–10. Art requirements → Tasks 2 and 8. Architecture → all tasks. Reliability → Tasks 13–17. Delivery → Tasks 15 and 18. Verification → Tasks 7, 16 and 17. The spec's "4× CPU throttle" performance check is the manual part of Task 14's verification: run `?autoplay=1` with DevTools → Performance → CPU 4× slowdown and confirm the picture stays smooth after the quality drop.
- **Deliberate deviations:** question window ends at 30 s (see Global Constraints); finish banner copy is the English "Finish!" (the street banner art keeps "ZIEL · FINISH").
- **Inputs still needed from the user:** gift names and stock (then `npm run simulate` and adjust `tiers`), designer art, a review of `src/data/questions.json`, and the Vercel login (Task 18).
