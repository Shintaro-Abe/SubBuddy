import type { GitHubConfig, Task } from '../types';
import type { GitHubIssue } from './issues';
import { ghGraphql, parseRepo } from './gh';

interface ProjectField {
  id: string;
  name: string;
  dataType: string;
  options?: Array<{ id: string; name: string }>;
}

interface ProjectState {
  id: string;
  fields: ProjectField[];
  itemsByContentId: Map<string, string>;
}

const STATUS_OPTIONS = ['未着手', '進行中', '完了', '保留'];

export function syncProject(options: {
  repo: string;
  projectNumber: number | null;
  fields: GitHubConfig['fields'];
  tasks: Task[];
  issuesById: Map<string, GitHubIssue>;
  keyField?: keyof Task;
}): string[] {
  const warnings: string[] = [];
  if (!options.projectNumber || options.projectNumber <= 0) {
    return ['Project 同期をスキップ: wbs.config.yml の github.projectNumber が未設定です'];
  }

  const keyField = options.keyField ?? 'id';
  const project = loadProject(options.repo, options.projectNumber);
  const fields = ensureFields(project, options.fields, options.tasks);

  for (const task of options.tasks) {
    const id = String(task[keyField]);
    const issue = options.issuesById.get(id);
    if (!issue) {
      warnings.push(`Project 追加をスキップ: Issue が見つかりません: ${id}`);
      continue;
    }
    try {
      const itemId = ensureProjectItem(project, issue.node_id);
      updateFieldValues(project.id, itemId, fields, task);
    } catch (e) {
      warnings.push(`Project 更新に失敗: ${id}: ${String((e as Error).message).split('\n')[0]}`);
    }
  }

  return warnings;
}

function loadProject(repo: string, projectNumber: number): ProjectState {
  const { owner } = parseRepo(repo);
  const query = `
    query($login: String!, $number: Int!, $after: String) {
      user(login: $login) {
        projectV2(number: $number) {
          id
          fields(first: 100) {
            nodes {
              __typename
              ... on ProjectV2FieldCommon { id name dataType }
              ... on ProjectV2SingleSelectField { id name dataType options { id name } }
            }
          }
          items(first: 100, after: $after) {
            nodes { id content { ... on Issue { id } } }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
      organization(login: $login) {
        projectV2(number: $number) {
          id
          fields(first: 100) {
            nodes {
              __typename
              ... on ProjectV2FieldCommon { id name dataType }
              ... on ProjectV2SingleSelectField { id name dataType options { id name } }
            }
          }
          items(first: 100, after: $after) {
            nodes { id content { ... on Issue { id } } }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    }
  `;

  const fields: ProjectField[] = [];
  const itemsByContentId = new Map<string, string>();
  let projectId = '';
  let after: string | null = null;
  do {
    type ProjectQueryResponse = {
      user?: { projectV2?: ProjectResponse | null } | null;
      organization?: { projectV2?: ProjectResponse | null } | null;
    };
    const data: ProjectQueryResponse = ghGraphql<ProjectQueryResponse>(query, { login: owner, number: projectNumber, after });
    const project: ProjectResponse | null | undefined = data.user?.projectV2 ?? data.organization?.projectV2;
    if (!project) throw new Error(`GitHub Project が見つかりません: ${owner} #${projectNumber}`);
    projectId = project.id;
    if (!fields.length) fields.push(...project.fields.nodes.filter(Boolean) as ProjectField[]);
    for (const item of project.items.nodes) {
      const contentId = item.content?.id;
      if (contentId) itemsByContentId.set(contentId, item.id);
    }
    after = project.items.pageInfo.hasNextPage ? project.items.pageInfo.endCursor : null;
  } while (after);

  return { id: projectId, fields, itemsByContentId };
}

