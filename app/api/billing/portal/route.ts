import { NextRequest, NextResponse } from 'next/server';
import { requireSameOrigin, sessionUser } from '@/lib/auth';
import { createBillingPortal } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const user = await sessionUser(request);
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const input = await request.json() as { locale?: 'en' | 'de' };
  try {
    const portal = await createBillingPortal(user, request.nextUrl.origin, input.locale === 'de' ? 'de' : 'en');
    return NextResponse.json({ url: portal.url });
  } catch {
    return NextResponse.json({ error: input.locale === 'de' ? 'Das Zahlungsportal ist gerade nicht verfügbar.' : 'The billing portal is not available right now.' }, { status: 503 });
  }
}
