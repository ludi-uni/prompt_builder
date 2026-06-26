import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiPort = process.env.PROMPT_STUDIO_API_PORT ?? '61000'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
})
