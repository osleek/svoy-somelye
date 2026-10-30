import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { Catalog, Wine } from './types';

let cache: Catalog | null = null;

function proxiedImage(image: string | null): string | null {
  if (!image) return null;
  const path = image.startsWith('http') ? new URL(image).pathname : image;
  return `/api/img?src=${encodeURIComponent(path)}`;
}

export function getCatalog(): Catalog {
  if (cache) return cache;

  const file = path.join(process.cwd(), 'data', 'catalog.json');
  const raw = JSON.parse(readFileSync(file, 'utf8')) as Wine[];

  const wines: Wine[] = raw.map((w) => ({ ...w, image: proxiedImage(w.image) }));

  cache = {
    wines,
    dishes: [...new Set(wines.flatMap((w) => w.dishes))].sort(),
    grapes: [...new Set(wines.flatMap((w) => w.grapes))].sort(),
    regions: [...new Set(wines.map((w) => w.region).filter((r): r is string => Boolean(r)))].sort(),
  };

  return cache;
}
