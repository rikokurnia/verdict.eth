import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type ProviderId = 'gemini' | 'deepseek' | 'muse';

export type ProviderCall = {
  provider: ProviderId;
  model: string;
  text: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

export type ProviderDef = {
  id: ProviderId;
  model: string;
  key: string;
  chat: (system: string, user: string, timeoutMs: number) => Promise<Omit<ProviderCall, 'provider' | 'model'>>;
};

function loadEnvFile(): Record<string, string> {
  try {
    const output: Record<string, string> = {};
    for (const raw of readFileSync(join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const at = line.indexOf('=');
      if (at > 0) output[line.slice(0, at)] = line.slice(at + 1).replace(/^['"]|['"]$/g, '');
    }
    return output;
  } catch {
    return {};
  }
}

const fileEnv = loadEnvFile();
function env(name: string): string | undefined {
  return process.env[name] || fileEnv[name];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractJson(text: string): unknown {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(clean);
}

async function postJson(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Retryable = the call never produced a usable answer (network, 429, 5xx). */
export function isRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    if (/429|5\d\d|fetch failed|aborted|timeout|ECONN|UND_ERR|quota/i.test(error.message)) return true;
  }
  return false;
}

async function geminiChat(key: string, model: string, system: string, user: string, timeoutMs: number) {
  const response = await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    { 'x-goog-api-key': key },
    {
      systemInstruction: { role: 'system', parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    },
    timeoutMs,
  );
  if (!response.ok) throw new Error(`Gemini request failed (${response.status})`);
  const body = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text) throw new Error('Gemini returned no content');
  return {
    text,
    inputTokens: body.usageMetadata?.promptTokenCount ?? null,
    outputTokens: body.usageMetadata?.candidatesTokenCount ?? null,
  };
}

type OpenAiChoice = { finish_reason?: string; message?: { content?: string | null } };
type OpenAiUsage = { prompt_tokens?: number; completion_tokens?: number };

async function openAiChat(
  url: string,
  key: string,
  model: string,
  system: string,
  user: string,
  timeoutMs: number,
  extra: Record<string, unknown>,
) {
  const response = await postJson(
    url,
    { authorization: `Bearer ${key}` },
    {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 2000,
      ...extra,
    },
    timeoutMs,
  );
  if (!response.ok) throw new Error(`Model request failed (${response.status})`);
  const body = (await response.json()) as { choices?: OpenAiChoice[]; usage?: OpenAiUsage; error?: { message?: string } };
  if (body.error) throw new Error(`Model error: ${body.error.message ?? 'unknown'}`);
  const text = body.choices?.[0]?.message?.content ?? '';
  if (!text) throw new Error('Model returned no content');
  return {
    text,
    inputTokens: body.usage?.prompt_tokens ?? null,
    outputTokens: body.usage?.completion_tokens ?? null,
  };
}

function geminiProvider(): ProviderDef | null {
  const key = env('GEMINI_API_KEY');
  if (!key) return null;
  const model = env('GEMINI_MODEL') || 'gemini-3.6-flash';
  return { id: 'gemini', model, key, chat: (s, u, t) => geminiChat(key, model, s, u, t) };
}

function deepseekProvider(): ProviderDef | null {
  const key = env('DEEPSEEK_API_KEY');
  if (!key) return null;
  const model = env('DEEPSEEK_MODEL') || 'deepseek-chat';
  return {
    id: 'deepseek',
    model,
    key,
    chat: (s, u, t) => openAiChat('https://api.deepseek.com/chat/completions', key, model, s, u, t, {}),
  };
}

function museProvider(): ProviderDef | null {
  const key = env('MUSESPARK_API_KEY') || env('MUSE_API_KEY');
  if (!key) return null;
  const model = env('MUSE_MODEL') || 'muse-spark-1.1';
  return {
    id: 'muse',
    model,
    key,
    // Minimal reasoning keeps thinking tokens small; the answer still needs
    // headroom (max_tokens covers thinking + JSON).
    chat: (s, u, t) =>
      openAiChat('https://api.meta.ai/v1/chat/completions', key, model, s, u, t, { reasoning_effort: 'minimal' }),
  };
}

const ALL: Record<ProviderId, () => ProviderDef | null> = {
  gemini: geminiProvider,
  deepseek: deepseekProvider,
  muse: museProvider,
};

/** Chain order, default gemini → deepseek → muse. Override with AI_PROVIDERS="deepseek,muse". */
export function providerChain(): ProviderDef[] {
  const raw = env('AI_PROVIDERS') || 'gemini,deepseek,muse';
  const order = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is ProviderId => s === 'gemini' || s === 'deepseek' || s === 'muse');
  const chain = [...new Set(order)].map((id) => ALL[id]()).filter((p): p is ProviderDef => p !== null);
  if (chain.length === 0) throw new Error('No AI provider keys configured (GEMINI_API_KEY, DEEPSEEK_API_KEY, MUSESPARK_API_KEY)');
  return chain;
}

export { extractJson, sleep };
