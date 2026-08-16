# Integração de LLMs (OpenRouter + Gemini)

Arquitetura híbrida: texto via **OpenRouter** (`deepseek/deepseek-v4-flash-0731`) e embeddings via **Gemini**.

## 1. Arquitetura

### **Local (`npm run dev`)**
- **Texto**: o browser chama o OpenRouter diretamente.
- **Embeddings**: o browser chama o Gemini diretamente (mapa neural).
- **Arquivo**: `.env.local`
- **Variáveis**:
  - `OPENROUTER_API_KEY=sk-or-...`
  - `GEMINI_API_KEY=AIza...` (só embeddings)

### **Produção (Vercel)**
- **Texto**: browser → `/api/generate` → OpenRouter.
- **Embeddings**: browser → `/api/generate` (`type: embeddings`) → Gemini.
- **Variáveis no Dashboard da Vercel** (Production, Preview e Development):
  - `OPENROUTER_API_KEY` (server-side)
  - `GEMINI_API_KEY` (server-side, embeddings)

---

## 2. Checklist se a API parar

### Passo 1: Script isolado
```bash
node test-debug.js
```
O script lê `OPENROUTER_API_KEY` de `.env.local` e chama o DeepSeek V4 Flash.

### Passo 2: `.env.local`
```
OPENROUTER_API_KEY=sk-or-v1-...
GEMINI_API_KEY=AIza...
```

### Passo 3: `vite.config.ts`
O Vite precisa expor as chaves no DEV:
```typescript
define: {
  'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
  'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
  'process.env.OPENROUTER_API_KEY': JSON.stringify(mode === 'development' ? env.OPENROUTER_API_KEY : ''),
}
```

### Passo 4: Diagnóstico em produção
Acesse `https://[seu-dominio].vercel.app/api/test`.
- `"status": "success"` → OpenRouter ok
- erro de API Key → configure `OPENROUTER_API_KEY` nas Environment Variables da Vercel

---

## 3. O que permanece no Gemini

Apenas embeddings (`gemini-embedding-2-preview`) usados pelo Cosmos Semântico / mapa neural.
