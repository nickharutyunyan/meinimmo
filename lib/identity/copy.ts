import type { Locale } from './constants.ts';

export function invalidEmailMessage(locale: Locale) {
  return locale === 'de' ? 'Gib eine gültige E-Mail-Adresse ein.' : 'Enter a valid email address.';
}

export function mailUnavailableMessage(locale: Locale) {
  return locale === 'de'
    ? 'Die E-Mail konnte gerade nicht verschickt werden. Versuch es in ein paar Minuten noch einmal.'
    : 'We could not send the email just now. Please try again in a few minutes.';
}

export function signInAcceptedMessage(email: string, locale: Locale) {
  return locale === 'de'
    ? `Schau in dein Postfach. Wenn ${email} hier genutzt werden kann, ist ein Anmeldelink unterwegs. Er gilt 15 Minuten.`
    : `Check your inbox. If ${email} can be used here, a sign-in link is on its way. It works for 15 minutes.`;
}

export function resendAcceptedMessage(email: string, locale: Locale) {
  return locale === 'de'
    ? `Schau in dein Postfach. Wenn ${email} noch bestätigt werden muss, ist ein Bestätigungslink unterwegs. Er gilt 24 Stunden.`
    : `Check your inbox. If ${email} still needs confirming, a confirmation link is on its way. It works for 24 hours.`;
}

export function linkExpiredMessage(locale: Locale) {
  return locale === 'de'
    ? 'Dieser Link ist abgelaufen oder wurde schon benutzt. Fordere einen neuen an.'
    : 'This link has expired or was already used. Request a new one.';
}

export function continueHeading(locale: Locale) {
  return locale === 'de' ? 'Weiter zu Review a House' : 'Continue to Review a House';
}

export function continueButton(locale: Locale) {
  return locale === 'de' ? 'Weiter' : 'Continue';
}

export function continueAsButton(email: string, locale: Locale) {
  return locale === 'de' ? `Weiter als ${email}` : `Continue as ${email}`;
}

export function signingInAs(email: string, locale: Locale) {
  return locale === 'de' ? `Du meldest dich an als ${email}.` : `You are signing in as ${email}.`;
}

export function sendLinkLabel(locale: Locale) {
  return locale === 'de' ? 'Link senden' : 'Send me a link';
}

export function passwordInsteadLabel(locale: Locale) {
  return locale === 'de' ? 'Stattdessen mit Passwort anmelden' : 'Sign in with password instead';
}

export function sendConfirmationLabel(locale: Locale) {
  return locale === 'de' ? 'Bestätigungslink senden' : 'Send confirmation link';
}

export function confirmToPublish(locale: Locale) {
  return locale === 'de'
    ? 'Bestätige deine E-Mail-Adresse, um Inserate zu veröffentlichen und Benachrichtigungen zu bekommen.'
    : 'Confirm your email to publish listings and get alerts.';
}

export function termsNote(locale: Locale) {
  return locale === 'de'
    ? 'Mit dem Fortfahren akzeptierst du unsere Nutzungsbedingungen und die Datenschutzerklärung.'
    : 'By continuing you accept our Terms and Privacy Policy.';
}

export function authLinkUrl(origin: string, locale: Locale, token: string) {
  const prefix = locale === 'de' ? '/de' : '';
  return `${origin}${prefix}/auth/link#t=${encodeURIComponent(token)}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character));
}

export function accountLinkEmail(url: string, locale: Locale, kind: 'sign_in' | 'verify_email') {
  const safeUrl = escapeHtml(url);
  const footer = locale === 'de'
    ? 'Review a House · reviewahouse.com · Du bekommst diese E-Mail wegen deines Kontos. Verwalten: https://reviewahouse.com/de/account'
    : 'Review a House · reviewahouse.com · You get this email because of your account. Manage: https://reviewahouse.com/account';
  if (kind === 'verify_email') {
    if (locale === 'de') return {
      subject: 'Bestätige deine E-Mail-Adresse',
      text: `Bitte bestätige, dass diese Adresse dir gehört:\n\n${url}\n\nMit bestätigter Adresse kannst du Inserate veröffentlichen und Benachrichtigungen bekommen. Der Link gilt 24 Stunden.\n\n${footer}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;color:#18342c;line-height:1.6"><p style="font-size:12px;letter-spacing:.12em">REVIEW A HOUSE</p><h1 style="font-family:Georgia,serif;font-size:30px;font-weight:400">E-Mail bestätigen</h1><p>Bitte bestätige, dass diese Adresse dir gehört. Mit bestätigter Adresse kannst du Inserate veröffentlichen und Benachrichtigungen bekommen. Der Link gilt 24 Stunden.</p><p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;background:#18342c;color:#fff;text-decoration:none;border-radius:4px;font-weight:700">E-Mail bestätigen</a></p><p style="color:#68766f;font-size:13px">${escapeHtml(footer)}</p></div>`,
    };
    return {
      subject: 'Confirm your email address',
      text: `Please confirm that this address belongs to you:\n\n${url}\n\nYou need a confirmed address to publish listings and get alerts. The link works for 24 hours.\n\n${footer}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;color:#18342c;line-height:1.6"><p style="font-size:12px;letter-spacing:.12em">REVIEW A HOUSE</p><h1 style="font-family:Georgia,serif;font-size:30px;font-weight:400">Confirm your email</h1><p>Please confirm that this address belongs to you. You need a confirmed address to publish listings and get alerts. The link works for 24 hours.</p><p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;background:#18342c;color:#fff;text-decoration:none;border-radius:4px;font-weight:700">Confirm email</a></p><p style="color:#68766f;font-size:13px">${escapeHtml(footer)}</p></div>`,
    };
  }
  if (locale === 'de') return {
    subject: 'Dein Anmeldelink für Review a House',
    text: `Hallo, klick hier, um dich anzumelden:\n\n${url}\n\nDer Link gilt 15 Minuten und nur einmal. Hast du ihn nicht angefordert? Dann ignoriere diese E-Mail: Ohne den Link kann sich niemand anmelden.\n\n${footer}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;color:#18342c;line-height:1.6"><p style="font-size:12px;letter-spacing:.12em">REVIEW A HOUSE</p><h1 style="font-family:Georgia,serif;font-size:30px;font-weight:400">Anmelden</h1><p>Hallo, klick hier, um dich anzumelden. Der Link gilt 15 Minuten und nur einmal. Hast du ihn nicht angefordert? Dann ignoriere diese E-Mail: Ohne den Link kann sich niemand anmelden.</p><p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;background:#18342c;color:#fff;text-decoration:none;border-radius:4px;font-weight:700">Anmelden</a></p><p style="color:#68766f;font-size:13px">${escapeHtml(footer)}</p></div>`,
  };
  return {
    subject: 'Your sign-in link for Review a House',
    text: `Hi, click to sign in:\n\n${url}\n\nThe link works for 15 minutes and only once. If you didn't ask for it, ignore this email: nobody can sign in without the link.\n\n${footer}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;color:#18342c;line-height:1.6"><p style="font-size:12px;letter-spacing:.12em">REVIEW A HOUSE</p><h1 style="font-family:Georgia,serif;font-size:30px;font-weight:400">Sign in</h1><p>Hi, click to sign in. The link works for 15 minutes and only once. If you didn't ask for it, ignore this email: nobody can sign in without the link.</p><p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;background:#18342c;color:#fff;text-decoration:none;border-radius:4px;font-weight:700">Sign in</a></p><p style="color:#68766f;font-size:13px">${escapeHtml(footer)}</p></div>`,
  };
}
