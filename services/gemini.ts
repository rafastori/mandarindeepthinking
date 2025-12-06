/// <reference types="vite/client" />

import { StudyItem, Keyword, GameCard } from "../types";

// Exportamos a interface também daqui se precisar, ou usamos a do types.ts
export { type GameCard } from "../types";

const API_URL = import.meta.env.DEV 
  ? 'https://memorizatudo.vercel.app/api/generate' 
  : '/api/generate';

export const processTextWithGemini = async (text: string, mode: 'direct' | 'translate' = 'direct', targetLanguage: 'zh' | 'de' = 'zh'): Promise<StudyItem[]> => {
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