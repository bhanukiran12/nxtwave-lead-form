import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Vite plugin to copy _redirects to dist
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-redirects',
      writeBundle() {
        const src = resolve(__dirname, 'public/_redirects');
        const dest = resolve(__dirname, 'dist/_redirects');
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
          console.log('Copied _redirects to dist');
        }
      }
    }
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
