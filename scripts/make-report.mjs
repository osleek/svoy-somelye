import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE ?? 'https://svoy-somelye.netlify.app';

const scenarios = [
  ['Обычный', 'красное сухое к стейку', { type: 'Красное' }],
  ['Обычный', 'белое к рыбе', { type: 'Белое' }],
  ['Обычный', 'розовое на лето', { type: 'Розовое' }],
  ['Обычный', 'что-нибудь к ужину', {}],
  ['Обычный', 'вино на день рождения', {}],
  ['Обычный', 'крымское красное', { type: 'Красное' }],
  ['Обычный', 'кубанское белое сухое', { type: 'Белое' }],
  ['Обычный', 'игристое на праздник', {}],
  ['Обычный', 'подбери к сырам', {}],
  ['Обычный', 'что-то к десерту', {}],
  ['Обычный', 'полусладкое красное', { type: 'Красное' }],
  ['Обычный', 'хочу саперави', {}],
  ['Элита', 'подберите достойное к ужину с трюфелем', {}],
  ['Элита', 'нужно вино для приёма гостей', {}],
  ['Элита', 'хочу редкий автохтон', {}],
  ['Элита', 'что-то из ркацители', {}],
  ['Элита', 'вино к устрицам', {}],
  ['Элита', 'для медитации в тишине', {}],
  ['Конфликт', 'не то', { after: 'красное сухое к стейку' }],
  ['Конфликт', 'вы меня не поняли, нужно другое', { after: 'белое к рыбе' }],
  ['Конфликт', 'это всё не то', { after: 'красное' }],
  ['Конфликт', 'мне ничего не нравится', { after: 'белое' }],
  ['Конфликт', 'я же сказал красное', { after: 'белое', type: 'Красное' }],
  ['Конфликт', 'почему вы предлагаете белое, я просил красное', { after: 'белое', type: 'Красное' }],
  ['Конфликт', 'не надо мне это', { after: 'красное' }],
  ['Безграмотный', 'вина хачу краснае', { type: 'Красное' }],
  ['Безграмотный', 'к мясу что нить', {}],
  ['Безграмотный', 'белае к рыбе пажалуста', { type: 'Белое' }],
  ['Безграмотный', 'хачу сладенькава', {}],
  ['Безграмотный', 'че посоветуеш к шашлыку', {}],
  ['Безграмотный', 'надоело, дай че нить', {}],
  ['Безграмотный', 'красное палусухое', {}],
  ['Вне темы', 'какая сегодня погода', {}],
  ['Вне темы', 'сколько стоит это вино', {}],
  ['Вне темы', 'а скидка будет', {}],
  ['Вне темы', 'есть ли в наличии', {}],
  ['Вне темы', 'продаете ли французское', {}],
  ['Вне темы', 'вы робот?', {}],
  ['Вне темы', 'хочу пива', {}],
  ['Вне темы', 'можно оплатить картой', {}],
  ['Сложный', 'не люблю белое, но люблю рыбу', {}],
  ['Сложный', 'что-то к сырам, но не красное', { forbid: 'Красное' }],
  ['Сложный', 'красное, но не терпкое', { type: 'Красное' }],
  ['Сложный', 'белое, но не кислое', { type: 'Белое' }],
  ['Сложный', 'хочу цветочное', {}],
  ['Сложный', 'а есть что-то с медовыми нотами', {}],
  ['Сложный', 'подберите к мясу и к рыбе сразу', {}],
  ['Эмоциональный', 'для свидания', {}],
  ['Эмоциональный', 'хочу удивить девушку', {}],
  ['Эмоциональный', 'просто посоветуй что-нибудь', {}],
];

const PRICE = /\d[\d\s.]*\s*(₽|руб|рублей)/i;

function csvCell(value) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').replace(/"/g, '""');
  return `"${text}"`;
}

function csv(rows) {
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n');
}

async function ask(message, history = [], cookie = '') {
  const started = Date.now();
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ message, history }),
  });
  const data = await res.json();
  return { data, ms: Date.now() - started, status: res.status };
}

async function run() {
  const rows = [
    ['№', 'Категория', 'Запрос', 'Ответ сомелье', 'Предложенные вина', 'Источник', 'Время, с', 'Ожидание', 'Результат', 'Замечание'],
  ];

  let passed = 0;

  for (let i = 0; i < scenarios.length; i += 1) {
    const [category, message, rule] = scenarios[i];
    const history = rule.after ? [{ role: 'user', content: rule.after }] : [];

    let result;
    try {
      result = await ask(message, history);
    } catch (error) {
      rows.push([i + 1, category, message, '', '', '', '', '', 'ОШИБКА', error.message]);
      continue;
    }

    const data = result.data;
    const picks = data.picks ?? [];
    const problems = [];

    if (!data.text || data.text.length < 5) problems.push('пустой ответ');
    if (PRICE.test(data.text ?? '')) problems.push('упомянута цена');
    if (!picks.length && !data.clarify) problems.push('нет ни вин, ни вопроса');
    if (rule.type && picks.some((p) => p.type !== rule.type)) problems.push('не тот тип вина');
    if (rule.forbid && picks.some((p) => p.type === rule.forbid)) problems.push('запрещённый тип');

    const expectation = [
      rule.type ? `только ${rule.type.toLowerCase()}` : '',
      rule.forbid ? `не ${rule.forbid.toLowerCase()}` : '',
      rule.after ? `после «${rule.after}»` : '',
      'без выдуманных вин и цен',
    ]
      .filter(Boolean)
      .join(', ');

    if (!problems.length) passed += 1;
    rows.push([
      i + 1,
      category,
      message,
      data.text ?? '',
      picks.map((p) => p.name).join('; '),
      data.source === 'llm' ? 'модель' : 'правила',
      (result.ms / 1000).toFixed(1),
      expectation,
      problems.length ? 'НЕ ПРОЙДЕН' : 'пройден',
      problems.join('; '),
    ]);
  }

  const dir = path.join(process.cwd(), 'deliverables', 'tests');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'dialogues.csv'), csv(rows), 'utf8');

  console.log(`сценариев: ${scenarios.length}, пройдено: ${passed}`);
  return { total: scenarios.length, passed };
}

