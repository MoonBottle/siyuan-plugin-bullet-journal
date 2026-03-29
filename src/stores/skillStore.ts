/**
 * Skill Store
 * 管理技能配置状态
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { SkillConfig, SkillExecutionRecord } from '@/types/skill';

// 存储键名
const STORAGE_KEY = 'aiSkills';

export const useSkillStore = defineStore('skill', () => {
  // State
  const skills = ref<SkillConfig[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  
  // Getters
  const enabledSkills = computed(() => 
    skills.value.filter(s => s.enabled)
  );
  
  const builtinOverridden = computed(() => {
    // 检查哪些内置技能被覆盖了
    const overriddenNames = new Set(
      skills.value.filter(s => s.isOverride).map(s => s.name)
    );
    return overriddenNames;
  });
  
  /**
   * 检查技能名称是否已存在
   */
  function isSkillNameExists(name: string, excludeId?: string): boolean {
    return skills.value.some(
      s => s.name === name && (!excludeId || s.id !== excludeId)
    );
  }
  
  /**
   * 加载技能列表
   */
  function loadSkills(savedSkills: SkillConfig[]) {
    skills.value = savedSkills.map(skill => ({
      ...skill,
      isBuiltin: false,
      isOverride: skill.isOverride || false
    }));
  }
  
  /**
   * 添加技能
   */
  function addSkill(skill: SkillConfig) {
    // 检查是否已存在同名技能
    const existingIndex = skills.value.findIndex(s => s.name === skill.name);
    if (existingIndex >= 0) {
      // 更新现有技能
      skills.value[existingIndex] = {
        ...skill,
        updatedAt: Date.now()
      };
    } else {
      skills.value.push(skill);
    }
    
    // 保存到存储
    saveToStorage();
  }
  
  /**
   * 更新技能
   */
  function updateSkill(skillId: string, updates: Partial<SkillConfig>) {
    const index = skills.value.findIndex(s => s.id === skillId);
    if (index >= 0) {
      skills.value[index] = {
        ...skills.value[index],
        ...updates,
        updatedAt: Date.now()
      };
      saveToStorage();
    }
  }
  
  /**
   * 删除技能
   */
  function removeSkill(skillId: string) {
    const index = skills.value.findIndex(s => s.id === skillId);
    if (index >= 0) {
      skills.value.splice(index, 1);
      saveToStorage();
    }
  }
  
  /**
   * 切换技能启用状态
   */
  function toggleSkillEnabled(skillId: string, enabled?: boolean) {
    const skill = skills.value.find(s => s.id === skillId);
    if (skill) {
      skill.enabled = enabled !== undefined ? enabled : !skill.enabled;
      skill.updatedAt = Date.now();
      saveToStorage();
    }
  }
  
  /**
   * 根据 ID 获取技能
   */
  function getSkillById(skillId: string): SkillConfig | undefined {
    return skills.value.find(s => s.id === skillId);
  }
  
  /**
   * 根据名称获取技能
   */
  function getSkillByName(name: string): SkillConfig | undefined {
    return skills.value.find(s => s.name === name);
  }
  
  /**
   * 获取导出数据（用于保存）
   */
  function getExportData(): { skills: SkillConfig[] } {
    return {
      skills: skills.value.map(skill => ({
        id: skill.id,
        docId: skill.docId,
        docPath: skill.docPath,
        name: skill.name,
        description: skill.description,
        enabled: skill.enabled,
        createdAt: skill.createdAt,
        updatedAt: skill.updatedAt,
        isOverride: skill.isOverride
      }))
    };
  }
  
  /**
   * 保存到存储
   */
  function saveToStorage() {
    // 触发事件让插件主程序保存
    const event = new CustomEvent('skill-store-changed', {
      detail: getExportData()
    });
    window.dispatchEvent(event);
  }
  
  /**
   * 从插件加载设置
   */
  async function loadFromPlugin(plugin: any) {
    if (!plugin) return;
    
    try {
      isLoading.value = true;
      const data = await plugin.loadData?.(STORAGE_KEY);
      if (data?.skills) {
        loadSkills(data.skills);
      }
    } catch (err) {
      console.error('[SkillStore] Failed to load:', err);
      error.value = (err as Error).message;
    } finally {
      isLoading.value = false;
    }
  }
  
  /**
   * 保存到插件
   */
  async function saveToPlugin(plugin: any) {
    if (!plugin) return;
    
    try {
      await plugin.saveData?.(STORAGE_KEY, getExportData());
    } catch (err) {
      console.error('[SkillStore] Failed to save:', err);
      error.value = (err as Error).message;
    }
  }
  
  return {
    // State
    skills,
    isLoading,
    error,
    // Getters
    enabledSkills,
    builtinOverridden,
    // Actions
    isSkillNameExists,
    loadSkills,
    addSkill,
    updateSkill,
    removeSkill,
    toggleSkillEnabled,
    getSkillById,
    getSkillByName,
    getExportData,
    loadFromPlugin,
    saveToPlugin
  };
});
