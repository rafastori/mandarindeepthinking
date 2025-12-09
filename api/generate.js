// Usando a biblioteca que funcionou no seu teste
import { GoogleGenAI, Type } from "@google/genai";

// Schemas configurados com 'Type' (sintaxe da @google/genai)
const studyItemSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      chinese: { type: Type.STRING },
      pinyin: { type: Type.STRING },
      translation: { type: Type.STRING },
      tokens: { type: Type.ARRAY, items: { type: Type.STRING } },
      keywords: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["chinese", "pinyin", "translation", "tokens", "keywords"]
  }
};

const wordCardSchema = {
  type: Type.OBJECT,
  properties: {
    word: { type: Type.STRING },
    pinyin: { type: Type.STRING },
    meaning: { type: Type.STRING },
    example: { type: Type.STRING }
  },
  required: ["word", "pinyin", "meaning", "example"]
};

const gameDeckSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      word: { type: Type.STRING, description: "Word" },
      pinyin: { type: Type.STRING, description: "Pronunciation" },
      meaning: { type: Type.STRING, description: "Translation (PT-BR)" },
      example: { type: Type.STRING, description: "Example sentence" },
      distractors: { 
          type: Type.ARRAY, 
          items: { type: Type.STRING },
          description: "3 plausible but INCORRECT translations in PT-BR"
      }
    },
    required: ["word", "pinyin", "meaning", "example", "distractors"]
  }
};

export default async function handler(req, res) {
  // Headers CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { text, mode, targetLanguage = 'zh', type = 'text', word, context, topic, difficulty, exclude = [] } = req.body; 
    
    const apiKey = process.env.VITE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API Key missing' });

    // Inicializa com a biblioteca NOVA
    const ai = new GoogleGenAI({ apiKey });
    
    // MODELO: Usamos o que você confirmou que funciona
    const MODEL_NAME = 'gemini-2.5-flash';

    // --- 1. GERAÇÃO DE CARD ---
    if (type === 'card') {
        const prompt = `Analyze word: "${word}". Context: "${context}". Language: ${targetLanguage === 'de' ? 'German' : 'Mandarin'}. Output PT-BR.`;
        
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: wordCardSchema,
            }
        });
        // Na lib @google/genai, .text pode ser propriedade direta ou função dependendo da versão exata,
        // mas o padrão JSON geralmente vem tratado ou acessível via .text() ou .text
        const jsonText = typeof response.text === 'function' ? response.text() : response.text;
        return res.status(200).json(JSON.parse(jsonText || "{}"));
    }

    // --- 2. GERAÇÃO DE JOGO ---
    if (type === 'game_deck') {
        const langName = targetLanguage === 'de' ? 'German' : 'Mandarin Chinese';
        const excludeInstruction = exclude.length > 0 ? `Avoid words: ${exclude.join(', ')}.` : '';

        const prompt = `
            Generate 5 distinct words for topic: "${topic}".
            Level: ${difficulty}. Language: ${langName}.
            Output PT-BR meanings.
            ${excludeInstruction}
        `;
        
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: { 
                responseMimeType: "application/json", 
                responseSchema: gameDeckSchema,
                temperature: 0.8
            },
        });
        
        const jsonText = typeof response.text === 'function' ? response.text() : response.text;
        return res.status(200).json(JSON.parse(jsonText || "[]"));
    }

    // --- 3. IMPORTAÇÃO DE TEXTO ---
    let task = targetLanguage === 'de' ? "German text analysis" : "Mandarin text analysis";
    if (mode === 'translate') task = `Translate PT-BR to ${targetLanguage === 'de' ? 'German' : 'Mandarin'}`;

    const prompt = `
      ${task}. Text: "${text}"
      RULES: 
      1. Return JSON array. 
      2. Segment text. 
      3. 'keywords' array MUST BE EMPTY [].
      4. TRANSLATE TO PORTUGUESE (PT-BR).
    `;

    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: { 
            responseMimeType: "application/json", 
            responseSchema: studyItemSchema, 
            temperature: 0.1 
        },
    });

    const jsonText = typeof response.text === 'function' ? response.text() : response.text;
    res.status(200).json(JSON.parse(jsonText || "[]"));

  } catch (error) {
    console.error("ERRO API:", error);
    res.status(500).json({ error: error.message || "Erro interno" });
  }
}