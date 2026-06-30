# Project View Resizable Columns 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复数选框（`- [ ]`）语法来跟踪进度。

**目标：** 为 ProjectView 三栏布局增加可拖拽调整列宽功能，工作台嵌入模式下持久化比例到视图配置

**架构：** 新增 `ResizeHandle.vue` 组件 + `useResizableColumns` composable 封装拖拽逻辑；修改 `WorkbenchProjectViewConfig` 类型增加 `columnRatios` 字段；`ProjectView` 从静态 grid 切换为动态百分比列宽；`ProjectTab` 管理状态并在嵌入模式下通过 `onUpdateConfig` 回调持久化

**技术栈：** Vue 3.5 Composition API、CSS Grid、TypeScript、Pinia（workbenchStore）

---

## 文件结构

| 文件                                                  | 操作     | 职责                                                                              |
| ----------------------------------------------------- | -------- | --------------------------------------------------------------------------------- |
| `src/types/workbench.ts`                              | 修改     | `WorkbenchProjectViewConfig` 增加 `columnRatios?` 字段                            |
| `src/composables/useResizableColumns.ts`              | **新建** | 拖拽逻辑 composable：mousedown/mousemove/mouseup → 百分比计算 → 约束裁剪          |
| `src/components/project/ResizeHandle.vue`             | **新建** | 可拖拽分隔条 UI 组件：视觉状态（default/hover/active）、8px 命中区域              |
| `src/components/project/ProjectView.vue`              | 修改     | 插入 2 个 ResizeHandle；接收/emit `columnRatios` prop；动态 grid-template-columns |
| `src/tabs/ProjectTab.vue`                             | 修改     | 管理 columnRatios 状态；嵌入模式下 debounce 持久化；工具栏加重置按钮              |
| `src/components/workbench/view/WorkbenchViewHost.vue` | 修改     | 向 ProjectTab 传递 onUpdateConfig 回调（仅 project 类型）                         |
| `src/i18n/zh_CN.json`                                 | 修改     | 增加 resetColumnWidths / resetColumnWidthsTooltip i18n key                        |
| `src/i18n/en_US.json`                                 | 修改     | 增加 resetColumnWidths / resetColumnWidthsTooltip i18n key                        |

---

### 任务 1：扩展类型定义

**文件：**

- 修改：`src/types/workbench.ts`

- [ ] **步骤 1：在 WorkbenchProjectViewConfig 接口中增加 columnRatios 字段**

找到 `WorkbenchProjectViewConfig` 接口定义（约第 115 行），在 `groupId` 后面添加：

```typescript
export interface WorkbenchProjectViewConfig {
  groupId?: string
  columnRatios?: [number, number, number]
}
```

- [ ] **步骤 2：验证类型编译通过**

运行：`npx vue-tsc --noEmit` 或检查 IDE 无类型错误
预期：无错误

- [ ] **步骤 3：Commit**

```bash
git add src/types/workbench.ts
git commit -m "feat(project): add columnRatios to WorkbenchProjectViewConfig"
```

---

### 任务 2：创建 useResizableColumns composable

**文件：**

- 创建：`src/composables/useResizableColumns.ts`
- 参考：`src/composables/useTodoViewState.ts`（现有 composable 风格）

- [ ] **步骤 1：编写 composable 完整实现**

