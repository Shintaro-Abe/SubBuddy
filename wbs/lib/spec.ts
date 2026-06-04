import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { Task } from './types';

const DEFAULTS: Omit<Task, 'id'> = {
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
};

export function loadSpec(specPath: string): Task[] {
  const doc = parse(readFileSync(specPath, 'utf8')) as { tasks?: Array<Record<string, unknown>> };
  const rawTasks = doc?.tasks ?? [];
  const seen = new Set<string>();

  return rawTasks.map((t, i) => {
    if (t?.id === undefined || t?.id === null || String(t.id).trim() === '') {
      throw new Error(`wbs.yml: ${i + 1} 件目のタスクに id がありません`);
    }
    const id = String(t.id);
    if (seen.has(id)) throw new Error(`wbs.yml: WBS ID が重複しています: ${id}`);
    seen.add(id);

    const task: Task = {
      ...DEFAULTS,
      ...(t as Partial<Task>),
      id,
      predecessors: normPreds(t.predecessors),
    };

    if (typeof task.progress !== 'number' || task.progress < 0 || task.progress > 100) {
      throw new Error(`wbs.yml: ${id} の progress は 0..100 の数値にしてください`);
    }
    return task;
  });
}

function normPreds(v: unknown): string[] {
  if (v === null || v === undefined || v === '') return [];
  if (Array.isArray(v)) return v.map((x) => String(x));
  return String(v)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
