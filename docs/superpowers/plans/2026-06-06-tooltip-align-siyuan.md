# Tooltip 对齐思源主题 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将插件 tooltip 对齐思源 `.b3-tooltips::after` 伪元素结构，在 body 上创建包装容器，内部包裹 `.b3-tooltips` 元素，`::after` + `aria-label` 渲染，容器 `position: fixed` 逃逸 overflow 裁剪，合并两套重复函数为统一 API

**架构：** 在 body 上创建包装容器 `#sy-tooltip-wrapper`（`position: fixed`，逃逸 overflow），内部包裹 `<span class="b3-tooltips b3-tooltips__n sy-fixed-tooltip">` 元素，`::after` 通过 `content: attr(aria-label)` 渲染文本，完全复用思源主题样式；可见性通过 `.sy-tip-visible` 类控制

**技术栈：** TypeScript, SCSS, Vue 3

---

## 文件结构

| 操作 | 文件 | 职责 |
|------|------|------|
| 创建 | `src/utils/tooltip.ts` | 统一 tooltip 核心：showTooltip / hideTooltip，8 方向定位，事件追踪，包装容器管理 |
| 创建 | `src/utils/format.ts` | formatLinkForDisplay（从 dialog.ts 提取） |
| 修改 | `src/index.scss` | 删除 `.sy-icon-tooltip` + `.sy-dialog-link-tooltip`，新增 `#sy-tooltip-wrapper` + `.sy-fixed-tooltip` |
| 修改 | `src/utils/dialog.ts` | 删除 tooltip 相关代码，删除 formatLinkForDisplay，hideLinkTooltip 改为 hideTooltip |
| 修改 | `src/utils/detachedPomodoroWindow.ts` | 内联 CSS `.sy-icon-tooltip` → `.sy-tooltip`，同步样式变量 |
| 修改 | `src/components/SiyuanTheme/SyButton.vue` | 导入改为 tooltip.ts + format.ts，新增 tooltipDirection prop |
| 修改 | `src/components/todo/TodoSidebarList.vue` | 导入替换 |
| 修改 | `src/components/workbench/WorkbenchSidebar.vue` | 导入替换 |
| 修改 | `src/components/dialog/ItemDetailContent.vue` | 导入替换 |
| 修改 | `src/components/todo/TodoItemActionButtons.vue` | 导入替换 |
| 修改 | `src/components/todo/ItemActionBar.vue` | 导入替换 |
| 修改 | `src/components/habit/HabitMonthCalendar.vue` | 导入替换 |
| 修改 | `src/components/settings/SySettingsActionButton.vue` | 导入替换 |
| 修改 | `src/index.ts` | 导入替换 |
| 修改 | `src/components/workbench/view/WorkbenchHabitView.vue` | 导入替换 |
| 修改 | `src/tabs/DesktopHabitDock.vue` | 导入替换 |
| 修改 | `src/components/project/ProjectTreeNode.vue` | 导入替换 |
| 修改 | `src/mobile/components/habit/MobileHabitDetailSheet.vue` | 导入替换 |

---

### 任务 1：创建 `src/utils/format.ts`

**文件：**
- 创建：`src/utils/format.ts`

- [ ] **步骤 1：创建 format.ts，从 dialog.ts 提取 formatLinkForDisplay**

```typescript
/** 链接名称最大显示长度，超出则截断并 hover 显示全部 */
const LINK_NAME_MAX_LEN = 12

/** 格式化链接显示，返回截断后的 display 和可选的 fullText（用于 tooltip） */
export function formatLinkForDisplay(name: string): { display: string, fullText?: string } {
  if (!name || name.length <= LINK_NAME_MAX_LEN) {
    return { display: name }
  }
  return {
    display: `${name.slice(0, LINK_NAME_MAX_LEN)}...`,
    fullText: name,
  }
}
```

- [ ] **步骤 2：从 dialog.ts 删除 formatLinkForDisplay 和 LINK_NAME_MAX_LEN**

删除 `src/utils/dialog.ts` 中第 66-137 行的 `LINK_NAME_MAX_LEN` 常量和 `formatLinkForDisplay` 函数。

