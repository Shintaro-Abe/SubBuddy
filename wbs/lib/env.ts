import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

// wbs/.env を読み込んで process.env へ反映する最小ローダ（依存なし）。
// 認証鍵パスが相対なら repoRoot 基準の絶対パスに解決し、実行 CWD に依存しないようにする。
export function loadEnv(envPath: string, repoRoot: string): void {
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1]!;
    let val = (m[2] ?? '').trim().replace(/^["']|["']$/g, '');
    if (key === 'GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE' && val && !path.isAbsolute(val)) {
      val = path.resolve(repoRoot, val);
    }
    process.env[key] = val;
  }
}
