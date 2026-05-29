/**
 * 行解析器
 * 从 obsidian-hk-work-plugin 移植
 */
import type {
  Item,
  ItemDateTimeInfo,
  ItemStatus,
  Link,
  PomodoroRecord,
  PomodoroStatus,
  Task,
  TimePrecision,
} from '@/types/models'
import { ALL_SLASH_COMMAND_FILTERS } from '@/constants'
import { processLineText } from '@/utils/stringUtils'
import {
  extractFocusPlanMarkers,
  stripFocusPlanMarkers,
} from './focusPlanParser'
import {
  parsePinnedFromLine,
  stripPinnedMarker,
} from './pinParser'
import {
  parsePriorityFromLine,
  stripPriorityMarker,
} from './priorityParser'
import {
  hasRepeatRule,
  parseEndCondition,
  parseRepeatRule,
  stripRecurringMarkers,
} from './recurringParser'
import {
  parseReminderFromLine,
  stripReminderMarker,
} from './reminderParser'
import {
  parseTagsFromLine,
  stripTagsFromLine,
} from './tagParser'

/** 思源块引用正则：((blockId)) 或 ((blockId "alias")) 或 ((blockId 'alias')) */
const BLOCK_REF_REGEX = /\(\((\d{14}-[a-z0-9]+)(?:\s+"([^"]*)"|\s+'([^']*)')?\)\)/g
const TIME_PART_PATTERN = '\\d{2}:\\d{2}(?::\\d{2})?'
const TIME_RANGE_PATTERN = `${TIME_PART_PATTERN}(?:~${TIME_PART_PATTERN})?`
const DATE_WITH_OPTIONAL_TIME_PATTERN = `(?:@|📅)\\d{4}-\\d{2}-\\d{2}(?:~\\d{4}-\\d{2}-\\d{2}|~\\d{2}-\\d{2})?(?:\\s+${TIME_RANGE_PATTERN})?`
const STATUS_TAG_BOUNDARY = '(?=$|[\\s#.,，。！？；：、)\\]】」』}）〕〗〙〛])'
const COMPLETED_STATUS_TAG_REGEX = new RegExp(`#done${STATUS_TAG_BOUNDARY}|#已完成${STATUS_TAG_BOUNDARY}`, 'u')
const ABANDONED_STATUS_TAG_REGEX = new RegExp(`#abandoned${STATUS_TAG_BOUNDARY}|#已放弃${STATUS_TAG_BOUNDARY}`, 'u')
const STATUS_TAGS_STRIP_REGEX = new RegExp(`(#done|#abandoned|#已完成|#已放弃)${STATUS_TAG_BOUNDARY}`, 'gu')

const WHITESPACE_RE = /[ \t]+/g
const LEVEL_RE = /@L([123])/
const AT_DATE_RE = /@(\d{4}-\d{2}-\d{2})/
const CALENDAR_DATE_RE = /📅(\d{4}-\d{2}-\d{2})/
const URL_RE = /(https?:\/\/\S+)/g
const HEADING_RE = /^#{1,6}\s+/
const TASK_TAG_CN_RE = /#任务#?/g
const TASK_TAG_EN_RE = /#task#?/gi
const CLIPBOARD_EMOJI_RE = /📋/g
const LEVEL_TAG_RE = /@L[123]/g
const URL_STRIP_RE = /https?:\/\/\S+/g
const AT_DATE_TEST_RE = /@\d{4}-\d{2}-\d{2}/
const CALENDAR_DATE_TEST_RE = /📅\d{4}-\d{2}-\d{2}/
const MULTIPLE_DATES_RE = /(?:@|📅)\d{4}-\d{2}-\d{2}\W*[,，]|(?:@|📅)\d{4}-\d{2}-\d{2}(?:~\d{4}-\d{2}-\d{2}|~\d{2}-\d{2})/
const TASK_LIST_MARKER_RE = /\[([ x])\]/i
const CN_COMMA_RE = /，/g
const STATUS_EMOJI_RE = /[✅❌📅📋]/gu
const TASK_LIST_STRIP_RE = /\[([ x])\]\s*/i
const SUPPLEMENTARY_EMOJI_RE = /[\u{1F300}-\u{1F9FF}]/gu
const DATE_SEPARATOR_RE = /\s*[,，]\s*(?=\d{4}-\d{2}-\d{2})/g
const TRAILING_COMMA_RE = /\s+[，,]$/g
const COMMA_RE = /,/g
const FULL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const SHORT_DATE_RE = /^\d{2}-\d{2}$/
const BLOCK_ATTR_RE = /\{:\s*([^}]*)\}/
const KEY_VALUE_ATTR_RE = /([\w-]+)=['"]([^'"]*)['"]/g
const LIST_MARKER_RE = /^\s*(-|\d+\.)\s+/
const BLOCK_ATTR_STRIP_RE = /^\{:[^}]*\}\s*/
const POMODORO_LINE_RE = /^🍅(?:(\d+)[,，]\s*)?(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})(?:\\?~(\d{2}:\d{2}:\d{2}))?\s*(.*)$/
const POMODORO_HEADER_RE = /^(\d+)[,，]\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})~(\d{2}:\d{2}:\d{2})\s*$/
const POMODORO_SINGLE_LINE_RE = /^(\d+)[,，]\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})~(\d{2}:\d{2}:\d{2})\s*(.*)$/
const TIME_RANGE_MATCH_RE = new RegExp(`@(\\d{4}-\\d{2}-\\d{2})\\s+(${TIME_PART_PATTERN})~(${TIME_PART_PATTERN})`)
const SINGLE_TIME_MATCH_RE = new RegExp(`@(\\d{4}-\\d{2}-\\d{2})\\s+(${TIME_PART_PATTERN})(?!~)`)
const DATE_WITH_TIME_STRIP_RE = new RegExp(DATE_WITH_OPTIONAL_TIME_PATTERN, 'g')
const MAIN_DATETIME_RE = new RegExp(
  `(?:@|📅)(\\d{4}-\\d{2}-\\d{2}(?:~\\d{4}-\\d{2}-\\d{2}|~\\d{2}-\\d{2})?)(?:\\s+(${TIME_RANGE_PATTERN}))?`,
  'g',
)
const CONTINUATION_DATETIME_RE = new RegExp(
  `^(?:\\s*,\\s*|\\s+)(\\d{4}-\\d{2}-\\d{2}(?:~\\d{4}-\\d{2}-\\d{2}|~\\d{2}-\\d{2})?)(?:\\s+(${TIME_RANGE_PATTERN}))?`,
)

