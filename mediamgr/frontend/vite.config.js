import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/mediamgr/',
  server: {
    proxy: {
      '/mediamgr/api': 'http://localhost:7474',
      '/mediamgr/ws': { target: 'ws://localhost:7474', ws: true },
    },
  },
  build: {
    outDir: 'dist',
  },
})
