import { describe, it, expect } from 'vitest';
import { computeDiff, type CurrentRow } from './diff';
import { taskToCells, serializeField } from './serialize';
import type { Task, ColumnDef } from './types';

const columns: ColumnDef[] = [
  { field: 'id', header: 'WBS ID' },
  { field: 'name', header: 'タスク名' },
  { field: 'progress', header: '進捗率' },
  { field: 'status', header: 'ステータス' },
  { field: 'predecessors', header: '先行' },
];

function task(p: Partial<Task> & { id: string }): Task {
  return {
    id: p.id,
    parent: null,
    level: 1,
    phase: '',
    name: '',
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

// Task を「Sheet に書かれた行」相当へ（同期後の状態をシミュレート）
function asCurrent(t: Task): CurrentRow {
  const byField: Partial<Record<keyof Task, string>> = {};
  for (const c of columns) byField[c.field] = serializeField(t, c.field);
  return { key: t.id, byField, cells: taskToCells(t, columns) };
}

describe('computeDiff', () => {
  it('新規行を add と判定', () => {
    const diffs = computeDiff([task({ id: '1', name: 'A' })], [], columns);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]!.type).toBe('add');
  });

  it('同一内容は unchanged（差分なし）', () => {
    const t = task({ id: '1', name: 'A', progress: 50, status: '進行中' });
    const diffs = computeDiff([t], [asCurrent(t)], columns);
    expect(diffs[0]!.type).toBe('unchanged');
  });

  it('変更フィールドを update として検出', () => {
    const before = task({ id: '1', name: 'A', progress: 0 });
    const after = task({ id: '1', name: 'A', progress: 80, status: '進行中' });
    const diffs = computeDiff([after], [asCurrent(before)], columns);
    expect(diffs[0]!.type).toBe('update');
    expect(diffs[0]!.changedFields).toContain('progress');
    expect(diffs[0]!.changedFields).toContain('status');
    expect(diffs[0]!.changedFields).not.toContain('name');
  });

  it('spec から消えた行を archive と判定', () => {
    const keep = task({ id: '1' });
    const gone = task({ id: '2' });
    const diffs = computeDiff([keep], [asCurrent(keep), asCurrent(gone)], columns);
    const archived = diffs.filter((d) => d.type === 'archive');
    expect(archived).toHaveLength(1);
    expect(archived[0]!.id).toBe('2');
  });

  it('predecessors の配列とセル文字列を同一視（誤検知しない）', () => {
    const t = task({ id: '1', predecessors: ['1.1', '1.2'] });
    const diffs = computeDiff([t], [asCurrent(t)], columns);
    expect(diffs[0]!.type).toBe('unchanged');
  });

  it('冪等性：同一 spec の再実行は全て unchanged', () => {
    const spec = [task({ id: '1', name: 'A' }), task({ id: '2', name: 'B' })];
    const current = spec.map(asCurrent);
    const diffs = computeDiff(spec, current, columns);
    expect(diffs.every((d) => d.type === 'unchanged')).toBe(true);
  });

  it('前後空白の違いは無視（unchanged）', () => {
    const t = task({ id: '1', name: 'A' });
    const cur = asCurrent(t);
    cur.byField.name = '  A  ';
    const diffs = computeDiff([t], [cur], columns);
    expect(diffs[0]!.type).toBe('unchanged');
  });
});
