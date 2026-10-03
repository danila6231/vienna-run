import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')) },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
