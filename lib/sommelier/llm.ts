import type { RankedWine } from '@/lib/catalog/types';
import type { WireMessage } from './dialog';
import { EXTRACT_PROMPT, FEW_SHOT, SYSTEM_PROMPT } from './prompts';

export type LlmAnswer = {
  text: string;
  slugs: string[];
  why: Record<string, string>;
  clarify: { question: string; options: string[] } | null;
};

export type LlmPrefs = {
  type: string | null;
  sweetness: string | null;
  region: string | null;
  grape: string | null;
  dishes: string[];
  excludedTypes: string[];
  negative: boolean;
};

type Message = { role: 'system' | 'user' | 'assistant'; content: string };

const BASE = process.env.LLM_BASE_URL ?? 'https://api.openai.com/v1';
const MODEL = process.env.LLM_MODEL ?? 'gpt-4o-mini';

export function llmConfigured(): boolean {
  if (process.env.LLM_DISABLED === '1') return false;
  return Boolean(process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY);
}

function apiKey(): string {
  return (process.env.OPENAI_API_KEY ?? process.env.LLM_API_KEY ?? process.env.DEEPSEEK_API_KEY) as string;
}

function parseJson(raw: string): unknown | null {
  const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

async function callOnce(
  messages: Message[],
  temperature: number,
  maxTokens: number,
  jsonMode: boolean,
): Promise<{ ok: boolean; status: number; content: string | null }> {
  try {
    const res = await fetch(`${BASE.replace(/\s+/g, "").trim()}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey().trim()}` },
      body: JSON.stringify({
        model: MODEL.trim(),
        messages,
        max_tokens: maxTokens,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: AbortSignal.timeout(9000),
    });

    if (!res.ok) return { ok: false, status: res.status, content: null };

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return { ok: true, status: res.status, content: data.choices?.[0]?.message?.content ?? null };
  } catch {
    return { ok: false, status: 0, content: null };
  }
}

async function call(messages: Message[], temperature: number, maxTokens: number): Promise<string | null> {
  const strict = await callOnce(messages, temperature, maxTokens, true);
  if (strict.ok && strict.content) return strict.content;
  if (strict.ok) return null;

  const plain = await callOnce(messages, temperature, maxTokens, false);
  return plain.ok ? plain.content : null;
}

const PRICE_PATTERN = /\d[\d\s.]*\s*(₽|руб|рублей)/i;

function toWire(messages: WireMessage[]): Message[] {
  return messages.slice(-10).map((m) => ({
    role: m.role,
    content:
      m.role === 'assistant' && m.slugs?.length
        ? `${m.content}\n[показаны: ${m.slugs.join(', ')}]`
        : m.content,
  }));
}

export async function extractPrefs(messages: WireMessage[]): Promise<LlmPrefs | null> {
  if (!llmConfigured()) return null;

  const raw = await call(
    [
      { role: 'system', content: EXTRACT_PROMPT },
      ...toWire(messages),
      { role: 'user', content: 'Разбери переписку и верни JSON.' },
    ],
    0,
    300,
  );
  if (!raw) return null;

  const data = parseJson(raw) as Partial<LlmPrefs> | null;
  if (!data || typeof data !== 'object') return null;

  const asString = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const asList = (v: unknown) =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === 'string' && Boolean(x.trim())).slice(0, 6)
      : [];

  return {
    type: asString(data.type),
    sweetness: asString(data.sweetness),
    region: asString(data.region),
    grape: asString(data.grape),
    dishes: asList(data.dishes),
    excludedTypes: asList(data.excludedTypes),
    negative: Boolean(data.negative),
  };
}

function recoverSlugs(text: string, candidates: RankedWine[]): string[] {
  const norm = (value: string) =>
    value
      .toLowerCase()
      .replace(/[«»"'`]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const hay = norm(text);
  const found: string[] = [];
  for (const wine of candidates) {
    const name = norm(wine.name);
    if (name.length > 4 && hay.includes(name) && !found.includes(wine.slug)) found.push(wine.slug);
    if (found.length === 3) break;
  }
  return found;
}

export async function composeAnswer(
  messages: WireMessage[],
  candidates: RankedWine[],
  prefs: Record<string, unknown>,
  relaxed: string | null = null,
  profile?: { favoriteTypes: string[]; favoriteRegions: string[]; favoriteGrapes: string[]; recentQueries: string[]; dislikedSlugs: string[] },
): Promise<LlmAnswer | null> {
  if (!llmConfigured() || !candidates.length) return null;

  const cards = candidates.slice(0, 6).map((w) => ({
    slug: w.slug,
    name: w.name,
    maker: w.manufacturer,
    region: w.region,
    type: w.type,
    sweetness: w.sweetness,
    grapes: w.grapes,
    dishes: w.dishes,
  }));

  const base: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...FEW_SHOT,
    ...toWire(messages),
  ];

  const task = JSON.stringify({ prefs, relaxed, profile: profile ?? null, candidates: cards });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const hint = relaxed
      ? `\n\nОграничение по параметру «${relaxed}» снято, потому что точных совпадений нет. Скажи об этом одной фразой.`
      : "";
    const nudge =
      attempt === 0
        ? `${task}${hint}`
        : `${task}\n\nПредыдущий ответ отклонён: неверный формат, выдуманный slug или упоминание цены. Верни строго JSON по схеме.`;

    const raw = await call([...base, { role: "user", content: nudge }], 0.2, 500);
    if (!raw) return null;

    const data = parseJson(raw) as { text?: unknown; picks?: unknown; clarify?: unknown } | null;

    if (!data || typeof data.text !== 'string') {
      const clean = raw
        .replace(/^```(?:json)?/i, '')
        .replace(/```$/, '')
        .trim();
      if (clean.length > 10 && !PRICE_PATTERN.test(clean)) {
        return { text: clean, slugs: recoverSlugs(clean, candidates), why: {}, clarify: null };
      }
      continue;
    }

    if (PRICE_PATTERN.test(data.text)) continue;

    const allowed = new Set(candidates.map((c) => c.slug));
    const why: Record<string, string> = {};
    const slugs: string[] = [];

    if (Array.isArray(data.picks)) {
      for (const item of data.picks) {
        if (!item || typeof item !== 'object') continue;
        const slug = (item as { slug?: unknown }).slug;
        if (typeof slug !== 'string' || !allowed.has(slug) || slugs.includes(slug)) continue;
        slugs.push(slug);
        const reason = (item as { why?: unknown }).why;
        if (typeof reason === 'string' && !PRICE_PATTERN.test(reason)) why[slug] = reason;
        if (slugs.length === 3) break;
      }
    }

    const clarifySource = data.clarify as { question?: unknown; options?: unknown } | null;
    const clarify =
      clarifySource && typeof clarifySource.question === 'string'
        ? {
            question: clarifySource.question,
            options: Array.isArray(clarifySource.options)
              ? clarifySource.options.filter((o): o is string => typeof o === 'string').slice(0, 4)
              : [],
          }
        : null;

    return { text: data.text, slugs, why, clarify };
  }

  return null;
}
