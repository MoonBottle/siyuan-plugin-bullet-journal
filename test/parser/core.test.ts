/**
 * core 解析器单元测试
 * - stripListAndBlockAttr：列表前缀与行内块属性剥离
 * - parseKramdown：有序/无序列表任务行、事项行解析出正确名称
 */
import { describe, it, expect } from 'vitest';
import { parseKramdown, stripListAndBlockAttr } from '@/parser/core';

describe('stripListAndBlockAttr', () => {
  it('剥离无序列表标记与行内块属性', () => {
    const line =
      '- {: id="20260305110707-woafasq" updated="20260305110347"}测试无序列表任务 #任务#';
    expect(stripListAndBlockAttr(line)).toBe('测试无序列表任务 #任务#');
  });

  it('剥离有序列表标记与行内块属性', () => {
    const line =
      '1. {: id="20260305110838-4mkjuoe" updated="20260305110838"}测试有序列表任务 #任务#';
    expect(stripListAndBlockAttr(line)).toBe('测试有序列表任务 #任务#');
  });

  it('带缩进的无序列表', () => {
    const line =
      '  - {: id="20260305110707-o2s7uiq" updated="20260305110345"}测试事项 A @2026-03-05';
    expect(stripListAndBlockAttr(line)).toBe('测试事项 A @2026-03-05');
  });

  it('无列表前缀与块属性时原样 trim', () => {
    expect(stripListAndBlockAttr('  纯文本任务 #任务#  ')).toBe('纯文本任务 #任务#');
  });

  it('仅有列表标记无块属性', () => {
    expect(stripListAndBlockAttr('- 任务名 #任务#')).toBe('任务名 #任务#');
  });
});

