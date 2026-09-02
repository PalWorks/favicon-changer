import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Pass 1 of the build: the extension pages and the service worker, as ES
// modules. Pass 2 (vite.content.config.ts) builds the content script as an
// IIFE and must run afterwards. See docs/DECISIONS.md ADR-006.
export default defineConfig({
  server: {
    port: 3000,
    // Deliberately NOT host: '0.0.0.0'. That exposed the dev server to the whole
    // local network (and any VPN/tailnet interface), and Vite's dev server has a
    // recurring class of path-traversal and arbitrary-file-read advisories, so a
    // wide bind turns a dev convenience into a file-read surface. Pass
    // `npm run dev -- --host` when access from another device is actually needed.
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  build: {
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, 'index.html'),
        options: path.resolve(__dirname, 'options.html'),
        background: path.resolve(__dirname, 'background.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'content') {
            return 'content.js';
          }
          if (chunkInfo.name === 'background') {
            return 'background.js';
          }
          return '[name].js';
        },
        assetFileNames: 'assets/[name].[ext]',
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
    copyPublicDir: true, // Explicitly ensure public dir is copied
  }
});
