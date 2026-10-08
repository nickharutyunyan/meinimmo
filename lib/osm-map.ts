/** Licence line required next to every OpenStreetMap embed. Same wording in English and German. */
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors';
export const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright';

export function hasStoredGeocode(geocode?: { lat: number; lon: number } | null): geocode is { lat: number; lon: number } {
  return Boolean(geocode && Number.isFinite(geocode.lat) && Number.isFinite(geocode.lon));
}

export function osmExploreHref(place: { lat: number; lon: number } | null | undefined, query: string) {
  if (hasStoredGeocode(place)) {
    return `https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lon}#map=16/${place.lat}/${place.lon}`;
  }
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
}

export function placeFromGeocodeResponse(status: number, body: unknown): { lat: number; lon: number; label: string } | null {
  if (status < 200 || status >= 300 || !body || typeof body !== 'object') return null;
  const record = body as { lat?: unknown; lon?: unknown; label?: unknown };
  if (typeof record.lat !== 'number' || typeof record.lon !== 'number') return null;
  if (!Number.isFinite(record.lat) || !Number.isFinite(record.lon)) return null;
  return { lat: record.lat, lon: record.lon, label: typeof record.label === 'string' ? record.label : '' };
}
