# 思考过程组件化计划

## 目标
将 `ChatMessage.vue` 中的思考过程（reasoning）部分封装成独立的 `ReasoningDisplay.vue` 组件，参考 `ToolCallDisplay.vue` 的设计模式。

## 当前代码分析

### ChatMessage.vue 中的思考过程代码（第 39-64 行）
```vue
<div
  v-if="message.reasoning && !(message.toolCalls && message.toolCalls.length)"
  class="chat-message__reasoning"
  :class="{ 'chat-message__reasoning--collapsed': isReasoningCollapsed }"
>
  <div class="chat-message__reasoning-header" @click="toggleReasoning">
    <span class="chat-message__reasoning-icon">
      <svg v-if="isReasoningCollapsed">
        <use xlink:href="#iconDown"></use>
      </svg>
      <svg v-else>
        <use xlink:href="#iconUp"></use>
      </svg>
    </span>
    <span class="chat-message__reasoning-title">{{ t('aiChat').reasoningTitle }}</span>
    <span v-if="message.loading && !message.content && !message.reasoning" class="chat-message__reasoning-loading">
      <span class="loading-dot"></span>
      <span class="loading-dot"></span>
      <span class="loading-dot"></span>
    </span>
  </div>
  <div v-if="!isReasoningCollapsed" class="chat-message__reasoning-content">
    {{ message.reasoning }}
  </div>
</div>
```

### 相关逻辑（第 170-189 行）
```typescript
const isReasoningCollapsed = ref(true);

function toggleReasoning() {
  isReasoningCollapsed.value = !isReasoningCollapsed.value;
}
```

### 相关样式（第 647-721 行）
约 75 行的 SCSS 样式代码

## 组件设计

### 新组件: ReasoningDisplay.vue

#### Props
| 属性名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| content | string | 是 | - | 思考过程内容 |
| loading | boolean | 否 | false | 是否处于加载状态 |
| defaultCollapsed | boolean | 否 | true | 默认是否折叠 |

#### 与 ToolCallDisplay.vue 的对比

| 特性 | ToolCallDisplay | ReasoningDisplay |
|------|-----------------|------------------|
| 折叠/展开 | ✓ | ✓ |
| 头部图标 | 工具图标 + 箭头 | 思考图标 + 箭头 |
| 内容区域 | 参数 + 响应 | 单一内容 |
| 复制功能 | 有 | 可选添加 |
| 加载状态 | 无 | 有 |

#### 组件结构
```
reasoning-display
├── reasoning-display__header (点击切换折叠)
│   ├── reasoning-display__arrow (折叠/展开箭头)
│   ├── reasoning-display__icon (思考图标)
│   └── reasoning-display__title (标题 + 可选加载动画)
└── reasoning-display__content (展开后的内容)
```

## 实施步骤

1. **创建新组件** `src/components/ai/ReasoningDisplay.vue`
   - 参考 ToolCallDisplay.vue 的结构
   - 实现折叠/展开功能
   - 实现加载状态显示
   - 迁移并优化样式

2. **修改 ChatMessage.vue**
   - 引入 ReasoningDisplay 组件
   - 替换原有的 reasoning 相关模板代码
   - 删除相关的逻辑代码（isReasoningCollapsed, toggleReasoning）
   - 删除相关的样式代码

3. **验证**
   - 确保功能与原代码一致
   - 确保样式无回归

## 文件变更清单

### 新增文件
- `src/components/ai/ReasoningDisplay.vue`

### 修改文件
- `src/components/ai/ChatMessage.vue`
  - 删除第 39-64 行的 reasoning 模板
  - 删除第 170 行的 isReasoningCollapsed ref
  - 删除第 188-190 行的 toggleReasoning 函数
  - 删除第 647-721 行的 reasoning 样式
  - 添加 ReasoningDisplay 组件引用
