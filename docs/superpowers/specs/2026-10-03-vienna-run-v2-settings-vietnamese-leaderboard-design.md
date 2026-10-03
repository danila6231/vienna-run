# Vienna Run v2: settings menu, Vietnamese, leaderboard (design)

Status: design agreed with the user on 2026-10-03 (interview + per-part approval; Part 3 revised the same day: Supabase now, offline-first).
Builds on the MVP spec `docs/superpowers/specs/2026-10-03-vienna-run-design.md`. Where the two
disagree, this document wins.

## Context
The MVP is live at https://vienna-run.vercel.app. The audience is mainly Vietnamese. The team wants
three things:
- **Settings menu:** tune difficulty and features themselves.
- **Vietnamese:** a Vietnamese-first game.
- **Leaderboard:** players save a code name with their score.

Build and deploy in this order: **Settings → Vietnamese → Leaderboard**, so the team can start tuning
on the live link as early as possible.

## Decisions
| Topic | Decision |
|---|---|
| Settings access | Hold the top-left corner of the start screen for 3 s, then enter a 4-digit PIN. Default PIN 2468, changeable in settings, stored per device |
| Settings language | English (team tool). The self-check stays English too |
| Settings storage | Per device (localStorage) plus a copy/paste **share code** to move a setup between devices |
| When settings apply | From the next round (and the next attract demo run); never mid-round |
| Difficulty | Easy / Normal / Hard presets fill every value; any edit turns the label into "Custom" |
| Difficulty mode | **Random**: counts vary around the targets. **Same for everyone**: exact counts, positions random |
| Points | Item points (all 6 items) and gift tiers (name + minimum) are editable |
| Gifts | "Show gifts" switch, **off** by default. On = gift ladder on the start screen and gift + ladder on results (the MVP behaviour) |
| Questions | On/off switch, 1–5 per round, 5–15 s to answer |
| Language | Vietnamese by default. A "VI \| EN" pill on the start screen switches it, and it resets to VI after every round |
| Treat names | Original name plus a Vietnamese hint ("Sachertorte · bánh sô-cô-la") |
| Questions in Vietnamese | All 32 translated by Claude; **a native speaker must review before the event** |
| Fonts | Headings: Josefin Sans. Body: Be Vietnam Pro (both with the Vietnamese subset). Canvas shop signs keep Federo |
| Name entry | Optional field + Save on the results screen. English code names: A–Z, a–z, 0–9, space, `-`, `_`; 1–12 characters. No Vietnamese typing |
| Keyboard | Any keyboard: a physical one, or the Windows touch keyboard (setup checklist covers both) |
| Leaderboard | **Today** and **All-time** tabs, top 10 each, for this device's **board name** (default `booth`; team laptops use e.g. `test`). "Clear leaderboard" starts a fresh board (`booth-2`); old scores stay in the database |
| Start screen | Title card and a compact **today's top 10** panel side by side (no alternating) |
| Score log | Every finished round (time, score, name if saved, difficulty, language, questions on/off). Delete one, clear all, **Export CSV** |
| Storage backend | **Supabase, offline-first**: the existing `supabase-green-river` database (Vercel Marketplace integration), table `vienna_run_scores`. Every score saves on the device first; a persistent upload queue sends it when online. The table is created automatically on each Vercel deploy |
| Uploads | Every finished round (named or not) from the hosted game; only named rounds appear on boards |
| USB copy | Built without Supabase details, so it has a local-only leaderboard and never syncs |

Out of scope for v2:
- deleting or editing uploaded scores from inside the game (use Supabase directly)
- Vietnamese name typing
- an in-game on-screen keyboard
- redesigning the gift screens
- translating the settings and self-check screens

## Part 1: Settings menu

### Opening and closing
- **Opening:** on the start screen, holding a 12% × 12% top-left square for 3 s opens a PIN pad: 4 digits, big buttons, works by touch or keyboard.
  - Only the attract screen listens.
  - Visitors see nothing and the press never starts a game: it doesn't fire `press`.
- **Wrong PIN:** shake, then the pad clears. Back to the start screen after 3 wrong tries or 20 s idle.
- **The panel:** full-screen, scrollable (`touch-action: pan-y`), with sections as tabs or a long page.
  - The game behind it is paused on the attract demo.
  - **Close** returns to attract and rebuilds the demo run with the new settings.
