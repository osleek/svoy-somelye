

import { loadCatalog, recommend } from '../lib/search.mjs';

const CASES = [
  {
    id: 'steak-red-dry',
    q: 'красное сухое к стейку',
    expect: { type: 'Красное', sweetness: 'сухое', dish: 'Мясо и стейки', min: 1 },
  },
  {
    id: 'fish-white',
    q: 'белое к рыбе',
    expect: { type: 'Белое', dish: 'Рыба и морепродукты', min: 1 },
  },
  {
    id: 'cheese',
    q: 'вино к сырам',
    expect: { dish: 'Сыры', min: 1 },
  },
  {
    id: 'grape-chardonnay',
    q: 'шардоне',
    expect: { grape: 'Шардоне', min: 1 },
  },
  {
    id: 'crimea-rose',
    q: 'крымское розовое',
    expect: { region: 'Крым', type: 'Розовое', min: 1 },
  },
  {
    id: 'semi-sweet-dessert',
    q: 'полусладкое к десерту',
    expect: { sweetness: 'полусладкое', dish: 'Десерты', min: 0 },
  },
  {
    id: 'orange',
    q: 'оранжевое вино',
    expect: { type: 'Оранжевое', min: 1 },
  },
  {
    id: 'gift',
    q: 'что подарить на день рождения',
    expect: { min: 1 },
  },
  {
    id: 'barbecue',
    q: 'к барбекю',
    expect: { dish: 'BBQ', min: 1 },
  },
  {
    id: 'impossible-red-brut',
    q: 'красное брют из Дагестана',
    expect: { empty: true },
  },
  {
    id: 'impossible-orange-ossetia',
    q: 'оранжевое из Северной Осетии',
    expect: { empty: true },
  },
];

const results = [];
const record = (caseId, name, ok, info = '') => results.push({ caseId, name, ok, info });

function groundCheck(wine, catalogSet) {
  const problems = [];
  if (!catalogSet.has(wine.slug)) problems.push('позиции нет в каталоге');
  if (!wine.url || !wine.url.startsWith('https://vino-svoe.ru/wines/')) problems.push('нет ссылки на источник');
  if (!wine.reasons?.length) problems.push('нет объяснения выбора');

  for (const reason of wine.reasons ?? []) {
    const dishMatch = reason.match(/в карточке указано сочетание: (.+)$/);
    if (dishMatch) {
      for (const dish of dishMatch[1].split(', ')) {
        if (!wine.dishes.includes(dish)) problems.push(`объяснение ссылается на несуществующее блюдо «${dish}»`);
      }
    }
    const grapeMatch = reason.match(/^сорт (.+)$/);
    if (grapeMatch && !wine.grapes.includes(grapeMatch[1])) {
      problems.push(`объяснение ссылается на несуществующий сорт «${grapeMatch[1]}»`);
    }
  }
  return problems;
}

const catalog = await loadCatalog();
const catalogSet = new Set(catalog.wines.map((w) => w.slug));
console.log(`Каталог: ${catalog.wines.length} вин, ${catalog.regions.length} регионов, ${catalog.grapes.length} сортов\n`);

for (const testCase of CASES) {
  const res = await recommend(testCase.q, { limit: 5, catalog });
  const { expect } = testCase;

  record(testCase.id, 'каталог загружен', catalog.wines.length > 0);

  if (expect.empty) {
    record(testCase.id, 'нет подходящих — возвращён пустой список', res.empty,
      `кандидатов: ${res.totalCandidates}`);
    continue;
  }

  record(testCase.id, `есть результаты (${res.results.length})`, res.results.length >= (expect.min ?? 1));


  const problems = res.results.flatMap((w) => groundCheck(w, catalogSet));
  record(testCase.id, 'все позиции из каталога, объяснения обоснованы', problems.length === 0, problems.slice(0, 2).join('; '));

  if (expect.type) {
    const bad = res.results.filter((w) => w.type !== expect.type);
    record(testCase.id, `тип = ${expect.type}`, bad.length === 0, bad.map((w) => w.name).slice(0, 2).join(', '));
  }
  if (expect.sweetness) {
    const bad = res.results.filter((w) => w.sweetness !== expect.sweetness);
    record(testCase.id, `сладость = ${expect.sweetness}`, bad.length === 0, bad.map((w) => w.name).slice(0, 2).join(', '));
  }
  if (expect.region) {
    const bad = res.results.filter((w) => w.region !== expect.region);
    record(testCase.id, `регион = ${expect.region}`, bad.length === 0, bad.map((w) => w.region).slice(0, 2).join(', '));
  }
  if (expect.grape) {
    const bad = res.results.filter((w) => !w.grapes.includes(expect.grape));
    record(testCase.id, `сорт = ${expect.grape}`, bad.length === 0, bad.map((w) => w.name).slice(0, 2).join(', '));
  }
  if (expect.dish) {
    const top = res.results.slice(0, 3);
    const hits = top.filter((w) => w.dishes.includes(expect.dish));
    record(testCase.id, `блюдо «${expect.dish}» в топ-3`, hits.length > 0, `совпало ${hits.length} из ${top.length}`);
  }
}

const byCase = new Map();
for (const r of results) {
  if (!byCase.has(r.caseId)) byCase.set(r.caseId, []);
  byCase.get(r.caseId).push(r);
}

console.log('');
let passed = 0;
for (const [caseId, checks] of byCase) {
  const okAll = checks.every((c) => c.ok);
  if (okAll) passed += 1;
  console.log(`${okAll ? '✓' : '✗'} ${caseId}`);
  for (const c of checks) {
    if (!c.ok) console.log(`    ✗ ${c.name}${c.info ? ' — ' + c.info : ''}`);
    else console.log(`    · ${c.name}`);
  }
}

const failedChecks = results.filter((r) => !r.ok);
console.log(`\nКейсов пройдено: ${passed} из ${byCase.size}`);
console.log(`Проверок пройдено: ${results.length - failedChecks.length} из ${results.length}`);
process.exitCode = failedChecks.length ? 1 : 0;
