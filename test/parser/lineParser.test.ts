/**
 * lineParser 单元测试
 * - parseItemLine：多日期事项解析
 */
import { describe, it, expect } from 'vitest';
import { LineParser } from '@/parser/lineParser';

describe('parseItemLine 多日期解析', () => {
  it('单个日期', () => {
    const items = LineParser.parseItemLine('整理资料 @2024-01-01', 1);
    expect(items).toHaveLength(1);
    expect(items[0].date).toBe('2024-01-01');
    expect(items[0].content).toBe('整理资料');
    expect(items[0].startDateTime).toBeUndefined();
    expect(items[0].endDateTime).toBeUndefined();
    expect(items[0].siblingItems).toBeUndefined();
  });

  it('单个日期+时间', () => {
    const items = LineParser.parseItemLine('整理资料 @2024-01-01 09:00:00', 1);
    expect(items).toHaveLength(1);
    expect(items[0].date).toBe('2024-01-01');
    expect(items[0].startDateTime).toBe('2024-01-01 09:00:00');
    expect(items[0].endDateTime).toBeUndefined();
    expect(items[0].siblingItems).toBeUndefined();
  });

  it('单个日期+时间范围', () => {
    const items = LineParser.parseItemLine('整理资料 @2024-01-01 09:00:00~10:00:00', 1);
    expect(items).toHaveLength(1);
    expect(items[0].date).toBe('2024-01-01');
    expect(items[0].startDateTime).toBe('2024-01-01 09:00:00');
    expect(items[0].endDateTime).toBe('2024-01-01 10:00:00');
    expect(items[0].siblingItems).toBeUndefined();
  });

  it('多个日期', () => {
    const items = LineParser.parseItemLine('整理资料 @2024-01-01, 2024-01-03, 2024-01-05', 1);
    expect(items).toHaveLength(3);
    expect(items[0].date).toBe('2024-01-01');
    expect(items[1].date).toBe('2024-01-03');
    expect(items[2].date).toBe('2024-01-05');
    expect(items[0].content).toBe('整理资料');
    expect(items[1].content).toBe('整理资料');
    expect(items[2].content).toBe('整理资料');
    // 检查 siblingItems
    expect(items[0].siblingItems).toHaveLength(2);
    expect(items[0].siblingItems?.[0].date).toBe('2024-01-03');
    expect(items[0].siblingItems?.[1].date).toBe('2024-01-05');
  });

  it('日期范围（完整格式）', () => {
    const items = LineParser.parseItemLine('整理资料 @2024-01-01~2024-01-03', 1);
    expect(items).toHaveLength(3);
    expect(items[0].date).toBe('2024-01-01');
    expect(items[1].date).toBe('2024-01-02');
    expect(items[2].date).toBe('2024-01-03');
    // 检查 siblingItems
    expect(items[0].siblingItems).toHaveLength(2);
    expect(items[0].siblingItems?.[0].date).toBe('2024-01-02');
    expect(items[0].siblingItems?.[1].date).toBe('2024-01-03');
  });

  it('日期范围（简写格式）', () => {
    const items = LineParser.parseItemLine('整理资料 @2024-01-01~01-03', 1);
    expect(items).toHaveLength(3);
    expect(items[0].date).toBe('2024-01-01');
    expect(items[1].date).toBe('2024-01-02');
    expect(items[2].date).toBe('2024-01-03');
  });

  it('多日期+时间（每个日期不同时间）', () => {
    const items = LineParser.parseItemLine(
      '整理资料 @2024-01-01 09:00:00~10:00:00, 2024-01-03 14:00:00~15:00:00',
      1
    );
    expect(items).toHaveLength(2);
    expect(items[0].date).toBe('2024-01-01');
    expect(items[0].startDateTime).toBe('2024-01-01 09:00:00');
    expect(items[0].endDateTime).toBe('2024-01-01 10:00:00');
    expect(items[1].date).toBe('2024-01-03');
    expect(items[1].startDateTime).toBe('2024-01-03 14:00:00');
    expect(items[1].endDateTime).toBe('2024-01-03 15:00:00');
    // 检查 siblingItems 包含时间信息
    expect(items[0].siblingItems?.[0].date).toBe('2024-01-03');
    expect(items[0].siblingItems?.[0].startDateTime).toBe('2024-01-03 14:00:00');
    expect(items[0].siblingItems?.[0].endDateTime).toBe('2024-01-03 15:00:00');
  });

  it('日期范围+时间（每天同一时间）', () => {
    const items = LineParser.parseItemLine(
      '整理资料 @2024-01-01~2024-01-03 09:00:00~10:00:00',
      1
    );
    expect(items).toHaveLength(3);
    expect(items[0].date).toBe('2024-01-01');
    expect(items[0].startDateTime).toBe('2024-01-01 09:00:00');
    expect(items[0].endDateTime).toBe('2024-01-01 10:00:00');
    expect(items[1].date).toBe('2024-01-02');
    expect(items[1].startDateTime).toBe('2024-01-02 09:00:00');
    expect(items[1].endDateTime).toBe('2024-01-02 10:00:00');
    expect(items[2].date).toBe('2024-01-03');
    expect(items[2].startDateTime).toBe('2024-01-03 09:00:00');
    expect(items[2].endDateTime).toBe('2024-01-03 10:00:00');
  });

  it('混合模式（用户示例）', () => {
    const items = LineParser.parseItemLine(
      '整理某些资料 @2026-03-06 09:00:00~09:30:00, 2026-03-10~03-12 14:00:00~15:00:00, 2026-03-15 10:00:00~11:00:00',
      1
    );
    expect(items).toHaveLength(5);
    // 第一个日期
    expect(items[0].date).toBe('2026-03-06');
    expect(items[0].startDateTime).toBe('2026-03-06 09:00:00');
    expect(items[0].endDateTime).toBe('2026-03-06 09:30:00');
    // 日期范围（3天）
    expect(items[1].date).toBe('2026-03-10');
    expect(items[1].startDateTime).toBe('2026-03-10 14:00:00');
    expect(items[1].endDateTime).toBe('2026-03-10 15:00:00');
    expect(items[2].date).toBe('2026-03-11');
    expect(items[2].startDateTime).toBe('2026-03-11 14:00:00');
    expect(items[2].endDateTime).toBe('2026-03-11 15:00:00');
    expect(items[3].date).toBe('2026-03-12');
    expect(items[3].startDateTime).toBe('2026-03-12 14:00:00');
    expect(items[3].endDateTime).toBe('2026-03-12 15:00:00');
    // 最后一个日期
    expect(items[4].date).toBe('2026-03-15');
    expect(items[4].startDateTime).toBe('2026-03-15 10:00:00');
    expect(items[4].endDateTime).toBe('2026-03-15 11:00:00');
  });

  it('带状态标签', () => {
    const items = LineParser.parseItemLine('整理资料 @2024-01-01 #done', 1);
    expect(items).toHaveLength(1);
    expect(items[0].date).toBe('2024-01-01');
    expect(items[0].content).toBe('整理资料');
    expect(items[0].status).toBe('completed');
  });

  it('多日期带状态标签', () => {
    const items = LineParser.parseItemLine('整理资料 @2024-01-01, 2024-01-03 #已完成', 1);
    expect(items).toHaveLength(2);
    expect(items[0].status).toBe('completed');
    expect(items[1].status).toBe('completed');
  });

  it('无日期返回空数组', () => {
    const items = LineParser.parseItemLine('整理资料', 1);
    expect(items).toHaveLength(0);
  });

  it('只有内容无日期返回空数组', () => {
    const items = LineParser.parseItemLine('整理资料 #done', 1);
    expect(items).toHaveLength(0);
  });
});

describe('parseTaskLine 任务解析', () => {
  it('基础任务', () => {
    const task = LineParser.parseTaskLine('测试任务 #任务', 1);
    expect(task.name).toBe('测试任务');
    expect(task.level).toBe('L1');
    expect(task.items).toHaveLength(0);
  });

  it('带级别', () => {
    const task = LineParser.parseTaskLine('测试任务 #任务 @L2', 1);
    expect(task.name).toBe('测试任务');
    expect(task.level).toBe('L2');
  });

  it('带日期', () => {
    const task = LineParser.parseTaskLine('测试任务 #任务 @2024-01-01', 1);
    expect(task.name).toBe('测试任务');
    expect(task.date).toBe('2024-01-01');
  });

  it('带时间范围', () => {
    const task = LineParser.parseTaskLine('测试任务 #任务 @2024-01-01 09:00:00~10:00:00', 1);
    expect(task.name).toBe('测试任务');
    expect(task.date).toBe('2024-01-01');
    expect(task.startDateTime).toBe('2024-01-01 09:00:00');
    expect(task.endDateTime).toBe('2024-01-01 10:00:00');
  });
});
