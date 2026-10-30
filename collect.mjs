

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://vino-svoe.ru';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; svoy-somelye/1.0)',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'ru-RU,ru;q=0.9',
};

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : fallback;
};
const LIMIT_WINES = opt('limit', Infinity);
const LIMIT_PAGES = opt('pages', 200);
const DELAY_MS = opt('delay', 220);

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, attempt = 1) {
  try {

    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    if (attempt >= 3) throw err;
    await delay(600 * attempt);
    return get(url, attempt + 1);
  }
}

const SPECIAL = new Set([
  'ShallowReactive', 'Reactive', 'Ref', 'ShallowRef', 'EmptyRef',
  'EmptyShallowRef', 'Date', 'Set', 'Map', 'RegExp', 'BigInt',
  'null', 'undefined', 'NaN', '-0', 'Infinity', '-Infinity',
]);

function unflatten(parsed) {
  const memo = new Map();

  function resolve(index) {
    if (memo.has(index)) return memo.get(index);
    const node = parsed[index];

    if (Array.isArray(node)) {
      const tag = node[0];
      if (typeof tag === 'string' && SPECIAL.has(tag)) {
        let out;
        switch (tag) {
          case 'Date': out = new Date(node[1]); break;
          case 'null': out = null; break;
          case 'undefined': out = undefined; break;
          case 'NaN': out = NaN; break;
          case 'Infinity': out = Infinity; break;
          case '-Infinity': out = -Infinity; break;
          case '-0': out = -0; break;
          case 'BigInt': out = BigInt(node[1]); break;
          case 'Set': out = new Set(resolve(node[1]) ?? []); break;
          case 'Map': out = new Map(resolve(node[1]) ?? []); break;
          case 'RegExp': out = new RegExp(node[1].source ?? node[1]); break;
          default: out = resolve(node[1]);
        }
        memo.set(index, out);
        return out;
      }

      const out = [];
      memo.set(index, out);
      for (const item of node) out.push(resolve(item));
      return out;
    }

    if (node && typeof node === 'object') {
      const out = {};
      memo.set(index, out);
      for (const [key, ref] of Object.entries(node)) out[key] = resolve(ref);
      return out;
    }

    memo.set(index, node);
    return node;
  }

  return resolve(0);
}

function extractPayload(html) {
  const match = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    return unflatten(JSON.parse(match[1]));
  } catch {
    return null;
  }
}

function collectSlugs(html) {
  const slugs = new Set();
  for (const m of html.matchAll(/href="\/wines\/([a-z0-9-]+)"/g)) slugs.add(m[1]);
  return [...slugs];
}

function pickWine(payload, slug) {
  if (!payload || !payload.data) return null;
  const entry = payload.data[`wine-${slug}`];
  return entry?.wine ?? null;
}

const nameOf = (value) => {
  if (value == null) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (Array.isArray(value)) {
    const parts = value.map(nameOf).filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  }
  if (typeof value === 'object') {
    for (const key of ['name', 'title', 'value', 'text']) {
      if (typeof value[key] === 'string' && value[key].trim()) return value[key].trim();
    }
    return null;
  }
  return null;
};

const listOf = (value) => {
  if (value == null) return [];
  const items = Array.isArray(value) ? value : [value];
  return items.map(nameOf).filter(Boolean);
};

const imageOf = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return imageOf(value[0]);
  if (typeof value === 'object') return value.url ?? value.src ?? null;
  return null;
};

function normalize(raw, slug) {
  if (!raw) return null;
  const category = nameOf(raw.category);
  const colourType = category?.match(/^(Белое|Красное|Розовое|Оранжевое)/i)?.[0] ?? null;
  const sweetness = category?.match(/(полусух|полусладк|сух|сладк|брют)[а-яё]*/i)?.[0] ?? null;

  return {
    slug,
    url: `${BASE}/wines/${slug}`,
    name: nameOf(raw.name) ?? nameOf(raw.title),
    manufacturer: nameOf(raw.manufacturer),
    region: nameOf(raw.region),
    category,
    type: colourType,
    sweetness,
    color: nameOf(raw.color),
    grapes: listOf(raw.grapes),
    alcohol: raw.alcohol ? `${raw.alcohol}${raw.alcoholMax ? '–' + raw.alcoholMax : ''}%` : null,
    rating: raw.publicRating ?? null,
    description: nameOf(raw.description),
    dishes: listOf(raw.dishes),
    image: imageOf(raw.image),
    price: raw.price ?? raw.cost ?? null,
  };
}

async function main() {
  const started = new Date();
  const slugs = [];
  let pages = 0;

  for (let page = 1; page <= LIMIT_PAGES; page += 1) {
    const html = await get(`${BASE}/wines?page=${page}`);
    const found = collectSlugs(html);
    const fresh = found.filter((s) => !slugs.includes(s));
    pages = page;
    if (!fresh.length) break;
    slugs.push(...fresh);
    process.stdout.write(`\rлистинг: страница ${page}, найдено ${slugs.length} вин   `);
    if (slugs.length >= LIMIT_WINES) break;
    await delay(DELAY_MS);
  }

  const targets = slugs.slice(0, LIMIT_WINES);
  console.log(`\nкарточек к разбору: ${targets.length}`);

  const wines = [];
  const failed = [];
  let parsed = 0;

  for (let i = 0; i < targets.length; i += 1) {
    const slug = targets[i];
    try {
      const html = await get(`${BASE}/wines/${slug}`);
      const payload = extractPayload(html);
      const raw = pickWine(payload, slug);
      if (args.includes('--dump') && raw) {
        for (const key of ['region', 'grapes', 'dishes', 'category', 'manufacturer', 'sugar', 'description']) {
          console.log(`--- ${key} ---`);
          console.log(JSON.stringify(raw[key], null, 1).slice(0, 700));
        }
        process.exit(0);
      }
      const wine = normalize(raw, slug);
      if (wine) {
        wines.push(wine);
        parsed += 1;
      } else {
        failed.push({ slug, reason: payload ? 'нет объекта wine' : 'нет __NUXT_DATA__' });
      }
    } catch (err) {
      failed.push({ slug, reason: String(err.message ?? err) });
    }
    process.stdout.write(`\rразбор: ${i + 1}/${targets.length}, успешно ${parsed}`);
    await delay(DELAY_MS);
  }

  const outDir = join(dirname(fileURLToPath(import.meta.url)), 'data');
  await mkdir(outDir, { recursive: true });

  const meta = {
    source: BASE,
    collectedAt: started.toISOString(),
    listingPages: pages,
    requested: targets.length,
    parsed: wines.length,
    failed: failed.length,
    failures: failed.slice(0, 20),
  };

  await writeFile(join(outDir, 'catalog.json'), JSON.stringify(wines, null, 2), 'utf8');
  await writeFile(join(outDir, 'catalog.meta.json'), JSON.stringify(meta, null, 2), 'utf8');

  const regions = new Set(wines.map((w) => w.region).filter(Boolean));
  const makers = new Set(wines.map((w) => w.manufacturer).filter(Boolean));
  const withDishes = wines.filter((w) => w.dishes.length).length;
  const withDesc = wines.filter((w) => w.description).length;
  const withGrapes = wines.filter((w) => w.grapes).length;
  const withPrice = wines.filter((w) => w.price != null).length;

  console.log(`\n\nкаталог: ${wines.length} вин, ${regions.size} регионов, ${makers.size} виноделен`);
  console.log(`с описанием: ${withDesc}, сортами: ${withGrapes}, блюдами: ${withDishes}, с ценой: ${withPrice}`);
  console.log(`ошибок: ${failed.length}`);
  console.log(`файлы: ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
