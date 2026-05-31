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
        <span
          v-if="errors.name"
          class="form-error"
        >{{ errors.name }}</span>
        <span
          v-else-if="isBuiltinName"
          class="form-hint warning"
        >
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
        <span
          v-if="errors.description"
          class="form-error"
        >{{ errors.description }}</span>
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
      <button
        class="cancel-btn"
        @click="close"
      >
        {{ t('common').cancel }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { showMessage } from 'siyuan'
import {
  computed,
  reactive,
  ref,
} from 'vue'
import SyInput from '@/components/SiyuanTheme/SyInput.vue'
import SySwitch from '@/components/SiyuanTheme/SySwitch.vue'
import SyTextarea from '@/components/SiyuanTheme/SyTextarea.vue'
import { t } from '@/i18n'
import { useSkillStore } from '@/stores/skillStore'

const props = defineProps<{
  mode: 'existing' | 'new'
  prefilledName?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'created', skillName: string): void
}>()

const skillStore = useSkillStore()

const form = reactive({
  name: props.prefilledName || '',
  description: '',
  autoEnable: true,
})

const errors = reactive({
  name: '',
  description: '',
})

const isCreating = ref(false)

const isBuiltinName = computed(() => {
  const skill = skillStore.getSkillByName(form.name.trim())
  return skill?.source === 'builtin'
})

const isValid = computed(() => {
  return form.name.trim().length > 0
    && form.description.trim().length > 0
    && !errors.name
    && !errors.description
})

function validateName() {
  const name = form.name.trim()
  errors.name = ''

  if (!name) {
    errors.name = t('slash').skillNameRequired
    return
  }

  const existing = skillStore.getSkillByName(name)
  if (existing && existing.source === 'user') {
    errors.name = t('slash').skillNameExists
  }
}

async function createSkill() {
  if (!isValid.value) return

  const skillName = form.name.trim()

  isCreating.value = true

  try {
    const builtinSkill = skillStore.getSkillByName(skillName)
    const isOverride = builtinSkill?.source === 'builtin'

    const content = isOverride
      ? builtinSkill.content
      : `## 工作流程\n\n1. **查询数据** - 描述如何查询数据\n2. **输出结果** - 按格式输出\n`

    await skillStore.addSkill({
      name: skillName,
      description: form.description.trim(),
      content,
      autoEnable: form.autoEnable,
    })

    if (isOverride) {
      showMessage(
        t('slash').overrideSuccess.replace('{name}', skillName),
        3000,
        'info',
      )
    } else {
      showMessage(t('slash').createSkillSuccess, 3000, 'info')
    }

    emit('created', skillName)
    emit('close')
  } catch (error) {
    console.error('[CreateSkillDialog] Failed to create skill:', error)
    showMessage(t('slash').createSkillFailed, 3000, 'error')
  } finally {
    isCreating.value = false
  }
}

function close() {
  emit('close')
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
