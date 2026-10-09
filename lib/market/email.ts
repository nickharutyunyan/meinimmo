import 'server-only';
import { appEnvironment, authDatabase } from '../auth-db.ts';
import { deliverEmail } from '../email/deliver.ts';
import { reserveGlobalSend, reserveLinkAttempt } from '../identity/send-budget.ts';
import { listingCodeEmail } from './email-content.ts';


export type CodeDelivery = 'sent' | 'logged' | 'limited' | 'unavailable';

/**
 * Sends a listing verification code through the same budget as sign-in links:
 * five per address and twenty per connection an hour, and the global daily cap.
 * In local development without a mail key the code goes to the server log.
 */
export async function sendListingCode(input: { to: string; code: string; title: string; locale: 'en' | 'de'; ip: string; idempotencyKey: string }): Promise<CodeDelivery> {
  const env = await appEnvironment();
  const now = new Date().toISOString();
  const db = await authDatabase();
  if (await reserveLinkAttempt(db, input.to, input.ip, now) === 'limited') return 'limited';
  if (!env.RESEND_API_KEY || !env.PASSWORD_RESET_FROM) {
    if (env.NEXTJS_ENV === 'development') {
      console.info(`[listing email code] ${input.to}: ${input.code}`);
      return 'logged';
    }
    return 'unavailable';
  }
  if (await reserveGlobalSend(db, now) === 'capped') return 'limited';
  await deliverEmail({
    apiKey: env.RESEND_API_KEY,
    from: env.PASSWORD_RESET_FROM,
    to: input.to,
    idempotencyKey: `listing-code-${input.idempotencyKey}`,
    ...listingCodeEmail(input.code, input.title, input.locale),
  });
  return 'sent';
}
