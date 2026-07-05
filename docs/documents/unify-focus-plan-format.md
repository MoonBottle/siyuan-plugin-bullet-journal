# 计划：统一专注计划格式 + TodoSidebarList SVG 图标

## 摘要

1. 🍅xN 改成 `1h15m` 短格式（番茄个数 × 25 分钟）
2. TodoSidebarList.vue 的 🍅xN / ⏳N 改成 SVG 图标 + 短格式文本
3. ItemDetailContent.vue 的 🍅xN 也同步改为短格式

## 当前状态

### `getFocusPlanDisplay` 返回值（`src/utils/format.ts`）
- pomodoro 类型：`{ type: 'pomodoro', value: 番茄个数 }` — 当前显示 `🍅x3`
- duration 类型：`{ type: 'duration', value: '1h15m', minutes: 75 }` — 当前显示 `⏳1h15m`

### TodoSidebarList.vue
7 处相同的 focus plan badge 模板（L122-123, L222-223, L322-323, L422-423, L531-532, L629-630, L728-729）：
```html
<template v-if="getFocusPlanDisplay(item.focusPlan)?.type === 'pomodoro'">🍅x{{ getFocusPlanDisplay(item.focusPlan)?.value }}</template>
<template v-else>⏳{{ getFocusPlanDisplay(item.focusPlan)?.value }}</template>
```

### ItemDetailContent.vue（L202）
```html
<span class="meta-text"><template v-if="focusPlanDisplay.type === 'pomodoro'">🍅x{{ focusPlanDisplay.value }}</template><template v-else>{{ focusPlanDurationShort }}</template></span>
```

## 改动

### 1. `src/utils/format.ts` — `getFocusPlanDisplay` pomodoro 类型也返回分钟数 + 提取转换逻辑

pomodoro 类型的 value 改为短格式时长（番茄数 × 25 分钟），不再返回番茄个数。
提取 `formatFocusDurationShort` 到此文件（从 `dialog.ts` 移过来），作为统一的短格式工具函数。

```ts
// 从 dialog.ts 移入
export function formatFocusDurationShort(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h${m}m` : `${h}h`
}

// getFocusPlanDisplay 更新
if (plan.type === 'pomodoro') {
  const totalMinutes = plan.rawValue * 25
  return {
    type: 'pomodoro',
    value: plan.rawValue,
    minutes: totalMinutes,
  }
}
```

这样 pomodoro 类型也有 `minutes` 字段，可以用 `formatFocusDurationShort` 格式化。

`dialog.ts` 中的 `formatFocusDurationShort` 改为从 `format.ts` re-export，保持向后兼容。

### 2. `src/components/todo/TodoSidebarList.vue` — 7 处模板替换

所有 7 处 `🍅xN / ⏳N` 替换为 SVG + 短格式：

```html
<svg class="focus-plan-icon"><use xlink:href="#iconTaClockPlus"></use></svg>{{ getFocusPlanDisplay(item.focusPlan)?.minutes ? formatFocusDurationShort(getFocusPlanDisplay(item.focusPlan)!.minutes!) : '' }}
```

脚本中添加 `formatFocusDurationShort` 的 import。

### 3. `src/components/dialog/ItemDetailContent.vue` — 🍅xN 改为短格式

L202 改为统一使用短格式：
```html
<span class="meta-text">{{ focusPlanDurationShort }}</span>
```

`focusPlanDurationShort` computed 逻辑更新：pomodoro 类型也用 `minutes * 25` 计算。

### 4. 样式调整

TodoSidebarList.vue 中 `.item-focus-plan-badge` 增加 SVG 图标样式：
```scss
.item-focus-plan-badge {
  // ...existing
  gap: 2px;

  .focus-plan-icon {
    width: 12px;
    height: 12px;
    fill: currentColor;
    flex-shrink: 0;
  }
}
```

## 验证

1. `npm run lint` 通过
2. `npm run typecheck` 通过
3. `npm run test` 通过
