import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';
import { authDatabase } from '@/lib/auth-db';
import { sha256Hex } from '@/lib/security';
import { readLightSession } from '@/lib/session-view';

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = token
    ? await readLightSession(await authDatabase(), await sha256Hex(token), new Date().toISOString())
    : null;
  const response = NextResponse.json({ user, flags: {} });
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Vary', 'Cookie');
  return response;
}
