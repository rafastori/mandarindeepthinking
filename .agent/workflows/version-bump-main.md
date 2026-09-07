---
description: PRIMARY — bump de versão e timestamp de São Paulo em todo merge/push na main
---

# PRIMARY: versão a cada push/merge na `main`

Esta regra é **obrigatória** para qualquer mudança que entre na `main`.

## O que fazer

1. Subir o patch em `package.json` (`0.1.4` → `0.1.5` → …). Minor/major só se o dono pedir.
2. Confirmar que `vite.config.ts` injeta:
   - `process.env.APP_VERSION` a partir de `package.json`
   - `process.env.APP_BUILD_TIME` no fuso **America/Sao_Paulo** (PT-BR, `dd/mm/aaaa hh:mm`)
3. O rodapé em `components/Gamification/IntroScreen.tsx` deve renderizar `v{versão} · {APP_BUILD_TIME}`.
4. Fallback da versão no IntroScreen deve acompanhar a versão atual do `package.json`.
5. Citar a versão nova no corpo do PR.

## Checklist

- [ ] `package.json` version bumped
- [ ] Footer shows new version + São Paulo build time
- [ ] PR body mentions the version

Não inventar versões retroativas para commits antigos. A regra vale só daqui pra frente.
