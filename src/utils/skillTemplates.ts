/**
 * 技能模板管理
 * 包含内置技能定义和技能文档生成
 */

import type { BuiltinSkill, ParsedSkill } from '@/types/skill';

// 导入内置技能文件内容（Vite 会处理 .md 导入）
import dailyReportContent from '@/builtin-skills/daily-report.md?raw';

/**
 * 内置日报技能
 */
export const BUILTIN_DAILY_REPORT_SKILL: BuiltinSkill = {
  id: 'builtin-daily-report',
  name: '日报生成',
  description: '根据今日任务完成情况自动生成日报，包括已完成事项、待办事项、番茄钟统计等',
  version: '1.0.0',
  author: 'System',
  content: dailyReportContent
};

/**
 * 所有内置技能（以名称为索引）
 */
export const BUILTIN_SKILLS: Record<string, BuiltinSkill> = {
  '日报生成': BUILTIN_DAILY_REPORT_SKILL,
  'daily-report': BUILTIN_DAILY_REPORT_SKILL,
};

/**
 * 检查是否为内置技能
 */
export function isBuiltinSkill(name: string): boolean {
  return name in BUILTIN_SKILLS;
}

/**
 * 获取内置技能定义
 */
export function getBuiltinSkill(name: string): BuiltinSkill | null {
  return BUILTIN_SKILLS[name] || null;
}

/**
 * 获取所有内置技能列表
 */
export function getAllBuiltinSkills(): BuiltinSkill[] {
  // 去重，只返回中文名称的技能
  const seen = new Set<string>();
  return Object.values(BUILTIN_SKILLS).filter(skill => {
    if (seen.has(skill.name)) return false;
    seen.add(skill.name);
    return true;
  });
}

/**
 * 默认技能文档模板
 */
export const DEFAULT_SKILL_TEMPLATE = `---
name: {{skillName}}
description: {{description}}
version: 1.0.0
author: {{author}}
tags: []
---

# {{skillName}}

## 概述

{{description}}

## 使用场景

- 场景1：...
- 场景2：...

## 工作流程

1. **分析需求** - 理解用户的具体要求
2. **执行任务** - 按照技能规范执行
3. **输出结果** - 返回执行结果

## 示例

### 示例1

**输入：**
用户输入内容...

**输出：**
技能执行结果...

## 注意事项

- 注意点1
- 注意点2
`;

/**
 * 生成技能文档内容（空白模板）
 */
export function generateSkillDocument(
  skillName: string,
  description: string,
  author: string
): string {
  return DEFAULT_SKILL_TEMPLATE
    .replace(/{{skillName}}/g, skillName)
    .replace(/{{description}}/g, description)
    .replace(/{{author}}/g, author);
}

/**
 * 基于内置技能模板创建自定义版本
 */
export function generateSkillDocumentFromTemplate(
  skillName: string,
  description: string,
  author: string,
  templateContent: string
): string {
  // 提取模板的 YAML frontmatter
  const frontmatterMatch = templateContent.match(/^---\n([\s\S]*?)\n---/);
  
  if (!frontmatterMatch) {
    // 如果没有 frontmatter，使用默认模板
    return generateSkillDocument(skillName, description, author);
  }
  
  // 替换 frontmatter 中的字段
  const newFrontmatter = frontmatterMatch[1]
    .replace(/^name:.*$/m, `name: ${skillName}`)
    .replace(/^description:.*$/m, `description: ${description}`)
    .replace(/^author:.*$/m, `author: ${author}`);
  
  // 构建新文档
  const body = templateContent.slice(frontmatterMatch[0].length);
  return `---\n${newFrontmatter}\n---${body}`;
}

/**
 * 解析技能内容（简易版，完整版在 skillParser.ts）
 */
export function parseSkillContent(content: string): ParsedSkill {
  const lines = content.split('\n');
  
  // 查找 frontmatter
  if (lines[0] !== '---') {
    throw new Error('Invalid skill format: missing frontmatter');
  }
  
  const endIndex = lines.findIndex((line, idx) => idx > 0 && line === '---');
  if (endIndex === -1) {
    throw new Error('Invalid skill format: unclosed frontmatter');
  }
  
  // 解析 frontmatter
  const frontmatterLines = lines.slice(1, endIndex);
  const metadata: Record<string, string | string[]> = {};
  
  for (const line of frontmatterLines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    
    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();
    
    // 处理数组（如 tags: ['a', 'b']）
    if (value.startsWith('[') && value.endsWith(']')) {
      try {
        metadata[key] = JSON.parse(value.replace(/'/g, '"'));
      } catch {
        metadata[key] = value;
      }
    } else {
      metadata[key] = value;
    }
  }
  
  // 主体内容
  const bodyContent = lines.slice(endIndex + 1).join('\n').trim();
  
  return {
    metadata: {
      name: metadata.name as string || '未命名',
      description: metadata.description as string || '',
      version: metadata.version as string,
      author: metadata.author as string,
      tags: metadata.tags as string[] || []
    },
    content: bodyContent,
    scripts: [],
    references: []
  };
}
