import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';
import path from 'path';

const isTest = !!process.env.PLAYWRIGHT_TEST;

export default defineConfig({
  plugins: [
    react(),
    ...(!isTest ? [mkcert()] : []),
  ],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    port: 3000,
    ...(!isTest ? { https: true } : {}),
  },
});
