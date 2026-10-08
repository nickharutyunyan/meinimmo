import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { helperFiles, packageHelperZip } from '../scripts/package-helper.mjs';

test('helper zip stores the extension files at the archive root', () => {
  const files = helperFiles.map(name => ({
    name,
    data: readFileSync(new URL(`../extensions/reviewahouse/${name}`, import.meta.url)),
  }));
  const zip = packageHelperZip(files);
  let offset = 0;
  const found = [];
  while (offset + 30 <= zip.length && zip.readUInt32LE(offset) === 0x04034b50) {
    const method = zip.readUInt16LE(offset + 8);
    const compressedSize = zip.readUInt32LE(offset + 18);
    const nameLength = zip.readUInt16LE(offset + 26);
    const extraLength = zip.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const name = zip.subarray(nameStart, nameStart + nameLength).toString();
    const dataStart = nameStart + nameLength + extraLength;
    const compressed = zip.subarray(dataStart, dataStart + compressedSize);
    const raw = method === 8 ? inflateRawSync(compressed) : compressed;
    const expected = files.find(file => file.name === name);
    assert.ok(expected, name);
    assert.deepEqual(raw, expected.data);
    found.push(name);
    offset = dataStart + compressedSize;
  }
  assert.deepEqual(found, helperFiles);
});
