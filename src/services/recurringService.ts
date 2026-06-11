/**
 * 重复事项服务
 * 处理完成时自动创建下次 occurrence
 */

import type { Plugin } from 'siyuan'
import type { Item } from '@/types/models'
import { getBlockKramdown } from '@/api'
import {
  checkEndCondition,
  generateEndConditionMarker,
  generateRepeatRuleMarker,
  getNextOccurrenceDate,
  stripRecurringMarkers,
} from '@/parser/recurringParser'
import {
  generateReminderMarker,
  stripReminderMarker,
} from '@/parser/reminderParser'
import {
  insertBlockAfter,
  writeBlock,
} from '@/utils/blockWriter'
import { extractTimePart } from '@/utils/blockWriter/intent/itemPatches'
import { applyBlockPatch } from '@/utils/blockWriter/render/kramdownModifier'
import {
  insertMarkerBeforeFirst,
  normalizeMarkerLine,
  parseMarkerLine,
  removeMarker,
  upsertMarker,
} from '@/utils/blockWriter/render/markerCluster'
import { splitKramdownBlock } from '@/utils/blockWriter/shared/kramdownBlocks'

const DATE_MARKER_RE = /(?:@|📅)\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}:\d{2}(?:~\d{2}:\d{2}:\d{2})?)?/gu
const STATUS_ICON_RE = /[✅❌]/gu

/**
 * 检查是否需要创建下次
 */
export function shouldCreateNextOccurrence(item: Item): boolean {
  // 必须有重复规则
  if (!item.repeatRule) return false

  // 必须已完成
  if (item.status !== 'completed') return false

  // 检查结束条件
  const nextDate = getNextOccurrenceDate(item.date, item.repeatRule)
  const checkResult = checkEndCondition(nextDate, item.endCondition)

  if (!checkResult.canCreate) {
    console.log(`[RecurringService] Cannot create next: ${checkResult.reason}`)
    return false
  }

  return true
}

function decrementEndCondition(endCondition?: Item['endCondition']) {
  if (!endCondition) {
    return undefined
  }

  if (endCondition.type === 'count' && endCondition.maxCount !== undefined) {
    const nextCount = endCondition.maxCount - 1
    return nextCount > 0
      ? {
          ...endCondition,
          maxCount: nextCount,
        }
      : undefined
  }

  return endCondition
}

function buildNextOccurrenceBlockFallback(item: Item, nextDate: string, nextEndCondition?: Item['endCondition']): string {
  // Strip status and date markers from content, keep all other markers (📌, 🔥, etc.)
  const cleanedContent = stripRecurringMarkers(stripReminderMarker(item.content))
    .replace(DATE_MARKER_RE, '')
    .replace(STATUS_ICON_RE, '')
    .trim()

  // Build new date expression
  let dateExpr = `📅${nextDate}`
  if (item.startDateTime && item.endDateTime) {
    const startTime = item.startDateTime.split(' ')[1]
    const endTime = item.endDateTime.split(' ')[1]
    dateExpr = `📅${nextDate} ${startTime}~${endTime}`
  } else if (item.startDateTime) {
    const startTime = item.startDateTime.split(' ')[1]
    dateExpr = `📅${nextDate} ${startTime}`
  }

  // Use markerCluster to preserve original marker order
  let parsed = parseMarkerLine(cleanedContent)

  // Remove status markers
  parsed = removeMarker(parsed, 'status')

  // Insert/update date marker (preserve position if exists, otherwise insert before first marker)
  const hasDateMarker = parsed.markers.some((m) => m.kind === 'date')
  if (hasDateMarker) {
    parsed = upsertMarker(parsed, 'date', dateExpr)
  } else {
    parsed = insertMarkerBeforeFirst(parsed, 'date', dateExpr)
  }

  // Insert/update reminder marker
  if (item.reminder?.enabled) {
    const reminderExpr = generateReminderMarker(item.reminder)
    parsed = upsertMarker(parsed, 'reminder', reminderExpr)
  } else {
    parsed = removeMarker(parsed, 'reminder')
  }

  // Insert/update recurring marker
  if (item.repeatRule) {
    let recurringExpr = generateRepeatRuleMarker(item.repeatRule)
    if (nextEndCondition) {
      recurringExpr += ` ${generateEndConditionMarker(nextEndCondition)}`
    }
    parsed = upsertMarker(parsed, 'recurring', recurringExpr)
  }

  let result = normalizeMarkerLine(parsed)
  if (item.isTaskList) {
    result = `- [ ] ${result}`
  }
  return result
}

/**
 * 创建下次 occurrence
 * @param _plugin 插件实例
 * @param item 当前事项
 * @returns 是否成功创建
 */
