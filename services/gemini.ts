/// <reference types="vite/client" />

import { GoogleGenAI } from "@google/genai";
import { StudyItem, Keyword, GameCard, SupportedLanguage } from "../types";

// Exportamos a interface também daqui se precisar, ou usamos a do types.ts
export { type GameCard } from "../types";

// Configuração do cliente local
const API_KEY = process.env.API_KEY || '';
console.log('[Gemini] API Key status:', API_KEY ? `Loaded (${API_KEY.substring(0, 8)}...)` : 'MISSING!');
const genAI = new GoogleGenAI({ apiKey: API_KEY });
const MODEL_NAME = 'gemini-2.5-flash';

// URL de produção (Vercel Functions)
const API_URL = '/api/generate';

// --- FUNÇÕES AUXILIARES PARA GERAÇÃO LOCAL (PROMPTS) ---

const getSystemInstruction = (type: string, targetLang: string, mode: 'direct' | 'translate' | string = 'direct', difficulty: string = 'Iniciante') => {
    const langNames: Record<string, string> = {
        'de': 'Alemão', 'zh': 'Chinês (Mandarim Simplificado)', 'pt': 'Português', 'en': 'Inglês',
        'fr': 'Francês', 'es': 'Espanhol', 'it': 'Italiano', 'ja': 'Japonês', 'ko': 'Coreano'
    };
    const langName = langNames[targetLang] || targetLang;

    if (type === 'analysis') {
        let prompt = `Você é um professor experiente de ${langName}.`;

        if (mode === 'translate') {
            prompt += `
    O texto fornecido pelo usuário está em outra língua (provavelmente Português ou Inglês).
    SUA TAREFA:
    1. Traduza o texto para ${langName}.
    2. Analise o texto JÁ TRADUZIDO em ${langName}.
    `;
        } else {
            prompt += `
    Analise o texto fornecido (que já está em ${langName}).
    `;
        }

        prompt += `
    Retorne APENAS um JSON (sem markdown).
    O JSON deve ser uma lista (Array) de objetos, onde cada objeto representa uma frase/segmento do texto.
    Cada objeto deve ter:
    - chinese: a frase em ${langName} (original ou traduzida)
    - pinyin: transcrição fonética (se chinês) ou nulo/vazio (se alemão)
    - translation: tradução para Português (Brasil)
    - tokens: array de strings com as palavras segmentadas
    - keywords: array de objetos { id, word, pinyin, meaning } das palavras chave
    `;
        return prompt;
    }

    if (type === 'card') {
        const isCJK = ['zh', 'ja', 'ko'].includes(targetLang);
        return `Você é um professor de ${langName}.
    Crie um cartão de estudo detalhado para a palavra/expressão solicitada.
    Retorne APENAS um JSON com o formato:
    { "word": "...", "pinyin": "...", "meaning": "...", "language": "${targetLang}" }
    ${isCJK ? 'O campo pinyin deve conter a transcrição fonética.' : 'O campo pinyin deve ser deixado vazio ou com null.'}
    O significado (meaning) deve ser em Português.`;
    }

    if (type === 'game') {
        const isCJK = ['zh', 'ja', 'ko'].includes(targetLang);
        return `Você é um criador de jogos educativos de ${langName}.
    Crie um deck de cartas para o tópico solicitado.
    Retorne APENAS um Array JSON de objetos.
    Cada objeto (carta) deve ter:
    { "word": "...", "pinyin": "...", "meaning": "...", "example": "...", "distractors": ["significado errado 1", "significado errado 2", "significado errado 3"] }
    ${isCJK ? 'O campo pinyin deve conter a transcrição fonética.' : 'O campo pinyin deve ser deixado vazio ou com null.'}
    Os significados e distratores devem ser em Português.`;
    }


    if (type === 'enigmas') {
        const srcName = targetLang; // Parametro reutilizado como source
        const tgtName = mode;       // Parametro reutilizado como target

        return `Você é um tradutor especialista e criador de jogos.
    NÍVEL DE LINGUAGEM DESEJADO: ${difficulty}. (Crie enigmas apropriados para este nível).
    
    CONTEXTO (TEXTO BASE):
    Receberá uma lista de palavras extraídas de um texto.
    
    SUA TAREFA:
    Para cada palavra, retorne um objeto JSON com:
    {
      "word": "a palavra original",
      "translation": "a tradução correta para ${tgtName}",
      "alternatives": ["alternativa incorreta 1", "alternativa incorreta 2", "alternativa incorreta 3"],
      "synonym": "um sinônimo ou definição breve em ${tgtName} (para dica)"
    }
    As alternativas devem ser plausíveis mas incorretas.
    Retorne APENAS o JSON Array.`;
    }

    if (type === 'intruder') {
        const srcName = targetLang; // Reutilizando param
        return `Você é um criador de jogos de linguagem.
        Seu objetivo é criar uma "Palavra Intrusa" para um jogo de desafio.
        NÍVEL DE LINGUAGEM DESEJADO: ${difficulty}.
        
        CONTEXTO (TEXTO BASE):
        Dado um texto ou lista de palavras em ${srcName}, sugira uma palavra que NÃO pertença ao contexto (seja anacrônica, de outro tópico ou absurda), mas que pareça plausível linguisticamente e adequada ao nível ${difficulty}.
        
        Exemplo: Texto medieval -> Intruso: "Computador" (Computer).
        Exemplo: Texto sobre frutas -> Intruso: "Carro" (Auto).

        Retorne APENAS um JSON:
        {
            "word": "palavra intrusa no idioma original (${srcName})",
            "translation": "tradução em Português",
            "reason": "breve explicação do porquê é intruso"
        }`;
    }

    if (type === 'boss') {
        const srcName = targetLang;
        return `Você é um 'Boss Final' de um jogo de idiomas.
        Seu objetivo é desafiar os jogadores a reconstruir uma frase curta.
        NÍVEL DE LINGUAGEM DESEJADO: ${difficulty}. (Escolha uma frase com complexidade adequada ao nível).
        
        CONTEXTO (TEXTO BASE):
        Dado um texto em ${srcName}, escolha UMA frase curta (não o texto completo).
        
        SUA TAREFA:
        Retorne APENAS um JSON:
        {
            "originalSentence": "A frase escolhida no idioma estudado (${srcName})",
            "blocks": ["bloco1", "bloco2", "bloco3", "bloco4"]
        }
        Regras para os blocos:
        1. Os blocos devem estar no idioma estudado (${srcName}).
        2. Divida a frase em 4 a 6 pedaços lógicos (chunks).
        3. NÃO divida palavra por palavra, mas sim por sintagmas.
        4. Embaralhe os blocos no array de retorno.
        5. NÃO inclua tradução.
        `;
    }

    if (type === 'raw_text') {
        const langName = getLangName(targetLang);
        return `Você é um escritor criativo poliglota.
        Escreva um texto curto, interessante e coerente em ${langName}.
        O texto deve ter aproximadamente 40 a 60 palavras.
        
        Retorne APENAS um JSON:
        {
            "text": "O texto gerado aqui..."
        }`;
    }

    if (type === 'domino_terms') {
        const { context, sourceLang, targetLang, customTopic, difficulty } = mode as any;
        const langNames: Record<string, string> = {
            'de': 'Alemão', 'zh': 'Chinês (Mandarim Simplificado)', 'pt': 'Português', 'en': 'Inglês',
            'fr': 'Francês', 'es': 'Espanhol', 'it': 'Italiano', 'ja': 'Japonês', 'ko': 'Coreano'
        };
        const srcName = langNames[sourceLang || ''] || sourceLang;
        const tgtName = langNames[targetLang || ''] || 'Português';

        let contextInstructions = '';
        if (context === 'language') {
            contextInstructions = `CONTEXTO: Tradução de idiomas.\nIDIOMAS: De ${srcName} para ${tgtName}.\nO "term" deve estar em ${srcName} e a "definition" em ${tgtName}.`;
        } else if (context === 'custom') {
            contextInstructions = `CONTEXTO: ${customTopic}.\nO "term" é o conceito/palavra e a "definition" é sua explicação ou tradução.`;
        } else {
            const contextNames: Record<string, string> = {
                'medicine': 'Medicina', 'computing': 'Computação', 'engineering': 'Engenharia',
                'chemistry': 'Química', 'biology': 'Biologia', 'law': 'Direito'
            };
            contextInstructions = `CONTEXTO: Termos de ${contextNames[context] || context}.\nO "term" é o termo técnico e a "definition" é sua explicação simples em Português.`;
        }

        return `Você é um especialista em educação. Gere 13 pares de Termo/Definição únicos para um jogo de dominó.
        NÍVEL: ${difficulty}.
        ${contextInstructions}
        
        REGRAS:
        1. Gere EXATAMENTE 13 pares diferentes.
        2. Os termos devem ser únicos e não se repetir.
        3. As definições devem ser curtas (1-3 palavras).
        4. Retorne APENAS um JSON Array: [{ "term": "...", "definition": "..." }, ...]`;
    }

    return '';
};

