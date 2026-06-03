// WBS 同期の型定義（正本 wbs.yml と設定 wbs.config.yml に対応）

export interface Task {
  id: string; // WBS ID（結合キー・不変）
  parent: string | null;
  level: number;
  phase: string;
  name: string;
  assignee: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  estimateHours: number | null;
  actualHours: number | null;
  progress: number; // 0..100
  status: string; // 未着手 / 進行中 / 完了 / 保留
  predecessors: string[];
  deliverable: string;
  note: string;
}

export interface ColumnDef {
  field: keyof Task;
  header: string;
}

export interface WbsConfig {
  version: number;
  spreadsheet: {
    id: string;
    sheets: { wbs: string; archive: string; summary: string };
  };
  columns: ColumnDef[];
  key: keyof Task;
  onMissing: 'archive' | 'keep' | 'delete';
}
