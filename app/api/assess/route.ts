import { NextRequest, NextResponse } from 'next/server';
import { deterministicAssessment, enrichOnlyWhenNeeded, looksLikeListing } from '@/lib/assessment';
import { saveReport } from '@/lib/store';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  const input = await request.json() as { url?: string; text?: string; name?: string }; let text = input.text || ''; let source = input.name || 'PDF Exposé';
  if (input.url) { let url: URL; try { url = new URL(input.url); } catch { return NextResponse.json({ error: 'Enter a valid public listing URL.' }, { status: 400 }); } if (!['http:','https:'].includes(url.protocol) || ['localhost','127.0.0.1'].includes(url.hostname)) return NextResponse.json({ error: 'Enter a public listing URL.' }, { status: 400 }); const response = await fetch(url, { headers: { 'user-agent': 'Habitat/1.0 (+property assessment)' }, redirect: 'follow' }); if ([401,403].includes(response.status)) return NextResponse.json({ error: 'This portal blocks server imports. Upload its Exposé PDF instead.' }, { status: 422 }); if (!response.ok) return NextResponse.json({ error: 'This listing is no longer available or could not be opened.' }, { status: 422 }); text = await response.text(); source = url.toString(); }
  if (text.length < 150 || !looksLikeListing(text)) return NextResponse.json({ error: 'This does not look like a real-estate listing or a text-searchable Exposé.' }, { status: 422 });
  const report = await enrichOnlyWhenNeeded(deterministicAssessment(text, source), text); await saveReport(report); return NextResponse.json(report, { status: 201 });
}
