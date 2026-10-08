import { backfillAuthorized } from '../lib/report-backfill.ts';

/** Reject a backfill call before Next loads the parser. Uses the shared constant-time compare. */
export function backfillRejection(request, token) {
  if (request.method !== 'POST') return null;
  const pathname = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
  if (pathname !== '/api/reports/backfill') return null;
  if (backfillAuthorized(request.headers.get('authorization'), token)) return null;
  return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
    status: 401,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      'x-worker-path': 'backfill-auth',
    },
  });
}
