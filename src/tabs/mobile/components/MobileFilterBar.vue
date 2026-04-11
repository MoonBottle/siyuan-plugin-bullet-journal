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
    <button class="filter-btn" :class="{ active: hasActiveFilters }" @click="emit('openFilter')">
      <svg><use xlink:href="#iconFilter"></use></svg>
      <span v-if="hasActiveFilters" class="filter-badge"></span>
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
  padding: 10px 12px;
  background: var(--b3-theme-background);
  border-bottom: 1px solid var(--b3-border-color);
  flex-shrink: 0;
}

.search-box {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--b3-theme-surface);
  border-radius: 10px;
  border: 1px solid transparent;
  transition: all 0.2s ease;
  
  &:focus-within {
    border-color: var(--b3-theme-primary);
    background: var(--b3-theme-background);
    box-shadow: 0 0 0 3px rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.1);
  }
}

.search-icon {
  width: 18px;
  height: 18px;
  fill: var(--b3-theme-on-surface);
  opacity: 0.5;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 15px;
  outline: none;
  color: var(--b3-theme-on-background);
  
  &::placeholder {
    color: var(--b3-theme-on-surface);
    opacity: 0.5;
  }
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
  transition: opacity 0.2s;
  
  &:hover {
    opacity: 0.7;
  }
  
  svg {
    width: 16px;
    height: 16px;
    fill: currentColor;
  }
}

.filter-btn {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: var(--b3-theme-surface);
  border-radius: 10px;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
  flex-shrink: 0;
  
  svg {
    width: 18px;
    height: 18px;
    fill: var(--b3-theme-on-surface);
    transition: fill 0.2s;
  }
  
  &:hover {
    background: var(--b3-theme-surface-lighter);
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  &.active {
    background: rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.1);
    
    svg {
      fill: var(--b3-theme-primary);
    }
  }
}

.filter-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 8px;
  height: 8px;
  background: var(--b3-theme-primary);
  border-radius: 50%;
  border: 2px solid var(--b3-theme-surface);
}
</style>
