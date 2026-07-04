import path from 'node:path';
import type { GitHubConfig, Task } from '../types';
import { buildPlanningFiles, type PlanningFile, upsertPlanningFile } from './diagrams';
import { generateGantt } from './gantt';
import { applyIssueDiffs, attachSubIssues, diffIssues, listIssues, type GitHubIssueDiff } from './issues';
import { syncProject } from './project';

export interface GitHubSyncPreview {
  diffs: GitHubIssueDiff[];
  files: PlanningFile[];
  warnings: string[];
}

export interface GitHubSyncOptions {
  repoRoot: string;
  config: GitHubConfig;
  tasks: Task[];
  offline?: boolean;
  skipProject?: boolean;
  skipDiagrams?: boolean;
}

export function previewGitHubSync(options: GitHubSyncOptions): GitHubSyncPreview {
  const issues = options.offline ? [] : listIssues(options.config.repo);
  const diffs = diffIssues(options.tasks, issues, options.config.key, options.config.onMissing);
  const ganttContent = generateGantt(options.tasks);
  const files = options.skipDiagrams
    ? [{ path: options.config.gantt.out, content: ganttContent }]
    : buildPlanningFiles({
        tasks: options.tasks,
        schemaPath: path.join(options.repoRoot, 'apps/web/prisma/schema.prisma'),
        diagramsOut: options.config.diagrams.out,
        ganttPath: options.config.gantt.out,
        ganttContent,
      });
  const warnings = options.offline ? ['offline dry-run: GitHub の現状は読まず、全 Issue を追加候補として表示します'] : [];
  return { diffs, files, warnings };
}

export function applyGitHubSync(options: GitHubSyncOptions, preview: GitHubSyncPreview): string[] {
  if (options.offline) throw new Error('--offline と --apply は同時に使えません');
  const warnings: string[] = [...preview.warnings];
  const issuesById = applyIssueDiffs(options.config.repo, preview.diffs, options.config.key);
  warnings.push(...attachSubIssues(options.tasks, issuesById, options.config.key));

  if (!options.skipProject) {
    warnings.push(...syncProject({
      repo: options.config.repo,
      projectNumber: options.config.projectNumber,
      fields: options.config.fields,
      tasks: options.tasks,
      issuesById,
      keyField: options.config.key,
    }));
  }

  for (const file of preview.files) upsertPlanningFile(options.config.repo, file);
  return warnings;
}