describe('parseKramdown 列表项解析', () => {
  it('无序列表任务行：剥离列表前缀与行内块属性后解析出正确任务名', () => {
    const kramdown = `## 有氧
{: id="doc-block" type="doc" }
- {: id="20260305110707-woafasq" updated="20260305110347"}测试无序列表任务 #任务#
{: id="after-task" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    expect(project!.tasks[0].name).toBe('测试无序列表任务');
    expect(project!.tasks[0].name).not.toContain('{:');
    expect(project!.tasks[0].name).not.toMatch(/^-\s/);
  });

  it('有序列表任务行：剥离列表前缀与行内块属性后解析出正确任务名', () => {
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
1. {: id="20260305110838-4mkjuoe" updated="20260305110838"}测试有序列表任务 #任务#
{: id="after-task" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    expect(project!.tasks[0].name).toBe('测试有序列表任务');
    expect(project!.tasks[0].name).not.toContain('{:');
    expect(project!.tasks[0].name).not.toMatch(/^\d+\.\s/);
  });

  it('无序列表事项行：剥离列表前缀与行内块属性后解析出正确事项内容', () => {
    const kramdown = `## 有氧
{: id="doc-block" type="doc" }
- {: id="t1" }任务A #任务#
{: id="after-t" }
  - {: id="i1" updated="123"}测试事项 A @2026-03-05
{: id="after-i" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    expect(project!.tasks[0].items).toHaveLength(1);
    expect(project!.tasks[0].items[0].content).toBe('测试事项 A');
    expect(project!.tasks[0].items[0].content).not.toContain('{:');
    expect(project!.tasks[0].items[0].content).not.toMatch(/^-\s/);
  });

  it('有序列表事项行：剥离列表前缀与行内块属性后解析出正确事项内容', () => {
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
1. {: id="t1" }任务B #任务#
{: id="after-t" }
   1. {: id="i2" }测试事项 B @2026-03-05
{: id="after-i" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    expect(project!.tasks[0].items).toHaveLength(1);
    expect(project!.tasks[0].items[0].content).toBe('测试事项 B');
    expect(project!.tasks[0].items[0].content).not.toContain('{:')
    expect(project!.tasks[0].items[0].content).not.toMatch(/^\d+\.\s/);
  });
});

describe('parseKramdown 事项链接解析', () => {
  it('事项下方单个链接：正确关联到事项', () => {
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
- {: id="t1" }任务A #任务#
{: id="after-t" }
  - {: id="i1" }工作事项 @2026-03-10
{: id="after-i1" }
  - {: id="link1" }[示例链接](https://example.com)
{: id="after-link1" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    expect(project!.tasks[0].items).toHaveLength(1);
    expect(project!.tasks[0].items[0].content).toBe('工作事项');
    expect(project!.tasks[0].items[0].links).toHaveLength(1);
    expect(project!.tasks[0].items[0].links![0].name).toBe('示例链接');
    expect(project!.tasks[0].items[0].links![0].url).toBe('https://example.com');
  });

  it('事项下方多个链接：正确关联到事项', () => {
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
- {: id="t1" }任务B #任务#
{: id="after-t" }
  - {: id="i1" }多链接事项 @2026-03-15
{: id="after-i1" }
  - {: id="link1" }[需求文档](https://example.com/requirements)
{: id="after-link1" }
  - {: id="link2" }[设计稿](siyuan://blocks/20260220112000)
{: id="after-link2" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    expect(project!.tasks[0].items).toHaveLength(1);
    expect(project!.tasks[0].items[0].links).toHaveLength(2);
    expect(project!.tasks[0].items[0].links![0].name).toBe('需求文档');
    expect(project!.tasks[0].items[0].links![1].name).toBe('设计稿');
  });

  it('事项无链接：links 为 undefined', () => {
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
- {: id="t1" }任务C #任务#
{: id="after-t" }
  - {: id="i1" }无链接事项 @2026-03-20
{: id="after-i1" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    expect(project!.tasks[0].items).toHaveLength(1);
    expect(project!.tasks[0].items[0].content).toBe('无链接事项');
    expect(project!.tasks[0].items[0].links).toBeUndefined();
  });

  it('多日期事项带链接：所有展开的 Item 都有链接', () => {
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
- {: id="t1" }任务D #任务#
{: id="after-t" }
  - {: id="i1" }多日期事项 @2026-03-06, 2026-03-10
{: id="after-i1" }
  - {: id="link1" }[GitHub](https://github.com)
{: id="after-link1" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    expect(project!.tasks[0].items).toHaveLength(2);
    // 所有展开的 Item 都应该有相同的链接
    expect(project!.tasks[0].items[0].links).toHaveLength(1);
    expect(project!.tasks[0].items[1].links).toHaveLength(1);
    expect(project!.tasks[0].items[0].links![0].name).toBe('GitHub');
    expect(project!.tasks[0].items[1].links![0].name).toBe('GitHub');
  });

  it('事项下方不缩进链接：也能正确关联', () => {
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
- {: id="t1" }任务E #任务#
{: id="after-t" }
  - {: id="i1" }不缩进链接事项 @2026-03-25
{: id="after-i1" }
- {: id="link1" }[外部链接](https://example.com)
{: id="after-link1" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    expect(project!.tasks[0].items).toHaveLength(1);
    expect(project!.tasks[0].items[0].content).toBe('不缩进链接事项');
    expect(project!.tasks[0].items[0].links).toHaveLength(1);
    expect(project!.tasks[0].items[0].links![0].name).toBe('外部链接');
    expect(project!.tasks[0].items[0].links![0].url).toBe('https://example.com');
  });

  it('无序列表格式链接：也能正确关联', () => {
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
- {: id="t1" }任务F #任务#
{: id="after-t" }
  - {: id="i1" }无序列表链接事项 @2026-03-28
{: id="after-i1" }
  - {: id="link1" }[链接F1](https://example.com)
{: id="after-link1" }
  - {: id="link2" }[链接F2](https://github.com)
{: id="after-link2" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    expect(project!.tasks[0].items).toHaveLength(1);
    expect(project!.tasks[0].items[0].content).toBe('无序列表链接事项');
    expect(project!.tasks[0].items[0].links).toHaveLength(2);
    expect(project!.tasks[0].items[0].links![0].name).toBe('链接F1');
    expect(project!.tasks[0].items[0].links![1].name).toBe('链接F2');
  });
});

describe('parseKramdown 有序列表解析', () => {
  it('有序列表任务：正确解析任务层级', () => {
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
1. {: id="t1" }有序任务A #任务#
{: id="after-t1" }
   - {: id="i1" }有序事项A @2026-04-01
{: id="after-i1" }
   - {: id="i2" }有序事项B @2026-04-02
{: id="after-i2" }
2. {: id="t2" }有序任务B #任务#
{: id="after-t2" }
   - {: id="i3" }有序事项C @2026-04-03
{: id="after-i3" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(2);
    expect(project!.tasks[0].name).toBe('有序任务A');
    expect(project!.tasks[0].items).toHaveLength(2);
    expect(project!.tasks[1].name).toBe('有序任务B');
    expect(project!.tasks[1].items).toHaveLength(1);
  });

  it('有序列表多日期事项：正确解析', () => {
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
1. {: id="t1" }任务A #任务#
{: id="after-t1" }
   1. {: id="i1" }有序多日期A @2026-04-05, 2026-04-10, 2026-04-15
{: id="after-i1" }
   2. {: id="i2" }有序多日期B @2026-04-06~04-08 #done
{: id="after-i2" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    // 3个单日期 + 3个范围日期(2026-04-06, 04-07, 04-08) = 6个事项
    expect(project!.tasks[0].items).toHaveLength(6);
  });

  it('有序列表事项带链接：正确关联', () => {
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
1. {: id="t1" }任务B #任务#
{: id="after-t1" }
   1. {: id="i1" }有序链接A @2026-04-20
{: id="after-i1" }
      - {: id="link1" }[有序链接1](https://example.com)
{: id="after-link1" }
      - {: id="link2" }[有序链接2](https://github.com)
{: id="after-link2" }
   2. {: id="i2" }有序链接B @2026-04-21, 2026-04-22
{: id="after-i2" }
- {: id="link3" }[有序链接3](https://docs.example.com)
{: id="after-link3" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    expect(project!.tasks[0].items).toHaveLength(3); // 1 + 2个日期
    expect(project!.tasks[0].items[0].links).toHaveLength(2);
    expect(project!.tasks[0].items[1].links).toHaveLength(1);
  });
});

describe('parseKramdown 番茄钟解析', () => {
  it('项目级别番茄钟（普通文本行）', () => {
    const kramdown = `# 测试项目
{: id="doc-block" type="doc" }
> 项目描述
{: id="desc-block" }
🍅2026-03-08 09:00:00~09:25:00 项目规划
{: id="pomodoro-1" }
🍅2026-03-08 10:00:00~10:25:00 项目复盘
{: id="pomodoro-2" }
## 任务A #任务
{: id="task-block" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.pomodoros).toHaveLength(2);
    expect(project!.pomodoros![0].date).toBe('2026-03-08');
    expect(project!.pomodoros![0].startTime).toBe('09:00:00');
    expect(project!.pomodoros![0].description).toBe('项目规划');
    expect(project!.pomodoros![0].projectId).toBe('test-doc');
    expect(project!.pomodoros![0].blockId).toBe('pomodoro-1');
  });

  it('任务级别番茄钟（普通文本行）', () => {
    const kramdown = `# 测试项目
{: id="doc-block" type="doc" }
## 任务A #任务
{: id="task-block" }
🍅2026-03-08 14:00:00~14:25:00 任务专注
{: id="pomodoro-1" }
🍅2026-03-08 15:00:00~15:25:00 任务复盘
{: id="pomodoro-2" }
- [ ] 事项A @2026-03-08
{: id="item-block" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    expect(project!.tasks[0].pomodoros).toHaveLength(2);
    expect(project!.tasks[0].pomodoros![0].description).toBe('任务专注');
    expect(project!.tasks[0].pomodoros![0].taskId).toBe(project!.tasks[0].id);
  });

  it('普通文本行事项下的番茄钟', () => {
    const kramdown = `# 测试项目
{: id="doc-block" type="doc" }
## 任务A #任务
{: id="task-block" }
事项A @2026-03-08
{: id="item-block" }
🍅2026-03-08 16:00:00~16:25:00 事项专注1
{: id="pomodoro-1" }
🍅2026-03-08 17:00:00~17:25:00 事项专注2
{: id="pomodoro-2" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    expect(project!.tasks[0].items).toHaveLength(1);
    expect(project!.tasks[0].items[0].pomodoros).toHaveLength(2);
    expect(project!.tasks[0].items[0].pomodoros![0].description).toBe('事项专注1');
    expect(project!.tasks[0].items[0].pomodoros![0].itemId).toBe(project!.tasks[0].items[0].id);
  });

  it('无序列表事项下的番茄钟（使用 - 标记）', () => {
    const kramdown = `# 测试项目
{: id="doc-block" type="doc" }
## 任务A #任务
{: id="task-block" }
- [ ] 事项A @2026-03-08
{: id="item-block" }
  - 🍅2026-03-08 18:00:00~18:25:00 无序番茄1
{: id="pomodoro-1" }
  - 🍅2026-03-08 19:00:00~19:25:00 无序番茄2
{: id="pomodoro-2" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks[0].items[0].pomodoros).toHaveLength(2);
    expect(project!.tasks[0].items[0].pomodoros![0].description).toBe('无序番茄1');
  });

  it('有序列表事项下的番茄钟（使用 1. 标记）', () => {
    const kramdown = `# 测试项目
{: id="doc-block" type="doc" }
## 任务A #任务
{: id="task-block" }
1. [ ] 事项A @2026-03-08
{: id="item-block" }
   1. 🍅2026-03-08 20:00:00~20:25:00 有序番茄1
{: id="pomodoro-1" }
   2. 🍅2026-03-08 21:00:00~21:25:00 有序番茄2
{: id="pomodoro-2" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks[0].items[0].pomodoros).toHaveLength(2);
    expect(project!.tasks[0].items[0].pomodoros![0].description).toBe('有序番茄1');
  });

  it('混合层级番茄钟解析', () => {
    const kramdown = `# 测试项目
{: id="doc-block" type="doc" }
> 描述
{: id="desc-block" }
🍅2026-03-08 08:00:00~08:25:00 项目番茄
{: id="pomodoro-project" }
## 任务A #任务
{: id="task-block" }
🍅2026-03-08 09:00:00~09:25:00 任务番茄
{: id="pomodoro-task" }
- [ ] 事项A @2026-03-08
{: id="item-block" }
  - 🍅2026-03-08 10:00:00~10:25:00 事项番茄
{: id="pomodoro-item" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.pomodoros).toHaveLength(1);
    expect(project!.pomodoros![0].description).toBe('项目番茄');
    expect(project!.tasks[0].pomodoros).toHaveLength(1);
    expect(project!.tasks[0].pomodoros![0].description).toBe('任务番茄');
    expect(project!.tasks[0].items[0].pomodoros).toHaveLength(1);
    expect(project!.tasks[0].items[0].pomodoros![0].description).toBe('事项番茄');
  });

  it('实际 Kramdown 格式：列表项番茄钟带转义波浪号', () => {
    // 模拟实际 API 返回的 Kramdown 格式（简化版）
    const kramdown = `# 测试项目
{: id="doc-block" type="doc" }
## 任务名称 #任务 @L1
{: id="20260308155948-4lcqs3u" updated="20260308155948"}
- [ ] 事项内容 @2026-03-08
{: id="20260308160041-iz1angi" updated="20260308160041"}
  - {: id="20260308160041-pv22iji" updated="20260308160041"}🍅2026-03-08 15:45:32\\~15:45:36 哈哈哈
{: id="20260308160041-ha4uxl2" updated="20260308160041"}
  - {: id="20260308160041-z94dgo5" updated="20260308160041"}🍅2026-03-08 16:00:00\\~16:25:00 专注工作
{: id="20260308160041-5audoq6" updated="20260308160041"}
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    expect(project!.tasks[0].items).toHaveLength(1);
    expect(project!.tasks[0].items[0].pomodoros).toHaveLength(2);
    expect(project!.tasks[0].items[0].pomodoros![0].description).toBe('哈哈哈');
    expect(project!.tasks[0].items[0].pomodoros![0].endTime).toBe('15:45:36');
    expect(project!.tasks[0].items[0].pomodoros![1].description).toBe('专注工作');
    expect(project!.tasks[0].items[0].pomodoros![1].endTime).toBe('16:25:00');
  });
});
