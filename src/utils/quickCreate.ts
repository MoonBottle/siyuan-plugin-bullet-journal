/**
 * Quick Create Utility
 * Utility functions for creating tasks and items via API with smart parsing
 */

import type { BlockId, DocumentId } from '@/types';
import type { Item, Task, Project, ItemStatus } from '@/types/models';
import * as siyuanAPI from '@/api';
import dayjs from '@/utils/dayjs';

/**
 * 快速创建选项
 */
export interface QuickCreateOptions {
  projectId: string;
  taskId?: string;
}

/**
 * 解析结果
 */
export interface ParsedInput {
  type: 'task' | 'item';
  content: string;
  level?: 'L1' | 'L2' | 'L3';
  date?: string;
  startTime?: string;
  endTime?: string;
  priority?: 'high' | 'medium' | 'low';
  tags: string[];
}

/**
 * 创建结果
 */
export interface CreateResult {
  success: boolean;
  message: string;
  id?: string;
  blockId?: string;
}

/**
 * 日期关键字映射
 */
const DATE_KEYWORDS: Record<string, () => string> = {
  '今天': () => dayjs().format('YYYY-MM-DD'),
  '明天': () => dayjs().add(1, 'day').format('YYYY-MM-DD'),
  '后天': () => dayjs().add(2, 'day').format('YYYY-MM-DD'),
  '昨天': () => dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
  'today': () => dayjs().format('YYYY-MM-DD'),
  'tomorrow': () => dayjs().add(1, 'day').format('YYYY-MM-DD'),
  'yesterday': () => dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
};

/**
 * 智能解析快速输入
 * 支持格式：
 * - 任务: "任务名称 #task @L1" 或 "!任务名称" (L1), "!!任务名称" (L2), "!!!任务名称" (L3)
 * - 事项: "事项内容 📅2024-01-15" 或 "事项内容 @今天 14:00~16:00"
 * - 优先级: "🔥高优先级" (高), "🌱中优先级" (中), "🍃低优先级" (低) - 使用 Emoji 标记
 *
 * @param input 用户输入字符串
 * @returns 解析结果
 */
