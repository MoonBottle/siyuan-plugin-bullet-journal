/**
 * dayjs 配置文件
 * 使用用户本地时区，不硬编码特定时区
 */
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

// 加载插件
dayjs.extend(isoWeek);

// 导出配置好的 dayjs 实例（使用本地时区）
export default dayjs;

/**
 * 获取今天的日期字符串 (YYYY-MM-DD)，使用本地时间
 */
export const getTodayISO = (): string => {
  return dayjs().format('YYYY-MM-DD');
};

/**
 * 获取日期字符串 (YYYY-MM-DD)，使用本地时间
 */
export const toISODateString = (date: Date | string | number): string => {
  return dayjs(date).format('YYYY-MM-DD');
};

/**
 * 获取明天的日期字符串 (YYYY-MM-DD)，使用本地时间
 */
export const getTomorrowISO = (): string => {
  return dayjs().add(1, 'day').format('YYYY-MM-DD');
};
