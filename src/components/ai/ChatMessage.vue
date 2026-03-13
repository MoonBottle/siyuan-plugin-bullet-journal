<template>
  <div
    class="chat-message"
    :class="{
      'chat-message--user': message.role === 'user',
      'chat-message--assistant': message.role === 'assistant',
      'chat-message--system': message.role === 'system',
      'chat-message--tool': message.role === 'tool',
      'chat-message--loading': message.loading,
      'chat-message--error': message.error,
      'chat-message--grouped': isGrouped,
      'chat-message--grouped-first': isGrouped && isFirst
    }"
  >
    <!-- 头部：仅与是否第一条有关，始终在卡片外；分组时由 Panel 统一渲染一条 -->
    <div v-if="showHeader" class="chat-message__header-row">
      <div v-if="showHeader" class="chat-message__avatar">
        <svg v-if="message.role === 'user'">
          <use xlink:href="#iconAccount"></use>
        </svg>
        <AiAssistantIcon v-else-if="message.role === 'assistant'" />
        <svg v-else-if="message.role === 'tool'">
          <use xlink:href="#iconPlugin"></use>
        </svg>
        <svg v-else>
          <use xlink:href="#iconInfo"></use>
        </svg>
      </div>
      <span class="chat-message__role">
        {{ roleText }}
      </span>
      <span class="chat-message__time">
        {{ formatTime(message.timestamp) }}
      </span>
    </div>
    <div class="chat-message__content">
      <div class="chat-message__body">
        <!-- 思考过程（reasoning）：仅在没有 toolCalls 的 assistant 消息上显示，避免与下一句重复 -->
        <div
          v-if="message.reasoning && !(message.toolCalls && message.toolCalls.length)"
          class="chat-message__reasoning"
          :class="{ 'chat-message__reasoning--collapsed': isReasoningCollapsed }"
        >
          <div class="chat-message__reasoning-header" @click="toggleReasoning">
            <span class="chat-message__reasoning-icon">
              <svg :class="{ 'rotated': isReasoningCollapsed }">
                <use xlink:href="#iconRight"></use>
              </svg>
            </span>
            <span class="chat-message__reasoning-title">{{ t('aiChat').reasoningTitle }}</span>
            <!-- 仅在没有 reasoning 内容时显示加载点，避免与思考内容同时闪 -->
            <span v-if="message.loading && !message.content && !message.reasoning" class="chat-message__reasoning-loading">
              <span class="loading-dot"></span>
              <span class="loading-dot"></span>
              <span class="loading-dot"></span>
            </span>
          </div>
          <div v-if="!isReasoningCollapsed" class="chat-message__reasoning-content">
            {{ message.reasoning }}
          </div>
        </div>

        <div
          v-if="message.loading && !message.reasoning && !message.content"
          class="chat-message__loading"
        >
          <span class="loading-dot"></span>
          <span class="loading-dot"></span>
          <span class="loading-dot"></span>
        </div>
        <div
          v-else-if="message.error"
          class="chat-message__error-text"
        >
          {{ message.error }}
        </div>
        <!-- 工具调用消息（此时已确定需要展示） -->
        <div v-else-if="message.role === 'tool'" class="chat-message__tool-content">
          <div class="chat-message__tool-header" @click="toggleCollapse">
            <span class="chat-message__tool-icon">
              <svg :class="{ 'rotated': isCollapsed }">
                <use xlink:href="#iconRight"></use>
              </svg>
            </span>
            <span class="chat-message__tool-icon-tool">
              <svg><use xlink:href="#iconPlugin"></use></svg>
            </span>
            <span class="chat-message__tool-name">{{ getToolName() }}</span>
          </div>
          <div v-if="!isCollapsed" class="chat-message__tool-body">
            <!-- 显示工具参数 -->
            <div v-if="getToolParams()" class="chat-message__tool-params">
              <div class="chat-message__tool-params-title">{{ t('aiChat').toolParamsTitle }}</div>
              <pre class="chat-message__tool-params-content"><code>{{ getToolParams() }}</code></pre>
            </div>
            <!-- 显示工具结果 -->
            <div class="chat-message__tool-result">
              <div class="chat-message__tool-result-title">{{ t('aiChat').toolResultTitle }}</div>
              <div class="chat-message__tool-result-content">
                <div v-html="renderedContent"></div>
              </div>
            </div>
          </div>
        </div>
        <div
          v-else-if="message.content"
          class="chat-message__text"
          v-html="renderedContent"
        ></div>

        <!-- Token 统计和插入按钮（含 toolCalls 的 assistant 消息不显示 footer，仅在最终回答展示） -->
        <div v-if="showFooter" class="chat-message__footer">
          <div v-if="message.usage" class="chat-message__usage">
            <span class="chat-message__usage-item">
              <span class="block__icon b3-tooltips b3-tooltips__ne" :aria-label="t('aiChat').inputTokens">
                <svg><use xlink:href="#iconEdit"></use></svg>
              </span>
              {{ message.usage.prompt_tokens }}
            </span>
            <span class="chat-message__usage-divider">|</span>
            <span class="chat-message__usage-item">
              <span class="block__icon b3-tooltips b3-tooltips__ne" :aria-label="t('aiChat').outputTokens">
                <svg><use xlink:href="#iconSparkles"></use></svg>
              </span>
              {{ message.usage.completion_tokens }}
            </span>
            <span class="chat-message__usage-divider">|</span>
            <span class="chat-message__usage-item">
              <span class="block__icon b3-tooltips b3-tooltips__ne" :aria-label="t('aiChat').totalTokens">
                <svg><use xlink:href="#iconDatabase"></use></svg>
              </span>
              {{ message.usage.total_tokens }}
            </span>
            <span v-if="message.usage.cached_tokens" class="chat-message__usage-item">
              <span class="chat-message__usage-divider">|</span>
              <span class="block__icon b3-tooltips b3-tooltips__ne" :aria-label="t('aiChat').cachedTokens">
                <svg><use xlink:href="#iconHistory"></use></svg>
              </span>
              {{ message.usage.cached_tokens }}
            </span>
          </div>
          <!-- 最后一条 AI 消息显示插入按钮 -->
          <div v-if="showInsertBtn" class="chat-message__insert-btn">
            <span
              class="block__icon b3-tooltips b3-tooltips__nw"
              :aria-label="t('aiChat').insertToNote"
              @click="handleInsertToNote"
            >
              <svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="14" height="14">
                <path d="M192 0A192 192 0 0 0 0 192v640a192 192 0 0 0 192 192h512a192 192 0 0 0 192-192V704a64 64 0 1 0-128 0v128a64 64 0 0 1-64 64H192a64 64 0 0 1-64-64V192a64 64 0 0 1 64-64h512a64 64 0 0 1 64 64 64 64 0 1 0 128 0A192 192 0 0 0 704 0H192z"></path>
                <path d="M576 704c51.072 0 91.328-32.896 117.376-57.408 18.56-17.472 39.168-40.192 58.752-61.76 9.152-10.176 18.112-20.032 26.56-29.056C838.656 491.776 893.824 448 960 448a64 64 0 1 0 0-128c-125.76 0-214.656 84.16-274.688 148.224-12.352 13.184-23.168 25.152-33.088 36.16-17.088 18.88-31.552 34.88-46.592 49.024-19.008 17.92-28.032 21.632-29.888 22.4l-0.32 0.192a30.08 30.08 0 0 1-7.232-6.912c-9.344-11.136-18.048-27.84-30.912-53.632l-1.408-2.816c-10.944-21.952-25.856-51.712-45.696-75.52C467.776 410.176 433.28 384 384 384c-49.6 0-84.928 26.496-107.52 57.088-20.928 28.416-33.408 63.36-41.984 93.44-6.976 24.256-12.608 50.304-17.472 72.576l-3.456 16.064c-6.4 28.544-10.88 44.544-14.784 52.288a64 64 0 1 0 114.496 57.216c12.16-24.32 19.52-56.256 25.216-81.728l4.16-18.88c4.736-21.824 9.216-42.496 14.912-62.4 7.424-26.048 14.912-43.072 21.952-52.672A31.552 31.552 0 0 1 384 512h0.576v0.064c0.768 0.384 3.2 2.048 7.296 6.912 9.28 11.136 17.984 27.84 30.912 53.632l1.344 2.816c11.008 21.952 25.856 51.712 45.696 75.52C492.288 677.888 526.784 704 576.064 704z"></path>
              </svg>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { t } from '@/i18n';
