import type { KernelData } from './types'

export function toolListGroups(_args: any, cache: KernelData) {
  return { groups: cache.groups || [] }
}

export function toolListProjects(args: any, cache: KernelData) {
  const filtered = args.groupId
    ? cache.projects.filter((p) => { return p.groupId === args.groupId })
    : cache.projects
  return { projects: filtered }
}

export function toolFilterItems(args: any, cache: KernelData) {
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

export function collectPomodoros(cache: KernelData) {
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
