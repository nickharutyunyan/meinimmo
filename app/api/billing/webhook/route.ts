import { NextRequest, NextResponse } from 'next/server';
import { appEnvironment } from '@/lib/auth-db';
import { processStripeEvent } from '@/lib/stripe';
import { verifyStripeSignature } from '@/lib/security';

export async function POST(request: NextRequest) {
  const env = await appEnvironment();
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature') || '';
  if (!env.STRIPE_WEBHOOK_SECRET || !await verifyStripeSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }
  try {
    await processStripeEvent(JSON.parse(payload));
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook processing failed', error);
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
