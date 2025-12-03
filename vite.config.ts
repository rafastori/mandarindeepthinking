import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa'; // <--- 1. Importamos o plugin aqui

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    // --- SUAS CONFIGURAÇÕES ANTIGAS (MANTIDAS) ---
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },

    // --- LISTA DE PLUGINS (ONDE A MÁGICA ACONTECE) ---
    plugins: [
      react(), // Seu plugin React original
      
      // 2. Adicionamos a configuração do PWA aqui dentro
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['logo.png'],
        manifest: {
          name: 'MemorizaTudo',
          short_name: 'MemorizaTudo',
          description: 'Aprenda idiomas com IA',
          theme_color: '#047857',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          icons: [
            {
              src: 'logo.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }
      })
    ],
  };
});