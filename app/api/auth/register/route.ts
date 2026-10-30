import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

import { createSession, hashPassword, publicUser } from '@/lib/auth';
import { store } from '@/lib/store';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    name?: string;
  };

  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  const name = (body.name ?? '').trim();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Некорректный email' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Пароль должен быть не короче 6 символов' }, { status: 400 });
  }
  if (await store.findUserByEmail(email)) {
    return NextResponse.json({ error: 'Такой аккаунт уже есть' }, { status: 409 });
  }

  const user = {
    id: randomUUID(),
    email,
    name: name || email.split('@')[0],
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };

  await store.addUser(user);
  await createSession(user.id);

  return NextResponse.json({ user: publicUser(user) });
}
