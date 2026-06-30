# Tooltip 对齐思源主题设计

## 目标

将插件自定义的 tooltip 实现对齐思源 `.b3-tooltips::after` 的 DOM 结构和样式体系，使用 `::after` 伪元素 + `aria-label` 的方式，确保切换主题时 tooltip 自动适配。同时合并两套重复的 tooltip 函数为统一 API，抽取到独立文件。

## 背景

### 当前问题

1. **主题不适配**：硬编码了 fallback 颜色（`#2f2f2f`、`#fff`）和 `box-shadow`，切换思源主题时 tooltip 样式不跟随
2. **结构不对齐**：使用独立 DOM 元素而非 `::after` 伪元素，主题覆盖 `.b3-tooltips::after` 时无法生效
3. **代码重复**：`showIconTooltip` 和 `showLinkTooltip` 定位逻辑完全相同，仅 CSS 换行行为不同
4. **bug**：`showLinkTooltip` 缺少事件追踪（pointerdown/blur/resize/scroll/visibilitychange/MutationObserver），不会自动隐藏
5. **职责不清**：tooltip 逻辑混在 `dialog.ts` 中，该文件已承担弹框管理职责

### 思源 `.b3-tooltips::after` 的样式体系

思源使用 `::after` 伪元素 + `content: attr(aria-label)` 显示 tooltip 内容，CSS 变量控制外观：

```css
--b3-tooltips-background   /* 背景色 */
--b3-tooltips-color        /* 文字色 */
--b3-tooltips-shadow       /* 阴影 */
--b3-border-radius         /* 圆角 */
--b3-font-family           /* 字体 */
```

思源 tooltip 动画：默认 `opacity: 0; transform: scale(0.9)`，hover 时 `opacity: 1; transform: scale(1)`，过渡 `150ms 300ms cubic-bezier(0, 0, .2, 1)`。

思源支持 8 个方向：`__n` / `__ne` / `__nw` / `__s` / `__se` / `__sw` / `__e` / `__w`。

## 方案

在 body 上创建包装容器（`position: fixed`，逃逸 overflow 裁剪），容器内部包裹一个真正的 `.b3-tooltips` 元素，其 `::after` 渲染 tooltip 内容。

### DOM 结构

```html
<!-- 挂载 body，position: fixed 定位到触发元素位置 -->
<div id="sy-tooltip-wrapper" style="position: fixed; left: ...; top: ...; width: ...; height: ...; pointer-events: none;">
  <!-- 内部 .b3-tooltips 元素，::after 渲染 tooltip，完全复用思源主题样式 -->
  <span class="b3-tooltips b3-tooltips__n sy-tip-visible sy-fixed-tooltip" aria-label="tooltip text"></span>
</div>
```

- **wrapper**：只负责 `position: fixed` 定位 + 逃逸 overflow，宽高匹配触发元素
- **内部 span**：纯正的 `.b3-tooltips` 元素，`::after` 通过 `content: attr(aria-label)` 渲染，方向类自然生效

### 1. 新建 `src/utils/tooltip.ts`

统一 API：

```typescript
export type TooltipDirection = 'n' | 'ne' | 'nw' | 's' | 'se' | 'sw' | 'e' | 'w'

export interface TooltipOptions {
  /** tooltip 方向，默认 'n' */
  direction?: TooltipDirection
  /** 是否允许文本换行，默认 false（图标按钮 nowrap），链接传 true */
  wrap?: boolean
}

export function showTooltip(el: HTMLElement, text: string, options?: TooltipOptions): void
export function hideTooltip(): void
```

核心实现要点：

* **在 body 上创建单一包装容器** `#sy-tooltip-wrapper`，`position: fixed`，定位到触发元素的 `getBoundingClientRect()` 位置，宽高匹配触发元素，`pointer-events: none`
* **容器内部创建 span**，给它 `b3-tooltips` + 方向类（如 `b3-tooltips__n`）+ `sy-fixed-tooltip` + `aria-label`
* `::after` 通过 `content: attr(aria-label)` 读取 aria-label 渲染文本，完全复用思源样式
* 方向类（`__n`/`__s` 等）相对于内部 span 定位，span 尺寸 = wrapper 尺寸 = 触发元素尺寸，方向自然正确
* 可见性通过 `.sy-tip-visible` 类控制（覆盖 `:hover` 行为）
* 统一事件追踪：pointerdown / blur / resize / scroll / visibilitychange / MutationObserver
* 视口边界检测：requestAnimationFrame 后检测 `::after` 溢出并修正 wrapper 位置
* `wrap` 参数控制 `.sy-fixed-tooltip--wrap` 修饰类
* `hideTooltip()` 时移除 `sy-tip-visible` 类，不删除 DOM 元素（复用）

