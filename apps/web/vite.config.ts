import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // `pnpm dev` talks to the Django API on :8000 through this proxy (same origin → no CORS, and the
  // chat WebSocket works too). Override the target with API_PROXY_TARGET.
  server: {
    proxy: {
      '/api': { target: process.env.API_PROXY_TARGET || 'http://localhost:8000' },
      '/media': { target: process.env.API_PROXY_TARGET || 'http://localhost:8000' },
      '/ws': { target: (process.env.API_PROXY_TARGET || 'http://localhost:8000').replace(/^http/, 'ws'), ws: true },
    },
  },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], css: false },
});
