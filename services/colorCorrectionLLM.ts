import { SupportedLanguage } from '../types';
import {
    callOpenRouterText,
    chunkArray,
    normalizeArrayResult,
    processBatchesIsolated,
    sanitizeColorOutputs,
} from '../lib/openrouter.js';

export const COLOR_CHUNK_SIZE = 3;
export const COLOR_LLM_OPTIONS = {
    jsonObject: true,
    maxTokens: 4096,
    reasoning: { effort: 'low', exclude: true },
} as const;

const API_URL = '/api/color-correction';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

export interface ColorCorrectionInput {
    sentenceId: string;
    originalText: string;
    translation: string;
    savedWords: { word: string; meaning: string; colorIndex: number }[];
}

export interface ColorCorrectionOutput {
    sentenceId: string;
    coloredTranslation: { word: string; colorIndex: number | null }[];
}

export interface ColorCorrectionBatchHandlers {
    onBatch?: (results: ColorCorrectionOutput[]) => void | Promise<void>;
    onBatchError?: (failedCount: number, error: unknown) => void | Promise<void>;
}

function systemPromptFor(targetLanguage: SupportedLanguage) {
    const langNames: Record<string, string> = {
        de: 'Alemão', zh: 'Chinês', pt: 'Português', en: 'Inglês',
        fr: 'Francês', es: 'Espanhol', it: 'Italiano', ja: 'Japonês', ko: 'Coreano',
    };
    const langName = langNames[targetLanguage] || targetLanguage;
    return `Você é um linguista especialista em tradução e análise de correspondências entre idiomas.
Não explique o raciocínio. Não use tags <think>. Responda SOMENTE um objeto JSON.

SUA TAREFA: Dado um conjunto de frases em ${langName} com suas respectivas traduções em Português, e uma lista de palavras-chave salvas com índices de cor, identifique EXATAMENTE quais palavras da TRADUÇÃO correspondem a cada palavra salva do texto original.

REGRAS:
1. Analise cada frase e sua tradução cuidadosamente.
2. Para cada palavra salva, encontre a(s) palavra(s) na tradução que representam seu significado.
3. Retorne a tradução tokenizada (palavra por palavra), indicando para cada token o colorIndex da palavra salva correspondente, ou null se não houver correspondência.
4. Seja PRECISO: somente marque palavras que são traduções DIRETAS ou SINÔNIMOS PRÓXIMOS da palavra salva.
5. Palavras funcionais (artigos, preposições) NÃO devem receber cor, a menos que sejam parte integral da tradução de uma palavra salva.
6. Inclua TODAS as frases recebidas em "results", com o mesmo sentenceId.

FORMATO — APENAS este objeto JSON, sem markdown:
{
  "results": [
    {
      "sentenceId": "id-da-frase",
      "coloredTranslation": [
        { "word": "palavra-da-tradução", "colorIndex": 0 },
        { "word": "outra", "colorIndex": null }
      ]
    }
  ]
}`;
}

/**
 * Lotes de 3 frases em sequência. Um lote com erro não descarta os anteriores.
 * onBatch é chamado assim que cada lote termina (para gravar no IndexedDB ao vivo).
 */
export const correctColorHighlights = async (
    sentences: ColorCorrectionInput[],
    targetLanguage: SupportedLanguage = 'zh',
    handlers: ColorCorrectionBatchHandlers = {}
): Promise<ColorCorrectionOutput[]> => {
    if (sentences.length === 0) return [];

    const payloadFor = (batch: ColorCorrectionInput[]) => batch.map(s => ({
        sentenceId: s.sentenceId,
        originalText: s.originalText,
        translation: s.translation,
        savedWords: s.savedWords.map(w => ({ word: w.word, meaning: w.meaning, colorIndex: w.colorIndex })),
    }));

    const parseBatch = (raw: unknown): ColorCorrectionOutput[] => {
        const sanitized = sanitizeColorOutputs(normalizeArrayResult(raw));
        if (sanitized.length === 0) throw new Error('Resposta da IA sem frases coloridas');
        return sanitized;
    };

    const runOnce = async (batch: ColorCorrectionInput[]): Promise<ColorCorrectionOutput[]> => {
        if (import.meta.env.DEV) {
            const userPrompt = `Analise as seguintes frases e suas traduções. Para cada frase, identifique quais palavras da tradução correspondem às palavras salvas (com seus colorIndex).

Dados:
${JSON.stringify(payloadFor(batch), null, 2)}

Responda somente o JSON. /no_think`;
            const result = await callOpenRouterText(
                userPrompt,
                systemPromptFor(targetLanguage),
                true,
                OPENROUTER_API_KEY,
                COLOR_LLM_OPTIONS
            );
            return parseBatch(result);
        }

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sentences: batch,
                targetLanguage,
            }),
        });
        if (!response.ok) throw new Error('Erro ao corrigir cores');
        return parseBatch(await response.json());
    };

    const runBatch = async (batch: ColorCorrectionInput[]): Promise<ColorCorrectionOutput[]> => {
        try {
            return await runOnce(batch);
        } catch (error) {
            console.warn('[ColorCorrection] lote falhou, tentando de novo:', error);
            return await runOnce(batch);
        }
    };

    const chunks = chunkArray(sentences, COLOR_CHUNK_SIZE);
    const { collected, errors } = await processBatchesIsolated(
        chunks,
        runBatch,
        async (results) => {
            if (handlers.onBatch && results.length) await handlers.onBatch(results);
        },
        async (error, chunk) => {
            console.error('[ColorCorrection] lote descartado após retry:', error);
            if (handlers.onBatchError) await handlers.onBatchError(chunk.length, error);
        }
    );

    const flat = collected.flat();
    if (flat.length === 0) {
        throw errors[0]?.err || new Error('Erro ao corrigir cores');
    }
    return flat;
};