const callLocalGemini = async (prompt: string, systemInstruction: string) => {
    try {
        const response = await (genAI as any).models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
            }
        });

        const text = response.text;
        if (!text) throw new Error("Sem resposta da IA");

        // Clean JSON formatting if necessary (sometimes AI returns markdown)
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

        return JSON.parse(cleanText);
    } catch (error) {
        console.error("Local Gemini Error:", error);
        throw error;
    }
};

// Helper duplicado que estava sendo definido várias vezes dentro das funcoes
const getLangName = (code: string) => {
    const map: Record<string, string> = {
        'de': 'Alemão', 'zh': 'Chinês (Mandarim Simplificado)', 'pt': 'Português', 'en': 'Inglês',
        'fr': 'Francês', 'es': 'Espanhol', 'it': 'Italiano', 'ja': 'Japonês', 'ko': 'Coreano'
    };
    return map[code] || code;
};

// --- IMPLEMENTAÇÃO HÍBRIDA (LOCAL vs PROD) ---

export const processTextWithGemini = async (text: string, mode: 'direct' | 'translate' = 'direct', targetLanguage: SupportedLanguage = 'zh'): Promise<StudyItem[]> => {
    // DEV MODE: Usa SDK local
    if (import.meta.env.DEV) {
        console.log("Using Local Gemini SDK for Text Analysis");
        const systemPrompt = getSystemInstruction('analysis', targetLanguage, mode);
        const userPrompt = `Texto para analisar: "${text}"`;

        const rawData = await callLocalGemini(userPrompt, systemPrompt);
        const timestamp = Date.now();

        // Normalização básica para garantir compatibilidade com a UI
        return rawData.map((item: any, index: number) => ({
            ...item,
            id: `local-${timestamp}-${index}`,
            language: targetLanguage,
            // Garante campos mínimos se a IA falhar
            tokens: item.tokens || [],
            keywords: item.keywords || []
        }));
    }

    // PROD MODE: Usa Fetch API
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, mode, targetLanguage, type: 'text' }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || "Erro ao conectar com a IA");
        }

        const rawData = await response.json();
        const timestamp = Date.now();

        return rawData.map((item: any, index: number) => ({
            ...item,
            id: `u-${timestamp}-${index}`,
            language: targetLanguage,
            keywords: []
        }));

    } catch (error) {
        console.error("Service Error:", error);
        throw error;
    }
};