- **Saving:** **Save** stores the settings and closes. **Cancel** discards edits. **Reset to defaults** restores Normal.

### Settings model (`Settings`, versioned)
```
version: 1
preset: 'easy' | 'normal' | 'hard' | 'custom'
roundSeconds: 20–90            (default 38)
startSpeedKmh: 30–90           (default 50  = 14 m/s)
endSpeedKmh: startSpeed–110    (default 63  ≈ 17.5 m/s)
mode: 'random' | 'fixed'       (default 'random')
obstacles: 0–40                (target per round; exact in 'fixed'; default 11)
treats: 5–80                   (target per round; exact in 'fixed'; default 31)
points: { sacher, kipferl, melange, mozart: 1–50; krampus, bomb: −50…−1 }
tiers: 1–6 × { name (1–24 chars), min (0–999, strictly ascending, first = 0) }
showGifts: boolean             (default false)
questions: { enabled: boolean (default true), perRun: 1–5 (3), timeLimit: 5–15 s (10) }
leaderboard: { enabled: boolean (default true), board: string ([a-z0-9-], 1–24, default 'booth') }
pin: string                    (4 digits, default '2468'; stored as plain digits: a 4-digit PIN has
                               only 10,000 values, so hashing adds nothing, and Web Crypto may be
                               unavailable in the USB file:// build)
```
- **Presets** (only these fields change):
  - **Easy:** 40→50 km/h, 7 obstacles, 34 treats.
  - **Normal:** 50→63 km/h, 11 obstacles, 31 treats.
  - **Hard:** 58→76 km/h, 16 obstacles, 28 treats.
  - All three: 38 s and random mode.
- **Validation:** out-of-range or wrong-type values are clamped or replaced with defaults on load, so a corrupted store can never break a round.
- **Too-short rounds:** if a round is too short for the question count, the menu says so ("3 questions need a round of at least 28 s") and won't save.

### From settings to the game (`buildConfig(settings) → GameConfig`, pure)
- **Speeds:** km/h ÷ 3.6 → `baseSpeed`. `speedRamp = end/start − 1`.
- **Run length:** `runLength = roundSeconds × average speed`. Landmarks are stored as fractions of the route (Stephansdom at 0.11, Riesenrad at 1.0), so the Riesenrad is always at the finish.
- **Clear zones:** the start and finish zones scale with speed (about 2.4 s of running each).
- **Question window:** 4 s → `roundSeconds − 8 s`. The minimum gap shrinks if needed, down to 4 s; below that, validation blocks the save.
- **Questions off:** `perRun = 0`. No slots, no questions, and the how-to line about bonus questions is hidden.
- **Points and tiers:** copied straight in.
- **Spawner rework:**
  - **Fixed mode:** it places exactly `obstacles` obstacle items and `treats` treat items. Obstacles are spread evenly with ±30% jitter; treats are split into lines, zigzags and singles in the gaps.
  - **Random mode:** each round draws its own counts within ±35% of the targets, then lays them out the same way.
  - **Unchanged rules:** never block all three lanes; keep the start and finish clear; same seed → same layout.

### Share code
- **Format:** `VR1-` + base64url(JSON of the settings, without `pin`).
- **Copy / paste:** "Copy code" uses the clipboard, falling back to a selectable text box. "Paste code" validates the code and shows the result before saving.
- **Bad code:** a clear error message, and nothing changes.

### Score log & leaderboard section
- **Leaderboard:** on/off switch.
- **Board name:** editable.
- **Clear leaderboard:** after an in-panel confirm, switches to the next board name (`booth` → `booth-2` → `booth-3`). Nothing is deleted.
- **Sync status:**
  - Online / offline / not configured (USB).
  - Scores waiting to upload.
  - Last successful sync time.
  - A **Sync now** button.
- **Score log** (this device): newest first, with an uploaded / waiting marker per row.
  - Delete per row: local only. A row still waiting is also dropped from the queue; already-uploaded rows stay in Supabase.
  - **Clear log** (asks to confirm).
  - **Export CSV** (downloads `vienna-run-scores-YYYY-MM-DD.csv`).

## Part 2: Vietnamese
- **Translation table:** a typed dictionary `strings.ts` with `vi` and `en`, and `t(key, vars)`. Every visitor-facing string comes from it:
  - start screen, how-to, HUD labels, popups ("Không có điểm")
  - finish banner ("Về đích!"), bonus question, results, leaderboard
  - watchdog cards
  A unit test checks that both languages have every key and no empty values.
