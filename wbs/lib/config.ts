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
  return cfg;
}
