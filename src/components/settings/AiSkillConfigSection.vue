<template>
  <SySettingsSection
    icon="iconSparkles"
    :title="t('settings').aiSkills?.title ?? 'AI 技能配置'"
    :description="t('settings').aiSkills?.description ?? '配置 AI 技能文档，让 AI 能够执行特定任务'"
  >
    <!-- 内置技能列表 -->
    <div v-if="builtinSkills.length > 0" class="skill-section">
      <h4 class="skill-section-title">
        {{ t('settings').aiSkills?.builtinSkills ?? '内置技能' }}
        <span class="skill-section-hint">
          {{ t('settings').aiSkills?.builtinHint ?? '（可创建同名文档覆盖）' }}
        </span>
      </h4>
      <div class="custom-list">
        <div 
          v-for="skill in builtinSkills" 
          :key="skill.id" 
          class="custom-item builtin-skill"
        >
          <div class="custom-item-header">
            <div class="custom-item-info">
              <span class="custom-item-name">
                {{ skill.name }}
                <span class="builtin-badge">{{ t('common')?.builtin ?? '内置' }}</span>
              </span>
              <span class="custom-item-desc">{{ skill.description }}</span>
            </div>
            <div class="custom-item-actions">
              <SyButton 
                icon="iconCopy" 
                :text="t('settings').aiSkills?.customize ?? '自定义'"
                @click="createOverrideSkill(skill)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 用户自定义技能列表 -->
    <div class="skill-section">
      <h4 class="skill-section-title">
        {{ t('settings').aiSkills?.customSkills ?? '自定义技能' }}
      </h4>
      <div v-if="userSkills.length === 0" class="skill-empty">
        {{ t('settings').aiSkills?.emptySkills ?? '暂无自定义技能，点击下方按钮添加' }}
      </div>
      <div v-else class="custom-list">
        <div 
          v-for="skill in userSkills" 
          :key="skill.id" 
          :class="['custom-item', { 'is-override': skill.isOverride }]"
        >
          <div class="custom-item-header">
            <div class="custom-item-info">
              <span class="custom-item-name">
                {{ skill.name }}
                <span v-if="skill.isOverride" class="override-badge">
                  {{ t('common')?.overriding ?? '已覆盖' }}
                </span>
                <span v-else-if="!skill.enabled" class="disabled-badge">
                  {{ t('common')?.disabled ?? '已禁用' }}
                </span>
              </span>
              <span class="custom-item-path">{{ skill.docPath }}</span>
            </div>
            <div class="custom-item-actions">
              <SyButton 
                icon="iconEdit" 
                :aria-label="t('settings').aiSkills?.edit ?? '编辑'"
                @click="editSkill(skill)"
              />
              <SyButton 
                icon="iconTrashcan" 
                :aria-label="t('settings').aiSkills?.delete ?? '删除'"
                @click="removeSkill(skill)"
              />
              <SySwitch
                :model-value="skill.enabled"
                @update:model-value="toggleSkillEnabled(skill.id, $event)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 添加技能按钮 -->
    <SySettingsActionButton
      icon="iconAdd"
      :text="t('settings').aiSkills?.addSkill ?? '添加技能文档'"
      @click="showAddSkillDialog"
    />
  </SySettingsSection>
  
  <!-- 添加技能对话框 -->
  <CreateSkillDialog
    v-if="showDialog"
    :default-path="defaultSavePath"
    @close="showDialog = false"
    @created="onSkillCreated"
  />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSkillStore } from '@/stores/skillStore';
import { useSkillService } from '@/services/skillService';
import { getAllBuiltinSkills } from '@/utils/skillTemplates';
import { t } from '@/i18n';
import { showMessage } from 'siyuan';
import { openFileById } from '@/api';
import type { SkillConfig } from '@/types/skill';

