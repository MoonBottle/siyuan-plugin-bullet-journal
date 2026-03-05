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
    expect(project!.tasks[0].items[0].content).not.toContain('{:');
    expect(project!.tasks[0].items[0].content).not.toMatch(/^\d+\.\s/);
  });
});
