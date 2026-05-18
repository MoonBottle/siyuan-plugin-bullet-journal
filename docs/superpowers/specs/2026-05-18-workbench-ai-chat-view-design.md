# 工作台 AI 助理视图设计文档

> 日期: 2026-05-18
> 状态: 待审查

## 1. 目标

在 SiYuan 工作台（Workbench）中新增 **AI 助理** 视图类型，采用**两栏布局**（左侧会话列表 + 右侧聊天区），让用户可以在工作台内直接使用 AI 聊天功能，无需打开独立的 Dock 面板。

## 2. 背景

### 现状

- `AiChatDock.vue` — 已有 AI 聊天 Dock 面板（右侧停靠），采用单栏布局：顶部工具栏（含 ConversationSelect 下拉框）+ ChatPanel 聊天面板
- `WorkbenchTab.vue` — 工作台 Tab，内部有 View 系统，已支持嵌入 todo、habit、quadrant、pomodoroStats、focusWorkbench、project 等视图类型
- View 注册链: `types/workbench.ts` → `viewRegistry.ts` → `WorkbenchViewHost.vue` → `workbenchStore.getViewEntryDefinition()`

### 动机

工作台空间充足，AI 聊天功能适合以更宽敞的两栏布局呈现：
- 左侧会话列表比顶部下拉选择更直观（类似 ChatGPT/Claude 的侧边栏体验）
- 右侧聊天区域可以完整展示消息和输入区
- 用户在工作台管理任务时，可以随时与 AI 助理交互

## 3. 设计方案

### 3.1 布局结构

```
┌──────────────────────────────────────────────────────────────┐
│  WorkbenchViewHost (.workbench-view-host__surface)           │
│  ┌────────────────┬─────────────────────────────────────┐   │
│  │  会话侧边栏      │          聊天主区域                  │   │
│  │  (240px, 可调)  │                                     │   │
│  │                 │  ┌─ 工具栏 (.block__icons) ──────┐ │   │
│  │  ┌──────────┐   │  │ 标题/状态 | 模型 | 微信 | 更多 │ │   │
│  │  │ + 新建    │   │  └───────────────────────────────┘ │   │
│  │  └──────────┘   │                                     │   │
│  │                 │  ┌─ ChatPanel ──────────────────┐  │   │
│  │  会话列表        │  │                               │  │   │
│  │  ┌──────────┐   │  │     消息列表                   │  │   │
│  │  │ ● 会话1   │   │  │     (复用 ChatPanel.vue)      │  │   │
│  │  ├──────────┤   │  │                               │  │   │
│  │  │   会话2   │   │  │                               │  │   │
│  │  ├──────────┤   │  ├───────────────────────────────┤  │   │
│  │  │ 📱 微信x  │   │  │  输入框 + 发送                │  │   │
│  │  └──────────┘   │  └───────────────────────────────┘  │   │
│  └────────────────┴─────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 组件架构

新建 `AiChatView.vue` 组件（位于 `src/components/workbench/view/`），作为工作台的 AI 聊天视图：

```
AiChatView.vue (新建)
├── <template>
│   ├── div.ai-chat-view (flex-row, height: 100%)
│   │   ├── aside.ai-chat-view__sidebar (左栏, width: 240px)
│   │   │   ├── .sidebar-header (新建对话按钮)
│   │   │   └── .sidebar-list (会话列表, 可滚动)
│   │   │       └── .conversation-item × N (每项: 标题 + 时间 + 来源标签)
│   │   └── main.ai-chat-view__main (右栏, flex: 1, flex-column)
│   │       ├── .block__icons (工具栏: 标题/状态 + 模型选择 + 微信 + 更多)
│   │       ├── WeixinLoginDialog (条件渲染)
│   │       └── ChatPanel (完全复用)
├── <script setup>
│   ├── Stores: settingsStore, projectStore, aiStore (共享 Pinia)
│   ├── 对话管理: conversationsList, CRUD 操作 (复用 AiChatDock 逻辑)
│   ├── 微信集成: ClawBot 状态、连接/断开 (复用 AiChatDock 逻辑)
│   ├── 数据刷新: handleDataRefresh + BroadcastChannel (标准模式)
│   └── 生命周期: onMounted / onUnmounted
└── <style> (BEM 命名, scoped)
```

### 3.3 复用关系

| 来源组件 | 复用方式 | 说明 |
|---------|---------|------|
| `ChatPanel.vue` | 直接引用 | 消息列表 + 输入区，100% 复用 |
| `WeixinLoginDialog.vue` | 条件渲染 | 微信登录弹窗 |
| `ConversationSelect` 数据逻辑 | 搬运 | 对话 CRUD 操作从 AiChatDock 复制 |
| `aiStore` | 共享 | 与 AiChatDock 共享同一个 store 实例 |
| `settingsStore` / `projectStore` | 共享 | 标准 store 使用 |

**重要：** 与 AiChatDock 共享 `aiStore` 意味着两边操作同步——在 AiChatDock 切换会话，AiChatView 也跟随变化；反之亦然。这是预期行为。

## 4. 文件变更清单

### 4.1 新建文件

| 文件路径 | 说明 | 预估行数 |
|---------|------|---------|
| `src/components/workbench/view/AiChatView.vue` | AI 聊天工作台视图组件（两栏布局） | ~250 行 |

### 4.2 修改文件

| 文件路径 | 改动内容 | 改动量 |
|---------|---------|--------|
| `src/types/workbench.ts` | `WorkbenchViewType` 联合类型添加 `'aiChat'` | +1 行 |
| `src/workbench/viewRegistry.ts` | 注册 `aiChat` 视图定义（type + createDefaultConfig） | +5 行 |
| `src/stores/workbenchStore.ts` | `getViewEntryDefinition()` 添加 aiChat 条目（icon: `iconSparkles`, title: i18n） | +3 行 |
| `src/components/workbench/view/WorkbenchViewHost.vue` | 添加 `v-else-if="viewType === 'aiChat'"` 分支，引入 AiChatView | +6 行 |

### 4.3 不变文件

以下文件**不需要修改**：

- `src/tabs/AiChatDock.vue` — 保持原样，Dock 和工作台视图独立共存
- `src/index.ts` — 不需要注册新 Tab/Dock，仅通过工作台 View 系统暴露
- `src/components/ai/ChatPanel.vue` — 完全复用，零改动
- `src/constants.ts` — 不需要新增 TAB_TYPES / DOCK_TYPES

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

### 5.5 AiChatView.vue 详细规格

#### Props

```typescript
defineProps<{
  viewConfig?: Record<string, unknown>;
}>();
```

#### 模板结构要点

1. **根元素**: `.ai-chat-view` — `display: flex; flex-direction: row; height: 100%; overflow: hidden;`
2. **左侧边栏**: `.ai-chat-view__sidebar` — `width: 240px; flex-shrink: 0; display: flex; flex-direction: column; border-right: 1px solid var(--b3-border-color);`
   - 头部: 新建对话按钮 (`iconAdd`)
   - 列表: 可滚动区域，每个会话项显示标题 + 最后消息时间 + 来源标签（微信来源特殊标记）
   - 当前选中项高亮: `background: var(--b3-theme-background-light);`
3. **右侧主区**: `.ai-chat-view__main` — `flex: 1; min-width: 0; display: flex; flex-direction: column;`
   - 工具栏: 复用 `.block__icons` 模式，包含标题/状态、模型选择（如需）、微信按钮、更多操作
   - ChatPanel: `flex: 1; min-height: 0;` 完全复用

#### Script 逻辑（从 AiChatDock 迁移）

核心迁移的逻辑块：

1. **对话管理**:
   - `conversationsList: ref<ConversationIndexItem[]>([])`
   - `refreshConversationsList()` — 从 conversationStorageService 获取
   - `handleNewConversation()` — 创建并聚焦输入框
   - `handleConversationSelect(id)` — 切换并聚焦
   - `handleConversationDelete(id)` — 删除并刷新

2. **微信集成**:
   - `isClawBotConnected`, `hasUnreadWeixin` — computed from aiStore
   - `showWeixinDialog` — 控制登录弹窗
   - `handleWeixinClick()` — 打开弹窗
   - `handleWeixinConversationSwitch(id)` — 切换微信会话

3. **工具栏信息**:
   - `currentHeaderTitle` — 当前会话标题（含微信名称回退）
   - `currentHeaderStatus` — 微信会话状态标签
   - `clawBotTooltip` — 微信按钮提示文字

4. **更多操作菜单**:
   - 清空当前对话
   - 删除当前对话（多于 1 个时显示）
   - 打开设置

5. **数据刷新**: 标准 handleDataRefresh + BroadcastChannel 模式

6. **自动保存**: watch aiStore.providers / activeProviderId → autoSaveConfig

7. **allItems computed**: 从 projectStore 聚合所有 items 传给 ChatPanel

#### 样式规范

- BEM 命名: `.ai-chat-view{__sidebar, __sidebar-header, __sidebar-list, __sidebar-item, __main, __panel}`
- 使用 CSS 变量: `var(--b3-border-color)`, `var(--b3-theme-surface)`, `var(--b3-theme-on-surface)` 等
- 侧边栏宽度: 固定 240px，后续可扩展为可拖拽调整
- 会话项 hover: `background: var(--b3-theme-hover);`
- 会话项 active: `background: var(--b3-theme-background-light);`

## 6. 数据流

```
用户操作 (点击会话项 / 发送消息)
  → AiChatView 方法调用
    → aiStore (共享实例)
      → conversationStorageService (持久化)
      → aiService (API 调用)

