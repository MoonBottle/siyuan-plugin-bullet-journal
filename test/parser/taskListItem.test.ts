/**
 * 任务列表事项解析测试
 * 验证 isTaskList 和 listItemBlockId 的正确性
 */
import { describe, it, expect } from 'vitest';
import { parseKramdown, parseKramdownBlocks } from '@/parser/core';

describe('任务列表事项解析', () => {
  it('应该正确识别任务列表格式并设置 listItemBlockId', () => {
    // 思源实际 kramdown 格式：
    // - 第一行是列表项行内属性（包含 list-item-id）
    // - 第二行缩进是内容块属性（包含 content-id）
    const kramdown = `# 测试项目
{: id="doc-block" type="doc" }
## 任务A #任务
{: id="task-block" }
- {: id="list-item-block" updated="xxx"}[ ] 事项内容 @2026-03-08
  {: id="content-block" updated="yyy"}
{: id="wrapper-block" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    expect(project!.tasks[0].items).toHaveLength(1);
    
    const item = project!.tasks[0].items[0];
    expect(item.content).toBe('事项内容');
    expect(item.isTaskList).toBe(true);
    expect(item.blockId).toBe('content-block');  // 内容块ID（第二行）
    expect(item.listItemBlockId).toBe('list-item-block');  // 列表项块ID（第一行）
  });

  it('已完成的任务列表也应该正确识别', () => {
    const kramdown = `# 测试项目
{: id="doc-block" type="doc" }
## 任务A #任务
{: id="task-block" }
- {: id="list-item-block" updated="xxx"}[x] 已完成事项 @2026-03-08
  {: id="content-block" updated="yyy"}
{: id="wrapper-block" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    expect(project!.tasks[0].items).toHaveLength(1);
    
    const item = project!.tasks[0].items[0];
    expect(item.isTaskList).toBe(true);
    expect(item.blockId).toBe('content-block');
    expect(item.listItemBlockId).toBe('list-item-block');
  });

  it('普通文本事项不应该设置 isTaskList', () => {
    const kramdown = `# 测试项目
{: id="doc-block" type="doc" }
## 任务A #任务
{: id="task-block" }
普通事项内容 @2026-03-08
{: id="content-block" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    expect(project!.tasks[0].items).toHaveLength(1);
    
    const item = project!.tasks[0].items[0];
    expect(item.isTaskList).toBeFalsy();
    expect(item.listItemBlockId).toBeUndefined();
  });

  it('多个任务列表项应该各自有正确的 listItemBlockId', () => {
    const kramdown = `# 测试项目
{: id="doc-block" type="doc" }
## 任务A #任务
{: id="task-block" }
- {: id="list-item-1" updated="a"}[ ] 事项1 @2026-03-08
  {: id="content-1" updated="b"}
{: id="wrapper-1" }
- {: id="list-item-2" updated="c"}[ ] 事项2 @2026-03-09
  {: id="content-2" updated="d"}
{: id="wrapper-2" }
`;
    const project = parseKramdown(kramdown, 'test-doc');
    
    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    expect(project!.tasks[0].items).toHaveLength(2);
    
    const item1 = project!.tasks[0].items[0];
    expect(item1.content).toBe('事项1');
    expect(item1.isTaskList).toBe(true);
    expect(item1.blockId).toBe('content-1');
    expect(item1.listItemBlockId).toBe('list-item-1');
    
    const item2 = project!.tasks[0].items[1];
    expect(item2.content).toBe('事项2');
    expect(item2.isTaskList).toBe(true);
    expect(item2.blockId).toBe('content-2');
    expect(item2.listItemBlockId).toBe('list-item-2');
  });

  // ========== splitIntoBlocks 测试 ==========
  it('splitIntoBlocks 应该正确分割任务列表块', () => {
    const kramdown = `- {: id="list-item-block" updated="xxx"}[ ] 事项内容 @2026-03-08
  {: id="content-block" updated="yyy"}
{: id="wrapper-block" }
`;
    const blocks = parseKramdownBlocks(kramdown);
    
    // 应该分割成两个块：
    // 1. 内容块（包含列表项行和缩进的属性行）
    // 2. wrapper 块（可能被过滤）
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    
    // 第一个块应该包含完整的任务列表内容
    const firstBlock = blocks[0];
    expect(firstBlock.content).toContain('[ ]');
    expect(firstBlock.content).toContain('事项内容');
    // blockId 应该是最后出现的 id（content-block）
    expect(firstBlock.blockId).toBe('content-block');
  });
});
