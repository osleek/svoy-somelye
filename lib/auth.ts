import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

import { store, type User } from '@/lib/store';

export const COOKIE = 'vino_session';
const MAX_AGE = 60 * 60 * 24 * 30;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export function publicUser(user: User) {
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
}

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const session = await store.findSession(token);
  if (!session) return null;
  return (await store.findUserById(session.userId)) ?? null;
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(24).toString('hex');
  await store.addSession({ token, userId, createdAt: new Date().toISOString() });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await store.removeSession(token);
  jar.delete(COOKIE);
}
