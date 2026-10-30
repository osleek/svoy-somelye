import { NextResponse } from 'next/server';

import { currentUser } from '@/lib/auth';
import { store } from '@/lib/store';

export const runtime = 'nodejs';

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ history: [] });
  return NextResponse.json({ history: await store.listHistory(user.id) });
}
