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
          v-for="(group, groupIndex) in enhancedMessageGroups"
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
                <span class="chat-message-group__role">{{ t('aiChat').title }}</span>
                <span class="chat-message-group__time">
                  {{ formatTime(group.firstMessage.timestamp) }}
                </span>
              </div>
              <div class="chat-message-group__card">
                <ChatMessage
                  v-for="(message, msgIndex) in group.messages"
                  :key="message.id"
                  :message="message"
                  :tool-call-info="message.toolCallInfo"
                  :is-grouped="true"
                  :is-first="msgIndex === group.firstRenderIndex"
                  :is-last="msgIndex === group.lastRenderIndex"
                  :show-header="message.showHeader"
                  :show-footer="message.showFooter"
                  :show-insert-btn="message.showInsertBtn"
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
                :tool-call-info="message.toolCallInfo"
                :is-grouped="false"
                :is-first="msgIndex === group.firstRenderIndex"
                :is-last="msgIndex === group.lastRenderIndex"
                :show-header="message.showHeader"
                :show-footer="message.showFooter"
                :show-insert-btn="message.showInsertBtn"
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
            <SySelect
              v-model="selectedProviderId"
              :options="providerOptions"
              :placeholder="t('aiChat').selectProvider"
              :disabled="isLoading || enabledProviders.length <= 1"
              placement="bottom"
            />
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
            <SySelect
              v-model="selectedModel"
              :options="modelOptions"
              :placeholder="t('aiChat').selectModel"
              :disabled="isLoading || !currentProvider || availableModels.length === 0"
              placement="top"
            />
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
import SySelect from '@/components/SiyuanTheme/SySelect.vue';
import type { Project, ProjectGroup, Item } from '@/types/models';
import type { AIProviderConfig, ChatMessage as ChatMessageType } from '@/types/ai';
import { appendBlock, pushMsg } from '@/api';
import { smartFormatMarkdown } from '@/utils/markdownRenderer';
import { getActiveEditor } from 'siyuan';

// 带渲染元数据的消息
interface RenderMessage extends ChatMessageType {
  // 工具调用信息（如果是 tool 消息，用于显示工具名称和参数）
  toolCallInfo: { name: string; arguments: string } | null;
  // 是否显示头部（头像、名称、时间）
  showHeader: boolean;
  // 是否显示底部（token 统计）
  showFooter: boolean;
  // 是否显示插入按钮
  showInsertBtn: boolean;
}

// 增强的消息组
interface EnhancedMessageGroup {
  type: 'user' | 'assistant';
  messages: RenderMessage[];
  firstMessage: ChatMessageType;
  firstRenderIndex: number;
  lastRenderIndex: number;
}

const props = defineProps<{
  projects: Project[];
  groups: ProjectGroup[];
  items: Item[];
  showToolCalls?: boolean;
}>();

const emit = defineEmits<{
  openSettings: [];
}>();

const aiStore = useAIStore();

const messagesContainerRef = ref<HTMLDivElement>();
const chatInputRef = ref<InstanceType<typeof ChatInput>>();

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

// 供应商选项列表
const providerOptions = computed(() => {
  return enabledProviders.value.map(provider => ({
    value: provider.id,
    label: provider.name
  }));
});

