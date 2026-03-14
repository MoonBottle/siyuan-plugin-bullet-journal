# EventDetailTooltip.vue 简化计划

## 当前分析

该组件是一个事件详情提示框，目前包含以下交互功能：

### 1. 复制按钮 (可交互)
- 项目卡片中的复制按钮
- 任务卡片中的复制按钮
- 事项卡片中的复制按钮（时长、专注时间、内容）

### 2. 链接跳转 (可交互)
- 项目卡片的 footer 链接（可点击跳转）
- 任务卡片的 footer 链接（可点击跳转）
- 事项卡片的 footer 链接（可点击跳转）

### 3. 图标提示 (可交互)
- 时间图标 hover 显示 tooltip
- 时长图标 hover 显示 tooltip
- 番茄钟图标 hover 显示 tooltip

## 简化方案

将组件改为纯展示性的 tip 弹框，移除所有交互功能，但保留链接的展示：

### 需要移除的内容

1. **复制按钮**
   - 移除所有 `copy-btn` 元素
   - 移除 `copiedState` 响应式状态
   - 移除 `handleCopy` 函数

2. **链接跳转功能**
   - 移除链接的点击事件 `@click.prevent.stop`
   - 移除 `openLink` 函数
   - **保留**链接的展示样式（作为纯文本标签显示）

3. **图标提示**
   - 移除 `@mouseenter` 和 `@mouseleave` 事件
   - 移除 `showIconTooltip` 和 `hideIconTooltip` 导入

4. **简化 Props**
   - **保留** `projectLinks`、`taskLinks`、`itemLinks`（用于展示）
   - 移除 `preview`（不再需要，因为所有交互都已移除）

5. **简化 Card 组件使用**
   - **保留** `:show-footer` 属性（用于展示链接）
   - **保留** footer 插槽内容（但改为纯展示）

### 保留的内容

1. **展示性内容**
   - 项目、任务、事项的基本信息展示
   - 时间、时长、专注时间等元数据
   - 状态标签
   - 任务等级徽章
   - **链接标签展示**（仅展示，不可点击）

2. **样式**
   - 基本的卡片布局和样式
   - 状态颜色样式
   - 元数据行样式
   - 链接标签样式（移除 hover 交互效果）

## 调用方修改

### GanttView.vue (第114行)

**当前代码：**
```typescript
const html = buildEventDetailContent(eventData, { preview: true });
```

**修改后：**
```typescript
const html = buildEventDetailContent(eventData);
```

### CalendarView.vue (第182行)

**当前代码：**
```typescript
const html = buildEventDetailContent(eventData, { preview: true });
```

**修改后：**
```typescript
const html = buildEventDetailContent(eventData);
```

## 实施步骤

1. 移除模板中的复制按钮
2. 将链接 `<a>` 标签改为 `<span>` 标签（移除跳转功能，保留展示）
3. 移除图标 hover 事件
4. 简化 Props 定义（移除 `preview`）
5. 移除相关的函数和状态（`handleCopy`, `openLink`, `copiedState`）
6. 清理未使用的导入（`showIconTooltip`, `hideIconTooltip`）
7. 移除不再需要的样式（复制按钮样式、链接 hover 交互样式）
8. 修改 GanttView.vue - 移除 preview 参数
9. 修改 CalendarView.vue - 移除 preview 参数

## 预期结果

简化后的组件将：
- 仅用于展示事件详情信息
- 链接以标签形式展示，但不可点击跳转
- 不包含任何可交互的元素
- 作为纯信息提示框使用
