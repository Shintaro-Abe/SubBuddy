import { readFileSync } from 'node:fs';
import type { Task } from '../types';
import { ghApiJson, parseRepo } from './gh';

export interface PlanningFile {
  path: string;
  content: string;
}

interface ContentResponse {
  sha?: string;
}

export function buildPlanningFiles(options: {
  tasks: Task[];
  schemaPath: string;
  diagramsOut: string;
  ganttPath: string;
  ganttContent: string;
}): PlanningFile[] {
  const out = trimSlashes(options.diagramsOut);
  return [
    { path: options.ganttPath, content: options.ganttContent },
    { path: `${out}/system.md`, content: systemDiagram() },
    { path: `${out}/er.md`, content: erDiagram(readFileSync(options.schemaPath, 'utf8')) },
    { path: `${out}/recommendation-flow.md`, content: recommendationFlowDiagram() },
    { path: `${out}/screen-flow.md`, content: screenFlowDiagram() },
  ];
}

export function upsertPlanningFile(repo: string, file: PlanningFile): void {
  const { owner, name } = parseRepo(repo);
  const encodedPath = file.path.split('/').map(encodeURIComponent).join('/');
  const current = ghApiJson<ContentResponse>(`repos/${owner}/${name}/contents/${encodedPath}`, { silent404: true });
  const body: Record<string, string> = {
    message: `sync: update ${file.path}`,
    content: Buffer.from(file.content, 'utf8').toString('base64'),
  };
  if (current?.sha) body.sha = current.sha;
  ghApiJson(`repos/${owner}/${name}/contents/${encodedPath}`, { method: 'PUT', body });
}

export function erDiagram(schema: string): string {
  const models = parseModels(schema);
  const lines = [
    '# ER 図',
    '',
    '> `apps/web/prisma/schema.prisma` から生成。手編集しない。',
    '',
    '```mermaid',
    'erDiagram',
  ];

  for (const model of models) {
    lines.push(`  ${model.name} {`);
    for (const field of model.fields) lines.push(`    ${field.type} ${field.name}`);
    lines.push('  }');
  }

  const modelNames = new Set(models.map((m) => m.name));
  const seen = new Set<string>();
  for (const model of models) {
    for (const rel of model.relations) {
      if (!modelNames.has(rel.type)) continue;
      const key = [model.name, rel.type, rel.name].sort().join(':');
      if (seen.has(key)) continue;
      seen.add(key);
      const many = rel.isList ? '}o' : '||';
      lines.push(`  ${model.name} ${many}--|| ${rel.type} : ${rel.name}`);
    }
  }

  lines.push('```', '');
  return lines.join('\n');
}

function parseModels(schema: string): Array<{ name: string; fields: Array<{ name: string; type: string }>; relations: Array<{ name: string; type: string; isList: boolean }> }> {
  const models: Array<{ name: string; fields: Array<{ name: string; type: string }>; relations: Array<{ name: string; type: string; isList: boolean }> }> = [];
  const re = /model\s+(\w+)\s+\{([\s\S]*?)\n\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(schema))) {
    const name = m[1]!;
    const body = m[2]!;
    const fields: Array<{ name: string; type: string }> = [];
    const relations: Array<{ name: string; type: string; isList: boolean }> = [];
    for (const raw of body.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('//') || line.startsWith('@@')) continue;
      const parts = line.split(/\s+/);
      if (parts.length < 2) continue;
      const fieldName = parts[0]!;
      const rawType = parts[1]!;
      const type = rawType.replace(/[?\[\]]/g, '');
      if (/^[A-Z]/.test(type) && !['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json'].includes(type)) {
        relations.push({ name: fieldName, type, isList: rawType.endsWith('[]') });
      } else {
        fields.push({ name: fieldName, type: type.toUpperCase() });
      }
    }
    models.push({ name, fields, relations });
  }
  return models;
}

function systemDiagram(): string {
  return `# システム構成\n\n> docs/architecture.md / docs/functional-design.md の要点を planning repo 用に生成。\n\n\`\`\`mermaid\nflowchart LR\n  User[ユーザー] --> Web[Next.js Web]\n  Web --> API[Route Handlers API]\n  API --> Domain[ドメインロジック]\n  API --> DB[(PostgreSQL)]\n  IOS[iPhone Usage Sensor] --> UsageAPI[利用量同期 API]\n  UsageAPI --> DB\n  Domain --> Rec[見直し提案]\n\`\`\`\n`;
}

function recommendationFlowDiagram(): string {
  return `# 判定フロー\n\n> docs/glossary.md / docs/functional-design.md の判定方針を planning repo 用に生成。\n\n\`\`\`mermaid\nflowchart TD\n  A[サブスク情報] --> B{観測期間は十分か}\n  B -->|いいえ| C[観測中]\n  B -->|はい| D{使っていない兆候}\n  D -->|あり| E[解約検討]\n  D -->|なし| F{重複・割高・安いプラン}\n  F -->|あり| G[見直し候補]\n  F -->|なし| H{更新日が近い / 高額長期}\n  H -->|あり| I[確認]\n  H -->|なし| J[継続]\n\`\`\`\n`;
}

function screenFlowDiagram(): string {
  return `# 画面遷移\n\n> docs/functional-design.md の画面設計を planning repo 用に生成。\n\n\`\`\`mermaid\nflowchart LR\n  Dashboard[ダッシュボード] --> Subscriptions[サブスク一覧]\n  Subscriptions --> Detail[詳細]\n  Subscriptions --> New[新規登録]\n  Detail --> Edit[編集]\n  Dashboard --> Spending[支出]\n  Dashboard --> Recommendations[提案]\n  Dashboard --> Renewals[更新]\n\`\`\`\n`;
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}
