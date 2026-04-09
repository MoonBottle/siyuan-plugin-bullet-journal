/**
 * 行解析器
 * 从 obsidian-hk-work-plugin 移植
 */
import type { Task, Item, Link, ItemStatus, PomodoroRecord, PomodoroStatus } from '@/types/models';
import { parseReminderFromLine, stripReminderMarker } from './reminderParser';
import { parsePriorityFromLine, stripPriorityMarker } from './priorityParser';
import { parseRepeatRule, parseEndCondition, hasRepeatRule, stripRecurringMarkers } from './recurringParser';
import { processLineText } from '@/utils/stringUtils';
import { ALL_SLASH_COMMAND_FILTERS } from '@/constants';

/** 思源块引用正则：((blockId)) 或 ((blockId "alias")) 或 ((blockId 'alias')) */
const BLOCK_REF_REGEX = /\(\((\d{14}-[a-z0-9]+)(?:\s+"([^"]*)"|\s+'([^']*)')?\)\)/g;

/**
 * 解析思源行内块引用，提取 links 并 strip 显示文本
 * @param text 原始文本
 * @returns stripped 移除/替换块引用后的文本，links 解析出的 Link 数组
 */
export function parseBlockRefs(text: string): { stripped: string; links: Link[] } {
  const links: Link[] = [];
  const stripped = text.replace(BLOCK_REF_REGEX, (_, blockId, aliasDouble, aliasSingle) => {
    const alias = aliasDouble ?? aliasSingle ?? undefined;
    links.push({
      name: alias || '块引用',
      url: `siyuan://blocks/${blockId}`
    });
    return alias ?? '';
  });
  // 保留换行符，只将非换行的连续空白字符替换为单个空格
  return { stripped: stripped.trim().replace(/[ \t]+/g, ' '), links };
}

export class LineParser {
  /**
   * 解析任务行
   * 格式: 任务名称 #任务 @L1 @2024-01-01 https://link
   */
  public static parseTaskLine(line: string, lineNumber: number): Task {
    // 解析任务级别 @L1 @L2 @L3
    const levelMatch = line.match(/@L([123])/);
    const level = levelMatch ? `L${levelMatch[1]}` as 'L1' | 'L2' | 'L3' : 'L1';

    // 解析日期 @YYYY-MM-DD 或 📅YYYY-MM-DD
    const dateMatch = line.match(/@(\d{4}-\d{2}-\d{2})/) || line.match(/📅(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : undefined;

    // 解析时间范围 @YYYY-MM-DD HH:mm:ss~HH:mm:ss
    const timeRangeMatch = line.match(
      /@(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})~(\d{2}:\d{2}:\d{2})/
    );

    // 解析单个时间 @YYYY-MM-DD HH:mm:ss
    const singleTimeMatch = line.match(
      /@(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})(?!~)/
    );

    // 解析链接（支持多个）
    const links: Link[] = [];
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let urlMatch;
    while ((urlMatch = urlRegex.exec(line)) !== null) {
      links.push({ name: '链接', url: urlMatch[1] });
    }

    // 提取任务名称（移除所有标记）
    // 注意：思源 Kramdown 中 #任务 会显示为 #任务#（末尾多一个 #）
    let name = line
      .replace(/#任务#?/g, '')
      .replace(/#task#?/gi, '')
      .replace(/📋/g, '')
      .replace(/@L[123]/g, '')
      .replace(/@\d{4}-\d{2}-\d{2}(\s+\d{2}:\d{2}:\d{2}(~\d{2}:\d{2}:\d{2})?)?/g, '')
      .replace(/📅\d{4}-\d{2}-\d{2}(\s+\d{2}:\d{2}:\d{2}(~\d{2}:\d{2}:\d{2})?)?/g, '')
      .replace(/https?:\/\/[^\s]+/g, '')
      .trim();

    // 解析块引用：strip 显示名，提取到 links
    const { stripped: nameStripped, links: blockRefLinks } = parseBlockRefs(name);
    name = nameStripped;
    const allLinks = [...blockRefLinks, ...links];

    return {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      level,
      date,
      startDateTime: timeRangeMatch
        ? `${timeRangeMatch[1]} ${timeRangeMatch[2]}`
        : singleTimeMatch
          ? `${singleTimeMatch[1]} ${singleTimeMatch[2]}`
          : undefined,
      endDateTime: timeRangeMatch
        ? `${timeRangeMatch[1]} ${timeRangeMatch[3]}`
        : undefined,
      links: allLinks.length > 0 ? allLinks : undefined,
      items: [],
      lineNumber
    };
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
    if (!line.match(/@\d{4}-\d{2}-\d{2}/) && !line.match(/📅\d{4}-\d{2}-\d{2}/)) {
      return [];
    }

    // 解析提醒配置
    const reminder = parseReminderFromLine(line);

    // 解析优先级
    const priority = parsePriorityFromLine(line);

    // 解析重复规则（多日期与重复互斥时优先多日期）
    // 匹配多日期：
    // 1. 逗号分隔：@日期, 或 📅日期, 或 @日期， 或 📅日期，
    // 2. 日期范围：@日期~日期 或 📅日期~日期（波浪号后面必须是日期格式，避免误匹配时间范围 09:00:00~10:00:00）
    const hasMultipleDates = line.match(/(?:@|📅)\d{4}-\d{2}-\d{2}[^\w]*[,，]|(?:@|📅)\d{4}-\d{2}-\d{2}(?:~\d{4}-\d{2}-\d{2}|~\d{2}-\d{2})/);
    const repeatRule = (!hasMultipleDates && hasRepeatRule(line)) ? parseRepeatRule(line) : undefined;
    const endCondition = repeatRule ? parseEndCondition(line) : undefined;

    // 解析任务列表标记 [ ] [x] [X]（在去除块属性后解析）
    let taskListStatus: ItemStatus | null = null;
    const taskListMatch = line.match(/\[([ xX])\]/);
    if (taskListMatch) {
      const taskListMarker = taskListMatch[1];
      if (taskListMarker === 'x' || taskListMarker === 'X') {
        taskListStatus = 'completed';
      } else {
        taskListStatus = 'pending';
      }
    }

    // 解析状态标签（中英文 + Emoji 兼容）- 优先级高于任务列表标记
    let status: ItemStatus = 'pending';
    if (line.includes('#done') || line.includes('#已完成') || line.includes('✅')) {
      status = 'completed';
    } else if (line.includes('#abandoned') || line.includes('#已放弃') || line.includes('❌')) {
      status = 'abandoned';
    } else if (taskListStatus) {
      // 没有状态标签时，使用任务列表状态
      status = taskListStatus;
    }

    // 提取所有日期时间表达式（支持逗号分隔的多个日期）
    // 使用英文逗号处理日期分隔，但保留原始行用于内容提取
    // 将中文逗号替换为英文逗号，便于统一处理
    const normalizedLineForDates = line.replace(/，/g, ',');

    // 提取所有日期时间表达式（支持逗号分隔的多个日期）
    const dateTimeExpressions = this.extractDateTimeExpressions(normalizedLineForDates);
    if (dateTimeExpressions.length === 0) return [];

    // 提取内容（在规范化 line 上移除所有日期时间表达式、状态标签和任务列表标记）
    // 使用规范化 line 以确保 fullMatch 能正确匹配（中文逗号已转为英文逗号）
    let content = normalizedLineForDates;
    for (const expr of dateTimeExpressions) {
      // 直接移除 fullMatch（使用字符串替换，避免正则特殊字符问题）
      content = content.split(expr.fullMatch).join('');
    }
    // 移除所有标记（使用规范化字符串处理 Emoji）
    content = content
      .replace(/#done|#abandoned|#已完成|#已放弃/g, '')
      .replace(/[✅❌📅📋]/gu, '')  // 移除 Emoji 标记
      .replace(/\[([ xX])\]\s*/, '')  // 移除任务列表标记 [ ] [x] [X] 及其后的空格
      .trim();

    // 移除提醒标记
    content = stripReminderMarker(content);

    // 移除优先级标记
    content = stripPriorityMarker(content);

    // 移除重复和结束条件标记（🔁🔚🔢 等）
    // 注意：必须在移除补充平面字符之前执行，否则 🔁 会被单独移除，留下"每月"等文字
    content = stripRecurringMarkers(content);

    // 移除斜杠命令
    content = processLineText(content, ALL_SLASH_COMMAND_FILTERS);

    // 额外清理：移除任何残留的 Emoji 字符（补充平面字符）
    content = content.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();

    // 清理日期表达式之间残留的逗号分隔符
    // 匹配模式：空白 + 逗号（中英文）+ 空白/日期，这些是日期分隔符
    content = content.replace(/\s*[,，]\s*(?=\d{4}-\d{2}-\d{2})/g, ' ').trim();
    // 清理行尾的逗号当它是独立的（前面是空白字符）
    content = content.replace(/\s+[，,]$/g, '').trim();

    // 如果原始行包含中文逗号，将内容中的英文逗号转换回中文逗号
    if (line.includes('，')) {
      content = content.replace(/,/g, '，');
    }

    // 解析块引用：strip 显示内容，提取到 links
    const { stripped: contentStripped, links: blockRefLinks } = parseBlockRefs(content);
    content = contentStripped;

    if (!content) return [];

    const mergedLinks = [...(links ?? []), ...blockRefLinks];

    // 展开所有日期时间组合
    const items: Item[] = [];

    // 先收集所有日期时间信息
    const allDateTimeInfo: Array<{ date: string; startDateTime?: string; endDateTime?: string }> = [];

    for (const expr of dateTimeExpressions) {
      const dates = this.parseDatePart(expr.datePart);
      const timeInfo = this.parseTimePart(expr.timePart);

      for (const date of dates) {
        let startDateTime: string | undefined;
        let endDateTime: string | undefined;

        if (timeInfo) {
          if (timeInfo.endTime) {
            startDateTime = `${date} ${timeInfo.startTime}`;
            endDateTime = `${date} ${timeInfo.endTime}`;
          } else {
            startDateTime = `${date} ${timeInfo.startTime}`;
          }
        }

        allDateTimeInfo.push({ date, startDateTime, endDateTime });
      }
    }

    // 多日期事项：计算 dateRangeStart、dateRangeEnd
    const allDates = allDateTimeInfo.map(info => info.date);
    const dateRangeStart =
      allDates.length >= 2 ? allDates.slice().sort()[0] : undefined;
    const dateRangeEnd =
      allDates.length >= 2 ? allDates.slice().sort().pop() : undefined;

    // 为每个日期创建 Item，并填充 siblingItems
    for (let i = 0; i < allDateTimeInfo.length; i++) {
      const { date, startDateTime, endDateTime } = allDateTimeInfo[i];

      // 构建 siblingItems（排除当前 Item 自身）
      const siblingItems = allDateTimeInfo
        .filter((_, index) => index !== i)
        .map(info => ({
          date: info.date,
          startDateTime: info.startDateTime,
          endDateTime: info.endDateTime
        }));

      items.push({
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content,
        date,
        startDateTime,
        endDateTime,
        lineNumber,
        docId: '',
        status,
        links: mergedLinks.length > 0 ? mergedLinks : undefined,  // 块引用 + 事项下方链接
        siblingItems: siblingItems.length > 0 ? siblingItems : undefined,
        dateRangeStart,
        dateRangeEnd,
        reminder,
        repeatRule,
        endCondition,
        priority
      });
    }

    return items;
  }

  /**
   * 提取所有日期时间表达式
   * 支持逗号分隔的多个日期，如: @2024-01-01, 2024-01-03, 2024-01-05
   */
  private static extractDateTimeExpressions(line: string): Array<{
    fullMatch: string;
    datePart: string;
    timePart: string | null;
  }> {
    const expressions: Array<{ fullMatch: string; datePart: string; timePart: string | null }> = [];

    // 首先找到所有以 @ 或 📅 开头的日期时间块
    // 匹配 @日期 或 📅日期 或 @日期 时间 或 @日期 时间~时间，以及后续逗号分隔的日期
    const mainRegex = /(?:@|📅)(\d{4}-\d{2}-\d{2}(?:~\d{4}-\d{2}-\d{2}|~\d{2}-\d{2})?)(?:\s+(\d{2}:\d{2}:\d{2}(?:~\d{2}:\d{2}:\d{2})?))?/g;

    let mainMatch;
    while ((mainMatch = mainRegex.exec(line)) !== null) {
      const startIndex = mainMatch.index;
      const mainDatePart = mainMatch[1];
      const mainTimePart = mainMatch[2] || null;
      const mainFullMatch = mainMatch[0];

      // 添加主日期表达式
      expressions.push({
        fullMatch: mainFullMatch,
        datePart: mainDatePart,
        timePart: mainTimePart
      });

      // 查找该日期后的逗号分隔日期
      // 从主日期结束位置开始查找
      const afterMainDate = line.substring(startIndex + mainFullMatch.length);

      // 匹配逗号或逗号+空格后跟着的日期（可能带时间）
      // 格式: , 2024-01-03 或 , 2024-01-03 09:00:00~10:00:00
      const continuationRegex = /^(?:\s*,\s*|\s+)(\d{4}-\d{2}-\d{2}(?:~\d{4}-\d{2}-\d{2}|~\d{2}-\d{2})?)(?:\s+(\d{2}:\d{2}:\d{2}(?:~\d{2}:\d{2}:\d{2})?))?/;

      let remaining = afterMainDate;
      let lastMatchEnd = 0;

      while (remaining.length > 0) {
        const contMatch = remaining.match(continuationRegex);
        if (!contMatch) break;

        // 检查是否遇到状态标签或行尾（不应再解析）
        const beforeMatch = remaining.substring(0, contMatch.index || 0);
        if (beforeMatch.includes('#')) break;

        expressions.push({
          fullMatch: contMatch[0],
          datePart: contMatch[1],
          timePart: contMatch[2] || null
        });

        remaining = remaining.substring(contMatch[0].length);

        // 安全检查：防止无限循环
        if (contMatch[0].length === 0) break;
      }
    }

    return expressions;
  }

  /**
   * 解析日期部分，返回日期列表
   */
  private static parseDatePart(datePart: string): string[] {
    if (datePart.includes('~')) {
      const [startStr, endStr] = datePart.split('~');
      const startDate = this.parseDate(startStr);
      const endDate = this.parseDate(endStr, startDate);

      if (startDate && endDate) {
        return this.expandDateRange(startDate, endDate);
      }
    }

    const date = this.parseDate(datePart);
    return date ? [this.formatDate(date)] : [];
  }

  /**
   * 解析时间部分
   */
  private static parseTimePart(timePart: string | null): { startTime: string; endTime?: string } | null {
    if (!timePart) return null;

    if (timePart.includes('~')) {
      const [start, end] = timePart.split('~');
      return { startTime: start, endTime: end };
    }

    return { startTime: timePart };
  }

  /**
   * 解析日期字符串
   */
  private static parseDate(dateStr: string, referenceDate?: Date): Date | null {
    // 完整格式: 2024-01-01
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date;
    }

    // 简写格式: 01-01（继承参考日期的年月）
    if (dateStr.match(/^\d{2}-\d{2}$/) && referenceDate) {
      const year = referenceDate.getFullYear();
      const month = dateStr.substring(0, 2);
      const day = dateStr.substring(3, 5);
      const date = new Date(`${year}-${month}-${day}`);
      return isNaN(date.getTime()) ? null : date;
    }

    return null;
  }

  /**
   * 展开日期范围
   */
  private static expandDateRange(start: Date, end: Date): string[] {
    const dates: string[] = [];
    const current = new Date(start);

    while (current <= end) {
      dates.push(this.formatDate(new Date(current)));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  /**
   * 格式化日期为 YYYY-MM-DD
   */
  private static formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 解析块属性
   * 格式: {: custom-pomodoro-status="running" custom-pomodoro-start="1234567890" ...}
   * @param line 包含块属性的行
   * @returns 属性对象
   */
  public static parseBlockAttrs(line: string): { [key: string]: string } {
    const attrs: { [key: string]: string } = {};
    const attrRegex = /\{\:\s*([^}]*)\}/;
    const match = line.match(attrRegex);

    if (match) {
      const attrContent = match[1];
      // 匹配 key="value" 或 key='value' 格式
      // key 支持字母、数字、下划线、连字符（如 custom-pomodoro-status）
      const keyValueRegex = /([\w-]+)=['"]([^'"]*)['"]/g;
      let kvMatch;
      while ((kvMatch = keyValueRegex.exec(attrContent)) !== null) {
        attrs[kvMatch[1]] = kvMatch[2];
      }
    }

    return attrs;
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
    const lines = line.split('\n');
    const firstLine = lines[0] || '';

    // 去除列表标记、块属性和缩进
    const cleanedLine = firstLine
      .replace(/^\s*([-]|\d+\.)\s+/, '')  // 列表标记 - 或 1. 等
      .replace(/^\{\:\s*[^}]*\}\s*/, '') // 块属性 {: ... }
      .trim();

    // 检查是否以 🍅 开头
    if (!cleanedLine.startsWith('🍅')) {
      return null;
    }

    // 提取日期时间部分: YYYY-MM-DD HH:mm:ss~HH:mm:ss
    // 支持可选的实际时长前缀: N, 或 N，（中英文逗号，逗号后任意空格）
    // 注意：Kramdown 中 ~ 可能被转义为 \~
    const pomodoroRegex = /^🍅(?:(\d+)[,，]\s*)?(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})(?:\\?~(\d{2}:\d{2}:\d{2}))?\s*(.*)$/;
    const match = cleanedLine.match(pomodoroRegex);

    if (!match) {
      return null;
    }

    const actualDurationMinutes = match[1] ? parseInt(match[1], 10) : undefined;
    const date = match[2];
    const startTime = match[3];
    const endTime = match[4];

    // 处理描述：第一行可能已有描述，加上后续行
    let rawDescription = match[5]?.trim() || '';

    // 如果有后续行，合并为描述（过滤掉块属性行）
    if (lines.length > 1) {
      const descriptionLines = lines
        .slice(1)
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('{:')); // 过滤空行和块属性行
      if (descriptionLines.length > 0) {
        rawDescription = rawDescription
          ? rawDescription + '\n' + descriptionLines.join('\n')
          : descriptionLines.join('\n');
      }
    }

    const description = rawDescription ? parseBlockRefs(rawDescription).stripped || undefined : undefined;

    // 计算专注时长（分钟）
    let durationMinutes = 25; // 默认25分钟
    if (endTime) {
      const startMinutes = this.timeToMinutes(startTime);
      const endMinutes = this.timeToMinutes(endTime);
      durationMinutes = endMinutes - startMinutes;
      if (durationMinutes < 0) {
        durationMinutes += 24 * 60; // 跨天情况
      }
      // 确保至少1分钟
      if (durationMinutes < 1) {
        durationMinutes = 1;
      }
    }

    // 解析块属性中的专注状态
    let status: PomodoroStatus | undefined;
    let itemContent: string | undefined;

    if (attrs) {
      if (attrs['custom-pomodoro-status'] === 'running' || attrs['custom-pomodoro-status'] === 'completed') {
        status = attrs['custom-pomodoro-status'];
      }
      if (attrs['custom-pomodoro-item-content']) {
        itemContent = attrs['custom-pomodoro-item-content'];
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
      itemContent
    };
  }

  /**
   * 将时间字符串转换为分钟数
   */
  private static timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
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
    attrPrefix: string = 'custom-pomodoro'
  ): PomodoroRecord | null {
    if (!value || typeof value !== 'string') return null;

    const trimmedValue = value.trim();

    // 检查是否包含真正的换行符（多行描述格式）
    // 支持两种形式：真正的换行符 \n 或转义的 \\n
    const newlineChar = '\n';
    if (trimmedValue.includes(newlineChar)) {
      const parts = trimmedValue.split(newlineChar);
      const headerPart = parts[0];
      const descLines = parts.slice(1).map(line => line.trim()).filter(line => line && !line.startsWith('{:'));

      // 解析头部: N,YYYY-MM-DD HH:mm:ss~HH:mm:ss
      const headerRegex = /^(\d+)[,，]\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})~(\d{2}:\d{2}:\d{2})\s*$/;
      const headerMatch = headerPart.match(headerRegex);

      if (!headerMatch) return null;

      const durationMinutes = parseInt(headerMatch[1], 10);
      const date = headerMatch[2];
      const startTime = headerMatch[3];
      const endTime = headerMatch[4];
      const description = descLines.join('\n') || undefined;

      return {
        id: `${attrPrefix}-${blockId || 'unknown'}-${date}-${startTime}`,
        date,
        startTime,
        endTime,
        description,
        durationMinutes,
        actualDurationMinutes: durationMinutes,
        blockId
      };
    }

    // 单行描述格式: N,YYYY-MM-DD HH:mm:ss~HH:mm:ss 描述
    const regex = /^(\d+)[,，]\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})~(\d{2}:\d{2}:\d{2})\s*(.*)$/;
    const match = trimmedValue.match(regex);

    if (!match) return null;

    const durationMinutes = parseInt(match[1], 10);
    const date = match[2];
    const startTime = match[3];
    const endTime = match[4];
    const description = match[5]?.trim() || undefined;

    return {
      id: `${attrPrefix}-${blockId || 'unknown'}-${date}-${startTime}`,
      date,
      startTime,
      endTime,
      description: description || undefined,
      durationMinutes,
      actualDurationMinutes: durationMinutes,
      blockId
    };
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
    attrPrefix: string = 'custom-pomodoro'
  ): PomodoroRecord[] {
    const records: PomodoroRecord[] = [];
    const prefix = attrPrefix.endsWith('-') ? attrPrefix : attrPrefix + '-';

    for (const [key, value] of Object.entries(attrs)) {
      if (key.startsWith(prefix) && value) {
        const record = this.parsePomodoroAttrValue(value, blockId, attrPrefix);
        if (record) records.push(record);
      }
    }

    return records;
  }
}