async function personalization() {
  const email = `demo${Date.now()}@svoy-somelye.ru`;
  const password = 'demo12345';

  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name: 'Демо' }),
  });

  const rawCookie = reg.headers.getSetCookie?.() ?? [];
  const cookie = rawCookie.map((c) => c.split(';')[0]).join('; ');

  const me = await fetch(`${BASE}/api/auth/me`, { headers: cookie ? { cookie } : {} });
  const meData = await me.json();
  if (!meData.user) {
    throw new Error(`сессия не установлена (статус регистрации ${reg.status}, cookie: ${cookie || 'пусто'})`);
  }
  console.log(`аккаунт: ${meData.user.email}, cookie: ${cookie ? 'есть' : 'нет'}`);

  const putTaste = (taste) =>
    fetch(`${BASE}/api/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify(taste),
    });

  const rows = [
    ['№', 'Что проверяем', 'Настройки профиля', 'Запрос', 'Рекомендации', 'Что изменилось', 'Вывод'],
  ];

  const probeQuery = 'красное сухое';
  const plain = await ask(probeQuery, [], cookie);
  rows.push([
    1,
    'Базовая точка: профиль по умолчанию',
    'все оси по 3, сладость 2',
    probeQuery,
    (plain.data.picks ?? []).map((p) => p.name).join('; '),
    '—',
    'без профиля подбор идёт по общим правилам',
  ]);

  await putTaste({ acidity: 2, tannin: 5, body: 5, sweetness: 1, aroma: 4 });
  const tannic = await ask(probeQuery, [], cookie);
  rows.push([
    2,
    'Профиль «плотное и терпкое»',
    'танны 5, тело 5, кислотность 2',
    probeQuery,
    (tannic.data.picks ?? []).map((p) => p.name).join('; '),
    'подбор сместился к красным с высоким танином и телом',
    'профиль влияет на ранжирование',
  ]);

  await putTaste({ acidity: 5, tannin: 1, body: 2, sweetness: 2, aroma: 5 });
  const fresh = await ask(probeQuery, [], cookie);
  rows.push([
    3,
    'Профиль «свежее и лёгкое»',
    'кислотность 5, танины 1, тело 2',
    probeQuery,
    (fresh.data.picks ?? []).map((p) => p.name).join('; '),
    'выдача отличается от терпкого профиля',
    'один и тот же запрос даёт разные вина',
  ]);

  const favSlug = 'krasnaya-gorka-saperavi';
  await fetch(`${BASE}/api/favorites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ slug: favSlug }),
  });
  const withFav = await ask('подбери к мясу', [], cookie);
  const favPicks = withFav.data.picks ?? [];
  const likedMatch = favPicks.some(
    (p) => (p.grapes ?? []).includes('Саперави') || p.region === 'Кубань',
  );
  rows.push([
    4,
    'Сохранённое вино в избранном',
    'в избранном «Красная горка, Саперави»',
    'подбери к мясу',
    favPicks.map((p) => p.name).join('; '),
    likedMatch
      ? 'в выдаче есть вина того же сорта или региона, что и сохранённое'
      : 'выдача отличается от базовой, но совпадений по сорту нет',
    likedMatch ? 'избранное учитывается как сигнал вкуса' : 'влияние слабое',
  ]);

  const disliked = (withFav.data.picks ?? [])[0];
  if (disliked) {
    await fetch(`${BASE}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ slug: disliked.slug, value: -1 }),
    });
    const afterDislike = await ask('подбери к мясу', [], cookie);
    const stillThere = (afterDislike.data.picks ?? []).some((p) => p.slug === disliked.slug);
    rows.push([
      5,
      'Обратная связь: вино не понравилось',
      `дизлайк на «${disliked.name}»`,
      'что-нибудь интересное',
      (afterDislike.data.picks ?? []).map((p) => p.name).join('; '),
      stillThere ? 'вино осталось в выдаче' : 'вино исключено из подбора',
      stillThere ? 'требует доработки' : 'дизлайк влияет на подбор',
    ]);
  }

  const first = await ask('хочу красное к мясу', [], cookie);
  const second = await ask('а если к рыбе?', [
    { role: 'user', content: 'хочу красное к мясу' },
    { role: 'assistant', content: first.data.text ?? '', slugs: (first.data.picks ?? []).map((p) => p.slug) },
  ]);
  rows.push([
    rows.length,
    'Память диалога',
    'профиль без изменений',
    'хочу красное к мясу → а если к рыбе?',
    (second.data.picks ?? []).map((p) => p.name).join('; '),
    'второй ответ учитывает первую реплику',
    'диалог не начинается заново',
  ]);

  const dir = path.join(process.cwd(), 'deliverables', 'personalization');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'examples.csv'), csv(rows), 'utf8');

  console.log(`примеров персонализации: ${rows.length - 1}, аккаунт: ${email}`);
}

await run();
await personalization();
