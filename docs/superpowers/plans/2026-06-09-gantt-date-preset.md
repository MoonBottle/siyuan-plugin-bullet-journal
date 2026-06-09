# 甘特图日期预设配置 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为 Workbench 甘特图视图添加日期预设配置功能，支持 today/thisWeek/thisMonth/recent7/30/90/180/all/custom 预设，预设动态计算，配置为初始值工具栏可覆盖。

**架构：** Config 中存 `datePreset` 枚举字段，GanttTab 打开时根据预设动态计算 startDate/endDate 赋给内部 ref。配置对话框新增预设下拉框，选择 custom 时展开日期输入框。

**技术栈：** Vue 3 + TypeScript + dayjs

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/types/workbench.ts` | 修改 | 新增 `GanttDatePreset` 类型，修改 `WorkbenchGanttViewConfig` |
| `src/utils/ganttDateFilter.ts` | 创建 | `buildGanttDateRange` 预设解析函数 |
| `src/tabs/GanttTab.vue` | 修改 | 新增 `datePreset` prop，初始化和 watch 逻辑 |
| `src/components/workbench/view/WorkbenchGanttView.vue` | 修改 | 传递 `datePreset` prop |
| `src/components/workbench/dialogs/GanttViewConfigDialog.vue` | 修改 | 新增日期预设选择 UI |
| `src/workbench/viewRegistry.ts` | 修改 | 默认配置新增 `datePreset`，openConfigDialog 传递 `datePreset` |
| `src/i18n/zh_CN.json` | 修改 | 新增预设翻译 key |
| `src/i18n/en_US.json` | 修改 | 新增预设翻译 key |

---

### 任务 1：新增 GanttDatePreset 类型和修改 WorkbenchGanttViewConfig

**文件：**
- 修改：`src/types/workbench.ts:107-113`

- [ ] **步骤 1：在 `src/types/workbench.ts` 中新增类型和修改接口**

在 `WorkbenchGanttViewConfig` 接口之前新增 `GanttDatePreset` 类型，并在 `WorkbenchGanttViewConfig` 中新增 `datePreset` 字段：

```typescript
export type GanttDatePreset =
  | 'today'
  | 'thisWeek'
  | 'thisMonth'
  | 'recent7'
  | 'recent30'
  | 'recent90'
  | 'recent180'
  | 'all'
  | 'custom'

export interface WorkbenchGanttViewConfig {
  viewMode?: 'day' | 'week' | 'month'
  showItems?: boolean
  datePreset?: GanttDatePreset
  startDate?: string
  endDate?: string
  groupId?: string
}
```

- [ ] **步骤 2：运行 typecheck 验证**

运行：`npx vue-tsc --noEmit`
预期：PASS（仅新增类型，无破坏性变更）

- [ ] **步骤 3：Commit**

```bash
git add src/types/workbench.ts
git commit -m "feat(gantt): 新增 GanttDatePreset 类型和 WorkbenchGanttViewConfig.datePreset 字段"
```

---

### 任务 2：创建 ganttDateFilter 工具函数

**文件：**
- 创建：`src/utils/ganttDateFilter.ts`

- [ ] **步骤 1：创建 `src/utils/ganttDateFilter.ts`**

```typescript
import dayjs from 'dayjs'
import type { GanttDatePreset } from '@/types/workbench'

export interface GanttDateRange {
  start: string
  end: string
}