- [ ] **步骤 3：更新 SyButton.vue 的 formatLinkForDisplay 导入**

将 `import { formatLinkForDisplay, ... } from '@/utils/dialog'` 中的 `formatLinkForDisplay` 改为从 `@/utils/format` 导入。

- [ ] **步骤 4：运行 typecheck 验证**

运行：`npx tsc --noEmit`
预期：无错误

---

### 任务 2：创建 `src/utils/tooltip.ts`

**文件：**
- 创建：`src/utils/tooltip.ts`

- [ ] **步骤 1：编写 tooltip.ts**

```typescript
/**
 * 统一 Tooltip 工具
 * 在 body 上创建包装容器（position: fixed，逃逸 overflow 裁剪）
 * 容器内部包裹 .b3-tooltips 元素，::after 渲染 tooltip 内容
 * 方向类（__n/__s 等）相对于内部 .b3-tooltips 元素定位
 *
 * DOM 结构：
 * <div id="sy-tooltip-wrapper" style="position: fixed; left/top/width/height 匹配触发元素">
 *   <span class="b3-tooltips b3-tooltips__n sy-fixed-tooltip sy-tip-visible" aria-label="text"></span>
 * </div>
 */

export type TooltipDirection = 'n' | 'ne' | 'nw' | 's' | 'se' | 'sw' | 'e' | 'w'

export interface TooltipOptions {
  /** tooltip 方向，默认 'n' */
  direction?: TooltipDirection
  /** 是否允许文本换行，默认 false（图标按钮 nowrap），链接传 true */
  wrap?: boolean
}

const WRAPPER_ID = 'sy-tooltip-wrapper'
const INNER_TAG = 'span'
const DIRECTIONS: TooltipDirection[] = ['n', 'ne', 'nw', 's', 'se', 'sw', 'e', 'w']

let activeTrigger: HTMLElement | null = null
let cleanupFn: (() => void) | null = null
let observer: MutationObserver | null = null

function clearTracking(): void {
  cleanupFn?.()
  cleanupFn = null
  observer?.disconnect()
  observer = null
  activeTrigger = null
}

function watchTrigger(trigger: HTMLElement): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const hide = () => { hideTooltip() }
  const hideWhenHidden = () => {
    if (document.hidden) hideTooltip()
  }

  document.addEventListener('pointerdown', hide, true)
  window.addEventListener('blur', hide)
  window.addEventListener('resize', hide)
  window.addEventListener('scroll', hide, true)
  document.addEventListener('visibilitychange', hideWhenHidden)

  cleanupFn = () => {
    document.removeEventListener('pointerdown', hide, true)
    window.removeEventListener('blur', hide)
    window.removeEventListener('resize', hide)
    window.removeEventListener('scroll', hide, true)
    document.removeEventListener('visibilitychange', hideWhenHidden)
  }

  if (typeof MutationObserver !== 'undefined' && document.body) {
    observer = new MutationObserver(() => {
      if (activeTrigger !== trigger) return
      if (!trigger.isConnected) hideTooltip()
    })
    observer.observe(document.body, { childList: true, subtree: true })
  }
}

/** 获取或创建包装容器和内部元素 */
function getOrCreateWrapper(): { wrapper: HTMLDivElement, inner: HTMLElement } {
  let wrapper = document.getElementById(WRAPPER_ID) as HTMLDivElement | null
  let inner: HTMLElement | null

  if (!wrapper) {
    wrapper = document.createElement('div')
    wrapper.id = WRAPPER_ID
    inner = document.createElement(INNER_TAG)
    wrapper.appendChild(inner)
    document.body.appendChild(wrapper)
  }
  else {
    inner = wrapper.firstElementChild as HTMLElement
    if (!inner || inner.tagName.toLowerCase() !== INNER_TAG) {
      inner = document.createElement(INNER_TAG)
      wrapper.innerHTML = ''
      wrapper.appendChild(inner)
    }
  }

  return { wrapper, inner }
}

/** 测量 ::after 伪元素的尺寸 */
function measureAfterSize(inner: HTMLElement): DOMRect | null {
  const text = inner.getAttribute('aria-label') ?? ''
  if (!text) return null

  const computedStyle = getComputedStyle(inner, '::after')

  const measureEl = document.createElement('div')
  measureEl.style.cssText = `
    position: fixed; visibility: hidden; pointer-events: none;
    font-size: ${computedStyle.fontSize}; padding: ${computedStyle.padding};
    max-width: ${computedStyle.maxWidth};
    white-space: ${computedStyle.whiteSpace}; word-wrap: ${computedStyle.wordWrap};
    box-sizing: border-box; line-height: ${computedStyle.lineHeight};
    font-family: ${computedStyle.fontFamily};
  `
  measureEl.textContent = text
  document.body.appendChild(measureEl)
  const rect = measureEl.getBoundingClientRect()
  document.body.removeChild(measureEl)
  return rect
}

/** 显示 tooltip */
export function showTooltip(el: HTMLElement, text: string, options?: TooltipOptions): void {
  if (!text || typeof document === 'undefined') return
  hideTooltip()

  const direction = options?.direction ?? 'n'
  const wrap = options?.wrap ?? false

  const { wrapper, inner } = getOrCreateWrapper()

  // 设置内部 .b3-tooltips 元素的 aria-label 和类
  inner.setAttribute('aria-label', text)
  inner.className = `b3-tooltips b3-tooltips__${direction} sy-fixed-tooltip`
  if (wrap) inner.classList.add('sy-fixed-tooltip--wrap')

  // 定位包装容器到触发元素位置，宽高匹配
  const rect = el.getBoundingClientRect()
  wrapper.style.left = `${rect.left}px`
  wrapper.style.top = `${rect.top}px`
  wrapper.style.width = `${rect.width}px`
  wrapper.style.height = `${rect.height}px`

  // 显示
  inner.classList.add('sy-tip-visible')

  // 视口边界检测：测量 ::after 是否溢出，修正容器位置
  requestAnimationFrame(() => {
    if (activeTrigger !== el) return
    const afterRect = measureAfterSize(inner)
    if (!afterRect) return
    const viewMargin = 8

    let offsetX = 0
    let offsetY = 0

    if (afterRect.right > window.innerWidth - viewMargin) {
      offsetX = window.innerWidth - viewMargin - afterRect.right
    }
    if (afterRect.left + offsetX < viewMargin) {
      offsetX = viewMargin - afterRect.left
    }
    if (afterRect.top + offsetY < viewMargin) {
      offsetY = viewMargin - afterRect.top
    }
    if (afterRect.bottom + offsetY > window.innerHeight - viewMargin) {
      offsetY = window.innerHeight - viewMargin - afterRect.bottom
    }

    if (offsetX !== 0 || offsetY !== 0) {
      wrapper.style.left = `${rect.left + offsetX}px`
      wrapper.style.top = `${rect.top + offsetY}px`
    }
  })

  // 事件追踪
  activeTrigger = el
  watchTrigger(el)
}

/** 隐藏 tooltip */
export function hideTooltip(): void {
  clearTracking()
  if (typeof document === 'undefined') return

  const wrapper = document.getElementById(WRAPPER_ID) as HTMLDivElement | null
  if (!wrapper) return

  const inner = wrapper.firstElementChild as HTMLElement | null
  if (inner) {
    inner.className = ''
    inner.removeAttribute('aria-label')
  }

  // 重置定位
  wrapper.style.left = ''
  wrapper.style.top = ''
  wrapper.style.width = ''
  wrapper.style.height = ''
}
```

