import { readFileSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:3001';
const catalog = JSON.parse(readFileSync('data/catalog.json', 'utf8'));
const bySlug = new Map(catalog.map((w) => [w.slug, w]));
const PRICE = /\d[\d\s.]*\s*(₽|руб|рублей)/i;

const scenarios = [
  { name: 'красное сухое к стейку', turns: ['красное сухое к стейку'], type: 'Красное' },
  { name: 'белое к рыбе', turns: ['белое к рыбе'], type: 'Белое' },
  { name: 'розовое на лето', turns: ['розовое на лето'], type: 'Розовое' },
  { name: 'что-нибудь к ужину', turns: ['что-нибудь к ужину'] },
  { name: 'вино на день рождения', turns: ['вино на день рождения'] },
  { name: 'крымское красное', turns: ['крымское красное'], type: 'Красное' },
  { name: 'кубанское белое сухое', turns: ['кубанское белое сухое'], type: 'Белое' },
  { name: 'игристое на праздник', turns: ['игристое на праздник'] },
  { name: 'к сырам', turns: ['подбери к сырам'] },
  { name: 'к десерту', turns: ['что-то к десерту'] },
  { name: 'полусладкое красное', turns: ['полусладкое красное'], type: 'Красное' },
  { name: 'саперави', turns: ['хочу саперави'] },
  { name: 'к трюфелю', turns: ['подберите достойное к ужину с трюфелем'] },
  { name: 'для приёма гостей', turns: ['нужно вино для приёма гостей'] },
  { name: 'редкий автохтон', turns: ['хочу редкий автохтон'] },
  { name: 'ркацители', turns: ['что-то из ркацители'] },
  { name: 'к устрицам', turns: ['вино к устрицам'] },
  { name: 'для медитации', turns: ['для медитации в тишине'] },
  { name: 'не то', turns: ['красное сухое к стейку', 'не то'] },
  { name: 'вы не поняли', turns: ['белое к рыбе', 'вы меня не поняли, нужно другое'] },
  { name: 'это всё не то', turns: ['красное', 'это всё не то'] },
  { name: 'ничего не нравится', turns: ['белое', 'мне ничего не нравится'] },
  { name: 'я же сказал красное', turns: ['белое', 'я же сказал красное'], type: 'Красное' },
  { name: 'почему белое, просил красное', turns: ['белое', 'почему вы предлагаете белое, я просил красное'], type: 'Красное' },
  { name: 'не надо мне это', turns: ['красное', 'не надо мне это'] },
  { name: 'неграмотно: вина хачу краснае', turns: ['вина хачу краснае'], type: 'Красное' },
  { name: 'неграмотно: к мясу что нить', turns: ['к мясу что нить'] },
  { name: 'неграмотно: белае к рыбе', turns: ['белае к рыбе пажалуста'], type: 'Белое' },
  { name: 'неграмотно: хачу сладенькава', turns: ['хачу сладенькава'] },
  { name: 'неграмотно: к шашлыку', turns: ['че посоветуеш к шашлыку'] },
  { name: 'неграмотно: дай че нить', turns: ['надоело, дай че нить'] },
  { name: 'неграмотно: красное палусухое', turns: ['красное палусухое'] },
  { name: 'погода вне темы', turns: ['какая сегодня погода'], clarify: true },
  { name: 'цена', turns: ['сколько стоит это вино'] },
  { name: 'скидка', turns: ['а скидка будет'] },
  { name: 'наличие', turns: ['есть ли в наличии'] },
  { name: 'французское', turns: ['продаете ли французское'] },
  { name: 'вы робот', turns: ['вы робот?'], minLength: 20 },
  { name: 'пиво', turns: ['хочу пива'] },
  { name: 'оплата картой', turns: ['можно оплатить картой'] },
  { name: 'не люблю белое, люблю рыбу', turns: ['не люблю белое, но люблю рыбу'] },
  { name: 'к сырам, но не красное', turns: ['что-то к сырам, но не красное'], forbidType: 'Красное' },
  { name: 'красное, но не терпкое', turns: ['красное, но не терпкое'], type: 'Красное' },
  { name: 'белое, но не кислое', turns: ['белое, но не кислое'], type: 'Белое' },
  { name: 'цветочное', turns: ['хочу цветочное'] },
  { name: 'медовые ноты', turns: ['а есть что-то с медовыми нотами'] },
  { name: 'к мясу и к рыбе сразу', turns: ['подберите к мясу и к рыбе сразу'] },
  { name: 'для свидания', turns: ['для свидания'] },
  { name: 'удивить девушку', turns: ['хочу удивить девушку'] },
  { name: 'просто посоветуй', turns: ['просто посоветуй что-нибудь'] },
];

const results = [];

for (const scenario of scenarios) {
  const problems = [];
  let history = [];
  let last = null;

  for (const turn of scenario.turns) {
    let data;
    try {
      const res = await fetch(`${BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: turn, history }),
      });
      data = await res.json();
      if (!res.ok) problems.push(`HTTP ${res.status}`);
    } catch (error) {
      problems.push(`сеть: ${error.message}`);
      break;
    }

    last = data;
    history = [
      ...history,
      { role: 'user', content: turn },
      { role: 'assistant', content: data.text ?? '', slugs: (data.picks ?? []).map((p) => p.slug) },
    ];
  }

  if (!last) {
    results.push({ name: scenario.name, ok: false, problems: ['нет ответа'] });
    continue;
  }

  if (!last.text || last.text.length < 5) problems.push('пустой ответ');
  if (PRICE.test(last.text)) problems.push('упомянута цена');

  const picks = last.picks ?? [];
  for (const pick of picks) {
    if (!bySlug.has(pick.slug)) problems.push(`выдуман slug: ${pick.slug}`);
    if (pick.price !== null && pick.price !== undefined) problems.push('пришла цена');
  }

  if (scenario.clarify && !last.clarify) problems.push('нет уточняющего вопроса');
  if (!picks.length && !last.clarify) problems.push('ни вин, ни вопроса');

  if (scenario.minLength && (last.text ?? '').length < scenario.minLength) problems.push('слишком короткий ответ');

  if (scenario.forbidType && picks.length) {
    const wrong = picks.filter((p) => p.type === scenario.forbidType);
    if (wrong.length) problems.push(`запрещённый тип: ${wrong.map((w) => w.name).join(', ')}`);
  }

  if (scenario.type && picks.length) {
    const wrong = picks.filter((p) => p.type !== scenario.type);
    if (wrong.length) problems.push(`не тот тип: ${wrong.map((w) => `${w.name} (${w.type})`).join(', ')}`);
  }

  results.push({
    name: scenario.name,
    ok: problems.length === 0,
    problems,
    reply: last.text,
    picks: picks.map((p) => p.name),
  });
}

const failed = results.filter((r) => !r.ok);
console.log(`\nСценариев: ${results.length}, прошло: ${results.length - failed.length}, провалилось: ${failed.length}\n`);

for (const r of results) {
  const mark = r.ok ? 'OK  ' : 'FAIL';
  console.log(`${mark} ${r.name}`);
  if (!r.ok) {
    console.log(`     проблемы: ${r.problems.join('; ')}`);
    console.log(`     ответ: ${String(r.reply ?? '').slice(0, 140)}`);
  }
}

process.exit(failed.length ? 1 : 0);
