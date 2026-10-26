@echo off
rem Step into Vienna kiosk launcher (hosted version, works offline after the first load).
rem URL is the production address of the Vercel project "vienna-run".
rem --autoplay-policy lets the background music start on the start screen, before anyone taps.
set URL=https://vienna-run.vercel.app
start "" msedge --kiosk "%URL%" --edge-kiosk-type=fullscreen --no-first-run --disable-pinch --overscroll-history-navigation=0 --autoplay-policy=no-user-gesture-required --user-data-dir="%LOCALAPPDATA%\ViennaRunKiosk"
