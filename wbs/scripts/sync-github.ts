process.on('uncaughtException', (e) => {
  console.error(`\nERROR: ${(e as Error).message}`);
  process.exit(1);
});

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../lib/config';
import { loadEnv } from '../lib/env';
import { previewGitHubSync, applyGitHubSync } from '../lib/github/adapter';
import { loadSpec } from '../lib/spec';

const apply = process.argv.includes('--apply');
const offline = process.argv.includes('--offline');
const skipProject = process.argv.includes('--skip-project');
const skipDiagrams = process.argv.includes('--skip-diagrams');

const wbsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(wbsDir, '..');
loadEnv(path.join(wbsDir, '.env'), repoRoot);

const config = loadConfig(path.join(wbsDir, 'wbs.config.yml'));
if (!config.github) throw new Error('wbs.config.yml: github セクションがありません');

const spec = loadSpec(path.join(wbsDir, 'wbs.yml'));
const preview = previewGitHubSync({ repoRoot, config: config.github, tasks: spec, offline, skipProject, skipDiagrams });
const counts = { add: 0, update: 0, unchanged: 0, close: 0 } as Record<string, number>;
for (const diff of preview.diffs) counts[diff.type] = (counts[diff.type] ?? 0) + 1;

console.log(`\n=== WBS GitHub 同期 ${apply ? '(APPLY)' : '(DRY-RUN)'} ===`);
console.log(`repo: ${config.github.repo}`);
console.log(`Issue: 追加 ${counts.add} / 更新 ${counts.update} / 変更なし ${counts.unchanged} / close ${counts.close}`);
console.log(`生成ファイル: ${preview.files.map((file) => file.path).join(', ')}`);
if (config.github.projectNumber) {
  console.log(`Project: #${config.github.projectNumber}${skipProject ? ' (skip)' : ''}`);
} else {
  console.log('Project: 未設定（github.projectNumber を設定すると同期）');
}

for (const warning of preview.warnings) console.log(`! ${warning}`);

for (const diff of preview.diffs) {
  if (diff.type === 'unchanged') continue;
  const label = diff.type === 'add' ? '＋追加' : diff.type === 'update' ? '～更新' : '×close';
  const detail = diff.type === 'update' ? ` (${diff.changedFields.join(', ')})` : '';
  console.log(`  ${label} ${diff.id}  ${diff.title}${detail}`);
}

if (!apply) {
  console.log('\n(ドライラン：書き込みは行っていません。反映するには --apply)');
  process.exit(0);
}

const warnings = applyGitHubSync({ repoRoot, config: config.github, tasks: spec, offline, skipProject, skipDiagrams }, preview);
for (const warning of warnings) console.log(`! ${warning}`);
console.log('\nGitHub 同期完了。');
