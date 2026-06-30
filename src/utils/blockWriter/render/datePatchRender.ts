import type {
  ItemDateTimeInfo,
  ItemStatus,
  TimePrecision,
} from '@/types/models'
import type { DatePatch } from '@/utils/blockWriter/shared/types'
import { ALL_SLASH_COMMAND_FILTERS } from '@/constants'
import {
  parseKramdownBlocks,
  stripListAndBlockAttr,
} from '@/parser/core'
import { isStandaloneBlockRefLine } from '@/parser/lineParser'
import {
  insertMarkerBeforeFirst,
  normalizeMarkerLine,
  parseMarkerLine,
  removeMarker,
  upsertMarker,
} from '@/utils/blockWriter/render/markerCluster'
import {
  isTaskListFormat,
  statusToLabel,
} from '@/utils/blockWriter/shared/itemLineMarkers'
import { processLineText } from '@/utils/slashCommandUtils'

const TIME_PART_PATTERN = '\\d{2}:\\d{2}(?::\\d{2})?'
const TIME_RANGE_PATTERN = `${TIME_PART_PATTERN}(?:~${TIME_PART_PATTERN})?`
const DATE_MARKER_PATTERN = `(?:@|📅)\\d{4}-\\d{2}-\\d{2}(?:~\\d{4}-\\d{2}-\\d{2}|~\\d{2}-\\d{2})?(?:\\s+${TIME_RANGE_PATTERN})?`
const DATE_MARKER_REGEX = new RegExp(DATE_MARKER_PATTERN, 'g')
const RESIDUAL_DATE_MARKER_REGEX = new RegExp(`[，,]\\s*\\d{4}-\\d{2}-\\d{2}(?:~\\d{4}-\\d{2}-\\d{2}|~\\d{2}-\\d{2})?(?:\\s+${TIME_RANGE_PATTERN})?`, 'g')
const COMPLETED_MARKERS_RE = /#done|#已完成|✅/u
const ABANDONED_MARKERS_RE = /#abandoned|#已放弃|❌/u
const TIME_FORMAT_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/
const DATE_PREFIX_RE = /(?:@|📅)\d{4}-\d{2}-\d{2}/
const DATE_MARKER_PREFIX_RE = /^(?:@|📅)/
const TASK_DONE_CHECK_RE = /\[\s*x\s*\]/i
const STATUS_MARKERS_RE = /#done|#abandoned|#已完成|#已放弃|[✅❌]/g
const BLOCK_ATTR_SUFFIX_RE = /\n\{:[^}]*\}/g

export interface DatePatchRenderContext {
  originalBlockId: string
  sourceBlockId: string
  targetItemBlockRaw: string | null
  usedParentDocumentContext: boolean
  finalTargetBlockId: string
}

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

function findPrimaryItemLineIndex(lines: string[]): number {
  let fallbackIndex = -1

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i]
    const trimmedLine = rawLine.trim()
    if (!trimmedLine || trimmedLine.startsWith('{:') || trimmedLine.startsWith('🍅')) {
      continue
    }

    const strippedLine = stripListAndBlockAttr(rawLine)
    if (!strippedLine || isStandaloneBlockRefLine(strippedLine)) {
      continue
    }

    if (fallbackIndex === -1) {
      fallbackIndex = i
    }

    if (DATE_PREFIX_RE.test(strippedLine)) {
      return i
    }
  }

  return fallbackIndex
}

function findBlockStartLineIndex(lines: string[], blockRaw: string): number {
  const rawLines = blockRaw.split('\n')
  if (rawLines.length === 0 || rawLines.length > lines.length) {
    return -1
  }

  for (let start = 0; start <= lines.length - rawLines.length; start += 1) {
    let matches = true
    for (let offset = 0; offset < rawLines.length; offset += 1) {
      if (lines[start + offset] !== rawLines[offset]) {
        matches = false
        break
      }
    }
    if (matches) {
      return start
    }
  }

  return -1
}

function buildDateTimeMark(date: string, timeKey?: string): string {
  if (!timeKey) {
    return `📅${date}`
  }
  return `📅${date} ${timeKey}`
}

