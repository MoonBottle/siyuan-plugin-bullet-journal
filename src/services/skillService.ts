/**
 * 技能服务
 * 负责技能的解析、管理和执行（支持用户自定义覆盖内置技能）
 */

import type { SkillConfig, ParsedSkill, SkillResolutionResult, SkillExecutionContext, SkillExecutionResult } from '@/types/skill';
import { getBuiltinSkill, isBuiltinSkill, getAllBuiltinSkills } from '@/utils/skillTemplates';
import { parseSkillDocument, parseSkillContent } from '@/utils/skillParser';
import { useSkillStore } from '@/stores/skillStore';
import { getBlockKramdown, createDocWithMd, sql } from '@/api';
import { showMessage } from 'siyuan';

/**
 * 技能服务类
 */
export class SkillService {
  private static instance: SkillService;
  private plugin: any;
  
  private constructor(plugin: any) {
    this.plugin = plugin;
  }
  
  static getInstance(plugin?: any): SkillService {
    if (!SkillService.instance && plugin) {
      SkillService.instance = new SkillService(plugin);
    }
    if (!SkillService.instance) {
      throw new Error('SkillService not initialized. Call with plugin instance first.');
    }
    return SkillService.instance;
  }
  
  /**
   * 获取所有可用技能（含内置，用户自定义优先）
   */
  getAllSkills(): SkillConfig[] {
    const skillStore = useSkillStore();
    const userSkills = skillStore.skills;
    
    // 获取内置技能配置
    const builtinSkills = getAllBuiltinSkills().map(builtin => {
      const isOverridden = userSkills.some(s => s.name === builtin.name);
      
      return {
        id: builtin.id,
        docId: '',
        docPath: '(内置)',
        name: builtin.name,
        description: builtin.description,
        enabled: !isOverridden, // 被覆盖的内置技能不显示为启用
        createdAt: 0,
        updatedAt: 0,
        isBuiltin: true,
        isOverride: false
      } as SkillConfig;
    });
    
    // 标记用户技能是否覆盖了内置技能
    const userSkillsWithFlag = userSkills.map(skill => ({
      ...skill,
      isOverride: isBuiltinSkill(skill.name)
    }));
    
    // 合并：用户技能 + 未被覆盖的内置技能
    const userSkillNames = new Set(userSkills.map(s => s.name));
    const filteredBuiltinSkills = builtinSkills.filter(
      builtin => !userSkillNames.has(builtin.name)
    );
    
    return [...userSkillsWithFlag, ...filteredBuiltinSkills];
  }
  
  /**
   * 获取已启用的技能
   */
  getEnabledSkills(): SkillConfig[] {
    return this.getAllSkills().filter(skill => skill.enabled);
  }
  
  /**
   * 解析技能（支持用户覆盖内置技能）
   */
  async resolveSkill(skillName: string): Promise<SkillResolutionResult> {
    const skillStore = useSkillStore();
    
    // 1. 先查找用户自定义技能
    const userSkill = skillStore.skills.find(s => s.name === skillName);
    if (userSkill) {
      try {
        // 从思源文档解析
        const parsed = await this.parseSkillFromDocument(userSkill.docId);
        return {
          source: 'user',
          skill: parsed,
          isOverride: isBuiltinSkill(skillName)
        };
      } catch (error) {
        console.error('[SkillService] Failed to parse user skill:', error);
        throw new Error(`解析用户技能失败: ${(error as Error).message}`);
      }
    }
    
    // 2. 查找内置技能
    const builtin = getBuiltinSkill(skillName);
    if (builtin) {
      try {
        const parsed = parseSkillContent(builtin.content);
        return {
          source: 'builtin',
          skill: parsed,
          isOverride: false
        };
      } catch (error) {
        console.error('[SkillService] Failed to parse builtin skill:', error);
        throw new Error(`解析内置技能失败: ${(error as Error).message}`);
      }
    }
    
    throw new Error(`未找到技能: ${skillName}`);
  }
  
  /**
   * 从思源文档解析技能
   */
  private async parseSkillFromDocument(docId: string): Promise<ParsedSkill> {
    const response = await getBlockKramdown(docId);
    if (!response?.data?.kramdown) {
      throw new Error('无法获取文档内容');
    }
    
    return parseSkillDocument(response.data.kramdown);
  }
  
  /**
   * 获取技能内容（用于传递给 AI）
   */
  async getSkillContent(skillName: string): Promise<string> {
    const result = await this.resolveSkill(skillName);
    // 返回完整内容（包含 frontmatter 的说明）
    return `# ${result.skill.metadata.name}\n\n${result.skill.metadata.description}\n\n${result.skill.content}`;
  }
  
  /**
   * 构建技能选择提示词
   */
  buildSkillSelectionPrompt(skills: SkillConfig[]): string {
    const enabledSkills = skills.filter(s => s.enabled);
    
    if (enabledSkills.length === 0) {
      return '';
    }
    
    const skillList = enabledSkills.map(skill => {
      const sourceTag = skill.isBuiltin ? '[内置]' : '[自定义]';
      return `- ${skill.name} ${sourceTag}: ${skill.description}`;
    }).join('\n');
    
    return `## 可用技能

${skillList}

## 使用规则
1. 分析用户意图，判断是否需要使用技能
2. 如果需要技能，选择最匹配的一个
3. 如果不需要技能，直接回答
4. 用户可以通过创建同名文档来覆盖内置技能

## 响应格式
- 直接回答：正常回复内容
- 调用技能：请说明需要使用哪个技能`;
  }
  
  /**
   * 检查技能名称是否可用
   */
  isSkillNameAvailable(name: string): boolean {
    const skillStore = useSkillStore();
    return !skillStore.skills.some(s => s.name === name);
  }
  
  /**
   * 创建技能覆盖
   * 基于内置技能创建用户自定义版本
   */
  async createOverrideSkill(
    builtinName: string, 
    savePath: string
  ): Promise<SkillConfig | null> {
    const builtin = getBuiltinSkill(builtinName);
    if (!builtin) {
      showMessage(`内置技能 "${builtinName}" 不存在`, 3000, 'error');
      return null;
    }
    
    try {
      // 创建文档
      const notebook = '';
      
      const docPath = savePath.startsWith('/') ? savePath : `/${savePath}`;
      const fullPath = `${notebook}${docPath}`;
      
      await createDocWithMd(fullPath, builtin.content);
      
      // 获取创建的文档 ID
      const sqlRes = await sql(`SELECT id FROM blocks WHERE path = '${docPath}.sy' LIMIT 1`);
      const docId = sqlRes?.data?.[0]?.id || '';
      
      // 添加到技能列表
      const skillStore = useSkillStore();
      const skillConfig: SkillConfig = {
        id: `skill-${Date.now()}`,
        docId,
        docPath: savePath,
        name: builtin.name,
        description: builtin.description,
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isOverride: true
      };
      
      skillStore.addSkill(skillConfig);
      
      showMessage(`已创建 "${builtin.name}" 的自定义版本`, 3000, 'info');
      return skillConfig;
    } catch (error) {
      console.error('[SkillService] Failed to create override skill:', error);
      showMessage('创建技能失败', 3000, 'error');
      return null;
    }
  }
}

// 导出单例方法
export function useSkillService(plugin?: any): SkillService {
  return SkillService.getInstance(plugin);
}
