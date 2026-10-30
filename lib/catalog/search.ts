import { getCatalog } from './load';
import { parseQuery } from './query';
import type { TasteAxes } from '@/lib/taste';
import { tasteFit } from '@/lib/taste';
import type { Catalog, Constraints, RankedWine, Recommendation, Wine } from './types';

export type Affinity = { likedTypes: string[]; likedGrapes: string[]; dislikedSlugs: string[] };

export type PrefsLike = {
  type: string | null;
  sweetness: string | null;
  region: string | null;
  grape: string | null;
  dishes: string[];
  excludedTypes: string[];
  rejectedSlugs: string[];
  aroma?: string[];
};

function matchesHard(wine: Wine, c: Constraints, prefs?: PrefsLike, affinity?: Affinity): boolean {
  if (affinity?.dislikedSlugs.includes(wine.slug)) return false;
  if (prefs) {
    if (prefs.excludedTypes.includes(wine.type ?? '')) return false;
    if (prefs.rejectedSlugs.includes(wine.slug)) return false;
  }
  if (c.type && wine.type !== c.type) return false;
  if (c.sweetness && wine.sweetness !== c.sweetness) return false;
  if (c.region && wine.region !== c.region) return false;
  if (c.grape && !wine.grapes.includes(c.grape)) return false;
  if (c.dishes.length && !c.dishes.some((d) => wine.dishes.includes(d))) return false;
  return true;
}

const AROMA_HINTS: Record<string, RegExp> = {
  цветочные: /цвет|флор|лилия|фиалк|жасмин|роза|акаци/i,
  фруктовые: /фрукт|персик|абрикос|яблок|груш|цитрус|ананас|манго/i,
  ягодные: /ягод|вишн|смородин|малин|ежевик|земляник|клубник/i,
  пряные: /прян|специ|перец|корица|гвоздик|имбир/i,
  минеральные: /минерал|кремень|мел|солоноват|сланец/i,
  дубовые: /дуб|древес|ванил|кокос|поджар/i,
  сливочные: /сливоч|масл|бриош|дрожж|крем/i,
  медовые: /мед|пчелин|воск/i,
  травянистые: /трав|зелен|свежескошен|лист/i,
};

function scoreWine(wine: Wine, c: Constraints, taste?: TasteAxes, affinity?: Affinity): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const dishHits = c.dishes.filter((d) => wine.dishes.includes(d));
  if (dishHits.length) {
    score += 5 * dishHits.length;
    reasons.push(`в карточке указано сочетание: ${dishHits.join(', ')}`);
  }

  if (c.type && wine.type === c.type) score += 3;
  if (c.sweetness && wine.sweetness === c.sweetness) score += 3;
  if (c.region && wine.region === c.region) {
    score += 3;
    reasons.push(`регион ${wine.region}`);
  }
  if (c.grape && wine.grapes.includes(c.grape)) {
    score += 4;
    reasons.push(`сорт ${c.grape}`);
  }

  const aromas = c.aroma ?? [];
  if (aromas.length) {
    const text = `${wine.description ?? ''} ${(wine.grapes ?? []).join(' ')}`.toLowerCase();
    const hits = aromas.filter((a) => (AROMA_HINTS[a] ?? /$^/).test(text));
    if (hits.length) {
      score += 2.6 * hits.length;
      reasons.push(`в описании есть ${hits.join(', ')} ноты`);
    }
  }

  if (typeof wine.rating === 'number') score += Math.min(wine.rating, 5) * 0.4;

  if (taste) {
    const fit = tasteFit(wine, taste);
    score += fit.score * 6;
    if (fit.score > 0.75) reasons.push('совпадает с вашим вкусовым профилем');
  }

  if (affinity) {
    if (wine.type && affinity.likedTypes.includes(wine.type)) score += 2.4;
    if (wine.grapes.some((g) => affinity.likedGrapes.includes(g))) score += 3.2;
  }

  if (!reasons.length) {
    const bits = [wine.type, wine.sweetness, wine.region].filter(Boolean);
    reasons.push(bits.length ? `карточка каталога: ${bits.join(', ').toLowerCase()}` : 'позиция из каталога');
  }

  return { score, reasons };
}

function toConstraints(prefs: PrefsLike): Constraints {
  return {
    type: prefs.type,
    sweetness: prefs.sweetness,
    region: prefs.region,
    grape: prefs.grape,
    dishes: prefs.dishes,
    occasion: null,
    aroma: prefs.aroma ?? [],
  };
}

function diversify(list: RankedWine[], limit: number): RankedWine[] {
  const out: RankedWine[] = [];
  const usedRegions = new Set<string>();

  for (const wine of list) {
    if (out.length >= limit) break;
    const region = wine.region ?? '';
    if (!region || !usedRegions.has(region)) {
      out.push(wine);
      if (region) usedRegions.add(region);
    }
  }

  for (const wine of list) {
    if (out.length >= limit) break;
    if (!out.includes(wine)) out.push(wine);
  }

  return out.slice(0, limit);
}

export function recommend(
  text: string,
  options: {
    limit?: number;
    catalog?: Catalog;
    prefs?: PrefsLike;
    taste?: TasteAxes;
    affinity?: Affinity;
  } = {},
): Recommendation {
  const catalog = options.catalog ?? getCatalog();
  const limit = options.limit ?? 5;
  const prefs = options.prefs;

  const constraints = prefs ? toConstraints(prefs) : parseQuery(text, catalog);
  const candidates = catalog.wines.filter((w) =>
    matchesHard(w, constraints, prefs, options.affinity),
  );

  const scored: RankedWine[] = candidates
    .map((wine) => {
      const { score, reasons } = scoreWine(wine, constraints, options.taste, options.affinity);
      return { ...wine, score, reasons };
    })
    .sort((a, b) => b.score - a.score || (b.rating ?? 0) - (a.rating ?? 0));

  const ranked = diversify(scored, limit);

  const notes: string[] = [];
  if (constraints.type) notes.push(`тип: ${constraints.type}`);
  if (constraints.sweetness) notes.push(`сладость: ${constraints.sweetness}`);
  if (constraints.region) notes.push(`регион: ${constraints.region}`);
  if (constraints.grape) notes.push(`сорт: ${constraints.grape}`);
  if (constraints.dishes.length) notes.push(`блюда: ${constraints.dishes.join(', ')}`);

  return {
    results: ranked,
    notes,
    empty: ranked.length === 0,
    totalCandidates: candidates.length,
  };
}
