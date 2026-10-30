import { NextResponse } from 'next/server';

import { currentUser, publicUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  const user = await currentUser();
  return NextResponse.json({ user: user ? publicUser(user) : null });
}
