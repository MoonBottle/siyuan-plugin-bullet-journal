/**
 * 从思源加载项目与事项（共享数据层）
 */
import { SiYuanClient } from './siyuan-client';
import { loadPluginSettingsFromSiYuan, PLUGIN_NAME } from './config';
import { parseKramdown } from '../parser/core';
import type { Project, Item, ProjectDirectory } from '@/types/models';

/**
 * 从思源读取最新插件配置。每次工具调用时使用，确保思源中修改设置后能立即生效。
 */
export async function loadSettings(client: SiYuanClient) {
  return loadPluginSettingsFromSiYuan(client, PLUGIN_NAME);
}

const SQL_GET_ALL_PROJECT_DOCS = `
  SELECT id, hpath as path, box as notebookId
  FROM blocks
  WHERE type = 'd'
  AND id IN (
    SELECT DISTINCT root_id FROM blocks
    WHERE (content LIKE '%#任务%' OR content LIKE '%#task%')
    AND root_id IS NOT NULL AND root_id != ''
    AND type IN ('p', 'h', 'l', 'i')
  )
  ORDER BY updated DESC
  LIMIT 1000
`;

function buildSqlGetProjectDocsByPath(dirPath: string): string {
  return `
    SELECT id, hpath as path, box as notebookId
    FROM blocks
    WHERE type = 'd'
    AND hpath LIKE '%${dirPath}%'
    ORDER BY updated DESC
  `;
}

/**
 * 从思源加载项目与事项（与 list_projects / filter_items 内部逻辑一致）
 */
export async function loadProjectsAndItems(
  client: SiYuanClient,
  directories: ProjectDirectory[]
): Promise<{ projects: Project[]; items: Item[] }> {
  const enabledDirs = directories.filter(d => d.enabled);
  const projects: Project[] = [];
  const processedDocIds = new Set<string>();

  const getAllDocs = async () => {
    const result = await client.sql(SQL_GET_ALL_PROJECT_DOCS) as { id: string; path: string; notebookId: string }[];
    return result.map(row => ({ id: row.id, path: row.path, notebookId: row.notebookId }));
  };

  const getProjectDocs = async (dirPath: string) => {
    const sqlQuery = buildSqlGetProjectDocsByPath(dirPath);
    const result = await client.sql(sqlQuery) as { id: string; path: string; notebookId: string }[];
    return result.map(row => ({ id: row.id, path: row.path, notebookId: row.notebookId }));
  };

  if (enabledDirs.length === 0) {
    const docs = await getAllDocs();
    for (const doc of docs) {
      if (processedDocIds.has(doc.id)) continue;
      processedDocIds.add(doc.id);
      const kramdown = await client.getBlockKramdown(doc.id);
      if (kramdown) {
        const project = parseKramdown(kramdown, doc.id, undefined, doc.path || doc.notebookId);
        if (project) projects.push(project);
      }
    }
  } else {
    for (const dir of enabledDirs) {
      const docs = await getProjectDocs(dir.path);
      for (const doc of docs) {
        if (processedDocIds.has(doc.id)) continue;
        processedDocIds.add(doc.id);
        const kramdown = await client.getBlockKramdown(doc.id);
        if (kramdown) {
          const project = parseKramdown(kramdown, doc.id, dir.groupId, doc.path || doc.notebookId);
          if (project) projects.push(project);
        }
      }
    }
  }

  const items: Item[] = [];
  for (const project of projects) {
    for (const task of project.tasks) {
      for (const item of task.items) {
        item.task = task;
        item.project = project;
        items.push(item);
      }
      if (task.date && task.items.length === 0) {
        items.push({
          id: task.id,
          content: task.name,
          date: task.date,
          startDateTime: task.startDateTime,
          endDateTime: task.endDateTime,
          task,
          project,
          lineNumber: task.lineNumber,
          docId: project.id,
          blockId: task.blockId,
          status: 'pending'
        });
      }
    }
  }

  return { projects, items };
}
