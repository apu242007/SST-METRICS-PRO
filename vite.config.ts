import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/SST-METRICS-PRO/',
  plugins: [react()],
  optimizeDeps: {
    // Excluir dependencias de Node.js/servidor para evitar errores de bundle en el frontend
    exclude: ['nodemailer', 'node-cron', 'express', 'chokidar']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-recharts': ['recharts'],
          'vendor-excel': ['xlsx'],
          'vendor-pdf': ['jspdf', 'jspdf-autotable', 'html2canvas'],
          'vendor-ui': ['lucide-react']
        }
      }
    }
  }
});