import { NextRequest, NextResponse } from 'next/server';
import { accessState } from '@/lib/access';
import { canOfferDayPass } from '@/lib/day-pass';
import { requireSameOrigin, sessionUser } from '@/lib/auth';
import { createCheckout, type BillingPlan } from '@/lib/stripe';
import { appEnvironment } from '@/lib/auth-db';
import { billingAvailability } from '@/lib/billing-config';

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const user = await sessionUser(request);
  if (!user) return NextResponse.json({ error: 'Sign in required.', code: 'auth_required' }, { status: 401 });
  const input = await request.json() as { plan?: BillingPlan; locale?: 'en' | 'de' };
  if (!input.plan || !['day_pass', 'pro', 'ultra'].includes(input.plan)) return NextResponse.json({ error: 'Unknown plan.' }, { status: 400 });
  const billing = billingAvailability(await appEnvironment());
  const configured = input.plan === 'day_pass' ? billing.dayPass : billing.subscriptions;
  if (!configured) return NextResponse.json({ error: input.locale === 'de' ? 'Die Zahlung ist gerade nicht verfügbar.' : 'Payments are not available right now.' }, { status: 503 });
  const access = await accessState(request);
  if (input.plan === 'day_pass' && !canOfferDayPass(access)) return NextResponse.json({ error: input.locale === 'de' ? 'Der Tagespass ist erst verfügbar, nachdem beide kostenlosen Berichte genutzt wurden.' : 'The day pass is only available after both free reports have been used.' }, { status: 409 });
  if (input.plan !== 'day_pass' && (access.kind === 'pro' || access.kind === 'ultra')) return NextResponse.json({ error: 'Manage the current subscription from your account.' }, { status: 409 });
  try {
    const checkout = await createCheckout(user, input.plan, request.nextUrl.origin, input.locale === 'de' ? 'de' : 'en');
    if (!checkout.url) throw new Error('missing_checkout_url');
    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    const stripeError = error as { name?: string; message?: string; code?: string; param?: string; statusCode?: number; requestId?: string };
    console.error('Stripe Checkout could not be created', {
      name: stripeError.name,
      message: stripeError.message,
      code: stripeError.code,
      param: stripeError.param,
      statusCode: stripeError.statusCode,
      requestId: stripeError.requestId,
    });
    return NextResponse.json({ error: input.locale === 'de' ? 'Die Zahlung ist gerade nicht verfügbar.' : 'Payments are not available right now.' }, { status: 503 });
  }
}
