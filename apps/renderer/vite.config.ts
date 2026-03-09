import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@agentspaces/shared': path.resolve(__dirname, '../../packages/shared/src')
    }
  },
  build: {
    outDir: 'dist'
  }
});
