import { putFile } from '@/api';
import type { Project, Item, ProjectGroup } from '@/types/models';

export interface McpCache {
  version: 1;
  updatedAt: string;
  groups: Array<{ id: string; name: string }>;
  projects: Array<{
    id: string;
    name: string;
    description: string | undefined;
    path: string;
    groupId: string | undefined;
    taskCount: number;
  }>;
  items: Array<{
    id: string;
    content: string;
    date: string;
    startDateTime: string | undefined;
    endDateTime: string | undefined;
    status: string;
    projectName: string | undefined;
    taskName: string | undefined;
    projectId: string;
    links: Array<{ name: string; url: string }> | undefined;
    pomodoros: Array<{
      id: string;
      date: string;
      startTime: string;
      endTime: string | undefined;
      durationMinutes: number;
      actualDurationMinutes: number | undefined;
      description: string | undefined;
    }>;
  }>;
}

const CACHE_PATH = '/data/storage/petal/siyuan-plugin-bullet-journal/mcp-cache.json';

export async function writeMcpCache(
  projects: Project[],
  items: Item[],
  groups: ProjectGroup[]
): Promise<void> {
  const cache: McpCache = {
    version: 1,
    updatedAt: new Date().toISOString(),
    groups: groups.map(g => ({ id: g.id, name: g.name })),
    projects: projects.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      path: p.path,
      groupId: p.groupId,
      taskCount: p.tasks.length,
    })),
    items: items.map(i => ({
      id: i.id,
      content: i.content,
      date: i.date,
      startDateTime: i.startDateTime,
      endDateTime: i.endDateTime,
      status: i.status,
      projectName: i.project?.name,
      taskName: i.task?.name,
      projectId: i.project?.id ?? i.docId,
      links: i.links,
      pomodoros: (i.pomodoros ?? []).map(p => ({
        id: p.id,
        date: p.date,
        startTime: p.startTime,
        endTime: p.endTime,
        durationMinutes: p.durationMinutes,
        actualDurationMinutes: p.actualDurationMinutes,
        description: p.description,
      })),
    })),
  };

  const blob = new Blob([JSON.stringify(cache)], { type: 'application/json' });
  await putFile(CACHE_PATH, false, blob);
}
