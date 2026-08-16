
import dotenv from 'dotenv';
import fs from 'fs';
import { callOpenRouterText, TEXT_MODEL } from './lib/openrouter.js';

const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) {
    process.env[k] = envConfig[k];
}

async function testEnigmas() {
    console.log("--- Testing OpenRouter API (Enigmas) ---");
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
        console.error("❌ CRITICAL: OPENROUTER_API_KEY not found in .env.local");
        return;
    }
    const last4 = apiKey.slice(-4);
    console.log(`✅ API Key loaded. Ends with: ...${last4} (Length: ${apiKey.length})`);
    console.log(`Using Model: ${TEXT_MODEL}`);

    const words = ["Haus", "Katze", "Hund", "Schule"];
    const sourceLang = "Alemão";
    const targetLang = "Português";

    const prompt = `Você é um tradutor especialista e criador de jogos.
    Receberá uma lista de palavras em ${sourceLang}.
    Para cada palavra, retorne um objeto JSON com:
    {
      "word": "a palavra original",
      "translation": "a tradução correta para ${targetLang}",
      "alternatives": ["alternativa incorreta 1", "alternativa incorreta 2", "alternativa incorreta 3"],
      "synonym": "um sinônimo ou definição breve em ${targetLang} (para dica)"
    }
    Retorne APENAS o JSON.
    Palavras: ${JSON.stringify(words)}`;

    console.log("\n📡 Sending Request to OpenRouter...");

    try {
        const data = await callOpenRouterText(prompt, "", true, apiKey);
        const preview = JSON.stringify(data).substring(0, 200);
        console.log("📩 Response received:");
        console.log(preview + "...");

    } catch (error) {
        console.error("❌ API Call Failed.");
        console.error(error);
    }
}

testEnigmas();