- **Switching language:** the current language lives in the app. Screens re-label when it changes. The game resets it to `vi` when it enters attract after a round.
- **Item hints (vi):**
  - Sachertorte · bánh sô-cô-la
  - Kipferl · bánh sừng bò
  - Melange · cà phê sữa
  - Mozartkugel · kẹo sô-cô-la
  - Krampus · quỷ Krampus
  - Bomb → "Bom"
- **Question bank:** becomes `{ id, answer, vi: { q, options[3] }, en: { q, options[3] } }`, with the correct answer still first. `validateBank` checks both languages. The picker returns the current language's text, and options are shuffled per round as now.
- **Fonts:** Fontsource `@fontsource/josefin-sans` and `@fontsource/be-vietnam-pro`, Vietnamese and Latin subsets, bundled so they work offline. CSS variables `--font-display` and `--font-body` switch to them. Federo stays only for the canvas sign painters.

## Part 3: Leaderboard (Supabase, offline-first)

### Principle
The game never waits on the network. A score is saved on the device first and uploaded later.
The leaderboard always shows the last downloaded copy plus this device's own scores that haven't
uploaded yet. No connection means only that the status line says "offline".

### Storage (`ScoreStore`, Promise-based)
- **Interface:**
  - `addRound(entry) → id`
  - `saveName(id, name)`
  - `finalize(id)`
  - `top(range: 'today' | 'all', n) → Entry[]`
  - `log() → Entry[]`
  - `remove(id)`
  - `newBoard() → string`
  - `clearLog()`
  - `exportCsv() → string`
  - `status() → { mode: 'online' | 'offline' | 'local-only', pending, lastSyncAt }`
  - `syncNow()`
- **Entry:** `{ id (uuid), at (ISO), board, score, name: string | null, preset, lang, questionsOn, device, final: boolean, uploaded: boolean }`.
- **Local part** (always on):
  - Uses the safe storage helpers and keeps at most 5,000 entries (the oldest uploaded ones drop first).
  - "Today" means the device's local calendar day.
- **Upload queue:**
  - When the results screen closes (name saved or skipped), the round is marked `final` and queued.
  - On boot, any non-final round older than 2 minutes is finalized, so a crash during results loses nothing.
  - The queue lives in localStorage and survives reloads.
- **Sync loop:**
  - **When it runs:** whenever remote details exist. It tries at boot, on the browser's `online` event, right after a round is queued, and every 15 s, backing off to 2 minutes after failures.
  - **Uploads:** batches of up to 50, each request with a 5 s timeout.
  - **Retries are harmless:** uploads use insert-ignore-duplicates on `id`, so a repeat after a lost response never creates duplicates.
  - **After a successful upload:** the remote top-10 lists for this device's board are refreshed and cached in localStorage with their fetch time.
  - **On the start screen:** the lists are also refreshed at most every 30 s.
- **What a board shows:** the cached remote lists merged with this device's named entries for the same board that haven't uploaded yet. Duplicates are removed by id; the list is sorted by score (highest first, earlier first on ties) and cut to 10. "You're #3 today!" uses the same merged list.
- **Failures:**
  - A failing or timed-out request only changes the status. The cached lists stay.
  - If local storage is unavailable, the leaderboard shows "Bảng xếp hạng tạm thời không khả dụng" and the game carries on.

### Supabase backend
- **Table `public.vienna_run_scores`:**

  | Column | Rule |
  |---|---|
  | `id` | uuid, primary key |
  | `created_at` | timestamptz |
  | `board` | matches `^[a-z0-9-]{1,24}$` |
  | `score` | integer, 0–5000 |
  | `name` | null, or matches `^[A-Za-z0-9 _-]{1,12}$` |
  | `preset` | easy / normal / hard / custom |
  | `lang` | vi / en |
  | `questions_on` | boolean |
  | `device` | up to 40 characters |
  | `inserted_at` | defaults to now() |

  It has an index on (board, score desc, created_at).
- **Security:** row-level security is on. The `anon` role may only **insert** and **select**: no updates, no deletes.
- **Created automatically:** a `vercel-build` step runs `scripts/migrate-db.mjs` before the normal build.
  - It connects with the Postgres address the Vercel integration provides (`POSTGRES_URL_NON_POOLING`, else `POSTGRES_URL`).
  - It runs idempotent SQL (create if missing, create policies if missing) and asks the Data API to reload its schema.
  - If no address is set, or the connection fails, it logs a warning and the build continues. The game then simply stays offline-only.
