import { describe, expect, it } from 'vitest';
import {
  buildProjectTaskTree,
  filterProjectTaskTree,
  getTaskItemProgress,
} from '@/utils/projectTaskTree';
import type { Item, Project, Task } from '@/types/models';

function item(partial: Partial<Item>): Item {
  return {
    id: partial.id || 'item',
    content: partial.content || '事项',
    date: partial.date || '2026-05-15',
    lineNumber: partial.lineNumber ?? 1,
    docId: partial.docId || 'doc-1',
    blockId: partial.blockId,
    status: partial.status || 'pending',
    priority: partial.priority,
    startDateTime: partial.startDateTime,
    endDateTime: partial.endDateTime,
    links: partial.links,
    focusPlan: partial.focusPlan,
    pomodoros: partial.pomodoros,
  } as Item;
}

function task(partial: Partial<Task>): Task {
  return {
    id: partial.id || 'task',
    name: partial.name || '任务',
    level: partial.level || 'L1',
    items: partial.items || [],
    lineNumber: partial.lineNumber ?? 1,
    docId: partial.docId || 'doc-1',
    blockId: partial.blockId,
    links: partial.links,
  };
}

function project(tasks: Task[]): Project {
  return {
    id: 'project-1',
    name: '项目 Alpha',
    path: '工作安排/2026/项目 Alpha',
    tasks,
    habits: [],
  };
}

describe('projectTaskTree', () => {
  it('按前序 L1/L2/L3 规则构建任务层级', () => {
    const tree = buildProjectTaskTree(project([
      task({ id: 'l1-a', name: '一级 A', level: 'L1' }),
      task({ id: 'l2-a', name: '二级 A', level: 'L2' }),
      task({ id: 'l3-a', name: '三级 A', level: 'L3' }),
      task({ id: 'l1-b', name: '一级 B', level: 'L1' }),
      task({ id: 'l3-b', name: '孤立三级', level: 'L3' }),
      task({ id: 'l2-b', name: '二级 B', level: 'L2' }),
    ]));

    expect(tree.map(node => node.task.id)).toEqual(['l1-a', 'l1-b']);
    expect(tree[0].children.map(node => node.task.id)).toEqual(['l2-a']);
    expect(tree[0].children[0].children.map(node => node.task.id)).toEqual(['l3-a']);
    expect(tree[1].children.map(node => node.task.id)).toEqual(['l3-b', 'l2-b']);
    expect(tree[1].children[0]).toMatchObject({ depth: 1, orphaned: true });
  });

  it('搜索命中任务时保留必要父级并保留命中任务分支', () => {
    const tree = buildProjectTaskTree(project([
      task({ id: 'l1', name: '研发项目', level: 'L1' }),
      task({ id: 'l2', name: '界面改造', level: 'L2' }),
      task({ id: 'l3', name: '右栏详情', level: 'L3', items: [item({ id: 'item-1', content: '事项内容' })] }),
    ]));

    const result = filterProjectTaskTree(tree, '右栏');

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].task.id).toBe('l1');
    expect(result.nodes[0].children[0].task.id).toBe('l2');
    expect(result.nodes[0].children[0].children[0].task.id).toBe('l3');
    expect(result.matchedTaskIds).toEqual(new Set(['l3']));
    expect(result.autoExpandedTaskIds).toEqual(new Set(['l1', 'l2', 'l3']));
  });

  it('搜索命中事项时只显示事项和所属任务父级链路', () => {
    const tree = buildProjectTaskTree(project([
      task({
        id: 'l1',
        name: '一级',
        level: 'L1',
        items: [
          item({ id: 'keep', content: '准备评审材料', priority: 'high' }),
          item({ id: 'hide', content: '其他事项' }),
        ],
      }),
    ]));

    const result = filterProjectTaskTree(tree, '评审');

    expect(result.nodes[0].items.map(row => row.id)).toEqual(['keep']);
    expect(result.matchedItemIds).toEqual(new Set(['keep']));
    expect(result.autoExpandedTaskIds).toEqual(new Set(['l1']));
  });

  it('统计任务事项进度', () => {
    const progress = getTaskItemProgress(task({
      items: [
        item({ id: 'a', status: 'pending' }),
        item({ id: 'b', status: 'completed' }),
        item({ id: 'c', status: 'abandoned' }),
      ],
    }));

    expect(progress).toEqual({
      total: 3,
      completed: 1,
      pending: 1,
      abandoned: 1,
    });
  });
});
