import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// FEETAP runs on its own port (PollTap owns 5191, 5173 is taken by another app).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5192,
    strictPort: true,
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-i18n': ['i18next', 'react-i18next'],
          'vendor-lucide': ['lucide-react'],
        },
      },
    },
  },
})
