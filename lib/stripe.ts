import 'server-only';
import { appEnvironment, authDatabase, type SessionUser } from './auth-db';

export type BillingPlan = 'day_pass' | 'pro' | 'ultra';

type StripeCheckoutSession = {
  id: string;
  url?: string;
  customer?: string | null;
  subscription?: string | null;
  payment_status?: string;
  client_reference_id?: string | null;
  metadata?: Record<string, string>;
};

type StripeSubscription = {
  id: string;
  customer: string;
  status: string;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  metadata?: Record<string, string>;
  items?: { data?: Array<{ current_period_end?: number; price?: { id?: string } }> };
};

export type StripeEvent = { id: string; type: string; data: { object: Record<string, unknown> } };

async function stripeRequest<T>(path: string, options: { method?: 'GET' | 'POST'; body?: URLSearchParams } = {}) {
  const env = await appEnvironment();
  if (!env.STRIPE_SECRET_KEY) throw new Error('stripe_not_configured');
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: options.method || 'GET',
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, ...(options.body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
    body: options.body,
  });
  const data = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message || 'Stripe request failed.');
  return data;
}

export async function createCheckout(user: SessionUser, plan: BillingPlan, origin: string, locale: 'en' | 'de') {
  const env = await appEnvironment();
  const price = plan === 'day_pass' ? env.STRIPE_PRICE_DAY_PASS : plan === 'pro' ? env.STRIPE_PRICE_PRO : env.STRIPE_PRICE_ULTRA;
  if (!price) throw new Error('stripe_price_not_configured');
  const prefix = locale === 'de' ? '/de' : '';
  const body = new URLSearchParams({
    mode: plan === 'day_pass' ? 'payment' : 'subscription',
    success_url: `${origin}${prefix}/account?payment=success`,
    cancel_url: `${origin}${prefix}/account?payment=cancelled`,
    client_reference_id: user.id,
    'line_items[0][price]': price,
    'line_items[0][quantity]': '1',
    'metadata[user_id]': user.id,
    'metadata[plan]': plan,
  });
  if (plan !== 'day_pass') {
    body.set('subscription_data[metadata][user_id]', user.id);
    body.set('subscription_data[metadata][plan]', plan);
    body.set('allow_promotion_codes', 'true');
  }
  if (user.stripeCustomerId) body.set('customer', user.stripeCustomerId);
  else {
    if (user.email) body.set('customer_email', user.email);
    if (plan === 'day_pass') body.set('customer_creation', 'always');
  }
  return stripeRequest<StripeCheckoutSession>('checkout/sessions', { method: 'POST', body });
}

export async function createBillingPortal(user: SessionUser, origin: string, locale: 'en' | 'de') {
  if (!user.stripeCustomerId) throw new Error('no_stripe_customer');
  const prefix = locale === 'de' ? '/de' : '';
  const body = new URLSearchParams({ customer: user.stripeCustomerId, return_url: `${origin}${prefix}/account` });
  return stripeRequest<{ url: string }>('billing_portal/sessions', { method: 'POST', body });
}

async function retrieveSubscription(id: string) {
  return stripeRequest<StripeSubscription>(`subscriptions/${encodeURIComponent(id)}`);
}

function subscriptionEnd(subscription: StripeSubscription) {
  const seconds = subscription.current_period_end || subscription.items?.data?.[0]?.current_period_end;
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

function subscriptionPlan(subscription: StripeSubscription, env: Awaited<ReturnType<typeof appEnvironment>>) {
  const metadataPlan = subscription.metadata?.plan;
  if (metadataPlan === 'pro' || metadataPlan === 'ultra') return metadataPlan;
  const priceId = subscription.items?.data?.[0]?.price?.id;
  if (priceId && priceId === env.STRIPE_PRICE_ULTRA) return 'ultra';
  return 'pro';
}

async function saveSubscription(subscription: StripeSubscription) {
  const env = await appEnvironment();
  const userId = subscription.metadata?.user_id;
  if (!userId) return;
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
    db.prepare('UPDATE users SET stripe_customer_id = ?1, updated_at = ?2 WHERE id = ?3').bind(subscription.customer, now, userId),
  ]);
}

export async function processStripeEvent(event: StripeEvent) {
  const db = await authDatabase();
  const alreadyProcessed = await db.prepare('SELECT id FROM stripe_events WHERE id = ?1').bind(event.id).first();
  if (alreadyProcessed) return;

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as StripeCheckoutSession;
    const userId = session.client_reference_id || session.metadata?.user_id;
    const plan = session.metadata?.plan;
    if (userId && session.customer) {
      await db.prepare('UPDATE users SET stripe_customer_id = ?1, updated_at = ?2 WHERE id = ?3').bind(session.customer, new Date().toISOString(), userId).run();
    }
    if (userId && plan === 'day_pass' && session.payment_status === 'paid') {
      const startsAt = new Date();
      const expiresAt = new Date(startsAt.getTime() + 24 * 60 * 60 * 1000);
      await db.prepare(`
        INSERT OR IGNORE INTO day_passes (id, user_id, stripe_checkout_session_id, starts_at, expires_at, report_limit, reports_used, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5, 50, 0, ?4)
      `).bind(crypto.randomUUID(), userId, session.id, startsAt.toISOString(), expiresAt.toISOString()).run();
    }
    if (session.subscription) await saveSubscription(await retrieveSubscription(session.subscription));
  }

  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    await saveSubscription(event.data.object as StripeSubscription);
  }

  await db.prepare('INSERT OR IGNORE INTO stripe_events (id, event_type, processed_at) VALUES (?1, ?2, ?3)')
    .bind(event.id, event.type, new Date().toISOString()).run();
}
