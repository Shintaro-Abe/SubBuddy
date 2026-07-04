import type { Task } from '../types';

export function generateGantt(tasks: Task[], generatedAt = new Date()): string {
  const lines = [
    '# WBS ロードマップ',
    '',
    '> `wbs/wbs.yml` から生成。手編集しない。',
    '',
    '```mermaid',
    'gantt',
    '  title SubBuddy WBS Roadmap',
    '  dateFormat  YYYY-MM-DD',
    '  axisFormat  %m/%d',
  ];

  const fallbackDate = generatedAt.toISOString().slice(0, 10);
  let currentPhase = '';
  for (const task of tasks) {
    if (task.phase !== currentPhase) {
      currentPhase = task.phase || '未分類';
      lines.push(`  section ${sanitize(currentPhase)}`);
    }
    const id = mermaidId(task.id);
    const status = task.status === '完了' ? 'done, ' : task.status === '進行中' ? 'active, ' : '';
    const label = sanitize(`${task.id} ${task.name}`);
    const start = task.plannedStart ?? task.actualStart;
    const end = task.plannedEnd ?? task.actualEnd;
    const predecessor = task.predecessors[0];

    if (start && end) {
      lines.push(`  ${label} :${status}${id}, ${start}, ${end}`);
    } else if (predecessor) {
      lines.push(`  ${label} :${status}${id}, after ${mermaidId(predecessor)}, 1d`);
    } else {
      lines.push(`  ${label} :${status}${id}, ${fallbackDate}, 1d`);
    }
  }

  lines.push('```', '');
  return lines.join('\n');
}

function mermaidId(id: string): string {
  return `wbs_${id.replace(/[^A-Za-z0-9_]/g, '_')}`;
}

function sanitize(value: string): string {
  return value.replace(/[:#`]/g, '').replace(/\n/g, ' ').trim() || '未命名';
}
