# 工作台 AI 助理视图设计文档

> 日期: 2026-05-18
> 状态: 待审查

## 1. 目标

在 SiYuan 工作台（Workbench）中新增 **AI 助理** 视图类型，采用**两栏布局**（左侧会话列表 + 右侧 AiChatDock 嵌入），让用户可以在工作台内直接使用 AI 聊天功能，无需打开独立的 Dock 面板。

## 2. 背景

### 现状

* `AiChatDock.vue` — 已有 AI 聊天 Dock 面板（右侧停靠），采用单栏布局：顶部工具栏（含 ConversationSelect 下拉框 + 新建按钮 + 微信 + 更多操作）+ ChatPanel 聊天面板。包含完整的对话管理、微信集成、数据刷新等逻辑。

* `WorkbenchTab.vue` — 工作台 Tab，内部有 View 系统，已支持嵌入 todo、habit、quadrant、pomodoroStats、focusWorkbench、project 等视图类型。

* View 注册链: `types/workbench.ts` → `viewRegistry.ts` → `WorkbenchViewHost.vue` → `workbenchStore.getViewEntryDefinition()`

### 动机

工作台空间充足，AI 聊天功能适合以更宽敞的两栏布局呈现：

* 左侧会话列表比顶部下拉选择更直观（类似 ChatGPT/Claude 的侧边栏体验）

* 右侧直接复用 AiChatDock 的完整功能（聊天、微信、工具调用等）

* 用户在工作台管理任务时，可以随时与 AI 助理交互

## 3. 设计方案

### 3.1 布局结构

```
┌──────────────────────────────────────────────────────────────┐
│  WorkbenchViewHost (.workbench-view-host__surface)           │
│  ┌────────────────┬─────────────────────────────────────┐   │
│  │  会话侧边栏      │    AiChatDock (embedded=true)       │   │
│  │  (240px)       │                                     │   │
│  │                 │  ┌─ 工具栏 (.block__icons) ──────┐ │   │
│  │  ┌──────────┐   │  │ 标题/状态 | 微信 | 更多         │ │   │
│  │  │ + 新建    │   │  └───────────────────────────────┘ │   │
│  │  └──────────┘   │  (ConversationSelect 已隐藏)        │   │
│  │                 │                                     │   │
│  │  会话列表        │  ┌─ ChatPanel ──────────────────┐  │   │
│  │  ┌──────────┐   │  │                               │  │   │
│  │  │ ● 会话1   │   │  │     消息列表                   │  │   │
│  │  ├──────────┤   │  │     (AiChatDock 内部渲染)       │  │   │
│  │  │   会话2   │   │  │                               │  │   │
│  │  ├──────────┤   │  ├───────────────────────────────┤  │   │
│  │  │ 📱 微信x  │   │  │  输入框 + 发送                │  │   │
│  │  └──────────┘   │  └───────────────────────────────┘  │   │
│  └────────────────┴─────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 组件架构

```
AiChatView.vue (新建, ~120 行 — 轻量布局容器)
├── <template>
│   ├── div.ai-chat-view (flex-row, height: 100%)
│   │   ├── aside.ai-chat-view__sidebar (左栏, width: 240px)
│   │   │   ├── .sidebar-header (新建对话按钮)
│   │   │   └── .sidebar-list (会话列表, 可滚动)
│   │   │       └── .conversation-item × N
│   │   └── div.ai-chat-view__dock-area (右栏, flex: 1)
│   │       └── <AiChatDock :embedded="true" /> (完全复用)
├── <script setup>
│   ├── Stores: aiStore (获取对话列表、切换对话)
│   ├── 对话列表数据: conversationsList (从 aiStore 获取)
│   ├── 侧边栏交互: handleNew / handleSelect / handleDelete
│   └── 通过 aiStore 切换对话 → AiChatDock 自动响应
└── <style> (BEM 命名, scoped)

