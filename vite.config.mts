import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const dir = import.meta.dirname;

export default defineConfig({
  plugins: [react()],
  root: 'frontend',
  base: './',
  build: {
    outDir: '../dist/renderer',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(dir, 'shared'),
      '@': path.resolve(dir, 'frontend'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