export const generateWordCard = async (word: string, contextSentence: string, targetLanguage: SupportedLanguage = 'zh'): Promise<Keyword> => {
    // DEV MODE
    if (import.meta.env.DEV) {
        console.log("Using Local Gemini SDK for Word Card");
        const systemPrompt = getSystemInstruction('card', targetLanguage);
        const userPrompt = `Palavra: "${word}". Contexto: "${contextSentence}"`;

        const data = await callLocalGemini(userPrompt, systemPrompt);
        return {
            id: `card-${Date.now()}`,
            word: data.word,
            pinyin: data.pinyin,
            meaning: data.meaning,
            language: targetLanguage
        };
    }

    // PROD MODE
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'card',
                word,
                context: contextSentence,
                targetLanguage
            }),
        });

        if (!response.ok) throw new Error("Erro ao gerar card");
        const data = await response.json();

        return {
            id: `card-${Date.now()}`,
            word: data.word,
            pinyin: data.pinyin,
            meaning: data.meaning,
            language: targetLanguage
        };
    } catch (error) {
        console.error("Card Error:", error);
        throw error;
    }
};

export const generateGameDeck = async (
    topic: string,
    difficulty: string,
    targetLanguage: SupportedLanguage,
    excludeWords: string[] = []
): Promise<GameCard[]> => {
    // DEV MODE
    if (import.meta.env.DEV) {
        console.log("Using Local Gemini SDK for Game Deck");
        const systemPrompt = getSystemInstruction('game', targetLanguage);
        const userPrompt = `Tópico: ${topic}. Dificuldade: ${difficulty}. (Excluir: ${excludeWords.join(', ')})`;

        return await callLocalGemini(userPrompt, systemPrompt);
    }

    // PROD MODE
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'game_deck',
                topic,
                difficulty,
                targetLanguage,
                exclude: excludeWords
            }),
        });

        if (!response.ok) throw new Error("Erro ao gerar cartas do jogo");
        return await response.json();
    } catch (error) {
        console.error("Game Deck Error:", error);
        throw error;
    }
};

export interface EnigmaData {
    word: string;
    translation: string;
    alternatives: string[];
    synonym: string;
}

