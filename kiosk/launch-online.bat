@echo off
rem Vienna Run kiosk launcher (hosted version, works offline after the first load).
rem URL is the production address of the Vercel project "vienna-run".
set URL=https://vienna-run.vercel.app
start "" msedge --kiosk "%URL%" --edge-kiosk-type=fullscreen --no-first-run --disable-pinch --overscroll-history-navigation=0 --user-data-dir="%LOCALAPPDATA%\ViennaRunKiosk"
