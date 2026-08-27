import { NextRequest, NextResponse } from 'next/server';
import { mergeAnonymousUsage } from '@/lib/access';
import { ANON_COOKIE, attachSession, authRateLimited, createCredentialsUser, createSession, requireSameOrigin } from '@/lib/auth';

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const input = await request.json() as { username?: string; email?: string; password?: string; name?: string; locale?: 'en' | 'de' };
  const de = input.locale === 'de';
  if (await authRateLimited(request, input.username || 'signup')) return NextResponse.json({ error: de ? 'Zu viele Versuche. Versuch es in 15 Minuten noch einmal.' : 'Too many attempts. Try again in 15 minutes.' }, { status: 429 });
  try {
    const user = await createCredentialsUser(input.username || '', input.password || '', input.name, input.email);
    await mergeAnonymousUsage(user.id, request.cookies.get(ANON_COOKIE)?.value);
    const session = await createSession(user.id);
    const response = NextResponse.json({ user: { username: user.username, email: user.email, name: user.name } }, { status: 201 });
    attachSession(response, request, session);
    return response;
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const knownError = ['username_taken', 'email_taken', 'account_exists', 'invalid_password', 'invalid_username', 'invalid_email'].includes(code);
    if (!knownError) console.error('Credential signup failed', error);
    const message = code === 'username_taken'
      ? (de ? 'Dieser Nutzername ist schon vergeben.' : 'That username is already taken.')
      : code === 'email_taken'
        ? (de ? 'Diese E-Mail-Adresse gehört schon zu einem Konto. Melde dich an oder setze dein Passwort zurück.' : 'That email already belongs to an account. Sign in or reset your password.')
        : code === 'account_exists'
          ? (de ? 'Nutzername oder E-Mail-Adresse ist schon vergeben.' : 'That username or email is already in use.')
      : code === 'invalid_password'
        ? (de ? 'Nimm mindestens 10 Zeichen sowie einen Buchstaben und eine Zahl.' : 'Use at least 10 characters, including a letter and a number.')
        : code === 'invalid_username'
          ? (de ? 'Nutzername: 3–32 Zeichen, nur Buchstaben, Zahlen, Punkt, Minus oder Unterstrich.' : 'Username: 3–32 characters using letters, numbers, dots, dashes or underscores.')
          : code === 'invalid_email'
            ? (de ? 'Gib eine gültige E-Mail-Adresse für die Passwort-Wiederherstellung ein.' : 'Enter a valid recovery email address.')
          : (de ? 'Das Konto konnte gerade nicht erstellt werden. Versuch es bitte noch einmal.' : 'The account could not be created right now. Please try again.');
    return NextResponse.json({ error: message }, { status: ['username_taken', 'email_taken', 'account_exists'].includes(code) ? 409 : knownError ? 400 : 500 });
  }
}
