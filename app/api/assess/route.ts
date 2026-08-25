import { NextRequest, NextResponse } from 'next/server';
import { defaultOfferQuestions, deterministicAssessment, enrichAssessment, looksLikeListing } from '@/lib/assessment';
import { report as findReport, reportBySource, replaceReport, saveReport } from '@/lib/store';
import { canonicalSource, resolveLocation } from '@/lib/display';
import { rememberUserReport, reserveReportAllowance } from '@/lib/access';
import { anonymousToken, attachAnonymousCookie, sessionUser } from '@/lib/auth';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  const anonymous = anonymousToken(request);
  const respond = (body: unknown, status = 200) => {
    const response = NextResponse.json(body, { status });
    attachAnonymousCookie(response, request, anonymous);
    return response;
  };
  const input = await request.json() as { url?: string; text?: string; name?: string; locale?: 'en' | 'de' };
  const de = input.locale === 'de';
  const quotaExceeded = (state: Awaited<ReturnType<typeof reserveReportAllowance>>['state']) => respond({
    error: de ? 'Du hast dein Berichtslimit für diesen Zeitraum erreicht.' : 'You have reached your report limit for this period.',
    code: 'quota_exceeded',
    access: state,
  }, 402);
  let text = input.text || '';
  let source = input.name || 'PDF Exposé';
  if (input.url) {
    let url: URL;
    try { url = new URL(input.url); } catch { return respond({ error: de ? 'Bitte gib einen gültigen öffentlichen Link ein.' : 'Enter a valid public listing URL.' }, 400); }
    if (!['http:', 'https:'].includes(url.protocol) || ['localhost', '127.0.0.1'].includes(url.hostname)) return respond({ error: de ? 'Bitte gib einen öffentlichen Link ein.' : 'Enter a public listing URL.' }, 400);
    const existing = await reportBySource(url.toString());
    if (existing?.aiLocationChecked && existing.aiFactChecked && resolveLocation(existing).basis !== 'none') {
      const allowance = await reserveReportAllowance(request, anonymous.token);
      if (!allowance.allowed) return quotaExceeded(allowance.state);
      const user = await sessionUser(request);
      await rememberUserReport(user?.id, existing.id);
      return respond({ ...existing, access: allowance.state });
    }
    const response = await fetch(url, { headers: { 'user-agent': 'ReviewAHouse/1.0 (+property assessment)' }, redirect: 'follow' });
    if ([401, 403].includes(response.status)) return respond({ error: de ? 'Dieses Portal blockiert den Import. Lade stattdessen das Exposé als PDF hoch.' : 'This portal blocks server imports. Upload its Exposé PDF instead.' }, 422);
    if (!response.ok) return respond({ error: de ? 'Das Angebot ist nicht mehr verfügbar oder konnte nicht geöffnet werden.' : 'This listing is no longer available or could not be opened.' }, 422);
    text = await response.text();
    source = url.toString();
  }
  if (text.length < 150 || !looksLikeListing(text)) return respond({ error: de ? 'Das sieht nicht nach einem Immobilienangebot oder einem durchsuchbaren Exposé aus.' : 'This does not look like a real-estate listing or a text-searchable Exposé.' }, 422);
  const baseReport = deterministicAssessment(text, source);
  const fingerprint = canonicalSource(source).slice(0, 500);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${fingerprint}\n${source.startsWith('http') ? '' : text}`));
  const stableId = [...new Uint8Array(digest)].slice(0, 8).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const existingById = await findReport(stableId);
  if (existingById) {
    const checked = existingById.aiLocationChecked && existingById.aiFactChecked;
    const refreshed = checked ? existingById : { ...await enrichAssessment(baseReport, text), id: existingById.id, createdAt: existingById.createdAt };
    if (resolveLocation(refreshed).basis === 'none') return respond({ error: de ? 'Im Angebot fehlt eine verlässliche Lageangabe.' : 'The listing does not provide a reliable location.' }, 422);
    if (!checked) await replaceReport(refreshed);
    const allowance = await reserveReportAllowance(request, anonymous.token);
    if (!allowance.allowed) return quotaExceeded(allowance.state);
    const user = await sessionUser(request);
    await rememberUserReport(user?.id, refreshed.id);
    return respond({ ...refreshed, access: allowance.state });
  }
  const allowance = await reserveReportAllowance(request, anonymous.token);
  if (!allowance.allowed) return quotaExceeded(allowance.state);
  const enriched = await enrichAssessment({ ...baseReport, offerQuestions: defaultOfferQuestions(baseReport), offerQuestionsDe: defaultOfferQuestions(baseReport, 'de') }, text);
  if (resolveLocation(enriched).basis === 'none') {
    await allowance.release?.();
    return respond({ error: de ? 'Im Angebot fehlt eine verlässliche Lageangabe. Ohne belegbare Lage erstellen wir keinen Bericht.' : 'The listing does not provide a reliable location. We will not create a report without one.' }, 422);
  }
  const report = { ...enriched, id: stableId };
  try {
    await saveReport(report);
    await rememberUserReport(allowance.userId, report.id);
    return respond({ ...report, access: allowance.state }, 201);
  } catch (error) {
    await allowance.release?.();
    throw error;
  }
}
