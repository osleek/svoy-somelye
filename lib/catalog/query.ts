import type { Catalog, Constraints } from './types';

const DISH_SYNONYMS: Array<[RegExp, string]> = [
  [/стейк|мяс|говядин|баран|свинин|шашлык|грил|ребр|окорок/i, 'Мясо и стейки'],
  [/птиц|кур|утк|индейк|цыплен/i, 'Блюда из птицы'],
  [/сыр|чиз/i, 'Сыры'],
  [/рыб|лосос|тунец|морепродукт|креветк|устриц|мидии/i, 'Рыба и морепродукты'],
  [/салат|овощ|зелен/i, 'Салаты'],
  [/закуск|брускет|тапас|антипаст/i, 'Закуски'],
  [/барбекю|bbq|гриль|мангал/i, 'BBQ'],
  [/десерт|сладк|торт|шоколад|фрукт|выпечк/i, 'Десерты'],
  [/паст|ризотт|пицц/i, 'Паста и пицца'],
  [/кавказск|хинкал/i, 'Кавказская кухня'],
  [/мясное ассорти|нарезк|колбас/i, 'Мясное ассорти'],
  [/суп|бульон/i, 'Супы'],
];

const TYPE_WORDS: Array<[RegExp, string]> = [
  [/красн/i, 'Красное'],

  [/бел(ое|ый|ого|ым|ом|ая|ую|ых|ые)?/i, 'Белое'],
  [/розов/i, 'Розовое'],
  [/оранжев/i, 'Оранжевое'],
];

const SWEETNESS_WORDS: Array<[RegExp, string]> = [
  [/полусладк/i, 'полусладкое'],
  [/полусух/i, 'полусухое'],
  [/брют/i, 'брют'],
  [/сладк/i, 'сладкое'],
  [/сух/i, 'сухое'],
];

const AROMA_WORDS: Array<[RegExp, string]> = [
  [/цветоч|цветов|флор/i, 'цветочные'],
  [/фруктов|персик|абрикос|яблок|груш/i, 'фруктовые'],
  [/ягод|вишн|смородин|малин|ежевик/i, 'ягодные'],
  [/прян|специ|перец|кориц|гвоздик/i, 'пряные'],
  [/минерал|кремень|мел|солоноват/i, 'минеральные'],
  [/дубов|древес|ванил|кокос/i, 'дубовые'],
  [/сливочн|масл|бриош|дрожж/i, 'сливочные'],
  [/медов|мед(?!ицин)/i, 'медовые'],
  [/травян|зелен|трав(а|ы)|свежескошен/i, 'травянистые'],
];

const FLAVOR_LIKE_GRAPES = new Set(['Цветочный']);

const REGION_WORDS: Array<[RegExp, string]> = [
  [/крым/i, 'Крым'],
  [/кубан|краснодар/i, 'Кубань'],
  [/осети|алани/i, 'Северная Осетия — Алания'],
  [/дагестан/i, 'Дагестан'],
  [/дон(у|а|е)?\b|ростов/i, 'Долина Дона'],
  [/самар/i, 'Самара'],
  [/нижн(яя|ей) волг/i, 'Нижняя Волга'],
];

export function parseQuery(text: string, catalog: Catalog): Constraints {
  const q = String(text ?? '').toLowerCase();
  const constraints: Constraints = {
    type: null,
    sweetness: null,
    region: null,
    grape: null,
    dishes: [],
    occasion: null,
  };

  for (const [re, value] of TYPE_WORDS) if (re.test(q)) { constraints.type = value; break; }
  for (const [re, value] of SWEETNESS_WORDS) if (re.test(q)) { constraints.sweetness = value; break; }
  for (const [re, value] of REGION_WORDS) if (re.test(q)) { constraints.region = value; break; }

  for (const grape of catalog.grapes) {
    if (FLAVOR_LIKE_GRAPES.has(grape)) continue;
    const stem = grape.toLowerCase().slice(0, Math.max(4, grape.length - 2));
    if (stem.length >= 4 && q.includes(stem)) { constraints.grape = grape; break; }
  }

  const aromas: string[] = [];
  for (const [re, value] of AROMA_WORDS) {
    if (re.test(q) && !aromas.includes(value)) aromas.push(value);
  }
  if (aromas.length) constraints.aroma = aromas;

  for (const [re, dish] of DISH_SYNONYMS) {
    if (re.test(q) && catalog.dishes.includes(dish) && !constraints.dishes.includes(dish)) {
      constraints.dishes.push(dish);
    }
  }

  if (/цветочн/i.test(q) && !constraints.grape) {
    const explicit = /сорт|виноград/i.test(q);
    if (!explicit) constraints.grape = null;
  }

  if (/подар|презент|день рожден|юбилей/i.test(q)) constraints.occasion = 'gift';
  if (/ужин|романтич|свидан/i.test(q)) constraints.occasion = 'dinner';

  return constraints;
}
