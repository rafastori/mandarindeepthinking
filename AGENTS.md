# MemorizaTudo — regras para agentes

## PRIMARY — versão em todo push/merge na `main`

Toda mudança que entra na `main` (push direto ou merge de PR) **DEVE** subir a versão do app.

1. **Bump de patch** em `package.json`: `0.1.3` → `0.1.4` → `0.1.5` … (minor/major só se o dono pedir).
2. O rodapé da home/intro (`components/Gamification/IntroScreen.tsx`) **DEVE** mostrar `v{versão} · {data/hora}` em **America/Sao_Paulo**, formato PT-BR, ex.: `v0.1.4 · 06/09/2026 19:05`.
3. `vite.config.ts` injeta `process.env.APP_VERSION` (de `package.json`) e `process.env.APP_BUILD_TIME` (calculado no build em São Paulo). Não inventar histórico de versões para PRs antigos — a regra vale daqui pra frente.
4. Checklist do PR:
   - [ ] `package.json` com a versão nova
   - [ ] rodapé com versão + timestamp de build
   - [ ] versão mencionada no corpo do PR

Ver também `.agent/workflows/version-bump-main.md`.
