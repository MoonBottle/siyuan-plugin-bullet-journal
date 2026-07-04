# 修复列表视图 Tooltip 跟随鼠标位置

## 问题分析

在日历列表视图（`listWeek`）中，hover 事项时 tooltip 固定在列表最左侧，而非跟随鼠标位置。

**根因链路：**

1. `CalendarView.vue:537` — `mouseenter` 回调未捕获 `MouseEvent`，只传了 `info.el`（整行 `<tr>`）
2. `EventDetailTooltip.vue:55` — `show()` 用 `anchorEl.getBoundingClientRect()` 计算位置
3. `tooltipPosition.ts:32` — 水平定位 `left = anchorRect.left`，列表视图的 `<tr>` 永远从最左开始

**其他视图无此问题：** 日/周/月视图中 `info.el` 是绝对定位的事件块，`anchorRect.left` 反映事件实际位置。

## 修改方案

### 1. `src/utils/tooltipPosition.ts`

增加可选参数 `mouseX?: number`。当提供鼠标 X 坐标时，水平方向以鼠标位置为基准（偏移少量像素避免遮挡），而非 `anchorRect.left`。

```ts
export function computeTooltipPosition(
  anchorRect: DOMRect,
  tooltipEl: HTMLElement,
  gap = 4,
  viewportPadding = 8,
  mouseX?: number,  // 新增
): { left: string, top: string }
```

水平定位逻辑改为：

* 有 `mouseX` 时：`left = mouseX + 12`（鼠标右侧偏移 12px），再做边界约束

* 无 `mouseX` 时：保持原逻辑 `left = anchorRect.left`

### 2. `src/components/dialog/EventDetailTooltip.vue`

`show()` 方法增加可选参数 `mouseEvent?: MouseEvent`，将 `mouseEvent.clientX` 传给 `computeTooltipPosition`。

```ts
const show = (event: CalendarEvent, anchorEl: HTMLElement, delay = 300, mouseEvent?: MouseEvent) => {
  // ...
  positionStyle.value = computeTooltipPosition(rect, tooltipEl.value, 4, 8, mouseEvent?.clientX)
}
```

### 3. `src/components/calendar/CalendarView.vue`

`mouseenter` 回调捕获 `MouseEvent` 并传给 `show()`：

```ts
info.el.addEventListener('mouseenter', (e: MouseEvent) => {
  // ...
  eventTooltipRef.value?.show(eventData, info.el, 300, e)
})
```

## 验证步骤

1. `npm run typecheck` — 类型检查通过
2. `npm run lint` — 代码风格检查通过
3. `npm run test` — 单元测试通过
4. 手动验证：列表视图 hover 时 tooltip 跟随鼠标位置；日/周/月视图 tooltip 行为不变

