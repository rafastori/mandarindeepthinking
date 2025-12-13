import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// --- SCHEMAS EXISTENTES (MANTIDOS) ---
const studyItemSchema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      chinese: { type: SchemaType.STRING },
      pinyin: { type: SchemaType.STRING },
      translation: { type: SchemaType.STRING },
      tokens: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      keywords: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
    },
    required: ["chinese", "pinyin", "translation", "tokens", "keywords"]
  }
};

const wordCardSchema = {
  type: SchemaType.OBJECT,
  properties: {
    word: { type: SchemaType.STRING },
    pinyin: { type: SchemaType.STRING },
    meaning: { type: SchemaType.STRING },
    example: { type: SchemaType.STRING }
  },
  required: ["word", "pinyin", "meaning", "example"]
};

// --- NOVOS SCHEMAS PARA O POLYQUEST ---
const polySourceSchema = {
  type: SchemaType.OBJECT,
  properties: {
    fullText: { type: SchemaType.STRING },
    selectedWords: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
  }
};

const polyIntruderSchema = {
    type: SchemaType.OBJECT,
    properties: {
      intruderWord: { type: SchemaType.STRING },
      modifiedText: { type: SchemaType.STRING }
    }
};

const polyBossSchema = {
    type: SchemaType.OBJECT,
    properties: {
      originalSentence: { type: SchemaType.STRING },
      shuffledBlocks: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
    }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { type, text, word, context, topic, difficulty, targetLanguage = 'zh', sourceLanguage = 'German' } = req.body; 
    
    const apiKey = process.env.VITE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API Key missing' });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    let result;
    let prompt = "";

    // --- ROTEAMENTO DE COMANDOS ---

    // 1. GERAÇÃO DE TEXTO BASE (PolyQuest)
    if (type === 'poly_source') {
        prompt = `Write a short, engaging paragraph (approx 60 words) in ${sourceLanguage} about "${topic || 'adventure'}". Then list 5 distinct words. Return JSON.`;
        result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", responseSchema: polySourceSchema }
        });
    }
    
    // 2. EVENTO INTRUSO (PolyQuest)
    else if (type === 'poly_intruder') {
        prompt = `Text: "${text}". Insert ONE anachronistic/absurd word in ${sourceLanguage} in the middle. Return JSON with the intruder word and the modified text.`;
        result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", responseSchema: polyIntruderSchema }
        });
    }

    // 3. EVENTO BOSS (PolyQuest)
    else if (type === 'poly_boss') {
        prompt = `Analyze text: "${text}". Find the longest sentence. Split it into 4-6 shuffled logical blocks. Return JSON.`;
        result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", responseSchema: polyBossSchema }
        });
    }

    // 4. CARD ÚNICO (Jogo da Memória e PolyQuest Enigmas)
    else if (type === 'card') {
        const langInfo = targetLanguage === 'zh' ? 'Mandarin Chinese' : 'German';
        prompt = `Analyze word: "${word}". Context: "${context || ''}". Language: ${langInfo}. Output PT-BR meanings.`;
        result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", responseSchema: wordCardSchema }
        });
    }
    
    // 5. IMPORTAÇÃO DE TEXTO (Padrão do App)
    else {
        let task = targetLanguage === 'de' ? "German text analysis" : "Mandarin text analysis";
        prompt = `${task}. Text: "${text}". RULES: Return JSON array. Segment text. 'keywords' must be []. TRANSLATE TO PORTUGUESE.`;
        result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", responseSchema: studyItemSchema }
        });
    }

    const jsonString = result.response.text();
    res.status(200).json(JSON.parse(jsonString));

  } catch (error) {
    console.error("ERRO BACKEND:", error);
    res.status(500).json({ error: error.message || "Erro interno" });
  }
}