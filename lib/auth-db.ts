import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { withTimeout } from './io-timeout.ts';

export type AppEnv = CloudflareEnv & {
  AUTH_DB: D1Database;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_DAY_PASS?: string;
  STRIPE_PRICE_PRO?: string;
  STRIPE_PRICE_ULTRA?: string;
  PAYMENTS_ENABLED?: string;
  PAID_PLANS_ENABLED?: string;
  REPORT_LIMITS_ENABLED?: string;
  RESEND_API_KEY?: string;
  PASSWORD_RESET_FROM?: string;
  TYPESAFE_API_KEY?: string;
  JEV_MODEL?: string;
  BACKFILL_TOKEN?: string;
  BACKFILL_BATCH_SIZE?: string;
};

export async function appEnvironment() {
  const { env } = await withTimeout(getCloudflareContext({ async: true }));
  return env as AppEnv;
}

export async function authDatabase() {
  const env = await appEnvironment();
  if (!env.AUTH_DB) throw new Error('The Cloudflare D1 binding "AUTH_DB" is not configured.');
  return env.AUTH_DB;
}

export type UserRow = {
  id: string;
  username: string | null;
  email: string | null;
  display_name: string | null;
  stripe_customer_id: string | null;
  created_at: string;
  email_verified_at?: string | null;
};

export type SessionUser = {
  id: string;
  username: string | null;
  email: string | null;
  name: string | null;
  stripeCustomerId: string | null;
  emailVerified: boolean;
};

export function publicUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    name: row.display_name,
    stripeCustomerId: row.stripe_customer_id,
    emailVerified: Boolean(row.email_verified_at),
  };
}