```typescript
import type { Ref } from 'vue'
import { ref } from 'vue'

const DEFAULT_RATIOS: [number, number, number] = [20, 20, 60]
const MIN_RATIOS: [number, number, number] = [10, 15, 30]

export interface ResizableColumnsOptions {
  containerRef: Ref<HTMLElement | undefined>
  initialRatios?: [number, number, number]
  onChange?: (ratios: [number, number, number]) => void
}

export function useResizableColumns(options: ResizableColumnsOptions) {
  const ratios = ref<[number, number, number]>([
    ...options.initialRatios ?? DEFAULT_RATIOS,
  ])

  let isDragging = false
  let dragStartX = 0
  let dragStartRatios: [number, number, number] = [...DEFAULT_RATIOS]
  let dragHandleIndex = 0

  function getContainerWidth(): number {
    return options.containerRef.value?.offsetWidth ?? 1
  }

  function clampRatios(
    newRatios: [number, number, number],
    handleIndex: number,
  ): [number, number, number] {
    const result = [...newRatios]
    const leftIdx = handleIndex
    const rightIdx = handleIndex + 1

    if (result[leftIdx] < MIN_RATIOS[leftIdx]) {
      const deficit = MIN_RATIOS[leftIdx] - result[leftIdx]
      result[leftIdx] = MIN_RATIOS[leftIdx]
      result[rightIdx] += deficit
    }
    if (result[rightIdx] < MIN_RATIOS[rightIdx]) {
      const deficit = MIN_RATIOS[rightIdx] - result[rightIdx]
      result[rightIdx] = MIN_RATIOS[rightIdx]
      result[leftIdx] -= deficit
    }

    if (result[leftIdx] < MIN_RATIOS[leftIdx]) {
      result[leftIdx] = MIN_RATIOS[leftIdx]
    }

    const total = result[0] + result[1] + result[2]
    return [
      (result[0] / total) * 100,
      (result[1] / total) * 100,
      (result[2] / total) * 100,
    ] as [number, number, number]
  }

  function onMouseDown(e: MouseEvent, handleIndex: number) {
    e.preventDefault()
    isDragging = true
    dragStartX = e.clientX
    dragStartRatios = [...ratios.value]
    dragHandleIndex = handleIndex

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  function onMouseMove(e: MouseEvent) {
    if (!isDragging)
      return

    const containerWidth = getContainerWidth()
    if (containerWidth <= 0)
      return

    const deltaX = e.clientX - dragStartX
    const deltaPercent = (deltaX / containerWidth) * 100

    const newRatios: [number, number, number] = [
      dragStartRatios[0] + (dragHandleIndex === 0 ? deltaPercent : 0),
      dragStartRatios[1] + (dragHandleIndex === 0 ? -deltaPercent : dragHandleIndex === 1 ? deltaPercent : 0),
      dragStartRatios[2] + (dragHandleIndex === 1 ? -deltaPercent : 0),
    ]

    ratios.value = clampRatios(newRatios, dragHandleIndex)
  }

  function onMouseUp() {
    if (!isDragging)
      return
    isDragging = false

    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)

    options.onChange?.([...ratios.value])
  }

  function reset() {
    ratios.value = [...DEFAULT_RATIOS]
    options.onChange?.([...DEFAULT_RATIOS])
  }

  function setRatios(newRatios: [number, number, number]) {
    ratios.value = [...newRatios]
  }

  const gridTemplateColumns = computedGridTemplateColumns(ratios)

  return {
    ratios,
    gridTemplateColumns,
    onMouseDown,
    reset,
    setRatios,
  }
}

function computedGridTemplateColumns(ratios: Ref<[number, number, number]>) {
  const { computed } = awaitImportVue()
  return computed(() => {
    const [a, b, c] = ratios.value
    return `${a}% ${b}% ${c}%`
  })
}

async function awaitImportVue() {
  return import('vue')
}
```

> **注意：** 上面的 `computedGridTemplateColumns` 使用了动态 import 来避免循环依赖。实际实现中可以直接在文件顶部 `import { computed } from 'vue'` 并正常使用，因为 composable 本身不会循环依赖 vue。

实际最终代码应直接使用顶部静态 import：

```typescript
import type { Ref } from 'vue'
import { computed, ref } from 'vue'

// ... 其余同上 ...

function makeGridTemplateColumns(ratios: Ref<[number, number, number]>) {
  return computed(() => {
    const [a, b, c] = ratios.value
    return `${a}% ${b}% ${c}%`
  })
}

// 在 return 中使用：
// gridTemplateColumns: makeGridTemplateColumns(ratios),
```

- [ ] **步骤 2：Commit**

```bash
git add src/composables/useResizableColumns.ts
git commit -m "feat(project): add useResizableColumns composable for drag-resize logic"
```

---

### 任务 3：创建 ResizeHandle 组件

**文件：**

- 创建：`src/components/project/ResizeHandle.vue`
- 参考 SiYuan 主题变量风格（查看 `src/components/SiyuanTheme/` 下组件的 CSS 变量用法）

- [ ] **步骤 1：编写 ResizeHandle 组件完整实现**

