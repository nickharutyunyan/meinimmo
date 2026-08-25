import 'server-only';
import Stripe from 'stripe';
import { appEnvironment, authDatabase, type SessionUser } from './auth-db';

export type BillingPlan = 'day_pass' | 'pro' | 'ultra';

function integrationIdentifier() {
  const randomBytes = crypto.getRandomValues(new Uint8Array(8));
  const suffix = Array.from(randomBytes, byte => String.fromCharCode(97 + (byte % 26))).join('');
  return `review_a_house_${suffix}`;
}

async function stripeClient() {
  const env = await appEnvironment();
  if (!env.STRIPE_SECRET_KEY) throw new Error('stripe_not_configured');
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-07-29.dahlia',
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 2,
  });
}

export async function createCheckout(user: SessionUser, plan: BillingPlan, origin: string, locale: 'en' | 'de') {
  const env = await appEnvironment();
  const price = plan === 'pro' ? env.STRIPE_PRICE_PRO : plan === 'ultra' ? env.STRIPE_PRICE_ULTRA : undefined;
  if (plan !== 'day_pass' && !price) throw new Error('stripe_price_not_configured');
  const prefix = locale === 'de' ? '/de' : '';
  const subscription = plan !== 'day_pass';
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: subscription ? 'subscription' : 'payment',
    integration_identifier: integrationIdentifier(),
    success_url: `${origin}${prefix}/account?payment=success`,
    cancel_url: `${origin}${prefix}/account?payment=cancelled`,
    client_reference_id: user.id,
    locale,
    line_items: subscription
      ? [{ price, quantity: 1 }]
      : [{ price_data: { currency: 'eur', unit_amount: 500, product_data: { name: locale === 'de' ? 'Review a House Tagespass' : 'Review a House one-day pass' } }, quantity: 1 }],
    metadata: { user_id: user.id, plan },
    ...(subscription ? {
      allow_promotion_codes: true,
      subscription_data: { metadata: { user_id: user.id, plan } },
    } : { customer_creation: 'always' as const }),
    ...(user.stripeCustomerId ? { customer: user.stripeCustomerId } : user.email ? { customer_email: user.email } : {}),
  };
  return (await stripeClient()).checkout.sessions.create(params, { idempotencyKey: `checkout_${user.id}_${plan}_${crypto.randomUUID()}` });
}

export async function createBillingPortal(user: SessionUser, origin: string, locale: 'en' | 'de') {
  if (!user.stripeCustomerId) throw new Error('no_stripe_customer');
  const prefix = locale === 'de' ? '/de' : '';
  return (await stripeClient()).billingPortal.sessions.create({ customer: user.stripeCustomerId, return_url: `${origin}${prefix}/account`, locale });
}

function subscriptionEnd(subscription: Stripe.Subscription) {
  const seconds = subscription.items.data[0]?.current_period_end;
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

function subscriptionPlan(subscription: Stripe.Subscription, env: Awaited<ReturnType<typeof appEnvironment>>) {
  const metadataPlan = subscription.metadata?.plan;
  if (metadataPlan === 'pro' || metadataPlan === 'ultra') return metadataPlan;
  const priceId = subscription.items.data[0]?.price?.id;
  return priceId && priceId === env.STRIPE_PRICE_ULTRA ? 'ultra' : 'pro';
}

async function saveSubscription(subscription: Stripe.Subscription) {
  const env = await appEnvironment();
  const userId = subscription.metadata?.user_id;
  if (!userId) return;
  const customer = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const db = await authDatabase();
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`
      INSERT INTO subscriptions (user_id, plan, stripe_subscription_id, status, current_period_end, cancel_at_period_end, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
      ON CONFLICT(user_id) DO UPDATE SET plan = excluded.plan, stripe_subscription_id = excluded.stripe_subscription_id,
        status = excluded.status, current_period_end = excluded.current_period_end,
        cancel_at_period_end = excluded.cancel_at_period_end, updated_at = excluded.updated_at
    `).bind(userId, subscriptionPlan(subscription, env), subscription.id, subscription.status, subscriptionEnd(subscription), subscription.cancel_at_period_end ? 1 : 0, now),
    db.prepare('UPDATE users SET stripe_customer_id = ?1, updated_at = ?2 WHERE id = ?3').bind(customer, now, userId),
  ]);
}

export async function processStripeEvent(event: Stripe.Event) {
  const db = await authDatabase();
  const alreadyProcessed = await db.prepare('SELECT id FROM stripe_events WHERE id = ?1').bind(event.id).first();
  if (alreadyProcessed) return;

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object;
    const userId = session.client_reference_id || session.metadata?.user_id;
    const customer = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    if (userId && customer) await db.prepare('UPDATE users SET stripe_customer_id = ?1, updated_at = ?2 WHERE id = ?3').bind(customer, new Date().toISOString(), userId).run();
    if (userId && session.metadata?.plan === 'day_pass' && session.payment_status === 'paid' && session.amount_total === 500 && session.currency === 'eur') {
      const startsAt = new Date();
      const expiresAt = new Date(startsAt.getTime() + 24 * 60 * 60 * 1000);
      await db.prepare(`
        INSERT OR IGNORE INTO day_passes (id, user_id, stripe_checkout_session_id, starts_at, expires_at, report_limit, reports_used, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5, 50, 0, ?4)
      `).bind(crypto.randomUUID(), userId, session.id, startsAt.toISOString(), expiresAt.toISOString()).run();
    }
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    if (subscriptionId) await saveSubscription(await (await stripeClient()).subscriptions.retrieve(subscriptionId));
  }

  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    await saveSubscription(event.data.object);
  }

  await db.prepare('INSERT OR IGNORE INTO stripe_events (id, event_type, processed_at) VALUES (?1, ?2, ?3)').bind(event.id, event.type, new Date().toISOString()).run();
}
