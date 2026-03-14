# AI Chat 工具调用展示配置项实现计划

## 需求分析

用户希望在 AI Chat 界面中增加一个配置项，用于控制是否展示工具调用（tool calls）的详细信息。

从截图中可以看到，当前 AI 对话会显示工具调用的展开/收起区域（如 `get_pomodoro_stats`、`get_pomodoro_records` 等），用户希望能够通过配置来控制这些工具调用的展示行为。

## 当前代码结构分析

### 1. 类型定义 (`src/types/ai.ts`)

* `AIProviderConfig` - 供应商配置接口

* `ChatMessage` - 聊天消息接口，包含 `toolCalls` 字段

* `ToolCall` - 工具调用接口

### 2. AI Store (`src/stores/aiStore.ts`)

* 管理 AI 配置和对话状态

* 包含 `providers`, `activeProviderId`, `conversations` 等状态

* 需要添加 `showToolCalls` 配置项

### 3. 设置组件 (`src/components/settings/AiConfigSection.vue`)

* AI 配置区域组件

* 负责渲染供应商列表和添加新供应商

* 需要在此添加工具调用展示的配置开关

### 4. 聊天消息组件 (`src/components/ai/ChatMessage.vue`)

* 渲染单条聊天消息

* 工具调用消息（role='tool'）的渲染逻辑在此

* 需要根据配置决定是否展示工具调用详情

### 5. 聊天面板 (`src/components/ai/ChatPanel.vue`)

* 管理消息列表和整体布局

* 传递工具调用信息给 ChatMessage

### 6. AI Chat Dock (`src/tabs/AiChatDock.vue`)

* AI 聊天侧边栏主组件

* 需要传递配置到 ChatPanel

### 7. 国际化文件 (`src/i18n/zh_CN.json`)

* 需要添加工具调用配置相关的翻译文本

## 实现步骤

### 步骤 1: 更新类型定义

**文件**: `src/types/ai.ts`

在 `AIProviderConfig` 接口中添加 `showToolCalls` 字段：

```typescript
export interface AIProviderConfig {
  id: string;
  name: string;
  provider: AIProvider;
  apiKey: string;
  apiUrl: string;
  models: string[];
  defaultModel: string;
  enabled: boolean;
  showToolCalls?: boolean; // 新增：是否展示工具调用
}
```

### 步骤 2: 更新 AI Store

**文件**: `src/stores/aiStore.ts`

1. 在 `AIStoreSettings` 接口中添加全局的 `showToolCalls` 配置：

```typescript
export interface AIStoreSettings {
  providers: AIProviderConfig[];
  activeProviderId: string | null;
  conversations: ChatConversation[];
  currentConversationId: string | null;
  showToolCalls?: boolean; // 新增
}
```

1. 添加状态、getter 和 action：

```typescript
const showToolCalls = ref<boolean>(true); // 默认开启

const showToolCallsEnabled = computed(() => showToolCalls.value);

function setShowToolCalls(value: boolean) {
  showToolCalls.value = value;
}

// 在 loadSettings 中加载配置
if (settings.showToolCalls !== undefined) {
  showToolCalls.value = settings.showToolCalls;
}

// 在 getExportData 中导出配置
showToolCalls: showToolCalls.value,
```

### 步骤 3: 更新设置组件

**文件**: `src/components/settings/AiConfigSection.vue`

在供应商列表下方添加一个全局配置区域，使用 `SySettingItem` 和 `SySwitch` 组件实现工具调用展示开关：

1. 添加 imports：

```typescript
import SySettingItem from '@/components/SiyuanTheme/SySettingItem.vue';
import SySettingItemList from '@/components/SiyuanTheme/SySettingItemList.vue';
import SySwitch from '@/components/SiyuanTheme/SySwitch.vue';
```

1. 添加 props 和 emits：

```typescript
const props = defineProps<{
  ai: {
    providers: AIProviderConfig[];
    activeProviderId: string | null;
    showToolCalls?: boolean; // 新增
  };
}>();

const emit = defineEmits<{
  'update:ai': [value: { providers: AIProviderConfig[]; activeProviderId: string | null; showToolCalls?: boolean }];
}>();
```

1. 添加开关控件（使用 SySettingItem 和 SySwitch）：

```vue
<!-- 工具调用展示配置 -->
<SySettingItemList>
  <SySettingItem
    :label="(t('settings') as any).ai?.showToolCalls ?? '显示工具调用详情'"
    :description="(t('settings') as any).ai?.showToolCallsDesc ?? '在对话中展示 AI 工具调用的详细信息和执行结果'"
  >
    <SySwitch
      :model-value="props.ai.showToolCalls !== false"
      @update:model-value="handleShowToolCallsChange"
    />
  </SySettingItem>
</SySettingItemList>
```

