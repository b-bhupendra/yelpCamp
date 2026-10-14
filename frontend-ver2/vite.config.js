import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('three') ||
            id.includes('@react-three') ||
            id.includes('framer-motion-3d')
          ) {
            return 'vendor-three';
          }
          if (id.includes('framer-motion') || id.includes('lenis')) {
            return 'vendor-motion';
          }
          if (
            id.includes('react') ||
            id.includes('react-dom') ||
            id.includes('react-router-dom') ||
            id.includes('axios')
          ) {
            return 'vendor-core';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1200,
  },
})

