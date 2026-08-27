import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('the report collection cannot enumerate globally saved reports', async () => {
  const route = await source('app/api/reports/route.ts');
  assert.match(route, /searchParams\.get\('ids'\)/);
  assert.doesNotMatch(route, /\breports\s*\(/);
});

test('state-changing public product routes require a same-origin request', async () => {
  for (const path of [
    'app/api/assess/route.ts',
    'app/api/comparisons/route.ts',
    'app/api/reports/[id]/questions/route.ts',
  ]) {
    const route = await source(path);
    assert.match(route, /requireSameOrigin\(request\)/, path);
  }
});

test('password recovery endpoints require same-origin requests and never disclose whether an account exists', async () => {
  const forgot = await source('app/api/auth/password/forgot/route.ts');
  const reset = await source('app/api/auth/password/reset/route.ts');
  assert.match(forgot, /requireSameOrigin\(request\)/);
  assert.match(reset, /requireSameOrigin\(request\)/);
  assert.match(forgot, /If this account has a recovery email/);
  assert.match(forgot, /authRateLimited/);
  assert.match(reset, /authRateLimited/);
  assert.match(reset, /attachSession/);
});