- [ ] **步骤 2：运行 typecheck 验证**

运行：`npx tsc --noEmit`
预期：无错误

---

### 任务 3：更新 `src/index.scss`

**文件：**
- 修改：`src/index.scss:835-900`

- [ ] **步骤 1：替换 `.sy-icon-tooltip` 和 `.sy-dialog-link-tooltip` 为 `#sy-tooltip-wrapper` + `.sy-fixed-tooltip`**

删除第 835-859 行的 `.sy-icon-tooltip` 和第 876-900 行的 `.sy-dialog-link-tooltip`，替换为：

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

---

### 任务 4：更新 `src/utils/detachedPomodoroWindow.ts`

**文件：**
- 修改：`src/utils/detachedPomodoroWindow.ts:475-536`

独立窗口无法加载思源主题 CSS，保持内联 DOM 元素方案，但同步对齐 CSS 变量。

- [ ] **步骤 1：替换内联 CSS 和 DOM 元素**

将第 475-495 行的 `.sy-icon-tooltip` 样式替换为：

```css
.sy-tooltip {
  position: fixed;
  z-index: 1000000;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: normal;
  -webkit-font-smoothing: subpixel-antialiased;
  color: var(--b3-tooltips-color);
  word-wrap: break-word;
  white-space: pre;
  background-color: var(--b3-tooltips-background);
  border-radius: var(--b3-border-radius);
  line-height: 17px;
  max-width: 60vw;
  overflow: hidden;
  text-overflow: ellipsis;
  box-sizing: border-box;
  box-shadow: var(--b3-tooltips-shadow);
  font-family: var(--b3-font-family);
  pointer-events: none;
  opacity: 0;
  transform: scale(0.9);
  transition: opacity 150ms cubic-bezier(0, 0, .2, 1),
              transform 150ms cubic-bezier(0, 0, .2, 1);
}
.sy-tooltip.visible {
  opacity: 1;
  transform: scale(1);
}
```

