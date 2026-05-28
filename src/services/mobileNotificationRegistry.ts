export type MobileNotificationKind =
  | 'reminder'
  | 'habit'
  | 'pomodoro-focus-end'
  | 'pomodoro-break-end'

export type MobileNotificationRegistryStatus =
  | 'scheduled'
  | 'canceled'
  | 'stale'

export interface MobileNotificationRegistryEntry {
  entryKey: string
  notificationId: number
  scheduledAt: number
  delayInSeconds: number
  planKey: string
  kind: MobileNotificationKind
  status: MobileNotificationRegistryStatus
  updatedAt: string
}

type MobileNotificationRegistry = Record<string, MobileNotificationRegistryEntry>

const STORAGE_KEY = 'task-assistant-mobile-notification-registry'

const VALID_KINDS: MobileNotificationKind[] = [
  'reminder',
  'habit',
  'pomodoro-focus-end',
  'pomodoro-break-end',
]

const VALID_STATUSES: MobileNotificationRegistryStatus[] = [
  'scheduled',
  'canceled',
  'stale',
]

function persistRegistry(registry: MobileNotificationRegistry): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(registry))
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0
}

function sanitizeEntry(raw: unknown): MobileNotificationRegistryEntry | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const candidate = raw as Record<string, unknown>
  const entryKey = typeof candidate.entryKey === 'string' ? candidate.entryKey.trim() : ''
  const planKey = typeof candidate.planKey === 'string' ? candidate.planKey.trim() : ''
  const updatedAt = typeof candidate.updatedAt === 'string' ? candidate.updatedAt.trim() : ''
  const kind = candidate.kind
  const status = candidate.status
  const notificationId = Number(candidate.notificationId)
  const scheduledAt = Number(candidate.scheduledAt)
  const delayInSeconds = Number(candidate.delayInSeconds)

  if (!entryKey || !planKey || !updatedAt) {
    return null
  }

  if (!VALID_KINDS.includes(kind as MobileNotificationKind)) {
    return null
  }

  if (!VALID_STATUSES.includes(status as MobileNotificationRegistryStatus)) {
    return null
  }

  if (
    !isNonNegativeInteger(notificationId)
    || !isNonNegativeInteger(scheduledAt)
    || !isNonNegativeInteger(delayInSeconds)
  ) {
    return null
  }

  return {
    entryKey,
    notificationId,
    scheduledAt,
    delayInSeconds,
    planKey,
    kind: kind as MobileNotificationKind,
    status: status as MobileNotificationRegistryStatus,
    updatedAt,
  }
}

export function loadMobileNotificationRegistry(): MobileNotificationRegistry {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return {}
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    persistRegistry({})
    return {}
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    persistRegistry({})
    return {}
  }

  const registry: MobileNotificationRegistry = {}
  for (const [, value] of Object.entries(parsed as Record<string, unknown>)) {
    const entry = sanitizeEntry(value)
    if (entry) {
      registry[entry.entryKey] = entry
    }
  }

  persistRegistry(registry)
  return registry
}

export function saveMobileNotificationRegistryEntry(entry: MobileNotificationRegistryEntry): boolean {
  const sanitizedEntry = sanitizeEntry(entry)
  if (!sanitizedEntry) {
    console.warn('[MobileNotificationRegistry] Invalid registry entry rejected:', entry)
    return false
  }

  const registry = loadMobileNotificationRegistry()
  registry[sanitizedEntry.entryKey] = sanitizedEntry
  persistRegistry(registry)
  return true
}

export function removeMobileNotificationRegistryEntry(entryKey: string): void {
  const registry = loadMobileNotificationRegistry()
  delete registry[entryKey]
  persistRegistry(registry)
}

export function clearMobileNotificationRegistry(): void {
  localStorage.removeItem(STORAGE_KEY)
}