export function inferLinkType(url: string): Link['type'] {
  if (url.startsWith('siyuan://')) {
    return 'siyuan'
  }
  if (url.startsWith('assets/')) {
    return 'attachment'
  }
  return 'external'
}

export function createLink(name: string, url: string, type?: Link['type'], blockId?: string): Link {
  return {
    name,
    url,
    type: type ?? inferLinkType(url),
    ...(blockId ? { blockId } : {}),
  }
}

export function isStandaloneBlockRefLine(text: string): boolean {
  if (!text.trim()) return false
  const remainder = text.replace(BLOCK_REF_REGEX, '').trim()
  BLOCK_REF_REGEX.lastIndex = 0
  const hasBlockRef = BLOCK_REF_REGEX.test(text)
  BLOCK_REF_REGEX.lastIndex = 0
  return remainder.length === 0 && hasBlockRef
}

/**
 * 解析思源行内块引用，提取 links 并 strip 显示文本
 * @param text 原始文本
 * @returns stripped 移除/替换块引用后的文本，links 解析出的 Link 数组
 */
export function parseBlockRefs(text: string): { stripped: string, links: Link[] } {
  const links: Link[] = []
  const stripped = text.replace(BLOCK_REF_REGEX, (_, blockId, aliasDouble, aliasSingle) => {
    const alias = aliasDouble ?? aliasSingle ?? undefined
    links.push(createLink(alias || '块引用', `siyuan://blocks/${blockId}`, 'block-ref'))
    return alias ?? ''
  })
  // 保留换行符，只将非换行的连续空白字符替换为单个空格
  return {
    stripped: stripped.trim().replace(WHITESPACE_RE, ' '),
    links,
  }
}

function stripBlockRefsForMetadata(text: string): string {
  return text.replace(BLOCK_REF_REGEX, '')
}

