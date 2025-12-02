/// <reference types="vite/client" />

import { StudyItem, Keyword } from "../types";

// LÓGICA INTELIGENTE:
// Se estiver rodando local (IDX), usa o backend da Vercel.
// Se estiver na produção, usa o caminho relativo.
const API_URL = import.meta.env.DEV 
  ? 'https://memorizatudo.vercel.app/api/generate' 
  : '/api/generate';

// Função existente para processamento em lote
export const processTextWithGemini = async (text: string, mode: 'direct' | 'translate' = 'direct', targetLanguage: 'zh' | 'de' = 'zh'): Promise<StudyItem[]> => {
  try {
    // Agora usamos a variável API_URL ao invés de digitar o caminho direto
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, mode, targetLanguage, type: 'text' }),
    });

    if (response.status === 404) {
      throw new Error("BACKEND_NOT_FOUND");
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server Error: ${response.status}`);
    }

    const rawData = await response.json();
    
    const timestamp = Date.now();
    return rawData.map((item: any, index: number) => ({
      ...item,
      id: `u-${timestamp}-${index}`,
      language: targetLanguage,
      keywords: (item.keywords || []).map((k: any, kIndex: number) => ({
        ...k,
        id: `imp-${timestamp}-${index}-${kIndex}`,
        language: targetLanguage
      }))
    }));

  } catch (error: any) {
    console.error("Service Error:", error);
    
    if (error.message === "BACKEND_NOT_FOUND") {
      throw new Error("Erro: O Backend não respondeu. Verifique sua conexão.");
    }
    
    throw error;
  }
};

// Função para gerar card de palavra única sob demanda
export const generateWordCard = async (word: string, contextSentence: string, targetLanguage: 'zh' | 'de' = 'zh'): Promise<Keyword> => {
    try {
        // Aqui também usamos API_URL
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                type: 'card', 
                word, 
                context: contextSentence,
                targetLanguage
            }),
        });

        if (!response.ok) {
            throw new Error(`Server Error: ${response.status}`);
        }

        const data = await response.json();
        
        return {
            id: `card-${Date.now()}`,
            word: data.word,
            pinyin: data.pinyin,
            meaning: data.meaning,
            language: targetLanguage
        };
    } catch (error) {
        console.error("Card Generation Error:", error);
        throw error;
    }
};