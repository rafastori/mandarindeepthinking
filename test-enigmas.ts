
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Manual Load of .env.local because standard dotenv doesn't look there by default
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) {
    process.env[k] = envConfig[k];
}

async function testGemini() {
    console.log("--- Testing Gemini API (Enigmas) ---");
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error("❌ CRITICAL: GEMINI_API_KEY not found in .env.local");
        return;
    }
    const last4 = apiKey.slice(-4);
    console.log(`✅ API Key loaded. Ends with: ...${last4} (Length: ${apiKey.length})`);

    const genAI = new GoogleGenAI({ apiKey: apiKey });

    // Changing model to 1.5-flash to see if it bypasses the specific model quota
    const modelName = "gemini-1.5-flash";
    console.log(`Using Model: ${modelName}`);

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

    console.log("\n📡 Sending Request to Gemini...");

    try {
        const response = await genAI.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        const text = response.text;
        console.log("📩 Response received:");
        console.log(text ? text.substring(0, 200) + "..." : "EMPTY RESPONSE");

    } catch (error) {
        console.error("❌ API Call Failed.");
        // @ts-ignore
        if (error.response) {
            // @ts-ignore
            console.error("Status:", error.status);
            // @ts-ignore
            console.error("Details:", JSON.stringify(error.response, null, 2));
        } else {
            console.error(error);
        }
    }
}

testGemini();
