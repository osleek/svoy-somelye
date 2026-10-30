import { NextResponse } from 'next/server';

import { currentUser } from '@/lib/auth';
import { store } from '@/lib/store';

export const runtime = 'nodejs';

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ favorites: [] });
  const favorites = await store.listFavorites(user.id);
  return NextResponse.json({ favorites: favorites.map((f) => f.slug) });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { slug?: string };
  const slug = (body.slug ?? '').trim();
  if (!slug) return NextResponse.json({ error: 'Не указано вино' }, { status: 400 });

  const added = await store.toggleFavorite(user.id, slug);
  return NextResponse.json({ added });
}
