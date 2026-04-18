/**
 * 习惯统计计算工具
 * 纯计算层，不涉及 DOM 或 API 调用
 */
import type { Habit, HabitStats, CheckInRecord } from '@/types/models';
import dayjs from '@/utils/dayjs';

/**
 * 判断单条打卡记录是否达标
 */
export function isRecordCompleted(record: CheckInRecord, habit: Habit): boolean {
  if (habit.type === 'binary') {
    return true; // 二元型有记录即完成
  }
  // 计数型：currentValue >= target
  const target = habit.target ?? record.targetValue ?? 0;
  return (record.currentValue ?? 0) >= target;
}

/**
 * 计算单个习惯的统计数据
 * @param habit 习惯对象
 * @param currentDate 当前日期（YYYY-MM-DD）
 */
export function calculateHabitStats(habit: Habit, currentDate: string): HabitStats {
  const records = habit.records || [];
  const startDate = habit.startDate;
  const frequency = habit.frequency || { type: 'daily' };

  // 计算需要打卡的天数（从 startDate 到 currentDate，根据频率规则）
  const totalExpectedDays = calculateExpectedDays(startDate, currentDate, frequency);

  // 按日期去重打卡记录，只保留每天的"最佳"记录（计数型取最大值）
  const recordsByDate = groupRecordsByDate(records, habit);

  // 统计达标天数
  let totalCheckins = 0;
  let monthlyCheckins = 0;
  const currentMonth = currentDate.substring(0, 7); // YYYY-MM

  // 计数型累计值
  let totalValue = 0;

  const completedDates: string[] = [];

  for (const [date, isCompleted] of recordsByDate) {
    if (isCompleted) {
      totalCheckins++;
      completedDates.push(date);
      if (date.startsWith(currentMonth)) {
        monthlyCheckins++;
      }
    }
    // 计数型累计所有值（不论是否达标）
    if (habit.type === 'count') {
      const record = records.find(r => r.date === date);
      if (record?.currentValue) {
        totalValue += record.currentValue;
      }
    }
  }

  // 连续天数计算
  const { currentStreak, longestStreak } = calculateStreaks(completedDates, currentDate);

  // 总完成率
  const completionRate = totalExpectedDays > 0 ? totalCheckins / totalExpectedDays : 0;

  // 本月完成率
  const monthStart = currentMonth + '-01';
  const monthExpectedDays = calculateExpectedDays(
    startDate > monthStart ? startDate : monthStart,
    currentDate,
    frequency
  );
  const monthlyCompletionRate = monthExpectedDays > 0 ? monthlyCheckins / monthExpectedDays : 0;

  // 本周完成率
  const weekStart = dayjs(currentDate).startOf('week').add(1, 'day').format('YYYY-MM-DD'); // 周一开始
  const weekExpectedDays = calculateExpectedDays(
    startDate > weekStart ? startDate : weekStart,
    currentDate,
    frequency
  );
  const weeklyCheckins = completedDates.filter(d => d >= weekStart).length;
  const weeklyCompletionRate = weekExpectedDays > 0 ? weeklyCheckins / weekExpectedDays : 0;

  // 日均值（计数型）
  const daysSinceStart = dayjs(currentDate).diff(dayjs(startDate), 'day') + 1;
  const averageValue = habit.type === 'count' && daysSinceStart > 0 ? totalValue / daysSinceStart : undefined;

  // 习惯是否已结束
  const isCompleted = habit.durationDays
    ? dayjs(startDate).add(habit.durationDays - 1, 'day').isBefore(dayjs(currentDate), 'day') ||
      dayjs(startDate).add(habit.durationDays - 1, 'day').isSame(dayjs(currentDate), 'day')
    : false;

  // 当期是否已达标（今天是否已打卡/达标）
  const todayRecord = records.find(r => r.date === currentDate);
  const isPeriodCompleted = todayRecord ? isRecordCompleted(todayRecord, habit) : false;

  return {
    habitId: habit.blockId,
    monthlyCheckins,
    totalCheckins,
    currentStreak,
    longestStreak,
    completionRate: Math.min(completionRate, 1),
    monthlyCompletionRate: Math.min(monthlyCompletionRate, 1),
    weeklyCompletionRate: Math.min(weeklyCompletionRate, 1),
    totalValue: habit.type === 'count' ? totalValue : undefined,
    averageValue,
    isCompleted,
    isPeriodCompleted
  };
}

