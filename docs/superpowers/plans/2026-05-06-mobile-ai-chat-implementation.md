# Mobile AI Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AI 聊天正式并入移动端 `MobileMainShell` 一级 Tab，并把移动端会话导航改成“聊天页 + 全屏历史页”的页面式交互，同时保持桌面端 `AiChatDock` 行为不变。

**Architecture:** 在移动端新增 `MobileAiPanel` 和 `MobileAiConversationListPage`，由 `MobileMainShell` 统一托管一级 Tab。移动 AI 壳层复用 `aiStore` 与 `ChatPanel`，单独实现移动端顶部导航、历史页切换与会话 CRUD 交互，不继续把移动判断堆进桌面 `AiChatDock`。

**Tech Stack:** TypeScript, Vue 3, Pinia, Vitest, SCSS

---

## File Structure

- Modify: `src/mobile/MobileMainShell.vue`
  - 新增 `ai` 一级 tab，挂载 `MobileAiPanel`，保持 todo FAB 仅在待办显示。
- Modify: `src/mobile/components/navigation/MobileBottomTabBar.vue`
  - 扩展 tab 类型与底栏布局，加入 `ai` 按钮。
- Modify: `src/utils/mobileMainShellNavigation.ts`
  - 扩展 `MobileMainShellTab` 联合类型，兼容后续从其他入口跳转到 `ai`。
- Create: `src/mobile/panels/MobileAiPanel.vue`
  - 移动端 AI 主面板，维护 `chat/history` 视图切换、会话列表刷新、当前标题和更多菜单。
- Create: `src/mobile/components/ai/MobileAiConversationListPage.vue`
  - 全屏历史页，负责列表展示、当前项高亮、删除操作和返回。
- Modify: `src/components/ai/ChatPanel.vue`
  - 仅在测试要求或移动布局需要时补最小 props / class hook；不重构消息生成逻辑。
- Modify: `src/tabs/AiChatDock.vue`
  - 保持桌面端路径清晰；若有共用逻辑需要抽出，只做最小抽离，不把移动 UI 并回这里。
- Test: `test/mobile/MobileMainShell.test.ts`
  - 覆盖 AI 新增为正式 tab，todo FAB 规则保持不变。
- Test: `test/mobile/MobileMainShell.navigation.test.ts`
  - 覆盖 `MobileMainShellTab` 扩展后仍能响应事件导航。
- Create: `test/mobile/MobileAiPanel.test.ts`
  - 覆盖首次进入、历史页切换、选择会话、新建、删除后的兜底。
- Create: `test/mobile/MobileAiConversationListPage.test.ts`
  - 覆盖列表渲染、高亮、删除触发、空状态与返回按钮。
- Test: `test/tabs/AiChatDock.mobile.test.ts`
  - 保留现有回归，确保移动端不回退到桌面 dropdown 交互。

## Task 1: 把 AI 接入移动端 shell 和底部一级导航

**Files:**
- Modify: `src/mobile/MobileMainShell.vue`
- Modify: `src/mobile/components/navigation/MobileBottomTabBar.vue`
- Modify: `src/utils/mobileMainShellNavigation.ts`
- Test: `test/mobile/MobileMainShell.test.ts`
- Test: `test/mobile/MobileMainShell.navigation.test.ts`

- [ ] **Step 1: 先写失败测试，锁定 AI tab 接入 shell 的行为**

在 `test/mobile/MobileMainShell.test.ts` 扩展现有 mock，加入 AI panel stub，并新增用例：

```ts
vi.mock('@/mobile/panels/MobileAiPanel.vue', () => ({
  default: defineComponent({
    name: 'MobileAiPanelStub',
    setup() {
      return () => h('div', { 'data-testid': 'ai-panel' }, 'ai');
    },
  }),
}));

it('renders ai as a first-level tab without showing the todo fab', async () => {
  const mounted = mountShell();
  await nextTick();

  (mounted.container.querySelector('[data-testid="mobile-tab-ai"]') as HTMLButtonElement | null)?.click();
  await nextTick();

  expect(mounted.container.querySelector('[data-testid="ai-panel"]')).not.toBeNull();
  expect(mounted.container.querySelector('[data-testid="mobile-create-fab"]')).toBeNull();

  mounted.unmount();
});
```

在 `test/mobile/MobileMainShell.navigation.test.ts` 扩展导航事件用例：

