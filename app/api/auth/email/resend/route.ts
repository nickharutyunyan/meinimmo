import { NextRequest } from 'next/server';
import { handleBeginEmail } from '@/lib/identity/email-route';

export async function POST(request: NextRequest) {
  return handleBeginEmail(request, 'verify_email');
}
