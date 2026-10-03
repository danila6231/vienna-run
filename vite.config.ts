import { fileURLToPath } from 'node:url';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const offline = mode === 'offline';
  return {
    define: { __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')) },
    resolve: offline ? { alias: { 'virtual:pwa-register': fileURLToPath(new URL('./src/app/pwa-stub.ts', import.meta.url)) } } : {},
    build: offline
      ? { outDir: 'dist-offline', assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 100_000 }
      : { outDir: 'dist' },
    plugins: offline
      ? [viteSingleFile()]
      : [
          VitePWA({
            registerType: 'prompt',
            injectRegister: false,
            manifest: false,
            workbox: {
              globPatterns: ['**/*.{js,css,html,png,webp,svg,woff,woff2}'],
              maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
              cleanupOutdatedCaches: true,
            },
          }),
        ],
    test: {
      include: ['tests/**/*.test.ts'],
      environment: 'node',
      alias: { 'virtual:pwa-register': fileURLToPath(new URL('./src/app/pwa-stub.ts', import.meta.url)) },
    },
  };
});
