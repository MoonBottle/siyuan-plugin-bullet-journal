/**
 * Markdown 解析器
 * 通过思源 API 获取文档 Kramdown 内容并解析（包含 blockId）
 */
import type { Project, Task, Item, ProjectDirectory } from '@/types/models';
import { LineParser } from './lineParser';
import { sql, getDocKramdown } from '@/api';

/**
 * Kramdown 块结构
 */
interface KramdownBlock {
  content: string;      // 块内容
  blockId: string;      // 块 ID
  raw: string;          // 原始文本（包含属性）
}

export class MarkdownParser {
  private directories: ProjectDirectory[];

  constructor(directories?: ProjectDirectory[]) {
    this.directories = directories?.filter(d => d.enabled) || [];
  }

  /**
   * 解析所有配置目录中的项目文档
   */
  public async parseAllProjects(): Promise<Project[]> {
    const projects: Project[] = [];
    const processedDocIds = new Set<string>();

    for (const directory of this.directories) {
      // 获取匹配目录路径的文档
      const docs = await this.getProjectDocs(directory.path);

      for (const doc of docs) {
        // 避免重复处理同一文档
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

    return projects;
  }

  /**
   * 获取所有笔记本中匹配目录路径的文档
   * 扫描所有笔记本，查找路径匹配的文档
   */
  private async getProjectDocs(
    directoryPath: string
  ): Promise<{ id: string; path: string; notebookId: string }[]> {
    try {
      // 使用 SQL 查询获取所有笔记本中匹配路径的文档
      // 不限制 notebook（box），扫描所有笔记本
      const sqlQuery = `
        SELECT id, hpath as path, box as notebookId
        FROM blocks
        WHERE type = 'd'
        AND hpath LIKE '%${directoryPath}%'
        ORDER BY updated DESC
      `;

      const result = await sql(sqlQuery);
      return result.map((row: any) => ({
        id: row.id,
        path: row.path,
        notebookId: row.notebookId
      }));
    } catch (error) {
      console.error('[Bullet Journal] Failed to get project docs:', error);
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
    // 获取文档的 Kramdown 内容（包含 blockId）
    const kramdown = await this.getKramdownContent(docId);

    if (!kramdown) return null;

    // 解析 Kramdown
    return this.parseKramdown(kramdown, docId, notebookId, groupId, docPath);
  }

  /**
   * 通过思源 API 获取文档的 Kramdown 内容
   */
  private async getKramdownContent(docId: string): Promise<string | null> {
    try {
      const result = await getDocKramdown(docId);
      return result?.kramdown || null;
    } catch (error) {
      console.error('[Bullet Journal] Failed to get kramdown content:', error);
      return null;
    }
  }

  /**
   * 解析 Kramdown 内容
   * Kramdown 格式示例：
   * ```
   * 测试任务 #任务#
   * {: id="20260224215844-vv0x97v" updated="20260224215854"}
   *
   * 开发完成 @2026-02-24
   * {: id="20260224215854-u2jvh70" updated="20260224215859"}
   * ```
   */
  private parseKramdown(
    kramdown: string,
    docId: string,
    notebookId: string,
    groupId?: string,
    docPath?: string
  ): Project | null {
    // 解析 Kramdown 为块列表
    const blocks = this.parseKramdownBlocks(kramdown);

    const project: Project = {
      id: docId,
      name: '',
      description: '',
      tasks: [],
      path: docPath || notebookId,
      groupId: groupId,
      links: []
    };

    let currentTask: Task | null = null;
    let lineNumber = 0;

    for (const block of blocks) {
      lineNumber++;
      const content = block.content.trim();

      // 跳过空块
      if (!content) continue;

      // 解析项目名称 (## 开头)
      if (content.startsWith('## ')) {
        project.name = content.substring(3).trim();
        continue;
      }

      // 解析项目描述 (> 开头)
      if (project.name && content.startsWith('> ')) {
        const descContent = content.substring(2).trim();
        project.description = descContent;
        continue;
      }

      // 解析项目级链接（在任务开始之前）
      // 支持格式：
      // 1. [name](url) - Markdown 格式
      // 2. 甘特图：http://... 或 Redmine 甘特图：http://...
      // 3. 任意文本：http://... (包含 URL 的行)
      if (!currentTask) {
        // Markdown 格式链接
        if (content.includes('](')) {
          const linkMatch = content.match(/\[(.*?)\]\((.*?)\)/);
          if (linkMatch) {
            project.links!.push({ name: linkMatch[1], url: linkMatch[2] });
            continue;
          }
        }

        // 包含 URL 的行，作为项目链接
        if (content.includes('http://') || content.includes('https://')) {
          const urlMatch = content.match(/(https?:\/\/\S+)/);
          if (urlMatch) {
            // 尝试提取链接名称（冒号前面的文字）
            const nameMatch = content.match(/^([^：:]+)[：:]/);
            const linkName = nameMatch ? nameMatch[1].trim() : '链接';
            project.links!.push({ name: linkName, url: urlMatch[1] });
            continue;
          }
        }
      }

      // 解析任务行（包含 #任务）
      if (content.includes('#任务')) {
        if (currentTask) {
          currentTask.docId = docId;
          project.tasks.push(currentTask);
        }
        currentTask = LineParser.parseTaskLine(content, lineNumber);
        // 直接设置 blockId
        if (currentTask) {
          currentTask.blockId = block.blockId;
        }
        continue;
      }

      // 解析任务链接（在任务下，Markdown 格式���接）
      if (currentTask && content.includes('](') && !content.includes('@')) {
        const linkMatch = content.match(/\[(.*?)\]\((.*?)\)/);
        if (linkMatch) {
          if (!currentTask.links) {
            currentTask.links = [];
          }
          currentTask.links.push({ name: linkMatch[1], url: linkMatch[2] });
          continue;
        }
      }

      // 解析工作事项（在当前任务下，包含 @ 但不是 #任务）
      if (currentTask && content.includes('@') && !content.includes('#任务')) {
        const item = LineParser.parseItemLine(content, lineNumber);
        if (item) {
          item.docId = docId;
          item.blockId = block.blockId;
          currentTask.items.push(item);
        }
      }
    }

    // 添加最后一个任务
    if (currentTask) {
      currentTask.docId = docId;
      project.tasks.push(currentTask);
    }

    // 如果没有项目名，使用文档 ID
    if (!project.name) {
      project.name = `项目 ${docId.substring(0, 6)}`;
    }

    return project.name ? project : null;
  }

  /**
   * 解析 Kramdown 格式为块列表
   * 每个块包含内容和 blockId
   */
  private parseKramdownBlocks(kramdown: string): KramdownBlock[] {
    const blocks: KramdownBlock[] = [];

    // 分割为行，逐行解析
    const lines = kramdown.split('\n');
    let currentContent = '';
    let currentBlockId = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // 检测属性块 {: ... id="..." ... }
      if (line.startsWith('{:') && line.endsWith('}')) {
        const idMatch = line.match(/\bid="([^"]+)"/);
        if (idMatch) {
          currentBlockId = idMatch[1];

          // 如果有内容且不是文档属性块，添加到列表
          if (currentContent && !currentContent.includes('type="doc"')) {
            blocks.push({
              content: currentContent,
              blockId: currentBlockId,
              raw: currentContent + '\n' + line
            });
          }

          // 重置当前内容
          currentContent = '';
          currentBlockId = '';
        }
      } else if (line) {
        // 非空行，作为内容
        currentContent = line;
      }
    }

    return blocks;
  }

  /**
   * 获取所有工作事项
   */
  public async getAllItems(): Promise<Item[]> {
    const projects = await this.parseAllProjects();
    const items: Item[] = [];

    for (const project of projects) {
      for (const task of project.tasks) {
        // 添加任务下的事项
        for (const item of task.items) {
          item.task = task;
          item.project = project;
          items.push(item);
        }

        // 如果任务有日期但没有事项，将任务本身作为事项
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
            blockId: task.blockId
          });
        }
      }
    }

    return items;
  }
}
