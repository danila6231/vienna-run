# Vienna Run v2: settings menu, Vietnamese, leaderboard (design)

Status: design agreed with the user on 2026-10-03 (interview + per-part approval).
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
| Leaderboard | **Today** and **All-time** tabs, top 10 each. One board; staff clear it after changing difficulty |
| Start screen | Title card and a compact **today's top 10** panel side by side (no alternating) |
| Score log | Every finished round (time, score, name if saved, difficulty, language, questions on/off). Delete one, clear all, **Export CSV** |
| Storage backend | **This device now**, behind a `ScoreStore` interface; Supabase is a later drop-in adapter |

Out of scope for v2:
- connecting Supabase
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
leaderboard: { enabled: boolean (default true) }
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
- **Leaderboard:** on/off switch, and **Clear leaderboard** (takes everything off the boards; the log is kept).
- **Score log:** newest first. Delete per row, **Clear log** (asks to confirm), **Export CSV** (downloads `vienna-run-scores-YYYY-MM-DD.csv`).
- **Storage:** a read-only line: "This device · Supabase not connected".

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

## Part 3: Leaderboard

### Storage
- **`ScoreStore` interface** (Promise-based so a Supabase adapter fits later):
  - `addRound(entry) → id`
  - `saveName(id, name)`
  - `top(range: 'today' | 'all', n) → Entry[]`
  - `log() → Entry[]`
  - `remove(id)`
  - `clearBoard()`
  - `clearLog()`
  - `exportCsv() → string`
- **Entry:** `{ id, at (ISO), score, name: string | null, onBoard: boolean, preset, lang, questionsOn }`.
- **`LocalScoreStore`:**
  - Uses the safe storage helpers and keeps at most 5,000 entries (the oldest drop off).
  - "Today" means the booth PC's local calendar day.
  - Boards show `onBoard && name` entries, sorted by score descending, earlier first on ties.
- **Storage failures:** if storage is unavailable, the leaderboard shows "Bảng xếp hạng tạm thời không khả dụng" and the game carries on.

### Results screen
- **On finish:** every round is logged via `addRound`.
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
- **Offline:** the USB build and the PWA must keep working with no network. Nothing in v2 makes network calls.

## Testing
- **Unit tests:**
  - `buildConfig` (speeds, run length, landmark scaling, question window) and preset values
  - spawner fixed mode: exact counts, constraints kept, deterministic by seed
  - spawner random mode: average near the target, spread within ±35%
  - settings load/validate/clamp, share-code round trip, bad codes rejected, PIN check
  - translation completeness, and bank validation in both languages
  - ScoreStore: ranking, ties, today vs all-time, clear board vs clear log, cap, CSV escaping
  - name filtering; keystrokes in fields ignored by game input; results timer paused while typing
- **Updated tests:** the Flow and Game tests are updated for questions-off and the leaderboard enabled or disabled.
- **End-to-end:**
  - open settings via corner hold + PIN → choose Hard → close → next round runs faster
  - finish a round → type a name → save → the name appears on the start-screen panel
  - the existing smoke, offline and soak tests still pass

## Setup checklist changes
- **Touch keyboard:** keep auto-show **ON** if there's no physical keyboard, so tapping the name field opens it (replaces the "turn it off" line).
- **Team PIN:** note the PIN and the share code to load the agreed difficulty on the booth PC.