export function parseQuickInput(input: string): ParsedInput {
  const trimmed = input.trim();
  if (!trimmed) {
    return { type: 'item', content: '', tags: [] };
  }

  const result: ParsedInput = {
    type: 'item',
    content: trimmed,
    tags: [],
  };

  // 检测是否为任务（包含 #task 或使用任务级别符号）
  const taskMatch = trimmed.match(/^!{1,3}\s*(.+)$/);
  const hasTaskTag = /#task\b/i.test(trimmed);
  const hasLevelTag = /@(L[123])\b/i.test(trimmed);

  if (hasTaskTag || hasLevelTag || taskMatch) {
    result.type = 'task';

    // 提取级别
    if (taskMatch) {
      const levelMap: Record<number, 'L1' | 'L2' | 'L3'> = { 1: 'L1', 2: 'L2', 3: 'L3' };
      result.level = levelMap[taskMatch[0].match(/!/g)?.length || 1];
      result.content = taskMatch[1];
    } else {
      const levelMatch = trimmed.match(/@(L[123])\b/i);
      result.level = (levelMatch?.[1] as 'L1' | 'L2' | 'L3') || 'L1';
    }

    // 清理内容中的任务标记
    result.content = result.content
      .replace(/#task\b/gi, '')
      .replace(/@(L[123])\b/gi, '')
      .trim();
  } else {
    // 解析事项特有的属性
    result.type = 'item';

    // 解析日期（支持 📅YYYY-MM-DD 或 @YYYY-MM-DD 或关键字）
    let content = trimmed;

    // 日期格式 1: 📅YYYY-MM-DD
    const emojiDateMatch = content.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
    if (emojiDateMatch) {
      result.date = emojiDateMatch[1];
      content = content.replace(emojiDateMatch[0], '').trim();
    }

    // 日期格式 2: @YYYY-MM-DD 或 @关键字
    const atDateMatch = content.match(/@\s*(\d{4}-\d{2}-\d{2}|今天|明天|后天|昨天|today|tomorrow|yesterday)\b/);
    if (atDateMatch && !result.date) {
      const dateValue = atDateMatch[1];
      if (DATE_KEYWORDS[dateValue]) {
        result.date = DATE_KEYWORDS[dateValue]();
      } else {
        result.date = dateValue;
      }
      content = content.replace(atDateMatch[0], '').trim();
    }

    // 解析时间范围: HH:mm~HH:mm 或 HH:mm-HH:mm
    const timeRangeMatch = content.match(/(\d{1,2}:\d{2})\s*[~-]\s*(\d{1,2}:\d{2})/);
    if (timeRangeMatch) {
      result.startTime = timeRangeMatch[1];
      result.endTime = timeRangeMatch[2];
      content = content.replace(timeRangeMatch[0], '').trim();
    } else {
      // 单个时间点
      const singleTimeMatch = content.match(/(\d{1,2}:\d{2})(?!\s*[~-])/);
      if (singleTimeMatch) {
        result.startTime = singleTimeMatch[1];
        content = content.replace(singleTimeMatch[0], '').trim();
      }
    }

    // 解析优先级（支持 Emoji 标记）
    const priorityEmojiMatch = content.match(/([🔥🌱🍃])/);
    if (priorityEmojiMatch) {
      const priorityEmojiMap: Record<string, 'high' | 'medium' | 'low'> = {
        '🔥': 'high',
        '🌱': 'medium',
        '🍃': 'low',
      };
      result.priority = priorityEmojiMap[priorityEmojiMatch[1]];
      content = content.replace(priorityEmojiMatch[0], '').trim();
    }

    // 解析标签（剩余 #xxx 格式的内容）
    const tagMatches = content.match(/#\w+/g);
    if (tagMatches) {
      result.tags = tagMatches.map(t => t.slice(1));
      content = content.replace(/#\w+/g, '').trim();
    }

    result.content = content;

    // 默认使用今天日期（如果没有指定）
    if (!result.date) {
      result.date = dayjs().format('YYYY-MM-DD');
    }
  }

  return result;
}

/**
 * 在指定项目下创建任务
 *
 * @param projectId 项目文档 ID
 * @param name 任务名称
 * @param level 任务级别 (L1/L2/L3)，默认 L1
 * @returns 创建结果
 */
export async function createTask(
  projectId: string,
  name: string,
  level: 'L1' | 'L2' | 'L3' = 'L1'
): Promise<CreateResult> {
  if (!name.trim()) {
    return { success: false, message: '任务名称不能为空' };
  }

  const taskMarkdown = `${name} #task @${level}`;

  try {
    const result = await siyuanAPI.appendBlock(
      'markdown',
      taskMarkdown,
      projectId
    );

    if (result && result[0]) {
      const newBlockId = (result[0] as any).doOperations?.[0]?.id;
      return {
        success: true,
        message: `已创建任务"${name}"（${level}）`,
        id: newBlockId,
        blockId: newBlockId,
      };
    }

    return { success: false, message: '创建任务失败：API 未返回结果' };
  } catch (error) {
    return {
      success: false,
      message: `创建任务失败: ${(error as Error).message}`,
    };
  }
}

/**
 * 在指定任务下创建事项
 *
 * @param taskBlockId 任务块 ID（用于确定插入位置）
 * @param content 事项内容
 * @param date 日期 (YYYY-MM-DD)
 * @param startTime 开始时间 (HH:mm)，可选
 * @param endTime 结束时间 (HH:mm)，可选
 * @param options 额外选项
 * @returns 创建结果
 */
export async function createItem(
  taskBlockId: string,
  content: string,
  date: string,
  startTime?: string,
  endTime?: string,
  options?: {
    priority?: 'high' | 'medium' | 'low';
    tags?: string[];
  }
): Promise<CreateResult> {
  if (!content.trim()) {
    return { success: false, message: '事项内容不能为空' };
  }

  if (!date) {
    return { success: false, message: '事项日期不能为空' };
  }

  // 构建事项 Markdown
  let datePart = `📅${date}`;
  if (startTime && endTime) {
    datePart = `📅${date} ${startTime}~${endTime}`;
  } else if (startTime) {
    datePart = `📅${date} ${startTime}`;
  }

  let itemContent = `${content} ${datePart}`;

  // 添加优先级标记（使用 Emoji）
  if (options?.priority) {
    const priorityMap: Record<string, string> = {
      high: '🔥',
      medium: '🌱',
      low: '🍃',
    };
    itemContent += ` ${priorityMap[options.priority]}`;
  }

  // 添加标签
  if (options?.tags?.length) {
    itemContent += ` ${options.tags.map(t => `#${t}`).join(' ')}`;
  }

  try {
    // 在任务块后插入事项
    const result = await siyuanAPI.insertBlock(
      'markdown',
      itemContent,
      undefined,
      taskBlockId,
      undefined
    );

    if (result && result[0]) {
      const newBlockId = (result[0] as any).doOperations?.[0]?.id;
      return {
        success: true,
        message: `已创建事项"${content}"（${date}${startTime ? ` ${startTime}` : ''}）`,
        id: newBlockId,
        blockId: newBlockId,
      };
    }

    return { success: false, message: '创建事项失败：API 未返回结果' };
  } catch (error) {
    return {
      success: false,
      message: `创建事项失败: ${(error as Error).message}`,
    };
  }
}

/**
 * 智能创建 - 根据输入自动判断创建任务还是事项
 *
 * @param input 用户输入（支持智能解析格式）
 * @param projectId 项目 ID（必须）
 * @param taskBlockId 任务块 ID（创建事项时必须）
 * @returns 创建结果
 */
export async function smartCreate(
  input: string,
  projectId: string,
  taskBlockId?: string
): Promise<CreateResult> {
  const parsed = parseQuickInput(input);

  if (parsed.type === 'task') {
    return createTask(projectId, parsed.content, parsed.level);
  } else {
    if (!taskBlockId) {
      return {
        success: false,
        message: '创建事项需要提供任务块 ID（taskBlockId）',
      };
    }
    return createItem(
      taskBlockId,
      parsed.content,
      parsed.date || dayjs().format('YYYY-MM-DD'),
      parsed.startTime,
      parsed.endTime,
      {
        priority: parsed.priority,
        tags: parsed.tags,
      }
    );
  }
}

/**
 * 批量创建任务
 *
 * @param projectId 项目 ID
 * @param names 任务名称数组
 * @param level 任务级别
 * @returns 批量创建结果
 */
export async function batchCreateTasks(
  projectId: string,
  names: string[],
  level: 'L1' | 'L2' | 'L3' = 'L1'
): Promise<{ success: boolean; results: CreateResult[]; message: string }> {
  const results: CreateResult[] = [];
  let successCount = 0;

  for (const name of names) {
    const result = await createTask(projectId, name, level);
    results.push(result);
    if (result.success) successCount++;
  }

  return {
    success: successCount === names.length,
    results,
    message: `成功创建 ${successCount}/${names.length} 个任务`,
  };
}

/**
 * 批量创建事项
 *
 * @param taskBlockId 任务块 ID
 * @param items 事项配置数组
 * @returns 批量创建结果
 */
export async function batchCreateItems(
  taskBlockId: string,
  items: Array<{
    content: string;
    date: string;
    startTime?: string;
    endTime?: string;
    priority?: 'high' | 'medium' | 'low';
    tags?: string[];
  }>
): Promise<{ success: boolean; results: CreateResult[]; message: string }> {
  const results: CreateResult[] = [];
  let successCount = 0;

  for (const item of items) {
    const result = await createItem(
      taskBlockId,
      item.content,
      item.date,
      item.startTime,
      item.endTime,
      {
        priority: item.priority,
        tags: item.tags,
      }
    );
    results.push(result);
    if (result.success) successCount++;
  }

  return {
    success: successCount === items.length,
    results,
    message: `成功创建 ${successCount}/${items.length} 个事项`,
  };
}

/**
 * 验证快速输入
 *
 * @param input 用户输入
 * @returns 验证结果
 */
export function validateQuickInput(input: string): {
  valid: boolean;
  error?: string;
  parsed?: ParsedInput;
} {
  if (!input || !input.trim()) {
    return { valid: false, error: '输入不能为空' };
  }

  const parsed = parseQuickInput(input);

  if (!parsed.content.trim()) {
    return { valid: false, error: '内容不能为空', parsed };
  }

  if (parsed.type === 'item' && !parsed.date) {
    // 事项默认使用今天日期，不需要报错
  }

  return { valid: true, parsed };
}

/**
 * 生成输入建议
 * 根据部分输入生成建议
 *
 * @param partialInput 部分输入
 * @returns 建议列表
 */
export function getInputSuggestions(partialInput: string): string[] {
  const suggestions: string[] = [];
  const trimmed = partialInput.trim();

  // 日期建议
  if (/@$|@\s*$/.test(trimmed) || /今天|明天|后天/.test(trimmed)) {
    suggestions.push(
      `${trimmed.replace(/@\s*$/, '')} @今天`,
      `${trimmed.replace(/@\s*$/, '')} @明天`,
      `${trimmed.replace(/@\s*$/, '')} @后天`
    );
  }

  // 时间建议
  if (/\d{4}-\d{2}-\d{2}$/.test(trimmed) || /:\d{2}$/.test(trimmed)) {
    suggestions.push(
      `${trimmed} 09:00~12:00`,
      `${trimmed} 14:00~18:00`
    );
  }

  // 任务级别建议
  if (/#task$|!$/.test(trimmed)) {
    suggestions.push(
      `${trimmed} @L1`,
      `${trimmed} @L2`,
      `${trimmed} @L3`
    );
  }

  return suggestions;
}
