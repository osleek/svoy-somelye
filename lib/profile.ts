import type { Affinity } from '@/lib/catalog/search';
import { getCatalog } from '@/lib/catalog/load';
import { store } from '@/lib/store';
import type { TasteAxes } from '@/lib/taste';

export type Profile = {
  favoriteTypes: string[];
  favoriteRegions: string[];
  favoriteGrapes: string[];
  recentQueries: string[];
  dislikedSlugs: string[];
  taste: TasteAxes | null;
  affinity: Affinity;
};

export async function buildProfile(userId: string): Promise<Profile> {
  const catalog = getCatalog();
  const bySlug = new Map(catalog.wines.map((w) => [w.slug, w]));

  const [favorites, history, feedback, taste] = await Promise.all([
    store.listFavorites(userId),
    store.listHistory(userId),
    store.listFeedback(userId),
    store.getTasteProfile(userId),
  ]);

  const tally = (values: Array<string | null | undefined>) => {
    const counts = new Map<string, number>();
    for (const value of values) {
      if (!value) continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([value]) => value);
  };

  const favWines = favorites.map((f) => bySlug.get(f.slug)).filter(Boolean);
  const historyWines = history.map((h) => bySlug.get(h.slug)).filter(Boolean);

  const liked = feedback.filter((f) => f.value > 0).map((f) => bySlug.get(f.slug)).filter(Boolean);
  const disliked = feedback.filter((f) => f.value < 0).map((f) => bySlug.get(f.slug)).filter(Boolean);

  return {
    favoriteTypes: tally([...favWines, ...historyWines].map((w) => w?.type)).slice(0, 2),
    favoriteRegions: tally([...favWines, ...historyWines].map((w) => w?.region)).slice(0, 2),
    favoriteGrapes: tally(favWines.flatMap((w) => w?.grapes ?? [])).slice(0, 3),
    recentQueries: history.slice(0, 5).map((h) => h.query).filter(Boolean),
    dislikedSlugs: [...new Set([...disliked.map((w) => w!.slug), ...feedback.filter((f) => f.value < 0).map((f) => f.slug)])].slice(0, 20),
    taste,
    affinity: {
      likedTypes: tally(liked.map((w) => w?.type)).slice(0, 2),
      likedGrapes: tally(liked.flatMap((w) => w?.grapes ?? [])).slice(0, 3),
      dislikedSlugs: [...new Set(disliked.map((w) => w!.slug))].slice(0, 20),
    },
  };
}

export function profileSummary(profile: Profile): string[] {
  const parts: string[] = [];
  if (profile.favoriteTypes.length) parts.push(`чаще выбирает ${profile.favoriteTypes.join(', ').toLowerCase()}`);
  if (profile.favoriteRegions.length) parts.push(`регионы: ${profile.favoriteRegions.join(', ')}`);
  if (profile.favoriteGrapes.length) parts.push(`сорта: ${profile.favoriteGrapes.join(', ')}`);
  if (profile.taste) parts.push('есть вкусовой профиль');
  return parts;
}
