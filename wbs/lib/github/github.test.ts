import { describe, expect, it } from 'vitest';
import { erDiagram } from './diagrams';
import { generateGantt } from './gantt';
import { diffIssues, extractWbsId, issueBody, type GitHubIssue } from './issues';
import { mergeSingleSelectOptions } from './project';
import type { Task } from '../types';

function task(p: Partial<Task> & { id: string; name?: string }): Task {
  return {
    parent: null,
    level: 1,
    phase: '実装',
    name: 'テストタスク',
    assignee: '',
    plannedStart: null,
    plannedEnd: null,
    actualStart: null,
    actualEnd: null,
    estimateHours: null,
    actualHours: null,
    progress: 0,
    status: '未着手',
    predecessors: [],
    deliverable: '',
    note: '',
    ...p,
  };
}

function issue(p: Partial<GitHubIssue> & { body: string | null }): GitHubIssue {
  return {
    number: 1,
    node_id: 'I_1',
    title: '[1] テストタスク',
    state: 'open',
    html_url: 'https://example.com/1',
    ...p,
  };
}

describe('github issue sync helpers', () => {
  it('Issue 本文の wbs-id マーカーを抽出する', () => {
    expect(extractWbsId('本文\n<!-- wbs-id: RE-1.2 -->')).toBe('RE-1.2');
  });

  it('同じ Issue 本文なら unchanged になる', () => {
    const t = task({ id: '1', name: 'テストタスク' });
    const diffs = diffIssues([t], [issue({ body: issueBody(t) })]);
    expect(diffs[0]!.type).toBe('unchanged');
  });

  it('Project自動化で閉じた完了Issueを再オープンしない', () => {
    const t = task({ id: '1', name: 'テストタスク', status: '完了', progress: 100 });
    const diffs = diffIssues([t], [issue({ body: issueBody(t), state: 'closed' })]);
    expect(diffs[0]!.type).toBe('unchanged');
  });

  it('GitHub から消えたタスクは add になる', () => {
    const diffs = diffIssues([task({ id: '1' })], []);
    expect(diffs[0]!.type).toBe('add');
  });
});

describe('github generated docs', () => {
  it('predecessors を gantt の after として出力する', () => {
    const doc = generateGantt([
      task({ id: '1', plannedStart: '2026-07-01', plannedEnd: '2026-07-02' }),
      task({ id: '1.1', parent: '1', level: 2, predecessors: ['1'] }),
    ], new Date('2026-07-03T00:00:00Z'));
    expect(doc).toContain('after wbs_1');
  });

  it('Prisma schema から Mermaid ER を生成する', () => {
    const doc = erDiagram(`
model User {
  id String @id
  subscriptions Subscription[]
}
model Subscription {
  id String @id
  user User @relation(fields: [userId], references: [id])
  userId String
}
`);
    expect(doc).toContain('erDiagram');
    expect(doc).toContain('User {');
    expect(doc).toContain('Subscription {');
  });
});

describe('github project sync helpers', () => {
  it('既存選択肢のIDを維持して不足する選択肢だけを追加する', () => {
    expect(
      mergeSingleSelectOptions(
        [{ id: 'phase-1', name: '実装', color: 'BLUE', description: '既存' }],
        ['実装', '検証'],
      ),
    ).toEqual([
      { id: 'phase-1', name: '実装', color: 'BLUE', description: '既存' },
      { name: '検証', color: 'BLUE', description: '' },
    ]);
  });
});
