import { NextRequest, NextResponse } from 'next/server';
import { accessState, userReportIds } from '@/lib/access';
import { sessionUser } from '@/lib/auth';
import { appEnvironment, authDatabase } from '@/lib/auth-db';

export async function GET(request: NextRequest) {
  const user = await sessionUser(request);
  const access = await accessState(request);
  const env = await appEnvironment();
  const subscription = user ? await (await authDatabase()).prepare(`
    SELECT plan, status, current_period_end, cancel_at_period_end
    FROM subscriptions WHERE user_id = ?1
  `).bind(user.id).first<{
    plan: 'pro' | 'ultra';
    status: string;
    current_period_end: string | null;
    cancel_at_period_end: number;
  }>() : null;
  const response = NextResponse.json({
    user: user ? { username: user.username, email: user.email, name: user.name } : null,
    access,
    subscription: subscription ? {
      plan: subscription.plan,
      status: subscription.status,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    } : null,
    reportIds: user ? await userReportIds(user.id) : [],
    googleAvailable: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    billingAvailable: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_DAY_PASS && env.STRIPE_PRICE_PRO && env.STRIPE_PRICE_ULTRA),
  });
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}
