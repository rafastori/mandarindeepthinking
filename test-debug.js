
import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Handling __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    console.log("--- Teste Gemini (Standard Debug) ---");
    const apiKey = getApiKey();
    if (!apiKey) { console.error("Sem chave no .env.local"); return; }

    // Mask Key
    console.log(`Key Loaded: ...${apiKey.slice(-4)}`);

    try {
        const ai = new GoogleGenAI({ apiKey });

        // Changing to a known working model
        const modelName = 'gemini-2.5-flash';
        console.log(`Model: ${modelName}`);

        const response = await ai.models.generateContent({
            model: modelName,
            contents: "Say Hello",
        });
        console.log("Sucesso, Texto gerado:", response.text);
    } catch (e) {
        console.error("Erro na chamada:", e);
        // @ts-ignore
        if (e.response) { console.error("Details:", JSON.stringify(e.response)); }
    }
}
testConnection();
