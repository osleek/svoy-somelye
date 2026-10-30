import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import https from 'node:https';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const IMAGE_BASE = 'https://api.vino-svoe.ru/v1/img/str-api/600/600/resize';
const CACHE_DIR = path.join(process.cwd(), 'data', 'img-cache');
const VALID = /^\/uploads\/[A-Za-z0-9._-]+\.(webp|png|jpe?g)$/i;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function cachePath(src: string): string {
  const hash = createHash('sha1').update(src).digest('hex');
  return path.join(CACHE_DIR, `${hash}.bin`);
}

function viaHttps(url: string, allowInvalidCert: boolean): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const request = https.get(
      url,
      {
        headers: {
          'User-Agent': UA,
          Accept: 'image/avif,image/webp,image/png,image/*,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9',
          Referer: 'https://vino-svoe.ru/',
        },
        timeout: 15000,
        rejectUnauthorized: !allowInvalidCert,
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          resolve(null);
          return;
        }
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', () => resolve(null));
      },
    );
    request.on('timeout', () => {
      request.destroy();
      resolve(null);
    });
    request.on('error', () => resolve(null));
  });
}

async function fetchUpstream(src: string): Promise<Buffer | null> {
  const url = `${IMAGE_BASE}${src}`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': UA,
          Accept: 'image/avif,image/webp,image/png,image/*,*/*;q=0.8',
          Referer: 'https://vino-svoe.ru/',
        },
        signal: AbortSignal.timeout(15000),
        cache: 'no-store',
      });
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length > 0) return buffer;
      }
    } catch {
      // сертификат или сеть — пробуем запасной путь
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  const strict = await viaHttps(url, false);
  if (strict) return strict;

  return viaHttps(url, true);
}

export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get('src') ?? '';
  if (!VALID.test(src)) {
    return new NextResponse('Bad image path', { status: 400 });
  }

  const file = cachePath(src);

  try {
    if (existsSync(file)) {
      const cached = await readFile(file);
      if (cached.length > 0) {
        return new NextResponse(new Uint8Array(cached), {
          headers: {
            'Content-Type': 'image/webp',
            'Cache-Control': 'private, max-age=86400',
            'X-Cache': 'hit',
          },
        });
      }
    }
  } catch {
    // кэш недоступен
  }

  const buffer = await fetchUpstream(src);
  if (!buffer) {
    return new NextResponse('Image unavailable', { status: 502 });
  }

  try {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    await writeFile(file, buffer);
  } catch {
    // не смогли закэшировать
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'private, max-age=86400',
      'X-Cache': 'miss',
    },
  });
}
