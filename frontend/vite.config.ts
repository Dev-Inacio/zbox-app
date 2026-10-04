import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Em desenvolvimento, o Vite repassa tudo que começa com /api para o back (Spring Boot na 8080).
    // Assim o front chama '/api/...' sem endereço fixo e sem precisar de CORS no back.
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        // O repasse é servidor → servidor: o cabeçalho "Origin" do navegador não serve aqui e atrapalha.
        // Sem tirar, o back recusa (403) quem abre o sistema por outro endereço:
        // celular pela rede (http://192.168.x.x:5173), 127.0.0.1, outra porta…
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'))
        },
      },
    },
  },
})
