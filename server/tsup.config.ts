import { defineConfig } from 'tsup';

// Bundles the server (and the shared config files it imports from client/src/config)
// into a single ESM file. npm dependencies stay external.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
});
