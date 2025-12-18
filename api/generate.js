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

const enigmasSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      word: { type: Type.STRING },
      translation: { type: Type.STRING },
      synonym: { type: Type.STRING },
      alternatives: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["word", "translation", "synonym", "alternatives"]
  }
};

const intruderSchema = {
  type: Type.OBJECT,
  properties: {
    word: { type: Type.STRING },
    translation: { type: Type.STRING },
    reason: { type: Type.STRING }
  },
  required: ["word", "translation", "reason"]
};

const bossSchema = {
  type: Type.OBJECT,
  properties: {
    originalSentence: { type: Type.STRING },
    blocks: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ["originalSentence", "blocks"]
};

const rawTextSchema = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING }
  },
  required: ["text"]
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
    const {
      text, mode, targetLanguage = 'zh', type = 'text',
      word, context, topic, difficulty, exclude = [],
      words = [], sourceLang, targetLang
    } = req.body;

    // PRIORIDADE: GEMINI_API_KEY (segura) -> API_KEY -> VITE_API_KEY
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API Key missing' });

    const genAI = new GoogleGenAI({ apiKey });
    const MODEL_NAME = 'gemini-2.5-flash';
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: { responseMimeType: "application/json" }
    });

    // --- 1. GERAÇÃO DE CARD ---
    if (type === 'card') {
      const prompt = `Analyze word: "${word}". Context: "${context}". Language: ${targetLanguage === 'de' ? 'German' : 'Mandarin'}. Output PT-BR.`;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseSchema: wordCardSchema }
      });
      const response = await result.response;
      return res.status(200).json(JSON.parse(response.text() || "{}"));
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

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseSchema: gameDeckSchema, temperature: 0.8 }
      });
      const response = await result.response;
      return res.status(200).json(JSON.parse(response.text() || "[]"));
    }

    // --- 3. POLYQUEST: ENIGMAS ---
    if (type === 'enigmas') {
      const prompt = `Create study enigmas for these ${sourceLang} words: ${words.join(', ')}. Translate to ${targetLang}. Include 3 plausible alternatives and a synonym/clue in ${targetLang}.`;
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseSchema: enigmasSchema }
      });
      const response = await result.response;
      return res.status(200).json(JSON.parse(response.text() || "[]"));
    }

    // --- 4. POLYQUEST: INTRUDER ---
    if (type === 'intruder') {
      const prompt = `Create an intruder word for a game. Context words (${targetLang}): ${context.join(', ')}. The intruder should be in ${targetLang}. Provide PT-BR translation and reason.`;
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseSchema: intruderSchema }
      });
      const response = await result.response;
      return res.status(200).json(JSON.parse(response.text() || "{}"));
    }

    // --- 5. POLYQUEST: BOSS ---
    if (type === 'boss') {
      const prompt = `Final Boss Challenge. From this text: "${context}", choose ONE short sentence (not the full text). 
      Return:
      - originalSentence: the chosen sentence in ${targetLang}
      - blocks: the sentence divided into 4-6 logical chunks, SHUFFLED
      
      Rules for blocks:
      1. Divide by phrases/syntagms, NOT word-by-word
      2. Each block should make grammatical sense
      3. Shuffle the blocks array
      4. Do NOT include translation`;
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseSchema: bossSchema }
      });
      const response = await result.response;
      return res.status(200).json(JSON.parse(response.text() || "{}"));
    }

    // --- 6. POLYQUEST: RAW TEXT ---
    if (type === 'raw_text') {
      const prompt = `Generate a creative text (40-60 words) in ${targetLang}. Theme: Culture or History. Return only the text object.`;
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseSchema: rawTextSchema }
      });
      const response = await result.response;
      return res.status(200).json(JSON.parse(response.text() || "{}"));
    }

    // --- DEFAULT: IMPORTAÇÃO DE TEXTO ---
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

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseSchema: studyItemSchema, temperature: 0.1 }
    });
    const response = await result.response;
    return res.status(200).json(JSON.parse(response.text() || "[]"));

  } catch (error) {
    console.error("ERRO API:", error);
    res.status(500).json({ error: error.message || "Erro interno" });
  }
}