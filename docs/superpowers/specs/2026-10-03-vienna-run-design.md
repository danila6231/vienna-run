# Vienna Run — booth game MVP design

Status: design agreed 2026-10-03. Visual style chosen after the three-way prototype comparison
(`docs/prototypes/style-test.html`, option A).

## Context
A Vienna-themed event booth with a basic landscape touchscreen (most likely a Windows PC).
Visitors play a ~40s Temple-Run-style 3-lane runner as a Viennese waiter, collect Viennese
treats, dodge Krampus masks and bombs, answer surprise quiz questions for double points, and
receive a physical gift based on their score tier. **Top priority: it must never crash or look
broken in front of visitors.** The event is 1–3 weeks out; the real hardware is available only on
setup day.

## Decisions
| Topic | Decision |
|---|---|
| Visual style | **Pop-up diorama 2.5D**: Three.js street, all art is flat paper-cutout PNGs |
| Screen | Landscape 16:9, designed at 1920×1080, scales to fit |
| Platform | Booth touchscreen only (no phone/QR play) |
| Stack | Vite + TypeScript + Three.js, no UI framework; DOM/CSS overlays for UI |
| Controls | Tap left/right half = one lane; swipe also works; arrow keys for dev |
| Questions | 3 per run (config allows 4), 3 answer choices, 10s timer, run pauses |
| Question trigger | Fixed count per player; secret time slots, the next collected good item asks |
| Double points | That item counts 2× if the answer is right; 0 if wrong or timed out |
| Runner | Viennese waiter (Herr Ober) with a silver tray; collected items stack on the tray |
| Bad items | Krampus mask (devil) + cartoon bomb |
| Language | English only |
| Gifts | Everyone gets something (tier 0 from 0 pts); thresholds in config |
| End flow | Results stay up until staff **hold** "Next player" (1s); 60s fallback to attract |
| Staff panel | None; everything lives in `src/config.ts` |
| Sound | Silent MVP; a no-op `audio.play(id)` hook for later |
| Art | Placeholders now (ported from the prototype); designer art later, as PNGs |
| Delivery | Both: Vercel-hosted PWA (offline cache) **and** single-file offline copy + launcher |
| Hardware access | Setup day only → self-check screen, auto quality fallback, setup checklist |

Out of scope (later): leaderboard, mystery box, sound/music, staff panel, German UI, phone play.

## Game design

**Screen flow (state machine):**
Attract → (tap anywhere) → How-to (3s) + 3-2-1 → Run ⇄ Question → Finish → Results →
(hold "Next player" or 60s) → Attract.
Every state ends on its own (the run always ends at ~40s; an unanswered question times out;
results fall back after 60s), so a walk-away player never leaves the booth stuck.

- **Attract:** the autopilot bot runs the waiter through the street behind a "Tap anywhere to play"
  card; shows item values and the gift ladder.
- **Run (~40s, 600 m):**
  - Speed ramps from 14 m/s up to 1.25× by the finish.
  - HUD: score, plus a route progress bar ending at the Riesenrad.
- **Route (authored, not random):** Stephansplatz (Stephansdom) → Ring tram stop → Karlskirche →
  Hofburg → finish arch beside the Riesenrad.
  - Landmarks sit in side plazas where the facade rows break.
  - The route is a list in `route.ts`, so it's easy to reorder.
- **Items:** a seeded spawner places patterns (lines, zigzags, single items, bad items with a
  good item in another lane).
  - Never block all 3 lanes; keep the 35 m before the finish clear.
  - Good: Sachertorte 15, Kipferl 10, Melange 5, Mozartkugel 5.
  - Bad: Krampus −10, bomb −15.
  - The score never drops below 0.
- **Feedback:**
  - Good item: a "+N" popup, and the item flies onto the tray stack.
  - Bad item: the waiter wobbles, the top tray item falls off, the screen shakes, a red edge
    flash and a "−N" popup.
- **Questions:**
  - `questionsPerRun` slots sit at random times between 4s and 35s, at least 7s apart. Once a
    slot opens, the next good item collected triggers the question.
  - The world freezes and dims. The overlay says "Bonus question! Right answer = double
    (10 → 20)" and shows a 10s ring timer and 3 buttons (≥120px tall at 1080p).
  - A right/wrong flash for 1.5s highlights the correct answer, then "Go!".
  - No repeats within a run. Questions used in the last 5 runs are excluded (localStorage,
    try/catch). Answer order is shuffled.
