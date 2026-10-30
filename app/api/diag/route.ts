import { NextResponse } from 'next/server';

import { composeReply } from '@/lib/sommelier/compose';
import type { WireMessage } from '@/lib/sommelier/dialog';
import { llmConfigured } from '@/lib/sommelier/llm';

export const runtime = 'nodejs';
export const maxDuration = 26;

export async function GET() {
  const history: WireMessage[] = [{ role: 'user', content: 'красное к стейку' }];
  const started = Date.now();

  try {
    const reply = await composeReply(history);
    return NextResponse.json({
      configured: llmConfigured(),
      base: process.env.LLM_BASE_URL ?? null,
      model: process.env.LLM_MODEL ?? null,
      ms: Date.now() - started,
      source: reply.source,
      picks: reply.picks.length,
      text: reply.text,
    });
  } catch (error) {
    return NextResponse.json({
      configured: llmConfigured(),
      base: process.env.LLM_BASE_URL ?? null,
      model: process.env.LLM_MODEL ?? null,
      ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.slice(0, 600) : null,
    });
  }
}
