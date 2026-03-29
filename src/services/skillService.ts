/**
 * 技能服务（简化版）
 * 负责技能的管理和执行
 */

import type { SkillConfig, ParsedSkill, SkillResolutionResult, SkillExecutionContext, SkillExecutionResult } from '@/types/skill';
import { getBuiltinSkill, isBuiltinSkill, getAllBuiltinSkills } from '@/utils/skillTemplates';
import { useSkillStore } from '@/stores/skillStore';
import { getBlockKramdown, getBlockAttrs, createDocWithMd, sql, setBlockAttrs } from '@/api';
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
        docId: builtin.id,
        name: builtin.name,
        description: builtin.description,
        enabled: !isOverridden, // 被覆盖的内置技能不显示为启用
        createdAt: 0,
        updatedAt: 0
      } as SkillConfig;
    });
    
    // 合并：用户技能 + 未被覆盖的内置技能
    const userSkillNames = new Set(userSkills.map(s => s.name));
    const filteredBuiltinSkills = builtinSkills.filter(
      builtin => !userSkillNames.has(builtin.name)
    );
    
    return [...userSkills, ...filteredBuiltinSkills];
  }
  
  /**
   * 获取已启用的技能
   */
  getEnabledSkills(): SkillConfig[] {
    return this.getAllSkills().filter(skill => skill.enabled);
  }
  
  /**
   * 解析技能（简化版：直接读取文档内容）
   */
  async resolveSkill(skillName: string): Promise<SkillResolutionResult> {
    const skillStore = useSkillStore();
    
    // 1. 先查找用户自定义技能
    const userSkill = skillStore.skills.find(s => s.name === skillName);
    if (userSkill) {
      try {
        // 从文档属性和内容获取技能信息
        const parsed = await this.parseSkillFromDoc(userSkill.docId);
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
      // 内置技能直接返回内容
      return {
        source: 'builtin',
        skill: {
          metadata: {
            name: builtin.name,
            description: builtin.description,
            version: builtin.version,
            author: builtin.author,
            tags: []
          },
          content: builtin.content,
          scripts: [],
          references: []
        },
        isOverride: false
      };
    }
    
    throw new Error(`未找到技能: ${skillName}`);
  }
  
  /**
   * 从文档获取技能信息（简化版）
   * 1. 从文档属性读取 name、description
   * 2. 从文档内容读取技能详情
   */
  private async parseSkillFromDoc(docId: string): Promise<ParsedSkill> {
    // 获取文档属性
    const attrs = await getBlockAttrs(docId);
    
    // 获取文档内容
    const response = await getBlockKramdown(docId);
    if (!response?.data?.kramdown) {
      throw new Error('无法获取文档内容');
    }
    
    return {
      metadata: {
        name: attrs['custom-skill-name'] || '未命名',
        description: attrs['custom-skill-description'] || '',
        version: attrs['custom-skill-version'],
        author: attrs['custom-skill-author'],
        tags: []
      },
      content: response.data.kramdown,
      scripts: [],
      references: []
    };
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
      const sourceTag = this.isBuiltinSkill(skill.name) ? '[内置]' : '[自定义]';
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
   * 检查是否为内置技能
   */
  private isBuiltinSkill(name: string): boolean {
    return isBuiltinSkill(name);
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
    notebook: string,
    parentPath: string
  ): Promise<SkillConfig | null> {
    const builtin = getBuiltinSkill(builtinName);
    if (!builtin) {
      showMessage(`内置技能 "${builtinName}" 不存在`, 3000, 'error');
      return null;
    }
    
    try {
      // 创建文档
      const docPath = `${parentPath}/${builtinName}`;
      const docId = await createDocWithMd(notebook, docPath, builtin.content);
      
      if (!docId) {
        throw new Error('创建文档失败');
      }
      
      // 设置文档属性
      await setBlockAttrs(docId, {
        'custom-skill-name': builtinName,
        'custom-skill-description': builtin.description,
        'custom-skill-version': builtin.version,
        'custom-skill-author': 'User'
      });
      
      // 添加到技能列表
      const skillStore = useSkillStore();
      const skillConfig: SkillConfig = {
        docId,
        name: builtinName,
        description: builtin.description,
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      skillStore.addSkill(skillConfig);
      
      showMessage(`已创建 "${builtinName}" 的自定义版本`, 3000, 'info');
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
