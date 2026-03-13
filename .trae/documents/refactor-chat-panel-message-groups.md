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

## 重构目标

1. 在 JS 层面处理好所有数据结构，预计算渲染所需的元数据
2. Template 只负责简单渲染，不包含复杂判断逻辑
3. 统一用户组和 AI 组的处理方式，使代码更清晰

## 重构步骤

### 步骤 1: 定义新的数据结构

```typescript
// 带渲染元数据的消息
interface RenderMessage extends ChatMessageType {
  // 是否渲染此消息
  shouldRender: boolean;
  // 工具调用信息（如果是 tool 消息）
  toolCallInfo: { name: string; arguments: string } | null;
}

// 增强的消息组
interface EnhancedMessageGroup {
  type: 'user' | 'assistant';
  messages: RenderMessage[];
  firstMessage: ChatMessageType;
  firstRenderIndex: number;  // 第一个需要渲染的消息索引
  lastRenderIndex: number;   // 最后一个需要渲染的消息索引
}
```

### 步骤 2: 重构消息处理逻辑

将原来的 `messageGroups` computed 重构为 `enhancedMessageGroups`：

1. 过滤系统消息
2. 遍历消息，进行分组
3. 为每条消息预计算：
   - `shouldRender`：是否渲染
   - `toolCallInfo`：工具调用信息（仅 tool 消息）
4. 计算每组的 `firstRenderIndex` 和 `lastRenderIndex`

### 步骤 3: 简化 Template

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
          v-show="message.shouldRender"
          :key="message.id"
          :message="message"
          :tool-call-info="message.toolCallInfo"
          :show-tool-calls="showToolCalls !== false"
          :is-grouped="true"
          :is-first="msgIndex === group.firstRenderIndex"
          :is-last="msgIndex === group.lastRenderIndex"
          @insert-to-note="handleInsertToNote"
        />
      </div>
    </template>
    
    <!-- 用户组 -->
    <template v-else>
      <ChatMessage
        v-for="(message, msgIndex) in group.messages"
        v-show="message.shouldRender"
        :key="message.id"
        :message="message"
        :tool-call-info="message.toolCallInfo"
        :show-tool-calls="showToolCalls !== false"
        :is-grouped="false"
        :is-first="msgIndex === group.firstRenderIndex"
        :is-last="msgIndex === group.lastRenderIndex"
        @insert-to-note="handleInsertToNote"
      />
    </template>
  </div>
</template>
```

### 步骤 4: 移除冗余代码

1. 删除 `shouldRenderMessage` 函数（逻辑移到 computed 中）
2. 删除 `getMessageToolCallInfo` 函数（逻辑移到 computed 中）
3. 删除 `visibleMessages` computed（合并到主 computed 中）

## 预期效果

1. **Template 简化**：
   - 移除复杂的 `v-if` + `v-for` 嵌套
   - `is-first`/`is-last` 变为简单的索引比较
   - 不再需要调用 `shouldRenderMessage` 和 `getMessageToolCallInfo`

2. **性能提升**：
   - 渲染相关的计算只在消息变化时执行一次
   - 避免在 template 中重复调用函数

3. **代码可维护性**：
   - 数据处理和视图渲染分离
   - 统一的处理逻辑，易于理解和修改

## 实现细节

### 新的 computed 属性实现

```typescript
const enhancedMessageGroups = computed<EnhancedMessageGroup[]>(() => {
  const groups: EnhancedMessageGroup[] = [];
  let currentGroup: EnhancedMessageGroup | null = null;

  for (const message of messages.value) {
    // 跳过系统消息
    if (message.role === 'system') continue;

    // 预计算 shouldRender 和 toolCallInfo
    const renderMessage: RenderMessage = {
      ...message,
      shouldRender: computeShouldRender(message),
      toolCallInfo: computeToolCallInfo(message)
    };

    // 分组逻辑（同原逻辑）
    if (message.role === 'user') {
      if (currentGroup) groups.push(currentGroup);
      currentGroup = {
        type: 'user',
        messages: [renderMessage],
        firstMessage: message,
        firstRenderIndex: renderMessage.shouldRender ? 0 : -1,
        lastRenderIndex: renderMessage.shouldRender ? 0 : -1
      };
    } else {
      if (currentGroup?.type === 'assistant') {
        const idx = currentGroup.messages.length;
        currentGroup.messages.push(renderMessage);
        if (renderMessage.shouldRender) {
          if (currentGroup.firstRenderIndex === -1) {
            currentGroup.firstRenderIndex = idx;
          }
          currentGroup.lastRenderIndex = idx;
        }
      } else {
        if (currentGroup) groups.push(currentGroup);
        currentGroup = {
          type: 'assistant',
          messages: [renderMessage],
          firstMessage: message,
          firstRenderIndex: renderMessage.shouldRender ? 0 : -1,
          lastRenderIndex: renderMessage.shouldRender ? 0 : -1
        };
      }
    }
  }

  if (currentGroup) groups.push(currentGroup);
  return groups;
});
```

### 辅助函数

```typescript
function computeShouldRender(message: ChatMessageType): boolean {
  if (message.role === 'tool' && props.showToolCalls === false) return false;
  if (message.role !== 'assistant') return true;
  if (message.loading || message.error) return true;
  if (message.content?.trim()) return true;
  if (message.reasoning?.trim() && !(message.toolCalls && message.toolCalls.length)) return true;
  if (message.usage && !(message.toolCalls && message.toolCalls.length)) return true;
  return false;
}

function computeToolCallInfo(message: ChatMessageType) {
  if (message.role !== 'tool' || !message.toolCallId) {
    return null;
  }
  // 从 messages 中查找对应的 assistant 消息...
}
```
