/**
 * dateRangeUtils 单元测试
 * - filterDateRangeRepresentative：代表项选择
 * - getDateRangeStatus：状态规则
 * - getEffectiveDate
 */
import { describe, it, expect } from 'vitest';
import {
  filterDateRangeRepresentative,
  getEffectiveDate,
  getDateRangeStatus,
  getTimeRangeStatus,
  dateRangeStatusToEmoji
} from '@/utils/dateRangeUtils';
import type { Item } from '@/types/models';

const mkItem = (
  date: string,
  blockId: string,
  dateRangeStart?: string,
  dateRangeEnd?: string
): Item =>
  ({
    id: `item-${date}`,
    content: 'test',
    date,
    lineNumber: 1,
    docId: 'doc1',
    blockId,
    status: 'pending',
    dateRangeStart,
    dateRangeEnd
  }) as Item;

describe('getEffectiveDate', () => {
  it('多日期返回 dateRangeEnd', () => {
    const item = mkItem('2026-03-07', 'b1', '2026-03-07', '2026-03-09');
    expect(getEffectiveDate(item)).toBe('2026-03-09');
  });

  it('单日返回 date', () => {
    const item = mkItem('2026-03-09', 'b1');
    expect(getEffectiveDate(item)).toBe('2026-03-09');
  });
});

describe('filterDateRangeRepresentative', () => {
  it('代表项：今天在范围内', () => {
    const items = [
      mkItem('2026-03-07', 'b1', '2026-03-07', '2026-03-09'),
      mkItem('2026-03-08', 'b1', '2026-03-07', '2026-03-09'),
      mkItem('2026-03-09', 'b1', '2026-03-07', '2026-03-09')
    ];
    const result = filterDateRangeRepresentative(items, '2026-03-08');
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-03-08');
  });

  it('代表项：今天之后最近（离散）', () => {
    const items = [
      mkItem('2026-03-07', 'b1', '2026-03-07', '2026-03-09'),
      mkItem('2026-03-09', 'b1', '2026-03-07', '2026-03-09')
    ];
    const result = filterDateRangeRepresentative(items, '2026-03-08');
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-03-09');
  });

  it('代表项：离散 @07,11，今天 10 号，无今日项，代表项为 11 号', () => {
    const items = [
      mkItem('2026-03-07', 'b1', '2026-03-07', '2026-03-11'),
      mkItem('2026-03-11', 'b1', '2026-03-07', '2026-03-11')
    ];
    const result = filterDateRangeRepresentative(items, '2026-03-10');
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-03-11');
  });

  it('代表项：混合，今天 10 号', () => {
    const items = [
      mkItem('2026-03-07', 'b1', '2026-03-07', '2026-03-20'),
      mkItem('2026-03-09', 'b1', '2026-03-07', '2026-03-20'),
      mkItem('2026-03-13', 'b1', '2026-03-07', '2026-03-20'),
      mkItem('2026-03-14', 'b1', '2026-03-07', '2026-03-20')
    ];
    const result = filterDateRangeRepresentative(items, '2026-03-10');
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-03-13');
  });

  it('代表项：今天 < 开始日', () => {
    const items = [
      mkItem('2026-03-07', 'b1', '2026-03-07', '2026-03-09'),
      mkItem('2026-03-08', 'b1', '2026-03-07', '2026-03-09'),
      mkItem('2026-03-09', 'b1', '2026-03-07', '2026-03-09')
    ];
    const result = filterDateRangeRepresentative(items, '2026-03-05');
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-03-07');
  });

  it('代表项：今天 > 结束日', () => {
    const items = [
      mkItem('2026-03-07', 'b1', '2026-03-07', '2026-03-09'),
      mkItem('2026-03-08', 'b1', '2026-03-07', '2026-03-09'),
      mkItem('2026-03-09', 'b1', '2026-03-07', '2026-03-09')
    ];
    const result = filterDateRangeRepresentative(items, '2026-03-10');
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-03-09');
  });

  it('单日事项不过滤', () => {
    const items = [mkItem('2026-03-09', 'b1')];
    const result = filterDateRangeRepresentative(items, '2026-03-08');
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-03-09');
  });
});