export async function createNextOccurrence(
  _plugin: Plugin,
  item: Item,
): Promise<boolean> {
  if (!item.repeatRule || !item.blockId) return false

  // 计算下次日期
  const nextDate = getNextOccurrenceDate(item.date, item.repeatRule)

  // 检查结束条件
  const checkResult = checkEndCondition(nextDate, item.endCondition)
  if (!checkResult.canCreate) {
    console.log(`[RecurringService] ${checkResult.reason}`)
    return false
  }

  try {
    const nextEndCondition = decrementEndCondition(item.endCondition)
    const startTime = extractTimePart(item.startDateTime)
    const endTime = extractTimePart(item.endDateTime)

    // Get source kramdown to preserve original marker order
    const sourceKramdown = item.blockId
      ? (await getBlockKramdown(item.blockId))?.kramdown ?? null
      : null

    let newBlockContent: string
    if (sourceKramdown) {
      // Use applyBlockPatch to preserve original marker order
      let markdown = applyBlockPatch(
        splitKramdownBlock(sourceKramdown),
        {
          type: 'setStatus',
          status: 'pending',
        },
      )

      markdown = applyBlockPatch(
        splitKramdownBlock(markdown),
        {
          type: 'addDate',
          date: nextDate,
          originalDate: item.date,
          startTime,
          endTime,
          allDay: !startTime && !endTime,
          timePrecision: item.timePrecision,
        },
      )

      markdown = applyBlockPatch(
        splitKramdownBlock(markdown),
        {
          type: 'setReminder',
          reminder: item.reminder?.enabled ? item.reminder : undefined,
        },
      )

      markdown = applyBlockPatch(
        splitKramdownBlock(markdown),
        {
          type: 'setRecurring',
          repeatRule: item.repeatRule,
          endCondition: nextEndCondition,
        },
      )

      newBlockContent = markdown
    } else {
      newBlockContent = buildNextOccurrenceBlockFallback(item, nextDate, nextEndCondition)
    }

    // 确定插入点：
    // 1. 对于任务列表事项，使用 listItemBlockId（在列表项后面插入，保持平级）
    // 2. 其他情况使用 lastBlockId（在相关内容后面插入）
    const insertAfterId = item.isTaskList
      ? (item.listItemBlockId || item.blockId)
      : (item.lastBlockId || item.blockId)

    if (!insertAfterId) {
      console.error('[RecurringService] No insert point found')
      return false
    }

    console.log(`[RecurringService] Inserting after block: ${insertAfterId}, isTaskList: ${item.isTaskList}`)

    // 在最后一个相关块后插入新事项
    const result = await insertBlockAfter(insertAfterId, {
      type: 'replaceMarkdown',
      markdown: newBlockContent,
    })

    if (result) {
      console.log(`[RecurringService] Created next occurrence: ${nextDate}`)
      return true
    }

    return false
  } catch (error) {
    console.error('[RecurringService] Failed to create next occurrence:', error)
    return false
  }
}

/**
 * 跳过本次（直接修改当前事项日期）
 * @param _plugin 插件实例
 * @param item 当前事项
 * @returns 是否成功修改
 */
export async function skipCurrentOccurrence(
  _plugin: Plugin,
  item: Item,
): Promise<boolean> {
  if (!item.repeatRule || !item.blockId) return false

  const nextDate = getNextOccurrenceDate(item.date, item.repeatRule)
  const nextEndCondition = decrementEndCondition(item.endCondition)
  const startTime = extractTimePart(item.startDateTime)
  const endTime = extractTimePart(item.endDateTime)

  try {
    const result = await writeBlock(
      { blockId: item.blockId },
      [
        {
          type: 'setStatus',
          status: 'pending',
        },
        {
          type: 'addDate',
          date: nextDate,
          originalDate: item.date,
          startTime,
          endTime,
          allDay: !startTime && !endTime,
          timePrecision: item.timePrecision,
        },
        {
          type: 'setReminder',
          reminder: item.reminder?.enabled ? item.reminder : undefined,
        },
        {
          type: 'setRecurring',
          repeatRule: item.repeatRule,
          endCondition: nextEndCondition,
        },
      ],
    )

    if (result) {
      console.log(`[RecurringService] Skipped to: ${nextDate}`)
      return true
    }

    return false
  } catch (error) {
    console.error('[RecurringService] Failed to skip occurrence:', error)
    return false
  }
}

/**
 * 检查事项是否过期
 */
export function isItemExpired(item: Item): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const itemDate = new Date(item.date)
  itemDate.setHours(0, 0, 0, 0)

  return itemDate <= today && item.status === 'pending'
}
