import { getCatalog } from '@/lib/catalog/load';
import { parseQuery } from '@/lib/catalog/query';

export type WireMessage = { role: 'user' | 'assistant'; content: string; slugs?: string[] };

export type Prefs = {
  type: string | null;
  sweetness: string | null;
  region: string | null;
  grape: string | null;
  dishes: string[];
  excludedTypes: string[];
  rejectedSlugs: string[];
  negative: boolean;
  aroma: string[];
};

const NEGATIVE = /(^|\s)(не то|не подходит|не нравится|не моё|не мое|другое|не хочу это|неудачно)(\s|[.!?,]|$)/i;
const NEG_PICK = /(?:не\s+(?:люблю|хочу|нравится|переношу)|только не|кроме|не)\s+(бел|красн|розов|оранж)[а-яё]*/i;

const TYPE_MAP: Record<string, string> = {
  бел: 'Белое',
  красн: 'Красное',
  розов: 'Розовое',
  оранж: 'Оранжевое',
};

export function readPrefs(messages: WireMessage[]): Prefs {
  const catalog = getCatalog();
  const prefs: Prefs = {
    type: null,
    sweetness: null,
    region: null,
    grape: null,
    dishes: [],
    excludedTypes: [],
    rejectedSlugs: [],
    negative: false,
    aroma: [],
  };

  let lastPicks: string[] = [];

  for (const message of messages) {
    if (message.role === 'assistant') {
      lastPicks = message.slugs ?? [];
      continue;
    }

    const raw = message.content;
    const lower = raw.toLowerCase();

    if (NEGATIVE.test(lower) && lastPicks.length) {
      prefs.rejectedSlugs.push(...lastPicks);
      prefs.negative = true;
      lastPicks = [];
      continue;
    }

    const negPick = lower.match(NEG_PICK);
    if (negPick) {
      const excluded = TYPE_MAP[negPick[1]];
      if (excluded && !prefs.excludedTypes.includes(excluded)) prefs.excludedTypes.push(excluded);
      prefs.negative = true;
    }

    const cleaned = negPick ? lower.replace(negPick[0], ' ') : lower;
    const parsed = parseQuery(cleaned, catalog);

    if (parsed.type && !negPick) {
      prefs.type = parsed.type;
      prefs.excludedTypes = prefs.excludedTypes.filter((x) => x !== parsed.type);
    }
    if (parsed.sweetness) prefs.sweetness = parsed.sweetness;
    if (parsed.region) prefs.region = parsed.region;
    if (parsed.grape) prefs.grape = parsed.grape;
    if (parsed.dishes.length) prefs.dishes = parsed.dishes;
    if (parsed.aroma?.length) prefs.aroma = parsed.aroma;
  }

  if (prefs.type) prefs.excludedTypes = prefs.excludedTypes.filter((x) => x !== prefs.type);
  if (prefs.rejectedSlugs.length > 24) prefs.rejectedSlugs = prefs.rejectedSlugs.slice(-24);

  return prefs;
}

export function describePrefs(prefs: Prefs): string[] {
  const notes: string[] = [];
  if (prefs.type) notes.push(`тип: ${prefs.type}`);
  if (prefs.sweetness) notes.push(`сладость: ${prefs.sweetness}`);
  if (prefs.region) notes.push(`регион: ${prefs.region}`);
  if (prefs.grape) notes.push(`сорт: ${prefs.grape}`);
  if (prefs.dishes.length) notes.push(`блюда: ${prefs.dishes.join(', ')}`);
  if (prefs.excludedTypes.length) notes.push(`исключено: ${prefs.excludedTypes.join(', ')}`);
  return notes;
}
