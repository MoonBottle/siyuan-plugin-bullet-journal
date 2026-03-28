/**
 * core 解析器单元测试
 * - stripListAndBlockAttr：列表前缀与行内块属性剥离
 * - parseKramdown：有序/无序列表任务行、事项行解析出正确名称
 */
import { describe, it, expect } from 'vitest';
import { parseKramdown, stripListAndBlockAttr } from '@/parser/core';

describe('stripListAndBlockAttr', () => {
  // ========== 基础列表处理 ==========
  
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

  // ========== 任务列表（思源实际格式）==========
  
  it('处理未选中任务列表 [ ]', () => {
    const input = '- {: id="xxx"}[ ] 事项内容 @2026-03-08';
    expect(stripListAndBlockAttr(input)).toBe('事项内容 @2026-03-08');
  });

  it('处理已选中任务列表 [X]', () => {
    const input = '- {: id="xxx"}[X] 事项内容 @2026-03-08';
    // [X] 标记会转换为 #done 标签
    expect(stripListAndBlockAttr(input)).toBe('事项内容 @2026-03-08 #done');
  });

  it('处理已选中任务列表 [x]', () => {
    const input = '- {: id="xxx"}[x] 事项内容 @2026-03-08';
    // [x] 标记会转换为 #done 标签
    expect(stripListAndBlockAttr(input)).toBe('事项内容 @2026-03-08 #done');
  });

  it('处理带缩进的任务列表', () => {
    const input = '  - {: id="xxx"}[ ] 事项内容 @2026-03-08';
    expect(stripListAndBlockAttr(input)).toBe('事项内容 @2026-03-08');
  });

  // ========== 实际 Kramdown 示例 ==========
  
  it('处理实际 Kramdown 未选中任务项', () => {
    const input = '- {: id="20260308203822-5gz124r" updated="20260308204332"}[ ] 事项列表未完成事项内容 @2026-03-08';
    expect(stripListAndBlockAttr(input)).toBe('事项列表未完成事项内容 @2026-03-08');
  });

  it('处理实际 Kramdown 已选中任务项', () => {
    const input = '- {: id="20260308203822-n577cpp" updated="20260308203634"}[X] 事项列表已完成状态事项 @2026-03-08';
    // [X] 标记会转换为 #done 标签
    expect(stripListAndBlockAttr(input)).toBe('事项列表已完成状态事项 @2026-03-08 #done');
  });

  it('处理实际 Kramdown 任务行', () => {
    const input = '- {: id="20260308203827-fmms29h" updated="20260308204332"}任务 #任务#';
    expect(stripListAndBlockAttr(input)).toBe('任务 #任务#');
  });

  it('处理实际 Kramdown 列表项番茄钟', () => {
    const input = '- {: id="20260308203822-p5gpzvm" updated="20260308160041"}🍅2026-03-08 15:45:32\\~15:45:36 哈哈哈';
    expect(stripListAndBlockAttr(input)).toBe('🍅2026-03-08 15:45:32\\~15:45:36 哈哈哈');
  });

  it('处理行内番茄钟（非列表项）', () => {
    const input = '  🍅2026-03-08 15:45:32\\~15:45:36 哈哈哈';
    expect(stripListAndBlockAttr(input)).toBe('🍅2026-03-08 15:45:32\\~15:45:36 哈哈哈');
  });

  // ========== 边缘情况 ==========
  
  it('处理内容中带方括号的情况', () => {
    const input = '- {: id="xxx"}[ ] 事项[重要] @2026-03-08';
    expect(stripListAndBlockAttr(input)).toBe('事项[重要] @2026-03-08');
  });

  it('处理空任务标记后内容为空', () => {
    const input = '- {: id="xxx"}[ ]';
    expect(stripListAndBlockAttr(input)).toBe('');
  });

  it('处理只有块属性', () => {
    const input = '{: id="xxx"}';
    expect(stripListAndBlockAttr(input)).toBe('');
  });

  it('处理只有任务标记', () => {
    const input = '[ ]';
    expect(stripListAndBlockAttr(input)).toBe('');
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

describe('parseKramdown 块引用解析', () => {
  it('项目名含块引用：strip 并提取到 project.links', () => {
    const kramdown = `## 网站((20260310210016-gkixdit '测试'))重构项目
{: id="doc-block" type="doc" }
- {: id="t1" }任务A #任务#
{: id="after-t" }
  - {: id="i1" }事项 @2026-03-10
{: id="after-i" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.name).toBe('网站测试重构项目');
    expect(project!.links).toHaveLength(1);
    expect(project!.links![0]).toEqual({ name: '测试', url: 'siyuan://blocks/20260310210016-gkixdit' });
  });

  it('任务名含块引用：strip 并提取到 task.links', () => {
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
- {: id="t1" }首页((20260310210016-gkixdit '测试'))改版 #任务#
{: id="after-t" }
  - {: id="i1" }事项 @2026-03-10
{: id="after-i" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    expect(project!.tasks[0].name).toBe('首页测试改版');
    expect(project!.tasks[0].links).toHaveLength(1);
    expect(project!.tasks[0].links![0]).toEqual({ name: '测试', url: 'siyuan://blocks/20260310210016-gkixdit' });
  });

  it('任务块引用与下方链接合并', () => {
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
- {: id="t1" }首页((20260310210016-gkixdit '测试'))改版 #任务#
{: id="after-t" }
  - {: id="link1" }[需求文档](https://example.com/homepage)
{: id="after-link1" }
  - {: id="i1" }事项 @2026-03-10
{: id="after-i" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    expect(project!.tasks[0].name).toBe('首页测试改版');
    expect(project!.tasks[0].links).toHaveLength(2);
    expect(project!.tasks[0].links![0]).toEqual({ name: '测试', url: 'siyuan://blocks/20260310210016-gkixdit' });
    expect(project!.tasks[0].links![1]).toEqual({ name: '需求文档', url: 'https://example.com/homepage' });
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

  it('事项与链接之间有非链接行（跨块）：跳过说明文字继续收集链接', () => {
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
- {: id="t1" }任务G #任务#
{: id="after-t" }
  - {: id="i1" }确定设计风格(事项) @2026-03-09
{: id="after-i1" }
  - {: id="desc1" }和事项相关联的链接,支持多个,每个一
{: id="after-desc1" }
  - {: id="link1" }[参考案例](https://example.com/ref)
{: id="after-link1" }
  - {: id="i2" }完成首页原型设计(已完成事项) @2026-03-10
{: id="after-i2" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    expect(project!.tasks[0].items).toHaveLength(2);
    expect(project!.tasks[0].items[0].content).toBe('确定设计风格(事项)');
    expect(project!.tasks[0].items[0].links).toHaveLength(1);
    expect(project!.tasks[0].items[0].links![0].name).toBe('参考案例');
    expect(project!.tasks[0].items[0].links![0].url).toBe('https://example.com/ref');
    expect(project!.tasks[0].items[1].content).toBe('完成首页原型设计(已完成事项)');
    expect(project!.tasks[0].items[1].links).toBeUndefined();
  });

  it('事项与链接之间有非链接行（同块内多行）：跳过说明文字继续收集链接', () => {
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
- {: id="t1" }任务H #任务#
{: id="after-t" }
  - {: id="i1" }确定设计风格(事项) @2026-03-09
和事项相关联的链接,支持多个,每个一
[参考案例](https://example.com/ref)
{: id="after-i1" }
  - {: id="i2" }完成首页原型设计(已完成事项) @2026-03-10
{: id="after-i2" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    expect(project!.tasks[0].items).toHaveLength(2);
    expect(project!.tasks[0].items[0].content).toBe('确定设计风格(事项)');
    expect(project!.tasks[0].items[0].links).toHaveLength(1);
    expect(project!.tasks[0].items[0].links![0].name).toBe('参考案例');
    expect(project!.tasks[0].items[0].links![0].url).toBe('https://example.com/ref');
    expect(project!.tasks[0].items[1].content).toBe('完成首页原型设计(已完成事项)');
    expect(project!.tasks[0].items[1].links).toBeUndefined();
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

  it('任务列表形式的链接：未选中 [ ] 状态', () => {
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
- {: id="t1" }任务A #任务#
{: id="after-t" }
  - {: id="i1" }工作事项 @2026-03-10
{: id="after-i1" }
  - {: id="link1" }[ ] [对对对](1)
{: id="after-link1" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    expect(project!.tasks[0].items).toHaveLength(1);
    expect(project!.tasks[0].items[0].content).toBe('工作事项');
    expect(project!.tasks[0].items[0].links).toHaveLength(1);
    expect(project!.tasks[0].items[0].links![0].name).toBe('对对对');
    expect(project!.tasks[0].items[0].links![0].url).toBe('1');
  });

  it('任务列表形式的链接：已选中 [x] 状态', () => {
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
- {: id="t1" }任务B #任务#
{: id="after-t" }
  - {: id="i1" }工作事项 @2026-03-11
{: id="after-i1" }
  - {: id="link1" }[x] [链接名称](https://example.com)
{: id="after-link1" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    expect(project!.tasks[0].items).toHaveLength(1);
    expect(project!.tasks[0].items[0].content).toBe('工作事项');
    expect(project!.tasks[0].items[0].links).toHaveLength(1);
    expect(project!.tasks[0].items[0].links![0].name).toBe('链接名称');
    expect(project!.tasks[0].items[0].links![0].url).toBe('https://example.com');
  });

  it('任务列表形式的链接：已选中 [X] 状态', () => {
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
- {: id="t1" }任务C #任务#
{: id="after-t" }
  - {: id="i1" }工作事项 @2026-03-12
{: id="after-i1" }
  - {: id="link1" }[X] [GitHub](https://github.com)
{: id="after-link1" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    expect(project!.tasks[0].items).toHaveLength(1);
    expect(project!.tasks[0].items[0].content).toBe('工作事项');
    expect(project!.tasks[0].items[0].links).toHaveLength(1);
    expect(project!.tasks[0].items[0].links![0].name).toBe('GitHub');
    expect(project!.tasks[0].items[0].links![0].url).toBe('https://github.com');
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

  it('多行描述番茄钟：项目级别', () => {
    const kramdown = `# 测试项目
{: id="doc-block" type="doc" }
🍅2026-03-16 12:18:17~12:18:39
测试
测试2
测试3
{: id="pomodoro-1" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.pomodoros).toHaveLength(1);
    expect(project!.pomodoros![0].date).toBe('2026-03-16');
    expect(project!.pomodoros![0].startTime).toBe('12:18:17');
    expect(project!.pomodoros![0].endTime).toBe('12:18:39');
    expect(project!.pomodoros![0].description).toBe('测试\n测试2\n测试3');
  });

  it('多行描述番茄钟：任务级别', () => {
    const kramdown = `# 测试项目
{: id="doc-block" type="doc" }
## 任务A #任务
{: id="task-block" }
🍅2026-03-16 14:00:00~14:25:00
第一行描述
第二行描述
{: id="pomodoro-1" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    expect(project!.tasks[0].pomodoros).toHaveLength(1);
    expect(project!.tasks[0].pomodoros![0].description).toBe('第一行描述\n第二行描述');
  });

  it('多行描述番茄钟：事项级别（普通文本行）', () => {
    const kramdown = `# 测试项目
{: id="doc-block" type="doc" }
## 任务A #任务
{: id="task-block" }
事项A @2026-03-16
{: id="item-block" }
🍅2026-03-16 16:00:00~16:25:00
事项描述1
事项描述2
事项描述3
{: id="pomodoro-1" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks[0].items[0].pomodoros).toHaveLength(1);
    expect(project!.tasks[0].items[0].pomodoros![0].description).toBe('事项描述1\n事项描述2\n事项描述3');
  });

  it('多行描述番茄钟：第一行已有描述+后续行', () => {
    const kramdown = `# 测试项目
{: id="doc-block" type="doc" }
🍅2026-03-16 10:00:00~10:25:00 第一行描述
第二行描述
第三行描述
{: id="pomodoro-1" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.pomodoros).toHaveLength(1);
    expect(project!.pomodoros![0].description).toBe('第一行描述\n第二行描述\n第三行描述');
  });

  it('多行描述番茄钟：含空行和块属性行', () => {
    const kramdown = `# 测试项目
{: id="doc-block" type="doc" }
🍅2026-03-16 11:00:00~11:25:00
描述1

描述2
{: id="pomodoro-1" updated="20260316110000"}
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.pomodoros).toHaveLength(1);
    // 空行和块属性行应该被过滤
    expect(project!.pomodoros![0].description).toBe('描述1\n描述2');
  });
});


describe('parseKramdown lastBlockId 解析', () => {
  it('事项无相关内容：lastBlockId 等于 blockId', () => {
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
- {: id="t1" }任务A #任务#
{: id="after-t" }
  - {: id="i1" }工作事项 @2026-03-10
{: id="after-i1" }
- {: id="next-task" }下一个任务 #任务#
{: id="after-next-task" }
  - {: id="next-item" }下一个事项 @2026-03-11
{: id="after-next" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(2);
    expect(project!.tasks[0].items).toHaveLength(1);
    expect(project!.tasks[0].items[0].blockId).toBe('after-i1');
    expect(project!.tasks[0].items[0].lastBlockId).toBe('after-i1');
  });

  it('事项有一个相关链接：lastBlockId 为链接块的 ID', () => {
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
- {: id="t1" }任务B #任务#
{: id="after-t" }
  - {: id="i1" }多链接事项 @2026-03-15
{: id="after-i1" }
  - {: id="link1" }[需求文档](https://example.com/requirements)
{: id="after-link1" }
- {: id="next-task" }下一个任务 #任务#
{: id="after-next-task" }
  - {: id="next-item" }下一个事项 @2026-03-16
{: id="after-next" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(2);
    expect(project!.tasks[0].items).toHaveLength(1);
    expect(project!.tasks[0].items[0].blockId).toBe('after-i1');
    expect(project!.tasks[0].items[0].lastBlockId).toBe('after-link1');
  });

  it('事项有普通文本内容：lastBlockId 为最后一个内容块', () => {
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
- {: id="t1" }任务C #任务#
{: id="after-t" }
  - {: id="i1" }事项 @2026-03-20
{: id="after-i1" }
- 事项相关内容1
{: id="content1" }
- 事项相关内容2
{: id="content2" }
- {: id="next-task" }下一个任务 #任务#
{: id="after-next-task" }
  - {: id="next-item" }下一个事项 @2026-03-21
{: id="after-next" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(2);
    expect(project!.tasks[0].items).toHaveLength(1);
    expect(project!.tasks[0].items[0].blockId).toBe('after-i1');
    // lastBlockId 应该是最后一个内容块的 ID（content2）
    expect(project!.tasks[0].items[0].lastBlockId).toBe('content2');
  });

  it('事项有链接和普通内容混合：lastBlockId 为最后一块', () => {
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
- {: id="t1" }任务D #任务#
{: id="after-t" }
  - {: id="i1" }事项 @2026-03-25
{: id="after-i1" }
  - {: id="link1" }[链接1](https://example.com/1)
{: id="after-link1" }
- 普通说明文字
{: id="note-block" }
  - {: id="link2" }[链接2](https://example.com/2)
{: id="after-link2" }
- 更多内容
{: id="more-content" }
- {: id="next-task" }下一个任务 #任务#
{: id="after-next-task" }
  - {: id="next-item" }下一个事项 @2026-03-26
{: id="after-next" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(2);
    expect(project!.tasks[0].items).toHaveLength(1);
    expect(project!.tasks[0].items[0].blockId).toBe('after-i1');
    // lastBlockId 应该是最后一个块的 ID
    expect(project!.tasks[0].items[0].lastBlockId).toBe('more-content');
  });

  it('多日期事项共享 lastBlockId', () => {
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
- {: id="t1" }任务E #任务#
{: id="after-t" }
  - {: id="i1" }多日期事项 @2026-03-06, 2026-03-10
{: id="after-i1" }
- 相关内容
{: id="related" }
  - {: id="link1" }[GitHub](https://github.com)
{: id="after-link1" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    expect(project!.tasks[0].items).toHaveLength(2);
    // 所有展开的 Item 应该有相同的 lastBlockId
    expect(project!.tasks[0].items[0].lastBlockId).toBe('after-link1');
    expect(project!.tasks[0].items[1].lastBlockId).toBe('after-link1');
  });

  it('事项是文档最后一个：lastBlockId 正确记录', () => {
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
- {: id="t1" }任务F #任务#
{: id="after-t" }
  - {: id="i1" }最后一个事项 @2026-03-30
{: id="after-i1" }
- 相关内容1
{: id="content1" }
- 相关内容2
{: id="content2" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    expect(project!.tasks[0].items).toHaveLength(1);
    expect(project!.tasks[0].items[0].blockId).toBe('after-i1');
    expect(project!.tasks[0].items[0].lastBlockId).toBe('content2');
  });

  it('事项和事项相关内容都是文本块：lastBlockId 正确记录', () => {
    // 场景：事项本身是普通文本块（不是列表项），事项相关内容也是普通文本块
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
- {: id="t1" }任务G #任务#
{: id="after-t" }
完成首页原型设计 @2026-03-26 10:00:00~12:00:00
{: id="item-block" }
事项内容1
{: id="content1" }
事项内容2
{: id="content2" }
评审会议 @2026-03-26 14:00:00~15:00:00 #已放弃
{: id="next-item" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    // 应该解析出2个事项（完成首页原型设计、评审会议）
    expect(project!.tasks[0].items).toHaveLength(2);
    
    // 第一个事项（完成首页原型设计）
    expect(project!.tasks[0].items[0].content).toBe('完成首页原型设计');
    expect(project!.tasks[0].items[0].blockId).toBe('item-block');
    // lastBlockId 应该指向事项内容2（content2）
    expect(project!.tasks[0].items[0].lastBlockId).toBe('content2');
    
    // 第二个事项（评审会议）
    expect(project!.tasks[0].items[1].content).toBe('评审会议');
    expect(project!.tasks[0].items[1].blockId).toBe('next-item');
    // 没有相关内容，lastBlockId 等于 blockId
    expect(project!.tasks[0].items[1].lastBlockId).toBe('next-item');
  });
});

describe('parseKramdown Emoji 标记解析', () => {
  it('📋 Emoji 任务标记：正确解析任务', () => {
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
- {: id="t1" updated="123"}任务 📋
{: id="after-t" }
  - {: id="i1" }事项内容 📅2026-03-10
{: id="after-i" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    // 验证任务名（去除📋标记）
    expect(project!.tasks[0].name.trim()).toBe('任务');
    expect(project!.tasks[0].items).toHaveLength(1);
    expect(project!.tasks[0].items[0].content.trim()).toContain('事项内容');
    expect(project!.tasks[0].items[0].date).toBe('2026-03-10');
  });

  it('📅 Emoji 日期标记：正确解析日期', () => {
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
- {: id="t1" updated="123"}任务 📋
{: id="after-t" }
  - {: id="i1" updated="456"}Emoji日期事项 📅2026-04-01
{: id="after-i" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks[0].items[0].date).toBe('2026-04-01');
  });

  it('✅ Emoji 完成标记：正确解析已完成状态', () => {
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
- {: id="t1" updated="123"}任务 📋
{: id="after-t" }
  - {: id="i1" updated="456"}已完成事项 📅2026-04-02 ✅
{: id="after-i" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks[0].items[0].status).toBe('completed');
  });

  it('❌ Emoji 放弃标记：正确解析已放弃状态', () => {
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
- {: id="t1" updated="123"}任务 📋
{: id="after-t" }
  - {: id="i1" updated="456"}已放弃事项 📅2026-04-03 ❌
{: id="after-i" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks[0].items[0].status).toBe('abandoned');
  });

  it('混合使用 Emoji 和文字标记：向后兼容', () => {
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
- {: id="t1" updated="123"}混合任务 #任务
{: id="after-t" }
  - {: id="i1" updated="456"}混合事项 @2026-04-04 #done
{: id="after-i1" }
  - {: id="i2" updated="789"}Emoji事项 📅2026-04-05 ✅
{: id="after-i2" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    expect(project!.tasks[0].items).toHaveLength(2);
    expect(project!.tasks[0].items[0].status).toBe('completed');
    expect(project!.tasks[0].items[1].status).toBe('completed');
  });

  it('多日期 Emoji 标记：正确解析多日期', () => {
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
- {: id="t1" updated="123"}任务 📋
{: id="after-t" }
  - {: id="i1" updated="456"}多日期事项 📅2026-05-01, 2026-05-02, 2026-05-03
{: id="after-i" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks[0].items).toHaveLength(3);
    expect(project!.tasks[0].items[0].date).toBe('2026-05-01');
    expect(project!.tasks[0].items[1].date).toBe('2026-05-02');
    expect(project!.tasks[0].items[2].date).toBe('2026-05-03');
  });

  it('日期范围 Emoji 标记：正确解析日期范围', () => {
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
- {: id="t1" updated="123"}任务 📋
{: id="after-t" }
  - {: id="i1" updated="456"}出差事项 📅2026-06-01~2026-06-03
{: id="after-i" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    expect(project).not.toBeNull();
    expect(project!.tasks[0].items).toHaveLength(3);
    expect(project!.tasks[0].items[0].date).toBe('2026-06-01');
    expect(project!.tasks[0].items[1].date).toBe('2026-06-02');
    expect(project!.tasks[0].items[2].date).toBe('2026-06-03');
  });
});
