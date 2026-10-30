import { NextResponse } from 'next/server';

import { recommend } from '@/lib/catalog/search';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? '';
  const limit = Number(searchParams.get('limit') ?? 5);

  const result = recommend(q, { limit: Number.isFinite(limit) ? limit : 5 });
  return NextResponse.json(result);
}
