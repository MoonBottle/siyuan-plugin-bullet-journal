/**
 * 提醒标记解析器测试（人类可读格式）
 */
import { describe, it, expect } from 'vitest';
import {
  parseReminderFromLine,
  calculateReminderTime,
  stripReminderMarker,
  generateReminderMarker
} from '@/parser/reminderParser';
import type { ReminderConfig } from '@/types/models';

describe('reminderParser', () => {
  describe('parseReminderFromLine', () => {
    it('应该解析绝对时间 ⏰HH:mm', () => {
      const result = parseReminderFromLine('会议 @2026-03-17 ⏰09:00');
      expect(result).toBeDefined();
      expect(result?.enabled).toBe(true);
      expect(result?.type).toBe('absolute');
      expect(result?.time).toBe('09:00');
    });

    it('应该解析绝对时间 ⏰HH:mm:ss', () => {
      const result = parseReminderFromLine('会议 @2026-03-17 ⏰09:00:00');
      expect(result).toBeDefined();
      expect(result?.type).toBe('absolute');
      expect(result?.time).toBe('09:00');
    });

    it('应该解析中文相对开始时间 ⏰提前X分钟', () => {
      const result = parseReminderFromLine('会议 @2026-03-17 14:00~16:00 ⏰提前10分钟');
      expect(result).toBeDefined();
      expect(result?.type).toBe('relative');
      expect(result?.relativeTo).toBe('start');
      expect(result?.offsetMinutes).toBe(10);
    });

    it('应该解析中文相对开始时间 ⏰提前X小时', () => {
      const result = parseReminderFromLine('会议 @2026-03-17 ⏰提前1小时');
      expect(result).toBeDefined();
      expect(result?.type).toBe('relative');
      expect(result?.relativeTo).toBe('start');
      expect(result?.offsetMinutes).toBe(60);
    });

    it('应该解析中文相对结束时间 ⏰结束前X分钟', () => {
      const result = parseReminderFromLine('会议 @2026-03-17 14:00~16:00 ⏰结束前10分钟');
      expect(result).toBeDefined();
      expect(result?.type).toBe('relative');
      expect(result?.relativeTo).toBe('end');
      expect(result?.offsetMinutes).toBe(10);
    });

    it('应该解析英文相对开始时间 ⏰X minutes before', () => {
      const result = parseReminderFromLine('Meeting @2026-03-17 ⏰10 minutes before');
      expect(result).toBeDefined();
      expect(result?.type).toBe('relative');
      expect(result?.relativeTo).toBe('start');
      expect(result?.offsetMinutes).toBe(10);
    });

    it('应该解析英文相对开始时间 ⏰X hours before（简写）', () => {
      const result = parseReminderFromLine('Meeting @2026-03-17 ⏰1h before');
      expect(result).toBeDefined();
      expect(result?.type).toBe('relative');
      expect(result?.relativeTo).toBe('start');
      expect(result?.offsetMinutes).toBe(60);
    });

    it('应该解析英文相对结束时间 ⏰X minutes before end', () => {
      const result = parseReminderFromLine('Meeting @2026-03-17 ⏰30 minutes before end');
      expect(result).toBeDefined();
      expect(result?.type).toBe('relative');
      expect(result?.relativeTo).toBe('end');
      expect(result?.offsetMinutes).toBe(30);
    });

    it('应该解析中文相对时间 ⏰提前X天', () => {
      const result = parseReminderFromLine('会议 @2026-03-17 ⏰提前1天');
      expect(result).toBeDefined();
      expect(result?.type).toBe('relative');
      expect(result?.relativeTo).toBe('start');
      expect(result?.offsetMinutes).toBe(24 * 60);
    });

    it('无提醒标记时应返回 undefined', () => {
      const result = parseReminderFromLine('会议 @2026-03-17');
      expect(result).toBeUndefined();
    });

    it('应该优先匹配相对结束时间', () => {
      // 如果同时有 提前 和 结束前，应该优先匹配 结束前
      const result = parseReminderFromLine('会议 @2026-03-17 ⏰结束前10分钟 ⏰提前5分钟');
      expect(result).toBeDefined();
      expect(result?.relativeTo).toBe('end');
    });
  });

  describe('calculateReminderTime', () => {
    it('应该计算绝对时间', () => {
      const config: ReminderConfig = {
        enabled: true,
        type: 'absolute',
        time: '09:00'
      };
      const time = calculateReminderTime('2026-03-17', undefined, undefined, config);
      const expected = new Date('2026-03-17T09:00:00').getTime();
      expect(time).toBe(expected);
    });

    it('应该计算相对开始时间（有 startTime）', () => {
      const config: ReminderConfig = {
        enabled: true,
        type: 'relative',
        relativeTo: 'start',
        offsetMinutes: 10
      };
      const time = calculateReminderTime('2026-03-17', '14:00:00', '16:00:00', config);
      // 14:00 - 10m = 13:50
      const expected = new Date('2026-03-17T13:50:00').getTime();
      expect(time).toBe(expected);
    });

    it('应该计算相对开始时间（无 startTime，基于 00:00）', () => {
      const config: ReminderConfig = {
        enabled: true,
        type: 'relative',
        relativeTo: 'start',
        offsetMinutes: 10
      };
      const time = calculateReminderTime('2026-03-17', undefined, undefined, config);
      // 00:00 - 10m = 前一天 23:50
      const expected = new Date('2026-03-16T23:50:00').getTime();
      expect(time).toBe(expected);
    });

    it('应该计算相对结束时间（有 endTime）', () => {
      const config: ReminderConfig = {
        enabled: true,
        type: 'relative',
        relativeTo: 'end',
        offsetMinutes: 10
      };
      const time = calculateReminderTime('2026-03-17', '14:00:00', '16:00:00', config);
      // 16:00 - 10m = 15:50
      const expected = new Date('2026-03-17T15:50:00').getTime();
      expect(time).toBe(expected);
    });

    it('应该计算相对结束时间（无 endTime，基于 23:59:59）', () => {
      const config: ReminderConfig = {
        enabled: true,
        type: 'relative',
        relativeTo: 'end',
        offsetMinutes: 10
      };
      const time = calculateReminderTime('2026-03-17', undefined, undefined, config);
      // 23:59:00 - 10m = 23:49:00
      const expected = new Date('2026-03-17T23:49:00').getTime();
      expect(time).toBe(expected);
    });
  });

  describe('stripReminderMarker', () => {
    it('应该移除绝对时间标记', () => {
      const result = stripReminderMarker('会议 @2026-03-17 ⏰09:00');
      expect(result).toBe('会议 @2026-03-17');
    });

    it('应该移除中文相对开始时间标记', () => {
      const result = stripReminderMarker('会议 @2026-03-17 ⏰提前10分钟');
      expect(result).toBe('会议 @2026-03-17');
    });

    it('应该移除中文相对结束时间标记', () => {
      const result = stripReminderMarker('会议 @2026-03-17 ⏰结束前30分钟');
      expect(result).toBe('会议 @2026-03-17');
    });

    it('应该移除英文相对时间标记', () => {
      const result = stripReminderMarker('Meeting @2026-03-17 ⏰10 minutes before');
      expect(result).toBe('Meeting @2026-03-17');
    });

    it('应该移除英文相对结束时间标记', () => {
      const result = stripReminderMarker('Meeting @2026-03-17 ⏰30 minutes before end');
      expect(result).toBe('Meeting @2026-03-17');
    });

    it('应该保留其他内容', () => {
      const result = stripReminderMarker('会议内容 #标签 @2026-03-17 ⏰09:00 其他内容');
      expect(result.trim().replace(/\s+/g, ' ')).toBe('会议内容 #标签 @2026-03-17 其他内容');
    });
  });

  describe('generateReminderMarker', () => {
    it('应该生成绝对时间标记', () => {
      const config: ReminderConfig = {
        enabled: true,
        type: 'absolute',
        time: '09:00'
      };
      const result = generateReminderMarker(config);
      expect(result).toBe('⏰09:00');
    });

    it('应该生成中文相对开始时间标记（分钟）', () => {
      const config: ReminderConfig = {
        enabled: true,
        type: 'relative',
        relativeTo: 'start',
        offsetMinutes: 10
      };
      const result = generateReminderMarker(config);
      expect(result).toBe('⏰提前10分钟');
    });

    it('应该生成中文相对开始时间标记（小时）', () => {
      const config: ReminderConfig = {
        enabled: true,
        type: 'relative',
        relativeTo: 'start',
        offsetMinutes: 60
      };
      const result = generateReminderMarker(config);
      expect(result).toBe('⏰提前1小时');
    });

    it('应该生成中文相对结束时间标记', () => {
      const config: ReminderConfig = {
        enabled: true,
        type: 'relative',
        relativeTo: 'end',
        offsetMinutes: 30
      };
      const result = generateReminderMarker(config);
      expect(result).toBe('⏰结束前30分钟');
    });

    it('应该生成中文相对开始时间标记（天）', () => {
      const config: ReminderConfig = {
        enabled: true,
        type: 'relative',
        relativeTo: 'start',
        offsetMinutes: 24 * 60
      };
      const result = generateReminderMarker(config);
      expect(result).toBe('⏰提前1天');
    });

    it('禁用时应该返回空字符串', () => {
      const config: ReminderConfig = {
        enabled: false,
        type: 'absolute'
      };
      const result = generateReminderMarker(config);
      expect(result).toBe('');
    });
  });
});
