import type {
  Habit,
  Item,
  Project,
  ProjectGroup,
} from '@/types/models'
import { putFile } from '@/api'

const TIME_EXTRACT_RE = /T(\d{2}:\d{2})/

export interface KernelData {
  version: 2
  updatedAt: string
  groups: Array<{ id: string, name: string }>
  projects: Array<{
    id: string
    name: string
    description: string | undefined
    path: string
    groupId: string | undefined
    taskCount: number
  }>
  items: Array<{
    id: string
    blockId: string | undefined
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
    reminder?: {
      enabled: boolean
      type: 'absolute' | 'relative'
      time?: string
      alertMode?: {
        type: 'ontime' | 'before' | 'custom'
        minutes?: number
      }
      relativeTo?: 'start' | 'end'
      offsetMinutes?: number
    }
    startTime?: string
    endTime?: string
  }>
  habits: Array<{
    id: string
    name: string
    type: string
    target?: number
    unit?: string
    reminder?: {
      enabled: boolean
      type: 'absolute' | 'relative'
      time?: string
      alertMode?: {
        type: 'ontime' | 'before' | 'custom'
        minutes?: number
      }
      relativeTo?: 'start' | 'end'
      offsetMinutes?: number
    }
    targetDate: string
    blockId: string
    startDate: string
    frequency?: {
      type: string
      interval?: number
      daysOfWeek?: number[]
      intervals?: number[]
    }
    records: Array<{
      date: string
      currentValue?: number
      status?: string
    }>
    durationDays?: number
    archivedAt?: string
  }>
}

const KERNEL_DATA_PATH = '/data/storage/petal/siyuan-plugin-bullet-journal/kernel-data.json'

function extractTime(dateTimeStr: string | undefined): string | undefined {
  if (!dateTimeStr) return undefined
  const match = dateTimeStr.match(TIME_EXTRACT_RE)
  return match ? match[1] : undefined
}

export async function writeKernelData(
  projects: Project[],
  items: Item[],
  groups: ProjectGroup[],
  habits: Habit[],
): Promise<void> {
  const data: KernelData = {
    version: 2,
    updatedAt: new Date().toISOString(),
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
    })),
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      path: p.path,
      groupId: p.groupId,
      taskCount: p.tasks.length,
    })),
    items: items.map((i) => ({
      id: i.id,
      blockId: i.blockId,
      content: i.content,
      date: i.date,
      startDateTime: i.startDateTime,
      endDateTime: i.endDateTime,
      status: i.status,
      projectName: i.project?.name,
      taskName: i.task?.name,
      projectId: i.project?.id ?? i.docId,
      links: i.links,
      pomodoros: (i.pomodoros ?? []).map((p) => ({
        id: p.id,
        date: p.date,
        startTime: p.startTime,
        endTime: p.endTime,
        durationMinutes: p.durationMinutes,
        actualDurationMinutes: p.actualDurationMinutes,
        description: p.description,
      })),
      reminder: i.reminder,
      startTime: extractTime(i.startDateTime),
      endTime: extractTime(i.endDateTime),
    })),
    habits: habits.map((h) => ({
      id: h.blockId,
      name: h.name,
      type: h.type,
      target: h.target,
      unit: h.unit,
      reminder: h.reminder,
      targetDate: h.startDate,
      blockId: h.blockId,
      startDate: h.startDate,
      frequency: h.frequency
        ? {
            type: h.frequency.type,
            interval: h.frequency.interval,
            daysOfWeek: h.frequency.daysOfWeek,
            intervals: h.frequency.type === 'ebbinghaus' ? h.frequency.intervals : undefined,
          }
        : undefined,
      records: (h.records ?? []).map((r) => ({
        date: r.date,
        currentValue: r.currentValue,
        status: r.status,
      })),
      durationDays: h.durationDays,
      archivedAt: h.archivedAt,
    })),
  }

  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  await putFile(KERNEL_DATA_PATH, false, blob)
}