function protectBlockRefs(text: string, transform: (maskedText: string) => string): string {
  const protectedRefs: string[] = []
  const masked = text.replace(BLOCK_REF_REGEX, (match) => {
    const token = `__BLOCK_REF_${protectedRefs.length}__`
    protectedRefs.push(match)
    return token
  })

  let restored = transform(masked)
  protectedRefs.forEach((blockRef, index) => {
    restored = restored.replace(`__BLOCK_REF_${index}__`, blockRef)
  })
  return restored
}

export class LineParser {
  /**
   * 解析任务行
   * 格式: 任务名称 #任务 @L1 @2024-01-01 https://link
   */
  public static parseTaskLine(line: string, lineNumber: number): Task {
    // 解析任务级别 @L1 @L2 @L3
    const levelMatch = line.match(LEVEL_RE)
    const level = levelMatch ? `L${levelMatch[1]}` as 'L1' | 'L2' | 'L3' : 'L1'

    // 解析日期 @YYYY-MM-DD 或 📅YYYY-MM-DD
    const dateMatch = line.match(AT_DATE_RE) || line.match(CALENDAR_DATE_RE)
    const date = dateMatch ? dateMatch[1] : undefined

    // 解析时间范围 @YYYY-MM-DD HH:mm:ss~HH:mm:ss
    const timeRangeMatch = line.match(TIME_RANGE_MATCH_RE)

    // 解析单个时间 @YYYY-MM-DD HH:mm:ss
    const singleTimeMatch = line.match(SINGLE_TIME_MATCH_RE)

    // 解析链接（支持多个）
    const links: Link[] = []
    const urlRegex = URL_RE
    let urlMatch
    while ((urlMatch = urlRegex.exec(line)) !== null) {
      links.push(createLink('链接', urlMatch[1]))
    }

    // 解析业务标签
    const tags = parseTagsFromLine(line)

    // 提取任务名称（移除所有标记）
    // 注意：思源 Kramdown 中 #任务 会显示为 #任务#（末尾多一个 #）
    // 先移除行首的 Markdown 标题标记（### ... #），避免标题任务名残留
    let name = line
      .replace(HEADING_RE, '')
      .replace(TASK_TAG_CN_RE, '')
      .replace(TASK_TAG_EN_RE, '')
      .replace(CLIPBOARD_EMOJI_RE, '')
      .replace(LEVEL_TAG_RE, '')
      .replace(DATE_WITH_TIME_STRIP_RE, '')
      .replace(URL_STRIP_RE, '')
    // 移除业务标签（保留系统保留标签）
    name = stripTagsFromLine(name)
    name = name.trim()

    // 解析块引用：strip 显示名，提取到 links
    const {
      stripped: nameStripped,
      links: blockRefLinks,
    } = parseBlockRefs(name)
    name = nameStripped
    const allLinks = [...blockRefLinks, ...links]

    return {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      level,
      date,
      startDateTime: timeRangeMatch
        ? `${timeRangeMatch[1]} ${this.normalizeTime(timeRangeMatch[2]).value}`
        : singleTimeMatch
          ? `${singleTimeMatch[1]} ${this.normalizeTime(singleTimeMatch[2]).value}`
          : undefined,
      endDateTime: timeRangeMatch
        ? `${timeRangeMatch[1]} ${this.normalizeTime(timeRangeMatch[3]).value}`
        : undefined,
      links: allLinks.length > 0 ? allLinks : undefined,
      items: [],
      lineNumber,
      tags: tags.length > 0 ? tags : undefined,
    }
  }

