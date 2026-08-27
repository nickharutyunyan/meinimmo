'use client';

import { useEffect, useState } from 'react';
import { copy, type Locale } from '@/lib/i18n';
import type { LocationResolution } from '@/lib/display';

type Place = { lat: number; lon: number; label: string };

export function LocationCard({ location, locale }: { location: LocationResolution; locale: Locale }) {
  const [place, setPlace] = useState<Place | null>(null);
  const text = copy[locale].map;

  useEffect(() => {
    if (!location.mapQuery) return;
    let active = true;
    setPlace(null);
    fetch(`/api/geocode?q=${encodeURIComponent(location.mapQuery)}`)
      .then((response) => response.ok ? response.json() as Promise<Place> : Promise.reject())
      .then((data) => active && setPlace(data))
      .catch(() => undefined);
    return () => { active = false; };
  }, [location.mapQuery]);

  const mapUrl = place ? `https://www.openstreetmap.org/export/embed.html?bbox=${place.lon - 0.012}%2C${place.lat - 0.007}%2C${place.lon + 0.012}%2C${place.lat + 0.007}&layer=mapnik&marker=${place.lat}%2C${place.lon}` : '';
  const googleMapsUrl = location.mapQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.mapQuery)}` : '';

  return <section className="card location-card">
    <div className="location-copy"><p className="eyebrow">{text.label}</p><h2>{googleMapsUrl ? <a className="report-address-link" href={googleMapsUrl} target="_blank" rel="noreferrer" aria-label={`${location.mapLabel} — Google Maps`}>{location.mapLabel}<span aria-hidden="true">↗</span></a> : location.mapLabel}</h2><p>{text.intro}</p><small className={location.exact ? 'map-precision exact' : 'map-precision'}>{location.exact ? text.exact : `${text.approximate} ${location.basis === 'postal code' ? `${locale === 'de' ? 'Postleitzahl' : 'postal area'} ${location.mapLabel}` : location.mapLabel}.`}</small></div>
    <div className="map-shell">
      {mapUrl ? <iframe title={`${locale === 'de' ? 'Karte von' : 'Map of'} ${location.mapLabel}`} src={mapUrl} loading="lazy" /> : <div className="map-loading">{text.loading}</div>}
    </div>
    {place && <a href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lon}#map=16/${place.lat}/${place.lon}`} target="_blank" rel="noreferrer">{text.explore}</a>}
  </section>;
}
