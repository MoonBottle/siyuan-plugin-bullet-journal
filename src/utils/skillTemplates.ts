/**
 * 技能模板管理
 * 包含内置技能定义和技能文档生成
 */

import type { BuiltinSkill } from '@/types/skill';

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
 * 默认技能文档模板（简化版，无 YAML frontmatter）
 * 技能内容直接作为文档内容
 */
export const DEFAULT_SKILL_TEMPLATE = `## 工作流程

1. **查询数据** - 描述如何查询数据
2. **输出结果** - **严格按照如下格式**

\`\`\`plaintext
【项目名】

任务：xx

事项：xxx
\`\`\`
`;

/**
 * 生成技能文档内容（简化模板）
 */
export function generateSkillDocument(
  skillName: string,
  description: string,
  _author: string
): string {
  return DEFAULT_SKILL_TEMPLATE
    .replace(/{{skillName}}/g, skillName)
    .replace(/{{description}}/g, description);
}

/**
 * 基于内置技能模板创建自定义版本
 * 移除 frontmatter，只保留主体内容
 */
export function generateSkillDocumentFromTemplate(
  _skillName: string,
  description: string,
  _author: string,
  templateContent: string
): string {
  // 移除 frontmatter (---...---)
  const contentWithoutFrontmatter = templateContent.replace(/^---\s*\n[\s\S]*?\n---\s*\n*/, '');
  
  // 替换描述占位符
  return contentWithoutFrontmatter.replace(/{{description}}/g, description);
}
