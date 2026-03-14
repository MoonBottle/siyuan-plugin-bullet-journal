<template>
  <div class="thinking-indicator">
    <span class="thinking-indicator__icon">
      <svg><use xlink:href="#iconSparkles"></use></svg>
    </span>
    <span class="thinking-indicator__text">{{ title }}</span>
    <span class="thinking-indicator__loading">
      <span class="loading-dot"></span>
      <span class="loading-dot"></span>
      <span class="loading-dot"></span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { t } from '@/i18n';

const props = defineProps<{
  /** 自定义标题，默认使用 i18n 的 thinkingTitle */
  title?: string;
}>();

const title = computed(() => {
  return props.title ?? (t('aiChat') as Record<string, string>).thinkingTitle ?? '思考中';
});
</script>

<style lang="scss" scoped>
.thinking-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);

  &__icon {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    svg {
      width: 14px;
      height: 14px;
      fill: var(--b3-theme-primary);
    }
  }

  &__text {
    flex: 1;
    font-size: 12px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  &__loading {
    display: flex;
    gap: 3px;

    .loading-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--b3-theme-primary);
      animation: loading-bounce 1.4s infinite ease-in-out both;

      &:nth-child(1) {
        animation-delay: -0.32s;
      }

      &:nth-child(2) {
        animation-delay: -0.16s;
      }
    }
  }
}

@keyframes loading-bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}
</style>
