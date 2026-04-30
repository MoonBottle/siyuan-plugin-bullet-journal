/**
 * 习惯行解析器
 * 解析习惯定义行和打卡记录行
 */
import type { Habit, HabitFrequency, CheckInRecord } from '@/types/models';
import { parseReminderFromLine } from './reminderParser';

// 中文星期映射
const CHINESE_DAY_MAP: Record<string, number> = {
  '一': 1, '二': 2, '三': 3, '四': 4,
  '五': 5, '六': 6, '日': 0, '天': 0,
};

// 英文星期映射
const ENGLISH_DAY_MAP: Record<string, number> = {
  'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4,
  'fri': 5, 'sat': 6, 'sun': 0,
};

/**
 * 判断是否为习惯行（包含 🎯 标记）
 */
export function isHabitLine(line: string): boolean {
  return line.includes('🎯');
}

/**
 * 解析习惯频率规则
 * @param freqStr 频率字符串（🔄 后面的内容）
 */
export function parseHabitFrequency(freqStr: string): HabitFrequency | null {
  const str = freqStr.trim();

  // 每天 / daily
  if (str === '每天' || str === 'daily') {
    return { type: 'daily' };
  }

  // 每N天 / every N days
  const everyNDaysMatch = str.match(/^每(\d+)天$|^every\s+(\d+)\s+days?$/i);
  if (everyNDaysMatch) {
    const interval = parseInt(everyNDaysMatch[1] || everyNDaysMatch[2], 10);
    return { type: 'every_n_days', interval };
  }

  // 每周N天 / N days/week（N 为阿拉伯数字）
  const nPerWeekMatch = str.match(/^每周(\d+)天$|^(\d+)\s+days?\/week$/i);
  if (nPerWeekMatch) {
    const daysPerWeek = parseInt(nPerWeekMatch[1] || nPerWeekMatch[2], 10);
    return { type: 'n_per_week', daysPerWeek };
  }

  // 每周指定周几: 每周一三五 / weekly on Mon,Wed,Fri
  const weeklyDaysMatch = str.match(/^每周([一二三四五六日天]+)$|^weekly\s+on\s+(.+)$/i);
  if (weeklyDaysMatch) {
    const daysOfWeek: number[] = [];

    if (weeklyDaysMatch[1]) {
      for (const char of weeklyDaysMatch[1]) {
        if (CHINESE_DAY_MAP[char] !== undefined) {
          daysOfWeek.push(CHINESE_DAY_MAP[char]);
        }
      }
    } else if (weeklyDaysMatch[2]) {
      const dayStrs = weeklyDaysMatch[2].split(/[,，\s]+/);
      for (const dayStr of dayStrs) {
        const lower = dayStr.trim().toLowerCase().substring(0, 3);
        if (ENGLISH_DAY_MAP[lower] !== undefined) {
          daysOfWeek.push(ENGLISH_DAY_MAP[lower]);
        }
      }
    }

    if (daysOfWeek.length > 0) {
      return { type: 'weekly_days', daysOfWeek };
    }
  }

  // 每周 / weekly
  if (str === '每周' || str === 'weekly') {
    return { type: 'weekly' };
  }

  return null;
}

/**
 * 解析习惯定义行
 * 格式: 习惯名 🎯YYYY-MM-DD [坚持N天] [N单位] [⏰HH:mm] 🔄频率
 * @returns Partial<Habit> | null（不是习惯行时返回 null）
 */
export function parseHabitLine(line: string): Partial<Habit> | null {
  // 必须包含 🎯 标记
  if (!line.includes('🎯')) {
    return null;
  }

  // 必须包含 🔄 频率标记
  if (!line.includes('🔄')) {
    return null;
  }

  // 提取习惯名（🎯 前面的文本）
  const targetIndex = line.indexOf('🎯');
  const name = line.substring(0, targetIndex).trim();
  if (!name) {
    return null;
  }

  // 解析开始日期 (🎯YYYY-MM-DD)
  const startDateMatch = line.match(/🎯(\d{4}-\d{2}-\d{2})/);
  if (!startDateMatch) {
    return null;
  }
  const startDate = startDateMatch[1];

  // 解析坚持天数 (坚持N天)
  const durationMatch = line.match(/坚持(\d+)天/);
  const durationDays = durationMatch ? parseInt(durationMatch[1], 10) : undefined;

  // 计算结束日期: startDate + durationDays - 1
  let endDate: string | undefined;
  if (durationDays !== undefined) {
    endDate = calculateEndDate(startDate, durationDays);
  }

  // 在 🎯 之后、🔄 之前查找 target+unit
  const afterTarget = line.substring(targetIndex);
  const freqIndex = afterTarget.indexOf('🔄');
  const beforeFreq = freqIndex >= 0 ? afterTarget.substring(0, freqIndex) : afterTarget;

  // 移除已知标记后搜索计数型目标
  const searchArea = beforeFreq
    .replace(/🎯\d{4}-\d{2}-\d{2}/, '')
    .replace(/坚持\d+天/, '')
    .replace(/⏰\d{2}:\d{2}(?::\d{2})?/, '')
    .trim();

  // 匹配 N+中文单位 或 N+英文单位 (如 8杯, 5公里, 30分钟)
  const countMatch = searchArea.match(/(\d+)([a-zA-Z\u4e00-\u9fff]{1,4})$/);

  let type: 'binary' | 'count' = 'binary';
  let target: number | undefined;
  let unit: string | undefined;

  if (countMatch) {
    type = 'count';
    target = parseInt(countMatch[1], 10);
    unit = countMatch[2];
  }

  // 解析频率 (🔄后面的内容)
  const freqMatch = line.match(/🔄(.+?)$/);
  if (!freqMatch) {
    return null;
  }
  const frequency = parseHabitFrequency(freqMatch[1].trim());
  if (!frequency) {
    return null;
  }

  // 解析提醒（可选，复用 parseReminderFromLine）
  const reminder = parseReminderFromLine(line);

  const result: Partial<Habit> = {
    name,
    type,
    startDate,
    frequency,
  };

  if (durationDays !== undefined) {
    result.durationDays = durationDays;
  }
  if (endDate !== undefined) {
    result.endDate = endDate;
  }
  if (type === 'count') {
    result.target = target;
    result.unit = unit;
  }
  if (reminder) {
    result.reminder = reminder;
  }

  return result;
}

