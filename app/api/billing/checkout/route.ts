import { NextRequest, NextResponse } from 'next/server';
import { accessState } from '@/lib/access';
import { canOfferDayPass } from '@/lib/day-pass';
import { requireSameOrigin, sessionUser } from '@/lib/auth';
import { appEnvironment, authDatabase, type SessionUser } from '@/lib/auth-db';
import { billingAvailability } from '@/lib/billing-config';
import { subscriptionCheckoutConflict } from '@/lib/subscription-guard';
import { createCheckout, customerSubscriptionStatuses, type BillingPlan } from '@/lib/stripe';

function unavailable(locale?: 'en' | 'de') {
  return NextResponse.json({ error: locale === 'de' ? 'Die Zahlung ist gerade nicht verfügbar.' : 'Payments are not available right now.' }, { status: 503 });
}

async function subscriptionConflict(user: SessionUser): Promise<'ok' | 'blocked' | 'unavailable'> {
  const local = await (await authDatabase()).prepare('SELECT status FROM subscriptions WHERE user_id = ?1').bind(user.id).first<{ status: string }>();
  let stripeStatuses: string[] = [];
  if (user.stripeCustomerId) {
    try {
      stripeStatuses = await customerSubscriptionStatuses(user.stripeCustomerId);
    } catch (error) {
      const stripeError = error as { code?: string };
      if (stripeError.code === 'resource_missing') stripeStatuses = [];
      else if (!subscriptionCheckoutConflict({ localStatus: local?.status, stripeStatuses: [] }).blocked) {
        console.error('Could not look up existing Stripe subscriptions', error);
        return 'unavailable';
      }
    }
  }
  return subscriptionCheckoutConflict({ localStatus: local?.status, stripeStatuses }).blocked ? 'blocked' : 'ok';
}

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const user = await sessionUser(request);
  if (!user) return NextResponse.json({ error: 'Sign in required.', code: 'auth_required' }, { status: 401 });
  const input = await request.json() as { plan?: BillingPlan; locale?: 'en' | 'de' };
  if (!input.plan || !['day_pass', 'pro', 'ultra'].includes(input.plan)) return NextResponse.json({ error: 'Unknown plan.' }, { status: 400 });
  const billing = billingAvailability(await appEnvironment());
  if (!billing.plansEnabled) {
    return NextResponse.json({
      error: input.locale === 'de' ? 'Bezahlpakete sind gerade nicht verfügbar. Berichte bleiben kostenlos.' : 'Paid plans are not available right now. Reports stay free.',
      code: 'plans_hidden',
    }, { status: 403 });
  }
  const configured = input.plan === 'day_pass' ? billing.dayPass : billing.subscriptions;
  if (!configured) return unavailable(input.locale);
  const access = await accessState(request);
  if (input.plan === 'day_pass' && !canOfferDayPass(access)) return NextResponse.json({ error: input.locale === 'de' ? 'Der Tagespass ist erst verfügbar, nachdem beide kostenlosen Berichte genutzt wurden.' : 'The day pass is only available after both free reports have been used.' }, { status: 409 });
  if (input.plan !== 'day_pass') {
    const conflict = await subscriptionConflict(user);
    if (conflict === 'unavailable') return unavailable(input.locale);
    if (conflict === 'blocked') {
      return NextResponse.json({
        error: input.locale === 'de' ? 'Du hast bereits ein Abo. Verwalte es in deinem Konto, statt ein zweites abzuschließen.' : 'You already have a subscription. Manage it from your account instead of starting another one.',
        code: 'subscription_exists',
      }, { status: 409 });
    }
  }
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
    return unavailable(input.locale);
  }
}
