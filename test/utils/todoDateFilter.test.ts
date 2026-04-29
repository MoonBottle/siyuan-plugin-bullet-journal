import { describe, expect, it } from 'vitest';
import {
  buildCompletedTodoDateRange,
  buildTodoDateRange,
  type TodoDateFilterType,
} from '@/utils/todoDateFilter';

describe('buildTodoDateRange', () => {
  it('today 使用 currentDate 作为结束日期', () => {
    expect(buildTodoDateRange('today', '2026-04-07', '2026-04-01', '2026-04-30')).toEqual({
      start: '1970-01-01',
      end: '2026-04-07',
    });
  });

  it('week 使用 currentDate 起算 7 天窗口', () => {
    expect(buildTodoDateRange('week', '2026-04-07', '2026-04-01', '2026-04-30')).toEqual({
      start: '1970-01-01',
      end: '2026-04-13',
    });
  });

  it('all 返回 null', () => {
    expect(buildTodoDateRange('all', '2026-04-07', '2026-04-01', '2026-04-30')).toBeNull();
  });

  it('custom 透传用户选择范围', () => {
    expect(buildTodoDateRange('custom', '2026-04-07', '2026-04-02', '2026-04-05')).toEqual({
      start: '2026-04-02',
      end: '2026-04-05',
    });
  });
});

describe('buildCompletedTodoDateRange', () => {
  it('today 仅返回当天', () => {
    expect(buildCompletedTodoDateRange('today', '2026-04-07', null)).toEqual({
      start: '2026-04-07',
      end: '2026-04-07',
    });
  });

  it('week 使用 currentDate 到未来 6 天', () => {
    expect(buildCompletedTodoDateRange('week', '2026-04-07', null)).toEqual({
      start: '2026-04-07',
      end: '2026-04-13',
    });
  });

  it('all 返回 null', () => {
    expect(buildCompletedTodoDateRange('all', '2026-04-07', null)).toBeNull();
  });

  it('custom 透传现有 dateRange', () => {
    const range = { start: '2026-04-02', end: '2026-04-05' };
    expect(buildCompletedTodoDateRange('custom', '2026-04-07', range)).toEqual(range);
  });
});

it('类型仅支持预设四种过滤模式', () => {
  const type: TodoDateFilterType = 'today';
  expect(type).toBe('today');
});
