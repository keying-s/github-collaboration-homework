import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves the game under /github-collaboration-homework/; relative
  // base keeps asset URLs correct at any subpath (local dev is unaffected).
  base: './',
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  // The renderer is a separate cacheable vendor asset; content edits don't redownload the engine.
  build: {
    rolldownOptions: {
      output: { codeSplitting: { groups: [{ name: 'phaser', test: /node_modules[\\/]phaser/ }] } },
    },
    chunkSizeWarningLimit: 1500,
  },
});