```ts
vi.mock('@/mobile/panels/MobileAiPanel.vue', () => ({
  default: defineComponent({
    name: 'MobileAiPanelStub',
    setup() {
      return () => h('div', { 'data-testid': 'ai-panel' }, 'ai');
    },
  }),
}));

eventBus.emit(Events.MOBILE_MAIN_SHELL_NAVIGATE, { tab: 'ai' });
await nextTick();

expect(mounted.container.querySelector('[data-testid="ai-panel"]')).not.toBeNull();
expect(mounted.container.querySelector('[data-testid="mobile-tab-ai"]')?.className)
  .toContain('mobile-bottom-tab-bar__button--active');
```

- [ ] **Step 2: 跑定向测试，确认新增断言先失败**

Run:

```bash
npx vitest run test/mobile/MobileMainShell.test.ts test/mobile/MobileMainShell.navigation.test.ts
```

Expected: FAIL，原因应为 `MobileAiPanel` 尚未接入、`mobile-tab-ai` 不存在、`MobileMainShellTab` 还未包含 `ai`。

- [ ] **Step 3: 写最小实现，把 AI 作为正式一级 tab 接入**

在 `src/utils/mobileMainShellNavigation.ts` 把联合类型改为：

```ts
export type MobileMainShellTab = 'todo' | 'ai' | 'pomodoro' | 'habit' | 'more';
```

在 `src/mobile/components/navigation/MobileBottomTabBar.vue`：

```ts
type MobileMainTab = 'todo' | 'ai' | 'pomodoro' | 'habit' | 'more';

const tabs: Array<{ value: MobileMainTab, label: string }> = [
  { value: 'todo', label: '待办' },
  { value: 'ai', label: 'AI' },
  { value: 'pomodoro', label: '番茄钟' },
  { value: 'habit', label: '习惯打卡' },
  { value: 'more', label: '设置' },
];
```

并把 grid 改为：

```scss
grid-template-columns: repeat(5, minmax(0, 1fr));
```

在 `src/mobile/MobileMainShell.vue` 接入：

```vue
<MobileAiPanel v-else-if="activeTab === 'ai'" />
```

同时新增导入：

```ts
import MobileAiPanel from '@/mobile/panels/MobileAiPanel.vue';
```

先创建最小占位版 `src/mobile/panels/MobileAiPanel.vue`：

```vue
<template>
  <div class="mobile-ai-panel" data-testid="mobile-ai-panel">
    AI
  </div>
</template>
```

- [ ] **Step 4: 重新运行 shell 测试，确认接入通过**

Run:

```bash
npx vitest run test/mobile/MobileMainShell.test.ts test/mobile/MobileMainShell.navigation.test.ts
```

Expected: PASS，且 todo / pomodoro / habit 现有行为不回归。

- [ ] **Step 5: Commit**

```bash
git add test/mobile/MobileMainShell.test.ts test/mobile/MobileMainShell.navigation.test.ts src/utils/mobileMainShellNavigation.ts src/mobile/components/navigation/MobileBottomTabBar.vue src/mobile/MobileMainShell.vue src/mobile/panels/MobileAiPanel.vue
git commit -m "feat(mobile): add ai tab to main shell"
```

## Task 2: 实现移动端 AI 主面板和全屏历史页

**Files:**
- Modify: `src/mobile/panels/MobileAiPanel.vue`
- Create: `src/mobile/components/ai/MobileAiConversationListPage.vue`
- Test: `test/mobile/MobileAiPanel.test.ts`
- Test: `test/mobile/MobileAiConversationListPage.test.ts`

- [ ] **Step 1: 先写失败测试，锁定移动端 AI 的页面式交互**

创建 `test/mobile/MobileAiPanel.test.ts`：

