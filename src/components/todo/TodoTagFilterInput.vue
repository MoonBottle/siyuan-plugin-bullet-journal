<template>
  <div
    ref="tagSearchRow"
    class="tag-search-row"
  >
    <div
      ref="tagSearchRoot"
      class="tag-search-box"
      :class="{ 'tag-search-box--open': showTagDropdown }"
      @click="handleTagBoxClick"
    >
      <svg class="search-icon"><use xlink:href="#iconSearch"></use></svg>
      <div
        v-if="displaySelectedTags.length"
        class="selected-tag-chips"
      >
        <button
          v-for="tag in displaySelectedTags"
          :key="`selected-${tag}`"
          class="tag-chip tag-chip--selected"
          @click.stop="removeTag(tag)"
        >
          <span class="tag-chip__label">#{{ tag }}</span>
          <svg class="tag-chip__icon"><use xlink:href="#iconClose"></use></svg>
        </button>
      </div>
      <input
        ref="tagSearchInput"
        :value="tagQuery"
        type="text"
        :placeholder="tagInputPlaceholder"
        class="tag-search-input"
        @focus="handleTagInputFocus"
        @input="handleTagQueryInput"
        @keydown="handleTagInputKeydown"
      />
      <button
        v-if="tagQuery"
        class="clear-btn"
        @click.stop="$emit('update:tagQuery', '')"
      >
        <svg><use xlink:href="#iconClose"></use></svg>
      </button>
    </div>

    <div
      v-if="showTagDropdown"
      class="tag-dropdown tag-options"
    >
      <button
        v-for="option in filteredTagOptions"
        :key="option.name"
        class="tag-chip tag-option"
        :class="[
          {
            'tag-chip--selected': isTagSelected(option.name),
            'tag-option--highlighted': highlightedTagName === option.name,
          },
        ]"
        @click.stop="toggleTag(option.name)"
      >
        <span class="tag-option__label">#{{ option.name }}</span>
        <span class="tag-option__count">{{ option.count }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
} from 'vue'

interface TagOption {
  name: string
  count: number
}

const props = withDefaults(defineProps<{
  tagQuery?: string
  selectedTags?: string[]
  tagOptions?: TagOption[]
  placeholder?: string
}>(), {
  tagQuery: '',
  selectedTags: () => [],
  tagOptions: () => [],
  placeholder: '筛选标签',
})

const emit = defineEmits<{
  (event: 'update:tagQuery', value: string): void
  (event: 'update:selectedTags', value: string[]): void
}>()

const LEADING_HASH_RE = /^#/

const tagSearchRoot = ref<HTMLElement | null>(null)
const tagSearchRow = ref<HTMLElement | null>(null)
const tagSearchInput = ref<HTMLInputElement | null>(null)
const isTagDropdownOpen = ref(false)
const highlightedTagIndex = ref(-1)

const normalizedTagQuery = computed(() => normalizeTagQuery(props.tagQuery))
const normalizedSelectedTags = computed(() => new Set(props.selectedTags.map((tag) => normalizeSelectedTag(tag))))

const displaySelectedTags = computed(() => {
  const seen = new Set<string>()

  return props.selectedTags.filter((tag) => {
    const normalizedTag = normalizeSelectedTag(tag)
    if (!normalizedTag || seen.has(normalizedTag)) {
      return false
    }
    seen.add(normalizedTag)
    return true
  })
})

const tagInputPlaceholder = computed(() => {
  return displaySelectedTags.value.length > 0 ? '' : props.placeholder
})

const filteredTagOptions = computed(() => {
  if (!normalizedTagQuery.value) {
    return props.tagOptions
  }

  return props.tagOptions.filter((option) =>
    option.name.toLocaleLowerCase().includes(normalizedTagQuery.value),
  )
})

const showTagDropdown = computed(() => isTagDropdownOpen.value && filteredTagOptions.value.length > 0)
const highlightedTagName = computed(() => filteredTagOptions.value[highlightedTagIndex.value]?.name ?? '')

function normalizeTagQuery(query?: string) {
  return (query || '').trim().replace(LEADING_HASH_RE, '').toLocaleLowerCase()
}

function normalizeSelectedTag(tag?: string) {
  return (tag || '').toLocaleLowerCase()
}

function openTagDropdown() {
  isTagDropdownOpen.value = true
}

function closeTagDropdown() {
  isTagDropdownOpen.value = false
  highlightedTagIndex.value = -1
}

function isTagSelected(tag: string) {
  return normalizedSelectedTags.value.has(normalizeSelectedTag(tag))
}

