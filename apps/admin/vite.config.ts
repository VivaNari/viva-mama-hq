import path from 'path';
import checker from 'vite-plugin-checker';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// ----------------------------------------------------------------------

const PORT = 3039;

export default defineConfig({
  plugins: [
    react(),
    checker({
      typescript: true,
      eslint: {
        useFlatConfig: true,
        lintCommand: 'eslint "./src/**/*.{js,jsx,ts,tsx}"',
        dev: { logLevel: ['error'] },
      },
      overlay: {
        position: 'tl',
        initialIsOpen: false,
      },
    }),
  ],
  // @vivamama/contracts is compiled to CommonJS for the Node services, so Rollup
  // cannot statically read its named exports. Routing the import at the package's
  // TypeScript source lets Vite compile it directly — which also tree-shakes
  // properly and picks up contract edits without a rebuild.
  resolve: {
    alias: [
      {
        find: '@vivamama/contracts',
        replacement: path.resolve(process.cwd(), '../../packages/contracts/src/index.ts'),
      },
      {
        find: /^src(.+)/,
        replacement: path.resolve(process.cwd(), 'src/$1'),
      },
    ],
  },
  server: { port: PORT, host: true },
  preview: { port: PORT, host: true },
});
