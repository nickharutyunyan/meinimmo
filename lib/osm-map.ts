/** Licence line required next to every OpenStreetMap embed. Same wording in English and German. */
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors';
export const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright';

export function hasStoredGeocode(geocode?: { lat: number; lon: number } | null): geocode is { lat: number; lon: number } {
  return Boolean(geocode && Number.isFinite(geocode.lat) && Number.isFinite(geocode.lon));
}
