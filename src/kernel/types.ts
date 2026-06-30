export interface TimerEntry {
  id: string
  type: 'reminder' | 'pomodoro' | 'break' | 'habit'
  endTime: number
  metadata: {
    blockId: string
    content: string
    projectName?: string
    taskName?: string
    target?: number
    unit?: string
  }
  notified: boolean
}

export interface WebhookConfig {
  enabled: boolean
  channels: WebhookChannel[]
}

export interface WebhookChannel {
  id: string
  name: string
  type: 'dingtalk' | 'feishu' | 'wecom' | 'custom'
  url: string
  enabled: boolean
  events: ('reminder' | 'pomodoro' | 'break' | 'habit')[]
  customTemplate?: {
    method: 'POST' | 'GET'
    headers: Record<string, string>
    bodyTemplate: string
  }
}

export interface ReminderConfig {
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

interface KernelDataGroup {
  id: string
  name: string
}

interface KernelDataProject {
  id: string
  name: string
  description: string | undefined
  path: string
  groupId: string | undefined
  taskCount: number
}

interface KernelDataItem {
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
  reminder?: ReminderConfig
  startTime?: string
  endTime?: string
}

export interface KernelDataHabit {
  id: string
  name: string
  type: string
  target?: number
  unit?: string
  reminder?: ReminderConfig
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
}

export interface KernelData {
  version: number
  updatedAt: string
  groups: KernelDataGroup[]
  projects: KernelDataProject[]
  items: KernelDataItem[]
  habits: KernelDataHabit[]
}
