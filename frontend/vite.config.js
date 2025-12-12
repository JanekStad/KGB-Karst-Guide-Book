import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Allow external connections
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: ['@apollo/client', '@apollo/client/react'],
    esbuildOptions: {
      target: 'esnext',
    },
  },
  resolve: {
    dedupe: ['@apollo/client'],
  },
})

