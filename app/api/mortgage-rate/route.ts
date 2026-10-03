import { NextResponse } from 'next/server';
import { currentMortgageRate } from '@/lib/current-mortgage-rate';
export const dynamic = 'force-dynamic';
export async function GET() {
  const rate = await currentMortgageRate();
  return rate ? NextResponse.json(rate, {headers: {'Cache-Control':'public, max-age=900, s-maxage=3600, stale-while-revalidate=86400'}})
    : NextResponse.json({error:'The current German mortgage-rate average is temporarily unavailable.'}, {status:503,headers:{'Cache-Control':'no-store'}});
}
