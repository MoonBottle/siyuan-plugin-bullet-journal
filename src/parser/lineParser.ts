/**
 * 行解析器
 * 从 obsidian-hk-work-plugin 移植
 */
import type { Task, Item, Link, ItemStatus, PomodoroRecord, PomodoroStatus } from '@/types/models';

export class LineParser {
  /**
   * 解析任务行
   * 格式: 任务名称 #任务 @L1 @2024-01-01 https://link
   */
  public static parseTaskLine(line: string, lineNumber: number): Task {
    // 解析任务级别 @L1 @L2 @L3
    const levelMatch = line.match(/@L([123])/);
    const level = levelMatch ? `L${levelMatch[1]}` as 'L1' | 'L2' | 'L3' : 'L1';

    // 解析日期 @YYYY-MM-DD
    const dateMatch = line.match(/@(\d{4}-\d{2}-\d{2})/);
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
      .replace(/@L[123]/g, '')
      .replace(/@\d{4}-\d{2}-\d{2}(\s+\d{2}:\d{2}:\d{2}(~\d{2}:\d{2}:\d{2})?)?/g, '')
      .replace(/https?:\/\/[^\s]+/g, '')
      .trim();

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
      links: links.length > 0 ? links : undefined,
      items: [],
      lineNumber
    };
  }

  /**
   * 解析工作事项行（支持多日期）
   * 格式: 事项内容 @2024-01-01 10:00:00~11:00:00, 2024-01-03 14:00:00~15:00:00 #done
   * 支持: @2024-01-01, @2024-01-01~2024-01-05, @2024-01-01~01-05（简写）
   * 支持中英文逗号分隔
   * @param line 事项行内容
   * @param lineNumber 行号
   * @param links 关联的链接列表（可选，由上层解析器提供）
   */
  public static parseItemLine(line: string, lineNumber: number, links?: Link[]): Item[] {
    // 必须包含日期标记
    if (!line.match(/@\d{4}-\d{2}-\d{2}/)) {
      return [];
    }

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

    // 解析状态标签（中英文兼容）- 优先级高于任务列表标记
    let status: ItemStatus = 'pending';
    if (line.includes('#done') || line.includes('#已完成')) {
      status = 'completed';
    } else if (line.includes('#abandoned') || line.includes('#已放弃')) {
      status = 'abandoned';
    } else if (taskListStatus) {
      // 没有状态标签时，使用任务列表状态
      status = taskListStatus;
    }

    // 将中文逗号替换为英文逗号，便于统一处理
    const normalizedLine = line.replace(/，/g, ',');

    // 提取所有日期时间表达式（支持逗号分隔的多个日期）
    const dateTimeExpressions = this.extractDateTimeExpressions(normalizedLine);
    if (dateTimeExpressions.length === 0) return [];

    // 提取内容（在 normalizedLine 上移除所有日期时间表达式、状态标签和任务列表标记）
    let content = normalizedLine;
    for (const expr of dateTimeExpressions) {
      content = content.replace(expr.fullMatch, '');
    }
    content = content
      .replace(/#done|#abandoned|#已完成|#已放弃/g, '')
      .replace(/\[([ xX])\]\s*/, '')  // 移除任务列表标记 [ ] [x] [X] 及其后的空格
      .replace(/,/g, '')  // 移除英文逗号（normalizedLine 中只有英文逗号）
      .trim();

    if (!content) return [];

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
        links: links?.length ? links : undefined,  // 添加链接
        siblingItems: siblingItems.length > 0 ? siblingItems : undefined
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

    // 首先找到所有以 @ 开头的日期时间块
    // 匹配 @日期 或 @日期 时间 或 @日期 时间~时间，以及后续逗号分隔的日期
    const mainRegex = /@(\d{4}-\d{2}-\d{2}(?:~\d{4}-\d{2}-\d{2}|~\d{2}-\d{2})?)(?:\s+(\d{2}:\d{2}:\d{2}(?:~\d{2}:\d{2}:\d{2})?))?/g;

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
   * @param line 番茄钟行内容
   * @param blockId 块 ID
   * @param attrs 可选的块属性
   * @returns PomodoroRecord 对象，解析失败返回 null
   */
  public static parsePomodoroLine(line: string, blockId?: string, attrs?: { [key: string]: string }): PomodoroRecord | null {
    // 去除列表标记、块属性和缩进
    const cleanedLine = line
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
    const description = match[5]?.trim() || undefined;

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
}
