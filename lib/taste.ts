import type { Wine } from '@/lib/catalog/types';

export type TasteAxes = {
  acidity: number;
  tannin: number;
  body: number;
  sweetness: number;
  aroma: number;
};

export const AXIS_LABELS: Array<{ key: keyof TasteAxes; label: string; left: string; right: string }> = [
  { key: 'acidity', label: 'Кислотность', left: 'мягкое', right: 'свежее' },
  { key: 'tannin', label: 'Танинность', left: 'гладкое', right: 'терпкое' },
  { key: 'body', label: 'Тело', left: 'лёгкое', right: 'плотное' },
  { key: 'sweetness', label: 'Сладость', left: 'сухое', right: 'сладкое' },
  { key: 'aroma', label: 'Аромат', left: 'сдержанный', right: 'яркий' },
];

export const DEFAULT_TASTE: TasteAxes = { acidity: 3, tannin: 3, body: 3, sweetness: 2, aroma: 3 };

const SWEET: Record<string, number> = {
  сухое: 1,
  'сухое (брют)': 1,
  брют: 1,
  полусухое: 2.6,
  полусладкое: 3.8,
  сладкое: 5,
};

const GRAPE_ACIDITY: Record<string, number> = {
  'Совиньон Блан': 5,
  Рислинг: 5,
  'Пино Блан': 4,
  Шардоне: 3.6,
  Грюнер: 4,
  Саперави: 3.6,
  'Каберне Совиньон': 3.4,
  Мерло: 2.8,
  Пинотаж: 2.6,
};

const GRAPE_TANNIN: Record<string, number> = {
  Саперави: 4.6,
  'Каберне Совиньон': 4.4,
  Пинотаж: 4.2,
  Мерло: 3.4,
  'Пти Вердо': 4,
  Шардоне: 1.4,
};

export function wineAxes(wine: Wine): TasteAxes {
  const type = wine.type ?? '';
  const red = type === 'Красное';
  const white = type === 'Белое';
  const rose = type === 'Розовое';
  const orange = type === 'Оранжевое';
  const text = `${wine.description ?? ''} ${wine.category ?? ''}`.toLowerCase();

  const grapes = wine.grapes ?? [];
  const grapeAcid = grapes.map((g) => GRAPE_ACIDITY[g] ?? 3);
  const grapeTannin = grapes.map((g) => GRAPE_TANNIN[g] ?? (red ? 3.6 : 1.2));

  const avg = (values: number[], fallback: number) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : fallback;

  const alcoholValue = Number.parseFloat((wine.alcohol ?? '').replace(',', '.').replace(/[^\d.]/g, '')) || 12.5;

  let acidity = avg(grapeAcid, white ? 4 : red ? 3 : 3.2);
  if (/кислотн|свеж|цитрус|минерал/.test(text)) acidity += 0.6;
  if (orange) acidity += 0.4;

  let tannin = avg(grapeTannin, red ? 3.8 : 1.2);
  if (/танин|терпк|вяж/.test(text)) tannin += 0.6;
  if (white || rose) tannin -= 1.2;

  let body = 2.4 + (alcoholValue - 11) * 0.5;
  if (red) body += 1.1;
  if (white) body -= 0.5;
  if (/плотн|полн|насыщ|мощн|бархат/.test(text)) body += 0.6;
  if (/лёгк|легк|питк/.test(text)) body -= 0.6;

  const sweetness = SWEET[(wine.sweetness ?? '').toLowerCase()] ?? (/полуслад/.test(text) ? 3.5 : 1.4);

  let aroma = 2.8;
  if (wine.rating) aroma += Math.min(Number(wine.rating), 5) * 0.25;
  if (/аромат|цвет|ягод|фрукт|мед|специ/.test(text)) aroma += 0.5;

  const clamp = (v: number) => Math.max(1, Math.min(5, Number(v.toFixed(2))));

  return {
    acidity: clamp(acidity),
    tannin: clamp(tannin),
    body: clamp(body),
    sweetness: clamp(sweetness),
    aroma: clamp(aroma),
  };
}

export function tasteFit(wine: Wine, profile: TasteAxes): { score: number; matched: string[] } {
  const axes = wineAxes(wine);
  const weights: Record<keyof TasteAxes, number> = {
    acidity: 1,
    tannin: 1.2,
    body: 1.2,
    sweetness: 1.5,
    aroma: 0.8,
  };

  let total = 0;
  let max = 0;
  const matched: string[] = [];

  for (const key of Object.keys(weights) as Array<keyof TasteAxes>) {
    const distance = Math.abs(axes[key] - profile[key]);
    const weight = weights[key];
    total += (1 - distance / 4) * weight;
    max += weight;
    if (distance <= 1) matched.push(key);
  }

  return { score: Math.max(0, total / max), matched };
}
