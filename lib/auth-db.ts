import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export type AppEnv = CloudflareEnv & {
  AUTH_DB: D1Database;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_PRO?: string;
  STRIPE_PRICE_ULTRA?: string;
  REPORT_LIMITS_ENABLED?: string;
};

export async function appEnvironment() {
  const { env } = await getCloudflareContext({ async: true });
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
};

export type SessionUser = {
  id: string;
  username: string | null;
  email: string | null;
  name: string | null;
  stripeCustomerId: string | null;
};

export function publicUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    name: row.display_name,
    stripeCustomerId: row.stripe_customer_id,
  };
}