// 模型选项列表
const modelOptions = computed(() => {
  return availableModels.value.map(model => ({
    value: model,
    label: model
  }));
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

// 计算工具调用信息
function computeToolCallInfo(message: ChatMessageType) {
  if (message.role !== 'tool' || !message.toolCallId) {
    return null;
  }

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

// 增强的消息分组：预计算所有渲染相关的元数据
const enhancedMessageGroups = computed<EnhancedMessageGroup[]>(() => {
  const groups: EnhancedMessageGroup[] = [];
  let currentGroup: EnhancedMessageGroup | null = null;

  for (const message of messages.value) {
    // 跳过系统消息
    if (message.role === 'system') continue;

    // 如果 showToolCalls 为 false，直接过滤 tool 消息
    if (message.role === 'tool' && props.showToolCalls === false) continue;

    // 预计算工具调用信息
    const toolCallInfo = message.role === 'tool'
      ? computeToolCallInfo(message)
      : null;

    // showHeader: 用户消息显示头部，AI 消息在分组模式下不显示（由 Panel 统一显示）
    const showHeader = message.role === 'user';

    // showFooter: 只有 assistant 消息且不含 toolCalls 时才显示
    const showFooter = message.role === 'assistant' && !message.toolCalls?.length;

    const renderMessage: RenderMessage = {
      ...message,
      toolCallInfo,
      showHeader,
      showFooter,
      showInsertBtn: false // 临时值，后面根据 isLast 设置
    };

    // 分组逻辑
    if (message.role === 'user') {
      // 用户消息单独成组
      if (currentGroup) {
        // 设置上一组的插入按钮
        setInsertBtnForGroup(currentGroup);
        groups.push(currentGroup);
      }
      currentGroup = {
        type: 'user',
        messages: [renderMessage],
        firstMessage: message,
        firstRenderIndex: 0,
        lastRenderIndex: 0
      };
    } else {
      // AI 消息（assistant/tool）
      if (currentGroup?.type === 'assistant') {
        const idx = currentGroup.messages.length;
        currentGroup.messages.push(renderMessage);
        currentGroup.lastRenderIndex = idx;
      } else {
        if (currentGroup) {
          setInsertBtnForGroup(currentGroup);
          groups.push(currentGroup);
        }
        currentGroup = {
          type: 'assistant',
          messages: [renderMessage],
          firstMessage: message,
          firstRenderIndex: 0,
          lastRenderIndex: 0
        };
      }
    }
  }

  if (currentGroup) {
    setInsertBtnForGroup(currentGroup);
    groups.push(currentGroup);
  }

  return groups;
});

// 设置组的插入按钮（只有最后一条可插入的 assistant 消息显示）
function setInsertBtnForGroup(group: EnhancedMessageGroup) {
  if (group.type === 'assistant' && group.lastRenderIndex >= 0) {
    const lastMsg = group.messages[group.lastRenderIndex];
    const canInsert = lastMsg.role === 'assistant' &&
                     !lastMsg.loading &&
                     lastMsg.content?.trim();
    if (canInsert) {
      lastMsg.showInsertBtn = true;
    }
  }
}

const inputPlaceholder = computed(() => {
  if (!isAIEnabled.value) {
    return t('aiChat').placeholderDisabled;
  }
  return t('aiChat').placeholder;
});

const examples = [
  t('aiChat').example1,
  t('aiChat').example2,
  t('aiChat').example3,
  t('aiChat').example4
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

async function handleSend(content?: string | Event) {
  const messageContent = (typeof content === 'string' ? content : '').trim() || inputContent.value.trim();
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

function focusInput() {
  chatInputRef.value?.focus();
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
    // 使用 Lute 格式化消息内容（规范化 Markdown 格式 + 压缩多余空行）
    const timestamp = new Date(message.timestamp).toLocaleString('zh-CN');
    const formattedContent = smartFormatMarkdown(message.content);
    const contentToInsert = `> **${t('aiChat').title}** ${timestamp}\n>\n> ${formattedContent.replace(/\n/g, '\n> ')}`;

    await appendBlock('markdown', contentToInsert, docId);
    await pushMsg(t('aiChat').insertSuccess, 3000);
  } catch (error) {
    console.error('插入到笔记失败:', error);
    await pushMsg(t('aiChat').insertFailed, 3000);
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
    user-select: text; /* 允许选中复制对话内容 */
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

  // SySelect 样式覆盖 - 保持和改造前按钮样式一致
  &__provider-select,
  &__card-footer-actions {
    :deep(.sy-select__trigger) {
      background: var(--b3-theme-surface);
      border-color: var(--b3-theme-surface-lighter);
      color: var(--b3-theme-on-surface);

      &:hover:not(:disabled) {
        background: var(--b3-theme-surface-lighter);
        border-color: var(--b3-theme-surface-lighter);
      }

      &.is-open {
        border-color: var(--b3-theme-primary);
        box-shadow: 0 0 0 2px var(--b3-theme-primary-lightest);
      }

      &:disabled,
      &.is-disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    :deep(.sy-select__label) {
      color: var(--b3-theme-on-background);
    }

    :deep(.sy-select__arrow) {
      fill: var(--b3-theme-on-surface);
    }
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
    margin-bottom: 6px;
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
    gap: 6px;
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