import { renderMarkdown } from '@/utils/markdownRenderer';
import AiAssistantIcon from '@/components/icons/AiAssistantIcon.vue';
import type { ChatMessage } from '@/types/ai';

const props = defineProps<{
  message: ChatMessage;
  toolCallInfo?: {
    name: string;
    arguments: string;
  } | null;
  isGrouped?: boolean;  // 是否为分组内的消息
  isFirst?: boolean;    // 是否为组内第一条
  isLast?: boolean;     // 是否为组内最后一条
  showHeader?: boolean; // 是否显示头部（由父组件控制）
  showFooter?: boolean; // 是否显示底部（token统计，由父组件控制）
  showInsertBtn?: boolean; // 是否显示插入按钮（由父组件控制）
}>();

const emit = defineEmits<{
  insertToNote: [message: ChatMessage];
}>();

const isCollapsed = ref(true);
const isReasoningCollapsed = ref(true);

const roleText = computed(() => {
  const ai = t('aiChat') as Record<string, string>;
  switch (props.message.role) {
    case 'user':
      return ai.roleUser ?? '我';
    case 'assistant':
      return ai.roleAssistant ?? '任务助手';
    case 'system':
      return ai.roleSystem ?? '系统';
    case 'tool':
      return ai.roleTool ?? '工具';
    default:
      return ai.roleUnknown ?? '未知';
  }
});

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value;
}

