<template>
  <div class="focus-review-tab">
    <div v-if="showHeader" class="focus-review-tab__header">
      <h2 class="focus-review-tab__title">{{ t('focusReview').title }}</h2>
    </div>
    <FocusReviewView />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { t } from '@/i18n';
import FocusReviewView from '@/components/pomodoro/review/FocusReviewView.vue';

const props = withDefaults(defineProps<{
  embedded?: boolean;
}>(), {
  embedded: false,
});

const showHeader = computed(() => !props.embedded);
</script>

<style lang="scss" scoped>
.focus-review-tab {
  padding: 16px 16px 50px;
  min-height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.focus-review-tab__header {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.focus-review-tab__title {
  margin: 0;
  padding-left: 6px;
  font-size: 18px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.focus-review-tab :deep(.focus-review-view) {
  flex: 1;
}
</style>
