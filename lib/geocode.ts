export type GermanPlace = {
  lat: number;
  lon: number;
  label: string;
  neighborhood?: string;
};

type NominatimPlace = {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string | undefined>;
};

function cleanArea(value?: string) {
  return (value || '').replace(/^kreisfreie\s+stadt\s+/i, '').replace(/\s+/g, ' ').trim();
}

export function neighborhoodFromAddress(address: Record<string, string | undefined> | undefined, city = '') {
  if (!address) return '';
  const normalizedCity = cleanArea(city).toLocaleLowerCase('de-DE');
  const candidates = [address.neighbourhood, address.suburb, address.quarter, address.city_district, address.borough];
  return candidates
    .map(cleanArea)
    .find(candidate => candidate && !/^\d{5}$/.test(candidate) && candidate.toLocaleLowerCase('de-DE') !== normalizedCity) || '';
}

export async function geocodeGermanLocation(query: string, city = ''): Promise<GermanPlace | undefined> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'de');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('q', query);
  const response = await fetch(url, {
    headers: { 'User-Agent': 'ReviewAHousePropertyAssessment/1.0' },
    next: { revalidate: 60 * 60 * 24 * 30 },
  });
  if (!response.ok) throw new Error('Geocoding service unavailable');
  const [place] = await response.json() as NominatimPlace[];
  if (!place) return undefined;
  const neighborhood = neighborhoodFromAddress(place.address, city);
  return {
    lat: Number(place.lat),
    lon: Number(place.lon),
    label: place.display_name,
    neighborhood: neighborhood || undefined,
  };
}

export async function neighborhoodForPostalCode(postalCode?: string, city?: string) {
  const postal = postalCode?.match(/\b\d{5}\b/)?.[0];
  const cleanCity = cleanArea(city);
  if (!postal || !cleanCity) return '';
  try {
    return (await geocodeGermanLocation(`${postal} ${cleanCity}`, cleanCity))?.neighborhood || '';
  } catch {
    return '';
  }
}
