/// <reference types="vite/client" />

import { GoogleGenAI } from "@google/genai";
import { StudyItem, Keyword, GameCard } from "../types";

// Exportamos a interface também daqui se precisar, ou usamos a do types.ts
export { type GameCard } from "../types";

// Configuração do cliente local
const genAI = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
const MODEL_NAME = 'gemini-2.5-flash';

// URL de produção (Vercel Functions)
const API_URL = '/api/generate';

// --- FUNÇÕES AUXILIARES PARA GERAÇÃO LOCAL (PROMPTS) ---

const getSystemInstruction = (type: string, targetLang: string, mode: 'direct' | 'translate' = 'direct') => {
    const langName = targetLang === 'de' ? 'Alemão' : 'Chinês (Mandarim)';

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

    return '';
};

const callLocalGemini = async (prompt: string, systemInstruction: string) => {
    try {
        const response = await genAI.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
            }
        });

        const text = response.text;
        if (!text) throw new Error("Sem resposta da IA");

        return JSON.parse(text);
    } catch (error) {
        console.error("Local Gemini Error:", error);
        throw error;
    }
};

// --- IMPLEMENTAÇÃO HÍBRIDA (LOCAL vs PROD) ---

export const processTextWithGemini = async (text: string, mode: 'direct' | 'translate' = 'direct', targetLanguage: 'zh' | 'de' = 'zh'): Promise<StudyItem[]> => {
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

export const generateWordCard = async (word: string, contextSentence: string, targetLanguage: 'zh' | 'de' = 'zh'): Promise<Keyword> => {
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
    targetLanguage: 'zh' | 'de',
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