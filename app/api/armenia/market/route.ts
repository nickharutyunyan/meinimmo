import { NextResponse } from 'next/server';
import { armeniaMortgageRate } from '@/lib/armenia-market-data';
export async function GET() {
  const mortgage = await armeniaMortgageRate();
  return NextResponse.json({ mortgage }, { headers: { 'Cache-Control': 'public, max-age=900, s-maxage=3600' } });
}
