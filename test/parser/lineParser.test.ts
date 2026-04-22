/**
 * lineParser 单元测试
 * - parseItemLine：多日期事项解析
 * - parseBlockRefs：思源块引用解析
 */
import { describe, it, expect } from 'vitest';
import { LineParser, parseBlockRefs } from '@/parser/lineParser';

describe('parseItemLine 多日期解析', () => {
  it('单个日期', () => {
    const items = LineParser.parseItemLine('整理资料 @2024-01-01', 1);
    expect(items).toHaveLength(1);
    expect(items[0].date).toBe('2024-01-01');
    expect(items[0].content).toBe('整理资料');
    expect(items[0].startDateTime).toBeUndefined();
    expect(items[0].endDateTime).toBeUndefined();
    expect(items[0].siblingItems).toBeUndefined();
    expect(items[0].dateRangeStart).toBeUndefined();
    expect(items[0].dateRangeEnd).toBeUndefined();
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
    // 检查 dateRangeStart/End（离散日期）
    expect(items[0].dateRangeStart).toBe('2024-01-01');
    expect(items[0].dateRangeEnd).toBe('2024-01-05');
    expect(items[1].dateRangeStart).toBe('2024-01-01');
    expect(items[1].dateRangeEnd).toBe('2024-01-05');
    expect(items[2].dateRangeStart).toBe('2024-01-01');
    expect(items[2].dateRangeEnd).toBe('2024-01-05');
  });

  it('多个日期（中文逗号）', () => {
    const items = LineParser.parseItemLine('整理资料 @2024-01-01，2024-01-03，2024-01-05', 1);
    expect(items).toHaveLength(3);
    expect(items[0].date).toBe('2024-01-01');
    expect(items[1].date).toBe('2024-01-03');
    expect(items[2].date).toBe('2024-01-05');
    expect(items[0].dateRangeStart).toBe('2024-01-01');
    expect(items[0].dateRangeEnd).toBe('2024-01-05');
  });

  it('多个日期（中英文逗号混合）', () => {
    const items = LineParser.parseItemLine('整理资料 @2024-01-01，2024-01-03, 2024-01-05', 1);
    expect(items).toHaveLength(3);
    expect(items[0].date).toBe('2024-01-01');
    expect(items[1].date).toBe('2024-01-03');
    expect(items[2].date).toBe('2024-01-05');
    expect(items[0].dateRangeStart).toBe('2024-01-01');
    expect(items[0].dateRangeEnd).toBe('2024-01-05');
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
    // 检查 dateRangeStart/End
    expect(items[0].dateRangeStart).toBe('2024-01-01');
    expect(items[0].dateRangeEnd).toBe('2024-01-03');
    expect(items[1].dateRangeStart).toBe('2024-01-01');
    expect(items[1].dateRangeEnd).toBe('2024-01-03');
    expect(items[2].dateRangeStart).toBe('2024-01-01');
    expect(items[2].dateRangeEnd).toBe('2024-01-03');
  });

  it('日期范围（简写格式）', () => {
    const items = LineParser.parseItemLine('整理资料 @2024-01-01~01-03', 1);
    expect(items).toHaveLength(3);
    expect(items[0].date).toBe('2024-01-01');
    expect(items[1].date).toBe('2024-01-02');
    expect(items[2].date).toBe('2024-01-03');
    expect(items[0].siblingItems).toHaveLength(2);
    expect(items[0].dateRangeStart).toBe('2024-01-01');
    expect(items[0].dateRangeEnd).toBe('2024-01-03');
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

  it('混合表达式 dateRangeStart/End', () => {
    const items = LineParser.parseItemLine('事项 @2026-03-07, 2026-03-09, 2026-03-13~03-20', 1);
    expect(items.length).toBeGreaterThanOrEqual(2);
    const first = items[0];
    expect(first.dateRangeStart).toBe('2026-03-07');
    expect(first.dateRangeEnd).toBe('2026-03-20');
    items.forEach(item => {
      expect(item.dateRangeStart).toBe('2026-03-07');
      expect(item.dateRangeEnd).toBe('2026-03-20');
    });
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

describe('parseBlockRefs 块引用解析', () => {
  it('单引号锚文本', () => {
    const { stripped, links } = parseBlockRefs("首页((20260310210016-gkixdit '测试'))改版");
    expect(stripped).toBe('首页测试改版');
    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({ name: '测试', url: 'siyuan://blocks/20260310210016-gkixdit', type: 'block-ref' });
  });

  it('双引号锚文本', () => {
    const { stripped, links } = parseBlockRefs('((20200813131152-0wk5akh "在内容块中遨游"))');
    expect(stripped).toBe('在内容块中遨游');
    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({ name: '在内容块中遨游', url: 'siyuan://blocks/20200813131152-0wk5akh', type: 'block-ref' });
  });

  it('无锚文本替换为空', () => {
    const { stripped, links } = parseBlockRefs('((20260310210016-gkixdit))纯文本');
    expect(stripped).toBe('纯文本');
    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({ name: '块引用', url: 'siyuan://blocks/20260310210016-gkixdit', type: 'block-ref' });
  });

  it('多个块引用', () => {
    const { stripped, links } = parseBlockRefs(
      '((20200813131152-0wk5akh "A"))、((20200822191536-rm6hwid "B"))'
    );
    expect(stripped).toBe('A、B');
    expect(links).toHaveLength(2);
    expect(links[0].name).toBe('A');
    expect(links[1].name).toBe('B');
  });

  it('无块引用时 links 为空', () => {
    const { stripped, links } = parseBlockRefs('普通任务名');
    expect(stripped).toBe('普通任务名');
    expect(links).toHaveLength(0);
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

  it('任务名含块引用：strip 并提取到 links', () => {
    const task = LineParser.parseTaskLine(
      "首页((20260310210016-gkixdit '测试'))改版（任务名称） #任务 @L1",
      1
    );
    expect(task.name).toBe('首页测试改版（任务名称）');
    expect(task.links).toHaveLength(1);
    expect(task.links![0]).toEqual({ name: '测试', url: 'siyuan://blocks/20260310210016-gkixdit', type: 'block-ref' });
  });

  it('任务名含块引用与 URL 链接：links 合并', () => {
    const task = LineParser.parseTaskLine(
      "首页((20260310210016-gkixdit '测试'))改版 #任务 https://example.com",
      1
    );
    expect(task.name).toBe('首页测试改版');
    expect(task.links).toHaveLength(2);
    expect(task.links![0]).toEqual({ name: '测试', url: 'siyuan://blocks/20260310210016-gkixdit', type: 'block-ref' });
    expect(task.links![1]).toEqual({ name: '链接', url: 'https://example.com', type: 'external' });
  });

  it.each([
    ['# 重要项目 #任务', 'H1', '重要项目'],
    ['## 日常维护 📋 @L2', 'H2', '日常维护'],
    ['### redmine 维护 📋', 'H3', 'redmine 维护'],
    ['#### 季度汇报 📋 @2024-01-01', 'H4', '季度汇报'],
    ['##### 周会纪要 📋 @L3', 'H5', '周会纪要'],
    ['###### 最低优先级任务 #任务', 'H6', '最低优先级任务'],
  ] as const)('标题格式任务：%s 应剥离前缀', (line, _level, expectedName) => {
    const task = LineParser.parseTaskLine(line, 1);
    expect(task.name).toBe(expectedName);
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

  it('事项内容含块引用：strip 并提取到 links', () => {
    const items = LineParser.parseItemLine(
      '确定设计风格((20260310210016-gkixdit "别名")) @2026-03-09',
      1
    );
    expect(items).toHaveLength(1);
    expect(items[0].content).toBe('确定设计风格别名');
    expect(items[0].links).toHaveLength(1);
    expect(items[0].links![0]).toEqual({ name: '别名', url: 'siyuan://blocks/20260310210016-gkixdit', type: 'block-ref' });
  });

  it('事项块引用与下方链接合并', () => {
    const itemLinks = [{ name: '需求文档', url: 'https://example.com' }];
    const items = LineParser.parseItemLine(
      '工作事项((20260310210016-gkixdit "块引用")) @2024-01-01',
      1,
      itemLinks
    );
    expect(items).toHaveLength(1);
    expect(items[0].content).toBe('工作事项块引用');
    expect(items[0].links).toHaveLength(2);
    expect(items[0].links![0]).toEqual({ name: '需求文档', url: 'https://example.com' });
    expect(items[0].links![1]).toEqual({ name: '块引用', url: 'siyuan://blocks/20260310210016-gkixdit', type: 'block-ref' });
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

  it('描述含块引用：仅 strip 不提取 links', () => {
    const pomodoro = LineParser.parsePomodoroLine(
      '🍅2026-03-08 15:45:32~15:45:36 专注((20260310210016-gkixdit "别名"))',
      'block-10'
    );
    expect(pomodoro).not.toBeNull();
    expect(pomodoro!.description).toBe('专注别名');
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

describe('parsePomodoroLine 多行描述解析', () => {
  it('多行描述（3行）', () => {
    const multiLineContent = `🍅0,2026-03-16 12:18:17~12:18:39
测试
测试2
测试3`;
    const pomodoro = LineParser.parsePomodoroLine(multiLineContent, 'block-1');
    expect(pomodoro).not.toBeNull();
    expect(pomodoro!.date).toBe('2026-03-16');
    expect(pomodoro!.startTime).toBe('12:18:17');
    expect(pomodoro!.endTime).toBe('12:18:39');
    expect(pomodoro!.actualDurationMinutes).toBe(0);
    expect(pomodoro!.description).toBe('测试\n测试2\n测试3');
  });

  it('多行描述包含块属性行', () => {
    const multiLineContent = `🍅0,2026-03-16 12:18:17~12:18:39
测试
测试2
{: id="20260316121856-j8txurz" updated="20260316121856"}`;
    const pomodoro = LineParser.parsePomodoroLine(multiLineContent, 'block-1');
    expect(pomodoro).not.toBeNull();
    expect(pomodoro!.description).toBe('测试\n测试2');
  });

  it('多行描述包含空行', () => {
    const multiLineContent = `🍅0,2026-03-16 12:18:17~12:18:39
测试

测试2`;
    const pomodoro = LineParser.parsePomodoroLine(multiLineContent, 'block-1');
    expect(pomodoro).not.toBeNull();
    expect(pomodoro!.description).toBe('测试\n测试2');
  });

  it('第一行已有描述+多行描述', () => {
    const multiLineContent = `🍅0,2026-03-16 12:18:17~12:18:39 第一行描述
第二行描述
第三行描述`;
    const pomodoro = LineParser.parsePomodoroLine(multiLineContent, 'block-1');
    expect(pomodoro).not.toBeNull();
    expect(pomodoro!.description).toBe('第一行描述\n第二行描述\n第三行描述');
  });

  it('单行描述（向后兼容）', () => {
    const pomodoro = LineParser.parsePomodoroLine('🍅0,2026-03-16 12:18:17~12:18:39 单行描述', 'block-1');
    expect(pomodoro).not.toBeNull();
    expect(pomodoro!.description).toBe('单行描述');
  });

  it('多行描述无结束时间', () => {
    const multiLineContent = `🍅25,2026-03-16 12:18:17
测试
测试2`;
    const pomodoro = LineParser.parsePomodoroLine(multiLineContent, 'block-1');
    expect(pomodoro).not.toBeNull();
    expect(pomodoro!.date).toBe('2026-03-16');
    expect(pomodoro!.startTime).toBe('12:18:17');
    expect(pomodoro!.endTime).toBeUndefined();
    expect(pomodoro!.description).toBe('测试\n测试2');
  });
});

describe('parseItemLine - 任务列表状态解析', () => {
  it('任务列表 [ ] 未选中状态', () => {
    const items = LineParser.parseItemLine('[ ] 整理资料 @2024-01-01', 1);
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('pending');
    expect(items[0].content).toBe('整理资料');
  });

  it('任务列表 [x] 已完成状态', () => {
    const items = LineParser.parseItemLine('[x] 整理资料 @2024-01-01', 1);
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('completed');
    expect(items[0].content).toBe('整理资料');
  });

  it('任务列表 [X] 已完成状态', () => {
    const items = LineParser.parseItemLine('[X] 整理资料 @2024-01-01', 1);
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('completed');
    expect(items[0].content).toBe('整理资料');
  });

  it('任务列表 [x] 与 #abandoned 共存时状态标签优先', () => {
    const items = LineParser.parseItemLine('[x] 整理资料 @2024-01-01 #abandoned', 1);
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('abandoned');
    expect(items[0].content).toBe('整理资料');
  });

  it('任务列表 [ ] 与 #done 共存时状态标签优先', () => {
    const items = LineParser.parseItemLine('[ ] 整理资料 @2024-01-01 #done', 1);
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('completed');
    expect(items[0].content).toBe('整理资料');
  });

  it('思源笔记格式：块属性 + [ ] 未选中', () => {
    // parseItemLine 接收的是已去除列表标记和块属性的内容
    const items = LineParser.parseItemLine('[ ] 事项内容 @2026-03-08', 1);
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('pending');
    expect(items[0].content).toBe('事项内容');
    expect(items[0].date).toBe('2026-03-08');
  });

  it('思源笔记格式：块属性 + [x] 已完成', () => {
    const items = LineParser.parseItemLine('[x] 事项内容 @2026-03-08', 1);
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('completed');
    expect(items[0].content).toBe('事项内容');
  });

  it('思源笔记格式：块属性 + [X] 已完成', () => {
    const items = LineParser.parseItemLine('[X] 事项内容 @2026-03-08', 1);
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('completed');
    expect(items[0].content).toBe('事项内容');
  });

  it('思源笔记格式：带缩进的任务列表', () => {
    const items = LineParser.parseItemLine('[ ] 事项内容 @2026-03-08', 1);
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('pending');
    expect(items[0].content).toBe('事项内容');
  });

  it('任务列表 [x] 与多日期组合', () => {
    const items = LineParser.parseItemLine('[x] 整理资料 @2024-01-01, 2024-01-03', 1);
    expect(items).toHaveLength(2);
    expect(items[0].status).toBe('completed');
    expect(items[1].status).toBe('completed');
    expect(items[0].content).toBe('整理资料');
  });
});

describe('parsePomodoroAttrValue 块属性番茄钟解析（attr 模式）', () => {
  it('完整格式：duration,date start~end description', () => {
    const value = '25,2026-03-11 10:30:00~10:55:00 完成复习';
    const record = LineParser.parsePomodoroAttrValue(value, 'block-1');
    expect(record).not.toBeNull();
    expect(record!.durationMinutes).toBe(25);
    expect(record!.actualDurationMinutes).toBe(25);
    expect(record!.date).toBe('2026-03-11');
    expect(record!.startTime).toBe('10:30:00');
    expect(record!.endTime).toBe('10:55:00');
    expect(record!.description).toBe('完成复习');
    expect(record!.blockId).toBe('block-1');
  });

  it('无 description', () => {
    const value = '25,2026-03-11 10:30:00~10:55:00';
    const record = LineParser.parsePomodoroAttrValue(value, 'block-2');
    expect(record).not.toBeNull();
    expect(record!.durationMinutes).toBe(25);
    expect(record!.date).toBe('2026-03-11');
    expect(record!.description).toBeUndefined();
  });

  it('空 description（空格后无内容）', () => {
    const value = '25,2026-03-11 10:30:00~10:55:00 ';
    const record = LineParser.parsePomodoroAttrValue(value, 'block-3');
    expect(record).not.toBeNull();
    expect(record!.durationMinutes).toBe(25);
    expect(record!.description).toBeUndefined();
  });

  it('中文逗号 duration', () => {
    const value = '25，2026-03-11 10:30:00~10:55:00 完成';
    const record = LineParser.parsePomodoroAttrValue(value, 'block-4');
    expect(record).not.toBeNull();
    expect(record!.durationMinutes).toBe(25);
    expect(record!.description).toBe('完成');
  });

  it('无效格式返回 null', () => {
    expect(LineParser.parsePomodoroAttrValue('invalid', 'block-5')).toBeNull();
    expect(LineParser.parsePomodoroAttrValue('', 'block-6')).toBeNull();
    expect(LineParser.parsePomodoroAttrValue('25,2026-03-11', 'block-7')).toBeNull();
  });

  it('多行描述（真正换行符 \\n）', () => {
    // 使用真正的换行符（如思源 API 返回的格式）
    const value = '25,2026-03-11 10:30:00~10:55:00\n第一行描述\n第二行描述\n第三行描述';
    const record = LineParser.parsePomodoroAttrValue(value, 'block-8');
    expect(record).not.toBeNull();
    expect(record!.durationMinutes).toBe(25);
    expect(record!.date).toBe('2026-03-11');
    expect(record!.startTime).toBe('10:30:00');
    expect(record!.endTime).toBe('10:55:00');
    expect(record!.description).toBe('第一行描述\n第二行描述\n第三行描述');
  });

  it('多行描述含空行（真正换行符）', () => {
    const value = '25,2026-03-11 10:30:00~10:55:00\n第一行描述\n\n第二行描述';
    const record = LineParser.parsePomodoroAttrValue(value, 'block-9');
    expect(record).not.toBeNull();
    expect(record!.description).toBe('第一行描述\n第二行描述');
  });

  it('多行描述含块属性行（真正换行符）', () => {
    const value = '25,2026-03-11 10:30:00~10:55:00\n描述1\n描述2\n{: id="xxx" updated="123"}';
    const record = LineParser.parsePomodoroAttrValue(value, 'block-10');
    expect(record).not.toBeNull();
    expect(record!.description).toBe('描述1\n描述2');
  });

  it('单行描述（向后兼容）', () => {
    const value = '25,2026-03-11 10:30:00~10:55:00 单行描述';
    const record = LineParser.parsePomodoroAttrValue(value, 'block-11');
    expect(record).not.toBeNull();
    expect(record!.description).toBe('单行描述');
  });
});

describe('parsePomodoroAttrs 从块属性对象提取番茄钟', () => {
  it('提取 custom-pomodoro- 前缀属性', () => {
    const attrs = {
      'custom-pomodoro-1731234567890': '25,2026-03-11 10:30:00~10:55:00 完成',
      'custom-pomodoro-1731234567891': '15,2026-03-11 11:00:00~11:15:00',
      bookmark: '🍅',
      other: 'ignored'
    };
    const records = LineParser.parsePomodoroAttrs(attrs, 'block-1');
    expect(records).toHaveLength(2);
    expect(records[0].durationMinutes).toBe(25);
    expect(records[0].description).toBe('完成');
    expect(records[1].durationMinutes).toBe(15);
    expect(records[1].description).toBeUndefined();
  });

  it('自定义前缀', () => {
    const attrs = {
      'my-pomodoro-1731234567890': '25,2026-03-11 10:30:00~10:55:00 完成'
    };
    const records = LineParser.parsePomodoroAttrs(attrs, 'block-1', 'my-pomodoro');
    expect(records).toHaveLength(1);
    expect(records[0].durationMinutes).toBe(25);
  });

  it('无番茄钟属性返回空数组', () => {
    const attrs = { bookmark: '🍅', other: 'value' };
    const records = LineParser.parsePomodoroAttrs(attrs, 'block-1');
    expect(records).toHaveLength(0);
  });
});

describe('parseItemLine - 事项内容保留逗号', () => {
  it('事项内容包含中文逗号应保留', () => {
    const items = LineParser.parseItemLine('测试，手机号登录开发 @2026-03-21', 1);
    expect(items).toHaveLength(1);
    expect(items[0].content).toBe('测试，手机号登录开发');
    expect(items[0].date).toBe('2026-03-21');
  });

  it('事项内容包含英文逗号应保留', () => {
    const items = LineParser.parseItemLine('Test, phone login development @2026-03-21', 1);
    expect(items).toHaveLength(1);
    expect(items[0].content).toBe('Test, phone login development');
    expect(items[0].date).toBe('2026-03-21');
  });

  it('事项内容包含多个逗号应全部保留', () => {
    const items = LineParser.parseItemLine('测试，开发，验证 @2026-03-21', 1);
    expect(items).toHaveLength(1);
    expect(items[0].content).toBe('测试，开发，验证');
    expect(items[0].date).toBe('2026-03-21');
  });

  it('多日期事项中内容逗号应保留', () => {
    const items = LineParser.parseItemLine('测试，内容 @2024-01-01, 2024-01-03', 1);
    expect(items).toHaveLength(2);
    expect(items[0].content).toBe('测试，内容');
    expect(items[1].content).toBe('测试，内容');
  });

  it('多日期事项（中文逗号分隔）中内容逗号应保留', () => {
    const items = LineParser.parseItemLine('测试，内容 @2024-01-01，2024-01-03', 1);
    expect(items).toHaveLength(2);
    expect(items[0].content).toBe('测试，内容');
    expect(items[1].content).toBe('测试，内容');
  });

  it('内容以逗号结尾应保留', () => {
    const items = LineParser.parseItemLine('测试， @2026-03-21', 1);
    expect(items).toHaveLength(1);
    expect(items[0].content).toBe('测试，');
  });

  it('内容以逗号开头应保留', () => {
    const items = LineParser.parseItemLine('，测试 @2026-03-21', 1);
    expect(items).toHaveLength(1);
    expect(items[0].content).toBe('，测试');
  });
});

describe('parseItemLine - 重复规则解析', () => {
  it('🔁每月 应被正确识别并从内容中移除', () => {
    const items = LineParser.parseItemLine('这是一个已完成的事项 📅2026-03-28 🔁每月', 1);
    expect(items).toHaveLength(1);
    expect(items[0].content).toBe('这是一个已完成的事项');
    expect(items[0].date).toBe('2026-03-28');
    expect(items[0].repeatRule).toEqual({ type: 'monthly' });
  });

  it('🔁每天 应被正确识别并从内容中移除', () => {
    const items = LineParser.parseItemLine('每日任务 📅2026-03-28 🔁每天', 1);
    expect(items).toHaveLength(1);
    expect(items[0].content).toBe('每日任务');
    expect(items[0].repeatRule).toEqual({ type: 'daily' });
  });

  it('🔁每周 应被正确识别并从内容中移除', () => {
    const items = LineParser.parseItemLine('周会 📅2026-03-28 🔁每周', 1);
    expect(items).toHaveLength(1);
    expect(items[0].content).toBe('周会');
    expect(items[0].repeatRule).toEqual({ type: 'weekly' });
  });

  it('🔁每月15日 应被正确识别指定日期', () => {
    const items = LineParser.parseItemLine('月会 📅2026-03-28 🔁每月15日', 1);
    expect(items).toHaveLength(1);
    expect(items[0].content).toBe('月会');
    expect(items[0].repeatRule).toEqual({ type: 'monthly', dayOfMonth: 15 });
  });

  it('带结束日期的重复规则', () => {
    const items = LineParser.parseItemLine('临时任务 📅2026-03-28 🔁每天 截止到2026-04-30', 1);
    expect(items).toHaveLength(1);
    expect(items[0].content).toBe('临时任务');
    expect(items[0].repeatRule).toEqual({ type: 'daily' });
    expect(items[0].endCondition).toEqual({ type: 'date', endDate: '2026-04-30' });
  });

  it('带次数限制的重复规则', () => {
    const items = LineParser.parseItemLine('限时任务 📅2026-03-28 🔁每天 剩余5次', 1);
    expect(items).toHaveLength(1);
    expect(items[0].content).toBe('限时任务');
    expect(items[0].repeatRule).toEqual({ type: 'daily' });
    expect(items[0].endCondition).toEqual({ type: 'count', maxCount: 5 });
  });

  it('用户问题案例：带时间范围和每月指定日期的重复规则', () => {
    // 新格式：这是一个带时间的事项 📅2026-03-28 09:00:00~10:00:00 🔁每月3日 截止到2026-05-31
    const items = LineParser.parseItemLine('这是一个带时间的事项 📅2026-03-28 09:00:00~10:00:00 🔁每月3日 截止到2026-05-31', 1);
    expect(items).toHaveLength(1);
    expect(items[0].content).toBe('这是一个带时间的事项');
    expect(items[0].date).toBe('2026-03-28');
    expect(items[0].startDateTime).toBe('2026-03-28 09:00:00');
    expect(items[0].endDateTime).toBe('2026-03-28 10:00:00');
    expect(items[0].repeatRule).toEqual({ type: 'monthly', dayOfMonth: 3 });
    expect(items[0].endCondition).toEqual({ type: 'date', endDate: '2026-05-31' });
  });

  it('用户问题案例：每周六重复，内容中不应包含"六"', () => {
    // 这是一个带时间的事项 📅2026-03-28 09:00:00~10:00:00 ⏰提前15分钟 🔁每周六 截止到2026-11-28
    const items = LineParser.parseItemLine('这是一个带时间的事项 📅2026-03-28 09:00:00~10:00:00 ⏰提前15分钟 🔁每周六 截止到2026-11-28', 1);
    expect(items).toHaveLength(1);
    expect(items[0].content).toBe('这是一个带时间的事项');
    expect(items[0].date).toBe('2026-03-28');
    expect(items[0].repeatRule).toEqual({ type: 'weekly', daysOfWeek: [6] });
    expect(items[0].endCondition).toEqual({ type: 'date', endDate: '2026-11-28' });
  });

  it('带时间范围和结束前提醒的事项：应正确解析时间和提醒', () => {
    // 这是一个带时间的事项 📅2026-03-31 09:00:00~10:00:00 🔁每周一三六 剩余10次 ⏰结束前30分钟
    const items = LineParser.parseItemLine('这是一个带时间的事项 📅2026-03-31 09:00:00~10:00:00 🔁每周一三六 剩余10次 ⏰结束前30分钟', 1);
    expect(items).toHaveLength(1);
    expect(items[0].content).toBe('这是一个带时间的事项');
    expect(items[0].date).toBe('2026-03-31');
    expect(items[0].startDateTime).toBe('2026-03-31 09:00:00');
    expect(items[0].endDateTime).toBe('2026-03-31 10:00:00');
    expect(items[0].reminder).toEqual({
      enabled: true,
      type: 'relative',
      relativeTo: 'end',
      offsetMinutes: 30
    });
    expect(items[0].repeatRule).toEqual({ type: 'weekly', daysOfWeek: [1, 3, 6] });
    expect(items[0].endCondition).toEqual({ type: 'count', maxCount: 10 });
  });

  // ==================== P1: 多日期与重复规则互斥 ====================

  it('多日期 + 重复规则：应忽略重复规则', () => {
    const items = LineParser.parseItemLine('多日期任务 📅2026-03-17, 2026-03-19 🔁每周', 1);
    expect(items).toHaveLength(2);
    expect(items[0].date).toBe('2026-03-17');
    expect(items[1].date).toBe('2026-03-19');
    // 重复规则应被忽略
    expect(items[0].repeatRule).toBeUndefined();
    expect(items[1].repeatRule).toBeUndefined();
  });

  it('日期范围 + 重复规则：应忽略重复规则', () => {
    const items = LineParser.parseItemLine('出差 📅2026-03-10~2026-03-12 🔁每天', 1);
    expect(items).toHaveLength(3);
    expect(items[0].date).toBe('2026-03-10');
    expect(items[1].date).toBe('2026-03-11');
    expect(items[2].date).toBe('2026-03-12');
    // 重复规则应被忽略
    expect(items[0].repeatRule).toBeUndefined();
  });

  // ==================== P1: 日期范围 + 提醒 ====================

  it('日期范围 + 提醒：每个展开的 Item 都应携带提醒配置', () => {
    const items = LineParser.parseItemLine('出差 📅2026-03-10~2026-03-12 ⏰08:00', 1);
    expect(items).toHaveLength(3);
    // 每个 Item 都应有提醒配置
    items.forEach((item) => {
      expect(item.reminder).toBeDefined();
      expect(item.reminder?.enabled).toBe(true);
      expect(item.reminder?.type).toBe('absolute');
      expect(item.reminder?.time).toBe('08:00');
    });
  });

  // ==================== P1: 完整组合测试 ====================

  it('任务列表 + 日期 + 时间 + 提醒 + 重复 + 结束条件', () => {
    const items = LineParser.parseItemLine(
      '[ ] 月度汇报 📅2026-03-17 14:00:00~16:00:00 ⏰提前10分钟 🔁每月 截止到2026-12-31',
      1
    );
    expect(items).toHaveLength(1);
    expect(items[0].content).toBe('月度汇报');
    expect(items[0].date).toBe('2026-03-17');
    expect(items[0].startDateTime).toBe('2026-03-17 14:00:00');
    expect(items[0].endDateTime).toBe('2026-03-17 16:00:00');
    expect(items[0].status).toBe('pending');
    expect(items[0].reminder).toEqual({
      enabled: true,
      type: 'relative',
      relativeTo: 'start',
      offsetMinutes: 10,
    });
    expect(items[0].repeatRule).toEqual({ type: 'monthly' });
    expect(items[0].endCondition).toEqual({ type: 'date', endDate: '2026-12-31' });
  });

  it('任务列表 [x] + 日期 + 时间 + 提醒 + 重复 + 次数结束', () => {
    const items = LineParser.parseItemLine(
      '[x] 背单词 📅2026-03-17 08:00:00 ⏰07:50 🔁每天 剩余5次',
      1
    );
    expect(items).toHaveLength(1);
    expect(items[0].content).toBe('背单词');
    expect(items[0].status).toBe('completed');
    expect(items[0].reminder?.enabled).toBe(true);
    expect(items[0].reminder?.type).toBe('absolute');
    expect(items[0].reminder?.time).toBe('07:50');
    expect(items[0].repeatRule).toEqual({ type: 'daily' });
    expect(items[0].endCondition).toEqual({ type: 'count', maxCount: 5 });
  });
});
