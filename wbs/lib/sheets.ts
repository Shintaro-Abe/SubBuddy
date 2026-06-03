import { execFileSync } from 'node:child_process';

type Json = Record<string, unknown>;

function runGws(args: string[]): string {
  try {
    return execFileSync('gws', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    const out = `${err.stdout ?? ''}${err.stderr ?? ''}`.trim();
    throw new Error(`gws 実行に失敗: gws ${args.join(' ')}\n${out || err.message}`);
  }
}

function runGwsJson(args: string[]): Json {
  const out = runGws([...args, '--format', 'json']);
  // gws はまれに先頭へログ行を出すため、最初の { か [ から JSON として解釈する
  const idxObj = out.indexOf('{');
  const idxArr = out.indexOf('[');
  let start = idxObj;
  if (idxArr !== -1 && (idxObj === -1 || idxArr < idxObj)) start = idxArr;
  const text = start >= 0 ? out.slice(start) : out;
  const parsed = JSON.parse(text) as Json;
  if (parsed && typeof parsed === 'object' && 'error' in parsed) {
    throw new Error(`gws API エラー: ${JSON.stringify((parsed as Json).error)}`);
  }
  return parsed;
}

// Google Sheets I/O アダプタ（公式 CLI gws 経由）。差し替え点はこのクラスに局所化。
export class Sheets {
  constructor(private readonly spreadsheetId: string) {}

  getSheetTitles(): string[] {
    const r = runGwsJson(['sheets', 'spreadsheets', 'get', '--params', JSON.stringify({ spreadsheetId: this.spreadsheetId })]);
    const sheets = (r.sheets as Array<{ properties?: { title?: string } }>) ?? [];
    return sheets.map((s) => s.properties?.title ?? '').filter(Boolean);
  }

  getValues(range: string): string[][] {
    const r = runGwsJson([
      'sheets', 'spreadsheets', 'values', 'get',
      '--params', JSON.stringify({ spreadsheetId: this.spreadsheetId, range, valueRenderOption: 'UNFORMATTED_VALUE' }),
    ]);
    const values = (r.values as unknown[][]) ?? [];
    return values.map((row) => row.map((c) => (c === null || c === undefined ? '' : String(c))));
  }

  updateValues(range: string, values: string[][], valueInputOption: 'RAW' | 'USER_ENTERED' = 'RAW'): void {
    runGwsJson([
      'sheets', 'spreadsheets', 'values', 'update',
      '--params', JSON.stringify({ spreadsheetId: this.spreadsheetId, range, valueInputOption }),
      '--json', JSON.stringify({ values }),
    ]);
  }

  clearValues(range: string): void {
    runGwsJson([
      'sheets', 'spreadsheets', 'values', 'clear',
      '--params', JSON.stringify({ spreadsheetId: this.spreadsheetId, range }),
    ]);
  }

  addSheet(title: string): void {
    runGwsJson([
      'sheets', 'spreadsheets', 'batchUpdate',
      '--params', JSON.stringify({ spreadsheetId: this.spreadsheetId }),
      '--json', JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
    ]);
  }
}