/**
 * 解析打卡记录行
 * 格式: 内容 [N/M单位] 📅YYYY-MM-DD [✅] 或 内容 [N/M单位] @YYYY-MM-DD [✅]
 * @param line 打卡记录行内容
 * @param habitId 所属习惯的 blockId
 */
export function parseCheckInRecordLine(line: string, habitId: string): Partial<CheckInRecord> | null {
  // 必须包含日期标记（📅 或 @）
  const dateMatch = line.match(/📅(\d{4}-\d{2}-\d{2})/) || line.match(/@(\d{4}-\d{2}-\d{2})/);
  if (!dateMatch) {
    return null;
  }

  const date = dateMatch[1];

  // 解析计数格式 N/M单位 (如 3/8杯)
  const countMatch = line.match(/(\d+)\/(\d+)([a-zA-Z\u4e00-\u9fff]+)/);
  let currentValue: number | undefined;
  let targetValue: number | undefined;
  let unit: string | undefined;

  if (countMatch) {
    currentValue = parseInt(countMatch[1], 10);
    targetValue = parseInt(countMatch[2], 10);
    unit = countMatch[3];
  }

  // 提取内容（移除所有标记后的文本）
  let content = line
    .replace(/📅\d{4}-\d{2}-\d{2}/g, '')
    .replace(/@\d{4}-\d{2}-\d{2}/g, '')
    .replace(/✅/g, '')
    .replace(/\d+\/\d+[a-zA-Z\u4e00-\u9fff]+/g, '')
    .trim();

  // 清理多余空格
  content = content.replace(/\s+/g, ' ').trim();

  if (!content) {
    return null;
  }

  const result: Partial<CheckInRecord> = {
    content,
    date,
    habitId,
  };

  if (currentValue !== undefined) {
    result.currentValue = currentValue;
  }
  if (targetValue !== undefined) {
    result.targetValue = targetValue;
  }
  if (unit !== undefined) {
    result.unit = unit;
  }

  return result;
}

/**
 * 解析严格意义上的习惯打卡记录行
 * 需要先满足基础记录格式，再满足习惯记录标记（✅ 或 N/M单位）
 */
export function parseHabitRecordLine(line: string, habitId: string): Partial<CheckInRecord> | null {
  const parsedRecord = parseCheckInRecordLine(line, habitId);
  if (!parsedRecord) {
    return null;
  }

  const hasHabitRecordMarkers = line.includes('✅') || /\d+\/\d+[a-zA-Z\u4e00-\u9fff]+/.test(line);
  return hasHabitRecordMarkers ? parsedRecord : null;
}

/**
 * 计算结束日期
 * @param startDate 开始日期 YYYY-MM-DD
 * @param durationDays 持续天数
 */
function calculateEndDate(startDate: string, durationDays: number): string {
  const date = new Date(startDate);
  date.setDate(date.getDate() + durationDays - 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 生成习惯定义行 Markdown
 * @param habit 习惯对象（部分字段）
 */
export function buildHabitDefinitionMarkdown(habit: Partial<Habit>): string {
  const parts: string[] = [];

  if (habit.name) {
    parts.push(habit.name);
  }

  if (habit.startDate) {
    parts.push(`🎯${habit.startDate}`);
  }

  if (habit.durationDays) {
    parts.push(`坚持${habit.durationDays}天`);
  }

  if (habit.type === 'count' && habit.target !== undefined && habit.unit) {
    parts.push(`${habit.target}${habit.unit}`);
  }

  if (habit.reminder?.enabled && habit.reminder.type === 'absolute' && habit.reminder.time) {
    parts.push(`⏰${habit.reminder.time}`);
  }

  if (habit.frequency) {
    parts.push(`🔄${frequencyToMarkdown(habit.frequency)}`);
  }

  return parts.join(' ');
}

/**
 * 将频率对象转换为 Markdown 字符串
 */
function frequencyToMarkdown(freq: HabitFrequency): string {
  switch (freq.type) {
    case 'daily':
      return '每天';
    case 'every_n_days':
      return `每${freq.interval}天`;
    case 'weekly':
      return '每周';
    case 'n_per_week':
      return `每周${freq.daysPerWeek}天`;
    case 'weekly_days': {
      if (freq.daysOfWeek && freq.daysOfWeek.length > 0) {
        const weekDayChars = ['日', '一', '二', '三', '四', '五', '六'];
        const dayChars = freq.daysOfWeek
          .map(d => weekDayChars[d] ?? '')
          .filter(Boolean)
          .join('');
        return `每周${dayChars}`;
      }
      return '每周';
    }
    default:
      return '';
  }
}
