import type {
  MobileNotificationKind,
  MobileNotificationRegistryEntry,
} from '@/services/mobileNotificationRegistry'
import type {
  Habit,
  Item,
} from '@/types/models'
import type { NativeScheduleFailureReason } from '@/utils/notification'
import { getCurrentPlugin } from '@/main'
import { calculateReminderTime } from '@/parser/reminderParser'
import { getHabitReminderEntries } from '@/services/habitReminder'
import {
  loadMobileNotificationRegistry,


  removeMobileNotificationRegistryEntry,
  saveMobileNotificationRegistryEntry,
} from '@/services/mobileNotificationRegistry'
import { useProjectStore } from '@/stores'
import dayjs from '@/utils/dayjs'
import {
  cancelNativeNotification,

  scheduleNativeNotificationWithDebug,
} from '@/utils/notification'

type ProjectStoreType = ReturnType<typeof useProjectStore>

const FUTURE_WINDOW_MS = 24 * 60 * 60 * 1000
const POMODORO_FOCUS_END_ENTRY_KEY = 'pomodoro:focus-end'
const POMODORO_BREAK_END_ENTRY_KEY = 'pomodoro:break-end'

type MobilePluginLike = {
  isMobile?: boolean
} | null | undefined

interface PomodoroFocusEndOptions {
  expectedEndAt: number
  itemContent?: string
  plugin?: MobilePluginLike
}

interface PomodoroBreakEndOptions {
  expectedEndAt: number
  breakLabel?: string
  plugin?: MobilePluginLike
}

interface MobileSchedulePlan {
  entryKey: string
  planKey: string
  kind: MobileNotificationKind
  scheduledAt: number
  delayInSeconds: number
  title: string
  body: string
  tag: string
}

export type MobileNotificationDebugComputedEntry = MobileSchedulePlan & {
  registryNotificationId: number | null
  registryStatus: string | null
  registryUpdatedAt: string | null
  lastNativeNotificationId: number | null
  lastScheduleResult: 'scheduled' | NativeScheduleFailureReason | null
}

export interface MobileNotificationDebugSnapshot {
  generatedAt: number
  currentDate: string
  computedEntries: MobileNotificationDebugComputedEntry[]
  registryEntries: MobileNotificationRegistryEntry[]
}

function makeReminderEntryKey(item: Item): string | null {
  if (!item.blockId)
    return null
  return `reminder:${item.blockId}:${item.date}`
}

function makeHabitEntryKey(habit: Habit, date: string): string {
  return `habit:${habit.blockId}:${date}`
}

function makePlanKey(plan: Omit<MobileSchedulePlan, 'planKey' | 'delayInSeconds' | 'entryKey'>): string {
  return JSON.stringify({
    kind: plan.kind,
    scheduledAt: plan.scheduledAt,
    title: plan.title,
    body: plan.body,
    tag: plan.tag,
  })
}

function buildReminderPlan(item: Item, scheduledAt: number, now: number): MobileSchedulePlan | null {
  const entryKey = makeReminderEntryKey(item)
  if (!entryKey)
    return null

  const title = `⏰ ${item.project?.name || '提醒'}`
  const body = item.task?.name
    ? `${item.task.name}: ${item.content}`
    : item.content
  const delayInSeconds = Math.ceil((scheduledAt - now) / 1000)

  const basePlan = {
    kind: 'reminder' as const,
    scheduledAt,
    title,
    body,
    tag: `reminder-${item.blockId}`,
  }

  return {
    entryKey,
    delayInSeconds,
    ...basePlan,
    planKey: makePlanKey(basePlan),
  }
}

