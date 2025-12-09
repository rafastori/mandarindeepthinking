import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
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
    plugins: [
      react(), 
      
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['logo.png'],
        // --- AQUI ESTÁ A CORREÇÃO MÁGICA ---
        workbox: {
            // Se o usuário tentar acessar algo offline, joga pro index.html
            navigateFallback: '/index.html',
            // MAS... se a url começar com /api, NÃO intercepta (deixa ir pro servidor)
            navigateFallbackDenylist: [/^\/api/], 
        },
        // ------------------------------------
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