  /**
   * 解析工作事项行（支持多日期）
   * 格式: 事项内容 @2024-01-01 10:00:00~11:00:00, 2024-01-03 14:00:00~15:00:00 #done
   * 支持: @2024-01-01, @2024-01-01~2024-01-05, @2024-01-01~01-05（简写）
   * 支持中英文逗号分隔
   * 支持提醒: ⏰HH:mm, ⏰-Xm, ⏰e-Xm
   * 支持重复: 🔁每天, 🔁每周, 🔁每月, 🔁每年, 🔁工作日
   * 支持结束条件: 🔚YYYY-MM-DD, 🔢N
   * @param line 事项行内容
   * @param lineNumber 行号
   * @param links 关联的链接列表（可选，由上层解析器提供）
   */
  public static parseItemLine(line: string, lineNumber: number, links?: Link[]): Item[] {
    // 必须包含日期标记（支持 @ 或 📅 前缀）
    if (!AT_DATE_TEST_RE.test(line) && !CALENDAR_DATE_TEST_RE.test(line)) {
      return []
    }

    // 解析提醒配置
    const reminder = parseReminderFromLine(line)

    // 解析优先级
    const priority = parsePriorityFromLine(line)

    // 解析置顶和业务标签（每行只解析一次，应用到所有展开项）
    const metadataLine = stripBlockRefsForMetadata(line)
    const pinned = parsePinnedFromLine(metadataLine)
    const tags = parseTagsFromLine(metadataLine)
    const focusPlanResult = extractFocusPlanMarkers(metadataLine)

    // 解析重复规则（多日期与重复互斥时优先多日期）
    // 匹配多日期：
    // 1. 逗号分隔：@日期, 或 📅日期, 或 @日期， 或 📅日期，
    // 2. 日期范围：@日期~日期 或 📅日期~日期（波浪号后面必须是日期格式，避免误匹配时间范围 09:00:00~10:00:00）
    const hasMultipleDates = line.match(MULTIPLE_DATES_RE)
    const repeatRule = (!hasMultipleDates && hasRepeatRule(line)) ? parseRepeatRule(line) : undefined
    const endCondition = repeatRule ? parseEndCondition(line) : undefined

    // 解析任务列表标记 [ ] [x] [X]（在去除块属性后解析）
    let taskListStatus: ItemStatus | null = null
    const taskListMatch = metadataLine.match(TASK_LIST_MARKER_RE)
    if (taskListMatch) {
      const taskListMarker = taskListMatch[1]
      if (taskListMarker === 'x' || taskListMarker === 'X') {
        taskListStatus = 'completed'
      } else {
        taskListStatus = 'pending'
      }
    }

    // 解析状态标签（中英文 + Emoji 兼容）- 优先级高于任务列表标记
    let status: ItemStatus = 'pending'
    if (COMPLETED_STATUS_TAG_REGEX.test(metadataLine) || metadataLine.includes('✅')) {
      status = 'completed'
    } else if (ABANDONED_STATUS_TAG_REGEX.test(metadataLine) || metadataLine.includes('❌')) {
      status = 'abandoned'
    } else if (taskListStatus) {
      // 没有状态标签时，使用任务列表状态
      status = taskListStatus
    }

    // 提取所有日期时间表达式（支持逗号分隔的多个日期）
    // 使用英文逗号处理日期分隔，但保留原始行用于内容提取
    // 将中文逗号替换为英文逗号，便于统一处理
    const normalizedLineForDates = line.replace(CN_COMMA_RE, ',')

    // 提取所有日期时间表达式（支持逗号分隔的多个日期）
    const dateTimeExpressions = this.extractDateTimeExpressions(normalizedLineForDates)
    if (dateTimeExpressions.length === 0) return []

    // 提取内容（在规范化 line 上移除所有日期时间表达式、状态标签和任务列表标记）
    // 使用规范化 line 以确保 fullMatch 能正确匹配（中文逗号已转为英文逗号）
    let content = normalizedLineForDates

    // 移除行首 Markdown 标题标记（# ... ######）
    content = content.replace(HEADING_RE, '')

    for (const expr of dateTimeExpressions) {
      // 直接移除 fullMatch（使用字符串替换，避免正则特殊字符问题）
      content = content.split(expr.fullMatch).join('')
    }
    // 移除所有标记（使用规范化字符串处理 Emoji）
    content = protectBlockRefs(content, (maskedContent) => {
      let cleanedContent = maskedContent
        .replace(STATUS_TAGS_STRIP_REGEX, '')
        .replace(STATUS_EMOJI_RE, '')
        .replace(TASK_LIST_STRIP_RE, '')
        .trim()

      // 移除提醒标记
      cleanedContent = stripReminderMarker(cleanedContent)

      // 移除优先级标记
      cleanedContent = stripPriorityMarker(cleanedContent)

      // 移除置顶与业务标签标记，保留系统保留标签以供既有状态清理逻辑处理
      cleanedContent = stripPinnedMarker(cleanedContent)
      cleanedContent = stripTagsFromLine(cleanedContent)

      // 移除重复和结束条件标记（🔁🔚🔢 等）
      // 注意：必须在移除补充平面字符之前执行，否则 🔁 会被单独移除，留下"每月"等文字
      cleanedContent = stripRecurringMarkers(cleanedContent)

      // 移除预计专注标记
      cleanedContent = stripFocusPlanMarkers(cleanedContent)

      // 移除斜杠命令
      cleanedContent = processLineText(cleanedContent, ALL_SLASH_COMMAND_FILTERS)

      // 额外清理：移除任何残留的 Emoji 字符（补充平面字符）
      return cleanedContent.replace(SUPPLEMENTARY_EMOJI_RE, '').trim()
    })

    // 清理日期表达式之间残留的逗号分隔符
    // 匹配模式：空白 + 逗号（中英文）+ 空白/日期，这些是日期分隔符
    content = content.replace(DATE_SEPARATOR_RE, ' ').trim()
    // 清理行尾的逗号当它是独立的（前面是空白字符）
    content = content.replace(TRAILING_COMMA_RE, '').trim()

    // 如果原始行包含中文逗号，将内容中的英文逗号转换回中文逗号
    if (line.includes('，')) {
      content = content.replace(COMMA_RE, '，')
    }

    // 解析块引用：strip 显示内容，提取到 links
    const {
      stripped: contentStripped,
      links: blockRefLinks,
    } = parseBlockRefs(content)
    content = contentStripped

    if (!content) return []

    const mergedLinks = [...(links ?? []), ...blockRefLinks]

    // 展开所有日期时间组合
    const items: Item[] = []

    // 先收集所有日期时间信息
    const allDateTimeInfo: ItemDateTimeInfo[] = []

    for (const expr of dateTimeExpressions) {
      const dates = this.parseDatePart(expr.datePart)
      const timeInfo = this.parseTimePart(expr.timePart)

      for (const date of dates) {
        let startDateTime: string | undefined
        let endDateTime: string | undefined
        let timePrecision: TimePrecision | undefined

        if (timeInfo) {
          timePrecision = timeInfo.precision
          if (timeInfo.endTime) {
            startDateTime = `${date} ${timeInfo.startTime}`
            endDateTime = `${date} ${timeInfo.endTime}`
          } else {
            startDateTime = `${date} ${timeInfo.startTime}`
          }
        }

        allDateTimeInfo.push({
          date,
          startDateTime,
          endDateTime,
          timePrecision,
        })
      }
    }

    // 多日期事项：计算 dateRangeStart、dateRangeEnd
    const allDates = allDateTimeInfo.map((info) => info.date)
    const dateRangeStart =
      allDates.length >= 2 ? allDates.slice().sort()[0] : undefined
    const dateRangeEnd =
      allDates.length >= 2 ? allDates.slice().sort().pop() : undefined

    // 为每个日期创建 Item，并填充 siblingItems
    for (let i = 0; i < allDateTimeInfo.length; i++) {
      const {
        date,
        startDateTime,
        endDateTime,
        timePrecision,
      } = allDateTimeInfo[i]

      // 构建 siblingItems（排除当前 Item 自身）
      const siblingItems = allDateTimeInfo
        .filter((_, index) => index !== i)
        .map((info) => ({
          date: info.date,
          startDateTime: info.startDateTime,
          endDateTime: info.endDateTime,
          timePrecision: info.timePrecision,
        }))

      items.push({
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content,
        date,
        startDateTime,
        endDateTime,
        timePrecision,
        lineNumber,
        docId: '',
        status,
        links: mergedLinks.length > 0 ? mergedLinks : undefined, // 块引用 + 事项下方链接
        siblingItems: siblingItems.length > 0 ? siblingItems : undefined,
        dateRangeStart,
        dateRangeEnd,
        reminder,
        focusPlan: focusPlanResult.active,
        repeatRule,
        endCondition,
        priority,
        pinned: pinned || undefined,
        tags: tags.length > 0 ? tags : undefined,
      })
    }

    return items
  }

