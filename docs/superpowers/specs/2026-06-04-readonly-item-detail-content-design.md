# EventDetailTooltip 复用 ItemDetailContent 设计

## 背景

`EventDetailTooltip.vue` 是日历事件悬浮提示的只读简化版，与 `ItemDetailContent.vue` 存在大量重复的卡片渲染逻辑（项目/任务/事项三张卡片、状态计算、时间显示、时长计算等）。目标是让 tooltip 场景复用 `ItemDetailContent`，消除重复逻辑。

## 现状对比

| | EventDetailTooltip | ItemDetailContent |
|---|---|---|
| 数据源 | 解构后的扁平字符串 props | 完整 `Item` 对象 |
| 渲染方式 | `createApp` → 取 `innerHTML` → 卸载 | 正常 Vue 组件 |
| 功能 | 纯展示，无交互 | 完整功能（复制/操作/链接点击） |
| 事件 | 无 | close / setReminder / setRecurring / skipOccurrence |
| 样式 | padding: 3px, min-width: 280px, max-width: 400px | 无 padding/宽度约束 |

## 方案：EventDetailTooltip 作为薄壳 + ItemDetailContent 加 `readonly` prop

保留 `EventDetailTooltip.vue` 作为 tooltip 外壳（负责边距/宽度等 tooltip 专属样式），内部嵌入 `ItemDetailContent` 的 `readonly` 模式。职责分离：`ItemDetailContent` 管内容渲染，`EventDetailTooltip` 管 tooltip 铬框。

### 1. ItemDetailContent 新增 `readonly` prop

```typescript
readonly?: boolean  // 默认 false
```

### 2. `readonly=true` 时隐藏的元素

- 所有复制按钮（项目名/任务名/内容/时长/专注时间）
- 优先级徽章（Item 卡片 header）
- 标签行（任务标签 + 事项标签）
- 操作按钮行（已有 `showActionRow` 可配合）
- 预计专注(⏳) meta 项
- 偏差(Δ) meta 项

### 3. `readonly=true` 时保留的元素

- 项目卡片 + 链接（`pointer-events: none`）
- 任务卡片 + level 徽章 + 链接（`pointer-events: none`）
- Item 卡片 + 状态标签
- 日期(📅) + 时长(⏱️) + 专注时间(🍅) meta
- 事项内容
- 链接（展示但不可点击）

### 4. ItemDetailContent 样式调整

根容器增加 `item-detail-content--readonly` class，仅控制链接不可交互：

```scss
.item-detail-content--readonly {
  :deep(.typed-link) {
    pointer-events: none;
    cursor: default;
  }
}
```

### 5. EventDetailTooltip 改造为薄壳

从当前 435 行的独立实现，简化为嵌入 `ItemDetailContent` 的薄壳：

```vue
<template>
  <div class="event-detail-tooltip">
    <ItemDetailContent
      :item="item"
      :readonly="true"
      :embedded="true"
    />
  </div>
</template>

<script setup lang="ts">
import type { Item } from '@/types/models'
import ItemDetailContent from '@/components/dialog/ItemDetailContent.vue'

defineProps<{
  item: Item
}>()
</script>

<style lang="scss" scoped>
.event-detail-tooltip {
  padding: 3px;
  min-width: 280px;
  max-width: 400px;
}
</style>
```

Props 从 15+ 个扁平字段简化为 1 个 `item` 对象。tooltip 专属样式（边距、宽度约束）保留在此组件。

### 6. dialog.ts 改造

`showEventDetailTooltip` 函数：
- 复用 `showEventDetailModal` 中已有的 Item 对象构建逻辑，提取为共享函数 `buildItemFromEventProps`
- 改为 `createApp(EventDetailTooltip, { item })`，不再传递解构后的扁平字段

### 7. 测试更新

- `test/utils/dialog.tooltip.test.ts` 中 EventDetailTooltip 的 props 需从扁平字段改为 `item` 对象
- 验证 tooltip 渲染输出包含核心信息（项目/任务/事项/时间/状态）

## 影响范围

| 文件 | 变更类型 |
|------|---------|
| `src/components/dialog/ItemDetailContent.vue` | 新增 `readonly` prop + 条件渲染 + 链接样式 |
| `src/components/dialog/EventDetailTooltip.vue` | 简化为薄壳，嵌入 ItemDetailContent |
| `src/utils/dialog.ts` | 重构 tooltip 函数，提取共享 Item 构建逻辑 |
| `test/utils/dialog.tooltip.test.ts` | 更新 props 格式 |
