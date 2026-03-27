/**
 * Markdown 解析器
 * 通过思源 API 获取文档 Kramdown 内容并解析（包含 blockId）
 * 解析逻辑复用 src/parser/core.ts
 */
import type { Project, Item, ProjectDirectory, PomodoroRecord } from '@/types/models';
import { parseKramdown } from './core';
import { sql, getDocKramdown } from '@/api';
import { LineParser } from './lineParser';
import { defaultPomodoroSettings } from '@/settings';

export class MarkdownParser {
  private directories: ProjectDirectory[];

  constructor(directories?: ProjectDirectory[]) {
    this.directories = directories?.filter(d => d.enabled) || [];
  }

  /**
   * 解析所有配置目录中的项目文档；目录为空时扫描所有文档
   */
  public async parseAllProjects(): Promise<Project[]> {
    console.log('[Task Assistant][Parser] 开始解析项目，目录数量:', this.directories.length);
    const projects: Project[] = [];
    const processedDocIds = new Set<string>();

    if (this.directories.length === 0) {
      // 目录配置为空：扫描所有文档
      const docs = await this.getAllDocs();
      for (const doc of docs) {
        if (processedDocIds.has(doc.id)) continue;
        processedDocIds.add(doc.id);
        try {
          const project = await this.parseProjectDocument(
            doc.id,
            doc.notebookId,
            undefined,
            doc.path
          );
          if (project) {
            projects.push(project);
          }
        } catch (error) {
          console.error(`[Task Assistant] Error parsing project document ${doc.id}:`, error);
        }
      }
    } else {
      for (const directory of this.directories) {
        const docs = await this.getProjectDocs(directory.path);
        for (const doc of docs) {
          if (processedDocIds.has(doc.id)) continue;
          processedDocIds.add(doc.id);
          try {
            const project = await this.parseProjectDocument(
              doc.id,
              doc.notebookId,
              directory.groupId,
              doc.path
            );
            if (project) {
              projects.push(project);
            }
          } catch (error) {
            console.error(`[Bullet Journal] Error parsing project document ${doc.id}:`, error);
          }
        }
      }
    }

    console.log('[Task Assistant][Parser] 解析完成，项目总数:', projects.length);

    return projects;
  }

