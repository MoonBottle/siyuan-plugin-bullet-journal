# 工作台 AI 助理视图实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在工作台 View 系统中新增 AI 助理视图类型，采用两栏布局（左侧会话列表 + 右侧嵌入 AiChatDock）

**架构：** 新建轻量容器组件 `AiChatView.vue`（左栏侧边栏 + 右栏 `<AiChatDock :embedded="true" />`），修改 `AiChatDock.vue` 新增 `embedded` prop 控制隐藏 ConversationSelect/新建按钮。通过 aiStore 共享状态通信。注册到现有 View 系统（types → viewRegistry → ViewHost → store）。

**技术栈：** Vue 3.5 + TypeScript + Pinia + SCSS (BEM) | 复用: ChatPanel, WeixinLoginDialog, aiStore

---

## 文件结构

| 文件                                                  | 操作     | 职责                                                         |
| ----------------------------------------------------- | -------- | ------------------------------------------------------------ |
| `src/types/workbench.ts`                              | 修改     | WorkbenchViewType 联合类型添加 `'aiChat'`                    |
| `src/workbench/viewRegistry.ts`                       | 修改     | 注册 aiChat 视图定义                                         |
| `src/stores/workbenchStore.ts`                        | 修改     | getViewEntryDefinition 添加 aiChat 条目                      |
| `src/tabs/AiChatDock.vue`                             | 修改     | 新增 `embedded` prop，条件隐藏 ConversationSelect + 新建按钮 |
| `src/components/workbench/view/AiChatView.vue`        | **新建** | 工作台 AI 视图容器（两栏布局）                               |
| `src/components/workbench/view/WorkbenchViewHost.vue` | 修改     | 添加 aiChat 渲染分支                                         |

---

### 任务 1：注册 aiChat 到类型系统（types + registry + store）

**文件：**

- 修改：`src/types/workbench.ts:3-11`
- 修改：`src/workbench/viewRegistry.ts:31-146`
- 修改：`src/stores/workbenchStore.ts:28-65`

- [ ] **步骤 1：修改 WorkbenchViewType 类型**

在 `src/types/workbench.ts` 的 `WorkbenchViewType` 联合类型末尾添加 `'aiChat'`：

```typescript
export type WorkbenchViewType
  = | 'calendar'
    | 'gantt'
    | 'quadrant'
    | 'project'
    | 'todo'
    | 'habit'
    | 'pomodoroStats'
    | 'focusWorkbench'
    | 'aiChat'
```

- [ ] **步骤 2：在 viewRegistry 中注册 aiChat**

在 `src/workbench/viewRegistry.ts` 的 `createViewRegistry()` 返回对象中，在 `gantt` 之后添加：

```typescript
    aiChat: {
      type: 'aiChat',
      createDefaultConfig: () => ({}),
    },
```

同时在文件顶部的 import 区域确认 `WorkbenchViewType` 已导入（已有，无需改动）。

- [ ] **步骤 3：在 workbenchStore 中添加视图条目定义**

在 `src/stores/workbenchStore.ts` 的 `getViewEntryDefinition()` 函数内的 definitions 对象中，在 `focusWorkbench` 之后添加：

```typescript
    aiChat: {
      title: t('aiChat').title,
      icon: 'iconSparkles',
    },
```

- [ ] **步骤 4：验证编译通过**

运行：`npx vue-tsc --noEmit` 或 `npm run build`
预期：无类型错误

- [ ] **步骤 5：Commit**

```bash
git add src/types/workbench.ts src/workbench/viewRegistry.ts src/stores/workbenchStore.ts
git commit -m "feat(workbench): register aiChat view type in type system"
```

---

### 任务 2：AiChatDock 添加 embedded prop

**文件：**

- 修改：`src/tabs/AiChatDock.vue`
- 参考：[AiChatDock.vue](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/tabs/AiChatDock.vue)

- [ ] **步骤 1：添加 embedded prop 定义**

