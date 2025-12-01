
import { GoogleGenAI, Type } from "@google/genai";

// Schema definition
const studyItemSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      chinese: { type: Type.STRING, description: "The sentence text in the target language (Chinese Hanzi or German)." },
      pinyin: { type: Type.STRING, description: "Phonetic transcription (Pinyin for Chinese, IPA for German)." },
      translation: { type: Type.STRING, description: "Portuguese (PT-BR) translation of the sentence." },
      tokens: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "The sentence segmented into individual tokens (words/punctuation)."
      },
      keywords: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING, description: "The word in the target language." },
            pinyin: { type: Type.STRING, description: "Phonetic transcription for this word." },
            meaning: { type: Type.STRING, description: "Portuguese (PT-BR) meaning of this specific word." }
          },
          required: ["word", "pinyin", "meaning"]
        },
        description: "List of ALL meaningful words in the sentence."
      }
    },
    required: ["chinese", "pinyin", "translation", "tokens", "keywords"]
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, mode, targetLanguage = 'zh' } = req.body; // Default to 'zh'

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const apiKey = process.env.VITE_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Server configuration error: API Key missing' });
    }

    const ai = new GoogleGenAI({ apiKey });

    let taskInstruction = "";
    
    // --- LÓGICA PARA ALEMÃO ---
    if (targetLanguage === 'de') {
        if (mode === 'translate') {
            taskInstruction = `
              TASK:
              1. Translate the following Portuguese text into natural German (Deutsch).
              2. IMPORTANT: The 'chinese' field in the JSON output MUST be the German translation.
              3. The 'translation' field should be the Portuguese meaning (the input text).
            `;
        } else {
            taskInstruction = `
              TASK:
              1. Analyze the following German text.
              2. The 'chinese' field MUST contain the German text.
            `;
        }
        
        taskInstruction += `
          DETAILS:
          - Use the 'pinyin' field to store the IPA (International Phonetic Alphabet) pronunciation enclosed in brackets, e.g., /.../.
          - Segment words correctly based on German grammar.
        `;

    // --- LÓGICA PARA CHINÊS ---
    } else {
        if (mode === 'translate') {
            taskInstruction = `
              TASK:
              1. Translate the following Portuguese text into NATURAL, modern Simplified Chinese (Mandarin).
              2. The 'chinese' field in the JSON output MUST be the Chinese translation (Hanzi only).
              3. The 'translation' field should be the Portuguese meaning (the input text).
            `;
        } else {
            taskInstruction = `
              TASK:
              1. Analyze the following Mandarin Chinese text.
              2. Ensure the 'chinese' field contains only Hanzi (Chinese characters).
            `;
        }
        taskInstruction += `
          DETAILS:
          - Use the 'pinyin' field for Pinyin with tone marks.
        `;
    }

    const prompt = `
      ${taskInstruction}
      
      STEPS FOR ANALYSIS:
      1. Segment the text into logical sentences.
      2. For each sentence, provide the Phonetic Transcription (Pinyin or IPA) and Portuguese translation.
      3. Segment the sentence into tokens.
      4. CRITICAL: For EVERY meaningful token (word) in the sentence, create a keyword entry with its phonetics and Portuguese meaning.
      
      Text to process:
      "${text}"
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: studyItemSchema,
        temperature: 0.1,
      },
    });

    const jsonResponse = JSON.parse(response.text || "[]");
    res.status(200).json(jsonResponse);

  } catch (error) {
    console.error("Backend Error:", error);
    res.status(500).json({ error: 'Failed to process text', details: error.message });
  }
}
