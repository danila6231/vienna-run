@echo off
rem Vienna Run kiosk launcher (USB copy). Keep this file next to index.html.
start "" msedge --kiosk "%~dp0index.html" --edge-kiosk-type=fullscreen --no-first-run --disable-pinch --overscroll-history-navigation=0 --user-data-dir="%LOCALAPPDATA%\ViennaRunKioskOffline"