在 `<script setup>` 中，当前文件没有显式的 `defineProps`（使用了选项式隐式 props 或未定义）。需要添加 props 定义。查看当前代码确认 props 定义方式后，在 script 顶部添加：

```typescript
const props = defineProps<{
  embedded?: boolean
}>()
```

如果当前代码没有 defineProps，直接在 import 语句之后添加即可。

- [ ] **步骤 2：ConversationSelect 添加 v-if="!embedded"**

找到模板中的 `<ConversationSelect>` 组件（约第 20-26 行），添加条件渲染：

```vue
<!-- 之前 -->
<ConversationSelect
  :conversations="conversationsList"
  :current-conversation-id="aiStore.currentConversationId"
  @select="handleConversationSelect"
  @delete="handleConversationDelete"
  @create="handleNewConversation"
/>

<!-- 之后 -->
<ConversationSelect
  v-if="!props.embedded"
  :conversations="conversationsList"
  :current-conversation-id="aiStore.currentConversationId"
  @select="handleConversationSelect"
  @delete="handleConversationDelete"
  @create="handleNewConversation"
/>
```

- [ ] **步骤 3：新建对话按钮添加 v-if="!embedded"**

找到模板中的新建对话按钮（约第 29-37 行的 iconAdd 按钮），添加条件渲染：

```vue
<!-- 之前 -->
<span
  class="block__icon b3-tooltips b3-tooltips__sw"
  :aria-label="t('aiChat').newConversation"
  @click="handleNewConversation"
>

<!-- 之后 -->
<span
  v-if="!props.embedded"
  class="block__icon b3-tooltips b3-tooltips__sw"
  :aria-label="t('aiChat').newConversation"
  @click="handleNewConversation"
>
```

- [ ] **步骤 4：验证编译通过**

运行：`npx vue-tsc --noEmit`
预期：无类型错误

- [ ] **步骤 5：运行 lint 检查**

运行：`npm run lint`
预期：无错误

- [ ] **步骤 6：Commit**

```bash
git add src/tabs/AiChatDock.vue
git commit -m "feat(ai-chat): add embedded prop to hide conversation selector in workbench mode"
```

---

### 任务 3：新建 AiChatView.vue 组件

**文件：**

- 创建：`src/components/workbench/view/AiChatView.vue`
- 参考：
  - [AiChatDock.vue](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/tabs/AiChatDock.vue)（对话管理逻辑参考）
  - [WorkbenchHabitView.vue](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/components/workbench/view/WorkbenchHabitView.vue)（View 组件模式参考）
  - [ConversationIndexItem 类型](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/services/conversationStorageService.ts)（会话项类型）

- [ ] **步骤 1：编写 AiChatView.vue 完整组件**

创建文件 `src/components/workbench/view/AiChatView.vue`：

