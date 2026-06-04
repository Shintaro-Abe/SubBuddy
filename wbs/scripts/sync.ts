import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from '../lib/env';
import { loadConfig } from '../lib/config';
import { loadSpec } from '../lib/spec';
import { Sheets } from '../lib/sheets';
import { computeDiff, type CurrentRow } from '../lib/diff';
import { serializeField } from '../lib/serialize';
import type { Task } from '../lib/types';

const apply = process.argv.includes('--apply');

const wbsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(wbsDir, '..');
loadEnv(path.join(wbsDir, '.env'), repoRoot);

const config = loadConfig(path.join(wbsDir, 'wbs.config.yml'));
const spec = loadSpec(path.join(wbsDir, 'wbs.yml'));
const sheets = new Sheets(config.spreadsheet.id);

const wbsName = config.spreadsheet.sheets.wbs;
const archiveName = config.spreadsheet.sheets.archive;
const columns = config.columns;
const keyField = config.key;
const keyIndex = columns.findIndex((c) => c.field === keyField);

// --- 現在の Sheet 行を読み取る ---
const values = sheets.getValues(`${wbsName}!A1:Z`);
const dataRows = values.slice(1); // 1 行目はヘッダ
const current: CurrentRow[] = [];
for (const row of dataRows) {
  const key = (row[keyIndex] ?? '').toString().trim();
  if (!key) continue;
  const byField: Partial<Record<keyof Task, string>> = {};
  columns.forEach((c, i) => {
    byField[c.field] = (row[i] ?? '').toString();
  });
  current.push({ key, byField, cells: columns.map((_, i) => (row[i] ?? '').toString()) });
}

// --- 差分 ---
const diffs = computeDiff(spec, current, columns, keyField);
const counts = { add: 0, update: 0, unchanged: 0, archive: 0 } as Record<string, number>;
for (const d of diffs) counts[d.type]++;

const specById = new Map(spec.map((t) => [String(t[keyField]), t]));
const nameIdx = columns.findIndex((c) => c.field === 'name');

console.log(`\n=== WBS 同期 ${apply ? '(APPLY)' : '(DRY-RUN)'} ===`);
console.log(`シート: ${wbsName} / spreadsheet: ${config.spreadsheet.id}`);
console.log(`追加 ${counts.add} / 更新 ${counts.update} / 変更なし ${counts.unchanged} / 退避 ${counts.archive}\n`);

for (const d of diffs) {
  if (d.type === 'unchanged') continue;
  const label = d.type === 'add' ? '＋追加' : d.type === 'update' ? '～更新' : '→退避';
  const detail = d.type === 'update' ? ` (${d.changedFields.join(', ')})` : '';
  const t = specById.get(d.id);
  const name = t ? t.name : (d.cells[nameIdx] ?? '');
  console.log(`  ${label} ${d.id}  ${name}${detail}`);
}

if (!apply) {
  console.log('\n(ドライラン：書き込みは行っていません。反映するには --apply)');
  process.exit(0);
}

// --- APPLY ---
// 1) spec から消えた行を Archive へ退避（US-10）
if (config.onMissing === 'archive') {
  const toArchive = diffs.filter((d) => d.type === 'archive');
  if (toArchive.length) {
    const stamp = new Date().toISOString();
    appendRows(archiveName, toArchive.map((d) => [...d.cells, stamp]));
    console.log(`Archive へ ${toArchive.length} 行退避`);
  }
}

// 2) WBS を spec で上書き（ヘッダ＋ID昇順の全行）→ 冪等
const sorted = [...spec].sort((a, b) => cmpId(String(a[keyField]), String(b[keyField])));
const headerRow = columns.map((c) => c.header);
const body = sorted.map((t) => columns.map((c) => serializeField(t, c.field)));
sheets.clearValues(`${wbsName}!A1:Z`);
sheets.updateValues(`${wbsName}!A1`, [headerRow, ...body]);
console.log(`WBS 反映: ${body.length} 行`);
console.log('\n同期完了。');

function appendRows(sheetName: string, rows: string[][]): void {
  if (!rows.length) return;
  const existing = sheets.getValues(`${sheetName}!A1:A`);
  const next = existing.length + 1; // 既存行の次（1 始まり）
  sheets.updateValues(`${sheetName}!A${next}`, rows);
}

function cmpId(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10));
  const pb = b.split('.').map((n) => parseInt(n, 10));
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = Number.isNaN(pa[i] as number) ? 0 : pa[i] ?? 0;
    const y = Number.isNaN(pb[i] as number) ? 0 : pb[i] ?? 0;
    if (x !== y) return x - y;
  }
  return a.localeCompare(b);
}
