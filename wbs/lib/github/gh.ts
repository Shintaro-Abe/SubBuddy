import { execFileSync } from 'node:child_process';

export interface RepoRef {
  owner: string;
  name: string;
}

export interface OwnerRef {
  login: string;
  id: string;
  kind: 'user' | 'organization';
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
  const isWrite = isWriteMethod(options?.method);
  if (isWrite) waitForGitHubWriteSlot();
  try {
    return runGhJson<T>(args, options?.body === undefined ? undefined : JSON.stringify(options.body));
  } catch (e) {
    if (options?.silent404 && String((e as Error).message).includes('HTTP 404')) return null;
    throw e;
  } finally {
    if (isWrite) markGitHubWrite();
  }
}

export function ghGraphql<T>(query: string, variables: Record<string, unknown> = {}): T {
  const isWrite = /\bmutation\b/.test(query);
  if (isWrite) waitForGitHubWriteSlot();
  try {
    const response = runGhJson<GraphqlResponse<T>>(
      ['api', 'graphql', '--input', '-'],
      JSON.stringify({ query, variables }),
    );
    return response.data;
  } finally {
    if (isWrite) markGitHubWrite();
  }
}

interface GraphqlResponse<T> {
  data: T;
}

export function loadOwnerRef(login: string): OwnerRef {
  const user = loadUserOwner(login);
  if (user) return user;
  const organization = loadOrganizationOwner(login);
  if (organization) return organization;
  throw new Error(`GitHub owner が見つかりません: ${login}`);
}

function loadUserOwner(login: string): OwnerRef | null {
  const query = `
    query($login: String!) {
      user(login: $login) { id }
    }
  `;
  const data = ghGraphqlOrNull<{ user?: { id: string } | null }>(query, { login });
  const id = data?.user?.id;
  return id ? { login, id, kind: 'user' } : null;
}

function loadOrganizationOwner(login: string): OwnerRef | null {
  const query = `
    query($login: String!) {
      organization(login: $login) { id }
    }
  `;
  const data = ghGraphqlOrNull<{ organization?: { id: string } | null }>(query, { login });
  const id = data?.organization?.id;
  return id ? { login, id, kind: 'organization' } : null;
}

function ghGraphqlOrNull<T>(query: string, variables: Record<string, unknown>): T | null {
  try {
    return ghGraphql<T>(query, variables);
  } catch (e) {
    if (isGraphqlNotFound(e)) return null;
    throw e;
  }
}

function isGraphqlNotFound(e: unknown): boolean {
  const message = String((e as Error).message);
  return message.includes('NOT_FOUND') || message.includes('Could not resolve to');
}

const DEFAULT_WRITE_DELAY_MS = 2_000;
let lastGitHubWriteAt = 0;

function isWriteMethod(method: string | undefined): boolean {
  return method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE';
}

function githubWriteDelayMs(): number {
  const raw = process.env.WBS_GITHUB_WRITE_DELAY_MS;
  if (!raw) return DEFAULT_WRITE_DELAY_MS;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_WRITE_DELAY_MS;
}

function waitForGitHubWriteSlot(): void {
  const delayMs = githubWriteDelayMs();
  if (delayMs <= 0 || lastGitHubWriteAt <= 0) return;
  const waitMs = delayMs - (Date.now() - lastGitHubWriteAt);
  if (waitMs > 0) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, waitMs);
  }
}

function markGitHubWrite(): void {
  lastGitHubWriteAt = Date.now();
}