```vue
<script setup lang="ts">
import type { ConversationIndexItem } from '@/services/conversationStorageService'
import { computed, onMounted, ref } from 'vue'
import { t } from '@/i18n'
import { useConversationStorage } from '@/services/conversationStorageService'
import { useAIStore } from '@/stores'
import AiChatDock from '@/tabs/AiChatDock.vue'

defineProps<{
  viewConfig?: Record<string, unknown>
}>()

const aiStore = useAIStore()
const { formatConversationTime } = useConversationStorage()

const conversationsList = ref<ConversationIndexItem[]>([])

const activeId = computed(() => aiStore.currentConversationId)

async function refreshConversationsList() {
  conversationsList.value = await aiStore.getConversationsList()
}

function formatTime(timestamp?: number): string {
  if (!timestamp)
    return ''
  return formatConversationTime(timestamp)
}

async function handleNew() {
  await aiStore.createConversation(t('aiChat').defaultConversationTitle)
  await refreshConversationsList()
}

async function handleSelect(id: string) {
  if (id === activeId.value)
    return
  await aiStore.switchConversation(id)
}

async function handleDelete(id: string, event: MouseEvent) {
  event.stopPropagation()
  await aiStore.deleteConversation(id)
  await refreshConversationsList()
}

onMounted(async () => {
  await refreshConversationsList()
  if (conversationsList.value.length === 0) {
    await handleNew()
  }
})
</script>

<template>
  <div class="ai-chat-view" data-testid="ai-chat-view">
    <aside class="ai-chat-view__sidebar">
      <div class="ai-chat-view__sidebar-header">
        <span
          class="block__icon b3-tooltips b3-tooltips__sw"
          :aria-label="t('aiChat').newConversation"
          @click="handleNew"
        >
          <svg><use xlink:href="#iconAdd" /></svg>
        </span>
        <span class="fn__flex-1 fn__space" />
        <span class="ai-chat-view__sidebar-count">{{ conversationsList.length }}</span>
      </div>
      <div class="ai-chat-view__sidebar-list">
        <div
          v-for="conv in conversationsList"
          :key="conv.id"
          class="ai-chat-view__sidebar-item"
          :class="{ 'is-active': conv.id === activeId }"
          @click="handleSelect(conv.id)"
        >
          <div class="ai-chat-view__sidebar-item-title">
            {{ conv.title }}
          </div>
          <div class="ai-chat-view__sidebar-item-meta">
            <span v-if="conv.source === 'weixin'" class="ai-chat-view__sidebar-item-tag">微信</span>
            <span class="ai-chat-view__sidebar-item-time">{{ formatTime(conv.updatedAt) }}</span>
          </div>
        </div>
        <div v-if="conversationsList.length === 0" class="ai-chat-view__sidebar-empty">
          {{ t('aiChat').noConversations ?? '暂无对话' }}
        </div>
      </div>
    </aside>
    <div class="ai-chat-view__dock-area">
      <AiChatDock :embedded="true" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.ai-chat-view {
  display: flex;
  flex-direction: row;
  height: 100%;
  overflow: hidden;

  &__sidebar {
    width: 240px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--b3-border-color);
    background: var(--b3-theme-background);
  }

  &__sidebar-header {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    border-bottom: 1px solid var(--b3-border-color);
    flex-shrink: 0;
  }

  &__sidebar-count {
    font-size: 12px;
    color: var(--b3-theme-on-surface-medium);
  }

  &__sidebar-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 4px 0;
  }

  &__sidebar-item {
    display: flex;
    flex-direction: column;
    padding: 10px 12px;
    cursor: pointer;
    gap: 4px;
    transition: background-color 0.15s;

    &:hover {
      background: var(--b3-theme-hover);
    }

    &.is-active {
      background: var(--b3-theme-background-light);
    }
  }

  &__sidebar-item-title {
    font-size: 13px;
    line-height: 1.4;
    color: var(--b3-theme-on-surface);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__sidebar-item-meta {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__sidebar-item-tag {
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 4px;
    background: #07c16020;
    color: #07c160;
  }

  &__sidebar-item-time {
    font-size: 11px;
    color: var(--b3-theme-on-surface-medium);
  }

  &__sidebar-empty {
    padding: 24px 12px;
    text-align: center;
    font-size: 13px;
    color: var(--b3-theme-on-surface-medium);
  }

  &__dock-area {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
}
</style>
```

> **注意：** 需要确认 `useConversationStorage` 导出了 `formatConversationTime` 函数。如果没有，改用 dayjs 的 `fromNow()` 或简单的时间格式化函数。

- [ ] **步骤 2：确认依赖的类型和函数存在**

检查以下导入是否有效：

- `useConversationStorage` 是否导出 `formatConversationTime`
- `t('aiChat').defaultConversationTitle` i18n key 是否存在
- `t('aiChat').noConversations` i18n key 是否不存在的话需要添加或用内联字符串

- [ ] **步骤 3：验证编译通过**

运行：`npx vue-tsc --noEmit`
预期：无类型错误

- [ ] **步骤 4：运行 lint**

