import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(root, 'extensions/reviewahouse');
const outputPath = join(root, 'public/downloads/reviewahouse-helper.zip');

/** Flat archive: Chrome loads these from the unzipped folder root. */
export const helperFiles = [
  'manifest.json',
  'background.js',
  'bridge.js',
  'policy.mjs',
  'extract.mjs',
  'README.md',
];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (~crc) >>> 0;
}

function u16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

export function packageHelperZip(files = helperFiles.map(name => ({
  name,
  data: readFileSync(join(sourceDir, name)),
}))) {
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name);
    const compressed = deflateRawSync(file.data);
    const checksum = crc32(file.data);
    const local = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(8),
      u16(time),
      u16(date),
      u32(checksum),
      u32(compressed.length),
      u32(file.data.length),
      u16(name.length),
      u16(0),
      name,
      compressed,
    ]);
    localParts.push(local);
    centralParts.push(Buffer.concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(8),
      u16(time),
      u16(date),
      u32(checksum),
      u32(compressed.length),
      u32(file.data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ]));
    offset += local.length;
  }

  const central = Buffer.concat(centralParts);
  const end = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(central.length),
    u32(offset),
    u16(0),
  ]);
  return Buffer.concat([...localParts, central, end]);
}

export function writeHelperZip() {
  mkdirSync(dirname(outputPath), { recursive: true });
  const zip = packageHelperZip();
  writeFileSync(outputPath, zip);
  return outputPath;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) writeHelperZip();
