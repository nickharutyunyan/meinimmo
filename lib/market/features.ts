/** Features a buyer filters and scans for. Parsed German terms map onto these keys. */
export const FEATURES = {
  balcony: { en: 'Balcony', de: 'Balkon', match: /balkon|balcony|loggia/i },
  terrace: { en: 'Terrace', de: 'Terrasse', match: /terrasse|terrace|dachterrasse/i },
  garden: { en: 'Garden', de: 'Garten', match: /garten|garden/i },
  lift: { en: 'Lift', de: 'Aufzug', match: /aufzug|fahrstuhl|lift|elevator/i },
  cellar: { en: 'Cellar', de: 'Keller', match: /keller|cellar|basement storage/i },
  kitchen: { en: 'Fitted kitchen', de: 'Einbauküche', match: /einbauküche|ebk|fitted kitchen/i },
  parking: { en: 'Parking', de: 'Stellplatz', match: /stellplatz|garage|tiefgarage|parking/i },
  stepFree: { en: 'Step-free', de: 'Barrierefrei', match: /barrierefrei|stufenlos|step-free|wheelchair/i },
  guestWc: { en: 'Guest WC', de: 'Gäste-WC', match: /gäste-?wc|guest (?:wc|toilet)/i },
  floorHeating: { en: 'Underfloor heating', de: 'Fußbodenheizung', match: /fußbodenheizung|underfloor/i },
  oldBuilding: { en: 'Period building', de: 'Altbau', match: /altbau|period building/i },
  newBuild: { en: 'New build', de: 'Neubau', match: /neubau|new build|erstbezug/i },
  bathtub: { en: 'Bathtub', de: 'Badewanne', match: /badewanne|wannenbad|vollbad|bathtub/i },
  furnished: { en: 'Furnished', de: 'Möbliert', match: /möbliert|furnished/i },
  vacant: { en: 'Vacant', de: 'Bezugsfrei', match: /bezugsfrei|leerstehend|vacant/i },
} as const;

export type FeatureKey = keyof typeof FEATURES;
export const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[];

export function isFeatureKey(value: string): value is FeatureKey {
  return (FEATURE_KEYS as string[]).includes(value);
}

/** Canonical keys for whatever the parser or the seller wrote, deduplicated and in a stable order. */
export function featureKeys(values: readonly string[] | undefined): FeatureKey[] {
  const found = new Set<FeatureKey>();
  for (const value of values || []) {
    if (isFeatureKey(value)) { found.add(value); continue; }
    for (const key of FEATURE_KEYS) if (FEATURES[key].match.test(value)) found.add(key);
  }
  return FEATURE_KEYS.filter(key => found.has(key));
}

export function featureLabel(key: string, locale: 'en' | 'de') {
  return isFeatureKey(key) ? FEATURES[key][locale] : key;
}
