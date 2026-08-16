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

/**
 * Text generation via OpenRouter (DeepSeek V4 Flash).
 * @param {string} prompt
 * @param {string} [systemInstruction]
 * @param {boolean} [expectJson=true]
 * @param {string} [apiKey]
 * @returns {Promise<any>} parsed JSON when expectJson is true, otherwise the raw text string
 */
export async function callOpenRouterText(prompt, systemInstruction = '', expectJson = true, apiKey) {
  const key = apiKey || process.env.OPENROUTER_API_KEY || '';
  if (!key) {
    throw new Error('OPENROUTER_API_KEY missing');
  }

  const messages = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push({ role: 'user', content: prompt });

  const response = await fetch(OPENROUTER_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': getReferer(),
      'X-Title': 'MemorizaTudo',
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      messages,
      provider: { sort: 'throughput' },
    }),
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
  const text = typeof message.content === 'string' && message.content.trim()
    ? message.content
    : (typeof message.reasoning === 'string' ? message.reasoning : '');
  if (!text) throw new Error('Sem resposta da IA');

  if (!expectJson) {
    return text;
  }

  return parseJsonFromText(text);
}

function parseJsonFromText(text) {
  const cleanText = String(text)
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .replace(/\n\s*\.\.\.\s*\n/g, '\n')
    .trim();
  try {
    return JSON.parse(cleanText);
  } catch {
    const arrStart = cleanText.indexOf('[');
    const arrEnd = cleanText.lastIndexOf(']');
    if (arrStart !== -1 && arrEnd > arrStart) {
      try {
        return JSON.parse(cleanText.slice(arrStart, arrEnd + 1));
      } catch { /* tenta objeto abaixo */ }
    }
    const objStart = cleanText.indexOf('{');
    const objEnd = cleanText.lastIndexOf('}');
    if (objStart !== -1 && objEnd > objStart) {
      return JSON.parse(cleanText.slice(objStart, objEnd + 1));
    }
    throw new Error('Resposta da IA não é JSON válido');
  }
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
  if (data && typeof data === 'object' && data.sentenceId) return [data];
  if (data && typeof data === 'object' && (data.chinese || Array.isArray(data.tokens))) return [data];
  throw new Error('Resposta da IA não é um array JSON');
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
