import { NextRequest } from 'next/server';
import { handleInspectEmail } from '@/lib/identity/email-route';

export async function POST(request: NextRequest) {
  return handleInspectEmail(request);
}