```vue
<script setup lang="ts">
defineProps<{
  isActive?: boolean
}>()

const emit = defineEmits<{
  (e: 'drag-start', event: MouseEvent): void
}>()

function onMouseDown(e: MouseEvent) {
  emit('drag-start', e)
}
</script>

<template>
  <div
    class="resize-handle"
    :class="{ 'resize-handle--active': isActive }"
    @mousedown="onMouseDown"
  />
</template>

<style lang="scss" scoped>
.resize-handle {
  position: relative;
  width: 4px;
  cursor: col-resize;
  flex-shrink: 0;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -2px;
    right: -2px;
    bottom: 0;
  }

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 1px;
    height: 100%;
    background-color: var(--b3-border-color);
    opacity: 0.5;
    transition:
      opacity 0.15s,
      background-color 0.15s;
  }

  &:hover::after {
    opacity: 0.8;
    background-color: var(--b3-text-on-surface);
  }

  &--active::after {
    opacity: 1;
    background-color: var(--b3-theme-primary);
  }
}
</style>
```

- [ ] **步骤 2：Commit**

```bash
git add src/components/project/ResizeHandle.vue
git commit -m "feat(project): add ResizeHandle component for column resize"
```

---

### 任务 4：改造 ProjectView 支持动态列宽

**文件：**

- 修改：`src/components/project/ProjectView.vue`

- [ ] **步骤 1：添加 props 和 imports**

在 `<script setup>` 区域的 imports 后面添加：

```typescript
import ResizeHandle from '@/components/project/ResizeHandle.vue'
import { useResizableColumns } from '@/composables/useResizableColumns'
```

在 `defineProps` 中扩展：

```typescript
const props = withDefaults(defineProps<{
  projects: Project[]
  embedded?: boolean
  columnRatios?: [number, number, number]
}>(), {
  embedded: false,
})
```

添加 emit：

```typescript
const emit = defineEmits<{
  (e: 'update:columnRatios', ratios: [number, number, number]): void
}>()
```

- [ ] **步骤 2：初始化 composable 并绑定容器引用**

在 script 中添加容器 ref 和 composable 初始化：

```typescript
import { ref } from 'vue'

const workbenchRef = ref<HTMLElement>()

const {
  gridTemplateColumns,
  onMouseDown,
  reset,
  setRatios,
} = useResizableColumns({
  containerRef: workbenchRef,
  initialRatios: props.columnRatios,
  onChange: ratios => emit('update:columnRatios', ratios),
})

defineExpose({
  allCollapsed,
  toggleCollapseAll,
  resetColumnRatios: reset,
})
```

- [ ] **步骤 3：修改 template — 添加 ResizeHandle 和动态 grid 样式**

将 template 中的 `.project-workbench` div 修改为：

```html
<div
  v-else
  ref="workbenchRef"
  class="project-workbench"
  :class="{ 'project-workbench--embedded': embedded }"
  :style="{ gridTemplateColumns: gridTemplateColumns }"
>
  <ProjectListPane ...existing-props... />
  <ResizeHandle :is-active="false" @drag-start="(e) => onMouseDown(e, 0)" />
  <ProjectTreePane ...existing-props... />
  <ResizeHandle :is-active="false" @drag-start="(e) => onMouseDown(e, 1)" />
  <ProjectDetailPane ...existing-props... />
</div>

```

注意保留所有现有的 props 绑定不变，只在列表中间插入 ResizeHandle 组件。

- [ ] **步骤 4：修改 CSS — 移除硬编码 grid-template-columns**

在 `.project-workbench` 的 CSS 中删除或注释掉 `grid-template-columns: 2fr 2fr 6fr;` 这一行（现在由 inline style 动态控制）。

- [ ] **步骤 5：验证 IDE 无报错**

确认模板中的组件引用、事件绑定、style 绑定都正确。

- [ ] **步骤 6：Commit**

```bash
git add src/components/project/ProjectView.vue
git commit -m "feat(project): integrate resizable columns into ProjectView"
```

---

### 任务 5：改造 ProjectTab 管理列宽状态和持久化

**文件：**

- 修改：`src/tabs/ProjectTab.vue`

