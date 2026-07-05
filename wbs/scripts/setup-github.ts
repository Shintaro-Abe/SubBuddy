process.on('uncaughtException', (e) => {
  console.error(`\nERROR: ${(e as Error).message}`);
  process.exit(1);
});

import path from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../lib/config';
import { ghApiJson, ghGraphql, loadOwnerRef, parseRepo, runGh, type OwnerRef } from '../lib/github/gh';

const wbsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(wbsDir, 'wbs.config.yml');
const config = loadConfig(configPath);
if (!config.github) throw new Error('wbs.config.yml: github セクションがありません');

const repo = parseRepo(config.github.repo);
const title = process.argv.find((arg) => arg.startsWith('--title='))?.slice('--title='.length) || 'SubBuddy Planning';

runGh(['auth', 'status']);
ensureRepo(config.github.repo);
const projectNumber = ensureProject(repo.owner, title, config.github.projectNumber);
if (projectNumber !== config.github.projectNumber) updateProjectNumber(configPath, projectNumber);

console.log(`GitHub planning setup complete: ${config.github.repo} / Project #${projectNumber}`);

function ensureRepo(fullName: string): void {
  const existing = ghApiJson(`repos/${fullName}`, { silent404: true });
  if (existing) {
    console.log(`repo exists: ${fullName}`);
    return;
  }
  const { name } = parseRepo(fullName);
  ghApiJson('user/repos', {
    method: 'POST',
    body: {
      name,
      private: true,
      has_issues: true,
      has_projects: true,
      auto_init: true,
      description: 'Private planning repository for SubBuddy WBS and architecture diagrams.',
    },
  });
  console.log(`repo created: ${fullName}`);
}

function ensureProject(owner: string, projectTitle: string, configuredNumber: number | null): number {
  const ownerRef = loadOwnerRef(owner);
  if (configuredNumber && configuredNumber > 0 && projectExists(ownerRef, configuredNumber)) {
    console.log(`project exists: #${configuredNumber}`);
    return configuredNumber;
  }

  const mutation = `
    mutation($ownerId: ID!, $title: String!) {
      createProjectV2(input: { ownerId: $ownerId, title: $title }) {
        projectV2 { id number title }
      }
    }
  `;
  const data = ghGraphql<{ createProjectV2: { projectV2: { number: number } } }>(mutation, {
    ownerId: ownerRef.id,
    title: projectTitle,
  });
  console.log(`project created: #${data.createProjectV2.projectV2.number}`);
  return data.createProjectV2.projectV2.number;
}

function projectExists(owner: OwnerRef, number: number): boolean {
  const rootField = owner.kind === 'user' ? 'user' : 'organization';
  const query = `
    query($login: String!, $number: Int!) {
      ${rootField}(login: $login) { projectV2(number: $number) { id } }
    }
  `;
  const data = ghGraphql<Record<'user' | 'organization', { projectV2?: { id: string } | null } | null>>(query, {
    login: owner.login,
    number,
  });
  return Boolean(data[rootField]?.projectV2?.id);
}

function updateProjectNumber(file: string, projectNumber: number): void {
  const text = readFileSync(file, 'utf8');
  const next = text.replace(/projectNumber:\s*\d+/, `projectNumber: ${projectNumber}`);
  if (next === text) throw new Error('wbs.config.yml の projectNumber を更新できませんでした');
  writeFileSync(file, next);
  console.log(`wbs.config.yml updated: github.projectNumber=${projectNumber}`);
}