interface ProjectResponse {
  id: string;
  fields: { nodes: unknown[] };
  items: {
    nodes: Array<{ id: string; content?: { id?: string } | null }>;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

function ensureFields(project: ProjectState, names: GitHubConfig['fields'], tasks: Task[]): RequiredFields {
  return {
    status: ensureSingleSelectField(project, names.status, STATUS_OPTIONS),
    phase: ensureSingleSelectField(project, names.phase, unique(tasks.map((t) => t.phase).filter(Boolean))),
    progress: ensureField(project, names.progress, 'NUMBER'),
    plannedStart: ensureField(project, names.plannedStart, 'DATE'),
    plannedEnd: ensureField(project, names.plannedEnd, 'DATE'),
    assignee: ensureField(project, names.assignee, 'TEXT'),
  };
}

interface RequiredFields {
  status: ProjectField;
  phase: ProjectField;
  progress: ProjectField;
  plannedStart: ProjectField;
  plannedEnd: ProjectField;
  assignee: ProjectField;
}

function ensureField(project: ProjectState, name: string, dataType: 'TEXT' | 'NUMBER' | 'DATE'): ProjectField {
  const existing = project.fields.find((field) => field.name === name);
  if (existing) return existing;
  const mutation = `
    mutation($projectId: ID!, $name: String!, $dataType: ProjectV2CustomFieldType!) {
      createProjectV2Field(input: { projectId: $projectId, name: $name, dataType: $dataType }) {
        projectV2Field { ... on ProjectV2FieldCommon { id name dataType } }
      }
    }
  `;
  const data = ghGraphql<{ createProjectV2Field: { projectV2Field: ProjectField } }>(mutation, {
    projectId: project.id,
    name,
    dataType,
  });
  project.fields.push(data.createProjectV2Field.projectV2Field);
  return data.createProjectV2Field.projectV2Field;
}

function ensureSingleSelectField(project: ProjectState, name: string, optionNames: string[]): ProjectField {
  const existing = project.fields.find((field) => field.name === name);
  if (existing) return existing;
  const options = optionNames.map((option, index) => ({ name: option, color: selectColor(index), description: '' }));
  const mutation = `
    mutation($projectId: ID!, $name: String!, $options: [ProjectV2SingleSelectFieldOptionInput!]!) {
      createProjectV2Field(input: { projectId: $projectId, name: $name, dataType: SINGLE_SELECT, singleSelectOptions: $options }) {
        projectV2Field { ... on ProjectV2SingleSelectField { id name dataType options { id name } } }
      }
    }
  `;
  const data = ghGraphql<{ createProjectV2Field: { projectV2Field: ProjectField } }>(mutation, {
    projectId: project.id,
    name,
    options,
  });
  project.fields.push(data.createProjectV2Field.projectV2Field);
  return data.createProjectV2Field.projectV2Field;
}

function ensureProjectItem(project: ProjectState, contentId: string): string {
  const existing = project.itemsByContentId.get(contentId);
  if (existing) return existing;
  const mutation = `
    mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
        item { id }
      }
    }
  `;
  const data = ghGraphql<{ addProjectV2ItemById: { item: { id: string } } }>(mutation, {
    projectId: project.id,
    contentId,
  });
  const itemId = data.addProjectV2ItemById.item.id;
  project.itemsByContentId.set(contentId, itemId);
  return itemId;
}

function updateFieldValues(projectId: string, itemId: string, fields: RequiredFields, task: Task): void {
  updateSingleSelect(projectId, itemId, fields.status, task.status);
  updateSingleSelect(projectId, itemId, fields.phase, task.phase);
  updateScalar(projectId, itemId, fields.progress, { number: task.progress });
  if (task.plannedStart) updateScalar(projectId, itemId, fields.plannedStart, { date: task.plannedStart });
  if (task.plannedEnd) updateScalar(projectId, itemId, fields.plannedEnd, { date: task.plannedEnd });
  if (task.assignee) updateScalar(projectId, itemId, fields.assignee, { text: task.assignee });
}

function updateSingleSelect(projectId: string, itemId: string, field: ProjectField, value: string): void {
  const option = field.options?.find((o) => o.name === value);
  if (!option) return;
  updateScalar(projectId, itemId, field, { singleSelectOptionId: option.id });
}

function updateScalar(projectId: string, itemId: string, field: ProjectField, value: Record<string, string | number>): void {
  const mutation = `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
      updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: $value }) {
        projectV2Item { id }
      }
    }
  `;
  ghGraphql(mutation, { projectId, itemId, fieldId: field.id, value });
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function selectColor(index: number): string {
  const colors = ['GRAY', 'BLUE', 'GREEN', 'YELLOW', 'PURPLE', 'PINK', 'RED', 'ORANGE'];
  return colors[index % colors.length]!;
}