function buildDateRangeMark(startDate: string, endDate: string, timeKey?: string): string {
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

function optimizeDateTimeExpressions(items: ItemDateTimeInfo[]): string {
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
    const dates = groupItems.map((i) => i.date)
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
  const restExprs = expressions.slice(1).map((expr) => expr.replace(DATE_MARKER_PREFIX_RE, ''))
  return [firstExpr, ...restExprs].join(', ')
}

function inferStatus(line: string, fallback?: ItemStatus): ItemStatus {
  if (fallback) {
    return fallback
  }
  if (ABANDONED_MARKERS_RE.test(line)) {
    return 'abandoned'
  }
  if (TASK_DONE_CHECK_RE.test(line) || COMPLETED_MARKERS_RE.test(line)) {
    return 'completed'
  }
  return 'pending'
}

function buildTaskListMarker(status: ItemStatus): string {
  return status === 'completed' ? '[x] ' : '[ ] '
}

function buildStatusSuffix(status: ItemStatus, taskList: boolean): string {
  if (status === 'pending') {
    return ''
  }
  if (taskList && status === 'completed') {
    return ''
  }
  const label = statusToLabel(status)
  return label ? ` ${label}` : ''
}

function buildUpdatedDateItems(
  patch: DatePatch,
  formattedStartTime?: string,
  formattedEndTime?: string,
): ItemDateTimeInfo[] {
  const allItems: ItemDateTimeInfo[] = patch.siblingItems ? [...patch.siblingItems] : []
  const updatedItem = {
    date: patch.date,
    startDateTime: patch.allDay ? undefined : (formattedStartTime ? `${patch.date} ${formattedStartTime}` : undefined),
    endDateTime: patch.allDay ? undefined : (formattedEndTime ? `${patch.date} ${formattedEndTime}` : undefined),
    timePrecision: patch.allDay ? undefined : patch.timePrecision,
  }

  if (patch.originalDate) {
    const itemIndex = allItems.findIndex((item) => item.date === patch.originalDate)
    if (itemIndex >= 0) {
      allItems[itemIndex] = updatedItem
    } else {
      allItems.push(updatedItem)
    }
  } else {
    allItems.push(updatedItem)
  }

  const uniqueItems = new Map<string, ItemDateTimeInfo>()
  for (const item of allItems) {
    uniqueItems.set(item.date, item)
  }
  return Array.from(uniqueItems.values())
}

function rebuildSingleLineContent(
  content: string,
  patch: DatePatch,
  formattedStartTime?: string,
  formattedEndTime?: string,
): string {
  let itemContent = processLineText(content, ALL_SLASH_COMMAND_FILTERS)
  itemContent = stripListAndBlockAttr(itemContent)
    .replace(STATUS_MARKERS_RE, '')
    .trim()

  const dedupedItems = buildUpdatedDateItems(patch, formattedStartTime, formattedEndTime)
  const optimizedExpr = optimizeDateTimeExpressions(dedupedItems)
  const taskList = isTaskListFormat(content)
  const status = inferStatus(content, patch.status)
  const taskListMarker = taskList ? buildTaskListMarker(status) : ''
  const statusSuffix = buildStatusSuffix(status, taskList)

  const parsed = parseMarkerLine(itemContent)
  const hasDateMarker = parsed.markers.some((m) => m.kind === 'date')

  let normalizedContent: string
  if (!optimizedExpr) {
    normalizedContent = normalizeMarkerLine(removeMarker(parsed, 'date'))
  } else if (hasDateMarker) {
    normalizedContent = normalizeMarkerLine(upsertMarker(parsed, 'date', optimizedExpr))
  } else {
    const strippedContent = itemContent
      .replace(DATE_MARKER_REGEX, '')
      .replace(RESIDUAL_DATE_MARKER_REGEX, '')
      .trim()
    const strippedParsed = parseMarkerLine(strippedContent)
    normalizedContent = normalizeMarkerLine(insertMarkerBeforeFirst(strippedParsed, 'date', optimizedExpr))
  }

  return `${taskListMarker}${normalizedContent}${statusSuffix}`.trim()
}

export function renderDatePatch(
  kramdown: string,
  patch: DatePatch,
  context?: DatePatchRenderContext,
): string {
  const originalBlockId = context?.originalBlockId ?? ''
  const sourceBlockId = context?.sourceBlockId ?? originalBlockId
  const targetItemBlockRaw = context?.targetItemBlockRaw ?? null
  const usedParentDocumentContext = context?.usedParentDocumentContext ?? false

  const lines = kramdown.split('\n')
  const hasTomatoClock = lines.some((line) => line.trim().startsWith('🍅'))
  const contentLineCount = lines.filter((line) => {
    const trimmed = line.trim()
    return trimmed !== '' && !trimmed.startsWith('{:')
  }).length
  const useMultiLineForStructure = (sourceBlockId !== originalBlockId && lines.length > 1) || contentLineCount > 1

  const formattedStartTime = patch.startTime ? formatTimeToSeconds(patch.startTime) : undefined
  const formattedEndTime = patch.endTime
    ? formatTimeToSeconds(patch.endTime)
    : undefined

  if (!hasTomatoClock && !useMultiLineForStructure) {
    const attrSuffix = (kramdown.match(BLOCK_ATTR_SUFFIX_RE) || []).join('')
    const content = kramdown.replace(BLOCK_ATTR_SUFFIX_RE, '').trim()
    return rebuildSingleLineContent(
      content,
      patch,
      formattedStartTime,
      formattedEndTime,
    ) + attrSuffix
  }

  let itemLineIndex = findPrimaryItemLineIndex(lines)
  if (sourceBlockId !== originalBlockId && targetItemBlockRaw) {
    const targetBlockStartLineIndex = findBlockStartLineIndex(lines, targetItemBlockRaw)
    if (targetBlockStartLineIndex >= 0) {
      const targetBlockRelativeLineIndex = findPrimaryItemLineIndex(targetItemBlockRaw.split('\n'))
      if (targetBlockRelativeLineIndex >= 0) {
        itemLineIndex = targetBlockStartLineIndex + targetBlockRelativeLineIndex
      }
    }
  }

  if (itemLineIndex === -1) {
    const attrSuffix = (kramdown.match(BLOCK_ATTR_SUFFIX_RE) || []).join('')
    const content = kramdown.replace(BLOCK_ATTR_SUFFIX_RE, '').trim()
    return rebuildSingleLineContent(
      content,
      patch,
      formattedStartTime,
      formattedEndTime,
    ) + attrSuffix
  }

  const itemLine = lines[itemLineIndex]
  const cleanedItemLine = stripListAndBlockAttr(itemLine)
  let itemContent = cleanedItemLine
    .replace(STATUS_MARKERS_RE, '')
    .trim()
  itemContent = processLineText(itemContent, ALL_SLASH_COMMAND_FILTERS)

  const dedupedItems = buildUpdatedDateItems(patch, formattedStartTime, formattedEndTime)
  const optimizedExpr = optimizeDateTimeExpressions(dedupedItems)
  const taskList = isTaskListFormat(itemLine)
  const status = inferStatus(itemLine, patch.status)

  let newItemLine: string
  if (sourceBlockId !== originalBlockId) {
    const dateExpr = new RegExp(`${DATE_MARKER_PATTERN}(?:\\s*[,，]\\s*\\d{4}-\\d{2}-\\d{2}(?:~\\d{4}-\\d{2}-\\d{2}|~\\d{2}-\\d{2})?(?:\\s+${TIME_RANGE_PATTERN})?)*`, 'g')
    const cleanedLine = processLineText(itemLine, ALL_SLASH_COMMAND_FILTERS)
    newItemLine = cleanedLine.replace(dateExpr, optimizedExpr)
  } else {
    const taskListMarker = taskList ? buildTaskListMarker(status) : ''
    const statusSuffix = buildStatusSuffix(status, taskList)

    const parsed = parseMarkerLine(itemContent)
    const hasDateMarker = parsed.markers.some((m) => m.kind === 'date')

    let normalizedContent: string
    if (!optimizedExpr) {
      normalizedContent = normalizeMarkerLine(removeMarker(parsed, 'date'))
    } else if (hasDateMarker) {
      normalizedContent = normalizeMarkerLine(upsertMarker(parsed, 'date', optimizedExpr))
    } else {
      const strippedContent = itemContent
        .replace(DATE_MARKER_REGEX, '')
        .replace(RESIDUAL_DATE_MARKER_REGEX, '')
        .trim()
      const strippedParsed = parseMarkerLine(strippedContent)
      normalizedContent = normalizeMarkerLine(insertMarkerBeforeFirst(strippedParsed, 'date', optimizedExpr))
    }

    newItemLine = `${taskListMarker}${normalizedContent}${statusSuffix}`.trim()
  }

  lines[itemLineIndex] = newItemLine

  let content = lines.join('\n')
  if (usedParentDocumentContext && targetItemBlockRaw) {
    const updatedBlocks = parseKramdownBlocks(content)
    const updatedItemBlock = updatedBlocks.find((candidate) => candidate.blockId === originalBlockId)
    if (updatedItemBlock) {
      content = updatedItemBlock.raw
    }
  }

  return content
}
