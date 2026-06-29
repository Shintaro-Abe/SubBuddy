import type { Task, ColumnDef } from './types';

// Task の 1 フィールドを Sheet セル用の文字列へ変換（副作用なし・純粋）
export function serializeField(task: Task, field: keyof Task): string {
  const v = task[field];
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

// Task を列定義の順にセル配列へ
export function taskToCells(task: Task, columns: ColumnDef[]): string[] {
  return columns.map((c) => serializeField(task, c.field));
}

// 比較用の正規化（前後空白を無視・null/undefined を空文字に）
export function norm(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}
