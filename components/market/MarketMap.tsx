'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import type { ListingSummary } from '@/lib/market/types';
import { priceShort } from '@/lib/market/format';
import { OSM_ATTRIBUTION, OSM_COPYRIGHT_URL } from '@/lib/osm-map';

export type MapBounds = { south: number; west: number; north: number; east: number };

type Props = {
  listings: ListingSummary[];
  locale: 'en' | 'de';
  center: [number, number];
  zoom: number;
  activeId: string | null;
  onHover?: (id: string | null) => void;
  onSelect?: (id: string) => void;
  /** Called after the reader pans or zooms, not after programmatic fits. */
  onMoved?: (bounds: MapBounds) => void;
  /** A single listing page shows one larger pin and no prices. */
  single?: boolean;
  /** Fit every pin into view when the set of listings changes. */
  fit?: boolean;
};

function pinHtml(listing: ListingSummary, locale: 'en' | 'de', single: boolean) {
  if (single) return '<span class="market-pin-dot"></span>';
  return `<span class="market-pin-label">${priceShort(listing.price, locale)}</span>`;
}

export function MarketMap({ listings, locale, center, zoom, activeId, onHover, onSelect, onMoved, single = false, fit = true }: Props) {
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const library = useRef<typeof Leaflet | null>(null);
  const markers = useRef(new Map<string, Leaflet.Marker>());
  const programmatic = useRef(false);
  // Bumped once Leaflet has loaded, so the marker effects run against a live map.
  const [ready, setReady] = useState(0);
  const handlers = useRef({ onHover, onSelect, onMoved });
  handlers.current = { onHover, onSelect, onMoved };

  useEffect(() => {
    let cancelled = false;
    import('leaflet').then((L) => {
      if (cancelled || !node.current || map.current) return;
      library.current = L;
      const instance = L.map(node.current, {
        center,
        zoom,
        zoomControl: false,
        scrollWheelZoom: !single,
        attributionControl: true,
      });
      L.control.zoom({ position: 'bottomright' }).addTo(instance);
      instance.attributionControl.setPrefix(false);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: `<a href="${OSM_COPYRIGHT_URL}" target="_blank" rel="noreferrer">${OSM_ATTRIBUTION}</a>`,
        className: 'market-tiles',
      }).addTo(instance);
      instance.on('zoomend moveend', () => declutter());
      instance.on('moveend', () => {
        if (programmatic.current) { programmatic.current = false; return; }
        const bounds = instance.getBounds();
        handlers.current.onMoved?.({ south: bounds.getSouth(), west: bounds.getWest(), north: bounds.getNorth(), east: bounds.getEast() });
      });
      map.current = instance;
      setReady(value => value + 1);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      markers.current.clear();
    };
    // The map is created once; later prop changes update markers, not the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const L = library.current;
    const instance = map.current;
    if (!L || !instance) return;
    const placed = listings.filter(listing => listing.lat !== null && listing.lon !== null);
    const keep = new Set(placed.map(listing => listing.id));
    for (const [id, marker] of markers.current) {
      if (!keep.has(id)) { marker.remove(); markers.current.delete(id); }
    }
    for (const listing of placed) {
      if (markers.current.has(listing.id)) continue;
      const marker = L.marker([listing.lat!, listing.lon!], {
        icon: L.divIcon({ className: `market-pin${single ? ' is-single' : ''}`, html: pinHtml(listing, locale, single), iconSize: undefined }),
        keyboard: !single,
        title: listing.title,
        riseOnHover: true,
      });
      if (!single) {
        marker.on('mouseover', () => handlers.current.onHover?.(listing.id));
        marker.on('mouseout', () => handlers.current.onHover?.(null));
        marker.on('click', () => handlers.current.onSelect?.(listing.id));
      }
      marker.addTo(instance);
      markers.current.set(listing.id, marker);
    }
    if (fit && placed.length) {
      programmatic.current = true;
      if (placed.length === 1) instance.setView([placed[0].lat!, placed[0].lon!], single ? 15 : 14, { animate: false });
      else instance.fitBounds(L.latLngBounds(placed.map(listing => [listing.lat!, listing.lon!] as [number, number])), { padding: [48, 48], maxZoom: 15, animate: false });
    }
  }, [listings, locale, single, fit, ready]);

  /** Price labels that would overlap shrink to dots; zooming in brings their prices back. */
  function declutter() {
    const instance = map.current;
    if (!instance || single) return;
    const placed: Array<{ x: number; y: number }> = [];
    const ordered = [...markers.current].sort(([a], [b]) => Number(b === activeRef.current) - Number(a === activeRef.current));
    for (const [, marker] of ordered) {
      const element = marker.getElement();
      if (!element) continue;
      const point = instance.latLngToContainerPoint(marker.getLatLng());
      const crowded = placed.some(other => Math.abs(other.x - point.x) < 58 && Math.abs(other.y - point.y) < 24);
      element.classList.toggle('is-dot', crowded);
      if (!crowded) placed.push(point);
    }
  }
  const activeRef = useRef<string | null>(null);
  activeRef.current = activeId;

  useEffect(() => {
    declutter();
    for (const [id, marker] of markers.current) {
      const element = marker.getElement();
      if (!element) continue;
      const on = id === activeId;
      element.classList.toggle('is-active', on);
      marker.setZIndexOffset(on ? 1000 : 0);
    }
  }, [activeId, listings, ready]);

  return <div className="market-map" ref={node} />;
}
