import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      'notistack': path.resolve(__dirname, 'src/lib/useSnackbar.js'),
    }
  },
  server: {
    port: 3000,
    host: true
  }
})