AiChatDock.vue (修改, 加 embedded prop)
├── 新增 props:
│   └── embedded: boolean (default: false)
├── when embedded === true 时:
│   ├── v-if="!embedded" 隐藏 ConversationSelect 组件
│   ├── v-if="!embedded" 隐藏新建对话按钮（由侧边栏接管）
│   ├── 可选：调整工具栏样式（去除多余间距）
│   └── 其余逻辑完全不变（ChatPanel、微信、更多菜单等）
└── when embedded === false (默认): 行为与现在完全一致
```

### 3.3 复用关系

| 来源组件                    | 复用方式                 | 说明                                                  |
| ----------------------- | -------------------- | --------------------------------------------------- |
| `AiChatDock.vue`        | 直接引用 + embedded prop | 右侧面板 99% 复用，embedded 模式下隐藏 ConversationSelect 和新建按钮 |
| `ChatPanel.vue`         | 间接复用（通过 AiChatDock）  | AiChatDock 内部已引用                                    |
| `WeixinLoginDialog.vue` | 间接复用（通过 AiChatDock）  | AiChatDock 内部已引用                                    |
| `aiStore`               | 共享                   | 三方共享（AiChatDock + AiChatView 侧边栏 + 可能的外部 Dock）      |
| ConversationSelect 数据逻辑 | 不需要搬运                | 全部留在 AiChatDock 内部                                  |

**重要：** AiChatView 侧边栏通过 `aiStore.switchConversation(id)` 切换对话，AiChatDock 内部 watch `aiStore.currentConversationId` 自动响应切换。无需组件间 props/events 通信。

## 4. 文件变更清单

### 4.1 新建文件

| 文件路径                                           | 说明                                    | 预估行数    |
| ---------------------------------------------- | ------------------------------------- | ------- |
| `src/components/workbench/view/AiChatView.vue` | 工作台 AI 视图容器（左栏会话列表 + 右栏嵌入 AiChatDock） | \~120 行 |

### 4.2 修改文件

| 文件路径                                                  | 改动内容                                                                       | 改动量    |
| ----------------------------------------------------- | -------------------------------------------------------------------------- | ------ |
| `src/tabs/AiChatDock.vue`                             | 新增 `embedded` prop，条件隐藏 ConversationSelect + 新建按钮                          | \~10 行 |
| `src/types/workbench.ts`                              | `WorkbenchViewType` 联合类型添加 `'aiChat'`                                      | +1 行   |
| `src/workbench/viewRegistry.ts`                       | 注册 `aiChat` 视图定义（type + createDefaultConfig）                               | +5 行   |
| `src/stores/workbenchStore.ts`                        | `getViewEntryDefinition()` 添加 aiChat 条目（icon: `iconSparkles`, title: i18n） | +3 行   |
| `src/components/workbench/view/WorkbenchViewHost.vue` | 添加 `v-else-if="viewType === 'aiChat'"` 分支，引入 AiChatView                    | +6 行   |

### 4.3 不变文件

以下文件**不需要修改**：

* `src/index.ts` — 不需要注册新 Tab/Dock，仅通过工作台 View 系统暴露

* `src/components/ai/ChatPanel.vue` — 完全复用，零改动

* `src/constants.ts` — 不需要新增 TAB\_TYPES / DOCK\_TYPES

## 5. 详细设计

### 5.1 types/workbench.ts

```typescript
export type WorkbenchViewType =
  | 'calendar' | 'gantt' | 'quadrant' | 'project'
  | 'todo' | 'habit' | 'pomodoroStats' | 'focusWorkbench'
  | 'aiChat';  // <-- 新增
```

### 5.2 viewRegistry.ts

```typescript
aiChat: {
  type: 'aiChat',
  createDefaultConfig: () => ({}),
  // 无 openConfigDialog —— 初版无配置项
},
```

### 5.3 workbenchStore.ts — getViewEntryDefinition()

```typescript
aiChat: {
  title: t('aiChat').title,
  icon: 'iconSparkles',
},
```

### 5.4 WorkbenchViewHost.vue

```vue
<div v-else-if="viewType === 'aiChat'" class="workbench-view-host__surface" data-testid="workbench-view-ai-chat">
  <AiChatView :view-config="entry.config" />
</div>
```

### 5.5 AiChatDock.vue 修改规格

#### Props 变更

```typescript
// 新增
defineProps<{
  embedded?: boolean;  // default: false
}>();
```

#### 模板条件渲染变更

```vue
<!-- 之前 (无条件显示) -->
<ConversationSelect ... />
<span @click="handleNewConversation"> <!-- 新建按钮 --> </span>

<!-- 之后 (embedded 模式下隐藏) -->
<ConversationSelect v-if="!embedded" ... />
<span v-if="!embedded" @click="handleNewConversation"> <!-- 新建按钮 --> </span>
```

#### 样式微调（可选）

embedded 模式下可能需要：

* 工具栏左侧标题区域可以保留（显示当前会话标题/状态）

* 无其他样式变更需求（AiChatDock 本身的 flex 布局已适配容器）

### 5.6 AiChatView\.vue 详细规格

#### Props

```typescript
defineProps<{
  viewConfig?: Record<string, unknown>;
}>();
```

#### 模板结构要点

1. **根元素**: `.ai-chat-view` — `display: flex; flex-direction: row; height: 100%; overflow: hidden;`
2. **左侧边栏**: `.ai-chat-view__sidebar` — `width: 240px; flex-shrink: 0; display: flex; flex-direction: column; border-right: 1px solid var(--b3-border-color);`

   * 头部: 新建对话按钮 (`iconAdd`)

   * 列表: 可滚动区域，每个会话项显示标题 + 最后消息时间 + 来源标签（微信来源特殊标记）

   * 当前选中项高亮: `background: var(--b3-theme-background-light);`
3. **右侧区域**: `.ai-chat-view__dock-area` — `flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden;`

   * 渲染 `<AiChatDock :embedded="true" />`

#### Script 逻辑

AiChatView 是轻量容器，核心职责只有**会话侧边栏**的交互：

```typescript
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useAIStore } from '@/stores';
import AiChatDock from '@/tabs/AiChatDock.vue';

