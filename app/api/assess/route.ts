import { NextRequest, NextResponse } from 'next/server';
import { defaultOfferQuestions, deterministicAssessment, looksLikeListing } from '@/lib/assessment';
import { report as findReport, reportBySource, saveReport } from '@/lib/store';
import { canonicalSource, resolveLocation } from '@/lib/display';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  const input = await request.json() as { url?: string; text?: string; name?: string; locale?: 'en' | 'de' };
  const de = input.locale === 'de';
  let text = input.text || '';
  let source = input.name || 'PDF Exposé';
  if (input.url) {
    let url: URL;
    try { url = new URL(input.url); } catch { return NextResponse.json({ error: de ? 'Bitte gib einen gültigen öffentlichen Link ein.' : 'Enter a valid public listing URL.' }, { status: 400 }); }
    if (!['http:', 'https:'].includes(url.protocol) || ['localhost', '127.0.0.1'].includes(url.hostname)) return NextResponse.json({ error: de ? 'Bitte gib einen öffentlichen Link ein.' : 'Enter a public listing URL.' }, { status: 400 });
    const existing = await reportBySource(url.toString());
    if (existing) return NextResponse.json(existing, { status: 200 });
    const response = await fetch(url, { headers: { 'user-agent': 'ReviewAHouse/1.0 (+property assessment)' }, redirect: 'follow' });
    if ([401, 403].includes(response.status)) return NextResponse.json({ error: de ? 'Dieses Portal blockiert den Import. Lade stattdessen das Exposé als PDF hoch.' : 'This portal blocks server imports. Upload its Exposé PDF instead.' }, { status: 422 });
    if (!response.ok) return NextResponse.json({ error: de ? 'Das Angebot ist nicht mehr verfügbar oder konnte nicht geöffnet werden.' : 'This listing is no longer available or could not be opened.' }, { status: 422 });
    text = await response.text();
    source = url.toString();
  }
  if (text.length < 150 || !looksLikeListing(text)) return NextResponse.json({ error: de ? 'Das sieht nicht nach einem Immobilienangebot oder einem durchsuchbaren Exposé aus.' : 'This does not look like a real-estate listing or a text-searchable Exposé.' }, { status: 422 });
  const baseReport = deterministicAssessment(text, source);
  if (!resolveLocation(baseReport).city) return NextResponse.json({ error: de ? 'Im Angebot fehlt eine verlässliche Stadtangabe. Ohne belegbare Lage erstellen wir keinen Bericht.' : 'The listing does not provide a reliable city. We will not create a location-based report without one.' }, { status: 422 });
  const fingerprint = canonicalSource(source).slice(0, 500);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${fingerprint}\n${source.startsWith('http') ? '' : text}`));
  const stableId = [...new Uint8Array(digest)].slice(0, 8).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const existingById = await findReport(stableId);
  if (existingById) return NextResponse.json(existingById, { status: 200 });
  const report = { ...baseReport, id: stableId, offerQuestions: defaultOfferQuestions(baseReport) };
  await saveReport(report);
  return NextResponse.json(report, { status: 201 });
}
