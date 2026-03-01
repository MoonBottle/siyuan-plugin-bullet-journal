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
   * 解析所有配置目录中的项目文档；目录为空时扫描所有文档
   */
  public async parseAllProjects(): Promise<Project[]> {
    console.log('[Bullet Journal][Parser] 开始解析项目，目录数量:', this.directories.length);
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
          console.error(`[Bullet Journal] Error parsing project document ${doc.id}:`, error);
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

    console.log('[Bullet Journal][Parser] 解析完成，项目总数:', projects.length);

    return projects;
  }

  /**
   * 获取含 #任务 或 #task 标记的文档（目录配置为空时使用）
   * 先查 content 含任务标记的 block，按 root_id 聚合成文档列表
   */
  private async getAllDocs(): Promise<{ id: string; path: string; notebookId: string }[]> {
    console.log('[Bullet Journal][Parser] 目录为空，扫描含 #任务/#task 的文档');
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
      console.log('[Bullet Journal][Parser] 查询到的文档数量:', result.length);
      return result.map((row: any) => ({
        id: row.id,
        path: row.path,
        notebookId: row.notebookId
      }));
    } catch (error) {
      console.error('[Bullet Journal] Failed to get all docs:', error);
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
    console.log('[Bullet Journal][Parser] SQL 查询路径:', directoryPath);
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
      console.log('[Bullet Journal][Parser] 查询到的文档数量:', result.length);
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

      // 解析任务行（包含 #任务，且不是文档里“说明语法”的写法）
      // 若 #任务 只出现在反引号内（如 `#任务`），视为说明文字，不当作任务
      if (content.includes('#任务') && !this.isTagInBackticks(content, '#任务') && !this.isTagInBackticks(content, '#task')) {
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

    // 如果没有项目名，使用文档路径的文件名或文档 ID
    if (!project.name) {
      if (docPath) {
        // 从路径中提取文件名（最后一个 / 后的内容）
        const pathParts = docPath.split('/');
        project.name = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2] || '';
      }
      // 如果还是没有项目名，使用文档 ID
      if (!project.name) {
        project.name = `项目 ${docId.substring(0, 6)}`;
      }
    }

    // 过滤任务数量为 0 的项目
    if (project.tasks.length === 0) {
      return null;
    }

    console.log('[Bullet Journal][Parser] 解析项目:', project.name);
    console.log('[Bullet Journal][Parser]  任务数量:', project.tasks.length);
    console.log('[Bullet Journal][Parser]  项目链接:', project.links?.length || 0);

    return project;
  }

  /**
   * 判断内容中的 tag 是否仅出现在反引号内（说明性文字，如 `#任务`），不当作真实任务标记
   */
  private isTagInBackticks(content: string, tag: string): boolean {
    // 存在 `#任务` 或 `#task` 这种“说明语法”的写法时，不解析为任务
    const inBackticks = new RegExp('`#?' + (tag === '#任务' ? '任务' : 'task') + '`');
    return inBackticks.test(content);
  }

  /**
   * 解析 Kramdown 格式为块列表
   * 每个块包含内容和 blockId
   */
  private parseKramdownBlocks(kramdown: string): KramdownBlock[] {
    const blocks: KramdownBlock[] = [];
    console.log('[Bullet Journal][Parser] 开始解析 Kramdown 块...');

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

    console.log('[Bullet Journal][Parser] 解析到的块数量:', blocks.length);

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

    console.log('[Bullet Journal][Parser] 获取到事项总数:', items.length);

    return items;
  }
}
