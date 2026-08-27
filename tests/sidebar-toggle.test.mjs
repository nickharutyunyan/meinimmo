import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('the centered sidebar chevron grows a tail on hover and reverses when collapsed', async () => {
  const component = await readFile(new URL('../components/Sidebar.tsx', import.meta.url), 'utf8');
  const editorial = await readFile(new URL('../app/editorial.css', import.meta.url), 'utf8');
  const sidebar = await readFile(new URL('../app/sidebar.css', import.meta.url), 'utf8');
  assert.match(component, /<svg viewBox="0 0 20 20">[\s\S]*?className="arrow-head"[\s\S]*?className="arrow-tail"/);
  assert.match(editorial, /\.sidebar \.sidebar-toggle span\s*\{[\s\S]*?width:\s*18px;[\s\S]*?height:\s*18px;/);
  assert.match(editorial, /\.arrow-tail\s*\{[\s\S]*?stroke-dashoffset:\s*11;/);
  assert.match(editorial, /\.sidebar \.sidebar-toggle:hover \.arrow-tail,[\s\S]*?stroke-dashoffset:\s*0;/);
  assert.match(sidebar, /\.sidebar\.collapsed \.sidebar-toggle span\{transform:rotate\(180deg\)\}/);
});