export const generateEnigmas = async (
    words: string[],
    sourceLang: string,
    targetLang: string,
    difficulty: string = 'Iniciante'
): Promise<EnigmaData[]> => {
    // Helper para nome do idioma
    const getLangName = (code: string) => {
        const map: Record<string, string> = {
            'de': 'Alemão', 'zh': 'Chinês (Mandarim Simplificado)', 'pt': 'Português',
            'en': 'Inglês', 'fr': 'Francês', 'es': 'Espanhol',
            'it': 'Italiano', 'ja': 'Japonês', 'ko': 'Coreano'
        };
        return map[code] || code;
    };

    const srcName = getLangName(sourceLang);
    const tgtName = getLangName(targetLang);

    // DEV MODE
    if (import.meta.env.DEV) {
        console.log("Using Local Gemini SDK for Enigmas");
        const systemPrompt = getSystemInstruction('enigmas', sourceLang, targetLang, difficulty);
        const userPrompt = `Palavras para criar enigmas: ${JSON.stringify(words)}`;

        return await callLocalGemini(userPrompt, systemPrompt);
    }

    // PROD MODE - Usa endpoint seguro
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'enigmas',
                words,
                sourceLang: srcName,
                targetLang: tgtName,
                difficulty
            }),
        });
        if (!response.ok) throw new Error("Erro ao gerar enigmas");
        return await response.json();
    } catch (error) {
        console.error("Enigmas Error:", error);
        throw error;
    }
};

export interface IntruderData {
    word: string;
    translation: string;
    reason: string;
}

export const generateIntruder = async (
    contextWords: string[],
    contentLang: string,
    difficulty: string = 'Iniciante'
): Promise<IntruderData> => {
    const getLangName = (code: string) => {
        const map: Record<string, string> = {
            'de': 'Alemão', 'zh': 'Chinês (Mandarim Simplificado)', 'pt': 'Português',
            'en': 'Inglês', 'fr': 'Francês', 'es': 'Espanhol',
            'it': 'Italiano', 'ja': 'Japonês', 'ko': 'Coreano'
        };
        return map[code] || code;
    };

    const langName = getLangName(contentLang);

    if (import.meta.env.DEV) {
        console.log("Using Local Gemini SDK for Intruder");
        const systemPrompt = getSystemInstruction('intruder', contentLang, 'direct', difficulty);
        const userPrompt = `Contexto (palavras do texto): ${contextWords.slice(0, 20).join(', ')}...`;

        return await callLocalGemini(userPrompt, systemPrompt);
    }

    // PROD MODE - Usa endpoint seguro
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'intruder',
                context: contextWords.slice(0, 20),
                targetLang: langName,
                difficulty
            }),
        });

        if (!response.ok) throw new Error("Erro ao gerar intruso");
        return await response.json();
    } catch (error) {
        console.error("Intruder Error:", error);
        throw error;
    }
};

export interface BossLevelData {
    originalSentence: string;
    blocks: string[];
}

export const generateBossLevel = async (
    fullText: string,
    contentLang: string,
    difficulty: string = 'Iniciante'
): Promise<BossLevelData> => {
    const langName = getLangName(contentLang);

    if (import.meta.env.DEV) {
        console.log("Using Local Gemini SDK for Boss");
        const systemPrompt = getSystemInstruction('boss', contentLang, 'direct', difficulty);
        const userPrompt = `Texto base: ${fullText}`;

        return await callLocalGemini(userPrompt, systemPrompt);
    }

    // PROD MODE - Usa endpoint seguro
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'boss',
                context: fullText,
                targetLang: langName,
                difficulty
            }),
        });

        if (!response.ok) throw new Error("Erro ao gerar boss");
        return await response.json();
    } catch (error) {
        console.error("Boss Error:", error);
        throw error;
    }
};

export const generateRawText = async (contentLang: string, customPrompt?: string): Promise<string> => {
    const langName = getLangName(contentLang);

    // Valida se existe um prompt customizado não-vazio
    const hasCustomPrompt = customPrompt && customPrompt.trim().length > 0;

    // Log para debug
    console.log('[generateRawText] customPrompt recebido:', customPrompt);
    console.log('[generateRawText] hasCustomPrompt:', hasCustomPrompt);

    // Constrói o prompt do usuário baseado na instrução customizada ou padrão
    const userPrompt = hasCustomPrompt
        ? `Gere um texto em ${langName} sobre: ${customPrompt.trim()}`
        : `Gere um texto em ${langName}. O tema deve ser variado (cultura, cotidiano, curiosidades, história).`;

    console.log('[generateRawText] userPrompt final:', userPrompt);

    if (import.meta.env.DEV) {
        console.log("Using Local Gemini SDK for Raw Text");
        const systemPrompt = getSystemInstruction('raw_text', contentLang);

        const data = await callLocalGemini(userPrompt, systemPrompt);
        return data.text;
    }

    // PROD MODE - Usa endpoint seguro
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'raw_text',
                targetLang: contentLang,
                customPrompt: customPrompt
            }),
        });

        if (!response.ok) throw new Error("Erro ao gerar texto");
        const data = await response.json();
        return data.text;
    } catch (error) {
        console.error("Raw Text Error:", error);
        throw error;
    }
};

