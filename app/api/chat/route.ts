import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

import { currentUser } from '@/lib/auth';
import { buildProfile } from '@/lib/profile';
import { composeReply } from '@/lib/sommelier/compose';
import type { WireMessage } from '@/lib/sommelier/dialog';
import { llmConfigured } from '@/lib/sommelier/llm';
import { store } from '@/lib/store';

export const runtime = 'nodejs';
export const maxDuration = 26;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    message?: string;
    history?: WireMessage[];
    conversationId?: string;
  };

  const message = (body.message ?? '').trim();
  if (!message) {
    return NextResponse.json({ error: 'Пустой запрос' }, { status: 400 });
  }

  const user = await currentUser();
  const conversationId = body.conversationId ?? randomUUID();
  await store.ensureConversation(conversationId, user?.id ?? null);
  await store.addMessage(conversationId, { role: 'user', content: message, slugs: [] });

  const history: WireMessage[] = [...(body.history ?? []), { role: 'user', content: message }];
  const profile = user ? await buildProfile(user.id) : undefined;
  const reply = await composeReply(history, profile);

  await store.addMessage(conversationId, {
    role: 'assistant',
    content: reply.text,
    slugs: reply.picks.map((p) => p.slug),
  });

  if (user && reply.picks[0]) {
    await store.addHistory({
      userId: user.id,
      slug: reply.picks[0].slug,
      query: message,
      createdAt: new Date().toISOString(),
    });
  }

  return NextResponse.json({ ...reply, conversationId, llm: llmConfigured() });
}
