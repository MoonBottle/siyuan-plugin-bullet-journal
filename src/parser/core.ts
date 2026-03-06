/**
 * 纯解析逻辑
 * 不依赖 API，仅接受字符串输入，供插件和 MCP 共用
 */
import type { Project, Task, Item } from '@/types/models';
import { LineParser } from './lineParser';

export interface KramdownBlock {
  content: string;
  blockId: string;
  raw: string;
}

/**
 * 解析 Kramdown 格式为块列表
 * 每个块包含内容和 blockId
 */
export function parseKramdownBlocks(kramdown: string): KramdownBlock[] {
  const blocks: KramdownBlock[] = [];

  const lines = kramdown.split('\n');
  let currentContent = '';
  let currentRawContent = '';
  let currentBlockId = '';

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (line.startsWith('{:') && line.endsWith('}')) {
      const idMatch = line.match(/\bid="([^"]+)"/);
      if (idMatch) {
        currentBlockId = idMatch[1];

        if (currentContent && !currentContent.includes('type="doc"')) {
          blocks.push({
            content: currentContent,
            blockId: currentBlockId,
            raw: currentRawContent + '\n' + rawLine
          });
        }

        currentContent = '';
        currentRawContent = '';
        currentBlockId = '';
      }
    } else if (line) {
      currentContent = line;
      currentRawContent = rawLine;
    }
  }

  return blocks;
}

/**
 * 去掉思源列表项前的列表标记和行内块属性 {: id="..." updated="..." }，得到纯文本
 * 用于有序/无序列表中的任务行、事项行，避免任务名/事项内容带上前缀
 */
export function stripListAndBlockAttr(line: string): string {
  let s = line
    .replace(/^\s*([-]|\d+\.)\s+/, '') // 列表标记 - 或 1. 等
    .replace(/^\s*\{\:\s*[^}]*\}\s*/, ''); // 块属性 {: ... }
  return s.trim();
}

/**
 * 判断内容中的 tag 是否仅出现在反引号内（说明性文字，如 `#任务`），不当作真实任务标记
 */
function isTagInBackticks(content: string, tag: string): boolean {
  const inBackticks = new RegExp('`#?' + (tag === '#任务' ? '任务' : 'task') + '`');
  return inBackticks.test(content);
}

/**
 * 解析 Kramdown 内容为 Project
 * 纯函数，不依赖 API
 */
export function parseKramdown(
  kramdown: string,
  docId: string,
  groupId?: string,
  docPath?: string
): Project | null {
  const blocks = parseKramdownBlocks(kramdown);

  const project: Project = {
    id: docId,
    name: '',
    description: '',
    tasks: [],
    path: docPath || '',
    groupId: groupId,
    links: []
  };

  let currentTask: Task | null = null;
  let lineNumber = 0;

  for (const block of blocks) {
    lineNumber++;
    const content = block.content.trim();

    if (!content) continue;

    if (content.startsWith('## ')) {
      project.name = content.substring(3).trim();
      continue;
    }

    if (project.name && content.startsWith('> ')) {
      const descContent = content.substring(2).trim();
      project.description = descContent;
      continue;
    }

    if (!currentTask) {
      if (content.includes('](')) {
        const linkMatch = content.match(/\[(.*?)\]\((.*?)\)/);
        if (linkMatch) {
          project.links!.push({ name: linkMatch[1], url: linkMatch[2] });
          continue;
        }
      }

      if (content.includes('http://') || content.includes('https://')) {
        const urlMatch = content.match(/(https?:\/\/\S+)/);
        if (urlMatch) {
          const nameMatch = content.match(/^([^：:]+)[：:]/);
          const linkName = nameMatch ? nameMatch[1].trim() : '链接';
          project.links!.push({ name: linkName, url: urlMatch[1] });
          continue;
        }
      }
    }

    // 解析任务行（包含 #任务 或 #task，且不是反引号内的说明文字）
    const hasTaskTag = content.includes('#任务') || content.includes('#task');
    const notInBackticks = !isTagInBackticks(content, '#任务') && !isTagInBackticks(content, '#task');
    if (hasTaskTag && notInBackticks) {
      if (currentTask) {
        currentTask.docId = docId;
        project.tasks.push(currentTask);
      }
      currentTask = LineParser.parseTaskLine(stripListAndBlockAttr(content), lineNumber);
      if (currentTask) {
        currentTask.blockId = block.blockId;
      }
      continue;
    }

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

    // 解析工作事项（在当前任务下，包含 @ 但不是任务标记）
    if (currentTask && content.includes('@') && !hasTaskTag) {
      // 收集事项下方的链接行
      const itemLinks: Array<{ name: string; url: string }> = [];
      let nextBlockIndex = blocks.indexOf(block) + 1;

      while (nextBlockIndex < blocks.length) {
        const nextBlock = blocks[nextBlockIndex];
        const nextContent = nextBlock.content.trim();

        // 检查是否为链接行（Markdown 链接格式 [名称](URL)）
        // 支持纯链接行或带列表标记的链接行
        const linkMatch = nextContent.match(/\[(.*?)\]\((.*?)\)/);
        if (linkMatch && !nextContent.includes('@')) {
          itemLinks.push({ name: linkMatch[1], url: linkMatch[2] });
          nextBlockIndex++;
        } else {
          // 不是链接行，停止收集
          break;
        }
      }

      const items = LineParser.parseItemLine(
        stripListAndBlockAttr(content),
        lineNumber,
        itemLinks.length > 0 ? itemLinks : undefined
      );
      for (const item of items) {
        item.docId = docId;
        item.blockId = block.blockId;
        currentTask.items.push(item);
      }
    }
  }

  if (currentTask) {
    currentTask.docId = docId;
    project.tasks.push(currentTask);
  }

  if (!project.name) {
    if (docPath) {
      const pathParts = docPath.split('/');
      project.name = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2] || '';
    }
    if (!project.name) {
      project.name = `项目 ${docId.substring(0, 6)}`;
    }
  }

  if (project.tasks.length === 0) {
    return null;
  }

  return project;
}
