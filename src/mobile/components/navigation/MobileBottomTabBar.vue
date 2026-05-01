<template>
  <nav class="mobile-bottom-tab-bar" aria-label="移动端主导航">
    <button
      v-for="tab in tabs"
      :key="tab.value"
      class="mobile-bottom-tab-bar__button"
      :class="{ 'mobile-bottom-tab-bar__button--active': activeTab === tab.value }"
      :data-testid="`mobile-tab-${tab.value}`"
      type="button"
      @click="emit('update:activeTab', tab.value)"
    >
      <span class="mobile-bottom-tab-bar__label">{{ tab.label }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
type MobileMainTab = 'todo' | 'pomodoro' | 'habit' | 'more';

defineProps<{
  activeTab: MobileMainTab
}>();

const emit = defineEmits<{
  'update:activeTab': [tab: MobileMainTab]
}>();

const tabs: Array<{ value: MobileMainTab, label: string }> = [
  { value: 'todo', label: '待办' },
  { value: 'pomodoro', label: '番茄钟' },
  { value: 'habit', label: '习惯打卡' },
  { value: 'more', label: '更多' },
];
</script>

<style lang="scss" scoped>
.mobile-bottom-tab-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 10;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-top: 1px solid var(--b3-border-color, #ddd);
  background: var(--b3-theme-surface, #fff);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.mobile-bottom-tab-bar__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 56px;
  margin: 6px 8px;
  padding: 0 12px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--b3-theme-on-surface, #222);
  font-size: 12px;
  transition: background-color 0.18s ease, color 0.18s ease;
}

.mobile-bottom-tab-bar__label {
  line-height: 1;
}

.mobile-bottom-tab-bar__button--active {
  background: color-mix(in srgb, var(--b3-theme-primary, #8f7aea) 10%, transparent);
  color: var(--b3-theme-primary, #8f7aea);
  font-weight: 600;
}
</style>
