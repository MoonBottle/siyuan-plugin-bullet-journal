<template>
  <div class="skill-edit-dialog">
    <div class="skill-form">
      <div class="form-item form-item-full">
        <label class="form-label">{{ t('slash').skillName }}</label>
        <SyInput
          v-model="form.name"
          :placeholder="t('slash').skillNamePlaceholder"
          :disabled="mode === 'edit'"
          @blur="validateName"
        />
        <span
          v-if="errors.name"
          class="form-error"
        >{{ errors.name }}</span>
      </div>

      <div class="form-item form-item-full">
        <label class="form-label">{{ t('slash').skillDescription }}</label>
        <SyInput
          v-model="form.description"
          :placeholder="t('slash').skillDescriptionPlaceholder"
          :disabled="mode === 'view'"
        />
      </div>

      <div class="form-item form-item-full">
        <label class="form-label">{{ t('settings').aiSkills?.editSkill ?? '技能内容' }}</label>
        <div
          ref="vditorRef"
          class="vditor-container"
        />
      </div>
    </div>

    <div
      v-if="mode !== 'view'"
      class="action-section"
    >
      <button
        class="start-btn"
        :disabled="!isValid || isSaving"
        @click="saveSkill"
      >
        {{ isSaving ? t('common').saving ?? '保存中...' : t('common').save ?? '保存' }}
      </button>
      <button
        class="cancel-btn"
        @click="close"
      >
        {{ t('common').cancel }}
      </button>
    </div>

    <div
      v-else
      class="action-section"
    >
      <button
        class="cancel-btn"
        @click="close"
      >
        {{ t('common').close ?? '关闭' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { showMessage } from 'siyuan'
import Vditor from 'vditor'
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  ref,
} from 'vue'
import {
  getFile,
  putFile,
} from '@/api'
import SyInput from '@/components/SiyuanTheme/SyInput.vue'
import { t } from '@/i18n'
import { SkillParser } from '@/skills'
import { useSkillStore } from '@/stores/skillStore'
import 'vditor/dist/index.css'

const props = defineProps<{
  skillName: string
  mode: 'create' | 'edit' | 'view'
}>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved'): void
}>()
const PLUGIN_NAME = 'siyuan-plugin-bullet-journal'
const SKILLS_DIR = `/data/storage/petal/${PLUGIN_NAME}/skills`

const skillStore = useSkillStore()

const form = reactive({
  name: '',
  description: '',
})

const errors = reactive({
  name: '',
})

const isSaving = ref(false)
const initialContent = ref('')
const vditorRef = ref<HTMLElement>()
let vditorInstance: Vditor | null = null

const isValid = computed(() => {
  return form.name.trim().length > 0
    && form.description.trim().length > 0
    && !errors.name
})

function validateName() {
  const name = form.name.trim()
  errors.name = ''

  if (!name) {
    errors.name = t('slash').skillNameRequired
    return
  }

  if (props.mode === 'create') {
    const existing = skillStore.getSkillByName(name)
    if (existing && existing.source === 'user') {
      errors.name = t('slash').skillNameExists
    }
  }
}

async function loadSkillContent() {
  if (props.mode === 'create') {
    initialContent.value = '## 工作流程\n\n1. **步骤1** - 描述\n2. **步骤2** - 描述\n'
    return
  }

  const skill = skillStore.getSkillByName(props.skillName)
  if (!skill || !skill.filePath) {
    showMessage(t('settings').aiSkills?.skillNotFound ?? '技能文档不存在', 3000, 'error')
    return
  }

  try {
    const raw = await getFile(skill.filePath)
    if (!raw) {
      showMessage(t('settings').aiSkills?.skillNotFound ?? '技能文档不存在', 3000, 'error')
      return
    }

    const content = typeof raw === 'string' ? raw : String(raw)
    const result = SkillParser.parse(content)

    form.name = result.metadata.name
    form.description = result.metadata.description
    initialContent.value = result.content
  } catch (err) {
    console.error('[SkillEditDialog] Failed to load skill:', err)
    showMessage(t('settings').aiSkills?.skillNotFound ?? '技能文档不存在', 3000, 'error')
  }
}

function initVditor() {
  if (!vditorRef.value) return

  vditorInstance = new Vditor(vditorRef.value, {
    mode: 'wysiwyg',
    toolbar: [
      'headings',
      'bold',
      'italic',
      'strike',
      '|',
      'list',
      'ordered-list',
      'check',
      'quote',
      'code',
      '|',
      'table',
      'link',
      '|',
      'undo',
      'redo',
    ],
    cache: { enable: false },
    preview: { mode: 'editor' },
    customWysiwygToolbar: () => {},
    height: 400,
    after: () => {
      if (initialContent.value) {
        vditorInstance?.setValue(initialContent.value)
      }
      if (props.mode === 'view') {
        vditorInstance?.disabled()
      }
    },
  })
}

async function saveSkill() {
  if (!isValid.value) return

  const skillName = form.name.trim()
  const description = form.description.trim()
  const content = vditorInstance?.getValue() ?? ''

  isSaving.value = true

  try {
    if (props.mode === 'create') {
      await skillStore.addSkill({
        name: skillName,
        description,
        content,
        autoEnable: true,
      })
      showMessage(t('slash').createSkillSuccess, 3000, 'info')
    } else {
      const skillDir = `${SKILLS_DIR}/${skillName}`
      const skillFilePath = `${skillDir}/SKILL.md`

      const frontmatter = [
        '---',
        `name: ${skillName}`,
        `description: ${description}`,
        '---',
        '',
      ].join('\n')

      const fullContent = frontmatter + content

      await putFile(skillFilePath, false, new Blob([fullContent], { type: 'text/markdown' }))

      const existing = skillStore.getSkillByName(skillName)
      if (existing) {
        existing.description = description
        existing.content = content
      }

      showMessage(t('common').save ?? '保存成功', 3000, 'info')
    }

    emit('saved')
    emit('close')
  } catch (error) {
    console.error('[SkillEditDialog] Failed to save skill:', error)
    showMessage(t('slash').createSkillFailed, 3000, 'error')
  } finally {
    isSaving.value = false
  }
}

function close() {
  emit('close')
}

onMounted(async () => {
  await loadSkillContent()
  await nextTick()
  initVditor()
})

onUnmounted(() => {
  vditorInstance?.destroy()
  vditorInstance = null
})
</script>

<style lang="scss" scoped>
.skill-edit-dialog {
  padding: 16px;
  min-width: 400px;
  max-width: 640px;
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

  input {
    width: 100%;
  }
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

.vditor-container {
  width: 100%;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  overflow: hidden;
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
