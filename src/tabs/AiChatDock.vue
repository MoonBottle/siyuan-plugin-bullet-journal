<template>
  <div class="fn__flex-1 fn__flex-column ai-chat-dock">
    <!-- 头部工具栏 -->
    <div class="block__icons">
      <div class="block__logo">
        <AiAssistantIcon class="block__logoicon" />
        {{ t('aiChat').title }}
      </div>
      <span class="fn__flex-1 fn__space"></span>

      <!-- 对话选择下拉框 -->
      <ConversationSelect
        :conversations="conversationsList"
        :current-conversation-id="aiStore.currentConversationId"
        @select="handleConversationSelect"
        @delete="handleConversationDelete"
        @create="handleNewConversation"
      />

      <!-- 新建对话按钮 -->
      <span
        class="block__icon b3-tooltips b3-tooltips__sw"
        :aria-label="t('aiChat').newConversation"
        @click="handleNewConversation"
      >
        <svg>
          <use xlink:href="#iconAdd"></use>
        </svg>
      </span>

      <!-- 技能管理按钮 -->
      <!-- <span
        class="block__icon b3-tooltips b3-tooltips__sw"
        :aria-label="t('settings').aiSkills?.title ?? 'AI 技能配置'"
        @click="openSkillManager"
      >
        <SkillIcon />
      </span> -->

      <!-- 微信连接按钮 -->
      <span
        class="block__icon b3-tooltips b3-tooltips__sw weixin-btn"
        :class="{ 'is-active': isClawBotConnected, 'has-unread': hasUnreadWeixin }"
        :aria-label="clawBotTooltip"
        @click="handleWeixinClick"
      >
        <WeixinIcon :is-connected="isClawBotConnected" />
        <span v-if="hasUnreadWeixin" class="unread-badge"></span>
      </span>

      <!-- 更多操作按钮 -->
      <span
        class="block__icon b3-tooltips b3-tooltips__sw"
        :aria-label="t('common').more"
        @click="handleMoreClick"
      >
        <svg>
          <use xlink:href="#iconMore"></use>
        </svg>
      </span>
    </div>

    <!-- 微信登录弹窗 -->
    <WeixinLoginDialog
      v-if="showWeixinDialog"
      @close="showWeixinDialog = false"
      @switch-conversation="handleWeixinConversationSwitch"
    />

    <!-- 聊天面板 -->
    <ChatPanel
      ref="chatPanelRef"
      class="ai-chat-dock__panel"
      :projects="projectStore.projects"
      :groups="settingsStore.groups"
      :items="allItems"
      :show-tool-calls="aiStore.showToolCallsEnabled"
      @open-settings="handleOpenSettings"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { Menu, showMessage, getFrontend } from 'siyuan';

// 判断是否为移动端
const isMobile = computed(() => {
  const frontEnd = getFrontend();
  return frontEnd === 'mobile' || frontEnd === 'browser-mobile';
});
import { usePlugin } from '@/main';
import { useSettingsStore, useProjectStore, useAIStore } from '@/stores';
import { eventBus, Events, DATA_REFRESH_CHANNEL } from '@/utils/eventBus';
import { useConversationStorage, type ConversationIndexItem } from '@/services/conversationStorageService';
import ChatPanel from '@/components/ai/ChatPanel.vue';
import ConversationSelect from '@/components/ai/ConversationSelect.vue';
import AiAssistantIcon from '@/components/icons/AiAssistantIcon.vue';
import SkillIcon from '@/components/icons/SkillIcon.vue';
import WeixinIcon from '@/components/icons/WeixinIcon.vue';
import WeixinLoginDialog from '@/components/ai/WeixinLoginDialog.vue';
import { t } from '@/i18n';
import type { Item } from '@/types/models';
import { createDialog } from '@/utils/dialog';
import { createApp } from 'vue';
import { getSharedPinia } from '@/utils/sharedPinia';
import AiSkillConfigSection from '@/components/settings/AiSkillConfigSection.vue';
import { openTab } from 'siyuan';

const plugin = usePlugin() as any;
const settingsStore = useSettingsStore();
const projectStore = useProjectStore();
const aiStore = useAIStore();

// 对话列表（从存储服务获取，仅元数据）
const conversationsList = ref<ConversationIndexItem[]>([]);

// 自动保存防抖定时器
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

const chatPanelRef = ref<InstanceType<typeof ChatPanel>>();

// 微信登录弹窗状态
const showWeixinDialog = ref(false);

