/**
 * 技能服务（简化版）
 * 负责技能的管理和执行
 */

import type { SkillConfig, ParsedSkill, SkillResolutionResult, SkillExecutionContext, SkillExecutionResult } from '@/types/skill';
import { getBuiltinSkill, isBuiltinSkill, getAllBuiltinSkills } from '@/utils/skillTemplates';
import { useSkillStore } from '@/stores/skillStore';
import { getBlockAttrs, createDocWithMd, sql, setBlockAttrs, exportMdContent } from '@/api';
import { showMessage } from 'siyuan';

/**
 * 技能缓存项
 */
interface SkillCacheItem {
  name: string;
  description: string;
  content: string;
  source: 'builtin' | 'user';
  docId?: string;
}

/**
 * 技能缓存
 */
type SkillCache = Record<string, SkillCacheItem>;

/**
 * 技能服务类
 */
export class SkillService {
  private static instance: SkillService;
  private plugin: any;
  private skillCache: SkillCache = {};
  
  private constructor(plugin: any) {
    this.plugin = plugin;
    this.setupCacheInvalidation();
  }
  
  /**
   * 设置缓存失效监听
   * 当技能列表变更时自动清除缓存
   */
  private setupCacheInvalidation(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('skill-store-changed', () => {
        this.clearSkillCache();
      });
    }
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
   * 获取所有可用技能（包含来源标识）
   */
  getAllSkillsWithSource(): Array<SkillConfig & { source: 'builtin' | 'user' }> {
    const skillStore = useSkillStore();
    const userSkills = skillStore.skills;
    
    // 用户技能标记为 'user'
    const userSkillsWithSource = userSkills.map(skill => ({
      ...skill,
      source: 'user' as const
    }));
    
    // 获取内置技能配置
    const builtinSkills = getAllBuiltinSkills().map(builtin => {
      const isOverridden = userSkills.some(s => s.name === builtin.name);
      
      return {
        docId: builtin.id,
        name: builtin.name,
        description: builtin.description,
        enabled: !isOverridden,
        createdAt: 0,
        updatedAt: 0,
        source: 'builtin' as const
      };
    });
    
    // 合并：用户技能 + 未被覆盖的内置技能
    const userSkillNames = new Set(userSkills.map(s => s.name));
    const filteredBuiltinSkills = builtinSkills.filter(
      builtin => !userSkillNames.has(builtin.name)
    );
    
    return [...userSkillsWithSource, ...filteredBuiltinSkills];
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
    return this.resolveSkillByIdOrName({ skillName });
  }
  
  /**
   * 根据 ID 或名称解析技能
   * @param params.docId 自定义技能的 docId（source 为 'user' 时必填）
   * @param params.skillName 技能名称（source 为 'builtin' 时必填）
   * @param params.source 技能来源：'builtin' 内置技能，'user' 自定义技能
   */
  async resolveSkillByIdOrName(params: { 
    docId?: string; 
    skillName?: string;
    source?: 'builtin' | 'user';
  }): Promise<SkillResolutionResult> {
    const { docId, skillName, source } = params;
    
    // 如果指定了 source，按 source 查找
    if (source === 'user') {
      if (!docId) {
        throw new Error('获取自定义技能详情需要提供 docId');
      }
      return this.resolveUserSkillByDocId(docId);
    }
    
    if (source === 'builtin') {
      if (!skillName) {
        throw new Error('获取内置技能详情需要提供 skillName');
      }
      return this.resolveBuiltinSkill(skillName);
    }
    
    // 如果没有指定 source，尝试自动判断
    // 优先根据 docId 查找自定义技能
    if (docId) {
      const skillStore = useSkillStore();
      const userSkill = skillStore.skills.find(s => s.docId === docId);
      if (userSkill) {
        return this.resolveUserSkillByDocId(docId);
      }
    }
    
    // 最后尝试根据 skillName 查找
    if (skillName) {
      // 先查自定义技能
      const skillStore = useSkillStore();
      const userSkill = skillStore.skills.find(s => s.name === skillName);
      if (userSkill) {
        return this.resolveUserSkillByDocId(userSkill.docId);
      }
      
      // 再查内置技能
      return this.resolveBuiltinSkill(skillName);
    }
    
    throw new Error('获取技能详情需要提供 docId 或 skillName');
  }
  
