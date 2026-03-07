# 聊天消息分组与气泡样式改造计划

## 需求分析

根据截图，需要实现以下效果：

1. **用户消息（"我"）**：以气泡形式展示，头像在右边
2. **AI 助手消息**：多个连续的消息（思考过程、工具调用、回复内容）合并成一个卡片，只展示一次头像

## 当前问题

- 当前每条消息都是独立的 `ChatMessage` 组件，每个都有自己的头像
- AI 助手的思考过程、工具调用、回复内容是分开的消息，显示为多个独立卡片

## 实现方案

### 1. 消息分组逻辑（ChatPanel.vue）

将 `visibleMessages` 改为分组渲染：

```
消息分组规则：
- 用户消息（user）：单独一组
- AI 消息（assistant/tool）：连续的 AI 消息合并为一组

分组数据结构：
{
  type: 'user' | 'assistant',
  messages: ChatMessage[],  // 对于 AI 组，包含 reasoning/tool/content 等
  firstMessage: ChatMessage // 用于显示头像和时间
}
```

### 2. 组件改造

#### ChatPanel.vue 修改：
- 添加 `messageGroups` computed 属性，实现消息分组逻辑
- 修改模板渲染逻辑，按组渲染
- 对于 AI 组，只显示一个头像在顶部
- 组内消息垂直排列，思考过程和工具调用可折叠

#### ChatMessage.vue 修改：
- 添加 `isGrouped` prop，标识是否为分组内的消息
- 当 `isGrouped=true` 时：
  - 不显示头像
  - 不显示头部信息（角色名、时间）
  - 只显示消息内容
- 用户消息添加气泡样式

### 3. 样式设计

#### 用户消息气泡：
```scss
.chat-message--user {
  // 已有：flex-direction: row-reverse;
  
  .chat-message__content {
    background: var(--b3-theme-primary-lightest);
    border-radius: 16px 16px 4px 16px; // 气泡圆角
    padding: 12px 16px;
    max-width: 80%;
  }
}
```

#### AI 消息分组卡片：
```scss
.chat-message-group--assistant {
  display: flex;
  gap: 12px;
  
  .chat-message-group__avatar {
    // 固定在顶部的头像
    position: sticky;
    top: 12px;
  }
  
  .chat-message-group__content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
}
```

### 4. 详细实现步骤

#### 步骤 1：修改 ChatPanel.vue

1. 添加消息分组 computed 属性：
```typescript
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
```

2. 修改模板渲染：
```vue
<template v-else>
  <div
    v-for="(group, groupIndex) in messageGroups"
    :key="groupIndex"
    class="chat-message-group"
    :class="`chat-message-group--${group.type}`"
  >
    <!-- AI 组显示头像 -->
    <div v-if="group.type === 'assistant'" class="chat-message-group__avatar">
      <AiAssistantIcon />
    </div>
    
    <div class="chat-message-group__content">
      <!-- 组头部：角色名和时间 -->
      <div v-if="group.type === 'assistant'" class="chat-message-group__header">
        <span class="chat-message-group__role">AI 助手</span>
        <span class="chat-message-group__time">
          {{ formatTime(group.firstMessage.timestamp) }}
        </span>
      </div>
      
      <!-- 组内消息 -->
      <ChatMessage
        v-for="(message, msgIndex) in group.messages"
        :key="message.id"
        :message="message"
        :tool-call-info="getMessageToolCallInfo(message)"
        :is-grouped="group.messages.length > 1"
        :is-first="msgIndex === 0"
        @insert-to-note="handleInsertToNote"
      />
    </div>
    
    <!-- 用户组显示头像在右边 -->
    <div v-if="group.type === 'user'" class="chat-message-group__avatar">
      <svg><use xlink:href="#iconAccount"></use></svg>
    </div>
  </div>
</template>
```

#### 步骤 2：修改 ChatMessage.vue

1. 添加 props：
```typescript
const props = defineProps<{
  message: ChatMessage;
  toolCallInfo?: { name: string; arguments: string; } | null;
  isGrouped?: boolean;  // 是否为分组内的消息
  isFirst?: boolean;    // 是否为组内第一条
}>();
```

2. 修改模板，根据 `isGrouped` 控制显示：
```vue
<template>
  <div
    class="chat-message"
    :class="{
      'chat-message--user': message.role === 'user',
      'chat-message--assistant': message.role === 'assistant',
      'chat-message--grouped': isGrouped,
      // ... 其他类
    }"
  >
    <!-- 非分组模式下显示头像 -->
    <div v-if="!isGrouped" class="chat-message__avatar">
      <!-- ... -->
    </div>
    
    <div class="chat-message__content">
      <!-- 非分组模式下显示头部 -->
      <div v-if="!isGrouped" class="chat-message__header">
        <!-- ... -->
      </div>
      
      <!-- 消息内容 -->
      <div class="chat-message__body">
        <!-- ... -->
      </div>
    </div>
  </div>
</template>
```

3. 添加分组样式：
```scss
.chat-message--grouped {
  padding: 8px 0;
  background: transparent;
  
  &.chat-message--assistant {
    border-left: none;
  }
}
```

#### 步骤 3：添加分组样式（ChatPanel.vue）

```scss
.chat-message-group {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  
  &--user {
    flex-direction: row-reverse;
    
    .chat-message-group__content {
      align-items: flex-end;
    }
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
    margin-bottom: 8px;
    padding: 0 12px;
  }
  
  &__role {
    font-weight: 600;
    font-size: 13px;
    color: var(--b3-theme-on-surface);
  }
  
  &__time {
    font-size: 11px;
    color: var(--b3-theme-on-surface-light);
  }
}
```

### 5. 边界情况处理

1. **单条 AI 消息**：正常显示，不触发分组样式
2. **用户消息连续发送**：每条用户消息单独成组，保持独立气泡
3. **Token 统计显示**：只在组内最后一条 assistant 消息显示 usage
4. **插入到笔记功能**：保持现有逻辑，只对 assistant 消息有效

## 验收标准

- [ ] 用户消息以气泡形式展示，头像在右侧
- [ ] 连续的 AI 消息（思考过程、工具调用、回复）合并为一个卡片
- [ ] 合并后的 AI 卡片只显示一次头像和角色名
- [ ] 思考过程和工具调用保持可折叠功能
- [ ] Token 统计正确显示在最后一条 AI 消息
- [ ] 插入到笔记功能正常工作