import SySettingsSection from './SySettingsSection.vue';
import SySettingsActionButton from './SySettingsActionButton.vue';
import SyButton from '@/components/SiyuanTheme/SyButton.vue';
import SySwitch from '@/components/SiyuanTheme/SySwitch.vue';
import CreateSkillDialog from '@/components/dialog/CreateSkillDialog.vue';

const skillStore = useSkillStore();
const skillService = useSkillService();

const showDialog = ref(false);
const defaultSavePath = ref('AI技能/新技能');

// 内置技能列表
const builtinSkills = computed(() => {
  const userSkillNames = new Set(skillStore.skills.map(s => s.name));
  return getAllBuiltinSkills()
    .filter(builtin => !userSkillNames.has(builtin.name))
    .map(builtin => ({
      id: builtin.id,
      name: builtin.name,
      description: builtin.description,
      isBuiltin: true
    }));
});

// 用户自定义技能列表
const userSkills = computed(() => skillStore.skills);

// 显示添加技能对话框
function showAddSkillDialog() {
  defaultSavePath.value = 'AI技能/新技能';
  showDialog.value = true;
}

// 编辑技能（打开文档）
async function editSkill(skill: SkillConfig) {
  if (!skill.docId) {
    showMessage('无法获取文档ID', 2000, 'error');
    return;
  }
  
  try {
    await openFileById(skill.docId);
  } catch (error) {
    console.error('Failed to open skill document:', error);
    showMessage('打开文档失败', 2000, 'error');
  }
}

// 删除技能
function removeSkill(skill: SkillConfig) {
  const confirmed = confirm(
    (t('settings').aiSkills?.confirmDeleteSkill ?? '确定要删除技能「{name}」吗？')
      .replace('{name}', skill.name)
  );
  
  if (confirmed) {
    skillStore.removeSkill(skill.id);
    showMessage('技能已删除', 2000, 'info');
  }
}

// 切换启用状态
function toggleSkillEnabled(skillId: string, enabled: boolean) {
  skillStore.toggleSkillEnabled(skillId, enabled);
}

// 创建覆盖技能
async function createOverrideSkill(skill: { name: string; description: string }) {
  // 获取第一个可用笔记本
  const notebooks = await skillService.getNotebooks();
  if (!notebooks || notebooks.length === 0) {
    showMessage('没有可用的笔记本', 3000, 'error');
    return;
  }
  
  const result = await skillService.createOverrideSkill(
    skill.name,
    notebooks[0].id,
    'AI技能'
  );
  
  if (result) {
    showMessage(`已创建「${skill.name}」的自定义版本`, 3000, 'info');
  }
}

// 技能创建成功回调
function onSkillCreated(skillId: string) {
  showDialog.value = false;
}
</script>

<style scoped>
.skill-section {
  margin-bottom: 20px;
}

.skill-section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.skill-section-hint {
  font-size: 12px;
  font-weight: normal;
  color: var(--b3-theme-on-surface-light);
}

.custom-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.custom-item {
  background: var(--b3-theme-surface);
  border-radius: 6px;
  padding: 12px;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.custom-item.builtin-skill {
  background: var(--b3-theme-surface-light);
}

.custom-item.is-override {
  border-color: var(--b3-theme-primary-light);
  background: var(--b3-theme-primary-lightest);
}

.custom-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.custom-item-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.custom-item-name {
  font-weight: 500;
  color: var(--b3-theme-on-background);
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.custom-item-path,
.custom-item-desc {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.custom-item-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}

.builtin-badge,
.override-badge,
.disabled-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: normal;
}

.builtin-badge {
  background: var(--b3-theme-surface-lighter);
  color: var(--b3-theme-on-surface-light);
}

.override-badge {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
}

.disabled-badge {
  background: var(--b3-theme-surface-lighter);
  color: var(--b3-theme-on-surface-light);
}

.skill-empty {
  color: var(--b3-theme-on-surface-light);
  font-size: 13px;
  padding: 16px;
  text-align: center;
  background: var(--b3-theme-surface);
  border-radius: 6px;
  margin-bottom: 16px;
}
</style>