- **Finish:** the waiter runs under the "ZIEL · FINISH" banner, confetti, the camera slows.
- **Results:** large score, the gift card for the reached tier, and the full tier ladder with the
  reached tier highlighted (readable by staff from a distance). A small "Hold for next player"
  button sits bottom-right.
- **Tiers (placeholder):**
  - 0 = small treat
  - 80 = gift B
  - 100 = gift C
  - 120 = gift D
  - Final thresholds are set with the simulator once the gift inventory is known.

## Visual approach (pop-up diorama)
The prototype (`docs/prototypes/style-test.html`, option A) is the visual reference. Its
placeholder painters and camera rig get ported into the real project.

- **Camera:** a Three.js perspective camera (FOV 50) behind and above the runner, following the
  lane softly. Fog for depth; a painted sky gradient.
- **Street:** the cobblestone road and sidewalks are tiling textures that scroll.
- **Facade cards:** pooled planes facing the road (8 m × 12 m), recycled behind the camera,
  plus a hazier back row (10 m × 16 m).
- **Landmarks:** cards angled toward the road in plaza gaps. The Riesenrad is three parts: a
  rotating wheel, cabins that stay upright, and a static support.
- **Items and runner:** billboards (sprites) with blob shadows.
- **Cutouts:** use alpha cutoff (`alphaTest` 0.5), not soft blending, so there are no sorting
  artifacts.
- **Paper edge:** a white paper border and soft offset shadow are added in code to every
  cutout, so all art shares one finish.
- **Overlays:** paper grain and a warm vignette, as CSS on top of the canvas.

## Art & asset requirements
**Everything is a flat 2D image. No 3D models.** The 3D effect, perspective, motion, Riesenrad
rotation, bobbing and shadows come from code. `docs/ASSET_SPEC.md` is the designer-facing
version of this section (written in M1 so the designer can start early).

**Technical rules for every image:**
- **Format:** PNG-24 with transparency, sRGB, straight (non-premultiplied) alpha. The build
  converts to WebP.
- **Hard edges:** cutouts are rendered with an alpha cutoff. Semi-transparent glows, soft drop
  shadows and feathered edges inside the PNG get clipped, so they're not allowed.
- **Leave out:** no paper border, no drop shadow, no ground shadow. Code adds all three
  consistently. If the designer wants a hand-drawn edge, we switch the automatic one off.
- **View:** flat, front-on elevation. No perspective or vanishing points; the camera adds
  perspective.
- **Light:** one direction for all art, from the upper left.
- **Ink:** consistent outline weight, about 3–4 px of dark brown ink at 1024 px.
- **Size:** max 2048 px on any side (weak booth GPUs).
- **Budget:** about 12 MB of PNGs in total, because the offline single-file build inlines
  everything.
- **Naming:** `kebab-case`, as in the list below. Drop the files into `src/assets/art/` and edit
  one line in `src/assets/manifest.ts`.

| Asset | Count | Pixel size | Notes |
|---|---|---|---|
| Street facade `facade-NN.png` | 6–8 | 1024×1536 (2:3 = 8 m × 12 m) | Ground floor touches the bottom edge, straight left/right edges (they join into a continuous street), transparent sky above an interesting roofline (gables, domes, statues). Varied shop signs. |
| Back-row building `back-NN.png` | 4–6 | 640×1024 (5:8) | Simpler, lower contrast; code adds haze. |
| Landmark `landmark-<id>.png` | 5 | long side 2048, any aspect | Stephansdom, Karlskirche, Hofburg, Ring tram (side view, ~4:1), plus others as the route changes. |
| Riesenrad, three parts | 3 | wheel 2048² square; cabin 256²; support 2048×1460 | The wheel is drawn without cabins (it rotates); the cabin hangs upright and is placed in code; the support's hub point is top-center. |
| Item `item-<type>.png` | 6 | 512×512 | Object fills about 70%, centered, 3/4 front view. Must read at 60–90 px on screen. Good items warm and appetizing; bad items (Krampus, bomb) dark/red, instantly "bad". |
| Waiter frames `waiter-<pose>-NN.png` | 10–12 | 512×768 per frame | Seen from behind. Run cycle 6–8 frames, stumble 2, celebrate 1–2. Feet at the same bottom-center point in every frame, and the tray center at the same marked pixel (items stack there). Single PNGs or a same-cell sprite sheet. |
| Street props `prop-<id>.png` | 2–4 | long side 512–1024 | Lamppost (required); optional Litfaßsäule, bench, Fiaker. |
| Road and sidewalk textures | 2 | 1024×1024 and 512×512 | **Seamless tiling**, no transparency. Lane markings are drawn in code. |
| Sky, skyline, clouds | 1 + 1 + 3 | sky 2048×1024; skyline 4096×512 (transparent above); clouds 512×256 | The skyline sits far away behind haze, so a low-contrast silhouette is fine. |
| Finish banner | 1 | 1024×200 | "ZIEL · FINISH"; the checkered strip is drawn in code. |
| UI: logo, gift cards | 1 + 1 per tier | logo as SVG; gift cards 512×512 PNG | Shown in HTML, not in 3D. Brand fonts as WOFF2 with a web license. |

