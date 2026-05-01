import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.APP_VERSION': JSON.stringify(pkg.version)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    plugins: [
      react(),
      {
        name: 'repo-auto-sync',
        configureServer(server) {
          // Extrai o status da matriz Inglês e compara com as outras pastas
          server.middlewares.use('/api/dev/repo-status', (req, res) => {
            if (req.method !== 'GET') return;

            // Linguagens que o sistema suporta (baseado no STUDY_LANGUAGES do app)
            const supportedLangs = ['Alemão', 'Francês', 'Espanhol', 'Italiano', 'Chinês', 'Japonês', 'Coreano'];
            const repoRoot = path.resolve(__dirname, 'MemorizaTudo-Repo');
            const engDir = path.join(repoRoot, 'Inglês');

            if (!fs.existsSync(engDir)) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: "Pasta matriz 'Inglês' não encontrada." }));
              return;
            }

            const englishFiles = fs.readdirSync(engDir).filter(f => f.endsWith('.txt'));
            const tasks = {
              missingTranslations: [] as { file: string, targetLang: string }[],
              missingJson: [] as { file: string, targetLang: string, targetFolder: string }[]
            };

            for (const file of englishFiles) {
              // 1. Checar se falta o TXT (tradução crua) para algum outro idioma
              for (const lang of supportedLangs) {
                const langFolder = path.join(repoRoot, lang);
                const langFile = path.join(langFolder, file);
                if (!fs.existsSync(langFile)) {
                  tasks.missingTranslations.push({ file, targetLang: lang });
                }
              }

              // 2. Checar se falta o JSON de importação para TODOS (inclusive Inglês)
              const allLangs = ['Inglês', ...supportedLangs];
              for (const lang of allLangs) {
                const baseFileName = file.replace('.txt', '');
                const importFolder = path.join(repoRoot, `${lang}-Import`);
                const jsonFile = path.join(importFolder, `${baseFileName}.json`);

                // Só solicita segmentação se não existir o JSON, MAS existir o TXT na língua alvo (ou se for o próprio Inglês)
                const targetTxtExists = lang === 'Inglês' || fs.existsSync(path.join(repoRoot, lang, file));

                if (!fs.existsSync(jsonFile) && targetTxtExists) {
                  tasks.missingJson.push({ file: baseFileName, targetLang: lang, targetFolder: importFolder });
                }
              }
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(tasks));
          });

          // Salva os arquivos físicos vindos da IA do React
          server.middlewares.use('/api/dev/repo-save', (req, res) => {
            if (req.method !== 'POST') return;
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => {
              try {
                const data = JSON.parse(body);
                const { relativePath, content, isJson } = data;

                if (!relativePath || !content) {
                  throw new Error("Parâmetros inválidos.");
                }

                const absolutePath = path.resolve(__dirname, 'MemorizaTudo-Repo', relativePath);
                const dir = path.dirname(absolutePath);

                if (!fs.existsSync(dir)) {
                  fs.mkdirSync(dir, { recursive: true });
                }

                const finalContent = isJson ? JSON.stringify(content, null, 2) : content;
                fs.writeFileSync(absolutePath, finalContent, 'utf-8');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, path: relativePath }));
              } catch (e: any) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
              }
            });
          });
        }
      },

      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['logo.png'],
        // --- AQUI ESTÁ A CORREÇÃO MÁGICA ---
        workbox: {
          // Se o usuário tentar acessar algo offline, joga pro index.html
          navigateFallback: '/index.html',
          // MAS... se a url começar com /api, NÃO intercepta (deixa ir pro servidor)
          navigateFallbackDenylist: [/^\/api/],
          // Aumentar o tamanho máximo cacheável para acomodar bibliotecas pesadas (ex: recharts)
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
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