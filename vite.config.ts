import { defineConfig } from 'vite';
export default defineConfig({
  build: { target: 'es2022', chunkSizeWarningLimit: 1600 },
  server: { host: '0.0.0.0' },
});
