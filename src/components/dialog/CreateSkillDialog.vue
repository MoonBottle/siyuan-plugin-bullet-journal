<template>
  <div class="create-skill-dialog">
    <div class="skill-form">
      <!-- 技能名称 -->
      <div class="form-item form-item-full">
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
      <div class="form-item form-item-full">
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
import { showConfirmDialog } from '@/utils/dialog';
import SyInput from '@/components/SiyuanTheme/SyInput.vue';
import SyTextarea from '@/components/SiyuanTheme/SyTextarea.vue';
import SySwitch from '@/components/SiyuanTheme/SySwitch.vue';
import { useSkillStore } from '@/stores/skillStore';
import { getOrCreateTaskAssistantNotebook } from '@/utils/notebookUtils';
import { setBlockAttrs, prependBlock, createDocWithMd, lsNotebooks } from '@/api';
import { 
  generateSkillDocument, 
  generateSkillDocumentFromTemplate,
  isBuiltinSkill,
  getBuiltinSkill
} from '@/utils/skillTemplates';
import type { SkillConfig } from '@/types/skill';

const props = defineProps<{
  mode: 'existing' | 'new';
  docId?: string;
  notebook?: string;
  docPath?: string;
  prefilledName?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'created', docId: string, skillName?: string): void;
}>();

const skillStore = useSkillStore();

const form = reactive({
  name: props.prefilledName || '',
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
    showConfirmDialog(
      t('common').confirmOverride,
      t('slash').overrideBuiltinSkill
        .replace('{name}', skillName)
        .replace('{description}', builtin?.description || ''),
      () => {
        doCreateSkill(skillName, isBuiltin);
      }
    );
    return;
  }
  
  await doCreateSkill(skillName, isBuiltin);
}

async function getTaskAssistantNotebook(): Promise<string> {
  const notebook = await getOrCreateTaskAssistantNotebook();
  if (!notebook) {
    throw new Error('没有可用的笔记本');
  }
  return notebook.id;
}

async function doCreateSkill(skillName: string, isBuiltin: boolean) {
  isCreating.value = true;
  
  try {
    let targetDocId: string;
    
    if (props.mode === 'new') {
      // 新建模式：创建新文档
      const notebook = props.notebook || await getTaskAssistantNotebook();
      const docPath = `AI技能/${skillName}`;
      targetDocId = await createDocWithMd(notebook, docPath, '');
      if (!targetDocId) {
        throw new Error('创建文档失败');
      }
    } else {
      // 已有文档模式：使用传入的 docId
      targetDocId = props.docId!;
    }
    
    // 1. 设置文档自定义属性（name、description）
    await setBlockAttrs(targetDocId, {
      'custom-name': skillName,
      'custom-description': form.description.trim()
    });
    
    // 2. 生成技能文档内容并添加到文档开头
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
    
    // 在文档开头添加技能内容
    await prependBlock('markdown', documentContent, targetDocId);
    
    // 3. 添加到技能列表（docId 作为主键）
    const skillConfig: SkillConfig = {
      docId: targetDocId,
      name: skillName,
      description: form.description.trim(),
      enabled: form.autoEnable,
      createdAt: Date.now(),
      updatedAt: Date.now()
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
    
    // 5. 打开创建的文档并关闭弹框
    console.log('[CreateSkillDialog] Emitting created event:', { targetDocId, skillName });
    emit('created', targetDocId, skillName);
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
  align-items: flex-start;
  gap: 6px;
}

.form-item-full {
  width: 100%;
  
  input,
  textarea {
    width: 100%;
  }
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
