import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3410,
    strictPort: true,
    open: true
  },
  preview: {
    host: true,
    port: 4173,
    allowedHosts: true
  }
})
