/**
 * 行解析器
 * 从 obsidian-hk-work-plugin 移植
 */
import type { Task, Item, Link, ItemStatus } from '@/types/models';

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
   * 解析工作事项行
   * 格式: 事项内容 @2024-01-01 10:00:00~11:00:00 #done
   */
  public static parseItemLine(line: string, lineNumber: number): Item | null {
    // 必须包含日期标记
    if (!line.match(/@\d{4}-\d{2}-\d{2}/)) {
      return null;
    }

    // 解析状态标签（中英文兼容）
    let status: ItemStatus = 'pending';
    if (line.includes('#done') || line.includes('#已完成')) {
      status = 'completed';
    } else if (line.includes('#abandoned') || line.includes('#已放弃')) {
      status = 'abandoned';
    }

    // 解析日期
    const dateMatch = line.match(/@(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : '';

    // 解析时间范围
    const timeRangeMatch = line.match(
      /@(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})~(\d{2}:\d{2}:\d{2})/
    );

    // 解析单个时间
    const singleTimeMatch = line.match(
      /@(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})(?!~)/
    );

    // 提取事项内容（移除日期和状态标签，中英文）
    const content = line
      .replace(/@\d{4}-\d{2}-\d{2}(\s+\d{2}:\d{2}:\d{2}(~\d{2}:\d{2}:\d{2})?)?/g, '')
      .replace(/#done|#abandoned|#已完成|#已放弃/g, '')
      .trim();

    if (!content) return null;

    return {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      date,
      startDateTime: timeRangeMatch
        ? `${timeRangeMatch[1]} ${timeRangeMatch[2]}`
        : singleTimeMatch
          ? `${singleTimeMatch[1]} ${singleTimeMatch[2]}`
          : undefined,
      endDateTime: timeRangeMatch
        ? `${timeRangeMatch[1]} ${timeRangeMatch[3]}`
        : undefined,
      lineNumber,
      docId: '',
      status
    };
  }
}