/**
 * Tokeniza texto usando IA (Gemini) para segmentação PALAVRA POR PALAVRA.
 * Especialmente importante para idiomas CJK (Chinês, Japonês, Coreano) que não usam espaços.
 * 
 * RETORNO ESPERADO: Array de strings onde cada elemento é UMA palavra clicável.
 * Exemplo Chinês: ["城市", "，", "一个", "充满", "活力", "的", "世界", "。"]
 * Exemplo Alemão: ["Guten", " ", "Tag", "!"]
 */
export const tokenizeTextWithAI = async (
    text: string,
    langCode: string
): Promise<string[]> => {
    const langName = getLangName(langCode);

    // PROMPT EXTREMAMENTE CLARO para segmentação palavra-por-palavra
    const systemPrompt = `Você é um segmentador de texto linguístico profissional.

SUA ÚNICA TAREFA: Dividir o texto em PALAVRAS INDIVIDUAIS para um app de aprendizado de idiomas.

IDIOMA DO TEXTO: ${langName}

REGRAS OBRIGATÓRIAS:

1. CHINÊS (zh):
   - Cada PALAVRA deve ser um elemento separado no array
   - Exemplos de palavras: "喜欢" (gostar), "流行" (popular), "普通话" (mandarim), "城市" (cidade)
   - NÃO separe caractere por caractere! "喜欢" é UMA palavra, não "喜" + "欢"
   - Pontuação chinesa (，。！？) deve ser elemento separado
   - Exemplo correto: "我喜欢学中文。" → ["我", "喜欢", "学", "中文", "。"]
   - Exemplo ERRADO: ["我", "喜", "欢", "学", "中", "文", "。"]

2. JAPONÊS (ja):
   - Palavras completas, partículas separadas
   - Exemplo: "日本語を勉強します" → ["日本語", "を", "勉強", "します"]

3. COREANO (ko):
   - Use os espaços naturais do idioma
   - Exemplo: "한국어를 공부합니다" → ["한국어를", " ", "공부합니다"]

4. IDIOMAS OCIDENTAIS (de, fr, es, it, en, pt):
   - Separe por espaços
   - Pontuação deve ser elemento separado
   - Exemplo: "Guten Tag!" → ["Guten", " ", "Tag", "!"]

FORMATO DE RESPOSTA:
Retorne APENAS um JSON válido: { "tokens": ["palavra1", "palavra2", ...] }

NÃO inclua explicações, apenas o JSON.`;

    const userPrompt = `Segmente este texto em ${langName} em palavras individuais:

"${text}"`;

    if (import.meta.env.DEV) {
        console.log("[Tokenization] Using Local Gemini SDK");
        const data = await callLocalGemini(userPrompt, systemPrompt);
        console.log("[Tokenization] Result:", data.tokens?.slice(0, 15), "...");
        return data.tokens || [];
    }

    // PROD MODE - Usa endpoint seguro
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'tokenize',
                text,
                targetLang: langCode
            }),
        });

        if (!response.ok) throw new Error("Erro ao tokenizar texto");
        const data = await response.json();
        console.log("[Tokenization] PROD Result:", data.tokens?.slice(0, 15), "...");
        return data.tokens || [];
    } catch (error) {
        console.error("Tokenization Error:", error);
        throw error;
    }
};

/**
 * Gera 13 pares Termo/Definição para o Dominó Mexicano
 */
export const generateDominoTerms = async (
    context: string,
    config: { sourceLang?: string; targetLang?: string; customTopic?: string; difficulty: string }
): Promise<{ term: string; definition: string }[]> => {
    const payload = {
        type: 'domino_terms',
        context,
        ...config
    };

    if (import.meta.env.DEV) {
        console.log("Using Local Gemini SDK for Domino Terms");
        const systemPrompt = getSystemInstruction('domino_terms', 'pt', payload as any);
        const userPrompt = `Gere os 13 termos para o contexto ${context}.`;
        return await callLocalGemini(userPrompt, systemPrompt);
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error("Erro ao gerar termos do dominó");
        return await response.json();
    } catch (error) {
        console.error("Domino Terms Error:", error);
        throw error;
    }
};

