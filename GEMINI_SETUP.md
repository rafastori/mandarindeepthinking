# Gemini API Integration Guide

This project uses a **Hybrid Architecture** for the Gemini API to ensuring it works both locally (for rapid development) and in production (for security).

## 1. The Architecture

### **Local Development (`npm run dev`)**
- **Mode**: User's Browser -> Direct call to Google Gemini API.
- **Why**: Fastest way to test. No complex server setup required.
- **Key File**: `.env.local`
- **Required Variable**: `GEMINI_API_KEY=AIza...`
- **Code Logic**: `if (import.meta.env.DEV) { ... use GoogleGenAI SDK ... }`

### **Production (Vercel)**
- **Mode**: User's Browser -> Vercel Server Function (`/api/generate`) -> Google Gemini API.
- **Why**: Hides the API Key from the public. Security best practice.
- **Key File**: Vercel Dashboard > Settings > Environment Variables.
- **Required Variable**: `GEMINI_API_KEY` (Server-side).
- **Code Logic**: `else { fetch('/api/generate', ...) }`

---

## 2. Troubleshooting Checklist (If it stops working)

If the API fails in the future, follow this checklist IN ORDER. Do not guess.

### **Step 1: Create an Isolation Script**
Create a file named `test-debug.js` with the following content to test your Key and SDK:

```javascript
import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';

function getApiKey() {
    try {
        const envPath = path.resolve(process.cwd(), '.env.local');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf-8');
            const match = content.match(/GEMINI_API_KEY=(.*)/);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
    } catch (e) { console.error(e); }
    return null;
}

async function testConnection() {
    console.log("--- Teste Gemini ---");
    const apiKey = getApiKey();
    if (!apiKey) { console.error("Sem chave no .env.local"); return; }
    
    try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: "Say Hello",
        });
        console.log("Sucesso:", response.text);
    } catch (e) {
        console.error("Erro:", e);
    }
}
testConnection();
```

Run it with:
```bash
node test-debug.js
```
- **If this fails**: Your API Key is invalid, or you have no internet, or the `@google/genai` library has a breaking change.
- **If this works**: The problem is in the React/Vite integration (Step 2).

### **Step 2: Check `.env.local`**
Ensure you have a file named `.env.local` in the project root (not `.env`).
Content must be:
```
GEMINI_API_KEY=seu_token_aqui
```

### **Step 3: Check `vite.config.ts`**
The Vite config MUST expose the environment variable to the browser code or the SDK won't find it.
Look for this block:
```typescript
define: {
  'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
}
```

### **Step 4: Check SDK Syntax (`services/gemini.ts`)**
This project uses the newer `@google/genai` library.
- **CORRECT**: `response.text` (Property)
- **INCORRECT** (Old SDK): `response.text()` (Function)

---

## 3. Important Implementation Details

### Handling "Modes" (Translation vs Analysis)
The service function `processTextWithGemini` accepts a `mode` parameter.
- `mode: 'direct'` -> Prompt asks for analysis of the text as-is.
- `mode: 'translate'` -> Prompt explicitly asks to **translate** the text to the target language FIRST, then analyze.

**Crucial**: You must pass this `mode` to the prompt generator function!
```typescript
const systemPrompt = getSystemInstruction('analysis', targetLanguage, mode); // <--- PASS MODE HERE
```

## Summary for AI Assistants
If asking an AI to fix this project:
*"This project allows direct SDK usage in DEV mode using `import.meta.env.DEV`. verification of `.env.local` and correct SDK syntax (`@google/genai`) is required."*
