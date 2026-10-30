import { NextResponse } from 'next/server';

import { store } from '@/lib/store';

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const messages = await store.listMessages(id);
  return NextResponse.json({ id, messages });
}
