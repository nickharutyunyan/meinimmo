import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Comparison, Report } from './types';

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const reportsFile = path.join(dataDir, 'reports.json');
const comparisonsFile = path.join(dataDir, 'comparisons.json');

async function read<T>(file: string): Promise<T[]> { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return []; } }
async function write<T>(file: string, items: T[]) { await fs.mkdir(dataDir, { recursive: true }); await fs.writeFile(file, JSON.stringify(items, null, 2), 'utf8'); }

export async function reports() { return read<Report>(reportsFile); }
export async function report(id: string) { return (await reports()).find(item => item.id === id); }
export async function saveReport(item: Report) { const all = await reports(); all.push(item); await write(reportsFile, all); }
export async function comparisons() { return read<Comparison>(comparisonsFile); }
export async function comparison(id: string) { return (await comparisons()).find(item => item.id === id); }
export async function saveComparison(item: Comparison) { const all = await comparisons(); all.push(item); await write(comparisonsFile, all); }
