import { NextRequest, NextResponse } from 'next/server';
import { accessState } from '@/lib/access';
import { appEnvironment } from '@/lib/auth-db';
import { billingAvailability } from '@/lib/billing-config';

/** Quota and purchase flags for the sidebar and landing pages. Not the account profile. */
export async function GET(request: NextRequest) {
  const access = await accessState(request);
  const env = await appEnvironment();
  const billing = billingAvailability(env);
  const response = NextResponse.json({
    access,
    paidPlansEnabled: billing.plansEnabled,
    billingAvailable: billing.subscriptions,
    dayPassBillingAvailable: billing.dayPass,
    googleAvailable: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  });
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Vary', 'Cookie');
  return response;
}
