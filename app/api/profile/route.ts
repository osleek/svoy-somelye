import { NextResponse } from 'next/server';

import { currentUser } from '@/lib/auth';
import { store } from '@/lib/store';
import { DEFAULT_TASTE, type TasteAxes } from '@/lib/taste';

export const runtime = 'nodejs';

const clamp = (value: unknown, fallback: number) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(5, Math.round(n)));
};

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ taste: null });
  const taste = await store.getTasteProfile(user.id);
  return NextResponse.json({ taste });
}

export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Partial<TasteAxes>;
  const taste: TasteAxes = {
    acidity: clamp(body.acidity, DEFAULT_TASTE.acidity),
    tannin: clamp(body.tannin, DEFAULT_TASTE.tannin),
    body: clamp(body.body, DEFAULT_TASTE.body),
    sweetness: clamp(body.sweetness, DEFAULT_TASTE.sweetness),
    aroma: clamp(body.aroma, DEFAULT_TASTE.aroma),
  };

  await store.saveTasteProfile(user.id, taste);
  return NextResponse.json({ taste });
}
