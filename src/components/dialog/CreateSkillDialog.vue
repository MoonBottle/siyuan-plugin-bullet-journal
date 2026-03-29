<template>
  <div class="b3-dialog">
    <div class="b3-dialog__scrim" @click="close"></div>
    <div class="b3-dialog__container" style="width: 520px;">
      <div class="b3-dialog__header">
        <div class="b3-dialog__title">{{ t('slash').createSkillTitle }}</div>
        <button class="b3-dialog__close" @click="close">
          <svg><use xlink:href="#iconClose"></use></svg>
        </button>
      </div>
      <div class="b3-dialog__content">
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
              :rows="3"
            />
            <span v-if="errors.description" class="form-error">{{ errors.description }}</span>
          </div>
          
          <!-- 保存位置 -->
          <div class="form-item">
            <label class="form-label">{{ t('slash').skillSaveLocation }}</label>
            <div class="location-input">
              <SyInput v-model="form.savePath" readonly />
              <SyButton icon="iconFolder" @click="selectLocation" />
            </div>
          </div>
          
          <!-- 自动启用 -->
          <div class="form-item form-item-inline">
            <SySwitch v-model="form.autoEnable" />
            <span class="form-label">{{ t('slash').skillAutoEnable }}</span>
          </div>
        </div>
      </div>
      <div class="b3-dialog__action">
        <button class="b3-button b3-button--cancel" @click="close">
          {{ t('common').cancel }}
        </button>
        <button 
          class="b3-button b3-button--text" 
          :disabled="!isValid"
          @click="createSkill"
        >
          {{ t('common').create }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { t } from '@/i18n';
import { showMessage } from 'siyuan';
import SyInput from '@/components/SiyuanTheme/SyInput.vue';
import SyTextarea from '@/components/SiyuanTheme/SyTextarea.vue';
import SyButton from '@/components/SiyuanTheme/SyButton.vue';
import SySwitch from '@/components/SiyuanTheme/SySwitch.vue';
import { useSkillStore } from '@/stores/skillStore';
import { createDocWithMd, sql } from '@/api';
import { 
  generateSkillDocument, 
  generateSkillDocumentFromTemplate,
  isBuiltinSkill,
  getBuiltinSkill,
  BUILTIN_SKILLS 
} from '@/utils/skillTemplates';
import type { SkillConfig } from '@/types/skill';

const props = defineProps<{
  defaultPath?: string;
}>();

const emit = defineEmits<{
  close: [];
  created: [skillId: string];
}>();

const skillStore = useSkillStore();

const form = reactive({
  name: '',
  description: '',
  savePath: props.defaultPath || 'AI技能/未命名技能',
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
         !errors.description &&
         !isCreating.value;
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

async function selectLocation() {
  // 这里简化处理，实际应该调用思源的目录选择器
  // 暂时让用户手动输入路径
  showMessage('请手动修改路径', 2000, 'info');
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
    
    // 2. 创建思源文档
    const savePath = form.savePath.startsWith('/') 
      ? form.savePath 
      : `/${form.savePath}`;
    
    // 确保路径以 .md 结尾
    const docPath = savePath.endsWith('.md') 
      ? savePath 
      : `${savePath}.md`;
    
    await createDocWithMd(docPath, documentContent);
    
    // 3. 查询创建的文档 ID
    // 延迟一点确保文档已创建
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const pathWithoutExt = docPath.replace(/\.md$/, '');
    const sqlRes = await sql(
      `SELECT id FROM blocks WHERE hpath = '${pathWithoutExt}' AND type = 'd' LIMIT 1`
    );
    const docId = sqlRes?.data?.[0]?.id || '';
    
    if (!docId) {
      throw new Error('无法获取创建的文档 ID');
    }
    
    // 4. 添加到技能列表
    const skillConfig: SkillConfig = {
      id: `skill-${Date.now()}`,
      docId,
      docPath: docPath.replace(/^\//, ''),
      name: skillName,
      description: form.description.trim(),
      enabled: form.autoEnable,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isOverride: isBuiltin
    };
    
    skillStore.addSkill(skillConfig);
    
    // 5. 显示成功提示
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

<style scoped>
.skill-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 0;
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

.location-input {
  display: flex;
  gap: 8px;
}

.location-input :deep(.sy-input) {
  flex: 1;
}
</style>
