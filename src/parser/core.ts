/**
 * 纯解析逻辑
 * 不依赖 API，仅接受字符串输入，供插件和 MCP 共用
 */
import type { Project, Task, Item, PomodoroRecord } from '@/types/models';
import { LineParser, parseBlockRefs } from './lineParser';

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
      currentContent = currentContent ? currentContent + '\n' + line : line;
      currentRawContent = currentRawContent ? currentRawContent + '\n' + rawLine : rawLine;
    }
  }

  return blocks;
}

/**
 * 去掉思源列表项前的列表标记和行内块属性 {: id="..." updated="..." }，得到纯文本
 * 用于有序/无序列表中的任务行、事项行，避免任务名/事项内容带上前缀
 *
 * 思源笔记的格式特点：
 * - 块属性在列表标记之后、内容之前: "- {: id=\"xxx\"}[ ] 事项内容"
 * - 支持任务列表标记: "[ ]" 未选中, "[x]" 或 "[X]" 已选中
 * - 支持无序列表: "- " 和有序列表: "1. "
 */
export function stripListAndBlockAttr(line: string): string {
  let s = line;
  let hasCompletedTaskList = false;

  // 第一步：去除行首的列表标记（- 或 1.）
  // 匹配: "- "、"1. "、"  - " 等
  s = s.replace(/^\s*([-]|\d+\.)\s*/, '');

  // 第二步：去除块属性 {: ... }
  // 块属性可能在任何位置（行首、行中、行尾），需要全局替换
  s = s.replace(/\{\:\s*[^}]*\}/g, '');

  // 第三步：检测任务列表状态，然后移除标记
  // 匹配: "[ ] "、"[x] "、"[X] " 等（支持空格变化）
  // 如果检测到 [x] 或 [X]，记录状态
  if (s.match(/^\s*\[\s*[xX]\s*\]/)) {
    hasCompletedTaskList = true;
  }
  s = s.replace(/^\s*\[\s*[xX]?\s*\]\s*/, '');

  // 第四步：再次去除可能残留的列表标记
  // 块属性去除后可能暴露出来的 "- " 或 "1. "
  s = s.replace(/^\s*([-]|\d+\.)\s*/, '');

  s = s.trim();

  // 如果原内容有 [x] 标记，添加 #done 标签以便 parseItemLine 解析
  if (hasCompletedTaskList && !s.includes('#done') && !s.includes('#已完成')) {
    s = s + ' #done';
  }

  return s;
}

/**
 * 判断内容中的 tag 是否仅出现在反引号内（说明性文字，如 `#任务`），不当作真实任务标记
 */
function isTagInBackticks(content: string, tag: string): boolean {
  const inBackticks = new RegExp('`#?' + (tag === '#任务' ? '任务' : 'task') + '`');
  return inBackticks.test(content);
}

/**
 * 检查一行是否是下一事项行或任务行（用于停止收集事项链接）
 * 事项行：包含 @YYYY-MM-DD 且非任务标记
 * 任务行：包含 #任务 或 #task
 */
function isNextItemOrTaskLine(content: string): boolean {
  const hasTaskTag = content.includes('#任务') || content.includes('#task');
  const notInBackticks = !isTagInBackticks(content, '#任务') && !isTagInBackticks(content, '#task');
  if (hasTaskTag && notInBackticks) return true;
  if (content.match(/@\d{4}-\d{2}-\d{2}/) && !hasTaskTag) return true;
  return false;
}

/**
 * 检查一行是否是番茄钟行
 */