- [ ] **步骤 1：添加新的 imports 和 props**

添加 prop：

```typescript
const props = withDefaults(defineProps<{
  embedded?: boolean
  viewConfig?: Record<string, unknown>
  onUpdateConfig?: (config: Record<string, unknown>) => void
}>(), {
  embedded: false,
})
```

添加 imports：

```typescript
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import ResizeHandle from '@/components/project/ResizeHandle.vue' // 如果需要图标
// ... 其他已有 imports 保持不变
```

- [ ] **步骤 2：添加 columnRatios 状态管理**

在 `selectedGroup` ref 声明附近添加：

```typescript
import { useDebounceFn } from '@vueuse/core' // 如项目已用 vueuse；否则手动实现 debounce

const DEFAULT_COLUMN_RATIOS: [number, number, number] = [20, 20, 60]

const columnRatios = ref<[number, number, number]>(getInitialColumnRatios())

function getInitialColumnRatios(): [number, number, number] {
  if (props.embedded && props.viewConfig?.columnRatios) {
    const ratios = props.viewConfig.columnRatios as [number, number, number]
    if (Array.isArray(ratios) && ratios.length === 3) {
      return ratios
    }
  }
  return [...DEFAULT_COLUMN_RATIOS]
}

function handleColumnRatiosChange(newRatios: [number, number, number]) {
  columnRatios.value = newRatios
  persistColumnRatios(newRatios)
}

// 简单 debounce 实现（如果项目没有 vueuse）
let persistTimer: ReturnType<typeof setTimeout> | null = null
function persistColumnRatios(ratios: [number, number, number]) {
  if (!props.embedded || !props.onUpdateConfig)
    return
  if (persistTimer)
    clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    props.onUpdateConfig!({
      ...(props.viewConfig ?? {}),
      columnRatios: ratios,
    })
    persistTimer = null
  }, 300)
}

function handleResetColumnRatios() {
  columnRatios.value = [...DEFAULT_COLUMN_RATIOS]
  if (props.embedded && props.onUpdateConfig) {
    props.onUpdateConfig({
      ...(props.viewConfig ?? {}),
      columnRatios: [...DEFAULT_COLUMN_RATIOS],
    })
  }
}
```

> **注意：** 检查项目是否已安装 `@vueuse/core`。如果有则优先使用 `useDebounceFn`；如果没有则使用上面的 setTimeout 实现。

- [ ] **步骤 3：修改 template — 传递 columnRatios 给 ProjectView，添加重置按钮**

在 template 的 `block__icons` 区域，在折叠/展开按钮前面插入重置按钮：

```html
<span
  v-if="projectStore.projects.length > 0"
  class="block__icon b3-tooltips b3-tooltips__sw"
  :aria-label="t('project').resetColumnWidthsTooltip"
  @click="handleResetColumnRatios"
>
  <svg><use xlink:href="#iconFullscreen"></use></svg>
</span>

```

修改 ProjectView 调用，添加 columnRatios 绑定：

```html
<ProjectView
  ref="projectViewRef"
  :projects="filteredProjects"
  :embedded="embedded"
  :column-ratios="columnRatios"
  @update:column-ratios="handleColumnRatiosChange"
/>

```

- [ ] **步骤 4：watch viewConfig 变化同步 columnRatios**

在已有的 `watch(() => props.viewConfig, ...)` 内部追加对 columnRatios 的同步：

```typescript
watch(() => props.viewConfig, (config) => {
  const groupId = (config as WorkbenchProjectViewConfig | undefined)?.groupId
  if (groupId) {
    selectedGroup.value = groupId
  }
  // 同步 columnRatios（当外部配置变化时）
  const ratios = (config as WorkbenchProjectViewConfig | undefined)?.columnRatios
  if (ratios && Array.isArray(ratios) && ratios.length === 3) {
    columnRatios.value = [...ratios]
  }
}, { immediate: true })
```

- [ ] **步骤 5：验证 IDE 无报错**

- [ ] **步骤 6：Commit**

```bash
git add src/tabs/ProjectTab.vue
git commit -m "feat(project): manage column ratios state and persistence in ProjectTab"
```

---

### 任务 6：改造 WorkbenchViewHost 传递 onUpdateConfig 回调

