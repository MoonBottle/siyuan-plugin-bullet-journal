# 为思源日历视图增加事项状态图标

## 背景
参考 Obsidian 插件 `CalendarView.tsx` 的实现，为思源插件的日历视图添加事项状态图标显示功能。

## Obsidian 实现分析
在 Obsidian 插件中，状态图标通过 `handleEventContent` 函数实现（第 151-204 行）：

```typescript
const getStatusEmoji = (itemStatus: string | undefined): string => {
  if (itemStatus === 'completed') return '✅ ';
  if (itemStatus === 'abandoned') return '❌ ';
  return '⏳ ';
};

const statusEmoji = getStatusEmoji(status);
```

状态图标规则：
- `completed` → ✅
- `abandoned` → ❌
- `pending` (默认) → ⏳

## 实现计划

### 修改文件
- `c:\dev\projects\open-source\siyuan-plugin-bullet-journal\src\components\calendar\CalendarView.vue`

### 具体步骤

#### 1. 修改 `renderEventContent` 函数
在现有的 `renderEventContent` 函数中添加状态图标逻辑：

- 添加 `getStatusEmoji` 辅助函数，根据状态返回对应的 emoji
- 在事件内容渲染时，在标题前添加状态图标
- 保持现有的时间显示和任务名显示逻辑不变

#### 2. 实现细节
修改位置：第 33-67 行的 `renderEventContent` 函数

修改内容：
1. 从 `arg.event.extendedProps` 获取 `status` 属性
2. 添加 `getStatusEmoji` 函数定义
3. 在标题元素前添加状态图标显示

#### 3. 代码变更

```typescript
// 在 renderEventContent 函数开头添加
const status = arg.event.extendedProps?.status;

// 添加状态 emoji 获取函数
const getStatusEmoji = (itemStatus: string | undefined): string => {
  if (itemStatus === 'completed') return '✅ ';
  if (itemStatus === 'abandoned') return '❌ ';
  return '⏳ ';
};

const statusEmoji = getStatusEmoji(status);

// 修改标题部分，在标题文本前添加状态图标
titleEl.textContent = statusEmoji + title;
```

## 预期效果
- 待办事项显示 ⏳ 图标
- 已完成事项显示 ✅ 图标
- 已放弃事项显示 ❌ 图标
