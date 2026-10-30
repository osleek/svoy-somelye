export type Wine = {
  slug: string;
  url: string;
  name: string;
  manufacturer: string | null;
  region: string | null;
  category: string | null;
  type: string | null;
  sweetness: string | null;
  color: string | null;
  grapes: string[];
  alcohol: string | null;
  rating: number | null;
  description: string | null;
  dishes: string[];
  image: string | null;
  price: number | null;
};

export type Catalog = {
  wines: Wine[];
  dishes: string[];
  grapes: string[];
  regions: string[];
};

export type Constraints = {
  type: string | null;
  sweetness: string | null;
  region: string | null;
  grape: string | null;
  dishes: string[];
  occasion: string | null;
  aroma?: string[];
};

export type RankedWine = Wine & { reasons: string[]; score: number };

export type Recommendation = {
  results: RankedWine[];
  notes: string[];
  empty: boolean;
  totalCandidates: number;
};
