import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { appEnvironment, authDatabase } from '../auth-db';
import { attachSession, createSession, requireSameOrigin, setPrivateCookie } from '../auth';
import { deliverEmail } from '../email/deliver';
import { clientIp } from './client-ip';
import { LINK_NONCE_COOKIE, type LinkPurpose, type Locale } from './constants';
import { accountLinkEmail, authLinkUrl, linkExpiredMessage } from './copy';
import { beginEmailLink, completeEmailLink, inspectLink } from './links';

function localeOf(value: unknown): Locale {
  return value === 'de' ? 'de' : 'en';
}

export async function handleBeginEmail(request: NextRequest, purpose: LinkPurpose) {
  if (!requireSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const input = await request.json() as { email?: string; locale?: string; returnTo?: string };
  const locale = localeOf(input.locale);
  const env = await appEnvironment();
  const origin = new URL(request.url).origin;
  const result = await beginEmailLink(await authDatabase(), {
    email: input.email || '',
    locale,
    purpose,
    ip: clientIp(request.headers),
    nowIso: new Date().toISOString(),
    returnTo: input.returnTo,
    mailConfigured: Boolean(env.RESEND_API_KEY && env.PASSWORD_RESET_FROM),
    send: async (issued) => {
      const url = authLinkUrl(origin, locale, issued.token);
      const content = accountLinkEmail(url, locale, purpose);
      await deliverEmail({
        apiKey: env.RESEND_API_KEY || '',
        from: env.PASSWORD_RESET_FROM || '',
        to: issued.email,
        idempotencyKey: `${purpose}-${issued.tokenHash}`,
        ...content,
      });
    },
  });
  const response = NextResponse.json(result.body, { status: result.status });
  if (result.issued) setPrivateCookie(response, request, LINK_NONCE_COOKIE, result.issued.nonce, 24 * 60 * 60);
  return response;
}

export async function handleInspectEmail(request: NextRequest) {
  if (!requireSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const input = await request.json() as { token?: string };
  const result = await inspectLink(await authDatabase(), input.token || '', new Date().toISOString(), request.cookies.get(LINK_NONCE_COOKIE)?.value || null);
  return NextResponse.json(result);
}

export async function handleVerifyEmail(request: NextRequest) {
  if (!requireSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const contentType = request.headers.get('content-type') || '';
  let token = '';
  let locale: Locale = 'en';
  if (contentType.includes('application/json')) {
    const input = await request.json() as { token?: string; locale?: string };
    token = input.token || '';
    locale = localeOf(input.locale);
  } else {
    const form = await request.formData();
    token = String(form.get('token') || '');
    locale = localeOf(form.get('locale'));
  }
  const result = await completeEmailLink(await authDatabase(), token, new Date().toISOString(), locale, createSession);
  if (!result.ok) {
    const error = linkExpiredMessage(locale);
    if (!contentType.includes('application/json')) {
      return NextResponse.redirect(new URL(locale === 'de' ? '/de/auth/link' : '/auth/link', request.url), 303);
    }
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }
  if (!contentType.includes('application/json')) {
    const response = NextResponse.redirect(new URL(result.redirect, request.url), 303);
    attachSession(response, request, result.session);
    return response;
  }
  const response = NextResponse.json({ ok: true, redirect: result.redirect });
  attachSession(response, request, result.session);
  return response;
}