**文件：**

- 修改：`src/components/workbench/view/WorkbenchViewHost.vue`

- [ ] **步骤 1：导入 workbenchStore 并添加 updateProjectViewConfig 方法**

在 `<script setup>` 中添加：

```typescript
import { useWorkbenchStore } from '@/stores'

const workbenchStore = useWorkbenchStore()

async function handleProjectViewConfigUpdate(config: Record<string, unknown>) {
  await workbenchStore.updateViewConfig(props.entry.id, config)
}
```

- [ ] **步骤 2：向 ProjectTab 传递 onUpdateConfig prop**

找到 ProjectTab 的使用位置（约第 19 行），修改为：

```html
<div v-else-if="viewType === 'project'" class="workbench-view-host__surface" data-testid="workbench-view-project">
  <ProjectTab :embedded="true" :view-config="entry.config" :on-update-config="handleProjectViewConfigUpdate" />
</div>

```

- [ ] **步骤 3：验证 IDE 无报错**

- [ ] **步骤 4：Commit**

```bash
git add src/components/workbench/view/WorkbenchViewHost.vue
git commit -m "feat(workbench): pass onUpdateConfig callback to embedded ProjectTab"
```

---

### 任务 7：添加 i18n 国际化文案

**文件：**

- 修改：`src/i18n/zh_CN.json`
- 修改：`src/i18n/en_US.json`

- [ ] **步骤 1：在 zh_CN.json 的 project 节点添加 key**

在 `"linked": "有链接"` 这行之后添加：

```json
"resetColumnWidths": "重置列宽",
"resetColumnWidthsTooltip": "恢复默认列宽比例"
```

- [ ] **步骤 2：在 en_US.json 的 project 节点添加对应 key**

找到 project 节点的末尾位置，添加：

```json
"resetColumnWidths": "Reset Widths",
"resetColumnWidthsTooltip": "Reset column widths to default"
```

- [ ] **步骤 3：验证 JSON 格式有效**

运行：`node -e "JSON.parse(require('fs').readFileSync('src/i18n/zh_CN.json','utf8'))"` 和 en_US 同理
预期：无抛出错误

- [ ] **步骤 4：Commit**

```bash
git add src/i18n/zh_CN.json src/i18n/en_US.json
git commit -m "i18n: add reset column widths labels for project view"
```

---

### 任务 8：构建验证与端到端测试

- [ ] **步骤 1：运行生产构建**

运行：`npm run build`
预期：构建成功，无 TypeScript/Vue 编译错误

- [ ] **步骤 2：运行 lint 检查**

运行：`npm run lint`
预期：无 ESLint 错误

- [ ] **步骤 3：手动验证清单**

在浏览器中打开工作台，执行以下验证：

1. 打开 Project 视图（独立 Tab 模式）
   - [ ] 三栏正常显示，默认比例约为 20%:20%:60%
   - [ ] 两根分隔线可见
   - [ ] hover 分隔线时 cursor 变为 col-resize，颜色加深
   - [ ] 拖拽第 1 根分隔线：左栏和中间栏宽度联动变化，右侧不变
   - [ ] 拖拽第 2 根分隔线：中间栏和右栏宽度联动变化，左侧不变
   - [ ] 拖拽到最小约束后无法继续缩小（卡住效果）
   - [ ] 工具栏有重置按钮（非空状态下），点击后恢复默认比例
   - [ ] 刷新页面后独立 Tab 比例重置为默认（不持久化）

2. 在工作台中打开 Project 视图（嵌入模式）
   - [ ] 以上所有交互行为相同
   - [ ] 拖拽结束后 ~300ms 内配置被保存
   - [ ] 刷新页面后比例保持上次拖拽结果
   - [ ] 点击重置后比例立即恢复且被持久化
   - [ ] 关闭再打开工作台后比例保持

3. 边界情况
   - [ ] 项目列表为空时，重置按钮不显示
   - [ ] 快速连续拖拽不出现抖动
   - [ ] 浏览器窗口 resize 后各栏比例保持不变（百分比自适应）

- [ ] **步骤 4：最终 Commit（如有修复）**

```bash
git add -A
git commit -m "fix(project): address issues found during verification"
```
