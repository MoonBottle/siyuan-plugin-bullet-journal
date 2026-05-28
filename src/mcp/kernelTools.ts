export interface McpCacheGroup {
  id: string
  name: string
}

export interface McpCacheProject {
  id: string
  name: string
  description: string | undefined
  path: string
  groupId: string | undefined
  taskCount: number
}

export interface McpCacheItem {
  id: string
  content: string
  date: string
  startDateTime: string | undefined
  endDateTime: string | undefined
  status: string
  projectName: string | undefined
  taskName: string | undefined
  projectId: string
  links: Array<{ name: string, url: string }> | undefined
  pomodoros: Array<{
    id: string
    date: string
    startTime: string
    endTime: string | undefined
    durationMinutes: number
    actualDurationMinutes: number | undefined
    description: string | undefined
  }>
}

export interface McpCache {
  version: number
  updatedAt: string
  groups: McpCacheGroup[]
  projects: McpCacheProject[]
  items: McpCacheItem[]
}

export function toolListGroups(_args: any, cache: McpCache) {
  return { groups: cache.groups || [] }
}

export function toolListProjects(args: any, cache: McpCache) {
  const filtered = args.groupId
    ? cache.projects.filter((p) => { return p.groupId === args.groupId })
    : cache.projects
  return { projects: filtered }
}

export function toolFilterItems(args: any, cache: McpCache) {
  let items = cache.items || []

  if (args.projectId) {
    items = items.filter((i) => { return i.projectId === args.projectId })
  } else if (args.projectIds && args.projectIds.length > 0) {
    const set = new Set(args.projectIds)
    items = items.filter((i) => { return set.has(i.projectId) })
  } else if (args.groupId) {
    const projectIds = new Set(
      cache.projects
        .filter((p) => { return p.groupId === args.groupId })
        .map((p) => { return p.id }),
    )
    items = items.filter((i) => { return projectIds.has(i.projectId) })
  }

  if (args.startDate) {
    items = items.filter((i) => { return i.date >= args.startDate })
  }
  if (args.endDate) {
    items = items.filter((i) => { return i.date <= args.endDate })
  }
  if (args.status) {
    items = items.filter((i) => { return i.status === args.status })
  }

  return { items }
}

export function collectPomodoros(cache: McpCache) {
  const pomodoros: Array<any> = []
  const seen = new Set<string>()
  for (const item of cache.items) {
    if (item.pomodoros) {
      for (const p of item.pomodoros) {
        if (!seen.has(p.id)) {
          seen.add(p.id)
          pomodoros.push({
            id: p.id,
            date: p.date,
            startTime: p.startTime,
            endTime: p.endTime,
            durationMinutes: p.durationMinutes,
            actualDurationMinutes: p.actualDurationMinutes,
            description: p.description,
            itemContent: item.content,
            projectName: item.projectName,
            projectId: item.projectId,
          })
        }
      }
    }
  }
  return pomodoros
}

export function filterPomodoros(pomodoros: any[], args: any) {
  let filtered = pomodoros
  const todayDate = new Date().toISOString().slice(0, 10)
  let startDate = args.startDate
  let endDate = args.endDate

  if (args.date === 'today') {
    startDate = todayDate
    endDate = todayDate
  }
  if (startDate) {
    filtered = filtered.filter((p) => { return p.date >= startDate })
  }
  if (endDate) {
    filtered = filtered.filter((p) => { return p.date <= endDate })
  }
  if (args.projectId) {
    filtered = filtered.filter((p) => { return p.projectId === args.projectId })
  }
  return filtered
}
