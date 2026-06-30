/**
 * 文件操作工具函数
 */
import type { Plugin } from 'siyuan'
import type {
  ItemDateTimeInfo,
  TimePrecision,
} from '@/types/models'
import { openTab } from 'siyuan'
import { sql } from '@/api'
import { usePlugin } from '@/main'

const TIME_FORMAT_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/
const DATE_PREFIX_RE = /@|📅/

function formatTimeToSeconds(timeStr: string): string {
  const match = timeStr.match(TIME_FORMAT_RE)
  if (!match) return timeStr

  const hours = match[1].padStart(2, '0')
  const minutes = match[2]
  const seconds = match[3] || '00'

  return `${hours}:${minutes}:${seconds}`
}

function formatTimeForPrecision(timeStr: string, precision: TimePrecision = 'second'): string {
  const normalized = formatTimeToSeconds(timeStr)
  return precision === 'minute' ? normalized.slice(0, 5) : normalized
}

function getTimePrecisionFromItem(item: ItemDateTimeInfo): TimePrecision {
  return item.timePrecision ?? 'second'
}

function buildDateTimeMark(date: string, timeKey?: string): string {
  if (!timeKey) {
    return `📅${date}`
  }

  return `📅${date} ${timeKey}`
}

function buildDateRangeMark(
  startDate: string,
  endDate: string,
  timeKey?: string,
): string {
  const startParts = startDate.split('-')
  const endParts = endDate.split('-')

  let datePart: string
  if (startParts[0] === endParts[0] && startParts[1] === endParts[1]) {
    datePart = `${startDate}~${endParts[1]}-${endParts[2]}`
  } else {
    datePart = `${startDate}~${endDate}`
  }

  if (timeKey) {
    return `📅${datePart} ${timeKey}`
  }

  return `📅${datePart}`
}

function groupDatesIntoRanges(dates: string[]): string[][] {
  if (dates.length === 0) return []

  const sortedDates = [...dates].sort()
  const ranges: string[][] = []
  let currentRange: string[] = [sortedDates[0]]

  for (let i = 1; i < sortedDates.length; i += 1) {
    const prevDate = new Date(sortedDates[i - 1])
    const currDate = new Date(sortedDates[i])
    const diffTime = currDate.getTime() - prevDate.getTime()
    const diffDays = diffTime / (1000 * 60 * 60 * 24)

    if (diffDays === 1) {
      currentRange.push(sortedDates[i])
    } else {
      ranges.push(currentRange)
      currentRange = [sortedDates[i]]
    }
  }

  ranges.push(currentRange)
  return ranges
}

function buildTimeKey(item: ItemDateTimeInfo): string {
  const precision = getTimePrecisionFromItem(item)
  const startTime = item.startDateTime?.split(' ')[1]
  const endTime = item.endDateTime?.split(' ')[1]

  if (!startTime) return ''
  if (!endTime) return formatTimeForPrecision(startTime, precision)
  return `${formatTimeForPrecision(startTime, precision)}~${formatTimeForPrecision(endTime, precision)}`
}

/**
 * 智能优化日期时间表达式
 * 将多个日期时间合并为最简表达方式
 * 按日期顺序排列，相同时间的连续日期合并为范围
 */
export function optimizeDateTimeExpressions(
  items: ItemDateTimeInfo[],
): string {
  if (items.length === 0) return ''

  const sortedItems = [...items].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime()
  })

  const timeGroups = new Map<string, typeof sortedItems>()
  for (const item of sortedItems) {
    const timeKey = buildTimeKey(item)
    if (!timeGroups.has(timeKey)) {
      timeGroups.set(timeKey, [])
    }
    timeGroups.get(timeKey)!.push(item)
  }

  const expressionList: Array<{ expr: string, startDate: string }> = []
  for (const [timeKey, groupItems] of timeGroups) {
    const dates = groupItems.map((item) => item.date)
    const ranges = groupDatesIntoRanges(dates)

    for (const range of ranges) {
      const expr = range.length === 1
        ? buildDateTimeMark(range[0], timeKey || undefined)
        : buildDateRangeMark(range[0], range.at(-1), timeKey || undefined)

      expressionList.push({
        expr,
        startDate: range[0],
      })
    }
  }

  expressionList.sort((a, b) => {
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  })

  const expressions = expressionList.map((item) => item.expr)
  if (expressions.length === 0) return ''

  const firstExpr = expressions[0]
  const restExprs = expressions.slice(1).map((expr) => expr.replace(DATE_PREFIX_RE, ''))
  return [firstExpr, ...restExprs].join(', ')
}

/**
 * 打开文档
 */
export async function openDocument(docId: string): Promise<boolean> {
  const plugin = usePlugin() as any
  if (!plugin || !docId) return false

  try {
    await openTab({
      app: plugin.app,
      doc: {
        id: docId,
      },
    })
    return true
  } catch (error) {
    console.error('[Task Assistant] Failed to open document:', error)
    return false
  }
}

/**
 * 打开文档并定位到特定块
 * @param pluginOrDocId 插件实例或文档 ID
 * @param docIdOrLineNumber 文档 ID 或行号
 * @param lineNumberOrBlockId 行号或块 ID
 * @param maybeBlockId 块 ID（可选，如果提供则直接定位到该块）
 */
export async function openDocumentAtLine(
  pluginOrDocId: Plugin | string,
  docIdOrLineNumber?: string | number,
  lineNumberOrBlockId?: number | string,
  maybeBlockId?: string,
): Promise<boolean> {
  const hasPluginOverride = typeof pluginOrDocId !== 'string'
  const plugin = (hasPluginOverride ? pluginOrDocId : usePlugin()) as any
  const docId = (hasPluginOverride ? docIdOrLineNumber : pluginOrDocId) as string | undefined
  const lineNumber = (hasPluginOverride ? lineNumberOrBlockId : docIdOrLineNumber) as number | undefined
  const blockId = (hasPluginOverride ? maybeBlockId : lineNumberOrBlockId) as string | undefined
  if (!plugin || !docId) return false

  try {
    let targetBlockId = blockId
    if (!targetBlockId && lineNumber) {
      targetBlockId = await getBlockIdByLine(docId, lineNumber)
    }

    if (targetBlockId) {
      await openTab({
        app: plugin.app,
        doc: {
          id: targetBlockId,
          action: ['cb-get-focus', 'cb-get-context', 'cb-get-hl'],
        },
      })
    } else {
      await openTab({
        app: plugin.app,
        doc: {
          id: docId,
        },
      })
    }

    return true
  } catch (error) {
    console.error('[Task Assistant] Failed to open document at line:', error)
    return false
  }
}

/**
 * 通过行号获取块 ID
 * 思源的块 ID 并不直接对应行号，这里通过查询文档中的块列表来近似定位
 */
async function getBlockIdByLine(docId: string, lineNumber: number): Promise<string | null> {
  try {
    const sqlQuery = `
      SELECT id, content, type
      FROM blocks
      WHERE root_id = '${docId}'
      AND type IN ('p', 'h', 'l', 'i')
      ORDER BY id ASC
      LIMIT 1 OFFSET ${Math.max(0, lineNumber - 1)}
    `

    const blocks = await sql(sqlQuery)
    if (blocks && blocks.length > 0) {
      return blocks[0].id
    }

    return null
  } catch (error) {
    console.error('[Task Assistant] Failed to get block id by line:', error)
    return null
  }
}