  /**
   * 提取所有日期时间表达式
   * 支持逗号分隔的多个日期，如: @2024-01-01, 2024-01-03, 2024-01-05
   */
  private static extractDateTimeExpressions(line: string): Array<{
    fullMatch: string
    datePart: string
    timePart: string | null
  }> {
    const expressions: Array<{ fullMatch: string, datePart: string, timePart: string | null }> = []

    // 首先找到所有以 @ 或 📅 开头的日期时间块
    // 匹配 @日期 或 📅日期 或 @日期 时间 或 @日期 时间~时间，以及后续逗号分隔的日期
    const mainRegex = MAIN_DATETIME_RE

    let mainMatch
    while ((mainMatch = mainRegex.exec(line)) !== null) {
      const startIndex = mainMatch.index
      const mainDatePart = mainMatch[1]
      const mainTimePart = mainMatch[2] || null
      const mainFullMatch = mainMatch[0]

      // 添加主日期表达式
      expressions.push({
        fullMatch: mainFullMatch,
        datePart: mainDatePart,
        timePart: mainTimePart,
      })

      // 查找该日期后的逗号分隔日期
      // 从主日期结束位置开始查找
      const afterMainDate = line.substring(startIndex + mainFullMatch.length)

      // 匹配逗号或逗号+空格后跟着的日期（可能带时间）
      // 格式: , 2024-01-03 或 , 2024-01-03 09:00:00~10:00:00
      const continuationRegex = CONTINUATION_DATETIME_RE

      let remaining = afterMainDate
      while (remaining.length > 0) {
        const contMatch = remaining.match(continuationRegex)
        if (!contMatch) break

        // 检查是否遇到状态标签或行尾（不应再解析）
        const beforeMatch = remaining.substring(0, contMatch.index || 0)
        if (beforeMatch.includes('#')) break

        expressions.push({
          fullMatch: contMatch[0],
          datePart: contMatch[1],
          timePart: contMatch[2] || null,
        })

        remaining = remaining.substring(contMatch[0].length)

        // 安全检查：防止无限循环
        if (contMatch[0].length === 0) break
      }
    }

    return expressions
  }

