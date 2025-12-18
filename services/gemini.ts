/// <reference types="vite/client" />

import { GoogleGenAI } from "@google/genai";
import { StudyItem, Keyword, GameCard } from "../types";

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

const getSystemInstruction = (type: string, targetLang: string, mode: 'direct' | 'translate' = 'direct') => {
    const langNames: Record<string, string> = {
        'de': 'Alemão', 'zh': 'Chinês (Mandarim)', 'pt': 'Português', 'en': 'Inglês'
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
        return `Você é um professor de ${langName}.
    Crie um cartão de estudo detalhado para a palavra/expressão solicitada.
    Retorne APENAS um JSON com o formato:
    { "word": "...", "pinyin": "...", "meaning": "...", "language": "${targetLang}" }
    O significado (meaning) deve ser em Português.`;
    }

    if (type === 'game') {
        return `Você é um criador de jogos educativos de ${langName}.
    Crie um deck de cartas para o tópico solicitado.
    Retorne APENAS um Array JSON de objetos.
    Cada objeto (carta) deve ter:
    { "word": "...", "pinyin": "...", "meaning": "...", "example": "...", "distractors": ["significado errado 1", "significado errado 2", "significado errado 3"] }
    Os significados e distratores devem ser em Português.`;
    }


    if (type === 'enigmas') {
        const srcName = targetLang; // Parametro reutilizado como source
        const tgtName = mode;       // Parametro reutilizado como target

        return `Você é um tradutor especialista e criador de jogos.
    Receberá uma lista de palavras em ${srcName}.
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
        Dado um texto ou lista de palavras em ${srcName}, sugira uma palavra que NÃO pertença ao contexto (seja anacrônica, de outro tópico ou absurda), mas que pareça plausível linguisticamente.
        
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
        Dado um texto em ${srcName}, escolha UMA frase curta (não o texto completo).
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
        O tema deve ser variado (cultura, cotidiano, curiosidades, história).
        
        Retorne APENAS um JSON:
        {
            "text": "O texto gerado aqui..."
        }`;
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
        'de': 'Alemão', 'zh': 'Chinês', 'pt': 'Português',
        'en': 'Inglês', 'fr': 'Francês', 'es': 'Espanhol',
        'it': 'Italiano', 'ja': 'Japonês', 'ko': 'Coreano'
    };
    return map[code] || code;
};

// --- IMPLEMENTAÇÃO HÍBRIDA (LOCAL vs PROD) ---

export const processTextWithGemini = async (text: string, mode: 'direct' | 'translate' = 'direct', targetLanguage: 'zh' | 'de' | 'pt' | 'en' = 'zh'): Promise<StudyItem[]> => {
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

export const generateWordCard = async (word: string, contextSentence: string, targetLanguage: 'zh' | 'de' | 'pt' | 'en' = 'zh'): Promise<Keyword> => {
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
    targetLanguage: 'zh' | 'de' | 'pt' | 'en',
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
    targetLang: string
): Promise<EnigmaData[]> => {
    // Helper para nome do idioma
    const getLangName = (code: string) => {
        const map: Record<string, string> = {
            'de': 'Alemão', 'zh': 'Chinês', 'pt': 'Português',
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
        const systemPrompt = getSystemInstruction('enigmas', srcName, tgtName as any);
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
                targetLang: tgtName
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
    contentLang: string
): Promise<IntruderData> => {
    const getLangName = (code: string) => {
        const map: Record<string, string> = {
            'de': 'Alemão', 'zh': 'Chinês', 'pt': 'Português',
            'en': 'Inglês', 'fr': 'Francês', 'es': 'Espanhol',
            'it': 'Italiano', 'ja': 'Japonês', 'ko': 'Coreano'
        };
        return map[code] || code;
    };

    const langName = getLangName(contentLang);

    if (import.meta.env.DEV) {
        console.log("Using Local Gemini SDK for Intruder");
        const systemPrompt = getSystemInstruction('intruder', langName);
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
                targetLang: langName
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
    contentLang: string
): Promise<BossLevelData> => {
    const langName = getLangName(contentLang);

    if (import.meta.env.DEV) {
        console.log("Using Local Gemini SDK for Boss");
        const systemPrompt = getSystemInstruction('boss', langName);
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
                targetLang: langName
            }),
        });

        if (!response.ok) throw new Error("Erro ao gerar boss");
        return await response.json();
    } catch (error) {
        console.error("Boss Error:", error);
        throw error;
    }
};

export const generateRawText = async (contentLang: string): Promise<string> => {
    const langName = getLangName(contentLang);

    if (import.meta.env.DEV) {
        console.log("Using Local Gemini SDK for Raw Text");
        const systemPrompt = getSystemInstruction('raw_text', contentLang);
        const userPrompt = `Gere um texto em ${langName}.`;

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
                targetLang: contentLang
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
