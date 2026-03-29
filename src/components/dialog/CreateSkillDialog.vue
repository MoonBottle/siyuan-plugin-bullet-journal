<template>
  <div class="create-skill-dialog">
    <div class="skill-form">
      <!-- 技能名称 -->
      <div class="form-item">
        <label class="form-label">{{ t('slash').skillName }}</label>
        <SyInput 
          v-model="form.name" 
          :placeholder="t('slash').skillNamePlaceholder"
          @blur="validateName"
        />
        <span v-if="errors.name" class="form-error">{{ errors.name }}</span>
        <span v-else-if="isBuiltinName" class="form-hint warning">
          {{ t('slash').willOverrideBuiltin }}
        </span>
      </div>
      
      <!-- 技能描述 -->
      <div class="form-item">
        <label class="form-label">{{ t('slash').skillDescription }}</label>
        <SyTextarea 
          v-model="form.description"
          :placeholder="t('slash').skillDescriptionPlaceholder"
          :rows="4"
        />
        <span v-if="errors.description" class="form-error">{{ errors.description }}</span>
      </div>
      
      <!-- 自动启用 -->
      <div class="form-item form-item-inline">
        <SySwitch v-model="form.autoEnable" />
        <span class="form-label">{{ t('slash').skillAutoEnable }}</span>
      </div>
    </div>

    <!-- 底部按钮 -->
    <div class="action-section">
      <button 
        class="start-btn" 
        :disabled="!isValid || isCreating"
        @click="createSkill"
      >
        {{ isCreating ? t('common').creating : t('common').create }}
      </button>
      <button class="cancel-btn" @click="close">
        {{ t('common').cancel }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { t } from '@/i18n';
import { showMessage } from 'siyuan';
import SyInput from '@/components/SiyuanTheme/SyInput.vue';
import SyTextarea from '@/components/SiyuanTheme/SyTextarea.vue';
import SySwitch from '@/components/SiyuanTheme/SySwitch.vue';
import { useSkillStore } from '@/stores/skillStore';
import { appendBlock } from '@/api';
import { 
  generateSkillDocument, 
  generateSkillDocumentFromTemplate,
  isBuiltinSkill,
  getBuiltinSkill
} from '@/utils/skillTemplates';
import type { SkillConfig } from '@/types/skill';

const props = defineProps<{
  docId: string;
  blockId?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'created', skillId: string): void;
}>();

const skillStore = useSkillStore();

const form = reactive({
  name: '',
  description: '',
  autoEnable: true
});

const errors = reactive({
  name: '',
  description: ''
});

const isCreating = ref(false);

const isBuiltinName = computed(() => isBuiltinSkill(form.name.trim()));

const isValid = computed(() => {
  return form.name.trim().length > 0 && 
         form.description.trim().length > 0 &&
         !errors.name &&
         !errors.description;
});

function validateName() {
  const name = form.name.trim();
  errors.name = '';
  
  if (!name) {
    errors.name = t('slash').skillNameRequired;
    return;
  }
  
  // 检查是否已存在同名技能（非覆盖情况）
  if (!isBuiltinName.value && skillStore.isSkillNameExists(name)) {
    errors.name = t('slash').skillNameExists;
    return;
  }
}

async function createSkill() {
  if (!isValid.value) return;
  
  const skillName = form.name.trim();
  const isBuiltin = isBuiltinSkill(skillName);
  
  // 如果是内置技能，确认覆盖
  if (isBuiltin) {
    const builtin = getBuiltinSkill(skillName);
    const confirmed = confirm(
      t('slash').overrideBuiltinSkill
        .replace('{name}', skillName)
        .replace('{description}', builtin?.description || '')
    );
    if (!confirmed) return;
  }
  
  isCreating.value = true;
  
  try {
    // 1. 生成技能文档内容
    let documentContent: string;
    if (isBuiltin) {
      const builtin = getBuiltinSkill(skillName);
      documentContent = generateSkillDocumentFromTemplate(
        skillName,
        form.description,
        'User',
        builtin?.content || ''
      );
    } else {
      documentContent = generateSkillDocument(
        skillName,
        form.description,
        'User'
      );
    }
    
    // 2. 直接追加到当前文档
    // 在内容前添加技能标题
    const contentToAppend = `## ${skillName}\n\n${documentContent}`;
    await appendBlock('markdown', contentToAppend, props.docId);
    
    // 3. 添加到技能列表（不关联具体文档，因为技能内容直接在当前文档中）
    const skillConfig: SkillConfig = {
      id: `skill-${Date.now()}`,
      docId: props.docId,
      docPath: '', // 不再使用文档路径
      name: skillName,
      description: form.description.trim(),
      enabled: form.autoEnable,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isOverride: isBuiltin,
      isInline: true // 标记为内联技能（直接嵌入在当前文档中）
    };
    
    skillStore.addSkill(skillConfig);
    
    // 4. 显示成功提示
    if (isBuiltin) {
      showMessage(
        t('slash').overrideSuccess.replace('{name}', skillName), 
        3000, 
        'info'
      );
    } else {
      showMessage(t('slash').createSkillSuccess, 3000, 'info');
    }
    
    emit('created', skillConfig.id);
    emit('close');
  } catch (error) {
    console.error('[CreateSkillDialog] Failed to create skill:', error);
    showMessage(t('slash').createSkillFailed, 3000, 'error');
  } finally {
    isCreating.value = false;
  }
}

function close() {
  emit('close');
}
</script>

<style lang="scss" scoped>
.create-skill-dialog {
  padding: 16px;
  min-width: 400px;
  max-width: 480px;
}

.skill-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-item-inline {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.form-label {
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  font-weight: 500;
}

.form-error {
  font-size: 12px;
  color: var(--b3-theme-error);
}

.form-hint {
  font-size: 12px;
  color: var(--b3-theme-on-surface-light);
}

.form-hint.warning {
  color: var(--b3-theme-warning);
}

.action-section {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.start-btn {
  padding: 10px 16px;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary, #fff);
  border: none;
  border-radius: var(--b3-border-radius);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;

  &:hover:not(:disabled) {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.cancel-btn {
  padding: 8px 16px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--b3-theme-surface-lighter);
  }
}
</style>
