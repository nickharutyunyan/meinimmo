import { NextRequest, NextResponse } from 'next/server';
import { requireSameOrigin, sessionUser, updateDisplayName } from '@/lib/auth';

export async function PATCH(request: NextRequest) {
  if (!requireSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const user = await sessionUser(request);
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const input = await request.json() as { name?: string };
  const name = await updateDisplayName(user.id, input.name || '');
  return NextResponse.json({ name });
}
