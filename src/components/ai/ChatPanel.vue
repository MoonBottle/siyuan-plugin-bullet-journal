<template>
  <div class="chat-panel">
    <!-- 消息列表 -->
    <div ref="messagesContainerRef" class="chat-panel__messages">
      <div v-if="messages.length === 0" class="chat-panel__empty">
        <div class="chat-panel__empty-icon">
          <AiAssistantIcon />
        </div>
        <div class="chat-panel__empty-title">
          {{ t('aiChat').emptyTitle }}
        </div>
        <div class="chat-panel__empty-desc">
          {{ t('aiChat').emptyDesc }}
        </div>
        <div class="chat-panel__examples">
          <div
            v-for="(example, index) in examples"
            :key="index"
            class="chat-panel__example"
            @click="handleExampleClick(example)"
          >
            {{ example }}
          </div>
        </div>
      </div>
      <template v-else>
        <div
          v-for="(group, groupIndex) in messageGroups"
          :key="groupIndex"
          class="chat-message-group"
          :class="`chat-message-group--${group.type}`"
        >
          <div class="chat-message-group__content">
            <!-- AI 组：头部在卡片外，仅一条；整组内容包在一个卡片内 -->
            <template v-if="group.type === 'assistant'">
              <div class="chat-message-group__header-row">
                <div class="chat-message-group__avatar-inline">
                  <AiAssistantIcon />
                </div>
                <span class="chat-message-group__role">任务助手</span>
                <span class="chat-message-group__time">
                  {{ formatTime(group.firstMessage.timestamp) }}
                </span>
              </div>
              <div class="chat-message-group__card">
                <ChatMessage
                  v-for="(message, msgIndex) in group.messages"
                  :key="message.id"
                  :message="message"
                  :tool-call-info="getMessageToolCallInfo(message)"
                  :is-grouped="true"
                  :is-first="msgIndex === 0"
                  :is-last="msgIndex === group.messages.length - 1"
                  @insert-to-note="handleInsertToNote"
                />
              </div>
            </template>
            <!-- 用户组 -->
            <template v-else>
              <ChatMessage
                v-for="(message, msgIndex) in group.messages"
                :key="message.id"
                :message="message"
                :tool-call-info="getMessageToolCallInfo(message)"
                :is-grouped="false"
                :is-first="msgIndex === 0"
                :is-last="msgIndex === group.messages.length - 1"
                @insert-to-note="handleInsertToNote"
              />
            </template>
          </div>

          <!-- 用户组不显示头像（在 ChatMessage 中显示） -->
        </div>
      </template>
    </div>

    <!-- 输入区域 -->
    <div class="chat-panel__input-area">
      <div v-if="isAIEnabled && enabledProviders.length > 0" class="chat-panel__input-card">
        <!-- 卡片头部：供应商信息 + 设置按钮 -->
        <div class="chat-panel__card-header">
          <div class="chat-panel__provider-select">
            <div class="chat-panel__provider-avatar">
              <AiAssistantIcon />
            </div>
            <button
              ref="providerSelectRef"
              class="chat-panel__select-btn"
              :class="{ 'is-disabled': isLoading, 'is-single-provider': !isLoading && enabledProviders.length <= 1 }"
              :disabled="isLoading || enabledProviders.length <= 1"
              @click="handleProviderSelectClick"
            >
              <span class="chat-panel__select-label">{{ currentProvider?.name || t('aiChat').selectProvider }}</span>
              <svg v-if="enabledProviders.length > 1" class="chat-panel__select-arrow">
                <use xlink:href="#iconDown"></use>
              </svg>
            </button>
          </div>
          <button class="chat-panel__settings-btn" @click="handleOpenSettings">
            <svg><use xlink:href="#iconSettings"></use></svg>
          </button>
        </div>

        <!-- 卡片主体：输入框 -->
        <div class="chat-panel__card-body">
          <ChatInput
            ref="chatInputRef"
            v-model="inputContent"
            :placeholder="inputPlaceholder"
            :disabled="isLoading || !isAIEnabled"
            @send="handleSend"
          />
        </div>

        <!-- 卡片底部：模型选择 + 发送按钮 -->
        <div class="chat-panel__card-footer">
          <span class="chat-panel__card-footer-spacer"></span>
          <div class="chat-panel__card-footer-actions">
            <button
              ref="modelSelectRef"
              class="chat-panel__select-btn chat-panel__select-btn--small"
              :class="{
                'is-disabled': isLoading || !currentProvider || availableModels.length === 0,
                'is-single-model': !isLoading && !!currentProvider && availableModels.length === 1
              }"
              :disabled="isLoading || !currentProvider || availableModels.length === 0 || availableModels.length <= 1"
              @click="handleModelSelectClick"
            >
              <span class="chat-panel__select-label">{{ selectedModel || t('aiChat').selectModel }}</span>
              <svg v-if="availableModels.length > 1" class="chat-panel__select-arrow">
                <use xlink:href="#iconDown"></use>
              </svg>
            </button>
            <button
              class="chat-panel__send-btn"
              :disabled="!canSend"
              @click="handleSend"
            >
              <svg><use xlink:href="#iconForward"></use></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- 未启用AI时的简化输入 -->
      <div v-else class="chat-panel__input-card chat-panel__input-card--disabled">
        <div class="chat-panel__card-header">
          <div class="chat-panel__provider-info">
            <div class="chat-panel__provider-avatar">
              <svg><use xlink:href="#iconAI"></use></svg>
            </div>
            <span class="chat-panel__provider-name">
              {{ t('aiChat').notConfigured }}
            </span>
          </div>
          <button class="chat-panel__settings-btn" @click="handleOpenSettings">
            <svg><use xlink:href="#iconSettings"></use></svg>
          </button>
        </div>
        <div class="chat-panel__card-body">
          <ChatInput
            ref="chatInputRef"
            v-model="inputContent"
            :placeholder="inputPlaceholder"
            :disabled="true"
          />
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue';
import { useAIStore } from '@/stores';
import { t } from '@/i18n';
import ChatMessage from './ChatMessage.vue';
import ChatInput from './ChatInput.vue';
import AiAssistantIcon from '@/components/icons/AiAssistantIcon.vue';
import type { Project, ProjectGroup, Item } from '@/types/models';
import type { AIProviderConfig, ChatMessage as ChatMessageType } from '@/types/ai';
import { appendBlock, pushMsg } from '@/api';
import { ensureHeadingNewlines, normalizeExcessiveNewlines } from '@/utils/markdownUtils';
import { getActiveEditor, Menu } from 'siyuan';

