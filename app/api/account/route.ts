import { NextRequest, NextResponse } from 'next/server';
import { requireSameOrigin, sessionUser, updateDisplayName, updateRecoveryEmail } from '@/lib/auth';

export async function PATCH(request: NextRequest) {
  if (!requireSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const user = await sessionUser(request);
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const input = await request.json() as { name?: string; email?: string; locale?: 'en' | 'de' };
  const de = input.locale === 'de';
  try {
    const email = user.username && typeof input.email === 'string' ? await updateRecoveryEmail(user.id, input.email) : user.email;
    const name = await updateDisplayName(user.id, input.name || '');
    return NextResponse.json({ name, email });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const message = code === 'email_taken'
      ? (de ? 'Diese E-Mail-Adresse wird schon für ein anderes Konto verwendet.' : 'That recovery email is already in use.')
      : code === 'invalid_email'
        ? (de ? 'Gib eine gültige E-Mail-Adresse ein.' : 'Enter a valid recovery email.')
        : code === 'email_unverified'
          ? (de ? 'Bestätige diese E-Mail-Adresse, bevor du sie änderst.' : 'Confirm this email before you change it.')
          : (de ? 'Das Profil konnte nicht gespeichert werden.' : 'Profile could not be updated.');
    const status = code === 'email_taken' ? 409 : code === 'email_unverified' ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
