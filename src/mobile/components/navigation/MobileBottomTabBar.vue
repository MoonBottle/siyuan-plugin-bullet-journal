<template>
  <nav
    class="mobile-bottom-tab-bar"
    aria-label="移动端主导航"
  >
    <button
      v-for="tab in tabs"
      :key="tab.value"
      class="mobile-bottom-tab-bar__button"
      :class="{ 'mobile-bottom-tab-bar__button--active': activeTab === tab.value }"
      :data-testid="`mobile-tab-${tab.value}`"
      type="button"
      @click="emit('update:activeTab', tab.value)"
    >
      <span
        class="mobile-bottom-tab-bar__icon"
        :data-testid="`mobile-tab-${tab.value}-icon`"
        aria-hidden="true"
      >
        <svg><use :xlink:href="`#${tab.icon}`"></use></svg>
      </span>
      <span
        class="mobile-bottom-tab-bar__label"
        :data-testid="`mobile-tab-${tab.value}-label`"
      >{{ tab.label }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
type MobileMainTab = 'todo' | 'ai' | 'pomodoro' | 'habit' | 'more'

defineProps<{
  activeTab: MobileMainTab
}>()

const emit = defineEmits<{
  'update:activeTab': [tab: MobileMainTab]
}>()

const tabs: Array<{ value: MobileMainTab, label: string, icon: string }> = [
  {
    value: 'todo',
    label: '待办',
    icon: 'iconTaTodo',
  },
  {
    value: 'ai',
    label: '对话',
    icon: 'iconTaAiAssistant',
  },
  {
    value: 'pomodoro',
    label: '番茄钟',
    icon: 'iconTaPomodoro',
  },
  {
    value: 'habit',
    label: '习惯',
    icon: 'iconTaHabit',
  },
  {
    value: 'more',
    label: '设置',
    icon: 'iconSettings',
  },
]
</script>

<style lang="scss" scoped>
.mobile-bottom-tab-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 10;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  border-top: 1px solid var(--b3-border-color, #ddd);
  background: var(--b3-theme-surface, #fff);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.mobile-bottom-tab-bar__button {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 58px;
  margin: 4px 6px;
  padding: 6px 4px 5px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--b3-theme-on-surface, #222);
  transition:
    background-color 0.18s ease,
    color 0.18s ease;
}

.mobile-bottom-tab-bar__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;

  svg {
    width: 18px;
    height: 18px;
    fill: currentColor;
  }
}

.mobile-bottom-tab-bar__label {
  max-width: 100%;
  overflow: hidden;
  font-size: 10px;
  line-height: 1.1;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.mobile-bottom-tab-bar__button--active {
  color: var(--b3-theme-primary, #8f7aea);
  font-weight: 600;
}
</style>
