import { registerSW } from 'virtual:pwa-register';

let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null;
let ready = false;

/** Registers the service worker that caches the whole game for offline use. */
export function setupUpdates(): void {
  if (!('serviceWorker' in navigator)) return;
  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      ready = true;
    },
  });
}

/** Called on the attract screen: switches to a newly deployed version between players, never mid-run. */
export function applyUpdateIfReady(): void {
  if (ready && applyUpdate) void applyUpdate(true);
}
