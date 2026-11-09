import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  // En GitHub Pages la app vive en /mathvoice/; en desarrollo y en las pruebas, en la raíz.
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'MathVoice — Calculadora parlante',
        short_name: 'MathVoice',
        description: 'Entorno matemático accesible con voz y cálculos locales.',
        lang: 'es-AR',
        start_url: './',
        display: 'standalone',
        theme_color: '#123d35',
        background_color: '#f2f5f5',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 4000000,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: { include: ['src/**/*.test.ts'] },
});
