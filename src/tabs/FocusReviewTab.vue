<template>
  <div class="focus-review-tab">
    <div v-if="showHeader" class="focus-review-tab__header">
      <h2 class="focus-review-tab__title">{{ t('focusReview').title }}</h2>
      <span class="fn__flex-1 fn__space"></span>
      <button
        class="block__icon"
        :aria-label="t('common').refresh"
        data-testid="focus-review-refresh"
        type="button"
        @click="handleRefresh"
      >
        <svg><use xlink:href="#iconRefresh"></use></svg>
      </button>
    </div>
    <FocusReviewView ref="focusReviewViewRef" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { t } from '@/i18n';
import FocusReviewView from '@/components/pomodoro/review/FocusReviewView.vue';

const props = withDefaults(defineProps<{
  embedded?: boolean;
}>(), {
  embedded: false,
});

const showHeader = computed(() => !props.embedded);
const focusReviewViewRef = ref<InstanceType<typeof FocusReviewView> | null>(null);

function handleRefresh() {
  focusReviewViewRef.value?.handleRefresh?.();
}
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

.focus-review-tab__header .block__icon {
  opacity: 1;
  color: var(--b3-theme-on-background);

  svg {
    width: 14px;
    height: 14px;
    fill: currentColor;
  }
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