### 2. CSS 变更 — `src/index.scss`

删除 `.sy-icon-tooltip` 和 `.sy-dialog-link-tooltip`，新增 `.sy-fixed-tooltip`：

```scss
/* 固定定位 tooltip：包装容器在 body 上，内部 .b3-tooltips 元素的 ::after 渲染内容 */
/* 覆盖 .b3-tooltips 的 :hover 和 overflow 行为，改用类控制 */

/* 包装容器 */
#sy-tooltip-wrapper {
  position: fixed;
  pointer-events: none;
  z-index: 1000000;
}

/* 内部 .b3-tooltips 元素的覆盖 */
.sy-fixed-tooltip {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible !important;
  cursor: default !important;

  /* 覆盖 .b3-tooltips 的 :hover::after 规则，改用类控制可见性 */
  &::after {
    opacity: 0 !important;
    transform: scale(0.9) !important;
    transition:
      opacity 150ms cubic-bezier(0, 0, .2, 1),
      transform 150ms cubic-bezier(0, 0, .2, 1) !important;
  }

  &:hover::after {
    opacity: 0 !important;
    transform: scale(0.9) !important;
  }

  /* 类控制可见性 */
  &.sy-tip-visible::after {
    opacity: 1 !important;
    transform: scale(1) !important;
  }

  /* 换行修饰：用于链接等长文本 */
  &--wrap::after {
    white-space: normal !important;
    word-wrap: break-word !important;
    max-width: min(400px, 90vw) !important;
  }
}
```

### 3. `src/utils/dialog.ts` 变更

* 删除 `SY_LINK_TOOLTIP_ID`、`SY_ICON_TOOLTIP_ID` 常量
* 删除 `activeIconTooltipTrigger`、`activeIconTooltipCleanup`、`activeIconTooltipObserver` 变量
* 删除 `clearIconTooltipTracking`、`watchIconTooltipTrigger` 函数
* 删除 `showLinkTooltip`、`hideLinkTooltip`、`showIconTooltip`、`hideIconTooltip` 函数
* 内部调用 `hideLinkTooltip()` → `hideTooltip()`（从 `@/utils/tooltip` 导入）
* `formatLinkForDisplay` 移至 `src/utils/format.ts`（与 dialog 无关，独立提取）

### 4. 调用方替换清单

| 文件                     | 旧调用                                    | 新调用                                                                       |
| ---------------------- | -------------------------------------- | ------------------------------------------------------------------------- |
| `SyButton.vue`         | `showIconTooltip(el, props.ariaLabel)` | `showTooltip(el, props.ariaLabel, { direction: props.tooltipDirection })` |
| `SyButton.vue`         | `hideIconTooltip()`                    | `hideTooltip()`                                                           |
| `SyButton.vue`         | `showLinkTooltip(el, props.text!)`     | `showTooltip(el, props.text!, { wrap: true })`                            |
| `SyButton.vue`         | `hideLinkTooltip()`                    | `hideTooltip()`                                                           |
| `SyButton.vue`         | `formatLinkForDisplay`（从 dialog 导入）    | `formatLinkForDisplay`（从 `@/utils/format` 导入）                             |
| `dialog.ts` L342, L513 | `hideLinkTooltip()`                    | `hideTooltip()`                                                           |
| 其他 14 个文件              | `showIconTooltip`/`hideIconTooltip`    | `showTooltip`/`hideTooltip`                                               |

### 5. SyButton 新增 prop

```typescript
tooltipDirection?: TooltipDirection  // 默认 'n'
```

传递给 `showTooltip` 的 `direction` 参数。

### 6. `src/utils/detachedPomodoroWindow.ts` 特殊处理

独立番茄钟窗口无法加载思源主题 CSS，`.b3-tooltips::after` 规则不可用。保持内联 DOM 元素方案，但同步对齐 CSS 变量（去掉 fallback 硬编码值），类名改为 `.sy-tooltip`。

## 不做的事

* 不修改思源源码
* 不添加 tooltip 延迟显示逻辑（当前行为是立即显示，与思源 CSS tooltip 的 300ms 延迟不同，保持当前行为）
* 不在 detachedPomodoroWindow 中使用 `::after` 方案（无主题 CSS 可复用）
