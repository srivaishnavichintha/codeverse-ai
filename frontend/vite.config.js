import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy /api/* to the backend in development
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        // Keep /api prefix — backend mounts at /api
      },
    },
  },
  define: {
    // Make env vars available without VITE_ prefix for compat
    __API_URL__: JSON.stringify(process.env.VITE_API_URL || ''),
  },
}));