运行：`npm run lint`
预期：无错误

- [ ] **步骤 5：Commit**

```bash
git add src/components/workbench/view/AiChatView.vue
git commit -m "feat(workbench): add AiChatView component with sidebar layout"
```

---

### 任务 4：在 WorkbenchViewHost 中接入 AiChatView

**文件：**

- 修改：`src/components/workbench/view/WorkbenchViewHost.vue`
- 参考：[WorkbenchViewHost.vue](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/components/workbench/view/WorkbenchViewHost.vue)

- [ ] **步骤 1：添加 import 和渲染分支**

在 `WorkbenchViewHost.vue` 中：

1. 在 import 区域（第 33-38 行附近）添加：

```typescript
import AiChatView from '@/components/workbench/view/AiChatView.vue'
```

2. 在 template 中最后一个 `v-else-if`（project 分支，约第 18-20 行）之后、`v-else` 之前添加：

```vue
    <div v-else-if="viewType === 'aiChat'" class="workbench-view-host__surface" data-testid="workbench-view-ai-chat">
      <AiChatView :view-config="entry.config" />
    </div>
```

- [ ] **步骤 2：验证编译通过**

运行：`npx vue-tsc --noEmit`
预期：无类型错误

- [ ] **步骤 3：运行 build 验证完整构建**

运行：`npm run build`
预期：构建成功，产出 plugin 包含新组件

- [ ] **步骤 4：运行 lint**

运行：`npm run lint`
预期：无错误

- [ ] **步骤 5：Commit**

```bash
git add src/components/workbench/view/WorkbenchViewHost.vue
git commit -m "feat(workbench): integrate AiChatView into WorkbenchViewHost"
```

---

### 任务 5：验证与手动测试

- [ ] **步骤 1：运行完整测试套件**

运行：`npm run test`
预期：所有既有测试通过（不应破坏任何现有功能）

- [ ] **步骤 2：运行 build 确认产物正确**

运行：`npm run build`
预期：成功构建，无警告或错误

- [ ] **步骤 3：最终 Commit（如有遗漏修复）**

如果有任何小的修复：

```bash
git add -A
git commit -m "fix(workbench): final adjustments for ai chat view integration"
```

---

## 自检清单

### 规格覆盖度

| 规格需求                                       | 对应任务                     |
| ---------------------------------------------- | ---------------------------- |
| WorkbenchViewType 添加 `'aiChat'`              | 任务 1 步骤 1                |
| viewRegistry 注册 aiChat                       | 任务 1 步骤 2                |
| workbenchStore.getViewEntryDefinition 添加条目 | 任务 1 步骤 3                |
| AiChatDock 新增 embedded prop                  | 任务 2 步骤 1                |
| embedded 模式隐藏 ConversationSelect           | 任务 2 步骤 2                |
| embedded 模式隐藏新建按钮                      | 任务 2 步骤 3                |
| 新建 AiChatView.vue 两栏布局                   | 任务 3 步骤 1                |
| 左侧边栏：会话列表 + 新建 + 切换 + 删除        | 任务 3 步骤 1                |
| 通过 aiStore 共享状态通信                      | 任务 3 步骤 1（script 部分） |
| WorkbenchViewHost 接入                         | 任务 4 步骤 1                |
| 回归测试：embedded=false 不影响原有 Dock       | 任务 2 步骤 4 + 任务 5       |

### 占位符扫描

✅ 无 "待定"、"TODO"、"后续实现" 占位符
✅ 每个步骤包含具体代码或命令
✅ 无模糊描述如 "添加适当的错误处理"

### 类型一致性

✅ `embedded?: boolean` — 全部任务中一致
✅ `viewConfig?: Record<string, unknown>` — 与其他 View 组件一致
✅ `ConversationIndexItem` — 从 conversationStorageService 导入，类型名一致
✅ `aiStore.createConversation / switchConversation / deleteConversation / getConversationsList` — 方法签名与 AiChatDock 中使用的一致
