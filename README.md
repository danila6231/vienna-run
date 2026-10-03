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

## Changing things
- **Points, timings, gift tiers:** `src/config.ts`. After changing tiers, run `npm run simulate` to see how many players land in each tier.
- **Questions:** `src/data/questions.json`. Put the right answer first; the game shuffles. `npm test` validates the file.
- **Route and landmarks:** `src/core/route.ts`.
- **Art:** drop files named as in `docs/ASSET_SPEC.md` into `src/assets/art/`. Anything missing stays a placeholder.

## Deploy
Production: https://vienna-run.vercel.app (Vercel project `vienna-run`, built from `main` of
github.com/danila6231/vienna-run). Until the project is connected to the repo in Vercel
(Settings → Git → Connect), pushes don't deploy on their own; trigger a production deployment
from the Vercel dashboard (or ask Claude, which deploys through the Vercel connector).
