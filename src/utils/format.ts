import type { FocusPlan } from '@/types/models'
import { t } from '@/i18n'

/** 链接名称最大显示长度，超出则截断并 hover 显示全部 */
const LINK_NAME_MAX_LEN = 12

/** 格式化链接显示，返回截断后的 display 和可选的 fullText（用于 tooltip） */
export function formatLinkForDisplay(name: string): { display: string, fullText?: string } {
  if (!name || name.length <= LINK_NAME_MAX_LEN) {
    return { display: name }
  }
  return {
    display: `${name.slice(0, LINK_NAME_MAX_LEN)}...`,
    fullText: name,
  }
}

export type FocusPlanDisplayResult = { type: 'pomodoro', value: number } | { type: 'duration', value: string, minutes: number } | null

/** 格式化专注计划显示 */
export function getFocusPlanDisplay(plan?: FocusPlan): FocusPlanDisplayResult {
  if (!plan) return null
  if (plan.type === 'pomodoro') {
    return {
      type: 'pomodoro',
      value: plan.rawValue,
    }
  }
  // duration type: format compact minutes
  const minutes = plan.rawValue
  if (minutes < 60) {
    return {
      type: 'duration',
      value: `${minutes}m`,
      minutes,
    }
  }
  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  if (restMinutes === 0) {
    return {
      type: 'duration',
      value: `${hours}h`,
      minutes,
    }
  }
  return {
    type: 'duration',
    value: `${hours}h${restMinutes}m`,
    minutes,
  }
}

/** 格式化专注计划 tooltip */
export function getFocusPlanTooltip(plan?: FocusPlan): string {
  const display = getFocusPlanDisplay(plan)
  if (!display) return ''

  const fp = t('focusPlan')

  if (display.type === 'pomodoro') {
    return fp.tooltipPomodoro?.replace('{count}', String(display.value)).replace('{minutes}', String(display.value * 25)) || ''
  }

  // duration type
  const minutes = display.minutes
  if (minutes < 60) {
    return fp.tooltipDurationMinutes?.replace('{minutes}', String(minutes)) || ''
  }
  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  if (restMinutes === 0) {
    return fp.tooltipDurationHours?.replace('{hours}', String(hours)) || ''
  }
  return fp.tooltipDurationHoursMinutes?.replace('{hours}', String(hours)).replace('{minutes}', String(restMinutes)) || ''
}
