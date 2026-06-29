import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from '../lib/env';
import { loadConfig } from '../lib/config';
import { Sheets } from '../lib/sheets';

const wbsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(wbsDir, '..');
loadEnv(path.join(wbsDir, '.env'), repoRoot);

const config = loadConfig(path.join(wbsDir, 'wbs.config.yml'));
const sheets = new Sheets(config.spreadsheet.id);
const { wbs, archive, summary } = config.spreadsheet.sheets;
const headers = config.columns.map((c) => c.header);

const colLetter = (i: number): string => String.fromCharCode(65 + i);
const progIdx = config.columns.findIndex((c) => c.field === 'progress');
const statusIdx = config.columns.findIndex((c) => c.field === 'status');
const PM = colLetter(progIdx);
const NS = colLetter(statusIdx);

// 1) 必要なシートを用意（無ければ作成）
const existing = sheets.getSheetTitles();
for (const title of [wbs, archive, summary]) {
  if (!existing.includes(title)) {
    sheets.addSheet(title);
    console.log(`シート作成: ${title}`);
  } else {
    console.log(`シート既存: ${title}`);
  }
}

// 2) ヘッダ行
sheets.updateValues(`${wbs}!A1`, [headers]);
sheets.updateValues(`${archive}!A1`, [[...headers, 'archivedAt']]);

// 3) Summary（ロールアップ：数式。同期では触らない）
const summaryRows: string[][] = [
  ['指標', '値'],
  ['タスク総数', `=COUNTA(${wbs}!A2:A)`],
  ['完了', `=COUNTIF(${wbs}!${NS}2:${NS},"完了")`],
  ['進行中', `=COUNTIF(${wbs}!${NS}2:${NS},"進行中")`],
  ['未着手', `=COUNTIF(${wbs}!${NS}2:${NS},"未着手")`],
  ['保留', `=COUNTIF(${wbs}!${NS}2:${NS},"保留")`],
  // 進捗率は RAW（文字列）で保存されるため、VALUE でテキスト→数値に変換して平均する
  ['全体進捗率(平均)', `=IFERROR(ROUND(AVERAGE(ARRAYFORMULA(VALUE(FILTER(${wbs}!${PM}2:${PM},${wbs}!${PM}2:${PM}<>"")))),1),0)`],
];
sheets.updateValues(`${summary}!A1`, summaryRows, 'USER_ENTERED');

console.log('init-sheets 完了');
