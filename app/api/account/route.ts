import { NextRequest, NextResponse } from 'next/server';
import { requireSameOrigin, sessionUser, updateDisplayName, updateRecoveryEmail } from '@/lib/auth';

export async function PATCH(request: NextRequest) {
  if (!requireSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const user = await sessionUser(request);
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const input = await request.json() as { name?: string; email?: string; locale?: 'en' | 'de' };
  const de = input.locale === 'de';
  try {
    const name = await updateDisplayName(user.id, input.name || '');
    const email = user.username && typeof input.email === 'string' ? await updateRecoveryEmail(user.id, input.email) : user.email;
    return NextResponse.json({ name, email });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const message = code === 'email_taken'
      ? (de ? 'Diese E-Mail-Adresse wird schon für ein anderes Konto verwendet.' : 'That recovery email is already in use.')
      : code === 'invalid_email'
        ? (de ? 'Gib eine gültige E-Mail-Adresse ein.' : 'Enter a valid recovery email.')
        : (de ? 'Das Profil konnte nicht gespeichert werden.' : 'Profile could not be updated.');
    return NextResponse.json({ error: message }, { status: code === 'email_taken' ? 409 : 400 });
  }
}
