'use client';

import { useEffect, useState } from 'react';

type Place = { lat: number; lon: number; label: string };

export function LocationCard({ query, label }: { query: string; label: string }) {
  const [place, setPlace] = useState<Place | null>(null);

  useEffect(() => {
    if (!query) return;
    let active = true;
    fetch(`/api/geocode?q=${encodeURIComponent(query)}`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => active && setPlace(data))
      .catch(() => undefined);
    return () => { active = false; };
  }, [query]);

  const mapUrl = place ? `https://www.openstreetmap.org/export/embed.html?bbox=${place.lon - 0.012}%2C${place.lat - 0.007}%2C${place.lon + 0.012}%2C${place.lat + 0.007}&layer=mapnik&marker=${place.lat}%2C${place.lon}` : '';

  return <section className="card location-card">
    <div className="location-copy"><p className="eyebrow">NEIGHBORHOOD</p><h2>{label}</h2><p>Use the map to verify walking routes to U-Bahn, S-Bahn, trams, parks and daily essentials—not just straight-line distance.</p></div>
    <div className="map-shell">
      {mapUrl ? <iframe title={`Map of ${label}`} src={mapUrl} loading="lazy" /> : <div className="map-loading">Locating the neighborhood…</div>}
    </div>
    {place && <a href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lon}#map=16/${place.lat}/${place.lon}`} target="_blank" rel="noreferrer">Explore on OpenStreetMap ↗</a>}
  </section>;
}