const aiStore = useAIStore();

// 会话列表（从 aiStore 获取）
const conversationsList = ref<ConversationIndexItem[]>([]);

// 刷新列表
async function refreshConversationsList() {
  conversationsList.value = await aiStore.getConversationsList();
}

// 新建 → 通知 aiStore → AiChatDock 自动响应
async function handleNew() {
  await aiStore.createConversation(t('aiChat').defaultConversationTitle);
  await refreshConversationsList();
}

// 切换 → 通知 aiStore → AiChatDock watch currentConversationId 自动响应
async function handleSelect(id: string) {
  await aiStore.switchConversation(id);
}

// 删除
async function handleDelete(id: string) {
  await aiStore.deleteConversation(id);
  await refreshConversationsList();
}

// 当前选中的会话 ID（用于高亮）
const activeId = computed(() => aiStore.currentConversationId);

onMounted(async () => {
  await refreshConversationsList();
  if (conversationsList.value.length === 0) {
    await handleNew();
  }
});
```

**关键设计：** 侧边栏和 AiChatDock 之间**不通过 props/events 通信**，而是通过 `aiStore` 这个共享状态中介。侧边栏调用 `aiStore.switchConversation()`，AiChatDock 内部 watch `aiStore.currentConversationId` 变化自动更新。这与现有 AiChatDock 自身工具栏中的 ConversationSelect 切换对话是同一机制。

#### 样式规范

* BEM 命名: `.ai-chat-view{__sidebar, __sidebar-header, __sidebar-list, __sidebar-item, __dock-area}`

* 使用 CSS 变量: `var(--b3-border-color)`, `var(--b3-theme-surface)` 等

* 侧边栏宽度: 固定 240px

* 会话项 hover: `background: var(--b3-theme-hover);`

* 会话项 active: `background: var(--b3-theme-background-light);`

* dock-area: `overflow: hidden` 确保 AiChatDock 的内部滚动正常工作

## 6. 数据流

```
用户点击侧边栏会话项
  → AiChatView.handleSelect(id)
    → aiStore.switchConversation(id)  ←── 共享状态中介
      → AiChatDock 内部 watch currentConversationId 变化
        → ChatPanel 更新消息列表

用户在 ChatPanel 发送消息
  → AiChatDock 内部处理（原有逻辑不变）
    → aiStore 更新当前对话消息

用户点击侧边栏新建
  → AiChatView.handleNew()
    → aiStore.createConversation()
      → AiChatDock 内部 watch currentConversationId → 切换到新对话

数据刷新 (Settings Changed / Cross-context)
  → eventBus / BroadcastChannel
    → AiChatDock 内部的 handleDataRefresh() （原有逻辑不变）
```

## 7. 错误处理

* **初始化失败**: aiStore.initializeStorage() 由 AiChatDock 的 onMounted 处理（原有逻辑）

* **会话列表为空**: AiChatView 的 onMounted 自动创建默认对话

* **网络错误**: 由 AiChatDock / ChatPanel / aiService 内部处理（原有逻辑）

* **微信连接失败**: 由 AiChatDock 内部处理（原有逻辑）

## 8. 测试策略

1. **单元测试**: AiChatView 侧边栏的新建/切换/删除操作
2. **集成测试**: 在 WorkbenchViewHost 中正确渲染 aiChat 视图类型
3. **回归测试**: AiChatDock `embedded=false` 时行为与修改前完全一致
4. **手动验证**:

   * [ ] 工作台侧边栏 → 创建 AI 助理视图 → 显示两栏布局

   * [ ] 左侧会话列表: 新建/切换/删除会话

   * [ ] 点击侧边栏会话项 → 右侧 AiChatDock 聊天区跟随切换

   * [ ] 右侧聊天区: 发送消息、接收回复、工具调用展示

   * [ ] 微信功能正常（连接/断开/微信会话切换）

   * [ ] 与独立 AiChatDock 并存时数据同步

   * [ ] 独立 AiChatDock（embedded=false）功能不受影响

## 9. 未来迭代（不在本次范围）

* [ ] 侧边栏宽度可拖拽调整

* [ ] View Config 弹窗: 配置是否显示微信按钮、工具调用等

* [ ] 会话搜索/过滤

* [ ] 会话分组/归档

* [ ] 移动端适配（折叠侧边栏为抽屉）

