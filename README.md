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
`?seed=7` fixed item layout · `?quality=low|med|high` force graphics level · `?hidecursor=1` hide the mouse cursor (shown by default).

## Staff settings
For now, the **⚙ Settings** button in the top-left corner of the start screen opens the menu with no PIN.
Set `QUICK_SETTINGS = false` in `src/main.ts` to hide it again: staff then **hold the top-left corner
for 3 seconds** and enter the PIN (default **2468**; change it in the menu). The menu sets:
- **Difficulty:** Easy / Normal / Hard presets; round length, start and end speed, obstacles and treats
  per round; "Random each round" or "Same for everyone".
- **Points and gifts:** item points, the gift tiers, and whether players see gifts.
- **Bonus questions:** on/off, how many per round, seconds to answer.
- **Graphics:** the street in **3D** (default) or **Paper (lighter)**, the flat cutout houses and landmarks, as a
  fallback for a PC that can't keep 50 fps. Per device; saving a change restarts the game.
- **Share code:** copy every setting except the PIN, the leaderboard board and the street look to another device.

Settings are saved on each device (press **Save**) and apply from the next round. The built-in
defaults (also what **Reset to defaults** restores) are the booth's tuned round: 45 s at 90→110 km/h,
"Same for everyone" with 40 obstacles and 75 treats, Krampus −20, bomb −25, bonus questions off.

## Languages
The game starts in **Vietnamese**. The **VI | EN** pill on the start screen switches to English for one
player; the game returns to Vietnamese after every round. Texts live in `src/i18n/strings.ts`, and
questions (both languages) in `src/data/questions.json`. The Vietnamese texts were machine-written:
**have a native speaker review them before the event.**

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

## Changing things
- **Points, difficulty, gift tiers:** use the staff settings menu. Defaults: `defaultSettings()` in `src/core/settings.ts` (difficulty, bonus questions) and `src/config.ts` (points, gift tiers); `npm run simulate` shows the score spread for each preset.
- **Questions:** `src/data/questions.json`. Put the right answer first; the game shuffles. `npm test` validates the file.
- **Route and landmarks:** `src/core/route.ts`.
- **Art:** drop files named as in `docs/ASSET_SPEC.md` into `src/assets/art/`. Anything missing stays a placeholder.
- **Buildings:** the houses and landmarks are 3D, built in code in `src/render/buildings/` (the paper cards remain as the
  Graphics → Paper fallback). `npm run demo:buildings`
  builds a one-file street viewer (`dist-demo/vienna-run-street-looks.html`) with a free camera for checking them.

## Deploy
Production: https://vienna-run.vercel.app (Vercel project `vienna-run`, built from `main` of
github.com/danila6231/vienna-run). Every push to `main` deploys to production, so keep unfinished
work on a branch.