function toggleReasoning() {
  isReasoningCollapsed.value = !isReasoningCollapsed.value;
}

function handleInsertToNote() {
  emit('insertToNote', props.message);
}

function getToolName(): string {
  const ai = t('aiChat') as Record<string, string>;
  if (props.toolCallInfo?.name) {
    return props.toolCallInfo.name;
  }
  if (props.message.toolCallId) {
    return ai.toolRun ?? '工具执行';
  }
  return ai.tool ?? '工具';
}

// 获取工具调用的参数
function getToolParams(): string | null {
  if (!props.toolCallInfo?.arguments) return null;
  
  try {
    // 尝试解析参数 JSON，格式化显示
    const parsed = JSON.parse(props.toolCallInfo.arguments);
    return JSON.stringify(parsed, null, 2);
  } catch {
    // 解析失败，返回原始参数
    return props.toolCallInfo.arguments;
  }
}

const renderedContent = computed(() => {
  const content = props.message.content;

  // 检查是否为 JSON 格式
  let isJSON = false;
  try {
    JSON.parse(content);
    isJSON = true;
  } catch {
    // 不是 JSON
  }

  if (isJSON) {
    // 是 JSON，格式化显示（仅对对象/数组，纯数字/字符串/布尔值按普通文本处理）
    try {
      const parsed = JSON.parse(content);
      if (typeof parsed !== 'object' || parsed === null) {
        // 纯数字、字符串、布尔值不按 JSON 代码块显示，避免气泡被拉成细长条
        isJSON = false;
      }
    } catch {
      isJSON = false;
    }
  }

  if (isJSON) {
    try {
      const parsed = JSON.parse(content);
      const formatted = JSON.stringify(parsed, null, 2);
      const escaped = formatted
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return `<pre class="code-block json-code"><code class="language-json">${escaped}</code></pre>`;
    } catch {
      // 解析失败，按普通文本处理
    }
  }

  // 使用思源 Lute 渲染 Markdown
  try {
    return renderMarkdown(content);
  } catch (error) {
    console.error('Markdown rendering error:', error);
    // 渲染失败，返回原始内容
    return content;
  }
});

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
</script>

