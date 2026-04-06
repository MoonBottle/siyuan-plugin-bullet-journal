/**
 * Skill Store
 * 管理技能配置状态（简化版，docId 作为主键）
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { SkillConfig } from '@/types/skill';

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
  
  /**
   * 检查技能名称是否已存在
   */
  function isSkillNameExists(name: string, excludeDocId?: string): boolean {
    return skills.value.some(
      s => s.name === name && (!excludeDocId || s.docId !== excludeDocId)
    );
  }
  
  /**
   * 根据 docId 获取技能
   */
  function getSkillByDocId(docId: string): SkillConfig | undefined {
    return skills.value.find(s => s.docId === docId);
  }
  
  /**
   * 根据名称获取技能
   */
  function getSkillByName(name: string): SkillConfig | undefined {
    return skills.value.find(s => s.name === name);
  }
  
  /**
   * 加载技能列表
   */
  function loadSkills(savedSkills: SkillConfig[]) {
    skills.value = savedSkills;
  }
  
  /**
   * 添加或更新技能（docId 作为主键）
   */
  function addSkill(skill: SkillConfig) {
    const existingIndex = skills.value.findIndex(s => s.docId === skill.docId);
    if (existingIndex >= 0) {
      // 更新现有技能
      skills.value[existingIndex] = {
        ...skill,
        updatedAt: Date.now()
      };
    } else {
      // 添加新技能
      skills.value.push(skill);
    }
    
    // 保存到存储
    saveToStorage();
  }
  
  /**
   * 更新技能（使用 docId 作为标识）
   */
  function updateSkill(docId: string, updates: Partial<SkillConfig>) {
    const index = skills.value.findIndex(s => s.docId === docId);
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
   * 删除技能（使用 docId 作为标识）
   */
  function removeSkill(docId: string) {
    const index = skills.value.findIndex(s => s.docId === docId);
    if (index >= 0) {
      skills.value.splice(index, 1);
      saveToStorage();
    }
  }
  
  /**
   * 切换技能启用状态（使用 docId 作为标识）
   */
  function toggleSkillEnabled(docId: string, enabled?: boolean) {
    const skill = skills.value.find(s => s.docId === docId);
    if (skill) {
      skill.enabled = enabled !== undefined ? enabled : !skill.enabled;
      skill.updatedAt = Date.now();
      saveToStorage();
    }
  }
  
  /**
   * 获取导出数据（用于保存）
   * 简化结构：只存必要字段
   */
  function getExportData(): { skills: SkillConfig[] } {
    return {
      skills: skills.value.map(skill => ({
        docId: skill.docId,
        name: skill.name,
        description: skill.description,
        enabled: skill.enabled,
        createdAt: skill.createdAt,
        updatedAt: skill.updatedAt
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
    // Actions
    isSkillNameExists,
    getSkillByDocId,
    getSkillByName,
    loadSkills,
    addSkill,
    updateSkill,
    removeSkill,
    toggleSkillEnabled,
    getExportData,
    loadFromPlugin,
    saveToPlugin
  };
});
