import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 26;

export async function GET() {
  const base = process.env.LLM_BASE_URL ?? 'https://api.openai.com/v1';
  const model = process.env.LLM_MODEL ?? 'gpt-4o-mini';
  const key = process.env.DEEPSEEK_API_KEY ?? process.env.OPENAI_API_KEY ?? process.env.LLM_API_KEY ?? '';

  if (!key) {
    return NextResponse.json({ ok: false, reason: 'ключ не задан', base, model });
  }

  try {
    const res = await fetch(`${base.replace(/\s+/g, '').trim()}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key.trim()}` },
      body: JSON.stringify({
        model: model.trim(),
        messages: [{ role: 'user', content: 'ответь одним словом: ок' }],
        max_tokens: 10,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const text = await res.text();
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      base,
      model,
      keyTail: key.slice(-4),
      body: text.slice(0, 200),
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      reason: error instanceof Error ? error.message : 'unknown',
      base,
      model,
      keyTail: key.slice(-4),
    });
  }
}
