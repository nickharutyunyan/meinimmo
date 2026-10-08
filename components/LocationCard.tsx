'use client';

import { useEffect, useState } from 'react';
import { copy, type Locale } from '@/lib/i18n';
import type { LocationResolution } from '@/lib/display';
import { requestJson } from '@/lib/client-request';
import { hasStoredGeocode, OSM_COPYRIGHT_URL, osmExploreHref, placeFromGeocodeResponse } from '@/lib/osm-map';

type Place = { lat: number; lon: number; label: string };
type StoredGeocode = { lat: number; lon: number; precision?: 'street' | 'postcode' };

export function LocationCard({ location, locale, reportId, geocode }: { location: LocationResolution; locale: Locale; reportId: string; geocode?: StoredGeocode | null }) {
  const text = copy[locale].map;
  const storedPlace = hasStoredGeocode(geocode) ? { lat: geocode.lat, lon: geocode.lon, label: location.mapLabel } : null;
  const [place, setPlace] = useState<Place | null>(storedPlace);
  const [mapDropped, setMapDropped] = useState(false);

  useEffect(() => {
    if (hasStoredGeocode(geocode)) {
      setPlace({ lat: geocode.lat, lon: geocode.lon, label: location.mapLabel });
      setMapDropped(false);
      return;
    }
    if (!location.mapQuery) {
      setMapDropped(true);
      return;
    }
    let active = true;
    setPlace(null);
    setMapDropped(false);
    const url = `/api/geocode?q=${encodeURIComponent(location.mapQuery)}&report=${encodeURIComponent(reportId)}`;
    requestJson<Place>(url, { cache: 'no-store' }, 5_000)
      .then(({ response, data }) => {
        if (!active) return;
        const next = placeFromGeocodeResponse(response.status, data);
        if (!next) {
          setMapDropped(true);
          return;
        }
        setPlace({ lat: next.lat, lon: next.lon, label: next.label || location.mapLabel });
      })
      .catch(() => {
        if (active) setMapDropped(true);
      });
    return () => { active = false; };
  }, [geocode, location.mapLabel, location.mapQuery, reportId]);

  const mapUrl = place ? `https://www.openstreetmap.org/export/embed.html?bbox=${place.lon - 0.012}%2C${place.lat - 0.007}%2C${place.lon + 0.012}%2C${place.lat + 0.007}&layer=mapnik&marker=${place.lat}%2C${place.lon}` : '';
  const googleMapsUrl = location.mapQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.mapQuery)}` : '';
  const exploreHref = osmExploreHref(place, location.mapQuery || location.mapLabel);
  const showMap = Boolean(place) && !mapDropped;

  return <section className="card location-card">
    <div className="location-copy"><p className="eyebrow">{text.label}</p><h2>{googleMapsUrl ? <a className="report-address-link" href={googleMapsUrl} target="_blank" rel="noreferrer" aria-label={`${location.mapLabel} — Google Maps`}>{location.mapLabel}<span aria-hidden="true">↗</span></a> : location.mapLabel}</h2><p>{text.intro}</p><small className={location.exact ? 'map-precision exact' : 'map-precision'}>{location.exact ? text.exact : `${text.approximate} ${location.basis === 'postal code' ? `${locale === 'de' ? 'Postleitzahl' : 'postal area'} ${location.mapLabel}` : location.mapLabel}.`}</small></div>
    {showMap ? <div className="map-shell"><iframe title={`${locale === 'de' ? 'Karte von' : 'Map of'} ${location.mapLabel}`} src={mapUrl} loading="lazy" /></div> : mapDropped ? null : <div className="map-shell"><div className="map-loading">{text.loading}</div></div>}
    {showMap ? <p className="map-credit"><a href={OSM_COPYRIGHT_URL} target="_blank" rel="noreferrer">{text.credit}</a></p> : null}
    <a href={exploreHref} target="_blank" rel="noreferrer">{text.explore}</a>
  </section>;
}
