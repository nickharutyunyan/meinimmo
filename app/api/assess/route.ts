import { NextRequest, NextResponse } from 'next/server';
import { defaultOfferQuestions, deterministicAssessment, looksLikeListing } from '@/lib/assessment';
import { report as findReport, reportBySource, saveReport } from '@/lib/store';
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
  let text = input.text || '';
  let source = input.name || 'PDF Exposé';
  if (input.url) {
    let url: URL;
    try { url = new URL(input.url); } catch { return respond({ error: de ? 'Bitte gib einen gültigen öffentlichen Link ein.' : 'Enter a valid public listing URL.' }, 400); }
    if (!['http:', 'https:'].includes(url.protocol) || ['localhost', '127.0.0.1'].includes(url.hostname)) return respond({ error: de ? 'Bitte gib einen öffentlichen Link ein.' : 'Enter a public listing URL.' }, 400);
    const existing = await reportBySource(url.toString());
    if (existing) {
      const user = await sessionUser(request);
      await rememberUserReport(user?.id, existing.id);
      return respond(existing);
    }
    const response = await fetch(url, { headers: { 'user-agent': 'ReviewAHouse/1.0 (+property assessment)' }, redirect: 'follow' });
    if ([401, 403].includes(response.status)) return respond({ error: de ? 'Dieses Portal blockiert den Import. Lade stattdessen das Exposé als PDF hoch.' : 'This portal blocks server imports. Upload its Exposé PDF instead.' }, 422);
    if (!response.ok) return respond({ error: de ? 'Das Angebot ist nicht mehr verfügbar oder konnte nicht geöffnet werden.' : 'This listing is no longer available or could not be opened.' }, 422);
    text = await response.text();
    source = url.toString();
  }
  if (text.length < 150 || !looksLikeListing(text)) return respond({ error: de ? 'Das sieht nicht nach einem Immobilienangebot oder einem durchsuchbaren Exposé aus.' : 'This does not look like a real-estate listing or a text-searchable Exposé.' }, 422);
  const baseReport = deterministicAssessment(text, source);
  if (!resolveLocation(baseReport).city) return respond({ error: de ? 'Im Angebot fehlt eine verlässliche Stadtangabe. Ohne belegbare Lage erstellen wir keinen Bericht.' : 'The listing does not provide a reliable city. We will not create a location-based report without one.' }, 422);
  const fingerprint = canonicalSource(source).slice(0, 500);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${fingerprint}\n${source.startsWith('http') ? '' : text}`));
  const stableId = [...new Uint8Array(digest)].slice(0, 8).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const existingById = await findReport(stableId);
  if (existingById) {
    const user = await sessionUser(request);
    await rememberUserReport(user?.id, existingById.id);
    return respond(existingById);
  }
  const allowance = await reserveReportAllowance(request, anonymous.token);
  if (!allowance.allowed) return respond({
    error: de ? 'Du hast deine zwei kostenlosen Berichte für heute genutzt.' : 'You have used your two free reports for today.',
    code: 'quota_exceeded',
    access: allowance.state,
  }, 402);
  const report = { ...baseReport, id: stableId, offerQuestions: defaultOfferQuestions(baseReport) };
  try {
    await saveReport(report);
    await rememberUserReport(allowance.userId, report.id);
    return respond({ ...report, access: allowance.state }, 201);
  } catch (error) {
    await allowance.release?.();
    throw error;
  }
}