将第 500 行的 `<div id="bullet-journal-detached-tooltip" class="sy-icon-tooltip"></div>` 改为 `<div id="bullet-journal-detached-tooltip" class="sy-tooltip"></div>`。

- [ ] **步骤 2：更新内联 JS 中的 tooltip 定位逻辑**

将第 517-536 行的 `showTooltip` 函数更新为使用 `bottom` 定位（与主窗口一致）：

```javascript
const showTooltip = (el, text) => {
  if (!tooltip || !text) return;
  activeTooltipTrigger = el;
  tooltip.textContent = text;
  tooltip.className = 'sy-tooltip';
  const rect = el.getBoundingClientRect();
  const margin = 5;
  tooltip.style.bottom = (window.innerHeight - rect.top + margin) + 'px';
  tooltip.style.right = (window.innerWidth - rect.left - rect.width / 2) + 'px';
  tooltip.style.left = 'auto';
  tooltip.style.top = 'auto';
  tooltip.style.transform = 'translateX(50%)';
  tooltip.classList.add('visible');
  requestAnimationFrame(() => {
    if (activeTooltipTrigger !== el) return;
    const tipRect = tooltip.getBoundingClientRect();
    if (tipRect.right > window.innerWidth - 8) {
      tooltip.style.left = (window.innerWidth - tipRect.width - 8) + 'px';
      tooltip.style.right = 'auto';
    }
    if (tipRect.left < 8) {
      tooltip.style.left = '8px';
      tooltip.style.right = 'auto';
    }
  });
};
```

---

### 任务 5：清理 `src/utils/dialog.ts`

**文件：**
- 修改：`src/utils/dialog.ts`

- [ ] **步骤 1：删除 tooltip 相关代码**

删除以下内容：
- `SY_LINK_TOOLTIP_ID` 常量（第 70 行）
- `SY_ICON_TOOLTIP_ID` 常量（第 71 行）
- `activeIconTooltipTrigger` 变量（第 73 行）
- `activeIconTooltipCleanup` 变量（第 74 行）
- `activeIconTooltipObserver` 变量（第 75 行）
- `clearIconTooltipTracking` 函数（第 77-83 行）
- `watchIconTooltipTrigger` 函数（第 85-126 行）
- `showLinkTooltip` 函数（第 140-167 行）
- `hideLinkTooltip` 函数（第 170-173 行）
- `showIconTooltip` 函数（第 176-207 行）
- `hideIconTooltip` 函数（第 210-215 行）

- [ ] **步骤 2：替换 dialog.ts 内部的 hideLinkTooltip 调用**

将 dialog.ts 中第 342 行和第 513 行的 `hideLinkTooltip()` 替换为 `hideTooltip()`，并添加导入：

```typescript
import { hideTooltip } from '@/utils/tooltip'
```

