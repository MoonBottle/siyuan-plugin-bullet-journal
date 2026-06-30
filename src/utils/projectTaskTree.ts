import type {
  Item,
  ItemStatus,
  Project,
  Task,
} from '@/types/models'

export interface MergedItem {
  isMerged: true
  blockId: string
  items: Item[]
  content: string
  status: Item['status']
  priority?: string
  dateRange: string
  firstItemId: string
}

export interface ProjectTaskTreeNode {
  task: Task
  items: (Item | MergedItem)[]
  children: ProjectTaskTreeNode[]
  depth: number
  orphaned: boolean
}

export interface ProjectTaskTreeFilterResult {
  nodes: ProjectTaskTreeNode[]
  matchedTaskBlockIds: Set<string>
  matchedItemBlockIds: Set<string>
  autoExpandedTaskBlockIds: Set<string>
}

export interface TaskItemProgress {
  total: number
  completed: number
  pending: number
  abandoned: number
}

export function buildProjectTaskTree(project: Project | null | undefined): ProjectTaskTreeNode[] {
  const roots: ProjectTaskTreeNode[] = []
  let lastL1: ProjectTaskTreeNode | null = null
  let lastL2: ProjectTaskTreeNode | null = null

  for (const task of project?.tasks ?? []) {
    const node: ProjectTaskTreeNode = {
      task,
      items: mergeItemsByBlockId(task.items ?? []),
      children: [],
      depth: 0,
      orphaned: false,
    }

    if (task.level === 'L1') {
      roots.push(node)
      lastL1 = node
      lastL2 = null
      continue
    }

    if (task.level === 'L2' && lastL1) {
      node.depth = lastL1.depth + 1
      lastL1.children.push(node)
      lastL2 = node
      continue
    }

    if (task.level === 'L3' && lastL2) {
      node.depth = lastL2.depth + 1
      lastL2.children.push(node)
      continue
    }

    if (task.level === 'L3' && lastL1) {
      node.depth = lastL1.depth + 1
      node.orphaned = true
      lastL1.children.push(node)
      continue
    }

    node.orphaned = (task.level as string) !== 'L1'
    roots.push(node)
    if (task.level === 'L2') {
      lastL2 = node
    }
  }

  return roots
}

export function filterProjectTaskTree(
  nodes: ProjectTaskTreeNode[],
  query: string,
  selectedTags?: string[],
  itemStatusFilter?: ItemStatus[],
): ProjectTaskTreeFilterResult {
  const normalizedQuery = normalizeSearchText(query)
  const normalizedTags = normalizeSelectedTags(selectedTags)
  const hasTagFilter = normalizedTags.size > 0
  const hasStatusFilter = itemStatusFilter && itemStatusFilter.length > 0
  const matchedTaskBlockIds = new Set<string>()
  const matchedItemBlockIds = new Set<string>()
  const autoExpandedTaskBlockIds = new Set<string>()

  if (!normalizedQuery && !hasTagFilter && !hasStatusFilter) {
    return {
      nodes,
      matchedTaskBlockIds,
      matchedItemBlockIds,
      autoExpandedTaskBlockIds,
    }
  }

  const filteredNodes = nodes
    .map((node) => filterNode(node, normalizedQuery, normalizedTags, hasTagFilter, hasStatusFilter, itemStatusFilter, matchedTaskBlockIds, matchedItemBlockIds, autoExpandedTaskBlockIds))
    .filter(Boolean) as ProjectTaskTreeNode[]

  return {
    nodes: filteredNodes,
    matchedTaskBlockIds,
    matchedItemBlockIds,
    autoExpandedTaskBlockIds,
  }
}

export function getTaskItemProgress(itemsOrTask: Task | (Item | MergedItem)[]): TaskItemProgress {
  const items = Array.isArray(itemsOrTask) ? itemsOrTask : (itemsOrTask.items ?? [])
  return items.reduce<TaskItemProgress>((progress, entry) => {
    const status: ItemStatus = 'isMerged' in entry ? (entry as MergedItem).status : (entry as Item).status
    progress.total += 1
    progress[status] += 1
    return progress
  }, {
    total: 0,
    completed: 0,
    pending: 0,
    abandoned: 0,
  })
}

export function getProjectItemCount(project: Project): number {
  return project.tasks.reduce((sum, task) => sum + (task.items?.length ?? 0), 0)
}

