#!/usr/bin/env node
// PostToolUse フック用：.steering/*/tasklist.md が編集され、
// 全タスクが完了（= Bolt 完了）になったら、Claude へ「WBS 同期の提案」を返す。
//
// 設計上の約束：
// - ユーザーの編集を絶対に妨げない → 例外が起きても必ず exit 0、何も出力しない。
// - 提案は additionalContext（hookSpecificOutput）で Claude の文脈に追加するだけ。
// - 重複提案の抑止：完了状態のハッシュを state に記録し、同一状態では再提案しない。
//
// 完了判定：
// - 未完了マーカー [ ] / [~] が 0 件、かつ 完了マーカー [x] が 1 件以上。
// - 保留マーカー [-] は「完了をブロックしない」（後回し扱い）。

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

try {
  const raw = safeReadStdin();
  const input = JSON.parse(raw);

  const filePath = input?.tool_input?.file_path;
  if (!filePath) process.exit(0);

  const norm = String(filePath).replace(/\\/g, '/');
  if (!/\.steering\/[^/]+\/tasklist\.md$/.test(norm)) process.exit(0);

  const abs = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(input?.cwd || process.cwd(), filePath);
  if (!existsSync(abs)) process.exit(0);

  const text = readFileSync(abs, 'utf8');
  const incomplete = (text.match(/^\s*[-*]\s*\[[ ~]\]/gm) || []).length;
  const complete = (text.match(/^\s*[-*]\s*\[[xX]\]/gm) || []).length;
  if (complete === 0 || incomplete > 0) process.exit(0); // Bolt 未完了

  // 重複提案の抑止
  const repoRoot = input?.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const checkboxLines = (text.match(/^\s*[-*]\s*\[[ xX~\-]\].*$/gm) || []).join('\n');
  const hash = createHash('sha1').update(norm + '\n' + checkboxLines).digest('hex');
  const stateFile = path.join(repoRoot, 'wbs', '.sync-state.json');
  let state = {};
  try {
    if (existsSync(stateFile)) state = JSON.parse(readFileSync(stateFile, 'utf8'));
  } catch {
    state = {};
  }
  if (state[norm] === hash) process.exit(0); // 同一完了状態は再提案しない

  state[norm] = hash;
  try {
    mkdirSync(path.dirname(stateFile), { recursive: true });
    writeFileSync(stateFile, JSON.stringify(state, null, 2));
  } catch {
    /* state 書き込み失敗は致命でない */
  }

  const out = {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext:
        `「${norm}」のタスクがすべて完了しました（Bolt 完了：完了 ${complete} 件 / 未完了 0 件）。` +
        `WBS をスプレッドシートへ同期する好機です。` +
        `スラッシュコマンド /wbs-sync の手順（ドライランで差分提示 → ユーザーに確認 → 承認時のみ反映）に従い、` +
        `ユーザーへ同期の可否を確認してください。承認なしに書き込まないこと。`,
    },
  };
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
} catch {
  process.exit(0);
}

function safeReadStdin() {
  try {
    return readFileSync(0, 'utf8') || '{}';
  } catch {
    return '{}';
  }
}
