# ChatPanel 消息分组合并逻辑重构计划

## 问题分析

当前代码存在以下问题：

1. **Template 逻辑过于复杂**：
   - AI 消息组使用嵌套 `v-for` + `template` + 复杂的 `is-first`/`is-last` 计算
   - 用户消息组和 AI 消息组渲染逻辑不一致
   - `shouldRenderMessage` 在 template 中被频繁调用

2. **JS 层数据处理不足**：
   - `messageGroups` 只做了基础分组，没有预计算渲染所需的元数据
   - `is-first`/`is-last` 在 template 中通过 `slice` + `some` 计算，效率低
   - 渲染相关的判断逻辑分散在 template 和 JS 中

3. **ChatMessage 组件内部逻辑过多**：
   - `showFooter`（token 统计显示）在 ChatMessage 内部计算
   - `showInsertBtn`（插入按钮显示）在 ChatMessage 内部计算
   - `showHeader`（头部显示）在 ChatMessage 内部计算
   - 这些逻辑应该由父组件（ChatPanel）控制，通过 props 传递

4. **showToolCalls 处理不够彻底**：
   - 当前在 template 中通过 `v-if` 判断是否渲染 tool 消息
   - 应该在 JS 层直接过滤掉，不放入渲染列表

## 重构目标

1. 在 JS 层面处理好所有数据结构，预计算渲染所需的元数据
2. Template 只负责简单渲染，不包含复杂判断逻辑
3. 统一用户组和 AI 组的处理方式，使代码更清晰
4. 将 ChatMessage 的显示控制逻辑（showHeader/showFooter/showInsertBtn）移到 ChatPanel 统一处理
5. `showToolCalls` 为 false 时，直接在 JS 层过滤 tool 消息

## 重构步骤

### 步骤 1: 定义新的数据结构

```typescript
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
  firstRenderIndex: number;  // 第一个需要渲染的消息索引（始终为 0，因为已过滤）
  lastRenderIndex: number;   // 最后一个需要渲染的消息索引
}
```

### 步骤 2: 重构 ChatPanel 的消息处理逻辑

将原来的 `messageGroups` computed 重构为 `enhancedMessageGroups`：

1. 过滤系统消息
2. **如果 `showToolCalls` 为 false，直接过滤所有 tool 消息**
3. 遍历消息，进行分组
4. 为每条消息预计算：
   - `toolCallInfo`：工具调用信息（仅 tool 消息）
   - `showHeader`：是否显示头部
   - `showFooter`：是否显示底部（token 统计）
   - `showInsertBtn`：是否显示插入按钮
5. 计算每组的 `firstRenderIndex` 和 `lastRenderIndex`

### 步骤 3: 简化 ChatPanel Template

重构后的 template 结构：

```vue
<template>
  <div
    v-for="(group, groupIndex) in enhancedMessageGroups"
    :key="groupIndex"
    class="chat-message-group"
    :class="`chat-message-group--${group.type}`"
  >
    <!-- AI 组头部 -->
    <template v-if="group.type === 'assistant'">
      <div class="chat-message-group__header-row">
        <!-- 头部内容 -->
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
</template>
```

**简化点：**
- 移除 `v-show="message.shouldRender"` - 因为在 JS 层已经过滤
- 移除 `:show-tool-calls` prop - 因为 tool 消息已在 JS 层过滤

### 步骤 4: 修改 ChatMessage 组件

将 ChatMessage 中的 computed 改为 props，并简化 template：

```typescript
const props = defineProps<{
  message: ChatMessage;
  toolCallInfo?: { name: string; arguments: string } | null;
  isGrouped?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  // 新增：由父组件控制的显示逻辑
  showHeader?: boolean;
  showFooter?: boolean;
  showInsertBtn?: boolean;
}>();
```

**ChatMessage template 简化：**
- 移除 `showToolCalls` 相关的判断（因为 tool 消息已在 JS 层过滤或不显示）
- 使用 props 替代 computed 控制显示

### 步骤 5: 移除冗余代码

1. 删除 `shouldRenderMessage` 函数（逻辑移到 computed 中）
2. 删除 `getMessageToolCallInfo` 函数（逻辑移到 computed 中）
3. 删除 `visibleMessages` computed（合并到主 computed 中）
4. 从 ChatMessage 中移除 `showHeader`/`showFooter`/`showInsertBtn` computed

## 预期效果

