import { execFileSync } from 'node:child_process';

export interface RepoRef {
  owner: string;
  name: string;
}

export function parseRepo(repo: string): RepoRef {
  const [owner, name] = repo.split('/');
  if (!owner || !name) throw new Error(`GitHub repo は owner/name 形式で指定してください: ${repo}`);
  return { owner, name };
}

export function runGh(args: string[], input?: string): string {
  try {
    return execFileSync('gh', args, {
      encoding: 'utf8',
      input,
      maxBuffer: 64 * 1024 * 1024,
      stdio: input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
    });
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    const out = `${err.stdout ?? ''}${err.stderr ?? ''}`.trim();
    throw new Error(`gh 実行に失敗: gh ${args.join(' ')}\n${out || err.message}`);
  }
}

export function runGhJson<T>(args: string[], input?: string): T {
  const out = runGh(args, input).trim();
  if (!out) return undefined as T;
  return JSON.parse(out) as T;
}

export function ghApiJson<T>(apiPath: string, options?: { method?: string; body?: unknown; silent404?: boolean }): T | null {
  const args = ['api'];
  if (options?.method) args.push('--method', options.method);
  args.push(apiPath);
  if (options?.body !== undefined) args.push('--input', '-');
  try {
    return runGhJson<T>(args, options?.body === undefined ? undefined : JSON.stringify(options.body));
  } catch (e) {
    if (options?.silent404 && String((e as Error).message).includes('HTTP 404')) return null;
    throw e;
  }
}

export function ghGraphql<T>(query: string, variables: Record<string, unknown> = {}): T {
  return runGhJson<T>(['api', 'graphql', '--input', '-'], JSON.stringify({ query, variables }));
}