1. 添加处理函数：

```typescript
function handleShowToolCallsChange(checked: boolean) {
  emit('update:ai', { ...props.ai, showToolCalls: checked });
}
```

### 步骤 4: 更新聊天面板

**文件**: `src/components/ai/ChatPanel.vue`

1. 添加 `showToolCalls` prop：

```typescript
const props = defineProps<{
  projects: Project[];
  groups: ProjectGroup[];
  items: Item[];
  showToolCalls?: boolean; // 新增
}>();
```

1. 传递给 ChatMessage 组件：

```vue
<ChatMessage
  v-if="shouldRenderMessage(message)"
  :message="message"
  :tool-call-info="getMessageToolCallInfo(message)"
  :show-tool-calls="props.showToolCalls !== false"
  :is-grouped="true"
  ...
/>
```

### 步骤 5: 更新聊天消息组件

**文件**: `src/components/ai/ChatMessage.vue`

1. 添加 prop：

```typescript
const props = defineProps<{
  message: ChatMessage;
  toolCallInfo?: { name: string; arguments: string } | null;
  isGrouped?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  showToolCalls?: boolean; // 新增
}>();
```

1. 修改工具调用消息的渲染逻辑，使用 `v-if` 控制整个工具调用消息是否展示：

```vue
<!-- 工具调用消息：根据 showToolCalls 配置决定是否展示 -->
<div 
  v-else-if="message.role === 'tool' && props.showToolCalls !== false" 
  class="chat-message__tool-content"
>
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
```

### 步骤 6: 更新 AI Chat Dock

**文件**: `src/tabs/AiChatDock.vue`

1. 在 `handleDataRefresh` 中处理 `showToolCalls` 配置：

```typescript
if (payload.showToolCalls !== undefined) {
  aiStore.setShowToolCalls(payload.showToolCalls as boolean);
}
```

1. 在 `onMounted` 中加载配置：

```typescript
if (pluginSettings?.ai?.showToolCalls !== undefined) {
  aiStore.setShowToolCalls(pluginSettings.ai.showToolCalls);
}
```

1. 传递配置到 ChatPanel：

```vue
<ChatPanel
  ref="chatPanelRef"
  class="ai-chat-dock__panel"
  :projects="projectStore.projects"
  :groups="settingsStore.groups"
  :items="allItems"
  :show-tool-calls="aiStore.showToolCallsEnabled"
  @open-settings="handleOpenSettings"
/>
```

### 步骤 7: 更新国际化文件

**文件**: `src/i18n/zh_CN.json`

在 `settings.ai` 部分添加：

```json
"ai": {
  "title": "AI 服务配置",
  "description": "配置 AI 服务商，启用侧边栏 AI 对话功能",
  ...
  "showToolCalls": "显示工具调用详情",
  "showToolCallsDesc": "在对话中展示 AI 工具调用的详细信息和执行结果"
}
```

### 步骤 8: 更新英文国际化文件

**文件**: `src/i18n/en_US.json`

添加对应的英文翻译：

```json
"ai": {
  "showToolCalls": "Show Tool Call Details",
  "showToolCallsDesc": "Display detailed information and execution results of AI tool calls in conversations"
}
```

## 数据流总结

1. **设置保存**: 用户在 `AiConfigSection.vue` 中切换开关 → 触发 `update:ai` 事件 → 父组件更新配置 → 调用 `plugin.saveAISettings()` 保存

2. **配置加载**: 插件启动时从 `plugin.getSettings()` 读取配置 → `AiChatDock.vue` 中调用 `aiStore.loadSettings()` → 设置 `showToolCalls` 状态

3. **配置传递**: `AiChatDock.vue` 从 `aiStore` 获取 `showToolCallsEnabled` → 作为 prop 传递给 `ChatPanel.vue` → 传递给 `ChatMessage.vue`

4. **视图渲染**: `ChatMessage.vue` 根据 `showToolCalls` prop 决定是否渲染工具调用的详细信息

## 兼容性考虑

1. **向后兼容**: `showToolCalls` 默认为 `true`，保持现有行为不变
2. **配置迁移**: 旧配置中没有 `showToolCalls` 字段时，默认为 `true`
3. **类型安全**: 所有新增字段都使用可选类型 `?:`，避免破坏现有代码

