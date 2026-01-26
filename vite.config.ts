import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      // Removed unused Gemini API keys
    },
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
  };
});