// 打开技能管理弹框
const openSkillManager = () => {
  const container = document.createElement('div');
  
  const dialog = createDialog({
    title: '',
    content: '',
    width: '600px',
    destroyCallback: () => {
      app.unmount();
    }
  });
  
  const app = createApp(AiSkillConfigSection, {
    dialog,
    onEditSkill: (docId: string) => {
      // 打开文档
      const plugin = usePlugin() as any;
      if (plugin?.app && docId) {
        openTab({
          app: plugin.app,
          doc: { id: docId }
        });
      }
      // 关闭弹框
      dialog.destroy();
    },
    onClose: () => {
      dialog.destroy();
    }
  });
  
  app.use(getSharedPinia());
  app.mount(container);
  
  const bodyEl = dialog.element.querySelector('.b3-dialog__body');
  if (bodyEl) {
    bodyEl.appendChild(container);
  }
};

// ClawBot 状态
const isClawBotConnected = computed(() => aiStore.isClawBotConnected);
const hasUnreadWeixin = computed(() => aiStore.hasUnreadWeixin);
const clawBotTooltip = computed(() => {
  if (isClawBotConnected.value) {
    return '微信已连接';
  }
  return '连接微信';
});

// 微信按钮点击
function handleWeixinClick(event: MouseEvent) {
  event.stopPropagation();
  event.preventDefault();
  showWeixinDialog.value = true;
}

// 切换到微信会话
async function handleWeixinConversationSwitch(conversationId: string) {
  await aiStore.switchConversation(conversationId);
  await refreshConversationsList();
}

// 获取所有事项
const allItems = computed<Item[]>(() => {
  const items: Item[] = [];
  for (const project of projectStore.projects) {
    for (const task of project.tasks) {
      for (const item of task.items) {
        items.push({
          ...item,
          project,
          task
        });
      }
    }
  }
  return items;
});

// 刷新对话列表
async function refreshConversationsList() {
  conversationsList.value = await aiStore.getConversationsList();
}

// 数据刷新处理函数
const handleDataRefresh = async (payload?: Record<string, unknown>) => {
  if (!plugin) return;
  const storeKeys = ['directories', 'groups', 'defaultGroup', 'lunchBreakStart', 'lunchBreakEnd', 'showPomodoroBlocks', 'showPomodoroTotal', 'todoDock', 'ai'];
  const hasStorePayload = payload && typeof payload === 'object' && storeKeys.some(k => k in payload);
  if (hasStorePayload) {
    const patch: Record<string, unknown> = {};
    storeKeys.forEach(k => { if (k !== 'ai' && payload[k] !== undefined) patch[k] = payload[k]; });
    if (Object.keys(patch).length > 0) settingsStore.$patch(patch);
    if (payload.ai && typeof payload.ai === 'object') {
      aiStore.loadSettings({
        providers: (payload.ai as any).providers || [],
        activeProviderId: (payload.ai as any).activeProviderId || null,
        showToolCalls: (payload.ai as any).showToolCalls
      });
    }
  } else {
    settingsStore.loadFromPlugin();
    const pluginSettings = plugin?.getSettings?.();
    if (pluginSettings?.ai) {
      aiStore.loadSettings({
        providers: pluginSettings.ai.providers || [],
        activeProviderId: pluginSettings.ai.activeProviderId || null,
        showToolCalls: pluginSettings.ai.showToolCalls
      });
    }
  }
  await nextTick();
  await projectStore.refresh(plugin, settingsStore.scanMode, settingsStore.directories);
};

// 新建对话
const handleNewConversation = async () => {
  await aiStore.createConversation(t('aiChat').defaultConversationTitle);
  await refreshConversationsList();
  nextTick(() => {
    chatPanelRef.value?.focusInput();
  });
};

// 选择对话
const handleConversationSelect = async (conversationId: string) => {
  await aiStore.switchConversation(conversationId);
  nextTick(() => {
    chatPanelRef.value?.focusInput();
  });
};

// 删除对话
const handleConversationDelete = async (conversationId: string) => {
  await aiStore.deleteConversation(conversationId);
  await refreshConversationsList();
};

