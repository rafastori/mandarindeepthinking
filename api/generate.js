// API Gemini - Usando sintaxe correta do @google/genai
import { GoogleGenAI } from "@google/genai";

// Helper para chamar o modelo Gemini
const callGemini = async (genAI, prompt, systemInstruction = "") => {
  const response = await genAI.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      systemInstruction: systemInstruction,
      responseMimeType: "application/json",
    }
  });

  const text = response.text;
  if (!text) throw new Error("Sem resposta da IA");

  // Limpa formatação markdown se houver
  const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleanText);
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

    // --- 1. GERAÇÃO DE CARD ---
    if (type === 'card') {
      const langNames = {
        'de': 'Alemão', 'zh': 'Chinês (Mandarim)', 'pt': 'Português', 'en': 'Inglês',
        'fr': 'Francês', 'es': 'Espanhol', 'it': 'Italiano', 'ja': 'Japonês', 'ko': 'Coreano'
      };
      const langName = langNames[targetLanguage] || targetLanguage;
      const isCJK = ['zh', 'ja', 'ko'].includes(targetLanguage);

      const systemPrompt = `Você é um professor de ${langName}.
        Crie um cartão de estudo detalhado para a palavra/expressão solicitada.
        Retorne APENAS um JSON com o formato:
        { "word": "...", "pinyin": "...", "meaning": "...", "example": "..." }
        ${isCJK ? 'O campo pinyin deve conter a transcrição fonética.' : 'O campo pinyin deve ser deixado vazio ou com null.'}
        O significado (meaning) deve ser em Português.`;

      const userPrompt = `Palavra: "${word}". Contexto: "${context}"`;
      const result = await callGemini(genAI, userPrompt, systemPrompt);
      return res.status(200).json(result);
    }

    // --- 2. GERAÇÃO DE JOGO ---
    if (type === 'game_deck') {
      const langNames = {
        'de': 'Alemão', 'zh': 'Chinês (Mandarim)', 'pt': 'Português', 'en': 'Inglês',
        'fr': 'Francês', 'es': 'Espanhol', 'it': 'Italiano', 'ja': 'Japonês', 'ko': 'Coreano'
      };
      const langName = langNames[targetLanguage] || targetLanguage;
      const isCJK = ['zh', 'ja', 'ko'].includes(targetLanguage);
      const excludeInstruction = exclude.length > 0 ? `Evite as palavras: ${exclude.join(', ')}.` : '';

      const systemPrompt = `Você é um criador de jogos educativos de ${langName}.
        Crie um deck de cartas para o tópico solicitado.
        Retorne APENAS um Array JSON de objetos.
        Cada objeto (carta) deve ter:
        { "word": "...", "pinyin": "...", "meaning": "...", "example": "...", "distractors": ["significado errado 1", "significado errado 2", "significado errado 3"] }
        ${isCJK ? 'O campo pinyin deve conter a transcrição fonética.' : 'O campo pinyin deve ser deixado vazio ou com null.'}
        Os significados e distratores devem ser em Português.`;

      const userPrompt = `Tópico: ${topic}. Dificuldade: ${difficulty}. Gere 5 palavras distintas. ${excludeInstruction}`;
      const result = await callGemini(genAI, userPrompt, systemPrompt);
      return res.status(200).json(result);
    }

    // --- 3. POLYQUEST: ENIGMAS ---
    if (type === 'enigmas') {
      const systemPrompt = `Você é um tradutor especialista e criador de jogos.
        NÍVEL DE LINGUAGEM DESEJADO: ${difficulty}. (Crie enigmas apropriados para este nível).
        
        CONTEXTO (TEXTO BASE):
        Receberá uma lista de palavras em ${sourceLang}.
        Para cada palavra, retorne um objeto JSON com:
        {
          "word": "a palavra original",
          "translation": "a tradução correta para ${targetLang}",
          "alternatives": ["alternativa incorreta 1", "alternativa incorreta 2", "alternativa incorreta 3"],
          "synonym": "um sinônimo ou definição breve em ${targetLang} (para dica)"
        }
        As alternativas devem ser plausíveis mas incorretas.
        Retorne APENAS o JSON Array.`;

      const userPrompt = `Palavras para criar enigmas: ${JSON.stringify(words)}`;
      const result = await callGemini(genAI, userPrompt, systemPrompt);
      return res.status(200).json(result);
    }

    // --- 4. POLYQUEST: INTRUDER ---
    if (type === 'intruder') {
      const systemPrompt = `Você é um criador de jogos de linguagem.
        Seu objetivo é criar uma "Palavra Intrusa" para um jogo de desafio.
        NÍVEL DE LINGUAGEM DESEJADO: ${difficulty}.
        
        CONTEXTO (TEXTO BASE):
        Dado um texto ou lista de palavras, sugira uma palavra que NÃO pertença ao contexto, mas adequada ao nível ${difficulty}.
        
        Retorne APENAS um JSON:
        {
            "word": "palavra intrusa no idioma original",
            "translation": "tradução em Português",
            "reason": "breve explicação do porquê é intruso"
        }`;

      const userPrompt = `Contexto (palavras do texto em ${targetLang}): ${Array.isArray(context) ? context.slice(0, 20).join(', ') : context}`;
      const result = await callGemini(genAI, userPrompt, systemPrompt);
      return res.status(200).json(result);
    }

    // --- 5. POLYQUEST: BOSS ---
    if (type === 'boss') {
      const systemPrompt = `Você é um 'Boss Final' de um jogo de idiomas.
        Seu objetivo é desafiar os jogadores a reconstruir uma frase curta.
        NÍVEL DE LINGUAGEM DESEJADO: ${difficulty}. (Escolha uma frase com complexidade adequada ao nível).
        
        CONTEXTO (TEXTO BASE):
        Dado um texto, escolha UMA frase curta (não o texto completo).
        Retorne APENAS um JSON:
        {
            "originalSentence": "A frase escolhida no idioma estudado",
            "blocks": ["bloco1", "bloco2", "bloco3", "bloco4"]
        }
        Regras para os blocos:
        1. Divida a frase em 4 a 6 pedaços lógicos (chunks).
        2. NÃO divida palavra por palavra, mas sim por sintagmas.
        3. Embaralhe os blocos no array de retorno.
        4. NÃO inclua tradução.`;

      const userPrompt = `Texto base em ${targetLang}: ${context}`;
      const result = await callGemini(genAI, userPrompt, systemPrompt);
      return res.status(200).json(result);
    }

    // --- 6. POLYQUEST: RAW TEXT ---
    if (type === 'raw_text') {
      const { customPrompt } = req.body;
      const langNames = { 'de': 'Alemão', 'zh': 'Chinês', 'pt': 'Português', 'en': 'Inglês', 'fr': 'Francês', 'es': 'Espanhol', 'it': 'Italiano', 'ja': 'Japonês', 'ko': 'Coreano' };
      const langName = langNames[targetLang] || targetLang;

      const systemPrompt = `Você é um escritor criativo poliglota.
        Escreva um texto curto, interessante e coerente em ${langName}.
        O texto deve ter aproximadamente 40 a 60 palavras.
        
        Retorne APENAS um JSON:
        {
            "text": "O texto gerado aqui..."
        }`;

      // Usa o customPrompt se fornecido, senão gera tema variado
      const hasCustomPrompt = customPrompt && customPrompt.trim().length > 0;
      const userPrompt = hasCustomPrompt
        ? `Gere um texto em ${langName} sobre: ${customPrompt.trim()}`
        : `Gere um texto em ${langName}. O tema deve ser variado (cultura, cotidiano, curiosidades, história).`;

      const result = await callGemini(genAI, userPrompt, systemPrompt);
      return res.status(200).json(result);
    }

    // --- 7. POLYQUEST: TOKENIZAÇÃO ---
    if (type === 'tokenize') {
      const langNames = { 'de': 'Alemão', 'zh': 'Chinês', 'pt': 'Português', 'en': 'Inglês', 'fr': 'Francês', 'es': 'Espanhol', 'it': 'Italiano', 'ja': 'Japonês', 'ko': 'Coreano' };
      const langName = langNames[targetLang] || targetLang;

      const systemPrompt = `Você é um segmentador de texto especializado.
Segmente o texto fornecido em tokens (palavras ou unidades significativas).

REGRAS POR TIPO DE IDIOMA:
- Para Chinês (zh): Segmente por palavras/morfemas lógicos, não caractere por caractere. Ex: "你好世界" → ["你好", "世界"]
- Para Japonês (ja): Segmente por palavras, separando partículas. Ex: "日本語を勉強" → ["日本語", "を", "勉強"]
- Para Coreano (ko): Segmente por palavras (usa espaços naturalmente). Ex: "안녕하세요 세계" → ["안녕하세요", "세계"]
- Para idiomas ocidentais (de, fr, es, it, en, pt): Segmente por palavras, mantendo pontuação separada. Ex: "Guten Tag!" → ["Guten", "Tag", "!"]

IMPORTANTE: Preserve espaços como tokens separados (" ") para manter a formatação visual.

Retorne APENAS um JSON: { "tokens": ["token1", " ", "token2", ...] }`;

      const userPrompt = `Idioma: ${langName}. Texto: "${text}"`;
      const result = await callGemini(genAI, userPrompt, systemPrompt);
      return res.status(200).json(result);
    }

    // --- DEFAULT: IMPORTAÇÃO DE TEXTO ---
    const langNames = {
      'de': 'Alemão', 'zh': 'Chinês (Mandarim)', 'pt': 'Português', 'en': 'Inglês',
      'fr': 'Francês', 'es': 'Espanhol', 'it': 'Italiano', 'ja': 'Japonês', 'ko': 'Coreano'
    };
    const langName = langNames[targetLanguage] || targetLanguage;

    let systemPrompt = `Você é um professor experiente de ${langName}.`;

    if (mode === 'translate') {
      systemPrompt += `
        O texto fornecido pelo usuário está em outra língua (provavelmente Português ou Inglês).
        SUA TAREFA:
        1. Traduza o texto para ${langName}.
        2. Analise o texto JÁ TRADUZIDO em ${langName}.`;
    } else {
      systemPrompt += `
        Analise o texto fornecido (que já está em ${langName}).`;
    }

    const isCJK = ['zh', 'ja', 'ko'].includes(targetLanguage);
    systemPrompt += `
        Retorne APENAS um JSON (sem markdown).
        O JSON deve ser uma lista (Array) de objetos, onde cada objeto representa uma frase/segmento do texto.
        Cada objeto deve ter:
        - chinese: a frase em ${langName} (original ou traduzida)
        - pinyin: ${isCJK ? 'transcrição fonética' : 'deixe vazio ou null'}
        - translation: tradução para Português (Brasil)
        - tokens: array de strings com as palavras segmentadas
        - keywords: array vazio []`;

    const userPrompt = `Texto para analisar: "${text}"`;
    const result = await callGemini(genAI, userPrompt, systemPrompt);
    return res.status(200).json(result);

  } catch (error) {
    console.error("ERRO API:", error);
    res.status(500).json({ error: error.message || "Erro interno" });
  }
}