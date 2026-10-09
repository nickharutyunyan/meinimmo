import { NextRequest } from 'next/server';
import { handleVerifyEmail } from '@/lib/identity/email-route';

export async function POST(request: NextRequest) {
  return handleVerifyEmail(request);
}