function isPomodoroLine(line: string): boolean {
  const cleaned = line
    .replace(/^\s*([-]|\d+\.)\s+/, '')  // 列表标记
    .replace(/^\{\:\s*[^}]*\}\s*/, '') // 块属性 {: ... }
    .trim();
  return cleaned.startsWith('🍅');
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
    links: [],
    pomodoros: []
  };

  let currentTask: Task | null = null;
  let currentItem: Item | null = null;
  let lineNumber = 0;
  /** 当前任务是否已遇到第一个事项，用于停止收集任务链接 */
  let hasSeenItemForCurrentTask = false;
  /** 上一个处理的块类型：'project' | 'task' | 'item' | null */
  let lastBlockType: 'project' | 'task' | 'item' | null = null;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    lineNumber++;
    const content = block.content.split('\n')[0].trim();

    if (!content) continue;

    // 检查是否是番茄钟行
    if (isPomodoroLine(content)) {
      // 传入完整块内容以支持多行描述解析
      const pomodoro = LineParser.parsePomodoroLine(block.content, block.blockId);
      if (pomodoro) {
        // 根据上一个块类型决定关联到哪个父级
        if (lastBlockType === 'item' && currentItem) {
          // 关联到当前事项
          if (!currentItem.pomodoros) {
            currentItem.pomodoros = [];
          }
          pomodoro.itemId = currentItem.id;
          currentItem.pomodoros.push(pomodoro);
        } else if (lastBlockType === 'task' && currentTask) {
          // 关联到当前任务
          if (!currentTask.pomodoros) {
            currentTask.pomodoros = [];
          }
          pomodoro.taskId = currentTask.id;
          currentTask.pomodoros.push(pomodoro);
        } else {
          // 关联到项目
          pomodoro.projectId = project.id;
          project.pomodoros!.push(pomodoro);
        }
      }
      continue;
    }

    if (!project.name) {
      if (content.startsWith('# ')) {
        const rawName = content.substring(2).trim();
        const { stripped, links } = parseBlockRefs(rawName);
        project.name = stripped;
        if (links.length > 0) project.links!.push(...links);
        continue;
      }
      if (content.startsWith('## ')) {
        const rawName = content.substring(3).trim();
        const { stripped, links } = parseBlockRefs(rawName);
        project.name = stripped;
        if (links.length > 0) project.links!.push(...links);
        continue;
      }
    }

    if (project.name && content.startsWith('> ')) {
      const rawDesc = content.substring(2).trim();
      const { stripped, links } = parseBlockRefs(rawDesc);
      project.description = stripped;
      if (links.length > 0) project.links!.push(...links);
      lastBlockType = 'project';
      continue;
    }

    if (!currentTask) {
      if (content.includes('](')) {
        const strippedContent = stripListAndBlockAttr(content);
        const linkMatch = strippedContent.match(/\[(.*?)\]\((.*?)\)/);
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
      hasSeenItemForCurrentTask = false;
      currentTask = LineParser.parseTaskLine(stripListAndBlockAttr(content), lineNumber);
      if (currentTask) {
        currentTask.blockId = block.blockId;
        currentTask.pomodoros = [];
      }
      currentItem = null;
      lastBlockType = 'task';
      continue;
    }

    if (currentTask && content.includes('](') && !content.includes('@') && !hasSeenItemForCurrentTask) {
      const strippedContent = stripListAndBlockAttr(content);
      const linkMatch = strippedContent.match(/\[(.*?)\]\((.*?)\)/);
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
      hasSeenItemForCurrentTask = true;
      // 收集事项下方的链接行：当前事项行之后到下一个事项/任务行之间的所有链接行
      // 非链接行（如说明文字）跳过不中断，仅在遇到下一事项/任务行时停止
      const itemLinks: Array<{ name: string; url: string }> = [];
      const blockLines = block.content.split('\n').map(l => l.trim()).filter(Boolean);
      for (let idx = 1; idx < blockLines.length; idx++) {
        const lineContent = blockLines[idx];
        if (isNextItemOrTaskLine(lineContent)) break;
        const strippedLineContent = stripListAndBlockAttr(lineContent);
        const linkMatch = strippedLineContent.match(/\[(.*?)\]\((.*?)\)/);
        if (linkMatch && !lineContent.includes('@')) {
          itemLinks.push({ name: linkMatch[1], url: linkMatch[2] });
        }
      }
      let nextBlockIndex = blocks.indexOf(block) + 1;

      while (nextBlockIndex < blocks.length) {
        const nextBlock = blocks[nextBlockIndex];
        const nextContent = nextBlock.content.split('\n')[0].trim();

        if (isNextItemOrTaskLine(nextContent)) break;

        const strippedNextContent = stripListAndBlockAttr(nextContent);
        const linkMatch = strippedNextContent.match(/\[(.*?)\]\((.*?)\)/);
        if (linkMatch && !nextContent.includes('@')) {
          itemLinks.push({ name: linkMatch[1], url: linkMatch[2] });
        }
        nextBlockIndex++;
      }

      const items = LineParser.parseItemLine(
        stripListAndBlockAttr(content),
        lineNumber,
        itemLinks.length > 0 ? itemLinks : undefined
      );
      for (const item of items) {
        item.docId = docId;
        item.blockId = block.blockId;
        item.pomodoros = [];

        currentTask.items.push(item);
        currentItem = item;
        lastBlockType = 'item';

        // 检查块内是否有行内番茄钟（多行块的情况）
        const blockLines = block.content.split('\n');
        for (let i = 1; i < blockLines.length; i++) {
          const line = blockLines[i].trim();
          if (isPomodoroLine(line)) {
            // 传入完整块内容以支持多行描述解析
            const pomodoro = LineParser.parsePomodoroLine(block.content, block.blockId);
            if (pomodoro) {
              pomodoro.itemId = item.id;
              item.pomodoros.push(pomodoro);
            }
          }
        }
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

  if (project.tasks.length === 0 && project.pomodoros!.length === 0) {
    return null;
  }

  return project;
}