<style lang="scss" scoped>
.chat-message {
  display: flex;
  flex-direction: column;
  padding: 12px 0; /* 左右无内边距，与对话框左右对齐 */

  &--user {
    background: transparent;
    align-items: flex-end;

    .chat-message__content {
      background: var(--b3-theme-primary-lightest);
      border-radius: 16px 0 16px 16px;
      padding: 12px 16px;
      max-width: 80%;
    }

    .chat-message__header-row {
      justify-content: flex-end;
    }

    .chat-message__time {
      order: -1;
    }

    .chat-message__avatar {
      order: 0;
    }

    .chat-message__role {
      order: 1;
    }

    .chat-message__body {
      text-align: left;
    }
  }

  &--grouped {
    padding: 2px 0;
    background: transparent;

    &.chat-message--assistant,
    &.chat-message--tool {
      border-left: none;
      background: transparent;
    }

    /* 分组时整组共用一个卡片（在 Panel 的 chat-message-group__card），此处不再单独加卡片背景 */
    .chat-message__content {
      background: transparent;
      border-radius: 0;
      padding: 0;
    }
  }

  &--grouped-first .chat-message__content {
    border-radius: 0;
  }

  &--assistant {
    background: transparent;

    &:not(.chat-message--grouped) .chat-message__content {
      background: var(--b3-theme-surface);
      border-radius: var(--b3-border-radius);
      padding: 12px 16px;
    }
  }

  &--system {
    background: var(--b3-theme-background);
    opacity: 0.7;
  }

  &--tool {
    margin-top: 0!important;
    background: transparent;
    border-left: none;

    &:not(.chat-message--grouped) .chat-message__content {
      background: var(--b3-theme-surface);
      border-radius: var(--b3-border-radius);
      padding: 12px 16px;
      border-left: 3px solid var(--b3-theme-secondary);
    }
  }

  &--error {
    border: 1px solid var(--b3-theme-error);
  }

  &__avatar {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: transparent;
    transform: translateY(-2px); /* 机器人图标视觉上略偏下，微调上移 */

    svg,
    :deep(svg) {
      width: 20px;
      height: 20px;
      fill: var(--b3-theme-primary);
    }
  }

  &--user &__avatar {
    width: 16px;
    height: 16px;
    transform: none;

    svg,
    :deep(svg) {
      width: 12px;
      height: 12px;
      fill: var(--b3-theme-success);
    }
  }

  &--error &__avatar {
    transform: none;

    svg,
    :deep(svg) {
      fill: var(--b3-theme-error);
    }
  }

  &__content {
    flex: 0 1 auto; /* 不拉伸，按内容自适应，避免纯数字等短内容时气泡被拉高 */
    min-width: 0;
    max-width: 100%;
    overflow-wrap: break-word;
    word-wrap: break-word;
    word-break: break-word;
    user-select: text; /* 允许选中复制消息内容 */
  }

  &__header-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    min-height: 24px;
  }

  &__header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  &__role {
    font-weight: 600;
    font-size: 13px;
    line-height: 1;
    height: 24px;
    display: inline-flex;
    align-items: center;
    color: var(--b3-theme-on-surface);
  }

  &__time {
    font-size: 12px;
    line-height: 1;
    height: 24px;
    display: inline-flex;
    align-items: center;
    color: var(--b3-theme-on-surface-light);
  }

  &__body {
    font-size: 14px;
    line-height: 1.6;
    color: var(--b3-theme-on-background);
    max-width: 100%;

    :deep(h1), :deep(h2), :deep(h3) {
      margin: 12px 0 8px;
      font-weight: 600;
    }

    :deep(h1) {
      font-size: 16px;
    }

    :deep(h2) {
      font-size: 15px;
    }

    :deep(h3) {
      font-size: 14px;
    }

    // Lute 渲染的代码块样式
    :deep(pre) {
      background: var(--b3-theme-surface-lighter);
      padding: 8px;
      border-radius: var(--b3-border-radius);
      overflow-x: auto;
      margin: 6px 0;

      code {
        background: none;
        padding: 0;
        font-family: monospace;
        font-size: 13px;
        white-space: pre;
      }

      // Lute 使用 hljs 进行代码高亮
      code.hljs {
        background: none;
      }
    }

    // 保留 json-code 类用于 JSON 内容
    :deep(pre.json-code) {
      background: var(--b3-theme-surface-lighter);
      padding: 8px;
      border-radius: var(--b3-border-radius);
      overflow-x: auto;
      margin: 6px 0;

      code {
        background: none;
        padding: 0;
        font-family: monospace;
        font-size: 13px;
        white-space: pre;
        color: var(--b3-theme-on-background);
      }
    }

    // 行内代码样式
    :deep(code:not(pre code)) {
      background: var(--b3-theme-surface-lighter);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 13px;
    }

    // 标准 Markdown 列表样式
    :deep(ul), :deep(ol) {
      margin: 8px 0;
      padding-left: 20px;
    }

    :deep(li) {
      margin: 4px 0;
    }

    :deep(ul) {
      list-style-type: disc;
    }

    :deep(ul ul) {
      list-style-type: circle;
    }

    :deep(ol) {
      list-style-type: decimal;
    }

    // 兼容旧的 list-item 类（如果还有的话）
    :deep(.list-item) {
      margin: 4px 0;
      padding-left: 16px;
      position: relative;
      list-style: none;

      &::before {
        content: '•';
        position: absolute;
        left: 0;
        color: var(--b3-theme-primary);
      }

      &.ordered::before {
        content: none;
      }

      .list-num {
        position: absolute;
        left: 0;
        color: var(--b3-theme-primary);
        margin-right: 4px;
      }

      &.level-1 { padding-left: 24px; }
      &.level-2 { padding-left: 32px; }
      &.level-3 { padding-left: 40px; }
    }

    // 表格样式：支持所有 Markdown 表格（marked 默认输出无 class 的 table）
    :deep(table) {
      display: table;
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 13px;
      table-layout: auto;

      th, td {
        border: 1px solid var(--b3-theme-surface-lighter);
        padding: 8px 12px;
        text-align: left;
        white-space: normal;
        word-break: break-word;
        vertical-align: top;
      }

      th {
        background: var(--b3-theme-surface);
        font-weight: 600;
      }

      tr:nth-child(even) {
        background: var(--b3-theme-surface-lightest);
      }
    }

    :deep(a) {
      color: var(--b3-theme-primary);
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }

    :deep(br) {
      display: block;
      content: '';
      margin: 4px 0;
    }
  }

  &__tool-content {
    width: 100%;
  }

  &__tool-header {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    padding: 2px 0 2px 12px;
    border-radius: 4px;
    transition: background-color 0.2s;

    &:hover {
      background-color: var(--b3-theme-surface-lighter);
    }
  }

  &__tool-icon {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;

    svg {
      width: 12px;
      height: 12px;
      fill: var(--b3-theme-on-surface);
      transition: transform 0.2s;

      &.rotated {
        transform: rotate(90deg);
      }
    }
  }

  &__tool-icon-tool {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;

    svg {
      width: 14px;
      height: 14px;
      fill: var(--b3-theme-secondary);
    }
  }

  &__tool-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--b3-theme-secondary);
  }

  &__tool-body {
    margin-top: 4px;
    padding: 6px;
    background: var(--b3-theme-surface-lighter);
    border-radius: var(--b3-border-radius);
    overflow-x: auto;
  }

  &__tool-params {
    margin-bottom: 8px;
  }

  &__tool-params-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--b3-theme-secondary);
    margin-bottom: 2px;
  }

  &__tool-params-content {
    background: var(--b3-theme-background);
    padding: 8px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
    white-space: pre;
    overflow-x: auto;
  }

  &__tool-result {
    margin-top: 6px;
  }

  &__tool-result-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--b3-theme-secondary);
    margin-bottom: 2px;
  }

  &__tool-result-content {
    background: var(--b3-theme-background);
    padding: 6px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
    white-space: pre;
    overflow-x: auto;

    :deep(pre.code-block) {
      background: transparent !important;
      padding: 0 !important;
      margin: 0 !important;
      border-radius: 0 !important;

      code {
        background: transparent !important;
        padding: 0 !important;
        font-size: 12px !important;
      }
    }
  }

  &__loading {
    display: flex;
    gap: 4px;
    align-items: center;
    height: 24px;

    .loading-dot {
      width: 8px;
      height: 8px;
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

  &__error-text {
    color: var(--b3-theme-error);
    font-size: 13px;
  }

  &__text {
    min-width: 0;
    overflow-x: auto; /* 表格过宽时可横向滚动 */
  }

  /* 仅助手回答内容增加上下留白，用户消息不受影响 */
  &--assistant &__text {
    margin: 6px 0;
  }

  // 思考过程样式（与下方 token 统计横线保持紧凑）
  &__reasoning {
    margin-bottom: 2px;
    background: var(--b3-theme-surface-lighter);
    border-radius: var(--b3-border-radius);
    overflow: hidden;
  }

  &__reasoning-header {
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

  &__reasoning-icon {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;

    svg {
      width: 12px;
      height: 12px;
      fill: var(--b3-theme-on-surface);
      transition: transform 0.2s;

      &.rotated {
        transform: rotate(90deg);
      }
    }
  }

  &__reasoning-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  &__reasoning-loading {
    display: flex;
    gap: 3px;
    margin-left: auto;

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

  &__reasoning-content {
    padding: 6px 12px 8px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--b3-theme-on-surface);
    white-space: pre-wrap;
    border-top: 1px solid var(--b3-theme-surface-lightest);
  }

  // Token 统计样式
  &__usage {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--b3-theme-on-surface-light);

    // 思源标准图标样式（Token 统计图标不需要点击）
    .block__icon {
      opacity: 1;
      cursor: default;
    }
  }

  &__usage-item {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  &__usage-divider {
    color: var(--b3-theme-on-surface-lightest);
  }

  // 底部区域：统计 + 插入按钮（横线分割，与上方内容保持紧凑）
  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 2px;
    padding-top: 4px;
    border-top: 1px solid var(--b3-theme-surface-lighter);
  }

  &__insert-btn {
    .block__icon {
      cursor: pointer;
      opacity: 0.7;

      &:hover {
        opacity: 1;
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
