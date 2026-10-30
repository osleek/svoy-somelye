import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 26;

const base = () => (process.env.LLM_BASE_URL ?? 'https://api.openai.com/v1').replace(/\s+/g, '').trim();
const model = () => (process.env.LLM_MODEL ?? 'gpt-4o-mini').trim();
const key = () =>
  (process.env.DEEPSEEK_API_KEY ?? process.env.OPENAI_API_KEY ?? process.env.LLM_API_KEY ?? '').trim();

async function ping(withJsonMode: boolean) {
  const started = Date.now();
  try {
    const res = await fetch(`${base()}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key()}` },
      body: JSON.stringify({
        model: model(),
        messages: [{ role: 'user', content: 'верни JSON {"ok":true}' }],
        max_tokens: 40,
        ...(withJsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    return {
      mode: withJsonMode ? 'json' : 'plain',
      ok: res.ok,
      status: res.status,
      ms: Date.now() - started,
      body: text.slice(0, 160),
    };
  } catch (error) {
    return {
      mode: withJsonMode ? 'json' : 'plain',
      ok: false,
      ms: Date.now() - started,
      reason: error instanceof Error ? error.message : 'unknown',
    };
  }
}

export async function GET() {
  if (!key()) return NextResponse.json({ ok: false, reason: 'ключ не задан' });

  const [plain, json] = await Promise.all([ping(false), ping(true)]);
  return NextResponse.json({ base: base(), model: model(), plain, json });
}
