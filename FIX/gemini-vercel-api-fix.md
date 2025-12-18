# FIX: API Gemini não funciona na Vercel (mas funciona local)

**Data da correção:** 2025-12-18  
**Arquivo afetado:** `api/generate.js`

---

## Sintomas

- ✅ Funciona localmente com `npm run dev`
- ❌ Falha silenciosamente na Vercel em produção
- ❌ Requisições para `/api/generate` retornam erro ou timeout

---

## Causa

O SDK `@google/genai` (instalado no projeto) tem uma API diferente do `@google/generative-ai` (SDK antigo).

O arquivo `api/generate.js` estava usando a **sintaxe errada**.

---

## Diagnóstico Rápido

1. Acesse `https://[seu-dominio].vercel.app/api/test`
2. Se retornar `"status": "success"` → O problema é no `api/generate.js`
3. Se retornar erro de API Key → Configure `GEMINI_API_KEY` nas Environment Variables da Vercel

---

## Correção

### ❌ Sintaxe ERRADA (SDK antigo `@google/generative-ai`)

```javascript
import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey });
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const result = await model.generateContent({
  contents: [{ role: 'user', parts: [{ text: prompt }] }]
});
const response = await result.response;
const text = response.text(); // É UMA FUNÇÃO!
```

### ✅ Sintaxe CORRETA (SDK `@google/genai`)

```javascript
import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey });

const response = await genAI.models.generateContent({
  model: "gemini-2.5-flash",
  contents: prompt, // String direta, não array de objetos
  config: {
    systemInstruction: "Instruções do sistema aqui...",
    responseMimeType: "application/json",
  }
});
const text = response.text; // É UMA PROPRIEDADE, não função!
```

---

## Diferenças Chave

| Aspecto | SDK Antigo | SDK Novo (@google/genai) |
|---------|------------|--------------------------|
| Obter modelo | `genAI.getGenerativeModel()` | Não existe! |
| Gerar conteúdo | `model.generateContent()` | `genAI.models.generateContent()` |
| Estrutura contents | `[{ role, parts: [{ text }] }]` | String direta |
| Configuração | `generationConfig` | `config` |
| Obter texto | `response.text()` (função) | `response.text` (propriedade) |

---

## Helper Recomendado

Adicione este helper no início do arquivo `api/generate.js`:

```javascript
import { GoogleGenAI } from "@google/genai";

const callGemini = async (genAI, prompt, systemInstruction = "") => {
  const response = await genAI.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      systemInstruction: systemInstruction,
      responseMimeType: "application/json",
    }
  });
  
  const text = response.text;
  if (!text) throw new Error("Sem resposta da IA");
  
  const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleanText);
};
```

---

## Variáveis de Ambiente na Vercel

Certifique-se de ter configurado pelo menos uma destas variáveis:

1. `GEMINI_API_KEY` (recomendada)
2. `API_KEY`
3. `VITE_API_KEY`

O código procura nesta ordem de prioridade.

---

## Arquivos de Referência

- `api/test.js` - Endpoint de diagnóstico
- `api/generate.js` - Endpoint principal (corrigido)
- `services/gemini.ts` - Cliente frontend (usa SDK local em dev)
