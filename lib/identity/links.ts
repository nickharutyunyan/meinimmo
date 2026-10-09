import { normalizeEmail, validEmail } from '../security.ts';
import { LIVE_TOKEN_CAP, type LinkPurpose, type Locale } from './constants.ts';
import { invalidEmailMessage, mailUnavailableMessage, resendAcceptedMessage, signInAcceptedMessage } from './copy.ts';
import { proveMailbox, ensureUser } from './mailbox.ts';
import { reserveGlobalSend, reserveLinkAttempt } from './send-budget.ts';
import { consumeEmailToken, countLiveTokens, inspectEmailToken, issueEmailToken, voidEmailToken } from './tokens.ts';

type LinkDb = D1Database;

export type IssuedLink = { token: string; tokenHash: string; nonce: string; email: string };

export type BeginLinkResult = {
  status: 202 | 400 | 503;
  body: { message?: string; error?: string };
  delivery: 'sent' | 'skipped' | 'failed' | 'none';
  issued?: IssuedLink;
};

function acceptedBody(email: string, locale: Locale, purpose: LinkPurpose) {
  return {
    status: 202 as const,
    body: { message: purpose === 'sign_in' ? signInAcceptedMessage(email, locale) : resendAcceptedMessage(email, locale) },
    delivery: 'skipped' as const,
  };
}

export async function beginEmailLink(db: LinkDb, input: {
  email: string;
  locale: Locale;
  purpose: LinkPurpose;
  ip: string;
  nowIso: string;
  returnTo?: string | null;
  mailConfigured: boolean;
  send: (issued: IssuedLink) => Promise<void>;
}): Promise<BeginLinkResult> {
  const email = normalizeEmail(input.email || '');
  if (!validEmail(email)) return { status: 400, body: { error: invalidEmailMessage(input.locale) }, delivery: 'none' };
  if (await reserveLinkAttempt(db, email, input.ip, input.nowIso) === 'limited') return acceptedBody(email, input.locale, input.purpose);

  const existing = await db.prepare('SELECT id, email_verified_at FROM users WHERE email = ?1 COLLATE NOCASE')
    .bind(email).first<{ id: string; email_verified_at: string | null }>();
  if (input.purpose === 'verify_email' && (!existing || existing.email_verified_at)) return acceptedBody(email, input.locale, input.purpose);
  if (await countLiveTokens(db, email, input.purpose, input.nowIso) >= LIVE_TOKEN_CAP) return acceptedBody(email, input.locale, input.purpose);
  if (!input.mailConfigured) return { status: 503, body: { error: mailUnavailableMessage(input.locale) }, delivery: 'none' };
  if (await reserveGlobalSend(db, input.nowIso) === 'capped') return acceptedBody(email, input.locale, input.purpose);

  const issued = await issueEmailToken(db, {
    email,
    purpose: input.purpose,
    nowIso: input.nowIso,
    userId: existing?.id ?? null,
    returnTo: input.returnTo,
  });
  if (!issued) return acceptedBody(email, input.locale, input.purpose);
  const sent = { ...issued, email };
  try {
    await input.send(sent);
  } catch {
    await voidEmailToken(db, issued.tokenHash, input.nowIso);
    return { ...acceptedBody(email, input.locale, input.purpose), delivery: 'failed' };
  }
  return { ...acceptedBody(email, input.locale, input.purpose), delivery: 'sent', issued: sent };
}

export async function inspectLink(db: LinkDb, rawToken: string, nowIso: string, nonceCookie: string | null) {
  return inspectEmailToken(db, rawToken, nowIso, nonceCookie);
}

export async function completeEmailLink(db: LinkDb, rawToken: string, nowIso: string, locale: Locale, createSession: (userId: string) => Promise<{ token: string; expiresAt: Date }>) {
  const consumed = await consumeEmailToken(db, rawToken, nowIso);
  if (!consumed) return { ok: false as const, reason: 'used' as const };
  const user = await ensureUser(db, consumed.email, nowIso);
  const proof = user.email_verified_at ? 'already' as const : await proveMailbox(db, user.id, nowIso);
  const session = await createSession(user.id);
  const fallback = locale === 'de' ? '/de/account' : '/account';
  return {
    ok: true as const,
    email: consumed.email,
    userId: user.id,
    wiped: proof === 'verified',
    session,
    redirect: consumed.return_to || fallback,
  };
}
