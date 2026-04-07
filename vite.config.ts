import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react(), tailwindcss()],

    define: {
      // expose to frontend — never put secret keys here, only public config
      'process.env.VITE_API_BASE_URL': JSON.stringify(env.VITE_API_BASE_URL || ''),
    },

    resolve: {
      alias: { '@': path.resolve(__dirname, '.') },
    },

    // The base path matters for GitHub Pages.
    // Set VITE_BASE_PATH=/your-repo-name/ in .env.production
    base: env.VITE_BASE_PATH || '/',

    server: {
      hmr: process.env.DISABLE_HMR !== 'true'
        ? { host: 'localhost', port: 5173 }
        : false,
      allowedHosts: ['sidzy.in', 'localhost'],
      // In dev, proxy /api/* → Express so you don't need CORS headers locally
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },

    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});
