import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { WbsConfig } from './types';

export function loadConfig(configPath: string): WbsConfig {
  const cfg = parse(readFileSync(configPath, 'utf8')) as WbsConfig;
  if (!cfg?.spreadsheet?.id) throw new Error('wbs.config.yml: spreadsheet.id がありません');
  if (!cfg.spreadsheet.sheets?.wbs) throw new Error('wbs.config.yml: spreadsheet.sheets.wbs がありません');
  if (!Array.isArray(cfg.columns) || cfg.columns.length === 0)
    throw new Error('wbs.config.yml: columns がありません');
  if (!cfg.key) cfg.key = 'id';
  if (!cfg.onMissing) cfg.onMissing = 'archive';
  if (cfg.github) {
    if (!cfg.github.repo) throw new Error('wbs.config.yml: github.repo がありません');
    if (!cfg.github.key) cfg.github.key = 'id';
    if (!cfg.github.onMissing) cfg.github.onMissing = 'keep';
    if (!cfg.github.gantt?.out) throw new Error('wbs.config.yml: github.gantt.out がありません');
    if (!cfg.github.diagrams?.out) throw new Error('wbs.config.yml: github.diagrams.out がありません');
  }
  return cfg;
}
