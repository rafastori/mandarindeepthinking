
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { callOpenRouterText, TEXT_MODEL } from './lib/openrouter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getApiKey() {
    try {
        const envPath = path.resolve(process.cwd(), '.env.local');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf-8');
            const match = content.match(/^OPENROUTER_API_KEY=(.*)$/m);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
    } catch (e) { console.error(e); }
    return null;
}

async function testConnection() {
    console.log("--- Teste OpenRouter (texto) ---");
    const apiKey = getApiKey();
    if (!apiKey) { console.error("Sem OPENROUTER_API_KEY no .env.local"); return; }

    console.log(`Key Loaded: ...${apiKey.slice(-4)}`);
    console.log(`Model: ${TEXT_MODEL}`);

    try {
        const text = await callOpenRouterText("Say Hello", "", false, apiKey);
        console.log("Sucesso, Texto gerado:", text);
    } catch (e) {
        console.error("Erro na chamada:", e);
        if (e.response) { console.error("Details:", JSON.stringify(e.response)); }
    }
}
testConnection();
