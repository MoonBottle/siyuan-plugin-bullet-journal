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

  it('多个日期（英文逗号）', () => {
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

  it('多个日期（中文逗号）', () => {
    const items = LineParser.parseItemLine('整理资料 @2024-01-01，2024-01-03，2024-01-05', 1);
    expect(items).toHaveLength(3);
    expect(items[0].date).toBe('2024-01-01');
    expect(items[1].date).toBe('2024-01-03');
    expect(items[2].date).toBe('2024-01-05');
  });

  it('多个日期（中英文逗号混合）', () => {
    const items = LineParser.parseItemLine('整理资料 @2024-01-01，2024-01-03, 2024-01-05', 1);
    expect(items).toHaveLength(3);
    expect(items[0].date).toBe('2024-01-01');
    expect(items[1].date).toBe('2024-01-03');
    expect(items[2].date).toBe('2024-01-05');
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
    // 简写格式保留原始表达式
    expect(items[0].siblingItems).toHaveLength(2);
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

describe('parseItemLine - 事项链接', () => {
  it('事项带单个链接', () => {
    const links = [{ name: '示例链接', url: 'https://example.com' }];
    const items = LineParser.parseItemLine('工作事项 @2024-01-01', 1, links);
    expect(items).toHaveLength(1);
    expect(items[0].content).toBe('工作事项');
    expect(items[0].links).toHaveLength(1);
    expect(items[0].links![0].name).toBe('示例链接');
    expect(items[0].links![0].url).toBe('https://example.com');
  });

  it('事项带多个链接', () => {
    const links = [
      { name: '需求文档', url: 'https://example.com/requirements' },
      { name: '设计稿', url: 'siyuan://blocks/20260220112000' }
    ];
    const items = LineParser.parseItemLine('工作事项 @2024-01-01', 1, links);
    expect(items).toHaveLength(1);
    expect(items[0].links).toHaveLength(2);
    expect(items[0].links![0].name).toBe('需求文档');
    expect(items[0].links![1].name).toBe('设计稿');
  });

  it('多日期事项带链接', () => {
    const links = [{ name: 'GitHub', url: 'https://github.com' }];
    const items = LineParser.parseItemLine('多日期事项 @2024-01-01, 2024-01-03', 1, links);
    expect(items).toHaveLength(2);
    // 所有展开的 Item 都应该有相同的链接
    expect(items[0].links).toHaveLength(1);
    expect(items[1].links).toHaveLength(1);
    expect(items[0].links![0].name).toBe('GitHub');
    expect(items[1].links![0].name).toBe('GitHub');
  });

  it('事项无链接时 links 为 undefined', () => {
    const items = LineParser.parseItemLine('工作事项 @2024-01-01', 1);
    expect(items).toHaveLength(1);
    expect(items[0].links).toBeUndefined();
  });

  it('事项传入空链接数组时 links 为 undefined', () => {
    const items = LineParser.parseItemLine('工作事项 @2024-01-01', 1, []);
    expect(items).toHaveLength(1);
    expect(items[0].links).toBeUndefined();
  });
});

describe('parseItemLine - 中文逗号内容提取', () => {
  it('中文逗号分隔的多日期：内容不包含日期', () => {
    const items = LineParser.parseItemLine('多日期中文A @2024-01-01，2024-01-03，2024-01-05', 1);
    expect(items).toHaveLength(3);
    // 所有 Item 的内容应该相同，且不包含日期
    expect(items[0].content).toBe('多日期中文A');
    expect(items[1].content).toBe('多日期中文A');
    expect(items[2].content).toBe('多日期中文A');
  });

  it('中英文逗号混合：内容不包含日期', () => {
    const items = LineParser.parseItemLine('多日期混合 @2024-01-01，2024-01-03, 2024-01-05', 1);
    expect(items).toHaveLength(3);
    expect(items[0].content).toBe('多日期混合');
    expect(items[1].content).toBe('多日期混合');
    expect(items[2].content).toBe('多日期混合');
  });

  it('中文逗号带时间：内容不包含日期和时间', () => {
    const items = LineParser.parseItemLine('多日期中文B @2024-01-01 09:00:00~10:00:00，2024-01-03 14:00:00~15:00:00', 1);
    expect(items).toHaveLength(2);
    expect(items[0].content).toBe('多日期中文B');
    expect(items[1].content).toBe('多日期中文B');
  });

  it('中文逗号带状态标签：内容不包含日期和标签', () => {
    const items = LineParser.parseItemLine('状态完成A @2024-01-01，2024-01-03 #已完成', 1);
    expect(items).toHaveLength(2);
    expect(items[0].content).toBe('状态完成A');
    expect(items[0].status).toBe('completed');
    expect(items[1].content).toBe('状态完成A');
    expect(items[1].status).toBe('completed');
  });
});

describe('parsePomodoroLine 番茄钟解析', () => {
  it('完整格式：日期+时间范围+描述', () => {
    const pomodoro = LineParser.parsePomodoroLine('🍅2026-03-08 15:45:32~15:45:36 哈哈哈', 'block-1');
    expect(pomodoro).not.toBeNull();
    expect(pomodoro!.date).toBe('2026-03-08');
    expect(pomodoro!.startTime).toBe('15:45:32');
    expect(pomodoro!.endTime).toBe('15:45:36');
    expect(pomodoro!.description).toBe('哈哈哈');
    expect(pomodoro!.durationMinutes).toBe(1); // 4秒不足1分钟，最小为1分钟
    expect(pomodoro!.blockId).toBe('block-1');
  });

  it('无描述格式', () => {
    const pomodoro = LineParser.parsePomodoroLine('🍅2026-03-08 15:45:32~15:45:36', 'block-2');
    expect(pomodoro).not.toBeNull();
    expect(pomodoro!.date).toBe('2026-03-08');
    expect(pomodoro!.startTime).toBe('15:45:32');
    expect(pomodoro!.endTime).toBe('15:45:36');
    expect(pomodoro!.description).toBeUndefined();
    expect(pomodoro!.durationMinutes).toBe(1); // 4秒不足1分钟，最小为1分钟
  });

  it('无结束时间格式（默认25分钟）', () => {
    const pomodoro = LineParser.parsePomodoroLine('🍅2026-03-08 15:45:32', 'block-3');
    expect(pomodoro).not.toBeNull();
    expect(pomodoro!.date).toBe('2026-03-08');
    expect(pomodoro!.startTime).toBe('15:45:32');
    expect(pomodoro!.endTime).toBeUndefined();
    expect(pomodoro!.durationMinutes).toBe(25);
  });

  it('无序列表格式', () => {
    const pomodoro = LineParser.parsePomodoroLine('- 🍅2026-03-08 15:45:32~15:45:36 哈哈哈', 'block-4');
    expect(pomodoro).not.toBeNull();
    expect(pomodoro!.date).toBe('2026-03-08');
    expect(pomodoro!.startTime).toBe('15:45:32');
    expect(pomodoro!.description).toBe('哈哈哈');
  });

  it('有序列表格式', () => {
    const pomodoro = LineParser.parsePomodoroLine('1. 🍅2026-03-08 15:45:32~15:45:36 哈哈哈', 'block-5');
    expect(pomodoro).not.toBeNull();
    expect(pomodoro!.date).toBe('2026-03-08');
    expect(pomodoro!.startTime).toBe('15:45:32');
    expect(pomodoro!.description).toBe('哈哈哈');
  });

  it('跨天时间计算', () => {
    const pomodoro = LineParser.parsePomodoroLine('🍅2026-03-08 23:30:00~00:30:00 跨天', 'block-6');
    expect(pomodoro).not.toBeNull();
    expect(pomodoro!.durationMinutes).toBe(60);
  });

  it('非番茄钟行返回 null', () => {
    const pomodoro = LineParser.parsePomodoroLine('普通文本内容', 'block-7');
    expect(pomodoro).toBeNull();
  });

  it('格式不正确的番茄钟返回 null', () => {
    const pomodoro = LineParser.parsePomodoroLine('🍅2026-03-08', 'block-8');
    expect(pomodoro).toBeNull();
  });

  it('Kramdown 转义格式：\~ 波浪号', () => {
    const pomodoro = LineParser.parsePomodoroLine('- 🍅2026-03-08 15:45:32\\~15:45:36 哈哈哈', 'block-9');
    expect(pomodoro).not.toBeNull();
    expect(pomodoro!.date).toBe('2026-03-08');
    expect(pomodoro!.startTime).toBe('15:45:32');
    expect(pomodoro!.endTime).toBe('15:45:36');
    expect(pomodoro!.description).toBe('哈哈哈');
  });
});

describe('parseBlockAttrs 块属性解析', () => {
  it('解析 custom-pomodoro-status 属性', () => {
    const attrs = LineParser.parseBlockAttrs('{: custom-pomodoro-status="running"}');
    expect(attrs['custom-pomodoro-status']).toBe('running');
  });

  it('解析多个属性', () => {
    const attrs = LineParser.parseBlockAttrs('{: custom-pomodoro-status="running" custom-pomodoro-start="1741427132000" custom-pomodoro-duration="25"}');
    expect(attrs['custom-pomodoro-status']).toBe('running');
    expect(attrs['custom-pomodoro-start']).toBe('1741427132000');
    expect(attrs['custom-pomodoro-duration']).toBe('25');
  });

  it('无属性返回空对象', () => {
    const attrs = LineParser.parseBlockAttrs('普通文本内容');
    expect(Object.keys(attrs)).toHaveLength(0);
  });
});

describe('parsePomodoroLine 带块属性解析', () => {
  it('解析带 running 状态的番茄钟', () => {
    const attrs = { 'custom-pomodoro-status': 'running', 'custom-pomodoro-item-content': '测试事项' };
    const pomodoro = LineParser.parsePomodoroLine('🍅2026-03-08 15:45:32', 'block-1', attrs);
    expect(pomodoro).not.toBeNull();
    expect(pomodoro!.status).toBe('running');
    expect(pomodoro!.itemContent).toBe('测试事项');
  });

  it('解析带 completed 状态的番茄钟', () => {
    const attrs = { 'custom-pomodoro-status': 'completed' };
    const pomodoro = LineParser.parsePomodoroLine('🍅2026-03-08 15:45:32~15:45:36', 'block-1', attrs);
    expect(pomodoro).not.toBeNull();
    expect(pomodoro!.status).toBe('completed');
  });

  it('无属性时 status 为 undefined', () => {
    const pomodoro = LineParser.parsePomodoroLine('🍅2026-03-08 15:45:32~15:45:36', 'block-1');
    expect(pomodoro).not.toBeNull();
    expect(pomodoro!.status).toBeUndefined();
    expect(pomodoro!.itemContent).toBeUndefined();
  });
});

describe('parsePomodoroLine 实际时长解析', () => {
  it('英文逗号格式：带实际时长', () => {
    const pomodoro = LineParser.parsePomodoroLine('🍅5,2026-03-08 15:45:32~15:50:32 完成代码审查', 'block-1');
    expect(pomodoro).not.toBeNull();
    expect(pomodoro!.actualDurationMinutes).toBe(5);
    expect(pomodoro!.date).toBe('2026-03-08');
    expect(pomodoro!.startTime).toBe('15:45:32');
    expect(pomodoro!.endTime).toBe('15:50:32');
    expect(pomodoro!.description).toBe('完成代码审查');
    // durationMinutes 仍然按时间计算，但统计时会优先使用 actualDurationMinutes
    expect(pomodoro!.durationMinutes).toBe(5);
  });

  it('中文逗号格式：带实际时长', () => {
    const pomodoro = LineParser.parsePomodoroLine('🍅5，2026-03-08 15:45:32~15:50:32 完成代码审查', 'block-1');
    expect(pomodoro).not.toBeNull();
    expect(pomodoro!.actualDurationMinutes).toBe(5);
    expect(pomodoro!.date).toBe('2026-03-08');
    expect(pomodoro!.startTime).toBe('15:45:32');
    expect(pomodoro!.endTime).toBe('15:50:32');
  });

  it('逗号后1个空格：带实际时长', () => {
    const pomodoro = LineParser.parsePomodoroLine('🍅5, 2026-03-08 15:45:32~15:50:32 完成代码审查', 'block-1');
    expect(pomodoro).not.toBeNull();
    expect(pomodoro!.actualDurationMinutes).toBe(5);
    expect(pomodoro!.date).toBe('2026-03-08');
    expect(pomodoro!.startTime).toBe('15:45:32');
    expect(pomodoro!.endTime).toBe('15:50:32');
  });

  it('逗号后多个空格：带实际时长', () => {
    const pomodoro = LineParser.parsePomodoroLine('🍅5,   2026-03-08 15:45:32~15:50:32 完成代码审查', 'block-1');
    expect(pomodoro).not.toBeNull();
    expect(pomodoro!.actualDurationMinutes).toBe(5);
    expect(pomodoro!.date).toBe('2026-03-08');
    expect(pomodoro!.startTime).toBe('15:45:32');
    expect(pomodoro!.endTime).toBe('15:50:32');
  });

  it('无结束时间但有实际时长', () => {
    const pomodoro = LineParser.parsePomodoroLine('🍅5,2026-03-08 15:45:32 完成代码审查', 'block-1');
    expect(pomodoro).not.toBeNull();
    expect(pomodoro!.actualDurationMinutes).toBe(5);
    expect(pomodoro!.date).toBe('2026-03-08');
    expect(pomodoro!.startTime).toBe('15:45:32');
    expect(pomodoro!.endTime).toBeUndefined();
    // 无结束时间时 durationMinutes 默认为25
    expect(pomodoro!.durationMinutes).toBe(25);
  });

  it('无结束时间无实际时长（向后兼容）', () => {
    const pomodoro = LineParser.parsePomodoroLine('🍅2026-03-08 15:45:32 完成代码审查', 'block-1');
    expect(pomodoro).not.toBeNull();
    expect(pomodoro!.actualDurationMinutes).toBeUndefined();
    expect(pomodoro!.date).toBe('2026-03-08');
    expect(pomodoro!.startTime).toBe('15:45:32');
    expect(pomodoro!.endTime).toBeUndefined();
    expect(pomodoro!.durationMinutes).toBe(25);
  });

  it('带实际时长的无序列表格式', () => {
    const pomodoro = LineParser.parsePomodoroLine('- 🍅5,2026-03-08 15:45:32~15:50:32 完成代码审查', 'block-1');
    expect(pomodoro).not.toBeNull();
    expect(pomodoro!.actualDurationMinutes).toBe(5);
    expect(pomodoro!.date).toBe('2026-03-08');
  });

  it('带实际时长的有序列表格式', () => {
    const pomodoro = LineParser.parsePomodoroLine('1. 🍅5,2026-03-08 15:45:32~15:50:32 完成代码审查', 'block-1');
    expect(pomodoro).not.toBeNull();
    expect(pomodoro!.actualDurationMinutes).toBe(5);
    expect(pomodoro!.date).toBe('2026-03-08');
  });

  it('实际时长与时间计算不一致时，actualDurationMinutes 优先', () => {
    // 时间范围是 30 分钟，但实际时长标记为 5 分钟（暂停过）
    const pomodoro = LineParser.parsePomodoroLine('🍅5,2026-03-08 15:00:00~15:30:00 有暂停', 'block-1');
    expect(pomodoro).not.toBeNull();
    expect(pomodoro!.actualDurationMinutes).toBe(5);
    expect(pomodoro!.durationMinutes).toBe(30); // 按时间计算是30分钟
  });
});