## Architecture
```
vienna-run/
  src/
    config.ts          # ALL tunables: run length, speeds, item values, tiers, question count
    core/              # pure TS — no DOM, no Three.js; deterministic; fully unit-tested
      rng.ts           # seeded PRNG
      route.ts         # authored route: landmarks, plaza zones, finish
      spawner.ts       # seeded item placement with fairness constraints
      run.ts           # run state: update(dt, input) → events (collect, hit, questionDue, finish)
      scoring.ts       # values, doubling, floor-at-0, tier lookup
      questions.ts     # scheduler (time slots) + picker (no repeats, recent-run exclusion)
      bot.ts           # autopilot (attract demo, soak tests, simulator)
    render/            # Three.js only; consumes core state
      scene.ts street.ts billboards.ts runner.ts landmarks.ts effects.ts quality.ts
      paper.ts         # paper-edge + shadow post-process for any cutout
      placeholders/    # canvas painters ported from the prototype
    ui/                # DOM overlays + CSS
      attract.ts howto.ts hud.ts question.ts results.ts selfcheck.ts
    input/touch.ts     # pointer events: tap halves + swipe, primary pointer only
    app/
      main.ts          # screen-flow FSM, fixed-timestep loop (60Hz update, render interpolation)
      kiosk.ts         # block zoom/context menu/selection/gestures, hide cursor
      watchdog.ts      # error → soft reset; stall/context-loss → reload; periodic refresh
      audio.ts         # no-op hook
    data/questions.json  # ~30 Qs: {id, q, options[3], answer}
    assets/manifest.ts   # asset id → designer PNG or placeholder painter
    assets/art/          # designer PNGs (empty at first)
  scripts/simulate.ts  # N bot runs per skill profile → score histogram + % per tier
  tests/               # vitest (core) + playwright (smoke + soak)
  kiosk/launch-online.bat, launch-offline.bat
  docs/ASSET_SPEC.md, docs/SETUP_CHECKLIST.md, docs/prototypes/style-test.html
```
- **Data flow:** input → `core/run` (pure) → events → `render` and `ui` subscribe.
- **Boundary:** core never imports render or ui, so the simulator and tests run headless.
- **Manifest:** when a designer PNG exists for an ID, the manifest uses it; otherwise it falls
  back to the placeholder painter. Art arrives piece by piece without breaking anything.

**Debug URL params:**
- `?seed=` fixes the item layout.
- `?bot=1` turns on autopilot.
- `?speed=N` speeds up time.
- `?quality=low|med|high` forces a graphics level.
- `?check=1` opens the self-check screen.
- `?cursor=1` shows the mouse cursor.

## Reliability & kiosk hardening
- **No runtime network:** all assets are preloaded before Attract shows. The PWA precaches
  everything (vite-plugin-pwa); the offline build inlines everything (vite-plugin-singlefile;
  assets imported from `src/`, not `public/`).
- **PWA updates** apply only while on Attract, never mid-run.
- **Errors:**
  - `error`/`unhandledrejection` → log to a localStorage ring buffer → a 1.5s "Let's restart!"
    card → `location.reload()`.
  - Reload-loop guard (>5 reloads in 2 min) → a static "Short break — please ask staff" screen.
- **Watchdogs:**
  - `webglcontextlost` → reload.
  - Frame heartbeat (no frame for 5s while visible) → reload.
  - Preventive reload on Attract every 25 runs or 2h.
