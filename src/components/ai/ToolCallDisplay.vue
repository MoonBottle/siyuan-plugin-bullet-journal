<template>
  <div class="tool-call-display">
    <!-- 头部：折叠/展开图标 + 工具图标 + 工具名称 -->
    <div class="tool-call-display__header" @click="toggleCollapse">
      <span class="tool-call-display__arrow">
        <svg v-if="isCollapsed">
          <use xlink:href="#iconDown"></use>
        </svg>
        <svg v-else>
          <use xlink:href="#iconUp"></use>
        </svg>
      </span>
      <span class="tool-call-display__icon">
        <svg><use xlink:href="#iconPlugin"></use></svg>
      </span>
      <span class="tool-call-display__name">{{ toolName }}</span>
    </div>

    <!-- 展开后的内容 -->
    <div v-if="!isCollapsed" class="tool-call-display__body">
      <!-- 参数区域 -->
      <div v-if="formattedParams" class="tool-call-display__section">
        <div class="tool-call-display__section-title">参数</div>
        <div class="tool-call-display__section-content">
          <pre><code>{{ formattedParams }}</code></pre>
        </div>
      </div>

      <!-- 响应区域 -->
      <div class="tool-call-display__section">
        <div class="tool-call-display__section-header">
          <span class="tool-call-display__section-title">响应</span>
          <SyButton
            icon="iconCopy"
            aria-label="复制"
            @click="copyResult"
          />
        </div>
        <div class="tool-call-display__section-content tool-call-display__section-content--scrollable">
          <pre><code>{{ formattedResult }}</code></pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import SyButton from '@/components/SiyuanTheme/SyButton.vue';

const props = defineProps<{
  /** 工具名称 */
  toolName: string;
  /** 工具参数（JSON 字符串或对象） */
  params?: string | object;
  /** 工具响应结果（JSON 字符串或对象） */
  result: string | object;
  /** 默认是否折叠，默认为 true */
  defaultCollapsed?: boolean;
}>();

const isCollapsed = ref(props.defaultCollapsed ?? true);

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value;
}

function formatJSON(data: string | object | undefined): string {
  if (!data) return '';
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return String(data);
  }
}

const formattedParams = computed(() => formatJSON(props.params));
const formattedResult = computed(() => formatJSON(props.result));

async function copyResult() {
  try {
    await navigator.clipboard.writeText(formattedResult.value);
  } catch (err) {
    console.error('复制失败:', err);
  }
}
</script>

<style lang="scss" scoped>
.tool-call-display {
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
      fill: var(--b3-theme-secondary);
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
      fill: var(--b3-theme-secondary);
    }
  }

  &__name {
    flex: 1;
    font-size: 12px;
    font-weight: 600;
    color: var(--b3-theme-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__body {
    padding: 0 10px 6px;
  }

  &__section {
    margin-top: 6px;

    &:first-child {
      margin-top: 0;
    }
  }

  &__section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 2px;
  }

  &__section-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--b3-theme-on-surface-light);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  &__section-content {
    background: var(--b3-theme-surface-lightest);
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 12px;
    line-height: 1.4;
    color: var(--b3-theme-on-surface);
    overflow-x: auto;

    pre {
      margin: 0;
      padding: 0;
      background: transparent;
      white-space: pre;
      word-wrap: normal;
      overflow-wrap: normal;
    }

    code {
      font-family: var(--b3-font-family-code);
      font-size: inherit;
      background: transparent;
      padding: 0;
      white-space: pre;
    }

    &--scrollable {
      max-height: 200px;
      overflow-y: auto;
    }
  }
}
</style>