  /**
   * 解析日期部分，返回日期列表
   */
  private static parseDatePart(datePart: string): string[] {
    if (datePart.includes('~')) {
      const [startStr, endStr] = datePart.split('~')
      const startDate = this.parseDate(startStr)
      const endDate = this.parseDate(endStr, startDate)

      if (startDate && endDate) {
        return this.expandDateRange(startDate, endDate)
      }
    }

    const date = this.parseDate(datePart)
    return date ? [this.formatDate(date)] : []
  }

  /**
   * 解析时间部分
   */
  private static parseTimePart(
    timePart: string | null,
  ): { startTime: string, endTime?: string, precision: TimePrecision } | null {
    if (!timePart) return null

    if (timePart.includes('~')) {
      const [start, end] = timePart.split('~')
      const normalizedStart = this.normalizeTime(start)
      const normalizedEnd = this.normalizeTime(end)
      return {
        startTime: normalizedStart.value,
        endTime: normalizedEnd.value,
        precision: normalizedStart.precision === 'second' || normalizedEnd.precision === 'second'
          ? 'second'
          : 'minute',
      }
    }

    const normalizedTime = this.normalizeTime(timePart)
    return {
      startTime: normalizedTime.value,
      precision: normalizedTime.precision,
    }
  }

  private static normalizeTime(time: string): { value: string, precision: TimePrecision } {
    return time.length === 5
      ? {
          value: `${time}:00`,
          precision: 'minute',
        }
      : {
          value: time,
          precision: 'second',
        }
  }

  /**
   * 解析日期字符串
   */
  private static parseDate(dateStr: string, referenceDate?: Date): Date | null {
    // 完整格式: 2024-01-01
    if (FULL_DATE_RE.test(dateStr)) {
      const date = new Date(dateStr)
      return Number.isNaN(date.getTime()) ? null : date
    }

    // 简写格式: 01-01（继承参考日期的年月）
    if (SHORT_DATE_RE.test(dateStr) && referenceDate) {
      const year = referenceDate.getFullYear()
      const month = dateStr.substring(0, 2)
      const day = dateStr.substring(3, 5)
      const date = new Date(`${year}-${month}-${day}`)
      return Number.isNaN(date.getTime()) ? null : date
    }

    return null
  }

