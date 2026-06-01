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
          v-if="isLoaded && mode === 'view'"
          class="bytemd-viewer"
        >
          <Viewer
            :value="content"
            :plugins="plugins"
          />
        </div>
        <div
          v-else-if="isLoaded"
          ref="editorContainerRef"
          class="bytemd-editor"
        >
          <Editor
            :value="content"
            :plugins="plugins"
            :locale="zhHans"
            :mode="editorMode"
            @change="handleChange"
          />
        </div>
        <div
          v-else
          class="bytemd-loading"
        >
          {{ t('common').loading ?? '加载中...' }}
        </div>
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
import { Editor, Viewer } from '@bytemd/vue-next'
import gfm from '@bytemd/plugin-gfm'
import 'bytemd/dist/index.css'
import zhHans from 'bytemd/locales/zh_Hans.json'
import {
  computed,
  nextTick,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue'
import {
  getFile,
  putFile,
} from '@/api'
import SyInput from '@/components/SiyuanTheme/SyInput.vue'
import { t } from '@/i18n'
import { SkillParser } from '@/skills'
import { useSkillStore } from '@/stores/skillStore'

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
const isLoaded = ref(false)
const content = ref('')
const editorContainerRef = ref<HTMLElement>()

const plugins = [gfm()]

const editorMode = computed(() => {
  return props.mode === 'view' ? 'preview' : 'split'
})

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

function handleChange(v: string) {
  content.value = v
}

function refreshCodeMirror() {
  nextTick(() => {
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'))
    }, 100)
  })
}

async function loadSkillContent() {
  if (props.mode === 'create') {
    content.value = '## 工作流程\n\n1. **步骤1** - 描述\n2. **步骤2** - 描述\n'
    isLoaded.value = true
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

    const fileContent = typeof raw === 'string' ? raw : String(raw)
    const result = SkillParser.parse(fileContent)

    form.name = result.metadata.name
    form.description = result.metadata.description
    content.value = result.content
    isLoaded.value = true
  } catch (err) {
    console.error('[SkillEditDialog] Failed to load skill:', err)
    showMessage(t('settings').aiSkills?.skillNotFound ?? '技能文档不存在', 3000, 'error')
  }
}

async function saveSkill() {
  if (!isValid.value) return

  const skillName = form.name.trim()
  const description = form.description.trim()

  isSaving.value = true

  try {
    if (props.mode === 'create') {
      await skillStore.addSkill({
        name: skillName,
        description,
        content: content.value,
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

      const fullContent = frontmatter + content.value

      await putFile(skillFilePath, false, new Blob([fullContent], { type: 'text/markdown' }))

      const existing = skillStore.getSkillByName(skillName)
      if (existing) {
        existing.description = description
        existing.content = content.value
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

watch(isLoaded, (val) => {
  if (val) refreshCodeMirror()
})

onMounted(() => {
  loadSkillContent()
})
</script>

<style lang="scss" scoped>
.skill-edit-dialog {
  padding: 16px;
  min-width: 400px;
  width: 100%;
  box-sizing: border-box;
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
  color: var(--b3-theme-on-background);
  font-weight: 500;
}

.form-error {
  font-size: 12px;
  color: var(--b3-theme-error);
}

.bytemd-loading {
  padding: 16px;
  color: var(--b3-theme-on-background);
  font-size: 13px;
  text-align: center;
}

.bytemd-editor {
  width: 100%;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  overflow: hidden;
}

.bytemd-viewer {
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
  color: var(--b3-theme-on-background);
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

<style lang="scss">
.skill-edit-dialog .bytemd {
  border: none !important;
  height: 400px;
  color: var(--b3-theme-on-background) !important;
  background-color: var(--b3-theme-surface) !important;
}

.skill-edit-dialog .bytemd-toolbar {
  border-bottom: 1px solid var(--b3-theme-surface-lighter) !important;
  background-color: var(--b3-theme-surface) !important;
}

.skill-edit-dialog .bytemd-toolbar-icon {
  color: var(--b3-theme-on-background) !important;
}

.skill-edit-dialog .bytemd-toolbar-icon svg {
  stroke: currentColor !important;
  fill: none !important;
}

.skill-edit-dialog .bytemd-toolbar-icon svg path[fill="currentColor"] {
  fill: currentColor !important;
}

.skill-edit-dialog .bytemd-toolbar-icon:hover {
  background-color: var(--b3-theme-surface-lighter) !important;
}

.skill-edit-dialog .bytemd-toolbar-icon-active {
  color: var(--b3-theme-primary) !important;
}

.skill-edit-dialog .bytemd-toolbar-tab {
  color: var(--b3-theme-on-background) !important;
}

.skill-edit-dialog .bytemd-toolbar-tab-active {
  color: var(--b3-theme-primary) !important;
}

.skill-edit-dialog .bytemd-toolbar-right .bytemd-toolbar-icon:last-child {
  display: none !important;
}

.skill-edit-dialog .bytemd-editor {
  font-size: 14px;
  color: var(--b3-theme-on-background) !important;
  background-color: var(--b3-theme-surface) !important;
}

.skill-edit-dialog .bytemd-status {
  border-top: 1px solid var(--b3-theme-surface-lighter) !important;
  color: var(--b3-theme-on-background) !important;
}

.skill-edit-dialog .CodeMirror {
  font-family: var(--b3-font-code, 'JetBrains Mono', monospace);
  color: var(--b3-theme-on-background) !important;
  background-color: var(--b3-theme-surface) !important;
}

.skill-edit-dialog .CodeMirror-gutters {
  background-color: var(--b3-theme-surface) !important;
  border-right: 1px solid var(--b3-theme-surface-lighter) !important;
}

.skill-edit-dialog .CodeMirror-linenumber {
  color: var(--b3-theme-on-background) !important;
  opacity: 0.5;
}

.skill-edit-dialog .CodeMirror-cursor {
  border-left-color: var(--b3-theme-primary) !important;
}

.skill-edit-dialog .CodeMirror-selected {
  background: rgba(var(--b3-theme-primary-rgb, 0, 0, 0), 0.1) !important;
}

.skill-edit-dialog .CodeMirror-focused .CodeMirror-selected {
  background: rgba(var(--b3-theme-primary-rgb, 0, 0, 0), 0.15) !important;
}

.skill-edit-dialog .bytemd-preview {
  border-left: 1px solid var(--b3-theme-surface-lighter) !important;
  background-color: var(--b3-theme-surface) !important;
}

.skill-edit-dialog .bytemd-preview .markdown-body {
  color: var(--b3-theme-on-background) !important;
}

.skill-edit-dialog .bytemd-split .bytemd-preview {
  border-left: 1px solid var(--b3-theme-surface-lighter) !important;
}

.skill-edit-dialog .bytemd-dropdown {
  background-color: var(--b3-theme-surface) !important;
}

.skill-edit-dialog .bytemd-dropdown-title {
  border-bottom: 1px solid var(--b3-theme-surface-lighter) !important;
  color: var(--b3-theme-on-background) !important;
}

.skill-edit-dialog .bytemd-dropdown-item:hover {
  background-color: var(--b3-theme-surface-lighter) !important;
}

.skill-edit-dialog .bytemd-dropdown-item-title {
  color: var(--b3-theme-on-background) !important;
}
</style>
