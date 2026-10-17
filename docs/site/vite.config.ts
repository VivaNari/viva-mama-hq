import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves a project site from https://<org>.github.io/<repo>/, so the
// bundle needs `/<repo>/` as its base path. Locally (and on any host serving from
// a domain root) it must stay '/'. The deploy workflow sets DOCS_BASE.
const base = process.env.DOCS_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Markdown is inlined into the bundle via import.meta.glob, so chunks run
    // larger than Vite's default warning threshold. Raising it keeps the build
    // output readable instead of burying real warnings.
    chunkSizeWarningLimit: 1200,
  },
  server: {
    port: 5175,
    host: true,
  },
  preview: {
    port: 5175,
    host: true,
  },
});
