import type { Item, Project, Task } from '@/types/models';

export interface ProjectTaskTreeNode {
  task: Task;
  items: Item[];
  children: ProjectTaskTreeNode[];
  depth: number;
  orphaned: boolean;
}

export interface ProjectTaskTreeFilterResult {
  nodes: ProjectTaskTreeNode[];
  matchedTaskIds: Set<string>;
  matchedItemIds: Set<string>;
  autoExpandedTaskIds: Set<string>;
}

export interface TaskItemProgress {
  total: number;
  completed: number;
  pending: number;
  abandoned: number;
}

export function buildProjectTaskTree(project: Project | null | undefined): ProjectTaskTreeNode[] {
  const roots: ProjectTaskTreeNode[] = [];
  let lastL1: ProjectTaskTreeNode | null = null;
  let lastL2: ProjectTaskTreeNode | null = null;

  for (const task of project?.tasks ?? []) {
    const node: ProjectTaskTreeNode = {
      task,
      items: task.items ?? [],
      children: [],
      depth: 0,
      orphaned: false,
    };

    if (task.level === 'L1') {
      roots.push(node);
      lastL1 = node;
      lastL2 = null;
      continue;
    }

    if (task.level === 'L2' && lastL1) {
      node.depth = lastL1.depth + 1;
      lastL1.children.push(node);
      lastL2 = node;
      continue;
    }

    if (task.level === 'L3' && lastL2) {
      node.depth = lastL2.depth + 1;
      lastL2.children.push(node);
      continue;
    }

    if (task.level === 'L3' && lastL1) {
      node.depth = lastL1.depth + 1;
      node.orphaned = true;
      lastL1.children.push(node);
      continue;
    }

    node.orphaned = task.level !== 'L1';
    roots.push(node);
    if (task.level === 'L2') {
      lastL2 = node;
    }
  }

  return roots;
}

export function filterProjectTaskTree(
  nodes: ProjectTaskTreeNode[],
  query: string,
  selectedTags?: string[],
): ProjectTaskTreeFilterResult {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedTags = normalizeSelectedTags(selectedTags);
  const hasTagFilter = normalizedTags.size > 0;
  const matchedTaskIds = new Set<string>();
  const matchedItemIds = new Set<string>();
  const autoExpandedTaskIds = new Set<string>();

  if (!normalizedQuery && !hasTagFilter) {
    return {
      nodes,
      matchedTaskIds,
      matchedItemIds,
      autoExpandedTaskIds,
    };
  }

  const filteredNodes = nodes
    .map(node => filterNode(node, normalizedQuery, normalizedTags, hasTagFilter, matchedTaskIds, matchedItemIds, autoExpandedTaskIds))
    .filter(Boolean) as ProjectTaskTreeNode[];

  return {
    nodes: filteredNodes,
    matchedTaskIds,
    matchedItemIds,
    autoExpandedTaskIds,
  };
}

export function getTaskItemProgress(task: Task): TaskItemProgress {
  return (task.items ?? []).reduce<TaskItemProgress>((progress, item) => {
    progress.total += 1;
    progress[item.status] += 1;
    return progress;
  }, {
    total: 0,
    completed: 0,
    pending: 0,
    abandoned: 0,
  });
}

export function getProjectItemCount(project: Project): number {
  return project.tasks.reduce((sum, task) => sum + (task.items?.length ?? 0), 0);
}

function filterNode(
  node: ProjectTaskTreeNode,
  query: string,
  normalizedTags: Set<string>,
  hasTagFilter: boolean,
  matchedTaskIds: Set<string>,
  matchedItemIds: Set<string>,
  autoExpandedTaskIds: Set<string>,
): ProjectTaskTreeNode | null {
  const taskMatches = !query || normalizeSearchText([
    node.task.name,
    node.task.level,
    node.task.date,
    node.task.startDateTime,
    node.task.endDateTime,
    ...(node.task.links ?? []).map(link => link.name),
  ].filter(Boolean).join(' ')).includes(query);

  const matchedItems = node.items.filter(item =>
    (!query || itemMatchesQuery(item, query))
    && (!hasTagFilter || itemMatchesTags(item, normalizedTags)),
  );
  const children = node.children
    .map(child => filterNode(child, query, normalizedTags, hasTagFilter, matchedTaskIds, matchedItemIds, autoExpandedTaskIds))
    .filter(Boolean) as ProjectTaskTreeNode[];

  if (taskMatches && !hasTagFilter) {
    matchedTaskIds.add(node.task.id);
    collectTaskIds(node, autoExpandedTaskIds);
    return cloneNode(node);
  }

  if (matchedItems.length > 0 || children.length > 0) {
    autoExpandedTaskIds.add(node.task.id);
    matchedItems.forEach(item => matchedItemIds.add(item.id));
    return {
      ...node,
      items: matchedItems,
      children,
    };
  }

  return null;
}

function cloneNode(node: ProjectTaskTreeNode): ProjectTaskTreeNode {
  return {
    ...node,
    items: [...node.items],
    children: node.children.map(cloneNode),
  };
}

function collectTaskIds(node: ProjectTaskTreeNode, ids: Set<string>) {
  ids.add(node.task.id);
  node.children.forEach(child => collectTaskIds(child, ids));
}

function itemMatchesQuery(item: Item, query: string): boolean {
  return normalizeSearchText([
    item.content,
    item.date,
    item.startDateTime,
    item.endDateTime,
    item.priority,
    item.focusPlan?.sourceText,
    ...(item.links ?? []).map(link => link.name),
  ].filter(Boolean).join(' ')).includes(query);
}

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function normalizeSelectedTags(tags?: string[]): Set<string> {
  if (!tags || tags.length === 0) return new Set();
  return new Set(tags.map(t => t.trim().toLocaleLowerCase()).filter(Boolean));
}

function itemMatchesTags(item: Item, normalizedTags: Set<string>): boolean {
  if (!item.tags || item.tags.length === 0) return false;
  return item.tags.some(tag => normalizedTags.has(tag.trim().toLocaleLowerCase()));
}
