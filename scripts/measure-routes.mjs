import { spawnSync } from 'node:child_process';

const base = (process.env.MEASURE_BASE || 'http://127.0.0.1:8787').replace(/\/$/, '');
const reportId = process.env.MEASURE_REPORT_ID || '59531030123f2eba';
const repeats = Number(process.env.MEASURE_REPEATS || 5);
const routes = [
  '/',
  '/de',
  '/guide',
  '/guide/berlin-with-children',
  '/de/guide',
  '/terms',
  '/de/terms',
  '/sitemap.xml',
  '/robots.txt',
  '/account',
  `/r/${reportId}`,
  `/de/r/${reportId}`,
  `/r/${reportId}/print`,
];

function sample(route) {
  const result = spawnSync('curl', [
    '-sS', '-D', '-', '-o', '/dev/null',
    '-w', '\n__METRIC__ %{http_code} %{time_starttransfer}',
    '--max-time', '40',
    `${base}${route}`,
  ], { encoding: 'utf8' });
  const text = `${result.stdout || ''}`;
  const metric = text.split('\n').filter(line => line.startsWith('__METRIC__')).at(-1);
  if (!metric) return { code: 'err', ms: null, path: '', cache: '' };
  const [, code, seconds] = metric.split(/\s+/);
  const header = (name) => {
    const line = text.split('\n').find(item => item.toLowerCase().startsWith(name));
    return line ? line.split(':').slice(1).join(':').trim() : '';
  };
  return {
    code,
    ms: Math.round(Number(seconds) * 1000 * 10) / 10,
    path: header('x-worker-path:'),
    cache: header('x-report-cache:'),
  };
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2 * 10) / 10;
}

console.log(`Wall time against ${base}. wrangler dev does not print Workers CPU; this is time to first byte.`);
console.log('| Route | Median ms | Min ms | Codes | x-worker-path | x-report-cache |');
console.log('| --- | ---: | ---: | --- | --- | --- |');
for (const route of routes) {
  const samples = Array.from({ length: repeats }, () => sample(route));
  const times = samples.map(item => item.ms).filter(item => item !== null);
  const last = samples.at(-1);
  console.log(`| \`${route}\` | ${times.length ? median(times) : ''} | ${times.length ? Math.min(...times) : ''} | ${samples.map(item => item.code).join(', ')} | ${last?.path || ''} | ${last?.cache || ''} |`);
}
