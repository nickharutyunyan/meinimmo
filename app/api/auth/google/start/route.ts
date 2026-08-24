import { NextRequest, NextResponse } from 'next/server';
import { appEnvironment } from '@/lib/auth-db';
import { OAUTH_COOKIE, setPrivateCookie } from '@/lib/auth';
import { bytesToBase64Url, randomToken, safeReturnTo, sha256Base64Url } from '@/lib/security';

export async function GET(request: NextRequest) {
  const env = await appEnvironment();
  const locale = request.nextUrl.searchParams.get('locale') === 'de' ? 'de' : 'en';
  const fallback = locale === 'de' ? '/de/account' : '/account';
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return NextResponse.redirect(new URL(`${fallback}?error=google_not_configured`, request.url));
  const state = randomToken(24);
  const verifier = randomToken(48);
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get('returnTo'), fallback);
  const redirectUri = `${request.nextUrl.origin}/api/auth/google/callback`;
  const authorization = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorization.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email',
    state,
    code_challenge: await sha256Base64Url(verifier),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  const response = NextResponse.redirect(authorization);
  const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ state, verifier, returnTo, redirectUri })));
  setPrivateCookie(response, request, OAUTH_COOKIE, payload, 10 * 60);
  return response;
}
