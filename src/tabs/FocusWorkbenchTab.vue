<template>
  <div
    class="focus-workbench-tab"
    :class="{ 'focus-workbench-tab--embedded': embedded }"
  >
    <div
      v-if="showHeader"
      class="focus-workbench-tab__header"
    >
      <h2 class="focus-workbench-tab__title">
        {{ t('focusWorkbench').title }}
      </h2>
      <span class="fn__flex-1 fn__space"></span>
      <button
        class="block__icon"
        :aria-label="t('common').refresh"
        data-testid="focus-workbench-refresh"
        type="button"
        @click="handleRefresh"
      >
        <svg><use xlink:href="#iconRefresh"></use></svg>
      </button>
    </div>
    <FocusWorkbenchView
      ref="focusWorkbenchViewRef"
      :initial-group-id="initialGroupId"
    />
  </div>
</template>

<script setup lang="ts">
import type { WorkbenchFocusReviewViewConfig } from '@/types/workbench'
import {
  computed,
  ref,
} from 'vue'
import FocusWorkbenchView from '@/components/pomodoro/review/FocusWorkbenchView.vue'
import { t } from '@/i18n'

const props = withDefaults(defineProps<{
  embedded?: boolean
  viewConfig?: Record<string, unknown>
}>(), {
  embedded: false,
})

const showHeader = computed(() => !props.embedded)
const initialGroupId = computed(() => (props.viewConfig as WorkbenchFocusReviewViewConfig | undefined)?.groupId)
const focusReviewViewRef = ref<InstanceType<typeof FocusWorkbenchView> | null>(null)

function handleRefresh() {
  focusReviewViewRef.value?.handleRefresh?.()
}
</script>

<style lang="scss" scoped>
.focus-workbench-tab {
  height: 100%;
  min-height: 0;
  padding: 16px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.focus-workbench-tab--embedded {
  height: 100%;
  min-height: 0;
  padding: 0;
  overflow: hidden;
}

.focus-workbench-tab__header {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.focus-workbench-tab__header .block__icon {
  opacity: 1;
  color: var(--b3-theme-on-background);

  svg {
    width: 14px;
    height: 14px;
    fill: currentColor;
  }
}

.focus-workbench-tab__title {
  margin: 0;
  padding-left: 6px;
  font-size: 18px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.focus-workbench-tab :deep(.focus-workbench-view) {
  flex: 1;
}
</style>
