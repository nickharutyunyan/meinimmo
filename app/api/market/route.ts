import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { publishedSummaries } from '@/lib/market/store';
import { isMarketSlug } from '@/lib/market/cities';

/**
 * Published listings as compact summaries, for the static buy pages. One D1 read and
 * no rendering, so it stays well inside the Worker CPU budget.
 */
export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get('city') || '';
  const locale = request.nextUrl.searchParams.get('locale') === 'de' ? 'de' : 'en';
  const market = city === 'other' ? 'other' : isMarketSlug(city) ? city : undefined;
  if (city && !market) return NextResponse.json({ error: 'Unknown city.' }, { status: 404 });
  const listings = await publishedSummaries(market, locale);
  return NextResponse.json({ listings }, { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=300' } });
}
