import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { offlinePlugin } from './build/offline-plugin';

export default defineConfig({
  plugins: [offlinePlugin()],
  resolve: {
    alias: { '@binsight/shared': fileURLToPath(new URL('../shared/src', import.meta.url)) },
  },
  server: {
    port: 5173,
    // The tiny leaderboard backend (server/) runs on 8787 in dev.
    proxy: { '/api': `http://localhost:${process.env.API_PORT || 8787}` },
  },
  worker: { format: 'es' },
  // Transformers.js ships its own WASM; don't let Vite pre-bundle it.
  optimizeDeps: { exclude: ['@huggingface/transformers'] },
  build: { target: 'es2022' },
});
