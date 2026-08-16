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
  const cleanText = String(text).replace(/```json/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleanText);
  } catch {
    const objStart = cleanText.indexOf('{');
    const arrStart = cleanText.indexOf('[');
    const starts = [objStart, arrStart].filter((i) => i >= 0);
    if (starts.length === 0) throw new Error('Resposta da IA não é JSON válido');
    const start = Math.min(...starts);
    const end = Math.max(cleanText.lastIndexOf('}'), cleanText.lastIndexOf(']'));
    if (end <= start) throw new Error('Resposta da IA não é JSON válido');
    return JSON.parse(cleanText.slice(start, end + 1));
  }
}
