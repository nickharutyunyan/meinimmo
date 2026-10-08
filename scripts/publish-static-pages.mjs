import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { applyDocumentLanguage, cacheFileToAssetPath, pathnameForPublishedAsset } from '../cloudflare/routes.mjs';
import { staticAssetHeadersFile } from '../lib/security-headers.ts';

export function publishedBody(cache) {
  if (cache && typeof cache.html === 'string') return { body: cache.html, contentType: 'text/html; charset=utf-8' };
  if (cache && typeof cache.body === 'string') {
    const header = cache.meta?.headers?.['content-type'];
    return { body: cache.body, contentType: typeof header === 'string' ? header : 'text/plain; charset=utf-8' };
  }
  return null;
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (entry.name.endsWith('.cache')) files.push(full);
  }
  return files;
}

/** Stamp the Next build id into the module the report-cache key imports. */
export async function writeReportCacheBuildId(buildIdPath, destination) {
  const id = (await readFile(buildIdPath, 'utf8')).trim();
  if (!id || /[\s"'\\]/.test(id)) throw new Error(`Refusing report cache build id ${JSON.stringify(id)}`);
  await writeFile(destination, `export const REPORT_CACHE_BUILD_ID = ${JSON.stringify(id)};\n`);
  return id;
}

/** Write the Cloudflare `_headers` file next to the static assets. */
export async function writeStaticAssetHeaders(assetDir, contents = staticAssetHeadersFile()) {
  await mkdir(assetDir, { recursive: true });
  const destination = path.join(assetDir, '_headers');
  await writeFile(destination, contents);
  return destination;
}

export async function publishStaticPages(cacheDir, assetDir) {
  const builds = [];
  for (const entry of await readdir(cacheDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(cacheDir, entry.name);
    builds.push({ full, mtime: (await stat(full)).mtimeMs });
  }
  builds.sort((left, right) => right.mtime - left.mtime);
  if (!builds[0]) return [];
  const written = [];
  for (const file of await walk(builds[0].full)) {
    const cacheRelative = path.relative(builds[0].full, file);
    const assetRelative = cacheFileToAssetPath(cacheRelative);
    if (!assetRelative) continue;
    const published = publishedBody(JSON.parse(await readFile(file, 'utf8')));
    if (!published) continue;
    const body = published.contentType.includes('text/html')
      ? applyDocumentLanguage(published.body, pathnameForPublishedAsset(assetRelative))
      : published.body;
    const destination = path.join(assetDir, assetRelative);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, body);
    written.push(assetRelative);
  }
  return written;
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  const root = path.resolve(path.dirname(path.resolve(process.argv[1])), '..');
  const assetDir = path.join(root, '.open-next/assets');
  await writeStaticAssetHeaders(assetDir);
  const written = await publishStaticPages(path.join(root, '.open-next/cache'), assetDir);
  const buildId = await writeReportCacheBuildId(path.join(root, '.next/BUILD_ID'), path.join(root, 'cloudflare/build-id.mjs'));
  console.log(`Published ${written.length} prerendered pages into .open-next/assets`);
  console.log('Wrote .open-next/assets/_headers');
  console.log(`Report cache build id ${buildId}`);
}
