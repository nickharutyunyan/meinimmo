import { after, NextRequest, NextResponse } from 'next/server';
import { defaultOfferQuestions, deterministicAssessment, enrichAssessment, looksLikeListing } from '@/lib/assessment';
import { report as findReport, replaceReport, saveReport } from '@/lib/store';
import { resolveLocation } from '@/lib/display';
import { rememberUserReport, reserveReportAllowance } from '@/lib/access';
import { anonymousToken, attachAnonymousCookie } from '@/lib/auth';
import { stableReportId } from '@/lib/report-id';
import { neighborhoodForPostalCode } from '@/lib/geocode';
import { refreshDerivedReport } from '@/lib/listing-parser';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const startedAt = performance.now();
  const timings = new Map<string, number>();
  const timed = async <T,>(name: string, task: () => Promise<T> | T) => {
    const started = performance.now();
    try { return await task(); } finally { timings.set(name, (timings.get(name) || 0) + performance.now() - started); }
  };
  const anonymous = anonymousToken(request);
  const respond = (body: unknown, status = 200) => {
    const response = NextResponse.json(body, { status });
    attachAnonymousCookie(response, request, anonymous);
    timings.set('total', performance.now() - startedAt);
    response.headers.set('Server-Timing', [...timings].map(([name, duration]) => `${name};dur=${duration.toFixed(1)}`).join(', '));
    return response;
  };
  const remember = (userId: string | undefined, id: string) => {
    if (userId) after(() => rememberUserReport(userId, id));
  };
  const verifyLater = (candidate: Awaited<ReturnType<typeof findReport>> & object, sourceText: string) => {
    after(async () => {
      try {
        let prepared = candidate;
        if (!prepared.facts.street && !prepared.facts.district && prepared.facts.postalCode) {
          const neighborhood = await neighborhoodForPostalCode(prepared.facts.postalCode, prepared.facts.city);
          if (neighborhood) {
            prepared = refreshDerivedReport({
              ...prepared,
              location: neighborhood,
              facts: { ...prepared.facts, district: neighborhood, locationPrecision: 'neighborhood' },
            });
            const latest = await findReport(prepared.id);
            await replaceReport({
              ...prepared,
              offerQuestions: latest?.offerQuestions || prepared.offerQuestions,
              offerQuestionsDe: latest?.offerQuestionsDe || prepared.offerQuestionsDe,
              aiEnriched: latest?.aiEnriched || prepared.aiEnriched,
            });
          }
        }
        const verified = await enrichAssessment(prepared, sourceText, true, 20_000);
        if (!verified.aiLocationChecked || !verified.aiFactChecked) return;
        const latest = await findReport(candidate.id);
        await replaceReport({
          ...verified,
          offerQuestions: latest?.offerQuestions || verified.offerQuestions,
          offerQuestionsDe: latest?.offerQuestionsDe || verified.offerQuestionsDe,
          aiEnriched: latest?.aiEnriched || verified.aiEnriched,
        });
      } catch (error) {
        console.warn('Background listing verification failed', { message: error instanceof Error ? error.message : 'unknown error' });
      }
    });
  };

  const input = await timed('input', () => request.json() as Promise<{ url?: string; text?: string; name?: string; locale?: 'en' | 'de' }>);
  const de = input.locale === 'de';
  const quotaExceeded = (state: Awaited<ReturnType<typeof reserveReportAllowance>>['state']) => respond({
    error: de ? 'Du hast dein Berichtslimit für diesen Zeitraum erreicht.' : 'You have reached your report limit for this period.',
    code: 'quota_exceeded',
    access: state,
  }, 402);

  let text = input.text || '';
  let source = input.name || 'PDF Exposé';
  let reportId: string | undefined;
  let existing: Awaited<ReturnType<typeof findReport>>;

  if (input.url) {
    let url: URL;
    try { url = new URL(input.url); } catch { return respond({ error: de ? 'Bitte gib einen gültigen öffentlichen Link ein.' : 'Enter a valid public listing URL.' }, 400); }
    if (!['http:', 'https:'].includes(url.protocol) || ['localhost', '127.0.0.1'].includes(url.hostname)) return respond({ error: de ? 'Bitte gib einen öffentlichen Link ein.' : 'Enter a public listing URL.' }, 400);
    source = url.toString();
    reportId = await timed('fingerprint', () => stableReportId(source));
    existing = await timed('cache', () => findReport(reportId!));
    if (existing?.aiLocationChecked && existing.aiFactChecked && resolveLocation(existing).basis !== 'none') {
      const allowance = await timed('quota', () => reserveReportAllowance(request, anonymous.token));
      if (!allowance.allowed) return quotaExceeded(allowance.state);
      remember(allowance.userId, existing.id);
      return respond({ ...existing, access: allowance.state });
    }
    const response = await timed('source', () => fetch(url, { headers: { 'user-agent': 'ReviewAHouse/1.0 (+property assessment)' }, redirect: 'follow' }));
    if ([401, 403].includes(response.status)) return respond({ error: de ? 'Dieses Portal blockiert den Import. Lade stattdessen das Exposé als PDF hoch.' : 'This portal blocks server imports. Upload its Exposé PDF instead.' }, 422);
    if (!response.ok) return respond({ error: de ? 'Das Angebot ist nicht mehr verfügbar oder konnte nicht geöffnet werden.' : 'This listing is no longer available or could not be opened.' }, 422);
    text = await timed('sourceBody', () => response.text());
  }

  const listingValid = await timed('validation', () => text.length >= 150 && looksLikeListing(text));
  if (!listingValid) return respond({ error: de ? 'Das sieht nicht nach einem Immobilienangebot oder einem durchsuchbaren Exposé aus.' : 'This does not look like a real-estate listing or a text-searchable Exposé.' }, 422);

  if (!reportId) reportId = await timed('fingerprint', () => stableReportId(source, text));
  if (!existing) existing = await timed('cache', () => findReport(reportId!));
  if (existing?.aiLocationChecked && existing.aiFactChecked && resolveLocation(existing).basis !== 'none') {
    const allowance = await timed('quota', () => reserveReportAllowance(request, anonymous.token));
    if (!allowance.allowed) return quotaExceeded(allowance.state);
    remember(allowance.userId, existing.id);
    return respond({ ...existing, access: allowance.state });
  }

  const allowance = await timed('quota', () => reserveReportAllowance(request, anonymous.token));
  if (!allowance.allowed) return quotaExceeded(allowance.state);
  const baseReport = await timed('parse', () => deterministicAssessment(text, source));
  const prepared = { ...baseReport, offerQuestions: defaultOfferQuestions(baseReport), offerQuestionsDe: defaultOfferQuestions(baseReport, 'de') };
  let report: NonNullable<Awaited<ReturnType<typeof findReport>>> = existing
    ? { ...prepared, id: existing.id, createdAt: existing.createdAt }
    : { ...prepared, id: reportId };

  if (resolveLocation(report).basis === 'none') {
    report = await timed('aiLocationFallback', () => enrichAssessment(report, text));
    if (resolveLocation(report).basis === 'none') {
      await timed('quotaRelease', () => allowance.release?.());
      return respond({ error: de ? 'Im Angebot fehlt eine verlässliche Lageangabe. Ohne belegbare Lage erstellen wir keinen Bericht.' : 'The listing does not provide a reliable location. We will not create a report without one.' }, 422);
    }
  }

  try {
    await timed('store', () => existing ? replaceReport(report) : saveReport(report));
    if (!report.aiLocationChecked || !report.aiFactChecked) verifyLater(report, text);
    remember(allowance.userId, report.id);
    return respond({ ...report, access: allowance.state }, existing ? 200 : 201);
  } catch (error) {
    await timed('quotaRelease', () => allowance.release?.());
    throw error;
  }
}