1. **Template 大幅简化**：
   - 移除复杂的 `v-if` + `v-for` 嵌套
   - 移除 `v-show` 判断
   - `is-first`/`is-last` 变为简单的索引比较
   - 不再需要调用 `shouldRenderMessage` 和 `getMessageToolCallInfo`

2. **性能提升**：
   - 渲染相关的计算只在消息变化时执行一次
   - 避免在 template 中重复调用函数
   - 不需要渲染的消息直接过滤，减少 DOM 节点

3. **代码可维护性**：
   - 数据处理和视图渲染完全分离
   - 统一的处理逻辑，易于理解和修改
   - ChatMessage 变为纯展示组件，逻辑集中在 ChatPanel

## 实现细节

### ChatPanel 新的 computed 属性实现

```typescript
const enhancedMessageGroups = computed<EnhancedMessageGroup[]>(() => {
  const groups: EnhancedMessageGroup[] = [];
  let currentGroup: EnhancedMessageGroup | null = null;

  for (const message of messages.value) {
    // 跳过系统消息
    if (message.role === 'system') continue;
    
    // 如果 showToolCalls 为 false，直接过滤 tool 消息
    if (message.role === 'tool' && props.showToolCalls === false) continue;

    // 预计算所有渲染相关的属性
    const toolCallInfo = message.role === 'tool' 
      ? computeToolCallInfo(message) 
      : null;
    
    // showHeader: 分组时 AI 消息不显示头部（由 Panel 统一显示），用户消息显示
    const showHeader = message.role === 'user' || !props.isGrouped;
    
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
```

### ChatMessage 组件修改

```vue
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
    <!-- 头部 -->
    <div v-if="showHeader" class="chat-message__header-row">
      <div class="chat-message__avatar">
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
      <span class="chat-message__role">{{ roleText }}</span>
      <span class="chat-message__time">{{ formatTime(message.timestamp) }}</span>
    </div>
    
    <div class="chat-message__content">
      <div class="chat-message__body">
        <!-- 思考过程 -->
        <div
          v-if="message.reasoning && !message.toolCalls?.length"
          class="chat-message__reasoning"
          :class="{ 'chat-message__reasoning--collapsed': isReasoningCollapsed }"
        >
          <!-- ... -->
        </div>

        <!-- 加载状态 -->
        <div v-if="message.loading && !message.reasoning && !message.content" class="chat-message__loading">
          <!-- ... -->
        </div>
        
        <!-- 错误状态 -->
        <div v-else-if="message.error" class="chat-message__error-text">
          {{ message.error }}
        </div>
        
        <!-- 工具调用消息（此时 showToolCalls 一定为 true） -->
        <div v-else-if="message.role === 'tool'" class="chat-message__tool-content">
          <!-- ... -->
        </div>
        
        <!-- 普通内容 -->
        <div v-else-if="message.content" class="chat-message__text" v-html="renderedContent"></div>

        <!-- Token 统计和插入按钮 -->
        <div v-if="showFooter" class="chat-message__footer">
          <div v-if="message.usage" class="chat-message__usage">
            <!-- token 统计 ... -->
          </div>
          <div v-if="showInsertBtn" class="chat-message__insert-btn">
            <!-- 插入按钮 ... -->
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  message: ChatMessage;
  toolCallInfo?: { name: string; arguments: string } | null;
  isGrouped?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  showHeader?: boolean;
  showFooter?: boolean;
  showInsertBtn?: boolean;
}>();

// 移除以下 computed：
// - showHeader
// - showFooter  
// - showInsertBtn
// - canInsertToNote
// - showToolCalls 相关判断

// 保留 roleText、renderedContent 等
</script>
```

## 文件修改清单

1. **ChatPanel.vue**:
   - 添加 `RenderMessage` 和 `EnhancedMessageGroup` 接口
   - 重构 `messageGroups` 为 `enhancedMessageGroups`
   - 添加 `setInsertBtnForGroup` 和 `computeToolCallInfo` 辅助函数
   - 删除 `visibleMessages`、`shouldRenderMessage`、`getMessageToolCallInfo`
   - 更新 template，移除 `v-show` 和 `showToolCalls` prop

2. **ChatMessage.vue**:
   - 添加 `showHeader`、`showFooter`、`showInsertBtn` props
   - 移除对应的 computed 属性
   - 移除 `showToolCalls` prop 和相关判断
   - 简化 template
