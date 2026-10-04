import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rendererDir = path.join(__dirname, 'src', 'renderer');

export default defineConfig({
  root: rendererDir,
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.join(rendererDir, 'src'),
    },
  },
  build: {
    outDir: path.join(__dirname, 'dist', 'renderer'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