function filterNode(
  node: ProjectTaskTreeNode,
  query: string,
  normalizedTags: Set<string>,
  hasTagFilter: boolean,
  hasStatusFilter: boolean | undefined,
  itemStatusFilter: ItemStatus[] | undefined,
  matchedTaskBlockIds: Set<string>,
  matchedItemBlockIds: Set<string>,
  autoExpandedTaskBlockIds: Set<string>,
): ProjectTaskTreeNode | null {
  const taskMatches = !query || normalizeSearchText([
    node.task.name,
    node.task.level,
    node.task.date,
    node.task.startDateTime,
    node.task.endDateTime,
    ...(node.task.links ?? []).map((link) => link.name),
  ].filter(Boolean).join(' ')).includes(query)

  const matchedItems = node.items.filter((entry) => {
    if ('isMerged' in entry) {
      const mi = entry as MergedItem
      const matchQuery = !query || mi.content.toLowerCase().includes(query)
        || mi.dateRange.toLowerCase().includes(query)
        || mi.items.some((it) => itemMatchesQuery(it, query))
      const matchTags = !hasTagFilter || mi.items.some((it) => itemMatchesTags(it, normalizedTags))
      const matchStatus = !hasStatusFilter || mi.items.some((it) => itemMatchesStatus(it, itemStatusFilter!))
      return matchQuery && matchTags && matchStatus
    }
    const it = entry as Item
    return (!query || itemMatchesQuery(it, query))
      && (!hasTagFilter || itemMatchesTags(it, normalizedTags))
      && (!hasStatusFilter || itemMatchesStatus(it, itemStatusFilter!))
  })
  const children = node.children
    .map((child) => filterNode(child, query, normalizedTags, hasTagFilter, hasStatusFilter, itemStatusFilter, matchedTaskBlockIds, matchedItemBlockIds, autoExpandedTaskBlockIds))
    .filter(Boolean) as ProjectTaskTreeNode[]

  if (taskMatches && !hasTagFilter && !hasStatusFilter) {
    matchedTaskBlockIds.add(node.task.blockId ?? node.task.id)
    collectTaskBlockIds(node, autoExpandedTaskBlockIds)
    return cloneNode(node)
  }

  if (matchedItems.length > 0 || children.length > 0) {
    autoExpandedTaskBlockIds.add(node.task.blockId ?? node.task.id)
    matchedItems.forEach((entry) => {
      if ('isMerged' in entry) {
        matchedItemBlockIds.add((entry as MergedItem).blockId)
      } else {
        matchedItemBlockIds.add((entry as Item).blockId ?? (entry as Item).id)
      }
    })
    return {
      ...node,
      items: matchedItems,
      children,
    }
  }

  return null
}

function cloneNode(node: ProjectTaskTreeNode): ProjectTaskTreeNode {
  return {
    ...node,
    items: [...node.items],
    children: node.children.map(cloneNode),
  }
}

function collectTaskBlockIds(node: ProjectTaskTreeNode, ids: Set<string>) {
  ids.add(node.task.blockId ?? node.task.id)
  node.children.forEach((child) => collectTaskBlockIds(child, ids))
}

function itemMatchesQuery(item: Item, query: string): boolean {
  return normalizeSearchText([
    item.content,
    item.date,
    item.startDateTime,
    item.endDateTime,
    item.priority,
    item.focusPlan?.sourceText,
    ...(item.links ?? []).map((link) => link.name),
  ].filter(Boolean).join(' ')).includes(query)
}

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function normalizeSelectedTags(tags?: string[]): Set<string> {
  if (!tags || tags.length === 0) return new Set()
  return new Set(tags.map((t) => t.trim().toLocaleLowerCase()).filter(Boolean))
}

function itemMatchesTags(item: Item, normalizedTags: Set<string>): boolean {
  if (!item.tags || item.tags.length === 0) return false
  return item.tags.some((tag) => normalizedTags.has(tag.trim().toLocaleLowerCase()))
}

function itemMatchesStatus(item: Item, statusFilter: ItemStatus[]): boolean {
  return statusFilter.includes(item.status)
}

export function formatDateRange(start: string, end: string): string {
  if (start === end) return start
  const [sy, sm] = start.split('-')
  const [ey, em, ed] = end.split('-')
  if (sy === ey && sm === em) return `${start} ~ ${ed}`
  if (sy === ey) return `${start} ~ ${em}-${ed}`
  return `${start} ~ ${end}`
}

export function mergeItemsByBlockId(items: Item[]): (Item | MergedItem)[] {
  const groups = new Map<string, Item[]>()
  const order: string[] = []

  for (const it of items) {
    const key = it.blockId ?? it.id
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    groups.get(key)!.push(it)
  }

  const result: (Item | MergedItem)[] = []
  for (const key of order) {
    const group = groups.get(key)!
    if (group.length === 1) {
      result.push(group[0])
      continue
    }
    const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date))
    const first = sorted[0]
    const last = sorted.at(-1)
    result.push({
      isMerged: true,
      blockId: key,
      items: sorted,
      content: first.content,
      status: first.status,
      priority: first.priority,
      dateRange: formatDateRange(first.date, last.date),
      firstItemId: first.id,
    })
  }
  return result
}