// 消息分组类型
interface MessageGroup {
  type: 'user' | 'assistant';
  messages: ChatMessageType[];
  firstMessage: ChatMessageType;
}

const props = defineProps<{
  projects: Project[];
  groups: ProjectGroup[];
  items: Item[];
}>();

const emit = defineEmits<{
  openSettings: [];
}>();

const aiStore = useAIStore();

const messagesContainerRef = ref<HTMLDivElement>();
const chatInputRef = ref<InstanceType<typeof ChatInput>>();
const providerSelectRef = ref<HTMLButtonElement>();
const modelSelectRef = ref<HTMLButtonElement>();

const messages = computed(() => aiStore.currentMessages);
const isLoading = computed(() => aiStore.isLoading);
const isAIEnabled = computed(() => aiStore.isAIEnabled);
const enabledProviders = computed(() => aiStore.enabledProviders);

// 输入内容
const inputContent = ref('');

// 是否可以发送
const canSend = computed(() => {
  return inputContent.value.trim().length > 0 && !isLoading.value && isAIEnabled.value;
});

// 当前选中的供应商
const selectedProviderId = computed({
  get: () => aiStore.activeProviderId || '',
  set: (value: string) => {
    aiStore.setActiveProvider(value || null);
  }
});

// 当前选中的供应商配置
const currentProvider = computed<AIProviderConfig | null>(() => {
  return enabledProviders.value.find(p => p.id === selectedProviderId.value) || null;
});

// 当前供应商可用的模型列表
const availableModels = computed(() => {
  return currentProvider.value?.models || [];
});

// 当前选中的模型
const selectedModel = computed({
  get: () => currentProvider.value?.defaultModel || '',
  set: (value: string) => {
    if (currentProvider.value) {
      currentProvider.value.defaultModel = value;
    }
  }
});

// 如果没有选中的供应商，自动选择第一个启用的供应商
watch(() => enabledProviders.value, (providers) => {
  if (providers.length > 0 && !selectedProviderId.value) {
    aiStore.setActiveProvider(providers[0].id);
  }
}, { immediate: true });

// 过滤掉系统消息
const visibleMessages = computed(() => {
  return messages.value.filter(m => m.role !== 'system');
});

// 消息分组：连续的 AI 消息合并为一组
const messageGroups = computed(() => {
  const groups: MessageGroup[] = [];
  let currentGroup: MessageGroup | null = null;

  for (const message of visibleMessages.value) {
    if (message.role === 'user') {
      // 用户消息单独成组
      if (currentGroup) groups.push(currentGroup);
      currentGroup = {
        type: 'user',
        messages: [message],
        firstMessage: message
      };
    } else {
      // AI 消息（assistant/tool）
      if (currentGroup?.type === 'assistant') {
        // 继续当前 AI 组
        currentGroup.messages.push(message);
      } else {
        // 开始新的 AI 组
        if (currentGroup) groups.push(currentGroup);
        currentGroup = {
          type: 'assistant',
          messages: [message],
          firstMessage: message
        };
      }
    }
  }

  if (currentGroup) groups.push(currentGroup);
  return groups;
});