  /**
   * 展开日期范围
   */
  private static expandDateRange(start: Date, end: Date): string[] {
    const dates: string[] = []
    const current = new Date(start)

    while (current <= end) {
      dates.push(this.formatDate(new Date(current)))
      current.setDate(current.getDate() + 1)
    }

    return dates
  }

  /**
   * 格式化日期为 YYYY-MM-DD
   */
  private static formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  /**
   * 解析块属性
   * 格式: {: custom-pomodoro-status="running" custom-pomodoro-start="1234567890" ...}
   * @param line 包含块属性的行
   * @returns 属性对象
   */
  public static parseBlockAttrs(line: string): { [key: string]: string } {
    const attrs: { [key: string]: string } = {}
    const attrRegex = BLOCK_ATTR_RE
    const match = line.match(attrRegex)

    if (match) {
      const attrContent = match[1]
      // 匹配 key="value" 或 key='value' 格式
      // key 支持字母、数字、下划线、连字符（如 custom-pomodoro-status）
      const keyValueRegex = KEY_VALUE_ATTR_RE
      let kvMatch
      while ((kvMatch = keyValueRegex.exec(attrContent)) !== null) {
        attrs[kvMatch[1]] = kvMatch[2]
      }
    }

    return attrs
  }

  /**
   * 解析番茄钟行
   * 格式: 🍅YYYY-MM-DD HH:mm:ss~HH:mm:ss 描述文字
   * 或: - 🍅YYYY-MM-DD HH:mm:ss~HH:mm:ss 描述文字（列表项形式）
   * 或: 🍅N,YYYY-MM-DD HH:mm:ss~HH:mm:ss 描述文字（带实际时长）
   * 支持中英文逗号，逗号后可有任意空格
   * 支持多行描述（第一行为番茄钟标记，后续行为描述）
   * @param line 番茄钟行内容（可能包含多行）
   * @param blockId 块 ID
   * @param attrs 可选的块属性
   * @returns PomodoroRecord 对象，解析失败返回 null
   */
  public static parsePomodoroLine(line: string, blockId?: string, attrs?: { [key: string]: string }): PomodoroRecord | null {
    // 分离多行内容
    const lines = line.split('\n')
    const firstLine = lines[0] || ''

    // 去除列表标记、块属性和缩进
    const cleanedLine = firstLine
      .replace(LIST_MARKER_RE, '')
      .replace(BLOCK_ATTR_STRIP_RE, '')
      .trim()

    // 检查是否以 🍅 开头
    if (!cleanedLine.startsWith('🍅')) {
      return null
    }

    // 提取日期时间部分: YYYY-MM-DD HH:mm:ss~HH:mm:ss
    // 支持可选的实际时长前缀: N, 或 N，（中英文逗号，逗号后任意空格）
    // 注意：Kramdown 中 ~ 可能被转义为 \~
    const pomodoroRegex = POMODORO_LINE_RE
    const match = cleanedLine.match(pomodoroRegex)

    if (!match) {
      return null
    }

    const actualDurationMinutes = match[1] ? Number.parseInt(match[1], 10) : undefined
    const date = match[2]
    const startTime = match[3]
    const endTime = match[4]

    // 处理描述：第一行可能已有描述，加上后续行
    let rawDescription = match[5]?.trim() || ''

    // 如果有后续行，合并为描述（过滤掉块属性行）
    if (lines.length > 1) {
      const descriptionLines = lines
        .slice(1)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('{:')) // 过滤空行和块属性行
      if (descriptionLines.length > 0) {
        rawDescription = rawDescription
          ? `${rawDescription}\n${descriptionLines.join('\n')}`
          : descriptionLines.join('\n')
      }
    }

    const description = rawDescription ? parseBlockRefs(rawDescription).stripped || undefined : undefined

    // 计算专注时长（分钟）
    let durationMinutes = 25 // 默认25分钟
    if (endTime) {
      const startMinutes = this.timeToMinutes(startTime)
      const endMinutes = this.timeToMinutes(endTime)
      durationMinutes = endMinutes - startMinutes
      if (durationMinutes < 0) {
        durationMinutes += 24 * 60 // 跨天情况
      }
      // 确保至少1分钟
      if (durationMinutes < 1) {
        durationMinutes = 1
      }
    }