/**
 * 计算批量习惯统计
 */
export function calculateAllHabitStats(habits: Habit[], currentDate: string): Map<string, HabitStats> {
  const result = new Map<string, HabitStats>();
  for (const habit of habits) {
    result.set(habit.blockId, calculateHabitStats(habit, currentDate));
  }
  return result;
}

/**
 * 根据频率规则计算预期打卡天数
 */
function calculateExpectedDays(
  startDate: string,
  currentDate: string,
  frequency: Habit['frequency']
): number {
  if (startDate > currentDate) return 0;

  const start = dayjs(startDate);
  const end = dayjs(currentDate);
  const totalDays = end.diff(start, 'day') + 1;

  switch (frequency?.type) {
    case 'daily':
      return totalDays;

    case 'every_n_days': {
      const interval = frequency.interval || 2;
      return Math.ceil(totalDays / interval);
    }

    case 'weekly':
      return Math.ceil(totalDays / 7);

    case 'n_per_week': {
      const daysPerWeek = frequency.daysPerWeek || 3;
      const weeks = Math.ceil(totalDays / 7);
      return Math.round(weeks * daysPerWeek);
    }

    case 'weekly_days': {
      const daysOfWeek = frequency.daysOfWeek || [];
      if (daysOfWeek.length === 0) return 0;
      let count = 0;
      for (let d = 0; d < totalDays; d++) {
        const dow = start.add(d, 'day').day(); // 0=Sun
        if (daysOfWeek.includes(dow)) count++;
      }
      return count;
    }

    default:
      return totalDays;
  }
}

/**
 * 按日期去重打卡记录，返回每天的达标状态
 */
function groupRecordsByDate(records: CheckInRecord[], habit: Habit): Map<string, boolean> {
  const dateMap = new Map<string, { completed: boolean; maxValue: number; target: number }>();

  for (const record of records) {
    const existing = dateMap.get(record.date);
    const isCompleted = isRecordCompleted(record, habit);

    if (!existing) {
      dateMap.set(record.date, {
        completed: isCompleted,
        maxValue: record.currentValue ?? 0,
        target: record.targetValue ?? habit.target ?? 0
      });
    } else {
      // 计数型：取最大值
      if (habit.type === 'count') {
        const maxVal = Math.max(existing.maxValue, record.currentValue ?? 0);
        existing.maxValue = maxVal;
        existing.completed = maxVal >= existing.target;
      } else {
        // 二元型：任意一条达标即可
        if (isCompleted) existing.completed = true;
      }
    }
  }

  const result = new Map<string, boolean>();
  for (const [date, data] of dateMap) {
    result.set(date, data.completed);
  }
  return result;
}

/**
 * 计算连续天数
 * currentStreak: 从今天/昨天往前连续打卡天数
 * longestStreak: 历史最长连续
 */
function calculateStreaks(completedDates: string[], currentDate: string): {
  currentStreak: number;
  longestStreak: number;
} {
  if (completedDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  const sorted = [...completedDates].sort();

  // 最长连续
  let longestStreak = 1;
  let tempStreak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = dayjs(sorted[i - 1]);
    const curr = dayjs(sorted[i]);
    if (curr.diff(prev, 'day') === 1) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  // 当前连续：从今天或昨天开始往前数
  let currentStreak = 0;
  const today = dayjs(currentDate);
  const yesterday = today.subtract(1, 'day');

  // 找到最近的打卡日期（今天或昨天）
  let startFrom: dayjs.Dayjs | null = null;
  if (sorted.includes(currentDate)) {
    startFrom = today;
  } else if (sorted.includes(yesterday.format('YYYY-MM-DD'))) {
    startFrom = yesterday;
  }

  if (startFrom) {
    currentStreak = 1;
    let checkDate = startFrom.subtract(1, 'day');
    while (sorted.includes(checkDate.format('YYYY-MM-DD'))) {
      currentStreak++;
      checkDate = checkDate.subtract(1, 'day');
    }
  }

  return { currentStreak, longestStreak };
}
