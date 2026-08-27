import { NextRequest, NextResponse } from 'next/server';
import { authRateLimited, requireSameOrigin } from '@/lib/auth';
import { issuePasswordReset, revokePasswordReset } from '@/lib/password-reset';
import { passwordEmailConfigured, sendPasswordResetEmail } from '@/lib/transactional-email';

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const input = await request.json() as { identifier?: string; locale?: 'en' | 'de' };
  const de = input.locale === 'de';
  const identifier = typeof input.identifier === 'string' ? input.identifier.trim().slice(0, 254) : '';
  if (!identifier) return NextResponse.json({ error: de ? 'Gib deinen Nutzernamen oder deine E-Mail-Adresse ein.' : 'Enter your username or recovery email.' }, { status: 400 });
  if (await authRateLimited(request, `forgot:${identifier}`)) {
    return NextResponse.json({ error: de ? 'Zu viele Versuche. Versuch es in 15 Minuten noch einmal.' : 'Too many attempts. Try again in 15 minutes.' }, { status: 429 });
  }
  if (!await passwordEmailConfigured()) {
    return NextResponse.json({ error: de ? 'Die Passwort-Wiederherstellung ist gerade nicht verfügbar.' : 'Password recovery is not available right now.' }, { status: 503 });
  }

  const generic = de
    ? 'Falls dieses Konto eine Wiederherstellungs-E-Mail hat, ist der Link unterwegs.'
    : 'If this account has a recovery email, a reset link is on its way.';
  const reset = await issuePasswordReset(identifier);
  if (reset) {
    const prefix = de ? '/de' : '';
    const resetUrl = `${new URL(request.url).origin}${prefix}/account/reset#token=${encodeURIComponent(reset.token)}`;
    try {
      await sendPasswordResetEmail(reset.email, resetUrl, de ? 'de' : 'en', reset.tokenHash);
    } catch (error) {
      await revokePasswordReset(reset.tokenHash);
      console.error('Password reset email delivery failed', error instanceof Error ? error.message : 'unknown');
    }
  }
  return NextResponse.json({ message: generic }, { status: 202 });
}
