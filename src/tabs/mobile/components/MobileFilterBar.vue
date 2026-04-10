<template>
  <div class="mobile-filter-bar">
    <div class="search-box">
      <svg class="search-icon"><use xlink:href="#iconSearch"></use></svg>
      <input
        v-model="searchQuery"
        type="text"
        class="search-input"
        :placeholder="t('todo').searchPlaceholder"
  
      />
      <button v-if="searchQuery" class="clear-btn" @click="clearSearch">
        <svg><use xlink:href="#iconClose"></use></svg>
      </button>
    </div>
    <button class="filter-btn" @click="emit('openFilter')">
      <svg><use xlink:href="#iconFilter"></use></svg>
      <span v-if="hasActiveFilters" class="filter-badge">●</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { t } from '@/i18n';

const props = defineProps<{
  search: string;
  hasActiveFilters: boolean;
}>();

const emit = defineEmits<{
  'update:search': [value: string];
  'openFilter': [];
}>();

const searchQuery = ref(props.search);

watch(() => props.search, (val) => {
  searchQuery.value = val;
});

watch(searchQuery, (val) => {
  emit('update:search', val);
});

const clearSearch = () => {
  searchQuery.value = '';
  emit('update:search', '');
};
</script>

<style lang="scss" scoped>
.mobile-filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--b3-theme-surface);
  border-bottom: 1px solid var(--b3-border-color);
  height: 48px;
  flex-shrink: 0;
}

.search-box {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--b3-theme-background);
  border-radius: var(--b3-border-radius);
  border: 1px solid var(--b3-border-color);
}

.search-icon {
  width: 14px;
  height: 14px;
  fill: var(--b3-theme-on-surface);
  opacity: 0.5;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 14px;
  outline: none;
  color: var(--b3-theme-on-background);
}

.clear-btn {
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  opacity: 0.4;
  color: var(--b3-theme-on-surface);
  display: flex;
  align-items: center;
  justify-content: center;
}

.filter-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: var(--b3-theme-background);
  border-radius: var(--b3-border-radius);
  cursor: pointer;
  position: relative;
}

.filter-btn svg {
  width: 16px;
  height: 16px;
  fill: var(--b3-theme-on-surface);
}

.filter-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  color: var(--b3-theme-primary);
  font-size: 8px;
}
</style>
