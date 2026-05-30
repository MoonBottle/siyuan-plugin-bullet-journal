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

function buildNextOccurrenceBlockFallback(item: Item, nextDate: string): string {
  const {
    reminder,
    repeatRule,
  } = item
  const endCondition = decrementEndCondition(item.endCondition)

  const content = stripRecurringMarkers(stripReminderMarker(item.content))
    .replace(DATE_MARKER_RE, '')
    .replace(STATUS_ICON_RE, '')
    .trim()

  let datePart = `📅${nextDate}`
  if (item.startDateTime && item.endDateTime) {
    const startTime = item.startDateTime.split(' ')[1]
    const endTime = item.endDateTime.split(' ')[1]
    datePart = `📅${nextDate} ${startTime}~${endTime}`
  } else if (item.startDateTime) {
    const startTime = item.startDateTime.split(' ')[1]
    datePart = `📅${nextDate} ${startTime}`
  }

  const reminderPart = reminder?.enabled ? ` ${generateReminderMarker(reminder)}` : ''
  const repeatPart = repeatRule ? ` ${generateRepeatRuleMarker(repeatRule)}` : ''
  const endConditionPart = endCondition ? ` ${generateEndConditionMarker(endCondition)}` : ''

  let result = `${content} ${datePart}${reminderPart}${repeatPart}${endConditionPart}`.trim()
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
    const newBlockContent = await buildNextOccurrenceBlock(item, nextDate)

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

async function buildNextOccurrenceBlock(item: Item, nextDate: string): Promise<string> {
  const sourceKramdown = item.blockId
    ? (await getBlockKramdown(item.blockId))?.kramdown ?? null
    : null

  if (!sourceKramdown) {
    return buildNextOccurrenceBlockFallback(item, nextDate)
  }

  const nextEndCondition = decrementEndCondition(item.endCondition)
  const startTime = extractTimePart(item.startDateTime)
  const endTime = extractTimePart(item.endDateTime)

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

  return markdown
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

  // 计算下次日期
  const nextDate = getNextOccurrenceDate(item.date, item.repeatRule)

  try {
    const newBlockContent = await buildNextOccurrenceBlock(item, nextDate)

    // 更新当前 block
    const result = await writeBlock(
      { blockId: item.blockId },
      {
        type: 'replaceMarkdown',
        markdown: newBlockContent,
      },
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
