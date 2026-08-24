import { NextRequest, NextResponse } from 'next/server';
import { mergeAnonymousUsage } from '@/lib/access';
import { appEnvironment } from '@/lib/auth-db';
import { ANON_COOKIE, attachSession, clearPrivateCookie, createSession, findOrCreateGoogleUser, OAUTH_COOKIE } from '@/lib/auth';
import { base64UrlToBytes, constantTimeEqual, safeReturnTo } from '@/lib/security';

type OAuthCookie = { state: string; verifier: string; returnTo: string; redirectUri: string };

function accountError(request: NextRequest, localePath = '/account') {
  return NextResponse.redirect(new URL(`${localePath}?error=google`, request.url));
}

export async function GET(request: NextRequest) {
  const encoded = request.cookies.get(OAUTH_COOKIE)?.value;
  let oauth: OAuthCookie | undefined;
  try { oauth = encoded ? JSON.parse(new TextDecoder().decode(base64UrlToBytes(encoded))) as OAuthCookie : undefined; } catch { oauth = undefined; }
  const fallback = oauth?.returnTo?.startsWith('/de') ? '/de/account' : '/account';
  if (!oauth || !constantTimeEqual(request.nextUrl.searchParams.get('state') || '', oauth.state) || !request.nextUrl.searchParams.get('code')) return accountError(request, fallback);
  const env = await appEnvironment();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return accountError(request, fallback);
  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: request.nextUrl.searchParams.get('code') || '', client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: oauth.redirectUri,
        grant_type: 'authorization_code', code_verifier: oauth.verifier,
      }),
    });
    if (!tokenResponse.ok) throw new Error('token_exchange_failed');
    const tokens = await tokenResponse.json() as { access_token?: string };
    if (!tokens.access_token) throw new Error('missing_access_token');
    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: `Bearer ${tokens.access_token}` } });
    if (!profileResponse.ok) throw new Error('profile_failed');
    const profile = await profileResponse.json() as { sub?: string; email?: string; email_verified?: boolean };
    if (!profile.sub || !profile.email || profile.email_verified === false) throw new Error('unverified_profile');
    const user = await findOrCreateGoogleUser(profile.sub, profile.email);
    await mergeAnonymousUsage(user.id, request.cookies.get(ANON_COOKIE)?.value);
    const session = await createSession(user.id);
    const response = NextResponse.redirect(new URL(safeReturnTo(oauth.returnTo, fallback), request.url));
    attachSession(response, request, session);
    clearPrivateCookie(response, request, OAUTH_COOKIE);
    return response;
  } catch {
    const response = accountError(request, fallback);
    clearPrivateCookie(response, request, OAUTH_COOKIE);
    return response;
  }
}