const inputPlaceholder = computed(() => {
  if (!isAIEnabled.value) {
    return t('aiChat').placeholderDisabled;
  }
  return t('aiChat').placeholder;
});

const examples = [
  '我这周有哪些待办任务？',
  '帮我总结一下项目进度',
  '有哪些延期的任务需要关注？',
  '帮我规划下周的工作安排'
];

// 自动滚动到底部
watch(
  () => messages.value.length,
  async () => {
    await nextTick();
    scrollToBottom();
  }
);

// 监听消息内容变化（用于流式响应）
watch(
  () => messages.value.map(m => m.content),
  async () => {
    await nextTick();
    scrollToBottom();
  },
  { deep: true }
);

watch(
  () => isLoading.value,
  async () => {
    await nextTick();
    scrollToBottom();
  }
);

function scrollToBottom() {
  const container = messagesContainerRef.value;
  if (container) {
    // 使用 requestAnimationFrame 确保在 DOM 更新后滚动
    requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    });
  }
}

async function handleSend(content?: string) {
  const messageContent = content || inputContent.value.trim();
  if (!messageContent || isLoading.value || !isAIEnabled.value) return;

  inputContent.value = '';
  await aiStore.sendMessage(messageContent, props.projects, props.groups, props.items);
}

function handleExampleClick(example: string) {
  handleSend(example);
}

function handleOpenSettings() {
  emit('openSettings');
}

// 处理供应商选择点击
function handleProviderSelectClick(event: MouseEvent) {
  if (isLoading.value || enabledProviders.value.length <= 1) return;

  const target = event.currentTarget as HTMLElement;
  if (!target) return;

  event.stopPropagation();
  event.preventDefault();

  const rect = target.getBoundingClientRect();
  const menu = new Menu('chat-panel-provider-select');

  enabledProviders.value.forEach(provider => {
    menu.addItem({
      icon: provider.id === selectedProviderId.value ? 'iconCheck' : undefined,
      label: provider.name,
      click: () => {
        aiStore.setActiveProvider(provider.id);
      }
    });
  });

  menu.open({
    x: rect.left,
    y: rect.bottom + 4
  });
}

// 处理模型选择点击
function handleModelSelectClick(event: MouseEvent) {
  if (isLoading.value || !currentProvider.value || availableModels.value.length === 0) return;

  const target = event.currentTarget as HTMLElement;
  if (!target) return;

  event.stopPropagation();
  event.preventDefault();

  const rect = target.getBoundingClientRect();
  const menu = new Menu('chat-panel-model-select');

  availableModels.value.forEach(model => {
    menu.addItem({
      icon: model === selectedModel.value ? 'iconCheck' : undefined,
      label: model,
      click: () => {
        if (currentProvider.value) {
          currentProvider.value.defaultModel = model;
        }
      }
    });
  });

  // 估算菜单高度（每项约32px），向上弹出
  const estimatedMenuHeight = availableModels.value.length * 32 + 16;
  menu.open({
    x: rect.left,
    y: rect.top - estimatedMenuHeight
  });
}

function focusInput() {
  chatInputRef.value?.focus();
}

// 获取消息对应的工具调用信息
function getMessageToolCallInfo(message: any) {
  if (message.role !== 'tool' || !message.toolCallId) {
    return null;
  }

  // 查找对应的 assistant 消息，获取 toolCalls
  // 从当前消息位置向前查找，找到最近的一条包含该 toolCallId 的 assistant 消息
  const messageIndex = messages.value.findIndex(m => m.id === message.id);
  const searchStartIndex = messageIndex >= 0 ? messageIndex : messages.value.length;

  for (let i = searchStartIndex - 1; i >= 0; i--) {
    const msg = messages.value[i];
    if (msg.role === 'assistant' && msg.toolCalls) {
      const toolCall = msg.toolCalls.find((tc: any) => tc.id === message.toolCallId);
      if (toolCall) {
        return {
          name: toolCall.function.name,
          arguments: toolCall.function.arguments
        };
      }
    }
  }

  return null;
}

// 获取当前激活的文档 ID
function getCurrentDocId(): string | null {
  // 使用思源官方 API 获取当前编辑器
  const editor = getActiveEditor();
  if (editor?.protyle?.block?.rootID) {
    return editor.protyle.block.rootID;
  }
  return null;
}

