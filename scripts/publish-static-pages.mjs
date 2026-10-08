import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { cacheFileToAssetPath } from '../cloudflare/routes.mjs';

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
    const destination = path.join(assetDir, assetRelative);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, published.body);
    written.push(assetRelative);
  }
  return written;
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  const root = path.resolve(path.dirname(path.resolve(process.argv[1])), '..');
  const written = await publishStaticPages(path.join(root, '.open-next/cache'), path.join(root, '.open-next/assets'));
  console.log(`Published ${written.length} prerendered pages into .open-next/assets`);
}
