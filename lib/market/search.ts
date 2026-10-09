import type { ListingSummary } from './types.ts';

export type SearchSort = 'newest' | 'price-asc' | 'price-desc' | 'sqm-asc' | 'score';
export type SearchState = {
  type: 'all' | 'flat' | 'house' | 'land';
  maxPrice: number;
  minArea: number;
  minRooms: number;
  district: string;
  sort: SearchSort;
  bounds: { south: number; west: number; north: number; east: number } | null;
};

export const DEFAULT_SEARCH: SearchState = { type: 'all', maxPrice: 0, minArea: 0, minRooms: 0, district: '', sort: 'newest', bounds: null };

const SORTS: SearchSort[] = ['newest', 'price-asc', 'price-desc', 'sqm-asc', 'score'];

function positive(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function searchFromParams(params: URLSearchParams): SearchState {
  const type = params.get('type');
  const sort = params.get('sort') as SearchSort | null;
  const box = (params.get('area') || '').split(',').map(Number);
  return {
    type: type === 'flat' || type === 'house' || type === 'land' ? type : 'all',
    maxPrice: positive(params.get('max')),
    minArea: positive(params.get('size')),
    minRooms: positive(params.get('rooms')),
    district: (params.get('district') || '').slice(0, 60),
    sort: sort && SORTS.includes(sort) ? sort : 'newest',
    bounds: box.length === 4 && box.every(Number.isFinite) && box[0] < box[2] && box[1] < box[3]
      ? { south: box[0], west: box[1], north: box[2], east: box[3] }
      : null,
  };
}

export function searchToParams(search: SearchState) {
  const params = new URLSearchParams();
  if (search.type !== 'all') params.set('type', search.type);
  if (search.maxPrice) params.set('max', String(search.maxPrice));
  if (search.minArea) params.set('size', String(search.minArea));
  if (search.minRooms) params.set('rooms', String(search.minRooms));
  if (search.district) params.set('district', search.district);
  if (search.sort !== 'newest') params.set('sort', search.sort);
  if (search.bounds) params.set('area', [search.bounds.south, search.bounds.west, search.bounds.north, search.bounds.east].map(value => value.toFixed(4)).join(','));
  return params;
}

function size(listing: ListingSummary) {
  return listing.propertyType === 'land' ? listing.plotArea || 0 : listing.area;
}

function perSqm(listing: ListingSummary) {
  const area = size(listing);
  return area > 0 ? listing.price / area : Number.POSITIVE_INFINITY;
}

/** Filters and sorts one city's listings. Missing values never pass a filter that asks for them. */
export function applySearch(listings: readonly ListingSummary[], search: SearchState): ListingSummary[] {
  const kept = listings.filter(listing => {
    if (search.type !== 'all' && listing.propertyType !== search.type) return false;
    if (search.maxPrice && !(listing.price > 0 && listing.price <= search.maxPrice)) return false;
    if (search.minArea && size(listing) < search.minArea) return false;
    if (search.minRooms && !(listing.rooms && listing.rooms >= search.minRooms)) return false;
    if (search.district && listing.district !== search.district) return false;
    if (search.bounds) {
      if (listing.lat === null || listing.lon === null) return false;
      const { south, west, north, east } = search.bounds;
      if (listing.lat < south || listing.lat > north || listing.lon < west || listing.lon > east) return false;
    }
    return true;
  });
  const byNewest = (a: ListingSummary, b: ListingSummary) => b.publishedAt.localeCompare(a.publishedAt);
  const compare: Record<SearchSort, (a: ListingSummary, b: ListingSummary) => number> = {
    'newest': byNewest,
    'price-asc': (a, b) => a.price - b.price || byNewest(a, b),
    'price-desc': (a, b) => b.price - a.price || byNewest(a, b),
    'sqm-asc': (a, b) => perSqm(a) - perSqm(b) || byNewest(a, b),
    // Listings without a score go last, not first.
    'score': (a, b) => (b.score ?? -1) - (a.score ?? -1) || byNewest(a, b),
  };
  return kept.sort(compare[search.sort]);
}
