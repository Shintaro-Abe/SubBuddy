import type { GitHubConfig, Task } from '../types';
import { ghApiJson, ghGraphql, parseRepo } from './gh';

export interface GitHubIssue {
  number: number;
  node_id: string;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  html_url: string;
  pull_request?: unknown;
}

export type GitHubIssueChangeType = 'add' | 'update' | 'unchanged' | 'close';

export interface GitHubIssueDiff {
  id: string;
  type: GitHubIssueChangeType;
  title: string;
  changedFields: string[];
  issue?: GitHubIssue;
  task?: Task;
}

const MARKER_RE = /<!--\s*wbs-id:\s*([^\s]+)\s*-->/;

export function issueMarker(id: string): string {
  return `<!-- wbs-id: ${id} -->`;
}

export function extractWbsId(body: string | null | undefined): string | null {
  const m = body?.match(MARKER_RE);
  return m?.[1] ?? null;
}

export function issueTitle(task: Task, keyField: keyof Task = 'id'): string {
  return `[${String(task[keyField])}] ${task.name}`;
}

export function issueBody(task: Task, keyField: keyof Task = 'id'): string {
  const id = String(task[keyField]);
  const lines = [
    `## ${task.name}`,
    '',
    '| 項目 | 値 |',
    '|---|---|',
    `| WBS ID | ${escapeCell(id)} |`,
    `| 親ID | ${escapeCell(task.parent ?? '')} |`,
    `| レベル | ${task.level} |`,
    `| 分類 | ${escapeCell(task.phase)} |`,
    `| 担当 | ${escapeCell(task.assignee)} |`,
    `| 開始予定 | ${escapeCell(task.plannedStart ?? '')} |`,
    `| 終了予定 | ${escapeCell(task.plannedEnd ?? '')} |`,
    `| 進捗率 | ${task.progress}% |`,
    `| ステータス | ${escapeCell(task.status)} |`,
    `| 先行タスク | ${escapeCell(task.predecessors.join(', '))} |`,
    `| 成果物 | ${escapeCell(task.deliverable)} |`,
    '',
    task.note ? `> ${task.note.replace(/\n/g, ' ')}` : '',
    '',
    issueMarker(id),
  ];
  return lines.filter((line, index) => line !== '' || lines[index - 1] !== '').join('\n');
}

export function buildIssueIndex(issues: GitHubIssue[]): Map<string, GitHubIssue> {
  const out = new Map<string, GitHubIssue>();
  for (const issue of issues) {
    if (issue.pull_request) continue;
    const id = extractWbsId(issue.body);
    if (id) out.set(id, issue);
  }
  return out;
}

export function diffIssues(
  spec: Task[],
  existingIssues: GitHubIssue[],
  keyField: keyof Task = 'id',
  onMissing: GitHubConfig['onMissing'] = 'keep',
): GitHubIssueDiff[] {
  const byId = buildIssueIndex(existingIssues);
  const specIds = new Set<string>();
  const diffs: GitHubIssueDiff[] = [];

  for (const task of spec) {
    const id = String(task[keyField]);
    specIds.add(id);
    const expectedTitle = issueTitle(task, keyField);
    const expectedBody = issueBody(task, keyField);
    const current = byId.get(id);
    if (!current) {
      diffs.push({ id, type: 'add', title: expectedTitle, changedFields: [], task });
      continue;
    }

    const changedFields: string[] = [];
    if (current.title !== expectedTitle) changedFields.push('title');
    if ((current.body ?? '').trim() !== expectedBody.trim()) changedFields.push('body');
    diffs.push({
      id,
      type: changedFields.length ? 'update' : 'unchanged',
      title: expectedTitle,
      changedFields,
      issue: current,
      task,
    });
  }

  if (onMissing === 'close') {
    for (const [id, issue] of byId) {
      if (!specIds.has(id) && issue.state !== 'closed') {
        diffs.push({ id, type: 'close', title: issue.title, changedFields: [], issue });
      }
    }
  }

  return diffs;
}

export function listIssues(repo: string): GitHubIssue[] {
  const { owner, name } = parseRepo(repo);
  const all: GitHubIssue[] = [];
  for (let page = 1; page <= 20; page++) {
    const chunk = ghApiJson<GitHubIssue[]>(
      `repos/${owner}/${name}/issues?state=all&per_page=100&page=${page}`,
    ) ?? [];
    all.push(...chunk.filter((issue) => !issue.pull_request));
    if (chunk.length < 100) break;
  }
  return all;
}

export function applyIssueDiffs(
  repo: string,
  diffs: GitHubIssueDiff[],
  keyField: keyof Task = 'id',
  maxWrites = Number.POSITIVE_INFINITY,
): Map<string, GitHubIssue> {
  const { owner, name } = parseRepo(repo);
  const result = new Map<string, GitHubIssue>();
  let writes = 0;

  for (const diff of diffs) {
    if (diff.type === 'unchanged' && diff.issue) {
      result.set(diff.id, diff.issue);
      continue;
    }
    if (isIssueWrite(diff) && writes >= maxWrites) continue;
    if (diff.type === 'close' && diff.issue) {
      const issue = ghApiJson<GitHubIssue>(`repos/${owner}/${name}/issues/${diff.issue.number}`, {
        method: 'PATCH',
        body: { state: 'closed' },
      });
      writes += 1;
      if (issue) result.set(diff.id, issue);
      continue;
    }
    if (!diff.task) continue;

    const body = { title: issueTitle(diff.task, keyField), body: issueBody(diff.task, keyField) };
    if (diff.type === 'add') {
      const issue = ghApiJson<GitHubIssue>(`repos/${owner}/${name}/issues`, { method: 'POST', body });
      writes += 1;
      if (issue) result.set(diff.id, issue);
      continue;
    }
    if (diff.type === 'update' && diff.issue) {
      const issue = ghApiJson<GitHubIssue>(`repos/${owner}/${name}/issues/${diff.issue.number}`, {
        method: 'PATCH',
        body,
      });
      writes += 1;
      if (issue) result.set(diff.id, issue);
    }
  }

  return result;
}

function isIssueWrite(diff: GitHubIssueDiff): boolean {
  return diff.type === 'add' || diff.type === 'update' || diff.type === 'close';
}

export function attachSubIssues(tasks: Task[], issuesById: Map<string, GitHubIssue>, keyField: keyof Task = 'id'): string[] {
  const warnings: string[] = [];
  const mutation = `
    mutation($issueId: ID!, $subIssueId: ID!) {
      addSubIssue(input: { issueId: $issueId, subIssueId: $subIssueId }) {
        issue { id }
        subIssue { id }
      }
    }
  `;

  for (const task of tasks) {
    if (!task.parent || task.level < 2) continue;
    const id = String(task[keyField]);
    const parent = issuesById.get(task.parent);
    const child = issuesById.get(id);
    if (!parent || !child) {
      warnings.push(`Sub-issue 紐付けをスキップ: ${id}（親または子 Issue が見つかりません）`);
      continue;
    }
    try {
      ghGraphql(mutation, { issueId: parent.node_id, subIssueId: child.node_id });
    } catch (e) {
      const message = String((e as Error).message);
      if (!message.includes('already') && !message.includes('parent')) {
        warnings.push(`Sub-issue 紐付けに失敗: ${task.parent} -> ${id}: ${message.split('\n')[0]}`);
      }
    }
  }
  return warnings;
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
