/// <reference types="vite/client" />

import { StudyItem, Keyword } from "../types";

// LÓGICA INTELIGENTE: Alterna entre Local (IDX) e Produção (Vercel)
const API_URL = import.meta.env.DEV 
  ? 'https://memorizatudo.vercel.app/api/generate' 
  : '/api/generate';

// 1. Processamento em Lote (Texto Completo)
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

// 2. NOVA FUNÇÃO: Gera card único ao clicar (ESSA É A QUE FALTAVA)
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