export function buildGanttDateRange(
  preset: GanttDatePreset,
  customStart?: string,
  customEnd?: string,
): GanttDateRange | undefined {
  const today = dayjs()
  switch (preset) {
    case 'today':
      return {
        start: today.format('YYYY-MM-DD'),
        end: today.format('YYYY-MM-DD'),
      }
    case 'thisWeek':
      return {
        start: today.startOf('week').format('YYYY-MM-DD'),
        end: today.endOf('week').format('YYYY-MM-DD'),
      }
    case 'thisMonth':
      return {
        start: today.startOf('month').format('YYYY-MM-DD'),
        end: today.endOf('month').format('YYYY-MM-DD'),
      }
    case 'recent7':
      return {
        start: today.subtract(7, 'day').format('YYYY-MM-DD'),
        end: today.format('YYYY-MM-DD'),
      }
    case 'recent30':
      return {
        start: today.subtract(30, 'day').format('YYYY-MM-DD'),
        end: today.format('YYYY-MM-DD'),
      }
    case 'recent90':
      return {
        start: today.subtract(90, 'day').format('YYYY-MM-DD'),
        end: today.format('YYYY-MM-DD'),
      }
    case 'recent180':
      return {
        start: today.subtract(180, 'day').format('YYYY-MM-DD'),
        end: today.format('YYYY-MM-DD'),
      }
    case 'all':
      return undefined
    case 'custom':
      if (customStart || customEnd) {
        return {
          start: customStart || '',
          end: customEnd || '',
        }
      }
      return undefined
  }
}
```

- [ ] **步骤 2：运行 typecheck 验证**

运行：`npx vue-tsc --noEmit`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add src/utils/ganttDateFilter.ts
git commit -m "feat(gantt): 新增 buildGanttDateRange 预设解析函数"
```

---

### 任务 3：添加 i18n 翻译 key

**文件：**
- 修改：`src/i18n/zh_CN.json:58-76`（gantt 部分）
- 修改：`src/i18n/en_US.json:58-76`（gantt 部分）

- [ ] **步骤 1：在 `src/i18n/zh_CN.json` 的 gantt 对象中新增 datePreset 翻译**

在 `zh_CN.json` 的 `"gantt"` 对象中，在 `"endTime"` 之后新增：

```json
"datePresetLabel": "日期范围",
"datePresetToday": "今天",
"datePresetThisWeek": "本周",
"datePresetThisMonth": "本月",
"datePresetRecent7": "近7天",
"datePresetRecent30": "近30天",
"datePresetRecent90": "近90天",
"datePresetRecent180": "近180天",
"datePresetAll": "全部",
"datePresetCustom": "自定义"
```

- [ ] **步骤 2：在 `src/i18n/en_US.json` 的 gantt 对象中新增 datePreset 翻译**

在 `en_US.json` 的 `"gantt"` 对象中，在 `"endTime"` 之后新增：

```json
"datePresetLabel": "Date Range",
"datePresetToday": "Today",
"datePresetThisWeek": "This Week",
"datePresetThisMonth": "This Month",
"datePresetRecent7": "Recent 7 Days",
"datePresetRecent30": "Recent 30 Days",
"datePresetRecent90": "Recent 90 Days",
"datePresetRecent180": "Recent 180 Days",
"datePresetAll": "All",
"datePresetCustom": "Custom"
```

- [ ] **步骤 3：运行 lint 验证 i18n key 合法性**

运行：`npm run lint`
预期：PASS（i18n key 校验通过）

- [ ] **步骤 4：Commit**

```bash
git add src/i18n/zh_CN.json src/i18n/en_US.json
git commit -m "feat(gantt): 新增日期预设 i18n 翻译 key"
```

---

### 任务 4：修改 GanttTab 支持 datePreset

**文件：**
- 修改：`src/tabs/GanttTab.vue`

- [ ] **步骤 1：在 GanttTab.vue 中导入 GanttDatePreset 类型和 buildGanttDateRange 函数**

在 `<script setup>` 的 import 区域新增：

```typescript
import type { GanttDatePreset } from '@/types/workbench'
import { buildGanttDateRange } from '@/utils/ganttDateFilter'
```

- [ ] **步骤 2：修改 props 定义，新增 datePreset**

将 props 定义修改为：

```typescript
const props = withDefaults(defineProps<{
  embedded?: boolean
  viewMode?: 'day' | 'week' | 'month'
  showItems?: boolean
  datePreset?: GanttDatePreset
  startDate?: string
  endDate?: string
  groupId?: string
}>(), {
  embedded: false,
  viewMode: 'day',
  showItems: false,
  datePreset: 'all',
  startDate: '',
  endDate: '',
  groupId: '',
})
```

- [ ] **步骤 3：修改 emit 定义，新增 update:datePreset**

```typescript
const emit = defineEmits<{
  (event: 'update:viewMode', value: string): void
  (event: 'update:showItems', value: boolean): void
  (event: 'update:datePreset', value: GanttDatePreset): void
  (event: 'update:startDate', value: string): void
  (event: 'update:endDate', value: string): void
  (event: 'update:groupId', value: string): void
}>()
```

