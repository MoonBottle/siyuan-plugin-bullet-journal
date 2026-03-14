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
    </div>

    <!-- 展开后的内容 -->
    <div
      v-if="!isCollapsed"
      class="reasoning-display__content"
      v-html="renderedContent"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { t } from '@/i18n';
import { renderMarkdown } from '@/utils/markdownRenderer';

const props = defineProps<{
  /** 思考过程内容 */
  content: string;
  /** 默认是否折叠，默认为 true */
  defaultCollapsed?: boolean;
  /** 自定义标题，默认使用 i18n 的 reasoningTitle */
  title?: string;
}>();

const isCollapsed = ref(props.defaultCollapsed ?? true);

const title = computed(() => {
  return props.title ?? (t('aiChat') as Record<string, string>).reasoningTitle ?? '思考过程';
});

const renderedContent = computed(() => {
  try {
    return renderMarkdown(props.content);
  } catch (error) {
    console.error('Reasoning markdown rendering error:', error);
    return props.content;
  }
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

  &__content {
    padding: 6px 12px 8px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--b3-theme-on-surface);
    border-top: 1px solid var(--b3-theme-surface-lightest);

    // Markdown 渲染样式
    :deep(p) {
      margin: 4px 0;
      &:first-child { margin-top: 0; }
      &:last-child { margin-bottom: 0; }
    }

    :deep(ul), :deep(ol) {
      margin: 4px 0;
      padding-left: 16px;
    }

    :deep(li) {
      margin: 2px 0;
    }

    :deep(code) {
      background: var(--b3-theme-surface-lightest);
      padding: 1px 4px;
      border-radius: 3px;
      font-family: var(--b3-font-family-code);
      font-size: 11px;
    }

    :deep(pre) {
      background: var(--b3-theme-surface-lightest);
      padding: 6px 8px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 6px 0;

      code {
        background: none;
        padding: 0;
      }
    }

    :deep(blockquote) {
      margin: 4px 0;
      padding-left: 8px;
      border-left: 2px solid var(--b3-theme-primary);
      color: var(--b3-theme-on-surface-light);
    }
  }
}

</style>
