import { describe, it, expect } from 'vitest';
import { parseHabitLine, parseCheckInRecordLine } from '@/parser/habitParser';
import type { Habit, CheckInRecord } from '@/types/models';

describe('parseHabitLine', () => {
  it('二元型：早起 🎯2026-04-01 坚持30天 🔄每天', () => {
    const result = parseHabitLine('早起 🎯2026-04-01 坚持30天 🔄每天');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('binary');
    expect(result!.name).toBe('早起');
    expect(result!.startDate).toBe('2026-04-01');
    expect(result!.durationDays).toBe(30);
    expect(result!.endDate).toBe('2026-04-30');
    expect(result!.frequency?.type).toBe('daily');
  });

  it('二元型无坚持天数：冥想 🎯2026-04-01 🔄每天', () => {
    const result = parseHabitLine('冥想 🎯2026-04-01 🔄每天');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('binary');
    expect(result!.durationDays).toBeUndefined();
    expect(result!.endDate).toBeUndefined();
  });

  it('计数型：喝水 🎯2026-04-01 坚持21天 8杯 🔄每天', () => {
    const result = parseHabitLine('喝水 🎯2026-04-01 坚持21天 8杯 🔄每天');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('count');
    expect(result!.target).toBe(8);
    expect(result!.unit).toBe('杯');
    expect(result!.durationDays).toBe(21);
  });

  it('计数型无坚持天数：跑步 🎯2026-04-01 5公里 🔄每2天', () => {
    const result = parseHabitLine('跑步 🎯2026-04-01 5公里 🔄每2天');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('count');
    expect(result!.target).toBe(5);
    expect(result!.unit).toBe('公里');
    expect(result!.frequency?.type).toBe('every_n_days');
    expect(result!.frequency?.interval).toBe(2);
  });

  it('每周指定周几：周报 🎯2026-04-01 🔄每周五', () => {
    const result = parseHabitLine('周报 🎯2026-04-01 🔄每周五');
    expect(result).not.toBeNull();
    expect(result!.frequency?.type).toBe('weekly_days');
    expect(result!.frequency?.daysOfWeek).toEqual([5]);
  });

  it('带提醒：早起 🎯2026-04-01 坚持30天 ⏰07:00 🔄每天', () => {
    const result = parseHabitLine('早起 🎯2026-04-01 坚持30天 ⏰07:00 🔄每天');
    expect(result).not.toBeNull();
    expect(result!.reminder).toBeDefined();
    expect(result!.reminder!.type).toBe('absolute');
    expect(result!.reminder!.time).toBe('07:00');
  });

  it('无频率不识别为习惯：早起 🎯2026-04-01', () => {
    const result = parseHabitLine('早起 🎯2026-04-01');
    expect(result).toBeNull();
  });

  it('无🎯不识别为习惯：早起 📅2026-04-01 🔄每天', () => {
    const result = parseHabitLine('早起 📅2026-04-01 🔄每天');
    expect(result).toBeNull();
  });

  it('每周N天：阅读 🎯2026-04-01 30分钟 🔄每周3天', () => {
    const result = parseHabitLine('阅读 🎯2026-04-01 30分钟 🔄每周3天');
    expect(result).not.toBeNull();
    expect(result!.frequency?.type).toBe('n_per_week');
    expect(result!.frequency?.daysPerWeek).toBe(3);
  });

  it('每周多天：锻炼 🎯2026-04-01 🔄每周一三五', () => {
    const result = parseHabitLine('锻炼 🎯2026-04-01 🔄每周一三五');
    expect(result).not.toBeNull();
    expect(result!.frequency?.type).toBe('weekly_days');
    expect(result!.frequency?.daysOfWeek).toEqual([1, 3, 5]);
  });
});

describe('parseCheckInRecordLine', () => {
  it('二元型打卡：早起 📅2026-04-06 ✅', () => {
    const result = parseCheckInRecordLine('早起 📅2026-04-06 ✅', 'habit-block-1');
    expect(result).not.toBeNull();
    expect(result!.content).toBe('早起');
    expect(result!.date).toBe('2026-04-06');
    expect(result!.habitId).toBe('habit-block-1');
  });

  it('计数型打卡：喝水 3/8杯 📅2026-04-06', () => {
    const result = parseCheckInRecordLine('喝水 3/8杯 📅2026-04-06', 'habit-block-1');
    expect(result).not.toBeNull();
    expect(result!.currentValue).toBe(3);
    expect(result!.targetValue).toBe(8);
    expect(result!.unit).toBe('杯');
  });

  it('计数型达标：喝水 8/8杯 📅2026-04-06 ✅', () => {
    const result = parseCheckInRecordLine('喝水 8/8杯 📅2026-04-06 ✅', 'habit-block-1');
    expect(result).not.toBeNull();
    expect(result!.currentValue).toBe(8);
    expect(result!.targetValue).toBe(8);
  });

  it('使用@日期：早起 @2026-04-06 ✅', () => {
    const result = parseCheckInRecordLine('早起 @2026-04-06 ✅', 'habit-block-1');
    expect(result).not.toBeNull();
    expect(result!.date).toBe('2026-04-06');
  });

  it('自定义内容：今天喝了温水 3/8杯 📅2026-04-06', () => {
    const result = parseCheckInRecordLine('今天喝了温水 3/8杯 📅2026-04-06', 'habit-block-1');
    expect(result).not.toBeNull();
    expect(result!.content).toBe('今天喝了温水');
    expect(result!.currentValue).toBe(3);
  });

  it('无日期不识别为记录', () => {
    const result = parseCheckInRecordLine('喝水 3/8杯', 'habit-block-1');
    expect(result).toBeNull();
  });
});