// 处理插入到笔记
async function handleInsertToNote(message: ChatMessageType) {
  const docId = getCurrentDocId();
  if (!docId) {
    await pushMsg('请先打开一个文档', 3000);
    return;
  }

  try {
    // 格式化消息内容（预处理 ATX 标题换行 + 压缩多余空行）
    const timestamp = new Date(message.timestamp).toLocaleString('zh-CN');
    const normalizedContent = normalizeExcessiveNewlines(ensureHeadingNewlines(message.content));
    const contentToInsert = `> **任务助手** ${timestamp}\n>\n> ${normalizedContent.replace(/\n/g, '\n> ')}`;

    await appendBlock('markdown', contentToInsert, docId);
    await pushMsg('已插入到笔记', 3000);
  } catch (error) {
    console.error('插入到笔记失败:', error);
    await pushMsg('插入失败，请重试', 3000);
  }
}

defineExpose({
  focusInput
});

// 格式化时间
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
</script>

<style lang="scss" scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
  background: var(--b3-theme-background);
  overflow: hidden;

  &__messages {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-gutter: stable;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
    max-height: 100%;
    scroll-behavior: smooth;
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    padding: 32px;
  }

  &__empty-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--b3-theme-primary-lightest);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;

    svg {
      width: 32px;
      height: 32px;
      fill: var(--b3-theme-primary);
    }
  }

  &__empty-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
    margin-bottom: 8px;
  }

  &__empty-desc {
    font-size: 14px;
    color: var(--b3-theme-on-surface);
    margin-bottom: 24px;
  }

  &__examples {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    max-width: 320px;
  }

  &__example {
    padding: 12px 16px;
    background: var(--b3-theme-surface);
    border-radius: var(--b3-border-radius);
    font-size: 14px;
    color: var(--b3-theme-on-surface);
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;

    &:hover {
      background: var(--b3-theme-primary-lightest);
      color: var(--b3-theme-primary);
    }
  }

  &__input-area {
    background: transparent;
    border-top: none;
    padding: 12px 16px;
    padding-right: calc(16px + 12px);
  }

  &__input-card {
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-theme-surface-lighter);
    border-radius: 12px;

    &--disabled {
      opacity: 0.8;
    }
  }

  &__card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: none;
  }

  &__provider-select {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__provider-avatar {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: transparent;
    transform: translateY(-1px); /* 机器人图标视觉上略偏下，微调上移 */

    svg,
    :deep(svg) {
      width: 20px;
      height: 20px;
      fill: var(--b3-theme-primary);
    }
  }

  &__settings-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;

    svg {
      width: 16px;
      height: 16px;
      fill: var(--b3-theme-on-surface);
    }

    &:hover {
      background: var(--b3-theme-surface);

      svg {
        fill: var(--b3-theme-primary);
      }
    }
  }

  &__card-body {
    padding: 8px 12px;
  }

  &__card-footer {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    background: transparent;
  }

  &__card-footer-spacer {
    flex: 1;
    min-width: 0;
  }

  &__card-footer-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  &__send-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: var(--b3-theme-primary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;

    svg {
      width: 14px;
      height: 14px;
      fill: var(--b3-theme-on-primary);
    }

    &:hover:not(:disabled) {
      background: var(--b3-theme-primary-light);
    }

    &:disabled {
      background: var(--b3-theme-surface-lighter);
      cursor: not-allowed;

      svg {
        fill: var(--b3-theme-on-surface-light);
      }
    }
  }

  &__select-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    padding: 4px 10px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-surface);
    cursor: pointer;
    outline: none;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      background: var(--b3-theme-surface-lighter);
    }

    &:disabled,
    &.is-disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* 仅有一个供应商时：不可切换但保持正常样式，不灰显 */
    &.is-single-provider[disabled],
    &.is-single-model[disabled] {
      opacity: 1;
      cursor: default;
    }

    &--small {
      font-size: 12px;
      padding: 2px 8px;
      height: 24px;
    }
  }

  &__select-label {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__select-arrow {
    width: 12px;
    height: 12px;
    fill: var(--b3-theme-on-surface);
    flex-shrink: 0;
  }
}

// 消息分组样式
.chat-message-group {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;

  &--user {
    flex-direction: row-reverse;

    .chat-message-group__content {
      align-items: flex-end;
    }
  }

  &--assistant {
    .chat-message-group__content {
      width: 100%;
    }
    .chat-message-group__card {
      width: 100%;
      box-sizing: border-box;
    }
  }

  &__header-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    min-height: 24px;
  }

  &__avatar-inline {
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

  &__card {
    background: var(--b3-theme-surface);
    border-radius: var(--b3-border-radius);
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  &__card :deep(.chat-message + .chat-message) {
    margin-top: 8px;
  }

  &__avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--b3-theme-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    svg {
      width: 18px;
      height: 18px;
      fill: var(--b3-theme-on-primary);
    }
  }

  &--user &__avatar {
    background: var(--b3-theme-success);
  }

  &__content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  &__header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    padding: 0 12px;
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
}
</style>