function buildHabitPlan(habit: Habit, date: string, scheduledAt: number, now: number): MobileSchedulePlan {
  const title = `🎯 ${habit.name}`
  const body = habit.type === 'count'
    ? `${habit.name} ${habit.target || 0}${habit.unit || ''}`
    : habit.name
  const delayInSeconds = Math.ceil((scheduledAt - now) / 1000)

  const basePlan = {
    kind: 'habit' as const,
    scheduledAt,
    title,
    body,
    tag: `habit-reminder-${habit.blockId}`,
  }

  return {
    entryKey: makeHabitEntryKey(habit, date),
    delayInSeconds,
    ...basePlan,
    planKey: makePlanKey(basePlan),
  }
}

function isProjectSyncManagedKind(kind: MobileNotificationKind): boolean {
  return kind === 'reminder' || kind === 'habit'
}

export class MobileNotificationScheduler {
  private runtimeProjectStore: ProjectStoreType | null = null
  private visibilityHandler: (() => void) | null = null
  private midnightTimer: ReturnType<typeof setTimeout> | null = null
  private activeSync: Promise<void> | null = null
  private pendingSyncRequested = false
  private lastScheduleAttempts = new Map<string, {
    rawNotificationId: number | null
    result: 'scheduled' | NativeScheduleFailureReason
  }>()

  attachRuntime(projectStore: ProjectStoreType): void {
    this.runtimeProjectStore = projectStore
    this.setupVisibilityListener()
    this.scheduleNextMidnightSync()
  }

