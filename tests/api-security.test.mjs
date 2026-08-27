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
