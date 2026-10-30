

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = join(HERE, '..', 'data', 'catalog.json');

const DISH_SYNONYMS = [
  [/стейк|мясо|говядин|баран|свинин|шашлык|грил/i, 'Мясо и стейки'],
  [/птиц|кур|утк|индейк|цыплен/i, 'Блюда из птицы'],
  [/сыр|чиз/i, 'Сыры'],
  [/рыб|лосос|тунец|морепродукт|креветк|устриц|мидии/i, 'Рыба и морепродукты'],
  [/салат|овощ|зелен/i, 'Салаты'],
  [/закуск|брускет|тапас|антипаст/i, 'Закуски'],
  [/барбекю|bbq|гриль|мангал/i, 'BBQ'],
  [/десерт|сладк|торт|шоколад|фрукт|выпечк/i, 'Десерты'],
  [/паст|ризотт|пицц/i, 'Паста и пицца'],
  [/кавказск|хинкал|шашлык по-кавказски/i, 'Кавказская кухня'],
  [/мясное ассорти|нарезк|колбас/i, 'Мясное ассорти'],
  [/суп|бульон/i, 'Супы'],
];

const TYPE_WORDS = [
  [/красн/i, 'Красное'],

  [/бел(ое|ый|ого|ым|ом|ая|ую|ых|ые)?/i, 'Белое'],
  [/розов/i, 'Розовое'],
  [/оранжев/i, 'Оранжевое'],
];

const SWEETNESS_WORDS = [
  [/полусладк/i, 'полусладкое'],
  [/полусух/i, 'полусухое'],
  [/брют/i, 'брют'],
  [/сладк/i, 'сладкое'],
  [/сух/i, 'сухое'],
];

const REGION_WORDS = [
  [/крым/i, 'Крым'],
  [/кубан|краснодар/i, 'Кубань'],
  [/осети|алани/i, 'Северная Осетия — Алания'],
  [/дагестан/i, 'Дагестан'],
];

let cache = null;

export async function loadCatalog(path = CATALOG_PATH) {
  if (cache) return cache;
  const raw = await readFile(path, 'utf8');
  const wines = JSON.parse(raw);
  const dishes = [...new Set(wines.flatMap((w) => w.dishes))].sort();
  const grapes = [...new Set(wines.flatMap((w) => w.grapes))].sort();
  const regions = [...new Set(wines.map((w) => w.region).filter(Boolean))].sort();
  cache = { wines, dishes, grapes, regions };
  return cache;
}

export function parseQuery(text, catalog) {
  const q = String(text || '').toLowerCase();
  const constraints = { type: null, sweetness: null, region: null, grape: null, dishes: [], occasion: null };

  for (const [re, value] of TYPE_WORDS) if (re.test(q)) { constraints.type = value; break; }
  for (const [re, value] of SWEETNESS_WORDS) if (re.test(q)) { constraints.sweetness = value; break; }
  for (const [re, value] of REGION_WORDS) if (re.test(q)) { constraints.region = value; break; }


  for (const grape of catalog.grapes) {
    const stem = grape.toLowerCase().slice(0, Math.max(4, grape.length - 2));
    if (stem.length >= 4 && q.includes(stem)) { constraints.grape = grape; break; }
  }

  for (const [re, dish] of DISH_SYNONYMS) {
    if (re.test(q) && catalog.dishes.includes(dish) && !constraints.dishes.includes(dish)) {
      constraints.dishes.push(dish);
    }
  }

  if (/подар|презент|день рожден|юбилей/i.test(q)) constraints.occasion = 'gift';
  if (/ужин|романтич|свидан/i.test(q)) constraints.occasion = 'dinner';

  return constraints;
}

function matchesHard(wine, c) {
  if (c.type && wine.type !== c.type) return false;
  if (c.sweetness && wine.sweetness !== c.sweetness) return false;
  if (c.region && wine.region !== c.region) return false;
  if (c.grape && !wine.grapes.some((g) => g === c.grape)) return false;
  if (c.dishes.length && !c.dishes.some((d) => wine.dishes.includes(d))) return false;
  return true;
}

function score(wine, c) {
  let value = 0;
  const reasons = [];

  const dishHits = c.dishes.filter((d) => wine.dishes.includes(d));
  if (dishHits.length) {
    value += 5 * dishHits.length;
    reasons.push(`в карточке указано сочетание: ${dishHits.join(', ')}`);
  }
  if (c.type && wine.type === c.type) { value += 3; reasons.push(`${wine.type.toLowerCase()} вино`); }
  if (c.sweetness && wine.sweetness === c.sweetness) { value += 3; reasons.push(wine.sweetness); }
  if (c.region && wine.region === c.region) { value += 3; reasons.push(`регион ${wine.region}`); }
  if (c.grape && wine.grapes.includes(c.grape)) { value += 4; reasons.push(`сорт ${c.grape}`); }

  if (typeof wine.rating === 'number') value += Math.min(wine.rating, 5) * 0.4;
  if (c.occasion === 'gift' && typeof wine.rating === 'number') {
    value += wine.rating * 0.5;
    reasons.push(`рейтинг каталога ${wine.rating}`);
  }



  if (!reasons.length) {
    const bits = [wine.type, wine.sweetness, wine.region].filter(Boolean);
    reasons.push(bits.length ? `карточка каталога: ${bits.join(', ').toLowerCase()}` : 'позиция из каталога');
  }

  return { value, reasons };
}

export async function recommend(text, { limit = 5, catalog = null } = {}) {
  const cat = catalog ?? await loadCatalog();
  const constraints = parseQuery(text, cat);
  const candidates = cat.wines.filter((w) => matchesHard(w, constraints));

  const ranked = candidates
    .map((wine) => ({ wine, ...score(wine, constraints) }))
    .sort((a, b) => b.value - a.value || (b.wine.rating ?? 0) - (a.wine.rating ?? 0))
    .slice(0, limit);

  const notes = [];
  if (constraints.type) notes.push(`тип: ${constraints.type}`);
  if (constraints.sweetness) notes.push(`сладость: ${constraints.sweetness}`);
  if (constraints.region) notes.push(`регион: ${constraints.region}`);
  if (constraints.grape) notes.push(`сорт: ${constraints.grape}`);
  if (constraints.dishes.length) notes.push(`блюда: ${constraints.dishes.join(', ')}`);

  return {
    results: ranked.map(({ wine, reasons }) => ({ ...wine, reasons })),
    constraintNotes: notes,
    empty: ranked.length === 0,
    totalCandidates: candidates.length,
  };
}

if (process.argv[1] && process.argv[1].endsWith('search.mjs') && process.argv[2]) {
  const res = await recommend(process.argv.slice(2).join(' '));
  console.log(`Запрос: «${process.argv.slice(2).join(' ')}»`);
  console.log(`Ограничения: ${res.constraintNotes.join('; ') || 'нет'}`);
  console.log(`Кандидатов в каталоге: ${res.totalCandidates}\n`);
  if (res.empty) console.log('Подходящих вин нет — честный отказ вместо выдумки.');
  for (const [i, w] of res.results.entries()) {
    console.log(`${i + 1}. ${w.name} — ${w.manufacturer} (${w.region})`);
    console.log(`   ${w.type}, ${w.sweetness}, ${w.alcohol}; сорта: ${w.grapes.join(', ')}`);
    console.log(`   почему: ${w.reasons.join('; ')}`);
    console.log(`   ${w.url}\n`);
  }
}
