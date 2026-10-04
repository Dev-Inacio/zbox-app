import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Em desenvolvimento, o Vite repassa tudo que começa com /api para o back (Spring Boot na 8080).
    // Assim o front chama '/api/...' sem endereço fixo e sem precisar de CORS no back.
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
