import { NextResponse } from 'next/server'; import { reports } from '@/lib/store';
export async function GET() { return NextResponse.json((await reports()).slice(-30).reverse()); }