  detachRuntime(): void {
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler)
    }
    this.visibilityHandler = null

    if (this.midnightTimer) {
      clearTimeout(this.midnightTimer)
      this.midnightTimer = null
    }

    this.runtimeProjectStore = null
  }

  async scheduleSync(projectStore: ProjectStoreType): Promise<void> {
    this.runtimeProjectStore = projectStore

    if (this.activeSync) {
      this.pendingSyncRequested = true
      return this.activeSync
    }

    this.activeSync = this.runSyncLoop()
    try {
      await this.activeSync
    } finally {
      this.activeSync = null
    }
  }

  async syncFromProjects(projectStore: ProjectStoreType): Promise<void> {
    const nextPlans = this.collectPlans(projectStore)
    const registry = loadMobileNotificationRegistry()

    for (const [entryKey, existing] of Object.entries(registry)) {
      if (!isProjectSyncManagedKind(existing.kind))
        continue
      if (nextPlans.has(entryKey))
        continue

      cancelNativeNotification(existing.notificationId)
      removeMobileNotificationRegistryEntry(entryKey)
      this.lastScheduleAttempts.delete(entryKey)
    }

    for (const [entryKey, plan] of nextPlans) {
      await this.syncPlanEntry(registry, plan)
    }
  }

  isMobileNotificationsEnabled(plugin?: MobilePluginLike): boolean {
    const runtimePlugin = plugin ?? (getCurrentPlugin?.() as MobilePluginLike)
    return !!runtimePlugin?.isMobile
  }

  async schedulePomodoroFocusEnd(options: PomodoroFocusEndOptions): Promise<void> {
    if (!this.isMobileNotificationsEnabled(options.plugin))
      return

    await this.schedulePomodoroPlan(this.buildPomodoroFocusEndPlan(options))
  }

  cancelPomodoroFocusEnd(): void {
    this.cancelRegistryEntry(POMODORO_FOCUS_END_ENTRY_KEY)
  }

  async schedulePomodoroBreakEnd(options: PomodoroBreakEndOptions): Promise<void> {
    if (!this.isMobileNotificationsEnabled(options.plugin))
      return

    await this.schedulePomodoroPlan(this.buildPomodoroBreakEndPlan(options))
  }

  cancelPomodoroBreakEnd(): void {
    this.cancelRegistryEntry(POMODORO_BREAK_END_ENTRY_KEY)
  }

  getDebugSnapshot(projectStore: ProjectStoreType): MobileNotificationDebugSnapshot {
    const registry = loadMobileNotificationRegistry()
    const computedEntries = Array.from(this.collectPlans(projectStore).values())
      .sort((a, b) => a.scheduledAt - b.scheduledAt)
      .map((plan) => {
        const existing = registry[plan.entryKey]
        return {
          ...plan,
          registryNotificationId: existing?.notificationId ?? null,
          registryStatus: existing?.status ?? null,
          registryUpdatedAt: existing?.updatedAt ?? null,
          lastNativeNotificationId: this.lastScheduleAttempts.get(plan.entryKey)?.rawNotificationId
            ?? existing?.notificationId
            ?? null,
          lastScheduleResult: this.lastScheduleAttempts.get(plan.entryKey)?.result
            ?? (existing ? 'scheduled' : null),
        }
      })

    const computedEntryKeys = new Set(computedEntries.map((entry) => entry.entryKey))
    const registryEntries = Object.values(registry)
      .filter((entry) => !computedEntryKeys.has(entry.entryKey))
      .sort((a, b) => a.scheduledAt - b.scheduledAt)

    return {
      generatedAt: Date.now(),
      currentDate: projectStore.currentDate,
      computedEntries,
      registryEntries,
    }
  }

  private async runSyncLoop(): Promise<void> {
    do {
      this.pendingSyncRequested = false
      if (!this.runtimeProjectStore)
        return

      this.syncCurrentDateFromNow(this.runtimeProjectStore)
      await this.syncFromProjects(this.runtimeProjectStore)
    } while (this.pendingSyncRequested)
  }

  private setupVisibilityListener(): void {
    if (this.visibilityHandler || typeof document === 'undefined')
      return

    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible' && this.runtimeProjectStore) {
        void this.scheduleSync(this.runtimeProjectStore)
      }
    }

    document.addEventListener('visibilitychange', this.visibilityHandler)
  }

  private scheduleNextMidnightSync(): void {
    if (this.midnightTimer) {
      clearTimeout(this.midnightTimer)
      this.midnightTimer = null
    }

    const now = Date.now()
    const nextMidnight = dayjs(now).add(1, 'day').startOf('day').valueOf()
    this.midnightTimer = setTimeout(() => {
      if (this.runtimeProjectStore) {
        void this.scheduleSync(this.runtimeProjectStore)
      }
      this.scheduleNextMidnightSync()
    }, Math.max(1, nextMidnight - now))
  }

  private syncCurrentDateFromNow(projectStore: ProjectStoreType): void {
    const today = dayjs().format('YYYY-MM-DD')
    if (projectStore.currentDate === today)
      return

    if (typeof (projectStore as any).setCurrentDate === 'function') {
      (projectStore as any).setCurrentDate(today)
      return
    }

    projectStore.currentDate = today
  }

  private collectPlans(projectStore: ProjectStoreType): Map<string, MobileSchedulePlan> {
    const now = Date.now()
    const deadline = now + FUTURE_WINDOW_MS
    const plans = new Map<string, MobileSchedulePlan>()

    for (const project of projectStore.projects) {
      for (const task of project.tasks) {
        for (const item of task.items) {
          if (item.status === 'completed' || item.status === 'abandoned')
            continue
          if (!item.reminder?.enabled)
            continue

          const scheduledAt = calculateReminderTime(
            item.date,
            item.startDateTime,
            item.endDateTime,
            undefined,
            undefined,
            item.reminder,
          )

          if (scheduledAt <= now || scheduledAt >= deadline)
            continue

          const plan = buildReminderPlan(item, scheduledAt, now)
          if (plan) {
            plans.set(plan.entryKey, plan)
          }
        }
      }
    }

    const habits = typeof projectStore.getHabits === 'function'
      ? projectStore.getHabits('')
      : []

    for (const entry of getHabitReminderEntries(habits, projectStore.currentDate)) {
      if (entry.reminderTime <= now || entry.reminderTime >= deadline)
        continue

      const plan = buildHabitPlan(
        entry.habit,
        projectStore.currentDate,
        entry.reminderTime,
        now,
      )

      plans.set(plan.entryKey, plan)
    }

    return plans
  }

  private async schedulePomodoroPlan(plan: MobileSchedulePlan | null): Promise<void> {
    if (!plan) {
      return
    }

    const registry = loadMobileNotificationRegistry()
    await this.syncPlanEntry(registry, plan)
  }

  private buildPomodoroFocusEndPlan(options: PomodoroFocusEndOptions): MobileSchedulePlan | null {
    const now = Date.now()
    if (options.expectedEndAt <= now) {
      this.cancelPomodoroFocusEnd()
      return null
    }

    const itemContent = options.itemContent?.trim() || '当前专注'
    const delayInSeconds = Math.ceil((options.expectedEndAt - now) / 1000)
    const basePlan = {
      kind: 'pomodoro-focus-end' as const,
      scheduledAt: options.expectedEndAt,
      title: '🍅 专注结束',
      body: `「${itemContent}」专注时间已结束`,
      tag: 'pomodoro-focus-end',
    }

    return {
      entryKey: POMODORO_FOCUS_END_ENTRY_KEY,
      delayInSeconds,
      ...basePlan,
      planKey: makePlanKey(basePlan),
    }
  }

  private buildPomodoroBreakEndPlan(options: PomodoroBreakEndOptions): MobileSchedulePlan | null {
    const now = Date.now()
    if (options.expectedEndAt <= now) {
      this.cancelPomodoroBreakEnd()
      return null
    }

    const breakLabel = options.breakLabel?.trim() || '休息'
    const delayInSeconds = Math.ceil((options.expectedEndAt - now) / 1000)
    const basePlan = {
      kind: 'pomodoro-break-end' as const,
      scheduledAt: options.expectedEndAt,
      title: '☕ 休息结束',
      body: `${breakLabel}时间已结束`,
      tag: 'pomodoro-break-end',
    }

    return {
      entryKey: POMODORO_BREAK_END_ENTRY_KEY,
      delayInSeconds,
      ...basePlan,
      planKey: makePlanKey(basePlan),
    }
  }

  private async syncPlanEntry(
    registry: Record<string, {
      notificationId: number
      planKey: string
      status: string
    }>,
    plan: MobileSchedulePlan,
  ): Promise<void> {
    const existing = registry[plan.entryKey]
    if (existing?.status === 'scheduled' && existing.planKey === plan.planKey) {
      return
    }

    const scheduleAttempt = await scheduleNativeNotificationWithDebug(
      plan.title,
      plan.body,
      plan.delayInSeconds,
      { tag: plan.tag },
    )

    if (scheduleAttempt.notificationId === null) {
      this.lastScheduleAttempts.set(plan.entryKey, {
        rawNotificationId: scheduleAttempt.rawNotificationId,
        result: scheduleAttempt.failureReason ?? 'invalid-id',
      })
      return
    }

    this.lastScheduleAttempts.set(plan.entryKey, {
      rawNotificationId: scheduleAttempt.rawNotificationId,
      result: 'scheduled',
    })

    if (existing) {
      cancelNativeNotification(existing.notificationId)
      removeMobileNotificationRegistryEntry(plan.entryKey)
    }

    saveMobileNotificationRegistryEntry({
      entryKey: plan.entryKey,
      notificationId: scheduleAttempt.notificationId,
      scheduledAt: plan.scheduledAt,
      delayInSeconds: plan.delayInSeconds,
      planKey: plan.planKey,
      kind: plan.kind,
      status: 'scheduled',
      updatedAt: new Date().toISOString(),
    })
  }

  private cancelRegistryEntry(entryKey: string): void {
    const existing = loadMobileNotificationRegistry()[entryKey]
    if (!existing) {
      return
    }

    cancelNativeNotification(existing.notificationId)
    removeMobileNotificationRegistryEntry(entryKey)
    this.lastScheduleAttempts.delete(entryKey)
  }
}

export const mobileNotificationScheduler = new MobileNotificationScheduler()