- **Client access:**
  - Plain `fetch` against the Supabase REST API (no SDK).
  - Supabase address and public key come from the integration's `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `…_PUBLISHABLE_KEY`). They're exposed to the bundle via Vite `envPrefix`.
  - The service-role key and Postgres password are never exposed to the browser.
  - The USB build (`--mode offline`) blanks these values, so it runs in local-only mode.
- **One-time step for the user:** Vercel → Storage → `supabase-green-river` → **Connect Project** → `vienna-run` (Production + Preview). Claude then confirms the environment variable *names* (never the values) and redeploys.

### Results screen
- **On finish:** every round is saved locally via `addRound`, and it's queued for upload when the results screen closes (`finalize`).
- **Name entry:** when the leaderboard is enabled, the results card shows a name field (placeholder "Tên của bạn", `maxlength=12`, invalid characters filtered as they're typed) and **Lưu**.
  - After saving: "Bạn đứng thứ #3 hôm nay!" plus **Xem bảng xếp hạng**.
  - The field locks after one save.
- **Auto-reset:** the 60 s fallback pauses while the field is focused or holds text, and restarts after 20 s without typing.
- **Typing doesn't play the game:** keystrokes inside a text field never move lanes or count as a press, and kiosk selection blocking skips form fields.

### Start screen
- **Layout:** title card on the left, a **today's top 10** panel on the right (rank, name, score). The list fits a 16:9 screen at 1080p.
  - Empty board: "Hãy là người đầu tiên!" ("Be the first!").
  - Leaderboard disabled: the panel is hidden and the card is centred as now.
- **Full leaderboard:** a **Bảng xếp hạng** button opens it (Today / All-time tabs, top 10, close button). It's reachable from start and results. Tapping a tab or the close button never starts a game: these controls are `data-ui`.

## Reliability notes
- **Settings can't break a round:** settings and scores go through the existing safe storage helpers with shape validation, and `buildConfig` output is clamped.
- **Locked-down UI:** the settings menu and leaderboard are DOM overlays marked `data-ui`, so game input ignores them.
- **Watchdog:** unchanged. A crash inside the settings menu reloads to attract like any other error.
- **Offline:** the USB build and the PWA must keep working with no network. Only the leaderboard sync touches the network, never on the play path, always with timeouts. The PWA cache never caches Supabase responses.

## Testing
- **Unit tests:**
  - `buildConfig` (speeds, run length, landmark scaling, question window) and preset values
  - spawner fixed mode: exact counts, constraints kept, deterministic by seed
  - spawner random mode: average near the target, spread within ±35%
  - settings load/validate/clamp, share-code round trip, bad codes rejected, PIN check
  - translation completeness, and bank validation in both languages
  - ScoreStore with a fake `fetch`, storage and clock:
    - an offline save is queued, survives a reload, and uploads when the connection returns
    - a retried upload never duplicates
    - boards are filtered by name
    - the merged display includes unsent local names
    - remote failures keep the cached lists
    - today vs all-time, ranking ties, the size cap, CSV escaping
    - no remote details → local-only
  - migration script: skips cleanly with no database address; the SQL text includes every rule and both policies
  - name filtering; keystrokes in fields ignored by game input; results timer paused while typing
- **Updated tests:** the Flow and Game tests are updated for questions-off and the leaderboard enabled or disabled.
- **End-to-end:**
  - open settings via corner hold + PIN → choose Hard → close → next round runs faster
  - finish a round → type a name → save → the name appears on the start-screen panel
  - with the Supabase API intercepted: offline → save → connection back → the queued row is uploaded exactly once
  - the existing smoke, offline and soak tests still pass

## Setup checklist changes
- **Touch keyboard:** keep auto-show **ON** if there's no physical keyboard, so tapping the name field opens it (replaces the "turn it off" line).
- **Team PIN:** note the PIN and the share code to load the agreed difficulty on the booth PC.
- **Board name:** the booth PC's board name is `booth`, and team laptops use `test`.
- **Internet:** the leaderboard syncs when the booth has internet but works without it. Before leaving, check "Scores waiting to upload: 0" in settings.
