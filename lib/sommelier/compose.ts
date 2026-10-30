import { getCatalog } from '@/lib/catalog/load';
import { recommend } from '@/lib/catalog/search';
import type { RankedWine, Recommendation } from '@/lib/catalog/types';
import type { Profile } from '@/lib/profile';
import { describePrefs, readPrefs, type Prefs, type WireMessage } from './dialog';
import { composeAnswer, extractPrefs } from './llm';

export type Clarify = { question: string; options: string[] };

export type ChatReply = {
  text: string;
  picks: RankedWine[];
  notes: string[];
  clarify: Clarify | null;
  source: 'llm' | 'rule';
  done: boolean;
};

function questionFor(step: number, dishes: string[], types: string[]): Clarify {
  const questions: Clarify[] = [
    { question: 'К какому блюду подбираем?', options: dishes },
    { question: 'Какой цвет вина предпочитаете?', options: types },
    {
      question: 'Насколько сладкое должно быть?',
      options: ['сухое', 'полусухое', 'полусладкое', 'сладкое'],
    },
    { question: 'Есть предпочтения по региону?', options: ['Кубань', 'Крым', 'Долина Дона', 'Дагестан'] },
  ];
  const picked = questions[step % questions.length];
  return { question: picked.question, options: picked.options.filter(Boolean).slice(0, 4) };
}

function relax(
  prefs: Prefs,
  limit: number,
  taste?: import('@/lib/taste').TasteAxes,
  affinity?: import('@/lib/catalog/search').Affinity,
): { label: string; prefs: Prefs; result: Recommendation } | null {
  const steps: Array<{ label: string; apply: (p: Prefs) => Prefs }> = [
    { label: 'блюдо', apply: (p) => ({ ...p, dishes: [] }) },
    { label: 'регион', apply: (p) => ({ ...p, region: null }) },
    { label: 'сорт', apply: (p) => ({ ...p, grape: null }) },
    { label: 'сладость', apply: (p) => ({ ...p, sweetness: null }) },
    { label: 'цвет', apply: (p) => ({ ...p, type: null }) },
  ];

  let current = prefs;
  for (const step of steps) {
    current = step.apply(current);
    const result = recommend('', { limit, prefs: current, taste, affinity });
    if (!result.empty) return { label: step.label, prefs: current, result };
  }
  return null;
}

function mergePrefs(rule: Prefs, llm: Awaited<ReturnType<typeof extractPrefs>>): Prefs {
  if (!llm) return rule;
  const merged: Prefs = {
    type: rule.type ?? llm.type,
    sweetness: rule.sweetness ?? llm.sweetness,
    region: rule.region ?? llm.region,
    grape: rule.grape ?? llm.grape,
    dishes: rule.dishes.length ? rule.dishes : llm.dishes,
    excludedTypes: [...new Set([...rule.excludedTypes, ...llm.excludedTypes])],
    rejectedSlugs: rule.rejectedSlugs,
    negative: rule.negative || llm.negative,
    aroma: rule.aroma.length ? rule.aroma : [],
  };
  if (merged.type) merged.excludedTypes = merged.excludedTypes.filter((x) => x !== merged.type);

  const catalog = getCatalog();
  const normalizeDish = (value: string) => {
    const needle = value.toLowerCase().trim();
    if (!needle) return null;
    const exact = catalog.dishes.find((dish) => dish.toLowerCase() === needle);
    if (exact) return exact;
    const partial = catalog.dishes.find((dish) => {
      const label = dish.toLowerCase();
      return label.includes(needle) || needle.includes(label);
    });
    return partial ?? null;
  };

  merged.dishes = [...new Set(merged.dishes.map(normalizeDish).filter((d): d is string => Boolean(d)))];
  return merged;
}

function ruleReply(prefs: Prefs): ChatReply {
  const catalog = getCatalog();
  const dishes = ['Мясо и стейки', 'Рыба и морепродукты', 'Сыры', 'Десерты'].filter((d) =>
    catalog.dishes.includes(d),
  );
  const types = ['Красное', 'Белое', 'Розовое'];
  const notes = describePrefs(prefs);

  const res = recommend('', { limit: 3, prefs });

  if (res.empty) {
    const relaxed = relax(prefs, 3);
    if (relaxed) {
      return {
        text: `Под точный запрос ничего не подошло, поэтому смотрю шире. Вот что ближе всего по вкусу.`,
        picks: relaxed.result.results,
        notes,
        clarify: null,
        source: 'rule',
        done: false,
      };
    }
    return {
      text: 'В каталоге нет ничего под такие условия. Расскажите, что важнее — цвет, блюдо или повод?',
      picks: [],
      notes,
      clarify: questionFor(0, dishes, types),
      source: 'rule',
      done: false,
    };
  }

  const vague =
    !prefs.type && !prefs.sweetness && !prefs.region && !prefs.grape && prefs.dishes.length === 0;

  if (vague || prefs.negative) {
    return {
      text: prefs.negative
        ? 'Понял, это уберу. Уточню, чтобы попасть точнее.'
        : 'Чтобы не гадать, задам короткий вопрос.',
      picks: [],
      notes,
      clarify: questionFor(0, dishes, types),
      source: 'rule',
      done: false,
    };
  }

  const top = res.results[0];
  const intro =
    res.totalCandidates === 1
      ? `Нашёл ровно одно вино — «${top.name}».`
      : `Под ваш запрос подходит ${res.totalCandidates} вин. Ближе всего — «${top.name}».`;

  return {
    text: intro,
    picks: res.results,
    notes,
    clarify: null,
    source: 'rule',
    done: false,
  };
}

export async function composeReply(history: WireMessage[], profile?: Profile): Promise<ChatReply> {
  const rulePrefs = readPrefs(history);
  const llmPrefs = await extractPrefs(history);
  const prefs = mergePrefs(rulePrefs, llmPrefs);

  let res = recommend('', {
    limit: 6,
    prefs,
    taste: profile?.taste ?? undefined,
    affinity: profile?.affinity,
  });
  let relaxedLabel: string | null = null;

  if (res.empty) {
    const relaxed = relax(prefs, 6, profile?.taste ?? undefined, profile?.affinity);
    if (relaxed) {
      res = relaxed.result;
      relaxedLabel = relaxed.label;
    }
  }

  const answer = await composeAnswer(
    history,
    res.results,
    {
      type: prefs.type,
      sweetness: prefs.sweetness,
      region: prefs.region,
      grape: prefs.grape,
      dishes: prefs.dishes,
      excludedTypes: prefs.excludedTypes,
    },
    relaxedLabel,
    profile,
  );

  if (!answer) return ruleReply(prefs);

  const bySlug = new Map(res.results.map((w) => [w.slug, w]));
  const picks = answer.slugs.map((slug) => bySlug.get(slug)).filter((w): w is RankedWine => Boolean(w));

  const catalog = getCatalog();
  const dishes = ['Мясо и стейки', 'Рыба и морепродукты', 'Сыры', 'Десерты'].filter((d) =>
    catalog.dishes.includes(d),
  );
  const types = ['Красное', 'Белое', 'Розовое'];

  const safeText =
    answer.text.trim().startsWith('{') || answer.text.trim().startsWith('[')
      ? ruleReply(prefs).text
      : answer.text;

  return {
    text: safeText,
    picks,
    notes: describePrefs(prefs),
    clarify: answer.clarify ?? (picks.length === 0 ? questionFor(0, dishes, types) : null),
    source: 'llm',
    done: false,
  };
}
