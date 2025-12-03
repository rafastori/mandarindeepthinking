import { GoogleGenAI, Type } from "@google/genai";

// Schema Otimizado: Apenas estrutura do texto, sem definições profundas
const studyItemSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      chinese: { type: Type.STRING, description: "The sentence text in the target language." },
      pinyin: { type: Type.STRING, description: "Phonetic transcription (Pinyin or IPA)." },
      translation: { type: Type.STRING, description: "Portuguese translation." },
      tokens: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "The sentence segmented into tokens."
      },
      // Array vazio forçado para manter compatibilidade sem gastar tokens
      keywords: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Return an empty array."
      }
    },
    required: ["chinese", "pinyin", "translation", "tokens", "keywords"]
  }
};

// Schema para o Card Único (Sob Demanda)
const wordCardSchema = {
  type: Type.OBJECT,
  properties: {
    word: { type: Type.STRING, description: "The word analyzed." },
    pinyin: { type: Type.STRING, description: "Pinyin/IPA." },
    meaning: { type: Type.STRING, description: "Portuguese definition in context." },
    example: { type: Type.STRING, description: "Short example sentence." }
  },
  required: ["word", "pinyin", "meaning", "example"]
};

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { text, mode, targetLanguage = 'zh', type = 'text', word, context } = req.body; 
    const apiKey = process.env.VITE_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) return res.status(500).json({ error: 'API Key missing' });

    const ai = new GoogleGenAI({ apiKey });

    // --- ROTA 1: GERAR CARD ÚNICO (Clique do Usuário) ---
    if (type === 'card') {
        const prompt = `
            Analyze word: "${word}". Context: "${context}".
            Language: ${targetLanguage === 'de' ? 'German' : 'Mandarin'}.
            Output PT-BR.
        `;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: wordCardSchema },
        });
        return res.status(200).json(JSON.parse(response.text || "{}"));
    }

    // --- ROTA 2: PROCESSAMENTO DE TEXTO (Importação Rápida) ---
    let task = targetLanguage === 'de' ? "German text analysis" : "Mandarin text analysis";
    if (mode === 'translate') task = `Translate PT-BR to ${targetLanguage === 'de' ? 'German' : 'Mandarin'}`;

    const prompt = `
      ${task}.
      Text: "${text}"
      RULES:
      1. Return JSON array.
      2. Segment text into 'tokens'.
      3. 'pinyin' field = Pinyin (Chinese) or IPA (German).
      4. CRITICAL: 'keywords' array MUST BE EMPTY []. Do not define words yet.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { 
          responseMimeType: "application/json", 
          responseSchema: studyItemSchema,
          temperature: 0.1 
      },
    });

    res.status(200).json(JSON.parse(response.text || "[]"));

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
}