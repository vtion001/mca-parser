import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.VITE_PORT ?? 4200) || 4200,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET ?? 'http://localhost:9000',
        changeOrigin: true,
      }
    }
  }
})
