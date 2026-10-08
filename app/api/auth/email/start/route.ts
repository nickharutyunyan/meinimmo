import { NextRequest } from 'next/server';
import { handleBeginEmail } from '@/lib/identity/email-route';

export async function POST(request: NextRequest) {
  return handleBeginEmail(request, 'sign_in');
}
