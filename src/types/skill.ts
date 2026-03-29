/**
 * AI Skill 类型定义
 * 技能系统核心类型
 */

/**
 * 技能文档元数据（Frontmatter）
 * 存储在文档的 YAML frontmatter 中
 */
export interface SkillMetadata {
  name: string;           // 技能名称（唯一标识）
  description: string;    // 技能描述（用于 AI 选择技能）
  version?: string;       // 版本号
  author?: string;        // 作者
  tags?: string[];        // 标签
}

/**
 * 技能配置（存储在插件设置中）
 */
export interface SkillConfig {
  id: string;             // 技能 ID（使用文档路径或 ID）
  docId: string;          // 思源文档 ID
  docPath: string;        // 文档路径（便于展示）
  name: string;           // 技能名称
  description: string;    // 技能描述
  enabled: boolean;       // 是否启用
  createdAt: number;      // 创建时间
  updatedAt: number;      // 更新时间
  isBuiltin?: boolean;    // 是否为内置技能（仅用于展示，不存储）
  isOverride?: boolean;   // 是否覆盖了内置技能（仅用于展示，不存储）
}

/**
 * 技能执行记录
 * 存储在对应会话文件中，便于关联查看
 */
export interface SkillExecutionRecord {
  id: string;             // 记录 ID
  skillId: string;        // 执行的技能 ID
  skillName: string;      // 技能名称（快照）
  conversationId: string; // 所属对话 ID
  messageId: string;      // 触发执行的消息 ID
  input: string;          // 用户输入
  output: string;         // 技能执行结果
  status: 'running' | 'completed' | 'failed';
  startedAt: number;      // 开始时间
  completedAt?: number;   // 完成时间
  error?: string;         // 错误信息
  tokenUsage?: {          // Token 使用情况
    prompt: number;
    completion: number;
    total: number;
  };
}

/**
 * 简化的执行记录索引（用于快速展示历史）
 */
export interface SkillExecutionSummary {
  id: string;
  skillId: string;
  skillName: string;
  conversationId: string;
  conversationTitle: string;
  status: SkillExecutionRecord['status'];
  startedAt: number;
  completedAt?: number;
}

/**
 * 技能文件结构（解析后的技能内容）
 */
export interface ParsedSkill {
  metadata: SkillMetadata;
  content: string;        // SKILL.md 主体内容
  scripts: SkillScript[]; // 脚本文件
  references: SkillReference[]; // 参考文件
}

export interface SkillScript {
  name: string;
  path: string;
  content: string;
  language: string;
}

export interface SkillReference {
  name: string;
  path: string;
  content: string;
}

/**
 * 技能解析结果（含来源信息）
 */
export interface SkillResolutionResult {
  source: 'user' | 'builtin';
  skill: ParsedSkill;
  isOverride: boolean;  // 是否覆盖了内置技能
}

/**
 * 技能执行上下文
 */
export interface SkillExecutionContext {
  projects: unknown[];
  groups: unknown[];
  items: unknown[];
  userInput: string;
}

/**
 * 技能执行结果
 */
export interface SkillExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

/**
 * 内置技能定义
 */
export interface BuiltinSkill {
  id: string;
  name: string;
  description: string;
  content: string;      // 完整的 SKILL.md 内容
  version: string;
  author: string;
}
