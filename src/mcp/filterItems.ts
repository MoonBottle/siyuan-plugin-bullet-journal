/**
 * filter_items 工具完整实现（纯函数 + execute 编排）
 */
import { SiYuanClient } from './siyuan-client';
import { loadProjectsAndItems } from './dataLoader';
import type { Item, ProjectDirectory } from '@/types/models';

export interface FilterItemsArgs {
  projectId?: string;
  projectIds?: string[];
  groupId?: string;
  startDate?: string;
  endDate?: string;
  status?: 'pending' | 'completed' | 'abandoned';
}

/**
 * 按项目、时间范围、分组、状态筛选事项
 */
export function filterItems(items: Item[], args: FilterItemsArgs): Item[] {
  let filtered = [...items];

  if (args.projectId) {
    filtered = filtered.filter(i => i.project?.id === args.projectId);
  } else if (args.projectIds?.length) {
    const set = new Set(args.projectIds);
    filtered = filtered.filter(i => i.project && set.has(i.project.id));
  } else if (args.groupId) {
    filtered = filtered.filter(i => i.project?.groupId === args.groupId);
  }

  if (args.startDate) {
    filtered = filtered.filter(i => i.date >= args.startDate!);
  }
  if (args.endDate) {
    filtered = filtered.filter(i => i.date <= args.endDate!);
  }
  if (args.status) {
    filtered = filtered.filter(i => i.status === args.status);
  }

  return filtered;
}

export interface FilterItemOutput {
  id: string;
  content: string;
  date: string;
  startDateTime?: string;
  endDateTime?: string;
  status: string;
  projectName?: string;
  taskName?: string;
}

/**
 * 执行 filter_items 的完整流程：加载项目与事项，按 args 过滤并返回输出结构。
 * 供 server 的 filter_items 与集成测试直接调用。
 */
export async function executeFilterItems(
  client: SiYuanClient,
  directories: ProjectDirectory[],
  args: FilterItemsArgs
): Promise<{ items: FilterItemOutput[] }> {
  const { items } = await loadProjectsAndItems(client, directories);
  const filtered = filterItems(items, args);
  const output: FilterItemOutput[] = filtered.map(i => ({
    id: i.id,
    content: i.content,
    date: i.date,
    startDateTime: i.startDateTime,
    endDateTime: i.endDateTime,
    status: i.status,
    projectName: i.project?.name,
    taskName: i.task?.name
  }));
  return { items: output };
}
