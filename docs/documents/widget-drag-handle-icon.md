# Widget 拖拽手柄图标替换计划

## Summary

将 WorkbenchWidgetCard 的拖拽手柄从纯文本 `::` 替换为自定义 SVG 图标（grip-horizontal）。

## Current State

- [WorkbenchWidgetCard.vue](file:///c:\dev\projects\open-source\siyuan-plugin-bullet-journal\src\components\workbench\dashboard\WorkbenchWidgetCard.vue#L6-L9)：拖拽手柄使用 `<span>::</span>` 纯文本
- [icons.ts](file:///c:\dev\projects\open-source\siyuan-plugin-bullet-journal\src\constants\icons.ts)：已定义多个 `<symbol>` 格式的图标常量
- [index.ts](file:///c:\dev\projects\open-source\siyuan-plugin-bullet-journal\src\index.ts#L344-L352)：通过 `this.addIcons()` 注册图标到 SiYuan SVG sprite

图标使用模式：定义 `<symbol>` → `addIcons()` 注册 → 模板中 `<svg><use xlink:href="#iconId"></use></svg>` 引用

## Proposed Changes

### 1. `src/constants/icons.ts` — 添加新图标常量

在文件末尾添加 `ICON_GRIP_HORIZONTAL`，使用用户提供的 SVG 转换为 `<symbol>` 格式：

```ts
export const ICON_GRIP_HORIZONTAL = `<symbol id="iconTaGripHorizontal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="1"/><circle cx="19" cy="9" r="1"/><circle cx="5" cy="9" r="1"/><circle cx="12" cy="15" r="1"/><circle cx="19" cy="15" r="1"/><circle cx="5" cy="15" r="1"/></symbol>`
```

### 2. `src/index.ts` — 注册新图标

在 import 和 `this.addIcons()` 调用处添加 `ICON_GRIP_HORIZONTAL`。

### 3. `src/components/workbench/dashboard/WorkbenchWidgetCard.vue` — 替换拖拽手柄

- 将 `<span class="workbench-widget-card__drag">::</span>` 替换为 `<span class="workbench-widget-card__drag"><svg><use xlink:href="#iconTaGripHorizontal"></use></svg></span>`
- 调整 `.workbench-widget-card__drag` 的 CSS：移除 `font-size`/`letter-spacing` 等文本属性，添加 SVG 尺寸样式（`width: 16px; height: 16px`），SVG 子元素 `display: block; width: 100%; height: 100%`

## Verification

1. `npm run lint` — 确保代码风格通过
2. `npm run typecheck` — 确保类型检查通过
3. `npm run test` — 确保测试通过
