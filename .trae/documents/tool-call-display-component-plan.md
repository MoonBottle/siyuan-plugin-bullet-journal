# 工具调用展示组件实现计划（独立组件版）

## 需求分析

根据设计图，需要实现一个独立的工具调用展示组件，具有以下特点：

### 图一（折叠状态）
- 整体是一个深色卡片
- 左侧显示工具图标（链条图标）
- 中间显示工具名称（如 `work-assistant/filter_items`）
- 右侧显示展开/折叠箭头
- 可点击展开

### 图二（展开状态）
- 头部保持与折叠状态一致（图标 + 名称 + 箭头）
- 显示"参数"区域，展示 JSON 格式的参数
- 显示"响应"区域，展示 JSON 格式的响应结果
- 响应结果区域支持滚动（有最大高度限制）
- 右侧有复制按钮

## 实现方案

### 1. 新建独立组件

创建文件：`src/components/ai/ToolCallDisplay.vue`

### 2. 组件 Props

```typescript
interface Props {
  // 工具名称
  toolName: string;
  // 工具参数（JSON 字符串或对象）
  params: string | object;
  // 工具响应结果（JSON 字符串或对象）
  result: string | object;
  // 默认是否折叠
  defaultCollapsed?: boolean;
}
```

### 3. 组件结构

```
.tool-call-display
├── .tool-call-display__header (头部：图标 + 名称 + 箭头)
│   ├── .tool-call-display__icon (链条图标)
│   ├── .tool-call-display__name (工具名称)
│   └── .tool-call-display__arrow (展开/折叠箭头)
└── .tool-call-display__body (展开后的内容)
    ├── .tool-call-display__section (参数区域)
    │   ├── .tool-call-display__section-title ("参数"标题)
    │   └── .tool-call-display__section-content (JSON内容)
    └── .tool-call-display__section (响应区域)
        ├── .tool-call-display__section-header ("响应"标题 + 复制按钮)
        └── .tool-call-display__section-content (JSON内容，可滚动)
```

### 4. 样式设计

#### 整体卡片样式
```scss
.tool-call-display {
  background: var(--b3-theme-surface);
  border-radius: var(--b3-border-radius);
  border-left: 3px solid var(--b3-theme-secondary);
  overflow: hidden;
}
```

#### 头部样式
```scss
&__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: var(--b3-theme-surface-lighter);
  }
}

&__icon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  svg {
    width: 14px;
    height: 14px;
    fill: var(--b3-theme-secondary);
  }
}

&__name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-secondary);
  font-family: monospace;
}

&__arrow {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  svg {
    width: 12px;
    height: 12px;
    fill: var(--b3-theme-on-surface-light);
    transition: transform 0.2s;
    
    &.rotated {
      transform: rotate(90deg);
    }
  }
}
```

#### 内容区域样式
```scss
&__body {
  padding: 0 12px 12px;
}

&__section {
  margin-top: 8px;
  
  &:first-child {
    margin-top: 0;
  }
}

&__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

&__section-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--b3-theme-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

&__copy-btn {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s;
  
  &:hover {
    opacity: 1;
  }
  
  svg {
    width: 12px;
    height: 12px;
    fill: var(--b3-theme-on-surface-light);
  }
}

&__section-content {
  background: var(--b3-theme-background);
  border-radius: 4px;
  padding: 8px 12px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px;
  line-height: 1.5;
  color: var(--b3-theme-on-background);
  white-space: pre;
  overflow-x: auto;
  
  // 响应结果区域支持滚动
  &--scrollable {
    max-height: 400px;
    overflow-y: auto;
  }
}
```

### 5. 功能实现

#### 展开/折叠
```typescript
const isCollapsed = ref(props.defaultCollapsed ?? true);

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value;
}
```

#### JSON 格式化
```typescript
function formatJSON(data: string | object): string {
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return String(data);
  }
}

const formattedParams = computed(() => formatJSON(props.params));
const formattedResult = computed(() => formatJSON(props.result));
```

#### 复制功能
```typescript
async function copyResult() {
  try {
    await navigator.clipboard.writeText(formattedResult.value);
    // 可选：显示复制成功提示
  } catch (err) {
    console.error('复制失败:', err);
  }
}
```

### 6. 修改 ChatMessage.vue

在 `ChatMessage.vue` 中：

1. **导入新组件**
```typescript
import ToolCallDisplay from './ToolCallDisplay.vue';
```

2. **替换原有工具调用展示**
将原有的工具调用展示代码（行 78-106）替换为：
```vue
<ToolCallDisplay
  v-else-if="message.role === 'tool'"
  :tool-name="getToolName()"
  :params="getToolParams()"
  :result="message.content"
/>
```

3. **删除旧代码**
- 删除 `isCollapsed` ref
- 删除 `toggleCollapse` 函数
- 删除 `getToolParams` 函数（移至新组件内）
- 删除 `renderedToolParams` computed
- 删除原有工具调用相关样式（行 660-793）

### 7. 文件结构

```
src/components/ai/
├── ChatMessage.vue          # 修改：使用新组件
├── ChatPanel.vue
├── ChatInput.vue
├── ConversationSelect.vue
└── ToolCallDisplay.vue      # 新建：工具调用展示组件
```

### 8. 实施步骤

1. 创建 `ToolCallDisplay.vue` 组件
2. 修改 `ChatMessage.vue` 使用新组件
3. 删除 `ChatMessage.vue` 中的旧工具调用代码和样式

## 注意事项

1. **破坏性重构**：此方案不考虑向后兼容性，直接替换原有实现
2. **样式隔离**：新组件使用 scoped scss，样式完全独立
3. **类型安全**：使用 TypeScript 定义 props 类型