---

### 任务 6：更新 SyButton.vue

**文件：**
- 修改：`src/components/SiyuanTheme/SyButton.vue`

- [ ] **步骤 1：更新导入**

将：
```typescript
import {
  formatLinkForDisplay,
  hideIconTooltip,
  hideLinkTooltip,
  showIconTooltip,
  showLinkTooltip,
} from '@/utils/dialog'
```

替换为：
```typescript
import { formatLinkForDisplay } from '@/utils/format'
import {
  hideTooltip,
  showTooltip,
  type TooltipDirection,
} from '@/utils/tooltip'
```

- [ ] **步骤 2：新增 tooltipDirection prop**

在 props 定义中添加：
```typescript
tooltipDirection?: TooltipDirection
```

默认值设为 `'n'`：
```typescript
tooltipDirection: 'n' as TooltipDirection,
```

- [ ] **步骤 3：更新函数调用**

将 `handleIconMouseEnter` 中的 `showIconTooltip(el, props.ariaLabel)` 改为 `showTooltip(el, props.ariaLabel, { direction: props.tooltipDirection })`。

将 `handleIconMouseLeave` 中的 `hideIconTooltip()` 改为 `hideTooltip()`。

将 `handleLinkMouseEnter` 中的 `showLinkTooltip(el, props.text!)` 改为 `showTooltip(el, props.text!, { wrap: true })`。

将 `handleLinkMouseLeave` 中的 `hideLinkTooltip()` 改为 `hideTooltip()`。

---

### 任务 7：批量更新其余 13 个调用方

**文件：**
- 修改：13 个文件（见下方清单）

所有文件的替换模式相同：

**导入替换：**
- 从 `@/utils/dialog` 的导入中删除 `hideIconTooltip` 和 `showIconTooltip`
- 新增 `import { hideTooltip, showTooltip } from '@/utils/tooltip'`
- 如果原导入中还有其他 dialog 导出项，保留它们继续从 `@/utils/dialog` 导入

**调用替换：**
- `showIconTooltip(el, text)` → `showTooltip(el, text)`
- `showIconTooltip(e.currentTarget as HTMLElement, text)` → `showTooltip(e.currentTarget as HTMLElement, text)`
- `showIconTooltip($event.currentTarget as HTMLElement, text)` → `showTooltip($event.currentTarget as HTMLElement, text)`
- `showIconTooltip(target, text)` → `showTooltip(target, text)`
- `hideIconTooltip()` → `hideTooltip()`
- `hideIconTooltip`（作为事件处理器引用）→ `hideTooltip`

- [ ] **步骤 1：更新 `src/components/todo/TodoSidebarList.vue`**

- [ ] **步骤 2：更新 `src/components/workbench/WorkbenchSidebar.vue`**

- [ ] **步骤 3：更新 `src/components/dialog/ItemDetailContent.vue`**

- [ ] **步骤 4：更新 `src/components/todo/TodoItemActionButtons.vue`**

- [ ] **步骤 5：更新 `src/components/todo/ItemActionBar.vue`**

- [ ] **步骤 6：更新 `src/components/habit/HabitMonthCalendar.vue`**

- [ ] **步骤 7：更新 `src/components/settings/SySettingsActionButton.vue`**

- [ ] **步骤 8：更新 `src/index.ts`**

- [ ] **步骤 9：更新 `src/components/workbench/view/WorkbenchHabitView.vue`**

- [ ] **步骤 10：更新 `src/tabs/DesktopHabitDock.vue`**

- [ ] **步骤 11：更新 `src/components/project/ProjectTreeNode.vue`**

- [ ] **步骤 12：更新 `src/mobile/components/habit/MobileHabitDetailSheet.vue`**

---

### 任务 8：验证

- [ ] **步骤 1：运行 typecheck**

运行：`npx tsc --noEmit`
预期：无错误

- [ ] **步骤 2：运行 lint**

运行：`npm run lint`
预期：无错误

- [ ] **步骤 3：运行测试**

运行：`npm run test`
预期：全部通过

- [ ] **步骤 4：运行构建**

运行：`npm run build`
预期：构建成功