数据刷新 (Settings Changed / Cross-context)
  → eventBus / BroadcastChannel
    → handleDataRefresh()
      → settingsStore.$patch() / aiStore.loadSettings()
```

与 AiChatDock 完全对称的数据流，共享同一个 aiStore 实例。

## 7. 错误处理

- **初始化失败**: aiStore.initializeStorage() 异常时，ChatPanel 显示空状态（已有内置处理）
- **网络错误**: 由 aiService / ChatPanel 内部处理（显示重试按钮）
- **会话列表为空**: 自动创建默认对话（与 AiChatDock 一致）
- **微信连接失败**: 显示断连状态，允许重试

## 8. 测试策略

1. **单元测试**: AiChatView 的对话切换、创建、删除逻辑
2. **集成测试**: 在 WorkbenchViewHost 中正确渲染 aiChat 视图类型
3. **手动验证**:
   - [ ] 工作台侧边栏 → 创建 AI 助理视图 → 显示两栏布局
   - [ ] 左侧会话列表: 新建/切换/删除会话
   - [ ] 右侧聊天区: 发送消息、接收回复、工具调用展示
   - [ ] 微信功能: 连接/断开/微信会话切换
   - [ ] 与 AiChatDock 并存时数据同步
   - [ ] 工作台切换到其他视图再切回来，状态保持

## 9. 未来迭代（不在本次范围）

- [ ] 侧边栏宽度可拖拽调整
- [ ] View Config 弹窗: 配置是否显示微信按钮、工具调用等
- [ ] 会话搜索/过滤
- [ ] 会话分组/归档
- [ ] 移动端适配（折叠侧边栏为抽屉）
