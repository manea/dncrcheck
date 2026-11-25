import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 4232,
    proxy: {
      '/api': 'http://127.0.0.1:4231',
      '/health': 'http://127.0.0.1:4231',
      '/readyz': 'http://127.0.0.1:4231',
    },
  },
});