- **Performance:**
  - Object pools for items, facades and popups; no per-frame allocations in hot paths.
  - Exact-pinned dependencies plus a lockfile.
  - Auto quality tiers (pixel ratio, facade density, fog, antialias), picked from the frame
    rate measured during Attract.
- **In-page kiosk:**
  - CSS: `touch-action:none; user-select:none; overscroll-behavior:none`; cursor hidden.
  - Block `contextmenu` (a long press is a right-click on Windows touch), `dragstart`,
    ctrl+wheel and ctrl± zoom, and `gesturestart`.
  - Ignore non-primary pointers. Resolve a gesture on pointerup (swipe if horizontal movement is
    over 35px, else tap by screen half), with a 300ms fallback when an IR frame drops pointerup.
- **Self-check (`?check=1`):**
  - Frame rate, GPU renderer string, resolution and pixel ratio.
  - 9-zone touch grid plus a multi-touch count.
  - Asset status, build version, service-worker status.

## Delivery
- `npm run build` → `dist/` → Vercel (PWA). Open once while online; it works offline after that.
- `npm run build:offline` → `dist-offline/index.html` (single file) + `launch-offline.bat` +
  README → `vienna-run-offline.zip` for USB.
- **Launchers:** Edge (preinstalled on Windows) with
  `--kiosk <url|file> --edge-kiosk-type=fullscreen --no-first-run --disable-pinch --overscroll-history-navigation=0 --user-data-dir=%LOCALAPPDATA%\ViennaRunKiosk`.
- **`docs/SETUP_CHECKLIST.md` (~10 min on setup day):**
  - Display scaling 100% at native resolution.
  - Turn off edge swipes (gpedit or registry `AllowEdgeSwipe=0`).
  - Do Not Disturb on.
  - Sleep, screen-off and screensaver set to never.
  - Pause Windows Update.
  - Turn off press-and-hold right-click and the touch keyboard pop-up.
  - Optional auto-login + startup shortcut.
  - Run `?check=1`, then do 3 full test runs.

## Milestones
1. **M1 — Scaffold + diorama street + asset spec:**
   - Vite+TS+Three, port the prototype's placeholder painters, camera rig and paper-edge pass.
   - Facade/landmark/lamp pools along the authored route; waiter + 3 lanes + items;
     tap/swipe/keys.
   - Write `docs/ASSET_SPEC.md` first, so the designer starts immediately.
2. **M2 — Core rules (test-first):** config, rng, route/spawner, run, scoring, question
   scheduler and picker, tiers, bot; Vitest; `scripts/simulate.ts`.
3. **M3 — Screens & feel:** attract with bot demo, how-to and countdown, HUD and progress bar,
   question overlay, finish, results with ladder and hold-to-reset; tray stacking, popups,
   wobble, confetti.
4. **M4 — Reliability:** kiosk hardening, watchdog and error reset, quality tiers, self-check,
   PWA; Playwright smoke + soak test.
5. **M5 — Delivery & docs:** Vercel production, offline zip and launchers, SETUP_CHECKLIST,
   question bank for review, simulator report; swap in whatever designer art has arrived.

## Verification
- `npm test` (Vitest, core):
  - Tier lookup at boundaries; doubling (right = 2×, wrong or timeout = 0); score floor at 0.
  - Scheduler: exact count, spacing ≥7s, all slots inside the window.
  - Picker: no repeats; recent-run exclusion.
  - Spawner: never blocks all 3 lanes; finish zone clear.
  - Same seed → same layout.
- `npm run simulate` → plausible distribution; every bot profile reaches tier 0; the top tier is
  reachable.
- Playwright soak: `?bot=1&speed=8`, 200 consecutive runs. Assert zero console errors, every
  screen reached each cycle, bounded JS heap growth, no WebGL context loss.
- Offline: open `dist-offline/index.html` via `file://` with the network off → full run works.
  Vercel URL → load once → DevTools offline → reload → still works.
- Performance: Chrome DevTools 4× CPU throttle → quality auto-drops and stays ≥50fps.
- Asset swap: drop one designer-style PNG into `src/assets/art/`, edit its manifest line → it
  replaces the placeholder with the paper edge applied, without code changes.
- Manual: a full loop by touch; then the setup-day checklist on the booth PC.

## Inputs needed later
Real gift list and inventory (to set thresholds), designer art, review of the question bank, the
Vercel project/URL.