- [ ] **步骤 4：在 onMounted 中根据 datePreset 初始化日期**

在 `onMounted` 回调中，在 `settingsStore.loadFromPlugin()` 之后、`if (!selectedGroup.value...)` 之前，新增：

```typescript
  const range = buildGanttDateRange(props.datePreset, props.startDate, props.endDate)
  if (range) {
    startDate.value = range.start
    endDate.value = range.end
  }
```

- [ ] **步骤 5：新增 watch datePreset 变化**

在已有的 `watch(() => props.groupId, ...)` 之后新增：

```typescript
watch(() => props.datePreset, (val) => {
  const range = buildGanttDateRange(val, props.startDate, props.endDate)
  if (range) {
    startDate.value = range.start
    endDate.value = range.end
  } else {
    startDate.value = ''
    endDate.value = ''
  }
})
```

- [ ] **步骤 6：运行 typecheck 验证**

运行：`npx vue-tsc --noEmit`
预期：PASS

- [ ] **步骤 7：运行 lint 验证**

运行：`npm run lint`
预期：PASS

- [ ] **步骤 8：Commit**

```bash
git add src/tabs/GanttTab.vue
git commit -m "feat(gantt): GanttTab 支持 datePreset prop，动态解析日期预设"
```

---

### 任务 5：修改 WorkbenchGanttView 传递 datePreset

**文件：**
- 修改：`src/components/workbench/view/WorkbenchGanttView.vue`

- [ ] **步骤 1：在模板中传递 datePreset prop**

将 GanttTab 组件调用修改为：

```vue
<GanttTab
  embedded
  :view-mode="config.viewMode"
  :show-items="config.showItems"
  :date-preset="config.datePreset"
  :start-date="config.startDate"
  :end-date="config.endDate"
  :group-id="config.groupId"
/>
```

- [ ] **步骤 2：运行 typecheck 验证**

运行：`npx vue-tsc --noEmit`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add src/components/workbench/view/WorkbenchGanttView.vue
git commit -m "feat(gantt): WorkbenchGanttView 传递 datePreset prop"
```

---

### 任务 6：修改 GanttViewConfigDialog 新增日期预设选择 UI

**文件：**
- 修改：`src/components/workbench/dialogs/GanttViewConfigDialog.vue`

- [ ] **步骤 1：在 script 中新增 datePreset 相关状态和选项**

在 `const selectedGroup = ref(...)` 之后新增：

```typescript
import type { GanttDatePreset } from '@/types/workbench'
```

（在 import 区域添加）

在 `const selectedGroup = ref(...)` 之后新增：

```typescript
const selectedDatePreset = ref<GanttDatePreset>(props.initialConfig.datePreset ?? 'all')
const customStartDate = ref(props.initialConfig.startDate ?? '')
const customEndDate = ref(props.initialConfig.endDate ?? '')
```

在 `const groupOptions = computed(...)` 之后新增：

```typescript
const datePresetOptions = [
  { value: 'all', label: t('gantt').datePresetAll },
  { value: 'today', label: t('gantt').datePresetToday },
  { value: 'thisWeek', label: t('gantt').datePresetThisWeek },
  { value: 'thisMonth', label: t('gantt').datePresetThisMonth },
  { value: 'recent7', label: t('gantt').datePresetRecent7 },
  { value: 'recent30', label: t('gantt').datePresetRecent30 },
  { value: 'recent90', label: t('gantt').datePresetRecent90 },
  { value: 'recent180', label: t('gantt').datePresetRecent180 },
  { value: 'custom', label: t('gantt').datePresetCustom },
]