```ts
// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import MobileAiPanel from '@/mobile/panels/MobileAiPanel.vue';

const mockAiStore = {
  currentConversation: { id: 'conv-1', title: '新对话', messages: [], createdAt: 1, updatedAt: 1 },
  currentConversationId: 'conv-1',
  showToolCallsEnabled: false,
  getConversationsList: vi.fn(),
  createConversation: vi.fn(),
  switchConversation: vi.fn(),
  deleteConversation: vi.fn(),
  clearCurrentConversation: vi.fn(),
};

vi.mock('@/stores', () => ({
  useAIStore: () => mockAiStore,
  useProjectStore: () => ({ projects: [] }),
  useSettingsStore: () => ({ groups: [] }),
}));

vi.mock('@/components/ai/ChatPanel.vue', () => ({
  default: defineComponent({
    name: 'ChatPanelStub',
    setup() {
      return () => h('div', { 'data-testid': 'chat-panel-stub' }, 'chat');
    },
  }),
}));

function mountPanel() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = createApp(MobileAiPanel);
  app.mount(container);
  return { container, unmount: () => { app.unmount(); container.remove(); } };
}

describe('MobileAiPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAiStore.getConversationsList.mockResolvedValue([
      { id: 'conv-1', title: '新对话', createdAt: 1, updatedAt: 1, messageCount: 0, fileSize: 10, hasSkillExecutions: false },
      { id: 'conv-2', title: '工作复盘', createdAt: 2, updatedAt: 2, messageCount: 4, fileSize: 20, hasSkillExecutions: false },
    ]);
  });

  it('opens the full-screen history page from the header entry', async () => {
    const mounted = mountPanel();
    await nextTick();

    (mounted.container.querySelector('[data-testid=\"mobile-ai-open-history\"]') as HTMLButtonElement | null)?.click();
    await nextTick();

    expect(mounted.container.querySelector('[data-testid=\"mobile-ai-history-page\"]')).not.toBeNull();

    mounted.unmount();
  });

  it('switches conversation and returns to chat after selecting a history item', async () => {
    const mounted = mountPanel();
    await nextTick();

    (mounted.container.querySelector('[data-testid=\"mobile-ai-open-history\"]') as HTMLButtonElement | null)?.click();
    await nextTick();

    (mounted.container.querySelector('[data-testid=\"mobile-ai-history-item-conv-2\"]') as HTMLButtonElement | null)?.click();
    await nextTick();

    expect(mockAiStore.switchConversation).toHaveBeenCalledWith('conv-2');
    expect(mounted.container.querySelector('[data-testid=\"chat-panel-stub\"]')).not.toBeNull();

    mounted.unmount();
  });
});
```

创建 `test/mobile/MobileAiConversationListPage.test.ts`：

```ts
// @vitest-environment happy-dom

import { createApp, nextTick } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import MobileAiConversationListPage from '@/mobile/components/ai/MobileAiConversationListPage.vue';

function mountPage(props: Record<string, unknown>) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = createApp(MobileAiConversationListPage, props);
  app.mount(container);
  return { container, unmount: () => { app.unmount(); container.remove(); } };
}

it('renders current conversation highlight and emits delete/select', async () => {
  const onSelect = vi.fn();
  const onDelete = vi.fn();
  const mounted = mountPage({
    conversations: [
      { id: 'conv-1', title: '新对话', createdAt: 1, updatedAt: 1, messageCount: 0, fileSize: 10, hasSkillExecutions: false },
      { id: 'conv-2', title: '工作复盘', createdAt: 2, updatedAt: 2, messageCount: 2, fileSize: 20, hasSkillExecutions: false },
    ],
    currentConversationId: 'conv-2',
    onSelect,
    onDelete,
  });
  await nextTick();

  expect(mounted.container.querySelector('[data-testid=\"mobile-ai-history-item-conv-2\"]')?.className)
    .toContain('is-active');

  (mounted.container.querySelector('[data-testid=\"mobile-ai-history-item-conv-1\"]') as HTMLButtonElement | null)?.click();
  (mounted.container.querySelector('[data-testid=\"mobile-ai-history-delete-conv-2\"]') as HTMLButtonElement | null)?.click();

  expect(onSelect).toHaveBeenCalledWith('conv-1');
  expect(onDelete).toHaveBeenCalledWith('conv-2');

  mounted.unmount();
});
```

- [ ] **Step 2: 跑测试，确认面板与历史页行为先失败**

Run:

```bash
npx vitest run test/mobile/MobileAiPanel.test.ts test/mobile/MobileAiConversationListPage.test.ts
```

Expected: FAIL，原因应为 `MobileAiPanel` 还只是占位组件，历史页组件不存在。

- [ ] **Step 3: 实现历史页和主面板的最小可用版本**

创建 `src/mobile/components/ai/MobileAiConversationListPage.vue`，定义明确接口：

```vue
<script setup lang="ts">
import type { ConversationIndexItem } from '@/services/conversationStorageService';

defineProps<{
  conversations: ConversationIndexItem[];
  currentConversationId: string | null;
  isLoadingHistory: boolean;
}>();

const emit = defineEmits<{
  back: [];
  select: [conversationId: string];
  delete: [conversationId: string];
  create: [];
}>();
</script>
```

