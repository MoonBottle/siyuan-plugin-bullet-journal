<template>
  <div class="chat-input">
    <div class="chat-input__editor">
      <span
        v-for="skill in selectedSkills"
        :key="skill.name"
        class="chat-input__skill-chip"
      >
        <svg class="chat-input__skill-icon"><use xlink:href="#iconSparkles"></use></svg>
        {{ skill.name }}
        <span
          class="chat-input__skill-remove"
          @click="removeSkill(skill.name)"
        >&times;</span>
      </span>
      <textarea
        ref="textareaRef"
        :value="modelValue"
        class="chat-input__textarea"
        :placeholder="placeholder"
        :disabled="disabled"
        rows="1"
        @keydown="handleKeydown"
        @input="handleInput"
      ></textarea>
    </div>

    <div
      v-if="showSkillMenu"
      class="chat-input__skill-menu"
    >
      <div class="chat-input__skill-menu-title">
        技能
      </div>
      <div
        v-for="(skill, index) in filteredSkills"
        :key="skill.name"
        class="chat-input__skill-item"
        :class="{ 'chat-input__skill-item--active': index === activeSkillIndex }"
        @click="selectSkill(skill)"
        @mouseenter="activeSkillIndex = index"
      >
        <div class="chat-input__skill-item-name">
          {{ skill.name }}
        </div>
        <div class="chat-input__skill-item-desc">
          {{ skill.description }}
        </div>
      </div>
      <div
        v-if="filteredSkills.length === 0"
        class="chat-input__skill-empty"
      >
        无匹配技能
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RegisteredSkill } from '@/skills'
import {
  computed,
  nextTick,
  ref,
  watch,
} from 'vue'

const props = defineProps<{
  modelValue?: string
  placeholder?: string
  disabled?: boolean
  skills?: RegisteredSkill[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'send': [content: string, skills: string[]]
}>()

const textareaRef = ref<HTMLTextAreaElement>()
const showSkillMenu = ref(false)
const activeSkillIndex = ref(0)
const slashStartPos = ref(-1)
const selectedSkills = ref<RegisteredSkill[]>([])

const skillQuery = computed(() => {
  if (!showSkillMenu.value || slashStartPos.value < 0) return ''
  return props.modelValue?.slice(slashStartPos.value + 1) ?? ''
})

const filteredSkills = computed(() => {
  const query = skillQuery.value.toLowerCase()
  const allSkills = props.skills ?? []
  const selectedNames = new Set(selectedSkills.value.map((s) => s.name))
  return allSkills
    .filter((s) => s.enabled && !selectedNames.has(s.name))
    .filter((s) => !query || s.name.toLowerCase().includes(query) || s.description.toLowerCase().includes(query))
})

watch(() => filteredSkills.value.length, () => {
  activeSkillIndex.value = 0
})

function handleKeydown(event: KeyboardEvent) {
  if (showSkillMenu.value) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      activeSkillIndex.value = (activeSkillIndex.value + 1) % Math.max(filteredSkills.value.length, 1)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      activeSkillIndex.value = (activeSkillIndex.value - 1 + filteredSkills.value.length) % Math.max(filteredSkills.value.length, 1)
      return
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (filteredSkills.value.length > 0) {
        selectSkill(filteredSkills.value[activeSkillIndex.value])
      }
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      closeSkillMenu()
      return
    }
    if (event.key === 'Backspace') {
      const value = props.modelValue ?? ''
      const cursorPos = textareaRef.value?.selectionStart ?? value.length
      if (slashStartPos.value >= 0 && cursorPos <= slashStartPos.value + 1 && value[cursorPos - 1] === '/') {
        closeSkillMenu()
      }
    }
    return
  }

  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    emit('send', props.modelValue?.trim() || '', selectedSkills.value.map((s) => s.name))
    selectedSkills.value = []
  }

  if (event.key === 'Backspace') {
    const value = props.modelValue ?? ''
    const cursorPos = textareaRef.value?.selectionStart ?? value.length
    if (value === '' && cursorPos === 0 && selectedSkills.value.length > 0) {
      event.preventDefault()
      selectedSkills.value = selectedSkills.value.slice(0, -1)
    }
  }
}

function handleInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  const value = target.value
  emit('update:modelValue', value)

  const cursorPos = target.selectionStart ?? value.length

  if (value[cursorPos - 1] === '/') {
    const charBefore = cursorPos >= 2 ? value[cursorPos - 2] : ' '
    if (charBefore === ' ' || charBefore === '\n' || cursorPos === 1) {
      slashStartPos.value = cursorPos - 1
      showSkillMenu.value = true
      activeSkillIndex.value = 0
    }
  } else if (showSkillMenu.value) {
    if (slashStartPos.value >= 0) {
      const slashToEnd = value.slice(slashStartPos.value, cursorPos)
      if (slashToEnd.includes(' ') || slashToEnd.includes('\n')) {
        closeSkillMenu()
      }
    }
  }

  nextTick(() => {
    const textarea = textareaRef.value
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
    }
  })
}

function selectSkill(skill: RegisteredSkill) {
  if (selectedSkills.value.some((s) => s.name === skill.name)) return

  selectedSkills.value = [...selectedSkills.value, skill]

  if (slashStartPos.value >= 0) {
    const value = props.modelValue ?? ''
    const cursorPos = textareaRef.value?.selectionStart ?? value.length
    const before = value.slice(0, slashStartPos.value)
    const after = value.slice(cursorPos)
    emit('update:modelValue', before + after)
  }

  closeSkillMenu()

  nextTick(() => {
    textareaRef.value?.focus()
  })
}

function removeSkill(name: string) {
  selectedSkills.value = selectedSkills.value.filter((s) => s.name !== name)
}

function closeSkillMenu() {
  showSkillMenu.value = false
  slashStartPos.value = -1
  activeSkillIndex.value = 0
}

watch(() => props.modelValue, (val) => {
  if (!val && showSkillMenu.value) {
    closeSkillMenu()
  }
})

function focus() {
  textareaRef.value?.focus()
}

function getSelectedSkillNames(): string[] {
  return selectedSkills.value.map((s) => s.name)
}

function clearSelectedSkills() {
  selectedSkills.value = []
}

defineExpose({
  focus,
  getSelectedSkillNames,
  clearSelectedSkills,
})
</script>

<style lang="scss" scoped>
.chat-input {
  width: 100%;
  position: relative;

  &__editor {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    min-height: 24px;
  }

  &__skill-chip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--b3-theme-primary-lightest);
    color: var(--b3-theme-primary);
    font-size: 12px;
    line-height: 1.6;
    white-space: nowrap;
    flex-shrink: 0;
  }

  &__skill-icon {
    width: 12px;
    height: 12px;
    fill: var(--b3-theme-primary);
  }

  &__skill-remove {
    cursor: pointer;
    margin-left: 2px;
    font-size: 14px;
    line-height: 1;
    opacity: 0.6;

    &:hover {
      opacity: 1;
    }
  }

  &__textarea {
    flex: 1;
    min-width: 60px;
    border: none;
    background: transparent;
    resize: none;
    outline: none;
    font-size: 14px;
    line-height: 1.6;
    color: var(--b3-theme-on-background);
    min-height: 24px;
    max-height: 120px;
    font-family: inherit;
    padding: 0;

    &::placeholder {
      color: var(--b3-theme-on-surface-light);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  &__skill-menu {
    position: absolute;
    bottom: 100%;
    left: 0;
    right: 0;
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-theme-surface-lighter);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-height: 240px;
    overflow-y: auto;
    z-index: 100;
    margin-bottom: 4px;
  }

  &__skill-menu-title {
    padding: 8px 12px 4px;
    font-size: 11px;
    font-weight: 600;
    color: var(--b3-theme-on-surface-light);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  &__skill-item {
    padding: 6px 12px;
    cursor: pointer;
    transition: background 0.15s;

    &--active {
      background: var(--b3-theme-primary-lightest);
    }

    &:hover {
      background: var(--b3-theme-primary-lightest);
    }
  }

  &__skill-item-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--b3-theme-on-background);
  }

  &__skill-item-desc {
    font-size: 12px;
    color: var(--b3-theme-on-surface-light);
    margin-top: 1px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__skill-empty {
    padding: 12px;
    text-align: center;
    font-size: 13px;
    color: var(--b3-theme-on-surface-light);
  }
}
</style>
