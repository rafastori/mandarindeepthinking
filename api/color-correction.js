// Correção por cores: lotes de 3 frases, JSON estruturado, sem CoT enorme.
import {
  callOpenRouterText,
  chunkArray,
  normalizeArrayResult,
  processBatchesIsolated,
  sanitizeColorOutputs,
} from '../lib/openrouter.js';

export const maxDuration = 300;
export const COLOR_CHUNK = 3;
export const COLOR_LLM_OPTIONS = {
  jsonObject: true,
  maxTokens: 4096,
  reasoning: { effort: 'low', exclude: true },
};

function setCors(req, res) {
  const origin = req.headers.origin || '';
  const isVercel = origin.endsWith('.vercel.app');
  const isLocalhost = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
  res.setHeader('Access-Control-Allow-Origin', isVercel || isLocalhost ? origin : '*');
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
}

function systemPromptFor(langName) {
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

export async function runColorCorrection(sentences, targetLanguage = 'zh') {
  const langNames = {
    de: 'Alemão', zh: 'Chinês', pt: 'Português', en: 'Inglês',
    fr: 'Francês', es: 'Espanhol', it: 'Italiano', ja: 'Japonês', ko: 'Coreano',
  };
  const langName = langNames[targetLanguage] || targetLanguage;
  const systemPrompt = systemPromptFor(langName);

  const runChunk = async (chunk) => {
    const userPrompt = `Analise as seguintes frases e suas traduções. Para cada frase, identifique quais palavras da tradução correspondem às palavras salvas (com seus colorIndex).

Dados:
${JSON.stringify(chunk, null, 2)}

Responda somente o JSON. /no_think`;
    try {
      const result = await callOpenRouterText(userPrompt, systemPrompt, true, undefined, COLOR_LLM_OPTIONS);
      const rows = sanitizeColorOutputs(normalizeArrayResult(result));
      if (!rows.length) throw new Error('Resposta da IA sem frases coloridas');
      return rows;
    } catch (error) {
      console.warn('[color-correction] retry lote', error?.message);
      const result = await callOpenRouterText(userPrompt, systemPrompt, true, undefined, COLOR_LLM_OPTIONS);
      const rows = sanitizeColorOutputs(normalizeArrayResult(result));
      if (!rows.length) throw error;
      return rows;
    }
  };

  const chunks = chunkArray(sentences, COLOR_CHUNK);
  const { collected, errors } = await processBatchesIsolated(chunks, runChunk);
  const flat = collected.flat();
  if (flat.length === 0) {
    const first = errors[0]?.err;
    throw first || new Error('Erro ao corrigir cores');
  }
  return { results: flat, failedBatches: errors.length };
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({ error: 'OPENROUTER_API_KEY missing' });
    }
    const { sentences, targetLanguage = 'zh' } = req.body || {};
    if (!Array.isArray(sentences) || sentences.length === 0) {
      return res.status(400).json({ error: "O campo 'sentences' é obrigatório." });
    }
    const payload = await runColorCorrection(sentences, targetLanguage);
    return res.status(200).json(payload);
  } catch (error) {
    console.error('ERRO API COLOR-CORRECTION:', {
      message: error.message,
      status: error.status,
    });
    return res.status(500).json({
      error: 'Ocorreu um erro interno na geração de conteúdo.',
      details: error.status ? `Status de conexão: ${error.status}` : undefined,
    });
  }
}