模板要求至少包含：

```vue
<div class="mobile-ai-history-page" data-testid="mobile-ai-history-page">
  <header>
    <button data-testid="mobile-ai-history-back" @click="emit('back')">返回</button>
    <h2>对话历史</h2>
    <button data-testid="mobile-ai-history-create" @click="emit('create')">新建</button>
  </header>

  <button
    v-for="conversation in conversations"
    :key="conversation.id"
    :data-testid="`mobile-ai-history-item-${conversation.id}`"
    :class="{ 'is-active': conversation.id === currentConversationId }"
    @click="emit('select', conversation.id)"
  >
    <span>{{ conversation.title }}</span>
    <button
      :data-testid="`mobile-ai-history-delete-${conversation.id}`"
      @click.stop="emit('delete', conversation.id)"
    >
      删除
    </button>
  </button>
</div>
```

在 `src/mobile/panels/MobileAiPanel.vue` 实现：

```vue
<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import ChatPanel from '@/components/ai/ChatPanel.vue';
import MobileAiConversationListPage from '@/mobile/components/ai/MobileAiConversationListPage.vue';
import { useAIStore, useProjectStore, useSettingsStore } from '@/stores';
import { t } from '@/i18n';

const aiStore = useAIStore();
const projectStore = useProjectStore();
const settingsStore = useSettingsStore();

const viewMode = ref<'chat' | 'history'>('chat');
const conversationsList = ref([]);
const isLoadingHistory = ref(false);
const chatPanelRef = ref<InstanceType<typeof ChatPanel> | null>(null);

const allItems = computed(() => projectStore.items || []);
const currentTitle = computed(() => aiStore.currentConversation?.title || t('aiChat').defaultConversationTitle);

async function refreshConversationsList() {
  isLoadingHistory.value = true;
  conversationsList.value = await aiStore.getConversationsList();
  isLoadingHistory.value = false;
}

async function ensureConversation() {
  await refreshConversationsList();
  if (!aiStore.currentConversationId && conversationsList.value.length === 0) {
    await aiStore.createConversation(t('aiChat').defaultConversationTitle);
    await refreshConversationsList();
  }
}

async function handleOpenHistory() {
  await refreshConversationsList();
  viewMode.value = 'history';
}

async function handleSelectConversation(conversationId: string) {
  await aiStore.switchConversation(conversationId);
  viewMode.value = 'chat';
  await nextTick();
  chatPanelRef.value?.focusInput?.();
}
</script>
```

并补删除兜底：

```ts
async function handleDeleteConversation(conversationId: string) {
  await aiStore.deleteConversation(conversationId);
  await refreshConversationsList();

  if (conversationsList.value.length === 0) {
    await aiStore.createConversation(t('aiChat').defaultConversationTitle);
    await refreshConversationsList();
  }

  viewMode.value = 'chat';
}
```

- [ ] **Step 4: 重新运行移动 AI 定向测试，确认页面式交互通过**

Run:

```bash
npx vitest run test/mobile/MobileAiPanel.test.ts test/mobile/MobileAiConversationListPage.test.ts
```

Expected: PASS，且不会出现桌面 dropdown 依赖。

- [ ] **Step 5: Commit**

```bash
git add test/mobile/MobileAiPanel.test.ts test/mobile/MobileAiConversationListPage.test.ts src/mobile/panels/MobileAiPanel.vue src/mobile/components/ai/MobileAiConversationListPage.vue
git commit -m "feat(mobile): add ai chat panel and history page"
```

## Task 3: 补齐回归边界，确保桌面不退化、移动 CRUD 完整

**Files:**
- Modify: `test/tabs/AiChatDock.mobile.test.ts`
- Modify: `test/mobile/MobileAiPanel.test.ts`
- Modify: `src/mobile/panels/MobileAiPanel.vue`

- [ ] **Step 1: 写失败测试，锁定删除兜底、新建和清空对话动作**

在 `test/mobile/MobileAiPanel.test.ts` 追加：

