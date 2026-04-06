/**
 * 技能文档解析工具
 * 解析思源文档为技能对象
 */

import type { ParsedSkill, SkillMetadata, SkillScript, SkillReference } from '@/types/skill';

/**
 * 解析技能文档内容
 * @param content 文档完整内容
 * @returns 解析后的技能对象
 */
export function parseSkillDocument(content: string): ParsedSkill {
  const lines = content.split('\n');
  
  // 检查 frontmatter
  if (lines[0]?.trim() !== '---') {
    throw new SkillParseError('技能文档格式错误：缺少 YAML frontmatter', 'MISSING_FRONTMATTER');
  }
  
  const frontmatterEndIndex = lines.findIndex((line, idx) => idx > 0 && line.trim() === '---');
  if (frontmatterEndIndex === -1) {
    throw new SkillParseError('技能文档格式错误：frontmatter 未正确关闭', 'UNCLOSED_FRONTMATTER');
  }
  
  // 解析 frontmatter
  const frontmatterLines = lines.slice(1, frontmatterEndIndex);
  const metadata = parseFrontmatter(frontmatterLines);
  
  // 解析主体内容
  const bodyLines = lines.slice(frontmatterEndIndex + 1);
  const { content: bodyContent, scripts, references } = parseBody(bodyLines);
  
  // 验证必需字段
  validateMetadata(metadata);
  
  return {
    metadata,
    content: bodyContent,
    scripts,
    references
  };
}

/**
 * 解析 YAML frontmatter（简易版）
 */
function parseFrontmatter(lines: string[]): SkillMetadata {
  const metadata: Partial<SkillMetadata> = {};
  
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    
    const key = line.slice(0, colonIndex).trim();
    let value: string | string[] = line.slice(colonIndex + 1).trim();
    
    // 去除引号
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    
    // 处理数组
    if (key === 'tags' && value.startsWith('[') && value.endsWith(']')) {
      try {
        value = JSON.parse(value.replace(/'/g, '"')) as string[];
      } catch {
        // 解析失败，保持原样
      }
    }
    
    switch (key) {
      case 'name':
        metadata.name = value as string;
        break;
      case 'description':
        metadata.description = value as string;
        break;

      case 'tags':
        metadata.tags = Array.isArray(value) ? value : [value];
        break;
    }
  }
  
  return metadata as SkillMetadata;
}

/**
 * 解析文档主体
 * 提取脚本和参考文件引用
 */
function parseBody(lines: string[]): { 
  content: string; 
  scripts: SkillScript[]; 
  references: SkillReference[] 
} {
  const scripts: SkillScript[] = [];
  const references: SkillReference[] = [];
  
  // 查找代码块作为脚本
  let inCodeBlock = false;
  let currentBlock: { language: string; content: string[] } | null = null;
  
  const contentLines: string[] = [];
  
  for (const line of lines) {
    const codeBlockMatch = line.match(/^```(\w+)?/);
    
    if (codeBlockMatch) {
      if (!inCodeBlock) {
        // 开始代码块
        inCodeBlock = true;
        currentBlock = {
          language: codeBlockMatch[1] || 'text',
          content: []
        };
      } else {
        // 结束代码块
        inCodeBlock = false;
        if (currentBlock && currentBlock.language !== 'markdown') {
          // 保存为脚本
          scripts.push({
            name: `script-${scripts.length + 1}`,
            path: `scripts/${scripts.length + 1}.${currentBlock.language}`,
            content: currentBlock.content.join('\n'),
            language: currentBlock.language
          });
        }
        currentBlock = null;
      }
      continue;
    }
    
    if (inCodeBlock && currentBlock) {
      currentBlock.content.push(line);
    } else {
      contentLines.push(line);
      
      // 查找参考文件引用 [reference: filename]
      const refMatch = line.match(/\[reference:\s*(.+?)\]/i);
      if (refMatch) {
        references.push({
          name: refMatch[1].trim(),
          path: `references/${refMatch[1].trim()}`,
          content: '' // 内容需要单独加载
        });
      }
    }
  }
  
  return {
    content: contentLines.join('\n').trim(),
    scripts,
    references
  };
}

/**
 * 验证元数据
 */
function validateMetadata(metadata: Partial<SkillMetadata>): void {
  const errors: string[] = [];
  
  if (!metadata.name || metadata.name.trim() === '') {
    errors.push('缺少必需的字段：name');
  }
  
  if (!metadata.description || metadata.description.trim() === '') {
    errors.push('缺少必需的字段：description');
  }
  
  if (errors.length > 0) {
    throw new SkillParseError(`技能文档验证失败：${errors.join('，')}`, 'VALIDATION_ERROR');
  }
}

/**
 * 技能解析错误
 */
export class SkillParseError extends Error {
  code: string;
  
  constructor(message: string, code: string) {
    super(message);
    this.name = 'SkillParseError';
    this.code = code;
  }
}

/**
 * 验证技能文档格式
 * @returns 验证结果
 */
export function validateSkillDocument(content: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  try {
    parseSkillDocument(content);
  } catch (error) {
    if (error instanceof SkillParseError) {
      errors.push(error.message);
    } else {
      errors.push('未知错误：' + (error as Error).message);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 从内容字符串解析技能（用于内置技能）
 * @param content 技能内容字符串
 * @returns 解析后的技能对象
 */
export function parseSkillContent(content: string): ParsedSkill {
  return parseSkillDocument(content);
}

/**
 * 从思源文档解析技能
 * @param docId 思源文档 ID
 * @returns 解析后的技能对象
 */
export async function parseSkillFromSiyuanDocument(
  docId: string, 
  getBlockKramdown: (id: string) => Promise<any>
): Promise<ParsedSkill> {
  const response = await getBlockKramdown(docId);
  if (!response?.data?.kramdown) {
    throw new SkillParseError('无法获取文档内容', 'FETCH_ERROR');
  }
  
  return parseSkillDocument(response.data.kramdown);
}
