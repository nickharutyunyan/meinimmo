import 'server-only';
import { appEnvironment } from './auth-db';

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character);
}

export function passwordResetEmail(resetUrl: string, locale: 'en' | 'de') {
  const safeUrl = escapeHtml(resetUrl);
  if (locale === 'de') return {
    subject: 'Passwort für ReviewAHouse zurücksetzen',
    text: `Öffne diesen Link, um dein Passwort zurückzusetzen. Der Link ist 30 Minuten gültig und kann nur einmal benutzt werden:\n\n${resetUrl}\n\nFalls du das nicht angefordert hast, kannst du diese E-Mail ignorieren.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;color:#18342c;line-height:1.6"><p style="font-size:12px;letter-spacing:.12em">REVIEW A HOUSE</p><h1 style="font-family:Georgia,serif;font-size:30px;font-weight:400">Neues Passwort wählen</h1><p>Über den Button kannst du dein Passwort neu setzen. Der Link ist 30 Minuten gültig und funktioniert nur einmal.</p><p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;background:#18342c;color:#fff;text-decoration:none;border-radius:4px;font-weight:700">Passwort zurücksetzen</a></p><p style="color:#68766f;font-size:13px">Falls du das nicht angefordert hast, kannst du diese E-Mail ignorieren.</p></div>`,
  };
  return {
    subject: 'Reset your ReviewAHouse password',
    text: `Open this link to reset your password. It expires in 30 minutes and can only be used once:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;color:#18342c;line-height:1.6"><p style="font-size:12px;letter-spacing:.12em">REVIEW A HOUSE</p><h1 style="font-family:Georgia,serif;font-size:30px;font-weight:400">Choose a new password</h1><p>Use the button below to reset your password. The link expires in 30 minutes and works only once.</p><p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;background:#18342c;color:#fff;text-decoration:none;border-radius:4px;font-weight:700">Reset password</a></p><p style="color:#68766f;font-size:13px">If you did not request this, you can ignore this email.</p></div>`,
  };
}

export async function passwordEmailConfigured() {
  const env = await appEnvironment();
  return Boolean(env.RESEND_API_KEY && env.PASSWORD_RESET_FROM);
}

export async function sendPasswordResetEmail(to: string, resetUrl: string, locale: 'en' | 'de', idempotencyKey: string) {
  const env = await appEnvironment();
  if (!env.RESEND_API_KEY || !env.PASSWORD_RESET_FROM) throw new Error('email_not_configured');
  const content = passwordResetEmail(resetUrl, locale);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
      'idempotency-key': `password-reset-${idempotencyKey.slice(0, 48)}`,
    },
    body: JSON.stringify({ from: env.PASSWORD_RESET_FROM, to: [to], ...content }),
  });
  if (!response.ok) throw new Error(`email_delivery_failed_${response.status}`);
}
