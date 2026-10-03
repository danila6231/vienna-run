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
   if offered; Settings → Time & language → Typing → Touch keyboard → **show the touch keyboard when there's
   no keyboard attached** (players type their code name). Skip this if a physical keyboard is plugged in.
7. **Volume:** muted (the game is silent).

## Game
8. Copy `vienna-run-offline.zip` to the PC, unzip to `C:\vienna-run`.
   If the venue Wi-Fi is decent, also run `launch-online.bat` once while online (that version updates itself).
9. Run the self-check: open the game with `?check=1` (see `OFFLINE-README.txt`).
   - Touch all 9 squares, especially the corners. All must turn green.
   - Frame rate should read **50 fps or more** after a few seconds (lower is OK: the game reduces detail by itself).
10. **Settings:** press **Start the game** to leave the self-check. On the start screen, hold the top-left corner for 3 s and enter the team PIN
    (default 2468; change it and write it down). Load the agreed difficulty with **Share code →
    Load code** (paste the code from the team chat), check the values, press **Save**.
11. **Leaderboard:** to try it without leaving a test name on the real board, set settings → Leaderboard →
    board name to **test**, Save, finish one round, save a name, and check it shows on the start screen.
    Then set the board name back to **booth** and Save. (Team laptops keep **test**.)
12. Play **3 full rounds** yourself: tap both sides, answer a question,
    let one question time out, hold "Hold for next player". While playing, also try the things visitors do:
    - play with **both hands** (left hand taps left, right hand taps right, overlapping);
    - a **slow swipe** across the screen (it should move the way you swiped);
    - **rest a palm** on the screen edge, then keep tapping with the other hand (taps must still work);
    - keep **tapping right as a bonus question appears** (the first moment's taps must not pick an answer);
    - a **quick tap** on "Hold for next player" (it must not skip the results).
13. Optional: Startup folder (`Win+R` → `shell:startup`), drop a shortcut to the launcher there,
    so the game comes back by itself after a restart.

## During the event
- **Before packing up:** settings → Leaderboard must read **0 waiting to upload** (connect to the internet
  and press **Sync now** if not), then press **Export CSV** for a local copy of all rounds.
- Stuck or frozen? Press **Alt+F4** and start the launcher again. The game also restarts itself on errors.
- "Short break. Please ask the staff." means it restarted 5 times within 2 minutes. Restart the launcher;
  if it repeats, switch to the other launcher (online ↔ offline).
