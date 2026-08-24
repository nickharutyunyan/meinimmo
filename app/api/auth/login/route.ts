import { NextRequest, NextResponse } from 'next/server';
import { mergeAnonymousUsage } from '@/lib/access';
import { ANON_COOKIE, attachSession, authenticateCredentials, authRateLimited, createSession, requireSameOrigin } from '@/lib/auth';

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const input = await request.json() as { username?: string; password?: string; locale?: 'en' | 'de' };
  const de = input.locale === 'de';
  if (await authRateLimited(request, input.username || 'login')) return NextResponse.json({ error: de ? 'Zu viele Versuche. Versuch es in 15 Minuten noch einmal.' : 'Too many attempts. Try again in 15 minutes.' }, { status: 429 });
  const user = await authenticateCredentials(input.username || '', input.password || '');
  if (!user) return NextResponse.json({ error: de ? 'Nutzername oder Passwort stimmt nicht.' : 'Username or password is incorrect.' }, { status: 401 });
  await mergeAnonymousUsage(user.id, request.cookies.get(ANON_COOKIE)?.value);
  const session = await createSession(user.id);
  const response = NextResponse.json({ user: { username: user.username, email: user.email, name: user.name } });
  attachSession(response, request, session);
  return response;
}
