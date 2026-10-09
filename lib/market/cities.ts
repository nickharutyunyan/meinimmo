import type { MarketSlug } from './types.ts';

export type MarketCity = {
  slug: MarketSlug;
  name: { en: string; de: string };
  center: [number, number];
  zoom: number;
  /** Five-digit postcode ranges inside the city. */
  postcodes: Array<[number, number]>;
  /** Spelling variants a listing or a geocoder may use for the city field. */
  aliases: string[];
};

export const MARKET_CITIES: Record<MarketSlug, MarketCity> = {
  berlin: {
    slug: 'berlin',
    name: { en: 'Berlin', de: 'Berlin' },
    center: [52.513, 13.37],
    zoom: 12,
    postcodes: [[10115, 14199]],
    aliases: ['berlin'],
  },
  munich: {
    slug: 'munich',
    name: { en: 'Munich', de: 'München' },
    center: [48.137, 11.575],
    zoom: 12,
    postcodes: [[80331, 81929]],
    aliases: ['münchen', 'muenchen', 'munich'],
  },
  cologne: {
    slug: 'cologne',
    name: { en: 'Cologne', de: 'Köln' },
    center: [50.938, 6.958],
    zoom: 12,
    postcodes: [[50667, 51149]],
    aliases: ['köln', 'koeln', 'cologne'],
  },
};

export const MARKET_SLUGS = Object.keys(MARKET_CITIES) as MarketSlug[];

export function isMarketSlug(value: string): value is MarketSlug {
  return (MARKET_SLUGS as string[]).includes(value);
}

/** The city a listing belongs to, from its postcode first and its city name second. */
export function marketFor(place: { postalCode?: string; city?: string }): MarketSlug | null {
  const code = Number((place.postalCode || '').match(/\b\d{5}\b/)?.[0]);
  if (code) {
    for (const city of Object.values(MARKET_CITIES)) {
      if (city.postcodes.some(([low, high]) => code >= low && code <= high)) return city.slug;
    }
    return null;
  }
  const name = (place.city || '').trim().toLowerCase();
  if (!name) return null;
  for (const city of Object.values(MARKET_CITIES)) {
    if (city.aliases.some(alias => name === alias || name.startsWith(`${alias} `) || name.startsWith(`${alias}-`))) return city.slug;
  }
  return null;
}
