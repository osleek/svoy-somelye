import { NextResponse } from 'next/server';

import { hasDb } from '@/lib/db';
import { llmConfigured, probe } from '@/lib/sommelier/llm';

export const runtime = 'nodejs';
export const maxDuration = 26;

export async function GET() {
  const llm = await probe();
  return NextResponse.json({
    database: hasDb(),
    llmConfigured: llmConfigured(),
    ...llm,
  });
}
