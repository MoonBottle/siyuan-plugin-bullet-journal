import type { FocusPlan } from '@/types/models'

const FOCUS_PLAN_REGEX = /⏳(?:(\d+)h)?(?:(\d+)m)?|🍅x?(\d+)/g
const DURATION_MARKER_REGEX = /⏳(?:(\d+)h)?(?:(\d+)m)?/g
const POMODORO_MARKER_REGEX = /🍅x?(\d+)/g

export interface ExtractFocusPlanResult {
  active?: FocusPlan
  ignored: string[]
}

export function normalizeFocusPlanMinutes(plan: Pick<FocusPlan, 'type' | 'rawValue'>): number {
  return plan.type === 'pomodoro' ? plan.rawValue * 25 : plan.rawValue
}

function buildDurationPlan(sourceText: string, hours?: string, minutes?: string): FocusPlan | undefined {
  const totalMinutes = (Number(hours || 0) * 60) + Number(minutes || 0)
  if (!Number.isInteger(totalMinutes) || totalMinutes <= 0) {
    return undefined
  }

  return {
    type: 'duration',
    rawValue: totalMinutes,
    normalizedMinutes: totalMinutes,
    sourceText,
  }
}

function buildPomodoroPlan(sourceText: string, count?: string): FocusPlan | undefined {
  const rawValue = Number(count)
  if (!Number.isInteger(rawValue) || rawValue <= 0) {
    return undefined
  }

  return {
    type: 'pomodoro',
    rawValue,
    normalizedMinutes: normalizeFocusPlanMinutes({
      type: 'pomodoro',
      rawValue,
    }),
    sourceText,
  }
}

export function extractFocusPlanMarkers(line: string): ExtractFocusPlanResult {
  const found: Array<{ index: number, sourceText: string, plan: FocusPlan }> = []

  for (const match of line.matchAll(FOCUS_PLAN_REGEX)) {
    const sourceText = match[0]
    const index = match.index ?? Number.MAX_SAFE_INTEGER
    const plan = sourceText.startsWith('⏳')
      ? buildDurationPlan(sourceText, match[1], match[2])
      : buildPomodoroPlan(sourceText, match[3])

    if (plan) {
      found.push({
        index,
        sourceText,
        plan,
      })
    }
  }

  if (found.length === 0) {
    return { ignored: [] }
  }

  found.sort((a, b) => a.index - b.index)
  const [first, ...rest] = found

  return {
    active: {
      ...first.plan,
      ignoredSourceTexts: rest.length > 0 ? rest.map((item) => item.sourceText) : undefined,
    },
    ignored: rest.map((item) => item.sourceText),
  }
}

export function stripFocusPlanMarkers(line: string): string {
  return line
    .replace(DURATION_MARKER_REGEX, '')
    .replace(POMODORO_MARKER_REGEX, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

export function formatFocusPlanMarker(plan: Pick<FocusPlan, 'type' | 'rawValue'>): string {
  if (plan.type === 'pomodoro') {
    return `🍅x${plan.rawValue}`
  }

  const hours = Math.floor(plan.rawValue / 60)
  const minutes = plan.rawValue % 60

  if (hours === 0) {
    return `⏳${minutes}m`
  }
  if (minutes === 0) {
    return `⏳${hours}h`
  }
  return `⏳${hours}h${minutes}m`
}
