import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    commit: process.env.COMMIT_REF ?? 'dev',
    built: process.env.BUILD_ID ?? null,
  });
}
