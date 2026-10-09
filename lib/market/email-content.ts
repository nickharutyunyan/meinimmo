/** The verification-code email for a seller listing, in the seller's language. */
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character);
}

export function listingCodeEmail(code: string, title: string, locale: 'en' | 'de') {
  const safeTitle = escapeHtml(title);
  const block = `<p style="margin:26px 0;font:700 34px/1 ui-monospace,Menlo,monospace;letter-spacing:.3em;color:#2b2420">${code}</p>`;
  if (locale === 'de') return {
    subject: `${code} ist dein Code für Review a House`,
    text: `Mit diesem Code bestätigst du die E-Mail-Adresse für dein Inserat „${title}“:\n\n${code}\n\nEr gilt 30 Minuten. Falls du kein Inserat erstellt hast, ignoriere diese E-Mail.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;color:#2b2420;line-height:1.6"><p style="font-size:12px;letter-spacing:.12em;color:#c4502f">REVIEW A HOUSE</p><h1 style="font-family:Georgia,serif;font-size:28px;font-weight:400">E-Mail für dein Inserat bestätigen</h1><p>Gib diesen Code im Editor von „${safeTitle}“ ein:</p>${block}<p style="color:#6f625a;font-size:13px">Der Code gilt 30 Minuten. Falls du kein Inserat erstellt hast, ignoriere diese E-Mail.</p></div>`,
  };
  return {
    subject: `${code} is your Review a House code`,
    text: `Use this code to confirm the email address for your listing "${title}":\n\n${code}\n\nIt expires in 30 minutes. If you did not create a listing, ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;color:#2b2420;line-height:1.6"><p style="font-size:12px;letter-spacing:.12em;color:#c4502f">REVIEW A HOUSE</p><h1 style="font-family:Georgia,serif;font-size:28px;font-weight:400">Confirm the email for your listing</h1><p>Enter this code in the editor for “${safeTitle}”:</p>${block}<p style="color:#6f625a;font-size:13px">The code expires in 30 minutes. If you did not create a listing, ignore this email.</p></div>`,
  };
}
