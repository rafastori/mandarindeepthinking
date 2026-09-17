export const TEXT_MODEL = 'deepseek/deepseek-v4-flash-0731';
export const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';

function getReferer() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
}

function flattenContent(content) {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part.text === 'string') return part.text;
      if (part && typeof part.content === 'string') return part.content;
      return '';
    }).join('');
  }
  if (typeof content === 'object' && typeof content.text === 'string') return content.text;
  return '';
}

/** DeepSeek V4 Flash mistura thinking em várias chaves; o JSON útil fica no content. */
export function extractMessageText(message = {}) {
  const fromContent = flattenContent(message.content).trim();
  if (fromContent) return fromContent;
  const fromReasoningContent = flattenContent(message.reasoning_content).trim();
  if (fromReasoningContent) return fromReasoningContent;
  return flattenContent(message.reasoning).trim();
}

export function stripThinkBlocks(text) {
  return String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .replace(/<\/?think>/gi, '')
    .trim();
}

function repairTruncatedJson(text) {
  const startArr = text.indexOf('[');
  const startObj = text.indexOf('{');
  if (startArr === -1 && startObj === -1) throw new Error('no json');
  const start = startArr !== -1 && (startObj === -1 || startArr < startObj) ? startArr : startObj;
  let slice = text.slice(start).trim().replace(/,\s*$/, '');
  const stack = [];
  let inString = false;
  let escape = false;
  for (const ch of slice) {
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{' || ch === '[') stack.push(ch === '{' ? '}' : ']');
    else if ((ch === '}' || ch === ']') && stack.length) stack.pop();
  }
  if (inString) slice += '"';
  while (stack.length) slice += stack.pop();
  return JSON.parse(slice);
}

export function parseJsonFromText(text) {
  let cleanText = stripThinkBlocks(text)
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .replace(/\n\s*\.\.\.\s*\n/g, '\n')
    .trim();

  try {
    return JSON.parse(cleanText);
  } catch {
    /* tenta recortes */
  }

  const arrStart = cleanText.indexOf('[');
  const arrEnd = cleanText.lastIndexOf(']');
  if (arrStart !== -1 && arrEnd > arrStart) {
    try {
      return JSON.parse(cleanText.slice(arrStart, arrEnd + 1));
    } catch { /* tenta objeto */ }
  }

  const objStart = cleanText.indexOf('{');
  const objEnd = cleanText.lastIndexOf('}');
  if (objStart !== -1 && objEnd > objStart) {
    try {
      return JSON.parse(cleanText.slice(objStart, objEnd + 1));
    } catch { /* tenta reparo */ }
  }

  try {
    return repairTruncatedJson(cleanText);
  } catch {
    throw new Error('Resposta da IA não é JSON válido');
  }
}

/**
 * Text generation via OpenRouter (DeepSeek V4 Flash).
 * @param {string} prompt
 * @param {string} [systemInstruction]
 * @param {boolean} [expectJson=true]
 * @param {string} [apiKey]
 * @param {{ jsonObject?: boolean, maxTokens?: number, reasoning?: object }} [options]
 */
export async function callOpenRouterText(prompt, systemInstruction = '', expectJson = true, apiKey, options = {}) {
  const key = apiKey || process.env.OPENROUTER_API_KEY || '';
  if (!key) {
    throw new Error('OPENROUTER_API_KEY missing');
  }

  const messages = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push({ role: 'user', content: prompt });

  const body = {
    model: TEXT_MODEL,
    messages,
    provider: { sort: 'throughput' },
  };

  if (options.jsonObject) {
    body.response_format = { type: 'json_object' };
  }
  if (options.reasoning) {
    body.reasoning = options.reasoning;
  } else if (options.jsonObject) {
    // Correção estruturada: sem CoT enorme que trunca o JSON
    body.reasoning = { effort: 'low', exclude: true };
  }
  if (options.maxTokens) {
    body.max_tokens = options.maxTokens;
  }

  const response = await fetch(OPENROUTER_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': getReferer(),
      'X-Title': 'MemorizaTudo',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    const error = new Error(`OpenRouter error ${response.status}`);
    error.status = response.status;
    error.details = errText.slice(0, 400);
    throw error;
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message || {};
  const text = extractMessageText(message);
  if (!text) throw new Error('Sem resposta da IA');

  if (!expectJson) {
    return text;
  }

  return parseJsonFromText(text);
}

export function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function normalizeArrayResult(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  if (data && Array.isArray(data.data)) return data.data;
  if (data && Array.isArray(data.sentences)) return data.sentences;
  if (data && Array.isArray(data.coloredTranslation) && data.sentenceId) return [data];
  if (data && typeof data === 'object' && data.sentenceId) return [data];
  if (data && typeof data === 'object' && (data.chinese || Array.isArray(data.tokens))) return [data];
  throw new Error('Resposta da IA não é um array JSON');
}

export function sanitizeColorOutputs(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => r && r.sentenceId != null && Array.isArray(r.coloredTranslation))
    .map((r) => ({
      sentenceId: String(r.sentenceId),
      coloredTranslation: r.coloredTranslation
        .map((t) => ({
          word: String(t?.word ?? '').trim(),
          colorIndex: (t?.colorIndex === null || t?.colorIndex === undefined || t?.colorIndex === '')
            ? null
            : Number(t.colorIndex),
        }))
        .filter((t) => t.word.length > 0)
        .map((t) => ({
          word: t.word,
          colorIndex: Number.isFinite(t.colorIndex) ? t.colorIndex : null,
        })),
    }))
    .filter((r) => r.coloredTranslation.length > 0);
}

/** Quebra texto longo em pedaços para não estourar timeout na tradução/análise. */
export function splitTextChunks(text, maxChars = 600) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  if (raw.length <= maxChars) return [raw];
  const parts = raw.split(/(?<=[.!?。！？\n])\s*/);
  const chunks = [];
  let buf = '';
  for (const part of parts) {
    if (!part) continue;
    if (buf && (buf.length + part.length) > maxChars) {
      chunks.push(buf.trim());
      buf = part;
    } else {
      buf += (buf ? (buf.endsWith('\n') ? '' : ' ') : '') + part;
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks.length ? chunks : [raw];
}

export async function mapChunks(chunks, concurrency, worker) {
  const collected = [];
  for (let i = 0; i < chunks.length; i += concurrency) {
    const slice = chunks.slice(i, i + concurrency);
    const parts = await Promise.all(slice.map(worker));
    collected.push(...parts);
  }
  return collected;
}

/**
 * Processa lotes em sequência. Um lote com erro não descarta os anteriores.
 * onSuccess/onError podem ser async (ex.: gravar no banco a cada lote).
 */
export async function processBatchesIsolated(chunks, worker, onSuccess, onError) {
  const collected = [];
  const errors = [];
  for (const chunk of chunks) {
    try {
      const result = await worker(chunk);
      collected.push(result);
      if (onSuccess) await onSuccess(result, chunk);
    } catch (err) {
      errors.push({ chunk, err });
      if (onError) await onError(err, chunk);
    }
  }
  return { collected, errors };
}
