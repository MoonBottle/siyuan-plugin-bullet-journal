<template>
  <div class="reasoning-display">
    <!-- 头部：折叠/展开图标 + 思考图标 + 标题 -->
    <div class="reasoning-display__header" @click="toggleCollapse">
      <span class="reasoning-display__arrow">
        <svg v-if="isCollapsed">
          <use xlink:href="#iconDown"></use>
        </svg>
        <svg v-else>
          <use xlink:href="#iconUp"></use>
        </svg>
      </span>
      <span class="reasoning-display__icon">
        <svg><use xlink:href="#iconSparkles"></use></svg>
      </span>
      <span class="reasoning-display__title">{{ title }}</span>
      <!-- 加载动画 -->
      <span v-if="loading" class="reasoning-display__loading">
        <span class="loading-dot"></span>
        <span class="loading-dot"></span>
        <span class="loading-dot"></span>
      </span>
    </div>

    <!-- 展开后的内容 -->
    <div v-if="!isCollapsed" class="reasoning-display__content">
      {{ content }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { t } from '@/i18n';

const props = defineProps<{
  /** 思考过程内容 */
  content: string;
  /** 是否处于加载状态 */
  loading?: boolean;
  /** 默认是否折叠，默认为 true */
  defaultCollapsed?: boolean;
  /** 自定义标题，默认使用 i18n 的 reasoningTitle */
  title?: string;
}>();

const isCollapsed = ref(props.defaultCollapsed ?? true);

const title = computed(() => {
  return props.title ?? (t('aiChat') as Record<string, string>).reasoningTitle ?? '思考过程';
});

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value;
}
</script>

<style lang="scss" scoped>
.reasoning-display {
  background: var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background-color: var(--b3-theme-surface-lightest);
    }
  }

  &__arrow {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    svg {
      width: 12px;
      height: 12px;
      fill: var(--b3-theme-on-surface);
    }
  }

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

  &__title {
    flex: 1;
    font-size: 12px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

  &__content {
    padding: 6px 12px 8px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--b3-theme-on-surface);
    white-space: pre-wrap;
    border-top: 1px solid var(--b3-theme-surface-lightest);
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
