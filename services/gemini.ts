/// <reference types="vite/client" />

import { StudyItem, Keyword, GameCard } from "../types";
import { Language, Enigma, IntruderChallenge, BossChallenge } from "../views/PolyQuest/types";

// ============================================
// CONFIGURAÇÃO DA API
// ============================================
const API_URL = import.meta.env.DEV 
  ? 'https://memorizatudo.vercel.app/api/generate' 
  : '/api/generate';

// Função genérica para chamar o Backend
const callBackend = async (body: any) => {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Erro API: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};

// ============================================
// FUNÇÕES DO PROJETO PRINCIPAL (Mandarin Deep Thinking)
// ============================================

export const processTextWithGemini = async (
  text: string, 
  mode: 'direct' | 'translate' = 'direct', 
  targetLanguage: 'zh' | 'de' = 'zh'
): Promise<StudyItem[]> => {
  try {
    const rawData = await callBackend({ 
      text, 
      mode, 
      targetLanguage, 
      type: 'text' 
    });
    
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

export const generateWordCard = async (
  word: string, 
  contextSentence: string, 
  targetLanguage: 'zh' | 'de' = 'zh'
): Promise<Keyword> => {
  try {
    const data = await callBackend({ 
      type: 'card', 
      word, 
      context: contextSentence,
      targetLanguage 
    });
    
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
    return await callBackend({ 
      type: 'game_deck', 
      topic, 
      difficulty,
      targetLanguage,
      exclude: excludeWords
    });
  } catch (error) {
    console.error("Game Deck Error:", error);
    throw error;
  }
};

// ============================================
// FUNÇÕES DO POLYQUEST
// ============================================

// Mapeamento de Language enum para código de idioma
const languageToCode = (language: Language): 'zh' | 'de' | 'pt' => {
  const map: Record<Language, 'zh' | 'de' | 'pt'> = {
    [Language.MANDARIN]: 'zh',
    [Language.GERMAN]: 'de',
    [Language.PORTUGUESE]: 'pt',
    [Language.ENGLISH]: 'pt', // fallback
    [Language.SPANISH]: 'pt',
    [Language.FRENCH]: 'pt',
    [Language.ITALIAN]: 'pt',
    [Language.JAPANESE]: 'zh',
    [Language.RUSSIAN]: 'pt'
  };
  return map[language] || 'pt';
};

// 1. Gerar Texto Base com IA para o PolyQuest
export const generateSourceMaterial = async (
  language: Language, 
  topic: string
) => {
  try {
    return await callBackend({
      type: 'poly_source',
      sourceLanguage: language,
      topic: topic
    });
  } catch (e) {
    // Fallback de emergência se a IA falhar
    console.error("Erro ao gerar texto:", e);
    return {
      fullText: "Erro ao gerar texto com IA. Por favor, tente novamente ou cole seu próprio texto.",
      selectedWords: []
    };
  }
};

// 2. Gerar Enigmas (Cartas) para o PolyQuest
export const generateGameData = async (
  selectedWords: string[],
  fullText: string,
  sourceLang: Language
): Promise<Enigma[]> => {
  
  const targetLangCode = languageToCode(sourceLang);
  
  // Fazemos várias chamadas em paralelo (uma para cada palavra)
  const promises = selectedWords.map(async (word, index) => {
    try {
      const data = await callBackend({
        type: 'card',
        word: word,
        context: fullText,
        targetLanguage: targetLangCode
      });

      return {
        id: `enigma-${index}-${Date.now()}`,
        word: data.word || word,
        contextSentence: fullText.includes(word) 
          ? `...${word}...` 
          : data.example || `Exemplo com ${word}`,
        correctTranslation: data.meaning,
        // A IA gera a resposta certa, criamos distratores simples
        options: [
          data.meaning, 
          "Significado Incorreto 1", 
          "Outra Coisa", 
          "Nada a ver"
        ].sort(() => Math.random() - 0.5), 
        difficulty: "hard" as const,
        synonymOrDefinition: data.pinyin || "Dica indisponível"
      } as Enigma;
    } catch (e) {
      console.error(`Erro ao gerar enigma para "${word}":`, e);
      return null;
    }
  });

  const results = await Promise.all(promises);
  return results.filter(r => r !== null) as Enigma[];
};

// 3. Evento do Intruso com IA
export const generateIntruderEvent = async (
  currentText: string, 
  language: Language
): Promise<IntruderChallenge> => {
  return await callBackend({
    type: 'poly_intruder',
    text: currentText,
    sourceLanguage: language
  });
};

// 4. Evento Boss com IA
export const generateBossLevel = async (
  fullText: string
): Promise<BossChallenge> => {
  return await callBackend({
    type: 'poly_boss',
    text: fullText
  });
};

// Export para compatibilidade
export { type GameCard } from "../types";
