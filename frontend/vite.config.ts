import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Mesma origem do site: o navegador envia o cookie de sessão sem configuração extra.
    proxy: { '/api': 'http://localhost:3333' },
  },
});
