import { GoogleGenAI, Type } from "@google/genai";

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
      word: { type: Type.STRING, description: "The word in target language" },
      pinyin: { type: Type.STRING, description: "Pronunciation" },
      meaning: { type: Type.STRING, description: "Translation" },
      example: { type: Type.STRING, description: "A simple usage example" }
    },
    required: ["word", "pinyin", "meaning", "example"]
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // ATUALIZAÇÃO 1: Recebemos 'exclude' do corpo da requisição
    const { text, mode, targetLanguage = 'zh', type = 'text', word, context, topic, difficulty, exclude = [] } = req.body; 
    
    const apiKey = process.env.VITE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API Key missing' });

    const ai = new GoogleGenAI({ apiKey });

    if (type === 'card') {
        const prompt = `Analyze word: "${word}". Context: "${context}". Language: ${targetLanguage === 'de' ? 'German' : 'Mandarin'}. Output PT-BR.`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: wordCardSchema },
        });
        return res.status(200).json(JSON.parse(response.text || "{}"));
    }

    if (type === 'game_deck') {
        const langName = targetLanguage === 'de' ? 'German' : 'Mandarin Chinese';
        
        // ATUALIZAÇÃO 2: Adicionamos a lista de exclusão ao prompt
        const excludeInstruction = exclude.length > 0 
            ? `IMPORTANT: Do NOT generate any of these words: ${exclude.join(', ')}.` 
            : '';

        const prompt = `
            Generate 5 distinct, useful words related to the topic: "${topic}".
            Level: ${difficulty} (CEFR).
            Language: ${langName}.
            Output PT-BR for meanings.
            Ensure words are different from each other.
            ${excludeInstruction}
        `;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { 
                responseMimeType: "application/json", 
                responseSchema: gameDeckSchema,
                temperature: 0.8 // Aumentei um pouco a criatividade para evitar repetições
            },
        });
        return res.status(200).json(JSON.parse(response.text || "[]"));
    }

    let task = targetLanguage === 'de' ? "German text analysis" : "Mandarin text analysis";
    if (mode === 'translate') task = `Translate PT-BR to ${targetLanguage === 'de' ? 'German' : 'Mandarin'}`;

    const prompt = `
      ${task}. Text: "${text}"
      RULES: 1. Return JSON array. 2. Segment text. 3. 'keywords' array MUST BE EMPTY [].
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: studyItemSchema, temperature: 0.1 },
    });

    res.status(200).json(JSON.parse(response.text || "[]"));

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
}