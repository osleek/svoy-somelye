import { NextResponse } from 'next/server';

import { createSession, publicUser, verifyPassword } from '@/lib/auth';
import { store } from '@/lib/store';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';

  const user = await store.findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({ user: publicUser(user) });
}