    // 解析块属性中的专注状态
    let status: PomodoroStatus | undefined
    let itemContent: string | undefined

    if (attrs) {
      if (attrs['custom-pomodoro-status'] === 'running' || attrs['custom-pomodoro-status'] === 'completed') {
        status = attrs['custom-pomodoro-status']
      }
      if (attrs['custom-pomodoro-item-content']) {
        itemContent = attrs['custom-pomodoro-item-content']
      }
    }

    return {
      id: `pomodoro-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      date,
      startTime,
      endTime,
      description,
      durationMinutes,
      actualDurationMinutes,
      blockId,
      status,
      itemContent,
    }
  }

  /**
   * 将时间字符串转换为分钟数
   */
  private static timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number)
    return hours * 60 + minutes
  }

  /**
   * 解析块属性中的番茄钟值（attr 模式）
   * 格式: {durationMinutes},{date} {startTime}~{endTime} {description}
   * 或: {durationMinutes},{date} {startTime}~{endTime}\n{多行描述}
   * 时间与描述之间为空格或换行符
   * @param value 属性值
   * @param blockId 块 ID
   * @param attrPrefix 属性名前缀，用于生成 id
   * @returns PomodoroRecord 或 null
   */
  public static parsePomodoroAttrValue(
    value: string,
    blockId?: string,
    attrPrefix: string = 'custom-pomodoro',
  ): PomodoroRecord | null {
    if (!value || typeof value !== 'string') return null

    const trimmedValue = value.trim()

    // 检查是否包含真正的换行符（多行描述格式）
    // 支持两种形式：真正的换行符 \n 或转义的 \\n
    const newlineChar = '\n'
    if (trimmedValue.includes(newlineChar)) {
      const parts = trimmedValue.split(newlineChar)
      const headerPart = parts[0]
      const descLines = parts.slice(1).map((line) => line.trim()).filter((line) => line && !line.startsWith('{:'))

      // 解析头部: N,YYYY-MM-DD HH:mm:ss~HH:mm:ss
      const headerRegex = POMODORO_HEADER_RE
      const headerMatch = headerPart.match(headerRegex)

      if (!headerMatch) return null

      const durationMinutes = Number.parseInt(headerMatch[1], 10)
      const date = headerMatch[2]
      const startTime = headerMatch[3]
      const endTime = headerMatch[4]
      const description = descLines.join('\n') || undefined

      return {
        id: `${attrPrefix}-${blockId || 'unknown'}-${date}-${startTime}`,
        date,
        startTime,
        endTime,
        description,
        durationMinutes,
        actualDurationMinutes: durationMinutes,
        blockId,
      }
    }

    // 单行描述格式: N,YYYY-MM-DD HH:mm:ss~HH:mm:ss 描述
    const regex = POMODORO_SINGLE_LINE_RE
    const match = trimmedValue.match(regex)

    if (!match) return null

    const durationMinutes = Number.parseInt(match[1], 10)
    const date = match[2]
    const startTime = match[3]
    const endTime = match[4]
    const description = match[5]?.trim() || undefined

    return {
      id: `${attrPrefix}-${blockId || 'unknown'}-${date}-${startTime}`,
      date,
      startTime,
      endTime,
      description: description || undefined,
      durationMinutes,
      actualDurationMinutes: durationMinutes,
      blockId,
    }
  }

  /**
   * 从块属性对象中提取所有番茄钟记录
   * @param attrs 块属性对象（来自 getBlockAttrs）
   * @param blockId 块 ID
   * @param attrPrefix 属性名前缀，默认 'custom-pomodoro'
   */
  public static parsePomodoroAttrs(
    attrs: { [key: string]: string },
    blockId?: string,
    attrPrefix: string = 'custom-pomodoro',
  ): PomodoroRecord[] {
    const records: PomodoroRecord[] = []
    const prefix = attrPrefix.endsWith('-') ? attrPrefix : `${attrPrefix}-`

    for (const [key, value] of Object.entries(attrs)) {
      if (key.startsWith(prefix) && value) {
        const record = this.parsePomodoroAttrValue(value, blockId, attrPrefix)
        if (record) records.push(record)
      }
    }

    return records
  }
}
