import { NextResponse } from 'next/server';

import { currentUser } from '@/lib/auth';
import { store } from '@/lib/store';

export const runtime = 'nodejs';

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ conversations: [] });
  const conversations = await store.listConversations(user.id);
  return NextResponse.json({ conversations });
}
