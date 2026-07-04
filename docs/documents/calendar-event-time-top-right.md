# 日历事件时间移至右上角

## Summary
将 CalendarView 中日历事件卡片内的时间显示从左上角移到右上角（第一行最右侧），涉及非紧凑布局和紧凑布局两种模式。

## Current State Analysis
- 文件：`src/components/calendar/CalendarView.vue`
- 事件内容渲染函数 `renderEventContent`（第 98-241 行）根据事件持续时间分为两种布局：
  - **非紧凑布局**（duration > 30min）：两行结构，第一行（`fc-event-line1`）按「时间 → 任务名」顺序渲染。
  - **紧凑布局**（duration <= 30min）：单行结构，按「时间 → 任务名 → 标题」顺序渲染。
- 当前样式（第 740-803 行）：`.fc-event-line1` 为 `display: flex; gap: 4px;`，时间作为第一个子元素自然靠左。

## Proposed Changes

### 1. 调整 DOM 构建顺序（`renderEventContent` 函数）

#### 非紧凑布局（第 193-209 行）
将 `line1` 的构建顺序从「时间 → 任务名」改为「任务名 → 时间」：
- 先 append `fc-event-task`（任务名）
- 再 append `fc-event-time`（时间）
- 时间文本去掉尾部空格（保持 `startTime` 即可）

#### 紧凑布局（第 174-191 行）
将单行构建顺序从「时间 → 任务名 → 标题」改为「任务名 → 标题 → 时间」：
- 先 append `fc-event-task`（若有）
- 再 append `fc-event-title-text`（标题）
- 最后 append `fc-event-time`（时间，文本去掉尾部空格）

### 2. 调整样式（第 758-802 行）

给 `.fc-event-time` 增加以下属性，确保时间始终靠右且不收缩：
```scss
.fc-event-time {
  // 现有属性保留...
  margin-left: auto;
  flex-shrink: 0;
}
```

给 `.fc-event-line1` 增加 `justify-content: flex-start`（或保持默认，因为 `margin-left: auto` 已足够将时间推至右侧）。

给紧凑模式容器 `.fc-event-compact` 的时间样式也保持一致，确保单行时时间在最右侧。

### 3. 移除时间文本中的尾部空格
在 `renderEventContent` 中，构建时间元素时：
- 当前：`timeEl.textContent = \`\${startTime} \``
- 改为：`timeEl.textContent = startTime`

## Assumptions & Decisions
- "右上角"指事件卡片内容区域的第一行最右侧（而非整个事件块的绝对定位右上角），与常见日历应用设计一致。
- 紧凑布局（<=30分钟）同样适用此规则，时间显示在单行最右侧。
- 任务名和标题仍保持自动截断（`text-overflow: ellipsis`），时间区域固定宽度不挤压。

## Verification steps
1. 运行 `npm run lint` 检查代码风格。
2. 运行 `npm run typecheck` 检查类型。
3. 运行 `npm run test` 确保现有测试通过。
4. 在 SiYuan 中打开日历视图，检查：
   - 非紧凑事件：时间显示在第一行最右侧。
   - 紧凑事件：时间显示在单行最右侧。
   - 长标题/任务名正确截断，时间不溢出。