// 更多按钮点击事件
const handleMoreClick = (event: MouseEvent) => {
  event.stopPropagation();
  event.preventDefault();

  const target = event.currentTarget as HTMLElement;
  if (!target) return;

  const rect = target.getBoundingClientRect();

  const menu = new Menu('ai-chat-more-menu');

  // 清空当前对话
  menu.addItem({
    icon: 'iconTrashcan',
    label: t('aiChat').clearConversation,
    click: async () => {
      await aiStore.clearCurrentConversation();
      showMessage(t('aiChat').conversationCleared);
    }
  });

  // 删除当前对话
  if (conversationsList.value.length > 1) {
    menu.addItem({
      icon: 'iconClose',
      label: t('aiChat').deleteConversation,
      click: async () => {
        if (aiStore.currentConversationId) {
          await aiStore.deleteConversation(aiStore.currentConversationId);
          await refreshConversationsList();
          showMessage(t('aiChat').conversationDeleted);
        }
      }
    });
  }

  // 打开设置（移动端隐藏）
  if (!isMobile.value) {
    menu.addSeparator();
    menu.addItem({
      icon: 'iconSettings',
      label: t('settings').title,
      click: () => {
        handleOpenSettings();
      }
    });
  }

  menu.open({
    x: rect.left,
    y: rect.bottom + 4,
    isLeft: true
  });
};

// 打开设置
const handleOpenSettings = () => {
  if (plugin?.openSetting) {
    plugin.openSetting();
  }
};

// 事件取消订阅函数
let unsubscribeRefresh: (() => void) | null = null;
let refreshChannel: BroadcastChannel | null = null;

// 自动保存配置（带防抖）
const autoSaveConfig = () => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(async () => {
    if (plugin?.saveAISettings) {
      try {
        await plugin.saveAISettings(aiStore.getExportData());
      } catch (error) {
        console.error('[AI Chat] Auto save config failed:', error);
      }
    }
  }, 1000);
};

// 初始化数据
onMounted(async () => {
  // 初始化存储服务（内部已加载对话列表）
  await aiStore.initializeStorage(plugin);
  
  // 加载对话列表（initializeStorage 已加载，但为保险起见再次刷新）
  await refreshConversationsList();

  // 如果没有对话，创建一个默认对话
  if (conversationsList.value.length === 0) {
    await aiStore.createConversation(t('aiChat').defaultConversationTitle);
    // createConversation 内部已刷新对话列表
  }

  // 初始化 ClawBot（如果已启用）
  await aiStore.initializeClawBot(plugin);

  // 从插件加载设置
  settingsStore.loadFromPlugin();

  // 从插件设置加载 AI 配置
  const pluginSettings = plugin?.getSettings?.();
  if (pluginSettings?.ai) {
    aiStore.loadSettings({
      providers: pluginSettings.ai.providers || [],
      activeProviderId: pluginSettings.ai.activeProviderId || null,
      showToolCalls: pluginSettings.ai.showToolCalls
    });
  }

  // 监听数据刷新事件
  unsubscribeRefresh = eventBus.on(Events.DATA_REFRESH, handleDataRefresh);

  // 跨上下文：Dock 可能在 iframe 中，用 BroadcastChannel 接收
  try {
    refreshChannel = new BroadcastChannel(DATA_REFRESH_CHANNEL);
    refreshChannel.onmessage = (e: MessageEvent) => {
      const data = e?.data;
      if (data?.type === 'DATA_REFRESH') {
        const { type: _t, ...rest } = data;
        handleDataRefresh(Object.keys(rest).length > 0 ? rest : undefined);
      }
    };
  } catch {
    // 忽略
  }

  // 监听配置变化，自动保存
  watch(() => aiStore.providers, () => {
    autoSaveConfig();
  }, { deep: true });

  watch(() => aiStore.activeProviderId, () => {
    autoSaveConfig();
  });

  // 聚焦输入框
  nextTick(() => {
    chatPanelRef.value?.focusInput();
  });
});

onUnmounted(() => {
  if (unsubscribeRefresh) {
    unsubscribeRefresh();
  }
  if (refreshChannel) {
    refreshChannel.close();
    refreshChannel = null;
  }
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
});
</script>

<style lang="scss" scoped>
.ai-chat-dock {
  height: 100%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &__conversation-select {
    margin-right: 8px;

    select {
      min-width: 120px;
      max-width: 160px;
      padding: 4px 24px 4px 8px;
      font-size: 13px;
    }
  }

  &__panel {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
}

.block__icons {
  flex-shrink: 0;

  .block__icon {
    opacity: 1;
  }
}

// 技能管理弹框样式

// 微信图标样式
.weixin-btn {
  position: relative;
  
  :deep(svg) {
    width: 16px;
    height: 16px;
    fill: var(--b3-theme-on-surface-light);
    transition: fill 0.2s;
  }

  &.is-active {
    background: var(--b3-theme-success-lightest);
    
    :deep(svg) {
      fill: #07c160; // 微信绿色
    }
  }

  &.has-unread {
    .unread-badge {
      position: absolute;
      top: 4px;
      right: 4px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--b3-theme-error);
    }
  }
}

</style>
