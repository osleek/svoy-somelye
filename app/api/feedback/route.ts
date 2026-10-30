import { NextResponse } from 'next/server';

import { currentUser } from '@/lib/auth';
import { store } from '@/lib/store';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, reason: 'нужен вход' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { slug?: string; value?: number; query?: string };
  const slug = (body.slug ?? '').trim();
  const value = body.value === -1 ? -1 : 1;
  if (!slug) return NextResponse.json({ error: 'Не указано вино' }, { status: 400 });

  await store.addFeedback({ userId: user.id, slug, value, query: body.query ?? '', createdAt: new Date().toISOString() });
  return NextResponse.json({ ok: true });
}
