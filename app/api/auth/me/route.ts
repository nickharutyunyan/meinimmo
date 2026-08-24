import { NextRequest, NextResponse } from 'next/server';
import { accessState, userReportIds } from '@/lib/access';
import { sessionUser } from '@/lib/auth';
import { appEnvironment } from '@/lib/auth-db';

export async function GET(request: NextRequest) {
  const user = await sessionUser(request);
  const access = await accessState(request);
  const env = await appEnvironment();
  return NextResponse.json({
    user: user ? { username: user.username, email: user.email, name: user.name } : null,
    access,
    reportIds: user ? await userReportIds(user.id) : [],
    googleAvailable: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    billingAvailable: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_PRO && env.STRIPE_PRICE_ULTRA),
  });
}
