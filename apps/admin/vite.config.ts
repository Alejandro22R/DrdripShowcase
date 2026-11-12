import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

const server = 'http://localhost:3000';

export default defineConfig({
  base: '/admin/',
  plugins: [preact()],
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2019' },
  server: {
    port: 5173,
    proxy: {
      '/api': server,
      '/player': server,
      '/media': server,
      '/ws': { target: server, ws: true },
    },
  },
});
