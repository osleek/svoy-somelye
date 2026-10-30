import { NextResponse } from 'next/server';

import { getCatalog } from '@/lib/catalog/load';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slugs = (searchParams.get('slugs') ?? '').split(',').filter(Boolean);
  const catalog = getCatalog();

  const wines = catalog.wines
    .filter((w) => slugs.includes(w.slug))
    .map((w) => ({ ...w, reasons: [], score: 0 }));

  return NextResponse.json({ wines });
}
