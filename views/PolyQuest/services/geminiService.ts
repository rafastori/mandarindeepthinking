import { Language, Enigma, IntruderChallenge, BossChallenge } from "../types";

// Função genérica para chamar o Backend
const callBackend = async (body: any) => {
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Erro API: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};

// 1. Gerar Texto Base com IA
export const generateSourceMaterial = async (language: Language, topic: string) => {
  try {
      return await callBackend({
          type: 'poly_source',
          sourceLanguage: language,
          topic: topic
      });
  } catch (e) {
      // Fallback de emergência se a IA falhar
      return {
        fullText: "Erro ao gerar texto com IA. Por favor, tente novamente ou cole seu próprio texto.",
        selectedWords: []
      };
  }
};

// 2. Gerar Enigmas (Cartas) com IA
export const generateGameData = async (
  selectedWords: string[],
  fullText: string,
  sourceLang: string
): Promise<Enigma[]> => {
  
  // Fazemos várias chamadas em paralelo (uma para cada palavra)
  const promises = selectedWords.map(async (word, index) => {
    try {
        const data = await callBackend({
            type: 'card',
            word: word,
            context: fullText,
            targetLanguage: sourceLang === 'Mandarim' ? 'zh' : 'de' 
        });

        return {
            id: `enigma-${index}-${Date.now()}`,
            word: data.word || word,
            contextSentence: fullText.includes(word) ? `...${word}...` : data.example,
            correctTranslation: data.meaning,
            // A IA gera a resposta certa, nós criamos distratores simples ou podemos pedir pra IA também no futuro
            options: [data.meaning, "Significado Incorreto 1", "Outra Coisa", "Nada a ver"].sort(() => Math.random() - 0.5), 
            difficulty: "hard",
            synonymOrDefinition: "Dica indisponível"
        } as Enigma;
    } catch (e) {
        return null;
    }
  });

  const results = await Promise.all(promises);
  return results.filter(r => r !== null) as Enigma[];
};

// 3. Evento do Intruso com IA
export const generateIntruderEvent = async (currentText: string, language: Language): Promise<IntruderChallenge> => {
    return await callBackend({
        type: 'poly_intruder',
        text: currentText,
        sourceLanguage: language
    });
};

// 4. Evento Boss com IA
export const generateBossLevel = async (fullText: string): Promise<BossChallenge> => {
    return await callBackend({
        type: 'poly_boss',
        text: fullText
    });
};