function toggleTag(tag: string) {
  const normalizedTargetTag = normalizeSelectedTag(tag)
  const tagAlreadySelected = isTagSelected(tag)
  const nextTagsWithoutTarget = props.selectedTags.filter(
    (selectedTag) => normalizeSelectedTag(selectedTag) !== normalizedTargetTag,
  )
  const nextTags = tagAlreadySelected
    ? nextTagsWithoutTarget
    : [...nextTagsWithoutTarget, tag]

  emit('update:selectedTags', nextTags)
  emit('update:tagQuery', '')
  highlightedTagIndex.value = -1
}

function removeTag(tag: string) {
  if (!isTagSelected(tag)) return
  toggleTag(tag)
}

function handleTagQueryInput(event: Event) {
  const target = event.target as HTMLInputElement | null
  if (!target) return
  highlightedTagIndex.value = -1
  emit('update:tagQuery', target.value)
}

function handleTagInputKeydown(event: KeyboardEvent) {
  if (event.key === 'Backspace' && !props.tagQuery && displaySelectedTags.value.length > 0) {
    event.preventDefault()
    const lastTag = displaySelectedTags.value.at(-1)
    if (lastTag) {
      removeTag(lastTag)
    }
    return
  }

  if (event.key === 'Escape') {
    closeTagDropdown()
    return
  }

  if (!filteredTagOptions.value.length) {
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    openTagDropdown()
    highlightedTagIndex.value = highlightedTagIndex.value < 0
      ? 0
      : (highlightedTagIndex.value + 1) % filteredTagOptions.value.length
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    openTagDropdown()
    highlightedTagIndex.value = highlightedTagIndex.value < 0
      ? filteredTagOptions.value.length - 1
      : (highlightedTagIndex.value - 1 + filteredTagOptions.value.length) % filteredTagOptions.value.length
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    const activeOption = highlightedTagIndex.value >= 0
      ? filteredTagOptions.value[highlightedTagIndex.value]
      : filteredTagOptions.value[0]
    if (activeOption) {
      toggleTag(activeOption.name)
    }
  }
}

function handleDocumentPointerDown(event: PointerEvent) {
  const target = event.target
  if (!(target instanceof Node)) return
  if (tagSearchRow.value?.contains(target)) return
  closeTagDropdown()
}

function handleTagInputFocus() {
  highlightedTagIndex.value = -1
  openTagDropdown()
}

function handleTagBoxClick() {
  highlightedTagIndex.value = -1
  openTagDropdown()
  tagSearchInput.value?.focus()
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
})
</script>

<style scoped lang="scss">
.tag-search-row {
  position: relative;
  margin-bottom: 8px;
}

.tag-search-box {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  width: 100%;
  min-height: 36px;
  box-sizing: border-box;
  padding: 5px 10px;
  background: var(--b3-theme-background);
  border-radius: var(--b3-border-radius);
  border: 1px solid var(--b3-border-color);

  &:focus-within,
  &--open {
    border-color: var(--b3-theme-primary);
  }

  .search-icon {
    width: 14px;
    height: 14px;
    fill: var(--b3-theme-on-surface);
    opacity: 0.5;
    flex-shrink: 0;
  }

  .tag-search-input {
    flex: 1;
    min-width: 96px;
    border: none;
    background: transparent;
    font-size: 13px;
    line-height: 1.5;
    outline: none;
    color: var(--b3-theme-on-background);
  }

  .clear-btn {
    width: 16px;
    height: 16px;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    opacity: 0.4;
    color: var(--b3-theme-on-surface);

    &:hover {
      opacity: 0.8;
    }
  }
}

.selected-tag-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 0 1 auto;
  min-width: fit-content;
}

.tag-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  border: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-surface);
  box-shadow: var(--b3-dialog-shadow);
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 24px;
  padding: 0 8px;
  border: 1px solid var(--b3-border-color);
  border-radius: 999px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  cursor: pointer;
  font-size: 12px;

  &:hover,
  &.tag-chip--selected {
    border-color: var(--b3-theme-primary);
    background: var(--b3-theme-primary-lightest);
    color: var(--b3-theme-primary);
  }

  .tag-chip__icon {
    width: 10px;
    height: 10px;
    fill: currentColor;
  }
}

.tag-option {
  width: 100%;
  justify-content: space-between;
  min-height: 28px;
  border-radius: 6px;
  padding: 0 10px;

  &.tag-option--highlighted {
    border-color: var(--b3-theme-primary);
    background: var(--b3-theme-primary-lightest);
    color: var(--b3-theme-primary);
  }
}

.tag-option__label,
.tag-option__count {
  font-size: 12px;
}

.tag-option__count {
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
}
</style>