const isCustomDatePreset = computed(() => selectedDatePreset.value === 'custom')
```

- [ ] **步骤 2：修改 handleConfirm 输出 datePreset**

将 `handleConfirm` 函数修改为：

```typescript
function handleConfirm() {
  props.onConfirm({
    viewMode: selectedViewMode.value,
    showItems: showItems.value,
    datePreset: selectedDatePreset.value,
    startDate: selectedDatePreset.value === 'custom' ? customStartDate.value : undefined,
    endDate: selectedDatePreset.value === 'custom' ? customEndDate.value : undefined,
    groupId: selectedGroup.value || undefined,
  })
}
```

- [ ] **步骤 3：在模板中新增日期预设选择区域**

在 `showItems` 的 `gantt-config-dialog__field` div 之后、`groupId` 的 `gantt-config-dialog__field` div 之前，新增：

```vue
<div class="gantt-config-dialog__field">
  <label class="gantt-config-dialog__label">
    {{ t('gantt').datePresetLabel }}
  </label>
  <SySelect
    v-model="selectedDatePreset"
    data-testid="gantt-config-date-preset-select"
    :options="datePresetOptions"
  />
  <div
    v-if="isCustomDatePreset"
    class="gantt-config-dialog__custom-dates"
  >
    <div class="gantt-config-dialog__date-field">
      <label class="gantt-config-dialog__date-label">
        {{ t('gantt').startTime }}
      </label>
      <input
        v-model="customStartDate"
        type="date"
        class="gantt-config-dialog__date-input"
      />
    </div>
    <div class="gantt-config-dialog__date-field">
      <label class="gantt-config-dialog__date-label">
        {{ t('gantt').endTime }}
      </label>
      <input
        v-model="customEndDate"
        type="date"
        class="gantt-config-dialog__date-input"
      />
    </div>
  </div>
</div>
```

- [ ] **步骤 4：新增样式**

在 `<style>` 区域末尾新增：

```scss
.gantt-config-dialog__custom-dates {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.gantt-config-dialog__date-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.gantt-config-dialog__date-label {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
}

.gantt-config-dialog__date-input {
  padding: 5px 10px;
  border: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 13px;
}
```

- [ ] **步骤 5：运行 typecheck 验证**

运行：`npx vue-tsc --noEmit`
预期：PASS

- [ ] **步骤 6：运行 lint 验证**

运行：`npm run lint`
预期：PASS

- [ ] **步骤 7：Commit**

```bash
git add src/components/workbench/dialogs/GanttViewConfigDialog.vue
git commit -m "feat(gantt): GanttViewConfigDialog 新增日期预设选择 UI"
```

---

### 任务 7：修改 viewRegistry 默认配置和 openConfigDialog

**文件：**
- 修改：`src/workbench/viewRegistry.ts:186-219`

- [ ] **步骤 1：修改 gantt 的 createDefaultConfig**

将 `createDefaultConfig` 修改为：

```typescript
createDefaultConfig: () => ({
  viewMode: 'day',
  showItems: false,
  datePreset: 'all',
  startDate: '',
  endDate: '',
  groupId: '',
}) as Record<string, unknown>,
```

- [ ] **步骤 2：修改 openConfigDialog 的 initialConfig 和 onConfirm**

将 `openConfigDialog` 中的 gantt 部分修改为：

```typescript
openConfigDialog: ({
  entry,
  onUpdateConfig,
}) => {
  const config = entry.config as WorkbenchGanttViewConfig
  openGanttViewConfigDialog({
    initialConfig: {
      viewMode: config?.viewMode,
      showItems: config?.showItems,
      datePreset: config?.datePreset,
      startDate: config?.startDate,
      endDate: config?.endDate,
      groupId: config?.groupId,
    },
    onConfirm: async (nextConfig) => {
      await onUpdateConfig({
        viewMode: nextConfig.viewMode,
        showItems: nextConfig.showItems,
        datePreset: nextConfig.datePreset,
        startDate: nextConfig.startDate,
        endDate: nextConfig.endDate,
        groupId: nextConfig.groupId,
      })
    },
  })
},
```

- [ ] **步骤 3：运行 typecheck 验证**

运行：`npx vue-tsc --noEmit`
预期：PASS

- [ ] **步骤 4：运行 lint 验证**

运行：`npm run lint`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/workbench/viewRegistry.ts
git commit -m "feat(gantt): viewRegistry 默认配置新增 datePreset，openConfigDialog 传递 datePreset"
```

---

### 任务 8：最终验证

- [ ] **步骤 1：运行完整测试**

运行：`npm run test`
预期：全部 PASS

- [ ] **步骤 2：运行 typecheck**

运行：`npx vue-tsc --noEmit`
预期：PASS

- [ ] **步骤 3：运行 lint**

运行：`npm run lint`
预期：PASS

- [ ] **步骤 4：运行 build**

运行：`npm run build`
预期：构建成功
