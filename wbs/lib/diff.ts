import type { Task, ColumnDef } from './types';
import { serializeField, norm } from './serialize';

export type ChangeType = 'add' | 'update' | 'unchanged' | 'archive';

// Sheet 上の 1 行を正規化したもの（読み取り側が組み立てる）
export interface CurrentRow {
  key: string;
  byField: Partial<Record<keyof Task, string>>;
  cells: string[];
}

export interface RowDiff {
  id: string;
  type: ChangeType;
  changedFields: string[];
  cells: string[]; // add/update は spec 由来、archive は現状由来
}

/**
 * spec（正本）と現在の Sheet 行から差分を算出する純粋関数。
 * - ADD: spec にあり Sheet に無い
 * - UPDATE: 両方にあり、いずれかの列が異なる
 * - UNCHANGED: 両方にあり差分なし（同一 spec の再実行は全て UNCHANGED → 冪等）
 * - ARCHIVE: Sheet にあり spec に無い（黙って消さず退避）
 */
export function computeDiff(
  spec: Task[],
  current: CurrentRow[],
  columns: ColumnDef[],
  keyField: keyof Task = 'id',
): RowDiff[] {
  const currentByKey = new Map(current.map((c) => [c.key, c]));
  const specKeys = new Set<string>();
  const diffs: RowDiff[] = [];

  for (const task of spec) {
    const key = String(task[keyField]);
    specKeys.add(key);
    const cells = columns.map((c) => serializeField(task, c.field));
    const cur = currentByKey.get(key);
    if (!cur) {
      diffs.push({ id: key, type: 'add', changedFields: [], cells });
      continue;
    }
    const changed: string[] = [];
    for (const c of columns) {
      const expected = serializeField(task, c.field);
      const actual = cur.byField[c.field] ?? '';
      if (norm(expected) !== norm(actual)) changed.push(String(c.field));
    }
    diffs.push({
      id: key,
      type: changed.length ? 'update' : 'unchanged',
      changedFields: changed,
      cells,
    });
  }

  for (const cur of current) {
    if (!specKeys.has(cur.key)) {
      diffs.push({ id: cur.key, type: 'archive', changedFields: [], cells: cur.cells });
    }
  }

  return diffs;
}
