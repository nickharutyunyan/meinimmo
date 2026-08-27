import { NextRequest, NextResponse } from 'next/server';
import { attachSession, authRateLimited, createSession, requireSameOrigin } from '@/lib/auth';
import { resetPassword } from '@/lib/password-reset';

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const input = await request.json() as { token?: string; password?: string; locale?: 'en' | 'de' };
  const de = input.locale === 'de';
  if (await authRateLimited(request, 'password-reset')) {
    return NextResponse.json({ error: de ? 'Zu viele Versuche. Versuch es in 15 Minuten noch einmal.' : 'Too many attempts. Try again in 15 minutes.' }, { status: 429 });
  }
  try {
    const userId = await resetPassword(input.token || '', input.password || '');
    const session = await createSession(userId);
    const response = NextResponse.json({ ok: true });
    attachSession(response, request, session);
    return response;
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const message = code === 'invalid_password'
      ? (de ? 'Nimm mindestens 10 Zeichen sowie einen Buchstaben und eine Zahl.' : 'Use at least 10 characters, including a letter and a number.')
      : (de ? 'Dieser Link ist ungültig oder abgelaufen. Fordere bitte einen neuen an.' : 'This link is invalid or has expired. Please request a new one.');
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
