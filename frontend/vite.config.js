import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: { rollupOptions: { output: { manualChunks(id) {
    if (id.includes('/src/data/reports/')) return 'report-' + id.split('/').pop().replace('.json', '');
    if (id.includes('node_modules/leaflet')) return 'map';
    if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react-vendor';
  } } } },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.MAHALLEN_API_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
