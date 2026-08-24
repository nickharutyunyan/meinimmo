import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim();
  if (!query || /not stated/i.test(query)) {
    return NextResponse.json({ error: 'No usable location supplied.' }, { status: 400 });
  }

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('countrycodes', 'de');
    url.searchParams.set('q', query);
    const response = await fetch(url, {
      headers: { 'User-Agent': 'GoodHomesPropertyAssessment/1.0' },
      next: { revalidate: 60 * 60 * 24 * 30 },
    });
    if (!response.ok) throw new Error('Geocoding service unavailable');
    const [place] = await response.json() as Array<{ lat: string; lon: string; display_name: string }>;
    if (!place) return NextResponse.json({ error: 'Location not found.' }, { status: 404 });
    return NextResponse.json({ lat: Number(place.lat), lon: Number(place.lon), label: place.display_name });
  } catch {
    return NextResponse.json({ error: 'Map location is temporarily unavailable.' }, { status: 502 });
  }
}
