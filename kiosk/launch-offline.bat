@echo off
rem Step into Vienna kiosk launcher (USB copy). Keep this file next to index.html.
rem --autoplay-policy lets the background music start on the start screen, before anyone taps.
start "" msedge --kiosk "%~dp0index.html" --edge-kiosk-type=fullscreen --no-first-run --disable-pinch --overscroll-history-navigation=0 --autoplay-policy=no-user-gesture-required --user-data-dir="%LOCALAPPDATA%\ViennaRunKioskOffline"