describe('getDateRangeStatus', () => {
  it('进行中：今天=开始日', () => {
    const item = mkItem('2026-03-07', 'b1', '2026-03-07', '2026-03-09');
    expect(getDateRangeStatus(item, '2026-03-07')).toBe('in_progress');
  });

  it('进行中：今天在中间', () => {
    const item = mkItem('2026-03-08', 'b1', '2026-03-07', '2026-03-09');
    expect(getDateRangeStatus(item, '2026-03-08')).toBe('in_progress');
  });

  it('进行中：今天=结束日', () => {
    const item = mkItem('2026-03-09', 'b1', '2026-03-07', '2026-03-09');
    expect(getDateRangeStatus(item, '2026-03-09')).toBe('in_progress');
  });

  it('待办：今天 < 开始日', () => {
    const item = mkItem('2026-03-07', 'b1', '2026-03-07', '2026-03-09');
    expect(getDateRangeStatus(item, '2026-03-05')).toBe('pending');
  });

  it('待办：今天 = 开始日-1', () => {
    const item = mkItem('2026-03-07', 'b1', '2026-03-07', '2026-03-09');
    expect(getDateRangeStatus(item, '2026-03-06')).toBe('pending');
  });

  it('过期：今天 > 结束日', () => {
    const item = mkItem('2026-03-09', 'b1', '2026-03-07', '2026-03-09');
    expect(getDateRangeStatus(item, '2026-03-10')).toBe('expired');
  });

  it('过期：今天 = 结束日+1', () => {
    const item = mkItem('2026-03-09', 'b1', '2026-03-07', '2026-03-09');
    expect(getDateRangeStatus(item, '2026-03-10')).toBe('expired');
  });

  it('已完成：getDateRangeStatus 不处理 status，由调用方优先判断', () => {
    const item = mkItem('2026-03-08', 'b1', '2026-03-07', '2026-03-09');
    (item as any).status = 'completed';
    expect(getDateRangeStatus(item, '2026-03-08')).toBe('in_progress');
  });

  it('已放弃：getDateRangeStatus 不处理 status，由调用方优先判断', () => {
    const item = mkItem('2026-03-08', 'b1', '2026-03-07', '2026-03-09');
    (item as any).status = 'abandoned';
    expect(getDateRangeStatus(item, '2026-03-08')).toBe('in_progress');
  });

  it('单日事项返回 undefined', () => {
    const item = mkItem('2026-03-09', 'b1');
    expect(getDateRangeStatus(item, '2026-03-09')).toBeUndefined();
  });
});

describe('getTimeRangeStatus', () => {
  const itemWithTimeRange = {
    date: '2026-03-10',
    startDateTime: '2026-03-10 19:00:00',
    endDateTime: '2026-03-10 22:15:00'
  };

  it('进行中：当天时间在范围内', () => {
    expect(getTimeRangeStatus(itemWithTimeRange, '2026-03-10 20:44:34')).toBe('in_progress');
  });

  it('进行中：当前=开始时间', () => {
    expect(getTimeRangeStatus(itemWithTimeRange, '2026-03-10 19:00:00')).toBe('in_progress');
  });

  it('进行中：当前=结束时间', () => {
    expect(getTimeRangeStatus(itemWithTimeRange, '2026-03-10 22:15:00')).toBe('in_progress');
  });

  it('待办：当天时间早于开始', () => {
    expect(getTimeRangeStatus(itemWithTimeRange, '2026-03-10 18:00:00')).toBe('pending');
  });

  it('待办：未来日期', () => {
    expect(getTimeRangeStatus(itemWithTimeRange, '2026-03-09 20:00:00')).toBe('pending');
  });

  it('已过期：当天时间晚于结束', () => {
    expect(getTimeRangeStatus(itemWithTimeRange, '2026-03-10 23:00:00')).toBe('expired');
  });

  it('已过期：次日', () => {
    expect(getTimeRangeStatus(itemWithTimeRange, '2026-03-11 10:00:00')).toBe('expired');
  });

  it('已过期：昨日（今日 03-11）', () => {
    expect(getTimeRangeStatus(itemWithTimeRange, '2026-03-11 08:00:00')).toBe('expired');
  });

  it('无 date 返回 undefined', () => {
    expect(getTimeRangeStatus({}, '2026-03-10 20:00:00')).toBeUndefined();
  });

  it('仅 start 无 end：当前 < start', () => {
    const item = { date: '2026-03-10', startDateTime: '2026-03-10 19:00:00' };
    expect(getTimeRangeStatus(item, '2026-03-10 18:00:00')).toBe('pending');
  });

  it('仅 start 无 end：当前 = start', () => {
    const item = { date: '2026-03-10', startDateTime: '2026-03-10 19:00:00' };
    expect(getTimeRangeStatus(item, '2026-03-10 19:00:00')).toBe('in_progress');
  });

  it('仅 start 无 end：当前 > start', () => {
    const item = { date: '2026-03-10', startDateTime: '2026-03-10 19:00:00' };
    expect(getTimeRangeStatus(item, '2026-03-10 20:00:00')).toBe('expired');
  });

  it('全天：当天进行中', () => {
    const item = { date: '2026-03-10' };
    expect(getTimeRangeStatus(item, '2026-03-10 14:00:00')).toBe('in_progress');
  });

  it('全天：未来待办', () => {
    const item = { date: '2026-03-10' };
    expect(getTimeRangeStatus(item, '2026-03-09 20:00:00')).toBe('pending');
  });

  it('全天：已过期', () => {
    const item = { date: '2026-03-10' };
    expect(getTimeRangeStatus(item, '2026-03-11 10:00:00')).toBe('expired');
  });
});

describe('dateRangeStatusToEmoji', () => {
  it('in_progress -> 🔄', () => {
    expect(dateRangeStatusToEmoji('in_progress')).toBe('🔄 ');
  });

  it('pending -> ⏳', () => {
    expect(dateRangeStatusToEmoji('pending')).toBe('⏳ ');
  });

  it('expired -> ⚠️', () => {
    expect(dateRangeStatusToEmoji('expired')).toBe('⚠️ ');
  });
});
