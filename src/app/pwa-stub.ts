/** The offline single-file build has no service worker; this stands in for `virtual:pwa-register`. */
export function registerSW(_options?: unknown): (reload?: boolean) => Promise<void> {
  return async () => undefined;
}
