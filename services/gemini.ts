
import { StudyItem } from "../types";

export const processTextWithGemini = async (text: string, mode: 'direct' | 'translate' = 'direct', targetLanguage: 'zh' | 'de' = 'zh'): Promise<StudyItem[]> => {
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, mode, targetLanguage }),
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
      language: targetLanguage, // Injeta a tag de idioma
      keywords: item.keywords.map((k: any, kIndex: number) => ({
        ...k,
        id: `imp-${timestamp}-${index}-${kIndex}`,
        language: targetLanguage
      }))
    }));

  } catch (error: any) {
    console.error("Service Error:", error);
    
    if (error.message === "BACKEND_NOT_FOUND") {
      throw new Error("Erro de Configuração: O Backend '/api/generate' não foi encontrado. Se estiver local, use o comando 'vercel dev'.");
    }
    
    throw error;
  }
};