  /**
   * 获取含 #任务 或 #task 标记的文档（目录配置为空时使用）
   * 先查 content 含任务标记的 block，按 root_id 聚合成文档列表
   */
  private async getAllDocs(): Promise<{ id: string; path: string; notebookId: string }[]> {
    console.log('[Task Assistant][Parser] 目录为空，扫描含 #任务/#task 的文档');
    try {
      const sqlQuery = `
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
      const result = await sql(sqlQuery);
      console.log('[Task Assistant][Parser] 查询到的文档数量:', result.length);
      return result.map((row: any) => ({
        id: row.id,
        path: row.path,
        notebookId: row.notebookId
      }));
    } catch (error) {
      console.error('[Task Assistant] Failed to get all docs:', error);
      return [];
    }
  }

  /**
   * 获取所有笔记本中匹配目录路径的文档
   * 扫描所有笔记本，查找路径匹配的文档
   */
  private async getProjectDocs(
    directoryPath: string
  ): Promise<{ id: string; path: string; notebookId: string }[]> {
    console.log('[Task Assistant][Parser] SQL 查询路径:', directoryPath);
    try {
      const sqlQuery = `
        SELECT id, hpath as path, box as notebookId
        FROM blocks
        WHERE type = 'd'
        AND hpath LIKE '%${directoryPath}%'
        ORDER BY updated DESC
      `;

      const result = await sql(sqlQuery);
      console.log('[Bullet Journal][Parser] 查询到的文档数量:', result.length);
      return result.map((row: any) => ({
        id: row.id,
        path: row.path,
        notebookId: row.notebookId
      }));
    } catch (error) {
      console.error('[Task Assistant] Failed to get project docs:', error);
      return [];
    }
  }

  /**
   * 解析单个项目文档
   */
  public async parseProjectDocument(
    docId: string,
    notebookId: string,
    groupId?: string,
    docPath?: string
  ): Promise<Project | null> {
    const kramdown = await this.getKramdownContent(docId);

    if (!kramdown) return null;

    return parseKramdown(kramdown, docId, groupId, docPath || notebookId);
  }

  /**
   * 解析并处理单个文档（含番茄钟属性）
   * 供定向刷新使用
   */
  public async parseAndProcessSingleDocument(
    docId: string,
    notebookId: string,
    groupId: string | undefined,
    docPath: string,
    plugin: any
  ): Promise<Project | null> {
    // 1. 解析文档
    const project = await this.parseProjectDocument(docId, notebookId, groupId, docPath);
    if (!project) return null;

    // 2. 合并番茄钟属性
    await this.mergePomodoroAttrsForSingleProject(project, plugin);

    return project;
  }

  /**
   * 通过思源 API 获取文档的 Kramdown 内容
   */
  private async getKramdownContent(docId: string): Promise<string | null> {
    try {
      const result = await getDocKramdown(docId);
      return result?.kramdown || null;
    } catch (error) {
      console.error('[Task Assistant] Failed to get kramdown content:', error);
      return null;
    }
  }

  /**
   * 流式解析所有项目
   * 每解析完一个项目（包括番茄钟属性）就回调，让用户更快看到更新
   */
  public async parseAllProjectsWithCallback(
    _plugin: any,
    onProjectReady: (project: Project) => void
  ): Promise<void> {
    console.log('[Task Assistant][Parser] 开始流式解析项目，目录数量:', this.directories.length);
    const processedDocIds = new Set<string>();

    if (this.directories.length === 0) {
      // 目录配置为空：扫描所有文档
      const docs = await this.getAllDocs();
      for (const doc of docs) {
        if (processedDocIds.has(doc.id)) continue;
        processedDocIds.add(doc.id);
        try {
          const project = await this.parseAndProcessSingleDocument(
            doc.id,
            doc.notebookId,
            undefined,
            doc.path,
            _plugin
          );
          if (project) {
            onProjectReady(project);
          }
        } catch (error) {
          console.error(`[Task Assistant] Error parsing project document ${doc.id}:`, error);
        }
      }
    } else {
      for (const directory of this.directories) {
        const docs = await this.getProjectDocs(directory.path);
        for (const doc of docs) {
          if (processedDocIds.has(doc.id)) continue;
          processedDocIds.add(doc.id);
          try {
            const project = await this.parseAndProcessSingleDocument(
              doc.id,
              doc.notebookId,
              directory.groupId,
              doc.path,
              _plugin
            );
            if (project) {
              onProjectReady(project);
            }
          } catch (error) {
            console.error(`[Bullet Journal] Error parsing project document ${doc.id}:`, error);
          }
        }
      }
    }

    console.log('[Task Assistant][Parser] 流式解析完成，项目总数:', processedDocIds.size);
  }

  /**
   * 使用 SQL 批量查询项目的番茄钟属性
   * 替代多次 getBlockAttrs 调用，大幅提升性能
   */
  private async fetchPomodoroAttrsByProject(
    docId: string
  ): Promise<Map<string, Record<string, string>>> {
    try {
      const sqlQuery = `
        SELECT block_id as blockId, name, value
        FROM attributes
        WHERE root_id = '${docId}'
          AND name LIKE 'custom-pomodoro-%'
      `;

      const results = await sql(sqlQuery) as Array<{ blockId: string; name: string; value: string }>;

      // 按 blockId 分组
      const attrsMap = new Map<string, Record<string, string>>();
      for (const row of results) {
        if (!attrsMap.has(row.blockId)) {
          attrsMap.set(row.blockId, {});
        }
        attrsMap.get(row.blockId)![row.name] = row.value;
      }

      return attrsMap;
    } catch (error) {
      console.error(`[Task Assistant] Failed to fetch pomodoro attrs for doc ${docId}:`, error);
      return new Map();
    }
  }

  /**
   * 为单个项目合并番茄钟属性
   * 使用 SQL 批量查询替代多次 getBlockAttrs 调用
   */
  private async mergePomodoroAttrsForSingleProject(
    project: Project,
    plugin: any
  ): Promise<void> {
    const pomodoro = plugin?.getSettings?.()?.pomodoro ?? defaultPomodoroSettings;
    const attrPrefix = pomodoro.attrPrefix ?? 'custom-pomodoro';

    // 一次性批量查询所有番茄钟属性
    const attrsMap = await this.fetchPomodoroAttrsByProject(project.id);

    for (const task of project.tasks) {
      // Task 级别番茄钟
      if (task.blockId && attrsMap.has(task.blockId)) {
        const attrs = attrsMap.get(task.blockId)!;
        const attrRecords = LineParser.parsePomodoroAttrs(attrs, task.blockId, attrPrefix);
        if (attrRecords.length > 0) {
          for (const r of attrRecords) {
            r.taskId = task.id;
            r.projectId = project.id;
          }
          task.pomodoros = [...(task.pomodoros || []), ...attrRecords];
        }
      }

      // Item 级别番茄钟
      // Map blockId -> 第一个 item 的 pomodoros 数组（用于多日期事项共享）
      const blockIdToPomodoros = new Map<string, PomodoroRecord[]>();
      for (const item of task.items) {
        if (!item.blockId) continue;

        // 如果已经处理过这个 blockId，共享同一个 pomodoros 数组
        if (blockIdToPomodoros.has(item.blockId)) {
          item.pomodoros = blockIdToPomodoros.get(item.blockId)!;
          continue;
        }

        // 第一次遇到这个 blockId，创建新的 pomodoros 数组
        if (attrsMap.has(item.blockId)) {
          const attrs = attrsMap.get(item.blockId)!;
          const attrRecords = LineParser.parsePomodoroAttrs(attrs, item.blockId, attrPrefix);
          if (attrRecords.length > 0) {
            for (const r of attrRecords) {
              r.itemId = item.id;
              r.taskId = task.id;
              r.projectId = project.id;
            }
            item.pomodoros = [...(item.pomodoros || []), ...attrRecords];
          }
        }
        // 记录这个 blockId 对应的 pomodoros 数组（可能是空数组或 undefined）
        blockIdToPomodoros.set(item.blockId, item.pomodoros || []);
      }
    }
  }

  /**
   * 获取所有工作事项
   */
  public async getAllItems(): Promise<Item[]> {
    const projects = await this.parseAllProjects();
    return this.getAllItemsFromProjects(projects);
  }

  /**
   * 从已有项目中获取所有工作事项
   */
  public getAllItemsFromProjects(projects: Project[]): Item[] {
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
            task: task,
            project: project,
            lineNumber: task.lineNumber,
            docId: project.id,
            blockId: task.blockId,
            status: 'pending'
          });
        }
      }
    }

    console.log('[Task Assistant][Parser] 获取到事项总数:', items.length);

    return items;
  }
}
