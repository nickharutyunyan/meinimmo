import { NextRequest, NextResponse } from 'next/server';
import { clearPrivateCookie, deleteSession, requireSameOrigin, SESSION_COOKIE } from '@/lib/auth';

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  await deleteSession(request);
  const response = NextResponse.json({ ok: true });
  clearPrivateCookie(response, request, SESSION_COOKIE);
  return response;
}
