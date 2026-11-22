import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Rutas relativas: el sitio funciona en la raíz de Cloudflare Pages o dentro de una subcarpeta.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
  },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
