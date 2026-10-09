'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { localePath, type Locale } from '@/lib/i18n';
import type { ListingSummary, ListingType } from '@/lib/market/types';
import { marketCopy } from '@/lib/market/copy';
import { priceShort } from '@/lib/market/format';
import { applySearch, DEFAULT_SEARCH, searchFromParams, searchToParams, type SearchState } from '@/lib/market/search';
import { ListingCard } from './ListingCard';
import type { MapBounds } from './MarketMap';

const MarketMap = dynamic(() => import('./MarketMap').then(module => module.MarketMap), {
  ssr: false,
  loading: () => <div className="market-map is-loading" />,
});

const PRICE_STEPS = [250_000, 350_000, 500_000, 750_000, 1_000_000, 1_500_000, 2_500_000];
const SIZE_STEPS = [30, 50, 70, 90, 120, 160];
const ROOM_STEPS = [1, 2, 3, 4, 5];

export function CitySearch({ listings, locale, cityName, center, zoom }: {
  listings: ListingSummary[];
  locale: Locale;
  cityName: string;
  center: [number, number];
  zoom: number;
}) {
  const text = marketCopy[locale];
  const [search, setSearch] = useState<SearchState>(DEFAULT_SEARCH);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [movedBounds, setMovedBounds] = useState<MapBounds | null>(null);
  const [compare, setCompare] = useState<ListingSummary[]>([]);
  const [compareState, setCompareState] = useState<'idle' | 'working' | 'failed'>('idle');
  const results = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);

  // Filters live in the URL, so a search can be shared or bookmarked as it is.
  useEffect(() => {
    setSearch(searchFromParams(new URLSearchParams(window.location.search)));
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    const query = searchToParams(search).toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ''}`;
    if (url !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, '', url);
  }, [search]);

  const districts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const listing of listings) if (listing.district) counts.set(listing.district, (counts.get(listing.district) || 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], locale)).map(([name]) => name);
  }, [listings, locale]);
  const types = useMemo(() => new Set(listings.map(listing => listing.propertyType)), [listings]);
  const shown = useMemo(() => applySearch(listings, search), [listings, search]);
  const mapped = useMemo(() => shown.filter(listing => listing.lat !== null), [shown]);
  const picked = pickedId ? shown.find(listing => listing.id === pickedId) || null : null;
  const activeId = hoverId || pickedId;
  const filtered = JSON.stringify({ ...search, sort: DEFAULT_SEARCH.sort }) !== JSON.stringify({ ...DEFAULT_SEARCH });

  const update = (patch: Partial<SearchState>) => setSearch(previous => ({ ...previous, ...patch }));
  const selectFromMap = (id: string) => {
    setPickedId(id);
    if (view === 'map') return;
    results.current?.querySelector(`[data-listing="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  const toggleCompare = (listing: ListingSummary) => {
    setCompareState('idle');
    setCompare(previous => previous.some(item => item.id === listing.id)
      ? previous.filter(item => item.id !== listing.id)
      : [...previous, listing].slice(-2));
  };
  async function openComparison() {
    const ids = compare.map(item => item.reportId).filter(Boolean);
    if (ids.length !== 2) return;
    setCompareState('working');
    try {
      const response = await fetch('/api/comparisons', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reportIds: ids }) });
      const body = await response.json() as { id?: string };
      if (!response.ok || !body.id) throw new Error('comparison');
      window.location.href = localePath(locale, `/c/${body.id}`);
    } catch {
      setCompareState('failed');
    }
  }

  const typeOptions: Array<[SearchState['type'], string]> = [['all', text.search.all], ['flat', text.search.flat], ['house', text.search.house], ['land', text.search.land]];

  return <div className="market-search" data-view={view}>
    <header className="market-search-head">
      <div className="market-search-titles">
        <h1>{text.search.title(cityName)}</h1>
        <p aria-live="polite">{text.search.results(shown.length)}{filtered ? <> · <button type="button" className="market-link-button" onClick={() => { setSearch({ ...DEFAULT_SEARCH, sort: search.sort }); setMovedBounds(null); }}>{text.search.reset}</button></> : null}</p>
      </div>
      <div className="market-filters" role="group" aria-label={text.search.sort}>
        <div className="market-segment" role="radiogroup" aria-label={text.listing.price}>
          {typeOptions.filter(([value]) => value === 'all' || types.has(value as ListingType)).map(([value, label]) => <button
            key={value}
            type="button"
            role="radio"
            aria-checked={search.type === value}
            className={search.type === value ? 'is-on' : ''}
            onClick={() => update({ type: value })}
          >{label}</button>)}
        </div>
        <label className="market-select">
          <span>{text.search.maxPrice}</span>
          <select value={search.maxPrice || ''} onChange={event => update({ maxPrice: Number(event.target.value) || 0 })}>
            <option value="">{text.search.any}</option>
            {PRICE_STEPS.map(value => <option key={value} value={value}>{priceShort(value, locale)}</option>)}
          </select>
        </label>
        <label className="market-select">
          <span>{text.search.minSize}</span>
          <select value={search.minArea || ''} onChange={event => update({ minArea: Number(event.target.value) || 0 })}>
            <option value="">{text.search.any}</option>
            {SIZE_STEPS.map(value => <option key={value} value={value}>{value} m²</option>)}
          </select>
        </label>
        <label className="market-select">
          <span>{text.search.rooms}</span>
          <select value={search.minRooms || ''} onChange={event => update({ minRooms: Number(event.target.value) || 0 })}>
            <option value="">{text.search.any}</option>
            {ROOM_STEPS.map(value => <option key={value} value={value}>{value}+</option>)}
          </select>
        </label>
        {districts.length > 1 ? <label className="market-select">
          <span>{text.search.district}</span>
          <select value={search.district} onChange={event => update({ district: event.target.value })}>
            <option value="">{text.search.allAreas}</option>
            {districts.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </label> : null}
        <label className="market-select is-sort">
          <span>{text.search.sort}</span>
          <select value={search.sort} onChange={event => update({ sort: event.target.value as SearchState['sort'] })}>
            <option value="newest">{text.search.sortNewest}</option>
            <option value="price-asc">{text.search.sortPriceLow}</option>
            <option value="price-desc">{text.search.sortPriceHigh}</option>
            <option value="sqm-asc">{text.search.sortPerSqm}</option>
            <option value="score">{text.search.sortScore}</option>
          </select>
        </label>
      </div>
    </header>

    <div className="market-search-body">
      <section className="market-results" ref={results} aria-label={text.search.results(shown.length)}>
        {search.bounds ? <p className="market-area-note">{text.search.areaActive}<button type="button" className="market-chip" onClick={() => { update({ bounds: null }); setMovedBounds(null); }}>{text.search.showAll} ×</button></p> : null}
        {shown.length ? <div className="market-grid">
          {shown.map((listing, position) => <ListingCard
            key={listing.id}
            listing={listing}
            locale={locale}
            priority={position < 4}
            active={activeId === listing.id}
            selected={compare.some(item => item.id === listing.id)}
            onHover={setHoverId}
            onToggleCompare={listing.reportId ? toggleCompare : undefined}
          />)}
        </div> : <div className="market-empty">
          <p>{listings.length ? text.search.empty : text.search.emptyCity}</p>
          {listings.length ? <button type="button" className="market-button is-quiet" onClick={() => { setSearch(DEFAULT_SEARCH); setMovedBounds(null); }}>{text.search.reset}</button> : null}
        </div>}
      </section>

      <aside className="market-map-pane" aria-label={text.search.map}>
        <MarketMap
          listings={mapped}
          locale={locale}
          center={center}
          zoom={zoom}
          activeId={activeId}
          onHover={setHoverId}
          onSelect={selectFromMap}
          onMoved={setMovedBounds}
          fit={!search.bounds}
        />
        {movedBounds && JSON.stringify(movedBounds) !== JSON.stringify(search.bounds) ? <button
          type="button"
          className="market-search-area"
          onClick={() => { update({ bounds: movedBounds }); setMovedBounds(null); }}
        >{text.search.searchArea}</button> : null}
        {view === 'map' && picked ? <div className="market-map-peek">
          <ListingCard listing={picked} locale={locale} selected={compare.some(item => item.id === picked.id)} onToggleCompare={picked.reportId ? toggleCompare : undefined} />
          <button type="button" className="market-peek-close" onClick={() => setPickedId(null)} aria-label={text.editor.close}>×</button>
        </div> : null}
      </aside>
    </div>

    <div className="market-view-toggle" role="tablist" aria-label={`${text.search.list} / ${text.search.map}`}>
      <button type="button" role="tab" aria-selected={view === 'list'} className={view === 'list' ? 'is-on' : ''} onClick={() => setView('list')}>{text.search.list}</button>
      <button type="button" role="tab" aria-selected={view === 'map'} className={view === 'map' ? 'is-on' : ''} onClick={() => setView('map')}>{text.search.map}</button>
    </div>

    {compare.length ? <div className="market-compare-tray" role="region" aria-label={text.card.compare}>
      <div className="market-compare-thumbs">
        {compare.map(item => <button key={item.id} type="button" onClick={() => toggleCompare(item)} title={item.title}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {item.photos[0] ? <img src={item.photos[0]} alt="" referrerPolicy="no-referrer" /> : <span />}
          <i aria-hidden="true">×</i>
        </button>)}
      </div>
      <p>{compareState === 'failed' ? text.compare.failed : text.compare.tray(compare.length)}</p>
      <button type="button" className="market-button" disabled={compare.length !== 2 || compareState === 'working'} onClick={openComparison}>
        {compareState === 'working' ? text.compare.working : text.compare.go}
      </button>
      <button type="button" className="market-link-button" onClick={() => setCompare([])}>{text.compare.clear}</button>
    </div> : null}
  </div>;
}