```ts
it('creates a default conversation when the current list is empty on first mount', async () => {
  mockAiStore.currentConversation = null;
  mockAiStore.currentConversationId = null;
  mockAiStore.getConversationsList.mockResolvedValueOnce([]);
  mockAiStore.getConversationsList.mockResolvedValueOnce([
    { id: 'conv-new', title: '新对话', createdAt: 3, updatedAt: 3, messageCount: 0, fileSize: 10, hasSkillExecutions: false },
  ]);

  const mounted = mountPanel();
  await nextTick();

  expect(mockAiStore.createConversation).toHaveBeenCalled();
  mounted.unmount();
});

it('creates a replacement conversation after deleting the last history item', async () => {
  mockAiStore.getConversationsList
    .mockResolvedValueOnce([{ id: 'conv-1', title: '唯一会话', createdAt: 1, updatedAt: 1, messageCount: 0, fileSize: 10, hasSkillExecutions: false }])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ id: 'conv-new', title: '新对话', createdAt: 2, updatedAt: 2, messageCount: 0, fileSize: 10, hasSkillExecutions: false }]);

  const mounted = mountPanel();
  await nextTick();
  (mounted.container.querySelector('[data-testid=\"mobile-ai-open-history\"]') as HTMLButtonElement | null)?.click();
  await nextTick();
  (mounted.container.querySelector('[data-testid=\"mobile-ai-history-delete-conv-1\"]') as HTMLButtonElement | null)?.click();
  await nextTick();

  expect(mockAiStore.deleteConversation).toHaveBeenCalledWith('conv-1');
  expect(mockAiStore.createConversation).toHaveBeenCalled();
  mounted.unmount();
});
```

并在 `test/tabs/AiChatDock.mobile.test.ts` 保留/补一个明确断言：

```ts
expect(mounted.container.querySelector('[data-testid="conversation-select-stub"]')).not.toBeNull();
```

这条测试不改桌面行为，只确认桌面 dock 仍由原 dropdown 负责。

- [ ] **Step 2: 跑回归测试，确认新边界先失败**

Run:

```bash
npx vitest run test/mobile/MobileAiPanel.test.ts test/tabs/AiChatDock.mobile.test.ts
```

Expected: FAIL，原因应为当前 `MobileAiPanel` 尚未完全处理首屏空列表和删除最后一条后的兜底。

- [ ] **Step 3: 补齐最小实现，确保移动 CRUD 完整且不污染桌面**

在 `src/mobile/panels/MobileAiPanel.vue` 补：

```ts
async function handleCreateConversation() {
  await aiStore.createConversation(t('aiChat').defaultConversationTitle);
  await refreshConversationsList();
  viewMode.value = 'chat';
  await nextTick();
  chatPanelRef.value?.focusInput?.();
}

async function handleClearConversation() {
  await aiStore.clearCurrentConversation();
}
```

聊天页 header 的按钮与更多菜单绑定：

```vue
<button data-testid="mobile-ai-open-history" @click="handleOpenHistory">历史</button>
<button data-testid="mobile-ai-new-conversation" @click="handleCreateConversation">新建</button>
<button data-testid="mobile-ai-clear-conversation" @click="handleClearConversation">清空</button>
```

如果 `ChatPanel` 在移动宽度下出现明显布局问题，只允许补最小 class hook，例如：

```vue
<ChatPanel class="mobile-ai-panel__chat-panel" ... />
```

不要在这一任务里改动消息逻辑或把移动 header 合并进桌面 dock。

- [ ] **Step 4: 跑完整相关测试，确认移动 AI 与既有移动壳层都通过**

Run:

```bash
npx vitest run test/mobile/MobileMainShell.test.ts test/mobile/MobileMainShell.navigation.test.ts test/mobile/MobileAiPanel.test.ts test/mobile/MobileAiConversationListPage.test.ts test/tabs/AiChatDock.mobile.test.ts
```

Expected: PASS，且移动端历史列表不回退到 dropdown。

- [ ] **Step 5: 跑构建，确认 SFC 与类型链路正常**

Run:

```bash
npm run build
```

Expected: PASS，Vite build 成功，新增移动 AI 组件可正常编译。

- [ ] **Step 6: Commit**

```bash
git add test/mobile/MobileAiPanel.test.ts test/mobile/MobileAiConversationListPage.test.ts test/tabs/AiChatDock.mobile.test.ts src/mobile/panels/MobileAiPanel.vue src/mobile/components/ai/MobileAiConversationListPage.vue src/components/ai/ChatPanel.vue
git commit -m "feat(mobile): finish ai chat mobile adaptation"
```