  /**
   * 根据 docId 解析自定义技能
   */
  private async resolveUserSkillByDocId(docId: string): Promise<SkillResolutionResult> {
    try {
      const parsed = await this.parseSkillFromDoc(docId);
      return {
        source: 'user',
        skill: parsed,
        isOverride: isBuiltinSkill(parsed.metadata.name)
      };
    } catch (error) {
      console.error('[SkillService] Failed to parse user skill:', error);
      throw new Error(`解析用户技能失败: ${(error as Error).message}`);
    }
  }
  
  /**
   * 根据名称解析内置技能
   */
  private resolveBuiltinSkill(skillName: string): Promise<SkillResolutionResult> {
    const builtin = getBuiltinSkill(skillName);
    if (!builtin) {
      throw new Error(`未找到技能: ${skillName}`);
    }
    
    return Promise.resolve({
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
    });
  }
  
  /**
   * 从文档获取技能信息（简化版）
   * 1. 从文档属性读取 name、description
   * 2. 从文档内容读取技能详情（使用 Markdown 格式）
   */
  private async parseSkillFromDoc(docId: string): Promise<ParsedSkill> {
    console.log('[SkillService] parseSkillFromDoc - docId:', docId);
    
    // 获取文档属性
    const attrs = await getBlockAttrs(docId);
    console.log('[SkillService] parseSkillFromDoc - 获取到属性:', attrs);
    
    // 获取文档内容（使用 Markdown 格式导出）
    const response = await exportMdContent(docId);
    console.log('[SkillService] parseSkillFromDoc - 获取到内容长度:', response?.content?.length || 0);
    
    if (!response?.content) {
      throw new Error('无法获取文档内容');
    }
    
    const result = {
      metadata: {
        name: attrs['custom-skill-name'] || '未命名',
        description: attrs['custom-skill-description'] || '',
        version: attrs['custom-skill-version'],
        author: attrs['custom-skill-author'],
        tags: []
      },
      content: response.content,
      scripts: [],
      references: []
    };
    
    console.log('[SkillService] parseSkillFromDoc - 解析结果 name:', result.metadata.name);
    return result;
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
  
  /**
   * 预加载所有技能到内存缓存
   * 并发加载用户技能和内置技能，用户技能优先覆盖
   */
  async preloadAllSkills(): Promise<void> {
    const skillStore = useSkillStore();
    const userSkills = skillStore.skills.filter(s => s.enabled);
    const builtinSkills = getAllBuiltinSkills();
    
    console.log('[SkillService] preloadAllSkills - 用户技能数量:', userSkills.length);
    console.log('[SkillService] preloadAllSkills - 用户技能列表:', userSkills.map(s => s.name));
    console.log('[SkillService] preloadAllSkills - 内置技能数量:', builtinSkills.length);
    
    // 清空缓存
    this.skillCache = {};
    
    // 先加载内置技能
    for (const builtin of builtinSkills) {
      this.skillCache[builtin.name] = {
        name: builtin.name,
        description: builtin.description,
        content: builtin.content,
        source: 'builtin'
      };
    }
    
    // 加载用户技能（覆盖同名内置技能）
    const userSkillPromises = userSkills.map(async (skill) => {
      try {
        console.log('[SkillService] 正在加载用户技能:', skill.name, 'docId:', skill.docId);
        const parsed = await this.parseSkillFromDoc(skill.docId);
        console.log('[SkillService] 用户技能加载成功:', skill.name);
        return {
          name: skill.name,
          description: skill.description,
          content: parsed.content,
          source: 'user' as const,
          docId: skill.docId
        };
      } catch (error) {
        console.error(`[SkillService] Failed to load user skill "${skill.name}":`, error);
        return null;
      }
    });
    
    const loadedUserSkills = await Promise.all(userSkillPromises);
    
    for (const skill of loadedUserSkills) {
      if (skill) {
        this.skillCache[skill.name] = skill;
      }
    }
    
    console.log('[SkillService] Preloaded', Object.keys(this.skillCache).length, 'skills');
    console.log('[SkillService] Cached skills:', Object.keys(this.skillCache));
  }
  
  /**
   * 从缓存获取技能
   * @param name 技能名称
   * @returns 技能缓存项，未找到返回 undefined
   */
  getSkillFromCache(name: string): SkillCacheItem | undefined {
    return this.skillCache[name];
  }
  
  /**
   * 获取所有已缓存的技能名称列表
   */
  getCachedSkillNames(): string[] {
    return Object.keys(this.skillCache);
  }
  
  /**
   * 清除技能缓存
   */
  clearSkillCache(): void {
    this.skillCache = {};
    console.log('[SkillService] Skill cache cleared');
  }
}

// 导出单例方法
export function useSkillService(plugin?: any): SkillService {
  return SkillService.getInstance(plugin);
}
