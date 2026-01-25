import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    emptyOutDir: false, // Don't wipe the dist folder (app build runs first)
    rollupOptions: {
      input: {
        content: path.resolve(__dirname, 'content.ts'),
      },
      output: {
        entryFileNames: 'content.js',
        format: 'iife', // Immediately Invoked Function Expression (self-contained)
        extend: true,
      },
    },
    outDir: 'dist',
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  }
});
