# DatePicker Widget 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复数选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 workbench dashboard 中新增 DatePickerWidget（月/周视图日历），支持通过 eventBus 与 TodoListWidget 等组件联动，实现点选日期范围后自动过滤目标组件数据。

**架构：** eventBus 松耦合联动——DatePickerWidget 选中日期范围后 emit `WIDGET_DATE_RANGE_CHANGED` 事件，目标 widget 监听并响应。配置存储在源端 widget config 中。

**技术栈：** Vue 3.5 + TypeScript + Pinia + SCSS + SiYuan Dialog API + eventBus

---

## 文件结构总览

### 新增文件（4 个）

| 文件 | 职责 |
|------|------|
| `src/components/workbench/widgets/DatePickerWidget.vue` | 日历 widget 主组件（月/周视图切换、日期选择、范围高亮、联动 emit） |
| `src/components/workbench/dialogs/DatePickerWidgetConfigDialog.vue` | 主配置弹框（联动规则列表、添加/编辑/删除） |
| `src/components/workbench/dialogs/DatePickerLinkageEditorDialog.vue` | 二级弹框（选择目标组件 + 字段关联展示） |
| `src/workbench/datePickerWidgetConfigDialog.ts` | 弹框打开函数（SiYuan Dialog + Vue createApp 挂载） |

### 修改文件（5 个）

| 文件 | 改动内容 |
|------|----------|
| `src/types/workbench.ts` | 新增类型：`datePicker` 到 union、`LinkableWidgetType`、`WidgetLinkageRule`、`WorkbenchDatePickerWidgetConfig` |
| `src/utils/eventBus.ts` | Events 枚举新增 `WIDGET_DATE_RANGE_CHANGED` |
| `src/workbench/widgetRegistry.ts` | 注册 `datePicker` definition（type/name/icon/sizes/config/dialog） |
| `src/components/workbench/dashboard/DashboardCanvas.vue` | widgetComponents map 新增 datePicker；handleConfigureWidget 传 dashboardWidgets |
| `src/components/workbench/widgets/TodoListWidget.vue` | 新增 eventBus 监听 WIDGET_DATE_RANGE_CHANGED，匹配则写入 todoState |

### i18n 修改（2 个）

| 文件 | 改动内容 |
|------|----------|
| `src/i18n/zh_CN.json` | 新增 `datePicker` 命名空间（12 个 key） |
| `src/i18n/en_US.json` | 新增 `datePicker` 命名空间（12 个 key） |

---

## 任务 1：类型定义 + eventBus 扩展

**文件：**
- 修改：`src/types/workbench.ts`
- 修改：`src/utils/eventBus.ts`

- [ ] **步骤 1：扩展 WorkbenchWidgetType 联合类型**

在 [workbench.ts](file:///c:\dev\projects\open-source\siyuan-plugin-bullet-journal\src\types\workbench.ts) 的 `WorkbenchWidgetType` 联合类型中追加 `'datePicker'`：

```typescript
export type WorkbenchWidgetType =
  | 'todoList'
  | 'quadrantSummary'
  | 'habitWeek'
  | 'miniCalendar'
  | 'pomodoroStats'
  | 'datePicker';
```

- [ ] **步骤 2：新增联动相关类型**

在 [workbench.ts](file:///c:\dev\projects\open-source\siyuan-plugin-bullet-journal\src\types\workbench.ts) 中 `WorkbenchPomodorostatsWidgetConfig` 接口之后追加：

```typescript
/** 可联动的目标组件类型（可扩展） */
export type LinkableWidgetType = 'todoList';

/** 字段映射：日历产出字段 → 目标组件属性 */
export interface WidgetLinkageFieldMap {
  sourceField: 'dateRange';
  targetProperty: 'dateRange';
}

/** 单条联动规则 */
export interface WidgetLinkageRule {
  id: string;
  targetWidgetId: string;
  targetType: LinkableWidgetType;
  fieldMapping: WidgetLinkageFieldMap;
}

/** DatePickerWidget 配置 */
export interface WorkbenchDatePickerWidgetConfig {
  view?: 'month' | 'week';
  linkages: WidgetLinkageRule[];
}
```

- [ ] **步骤 3：扩展 Events 枚举**

在 [eventBus.ts](file:///c:\dev\projects\open-source\siyuan-plugin-bullet-journal\src\utils\eventBus.ts) 的 `Events` 对象中追加：

```typescript
WIDGET_DATE_RANGE_CHANGED: 'widget:date-range-changed',
```

在 `Events` 对象的 JSDoc 或注释中说明 payload 类型：
```typescript
// payload: { sourceWidgetId: string; targetWidgetId: string; dateRange: { start: string; end: string } }
```

- [ ] **步骤 4：运行 lint 验证**

运行：`npm run lint`
预期：无错误

- [ ] **步骤 5：Commit**

```bash
git add src/types/workbench.ts src/utils/eventBus.ts
git commit -m "feat(types, eventbus): add DatePickerWidget types and WIDGET_DATE_RANGE_CHANGED event"
```

---

## 任务 2：i18n 国际化文案

**文件：**
- 修改：`src/i18n/zh_CN.json`
- 修改：`src/i18n/en_US.json`

- [ ] **步骤 1：在 zh_CN.json 中新增 datePicker 命名空间**

在 [zh_CN.json](file:///c:\dev\projects\open-source\siyuan-plugin-bullet-journal\src\i18n\zh_CN.json) 的顶层（与 `"calendar"` 同级位置）插入：

```json
"datePicker": {
  "title": "日历",
  "month": "月",
  "week": "周",
  "linkage": "组件联动",
  "addLinkage": "添加联动",
  "emptyLinkage": "点击添加联动规则",
  "editLinkage": "编辑联动规则",
  "selectTarget": "选择目标组件",
  "fieldMapping": "字段关联",
  "dateRangeSource": "日历日期范围",
  "dateRangeTarget": "待办时间过滤"
},
```

注意：插入位置应在 `"calendar"` 键之后、`"gantt"` 键之前（保持字母序），或在 `"workbench"` 之后。实际检查 JSON 结构后确定最佳位置。

- [ ] **步骤 2：在 en_US.json 中新增 datePicker 命名空间**

在 [en_US.json](file:///c:\dev\projects\open-source\siyuan-plugin-bullet-journal\src\i18n\en_US.json) 对应位置插入：

```json
"datePicker": {
  "title": "Calendar",
  "month": "Month",
  "week": "Week",
  "linkage": "Widget Linkage",
  "addLinkage": "Add Linkage",
  "emptyLinkage": "Click to add linkage rule",
  "editLinkage": "Edit Linkage Rule",
  "selectTarget": "Select Target Widget",
  "fieldMapping": "Field Mapping",
  "dateRangeSource": "Calendar Date Range",
  "dateRangeTarget": "Todo Date Filter"
},
```

- [ ] **步骤 3：验证 i18n key 校验**

运行：`npm run lint`
预期：i18n validate keys 插件不报错（如果有的话会检测未使用的 key，新 key 暂未使用可能 warning，可忽略）

- [ ] **步骤 4：Commit**

```bash
git add src/i18n/zh_CN.json src/i18n/en_US.json
git commit -m "feat(i18n): add DatePicker widget i18n keys"
```

---

## 任务 3：DatePickerWidget 组件

**文件：**
- 创建：`src/components/workbench/widgets/DatePickerWidget.vue`

- [ ] **步骤 1：创建 DatePickerWidget.vue 基础结构**

创建文件并写入基础模板和脚本骨架。核心要点：

**模板结构：**
```vue
<template>
  <div class="workbench-widget-date-picker" data-testid="workbench-widget-date-picker">
    <div class="workbench-widget-date-picker__toolbar">
      <button
        class="workbench-widget-date-picker__view-btn"
        :class="{ 'is-active': currentView === 'month' }"
        type="button"
        @click="currentView = 'month'"
      >{{ t('datePicker').month }}</button>
      <button
        class="workbench-widget-date-picker__view-btn"
        :class="{ 'is-active': currentView === 'week' }"
        type="button"
        @click="currentView = 'week'"
      >{{ t('datePicker').week }}</button>
    </div>

    <div v-if="currentView === 'month'" class="workbench-widget-date-picker__calendar">
      <DatePickerMonthGrid
        v-model="selectedDate"
        :range-start="rangeStart"
        :range-end="rangeEnd"
        :get-summary-by-date="getSummaryByDate"
        @date-click="handleDateClick"
      />
    </div>

    <div v-else class="workbench-widget-date-picker__calendar">
      <DatePickerWeekGrid
        v-model="selectedDate"
        :range-start="rangeStart"
        :range-end="rangeEnd"
        :get-summary-by-date="getSummaryByDate"
        @date-click="handleDateClick"
      />
    </div>
  </div>
</template>
```

**脚本逻辑：**
```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { t } from '@/i18n';
import { eventBus, Events } from '@/utils/eventBus';
import { useSafeProjectStore } from './useSafeProjectStore';
import type { WorkbenchDatePickerWidgetConfig, WorkbenchWidgetInstance } from '@/types/workbench';
import dayjs from '@/utils/dayjs';

const props = defineProps<{
  widget?: WorkbenchWidgetInstance;
}>();

const projectStore = useSafeProjectStore();
const pickerConfig = computed(() => (props.widget?.config ?? {}) as WorkbenchDatePickerWidgetConfig);
const currentView = ref(pickerConfig.value.view ?? 'month');
const selectedDate = ref(dayjs().format('YYYY-MM-DD'));
const rangeStart = ref<string>('');
const rangeEnd = ref<string<string>>('');
let lastClickedDate = '';

watch(() => pickerConfig.value.view, (v) => {
  if (v) currentView.value = v;
});

function getSummaryByDate(date: string) {
  return projectStore?.getFocusPlanSummaryByDate(date, '') ?? emptySummary();
}

function handleDateClick(date: string, event: MouseEvent) {
  if (event.shiftKey && lastClickedDate) {
    const d1 = dayjs(lastClickedDate);
    const d2 = dayjs(date);
    rangeStart.value = d1.isBefore(d2) ? lastClickedDate : date;
    rangeEnd.value = d1.isBefore(d2) ? date : lastClickedDate;
  } else {
    rangeStart.value = date;
    rangeEnd.value = date;
    lastClickedDate = date;
  }
  selectedDate.value = date;
  emitLinkageEvent(rangeStart.value, rangeEnd.value);
}

function emitLinkageEvent(start: string, end: string) {
  if (!props.widget?.id) return;
  const linkages = pickerConfig.value.linkages ?? [];
  for (const rule of linkages) {
    eventBus.emit(Events.WIDGET_DATE_RANGE_CHANGED, {
      sourceWidgetId: props.widget.id,
      targetWidgetId: rule.targetWidgetId,
      dateRange: { start, end },
    });
  }
}

function emptySummary() {
  return { date: '', total: 0, estimatedMinutes: 0, actualMinutes: 0,
    matched: 0, overrun: 0, underrun: 0, notStarted: 0, inProgress: 0, unplanned: 0 };
}
</script>
```

**样式：**
```scss
<style lang="scss" scoped>
.workbench-widget-date-picker {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.workbench-widget-date-picker__toolbar {
  display: flex;
  gap: 4px;
  padding: 0 4px 8px;
  flex-shrink: 0;
}
.workbench-widget-date-picker__view-btn {
  padding: 2px 10px;
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  font-size: 12px;
  cursor: pointer;
  &.is-active {
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
    background: var(--b3-theme-primary-lightest);
  }
}
.workbench-widget-date-picker__calendar {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
</style>
```

- [ ] **步骤 2：创建 DatePickerMonthGrid 子组件**

创建 `src/components/workbench/widgets/DatePickerMonthGrid.vue`，基于 [FocusWorkbenchMiniCalendar.vue](file:///c:\dev\projects\open-source\siyuan-plugin-bullet-journal\src\components\pomodoro\review\FocusWorkbenchMiniCalendar.vue) 改造：

关键差异（相对于原始 FocusWorkbenchMiniCalendar）：
1. **移除 v-model 双向绑定**，改为 `selectedDate` prop + `@date-click` emit
2. **新增 rangeStart/rangeEnd props**，用于高亮选中范围
3. **移除 legend 图例**（由父组件控制是否显示）
4. **保留日期标记点逻辑**（hasPlanned/hasFocused 等）
5. **新增范围高亮 CSS class**：`.cell--in-range`

模板中 cell 的 class 绑定增加：
```html
:class="{
  ...
  'cell--in-range': isInRange(cell.date),
  'cell--range-start': cell.date === rangeStart,
  'cell--range-end': cell.date === rangeEnd,
}"
```

新增 `isInRange` 方法：
```ts
function isInRange(date: string): boolean {
  if (!rangeStart.value || !rangeEnd.value || !date) return false;
  return date >= rangeStart.value && date <= rangeEnd.value;
}
```

Props 定义：
```ts
defineProps<{
  selectedDate: string;
  rangeStart: string;
  rangeEnd: string;
  getSummaryByDate: (date: string) => FocusPlanDailySummary;
}>();
defineEmits<{
  'update:selectedDate': [value: string];
  'date-click': [date: string, event: MouseEvent];
}>();
```

- [ ] **步骤 3：创建 DatePickerWeekGrid 子组件**

创建 `src/components/workbench/widgets/DatePickerWeekGrid.vue`：

周视图为简化版网格：
- 计算当前 selectedDate 所在周的周一到周日（7 天）
- 每个单元格显示星期标题 + 日期号 + 标记点
- 支持 range 高亮（同月历）
- 点击行为 emit `date-click`

核心计算逻辑：
```ts
const weekDates = computed(() => {
  const d = dayjs(selectedDate.value);
  let dow = d.day(); // 0=Sun
  if (dow === 0) dow = 7;
  const monday = d.subtract(dow - 1, 'day');
  return Array.from({ length: 7 }, (_, i) =>
    monday.add(i, 'day').format('YYYY-MM-DD')
  );
});
```

- [ ] **步骤 4：运行 lint + typecheck**

运行：`npm run lint`
预期：无错误

- [ ] **步骤 5：Commit**

```bash
git add src/components/workbench/widgets/DatePickerWidget.vue
git add src/components/workbench/widgets/DatePickerMonthGrid.vue
git add src/components/workbench/widgets/DatePickerWeekGrid.vue
git commit -m "feat(widgets): add DatePickerWidget with month/week views and date range selection"
```

---

## 任务 4：配置弹框 — 二级弹框（联动规则编辑器）

**文件：**
- 创建：`src/components/workbench/dialogs/DatePickerLinkageEditorDialog.vue`

这是先于主弹框实现的子弹框，因为主弹框依赖它。

- [ ] **步骤 1：创建 DatePickerLinkageEditorDialog.vue**

**模板：**
```vue
<template>
  <WorkbenchConfigDialogLayout>
    <div class="linkage-editor-dialog__body">
      <div class="linkage-editor-dialog__target-panel">
        <label class="linkage-editor-dialog__label">{{ t('datePicker').selectTarget }}</label>
        <div class="linkage-editor-dialog__target-list">
          <label
            v-for="widget in availableWidgets"
            :key="widget.id"
            class="linkage-editor-dialog__target-item"
          >
            <input
              :checked="selectedTargetId === widget.id"
              name="targetWidget"
              type="radio"
              @change="selectedTargetId = widget.id"
            />
            <span>{{ widget.title || getWidgetTypeName(widget.type) }}</span>
          </label>
        </div>
      </div>

      <div class="linkage-editor-dialog__field-panel">
        <label class="linkage-editor-dialog__label">{{ t('datePicker').fieldMapping }}</label>
        <div class="linkage-editor-dialog__field-map">
          <span class="linkage-editor-dialog__field-source">{{ t('datePicker').dateRangeSource }}</span>
          <span class="linkage-editor-dialog__field-arrow">→</span>
          <span class="linkage-editor-dialog__field-target">{{ t('datePicker').dateRangeTarget }}</span>
        </div>
      </div>
    </div>

    <template #footer>
      <button class="b3-button b3-button--cancel" type="button" @click="onCancel">
        {{ t('common').cancel }}
      </button>
      <button
        class="b3-button b3-button--text"
        type="button"
        :disabled="!selectedTargetId"
        @click="handleConfirm"
      >
        {{ t('common').confirm }}
      </button>
    </template>
  </WorkbenchConfigDialogLayout>
</template>
```

**脚本：**
```vue
<script setup lang="ts">
import { computed, ref } from 'vue';
import WorkbenchConfigDialogLayout from './WorkbenchConfigDialogLayout.vue';
import { t } from '@/i18n';
import { getWidgetDefinition } from '@/workbench/widgetRegistry';
import type { WorkbenchWidgetInstance, WidgetLinkageRule, LinkableWidgetType } from '@/types/workbench';

const props = defineProps<{
  editingRule?: WidgetLinkageRule | null;
  availableWidgets: WorkbenchWidgetInstance[];
  onConfirm: (rule: WidgetLinkageRule) => void;
  onCancel: () => void;
}>();

const selectedTargetId = ref(props.editingRule?.targetWidgetId ?? '');

const availableWidgets = computed(() =>
  props.availableWidgets.filter(w =>
    ['todoList'].includes(w.type) as string[]
  )
);

function getWidgetTypeName(type: string): string {
  try { return getWidgetDefinition(type as any).name; }
  catch { return type; }
}

function handleConfirm() {
  if (!selectedTargetId.value) return;
  props.onConfirm({
    id: props.editingRule?.id ?? crypto.randomUUID(),
    targetWidgetId: selectedTargetId.value,
    targetType: 'todoList' as LinkableWidgetType,
    fieldMapping: { sourceField: 'dateRange', targetProperty: 'dateRange' },
  });
}
</script>
```

**样式：**
```scss
<linkage-editor-dialog__body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
.linkage-editor-dialog__label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 8px;
  color: var(--b3-theme-on-background);
}
.linkage-editor-dialog__target-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.linkage-editor-dialog__target-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  cursor: pointer;
  &:hover { background: var(--b3-theme-surface); }
}
.linkage-editor-dialog__field-map {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  background: var(--b3-theme-surface);
  font-size: 13px;
}
.linkage-editor-dialog__field-arrow {
  color: var(--b3-theme-primary);
  font-weight: 600;
}
```

- [ ] **步骤 2：运行 lint 验证**

运行：`npm run lint`
预期：无错误

- [ ] **步骤 3：Commit**

```bash
git add src/components/workbench/dialogs/DatePickerLinkageEditorDialog.vue
git commit -m "feat(dialogs): add DatePicker linkage editor dialog (level 2)"
```

---

## 任务 5：配置弹框 — 主弹框 + 打开函数

**文件：**
- 创建：`src/components/workbench/dialogs/DatePickerWidgetConfigDialog.vue`
- 创建：`src/workbench/datePickerWidgetConfigDialog.ts`

- [ ] **步骤 1：创建 DatePickerWidgetConfigDialog.vue**

**模板：**
```vue
<template>
  <WorkbenchConfigDialogLayout>
    <div class="date-picker-config-dialog__body">
      <div class="date-picker-config-dialog__section">
        <div class="date-picker-config-dialog__section-header">
          <span class="date-picker-config-dialog__section-title">{{ t('datePicker').linkage }}</span>
          <button
            class="date-picker-config-dialog__add-btn"
            type="button"
            @click="handleAdd"
          >+ {{ t('datePicker').addLinkage }}</button>
        </div>

        <div v-if="linkages.length === 0" class="date-picker-config-dialog__empty">
          {{ t('datePicker').emptyLinkage }}
        </div>

        <div v-else class="date-picker-config-dialog__rule-list">
          <div
            v-for="rule in linkages"
            :key="rule.id"
            class="date-picker-config-dialog__rule-item"
          >
            <span class="date-picker-config-dialog__rule-name">
              {{ getTargetWidgetName(rule.targetWidgetId) }}
            </span>
            <div class="date-picker-config-dialog__rule-actions">
              <button type="button" @click="handleEdit(rule)">✏️</button>
              <button type="button" @click="handleDelete(rule.id)">🗑️</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <button class="b3-button b3-button--cancel" type="button" @click="onCancel">
        {{ t('common').cancel }}
      </button>
      <button class="b3-button b3-button--text" type="button" @click="handleConfirm">
        {{ t('common').confirm }}
      </button>
    </template>
  </WorkbenchConfigDialogLayout>
```

**脚本：**
```vue
<script setup lang="ts">
import { ref } from 'vue';
import { createApp } from 'vue';
import { Dialog } from 'siyuan';
import { getSharedPinia } from '@/utils/sharedPinia';
import WorkbenchConfigDialogLayout from './WorkbenchConfigDialogLayout.vue';
import DatePickerLinkageEditorDialog from './DatePickerLinkageEditorDialog.vue';
import { t } from '@/i18n';
import { getWidgetDefinition } from '@/workbench/widgetRegistry';
import type { WorkbenchDatePickerWidgetConfig, WidgetLinkageRule, WorkbenchWidgetInstance } from '@/types/workbench';

const props = defineProps<{
  initialConfig: WorkbenchDatePickerWidgetConfig;
  dashboardWidgets: WorkbenchWidgetInstance[];
  onConfirm: (config: WorkbenchDatePickerWidgetConfig) => void;
  onCancel: () => void;
}>();

const linkages = ref<WidgetLinkageRule[]>([...(props.initialConfig.linkages ?? [])]);

function getTargetWidgetName(widgetId: string): string {
  const w = props.dashboardWidgets.find(w => w.id === widgetId);
  if (w?.title) return w.title;
  if (w) return getWidgetDefinition(w.type).name;
  return `(unknown: ${widgetId})`;
}

function handleAdd() {
  openEditor(null);
}

function handleEdit(rule: WidgetLinkageRule) {
  openEditor(rule);
}

function handleDelete(ruleId: string) {
  linkages.value = linkages.value.filter(r => r.id !== ruleId);
}

function openEditor(editingRule: WidgetLinkageRule | null) {
  let dialog: Dialog | null = null;
  const mountEl = document.createElement('div');
  let app: ReturnType<typeof createApp> | null = null;

  dialog = new Dialog({
    title: editingRule ? t('datePicker').editLinkage : t('datePicker').addLinkage,
    content: '',
    width: '480px',
    destroyCallback: () => {
      app?.unmount();
      app = null;
    },
  });

  app = createApp(DatePickerLinkageEditorDialog, {
    editingRule,
    availableWidgets: props.dashboardWidgets,
    onConfirm: (rule: WidgetLinkageRule) => {
      if (editingRule) {
        const idx = linkages.value.findIndex(r => r.id === editingRule.id);
        if (idx >= 0) linkages.value[idx] = rule;
      } else {
        linkages.value.push(rule);
      }
      dialog?.destroy();
    },
    onCancel: () => dialog?.destroy(),
  });

  const pinia = getSharedPinia();
  if (pinia) app.use(pinia);
  app.mount(mountEl);
  dialog.element.querySelector('.b3-dialog__body')?.appendChild(mountEl);
}

function handleConfirm() {
  props.onConfirm({
    view: props.initialConfig.view ?? 'month',
    linkages: linkages.value,
  });
}
</script>
```

**样式：**
```scss
.date-picker-config-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.date-picker-config-dialog__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.date-picker-config-dialog__section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}
.date-picker-config-dialog__add-btn {
  padding: 2px 10px;
  border: 1px solid var(--b3-theme-primary);
  border-radius: 6px;
  background: transparent;
  color: var(--b3-theme-primary);
  font-size: 12px;
  cursor: pointer;
}
.date-picker-config-dialog__empty {
  color: var(--b3-theme-on-surface);
  font-size: 13px;
  padding: 16px;
  text-align: center;
  border: 1px dashed var(--b3-border-color);
  border-radius: 6px;
}
.date-picker-config-dialog__rule-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.date-picker-config-dialog__rule-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
}
.date-picker-config-dialog__rule-actions {
  display: flex;
  gap: 8px;
}
.date-picker-config-dialog__rule-actions button {
  padding: 2px 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
}
```

- [ ] **步骤 2：创建打开函数 datePickerWidgetConfigDialog.ts**

```typescript
import { Dialog } from 'siyuan';
import { createApp } from 'vue';
import DatePickerWidgetConfigDialog from '@/components/workbench/dialogs/DatePickerWidgetConfigDialog.vue';
import { t } from '@/i18n';
import type { WorkbenchDatePickerWidgetConfig, WorkbenchWidgetInstance } from '@/types/workbench';
import { getSharedPinia } from '@/utils/sharedPinia';

export function openDatePickerWidgetConfigDialog(options: {
  initialConfig: WorkbenchDatePickerWidgetConfig;
  dashboardWidgets: WorkbenchWidgetInstance[];
  onConfirm: (config: WorkbenchDatePickerWidgetConfig) => void | Promise<void>;
}): Dialog {
  const mountEl = document.createElement('div');
  let app: ReturnType<typeof createApp> | null = null;
  let isConfirming = false;

  const dialog = new Dialog({
    title: t('workbench').configure,
    content: '',
    width: '420px',
    destroyCallback: () => {
      app?.unmount();
      app = null;
    },
  });

  const closeDialog = () => dialog.destroy();

  app = createApp(DatePickerWidgetConfigDialog, {
    initialConfig: options.initialConfig,
    dashboardWidgets: options.dashboardWidgets,
    onCancel: closeDialog,
    onConfirm: async (config: WorkbenchDatePickerWidgetConfig) => {
      if (isConfirming) return;
      isConfirming = true;
      try {
        await options.onConfirm(config);
        closeDialog();
      } finally {
        isConfirming = false;
      },
    },
  });

  const pinia = getSharedPinia();
  if (pinia) app.use(pinia);
  app.mount(mountEl);

  dialog.element.querySelector('.b3-dialog__body')?.appendChild(mountEl);
  return dialog;
}
```

- [ ] **步骤 3：运行 lint 验证**

运行：`npm run lint`
预期：无错误

- [ ] **步骤 4：Commit**

```bash
git add src/components/workbench/dialogs/DatePickerWidgetConfigDialog.vue
git add src/workbench/datePickerWidgetConfigDialog.ts
git commit -m "feat(dialogs): add DatePicker widget config dialog with linkage rules editor"
```

---

## 任务 6：注册 Widget + DashboardCanvas 接入

**文件：**
- 修改：`src/workbench/widgetRegistry.ts`
- 修改：`src/components/workbench/dashboard/DashboardCanvas.vue`

- [ ] **步骤 1：在 widgetRegistry.ts 中注册 datePicker**

在 [widgetRegistry.ts](file:///c:\dev\projects\open-source\siyuan-plugin-bullet-journal\src\workbench\widgetRegistry.ts) 的 `createWidgetRegistry()` 返回对象中，`pomodoroStats` 条目之后追加：

首先更新 import 行，加入新类型：
```typescript
import type {
  WorkbenchCalendarWidgetConfig,
  WorkbenchDatePickerWidgetConfig,   // 新增
  WorkbenchHabitWeekWidgetConfig,
  ...
} from '@/types/workbench';
```

新增 import：
```typescript
import { openDatePickerWidgetConfigDialog } from '@/workbench/datePickerWidgetConfigDialog';
```

注册条目：
```typescript
datePicker: {
  type: 'datePicker',
  name: t('datePicker').title,
  icon: 'iconCalendar',
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 3, h: 3 },
  createDefaultConfig: (): WorkbenchDatePickerWidgetConfig => ({
    view: 'month',
    linkages: [],
  }),
  openConfigDialog: ({ widget, onUpdateConfig, dashboardWidgets }) => {
    const pickerConfig = widget.config as WorkbenchDatePickerWidgetConfig;
    openDatePickerWidgetConfigDialog({
      initialConfig: pickerConfig,
      dashboardWidgets: dashboardWidgets ?? [],
      onConfirm: async (nextConfig) => {
        await onUpdateConfig(nextConfig);
      },
    });
  },
},
```

注意：`openConfigDialog` 的 context 类型 `WorkbenchWidgetConfigContext` 需要扩展以支持 `dashboardWidgets` 参数。修改 context 类型定义为：

```typescript
type WorkbenchWidgetConfigContext = {
  widget: WorkbenchWidgetInstance;
  onUpdateConfig: (config: Record<string, unknown>) => Promise<void>;
  dashboardWidgets?: WorkbenchWidgetInstance[];  // 新增可选字段
};
```

- [ ] **步骤 2：在 DashboardCanvas.vue 中注册组件并传递 widgets**

在 [DashboardCanvas.vue](file:///c:\dev\projects\open-source\siyuan-plugin-bullet-journal\src\components\workbench\dashboard\DashboardCanvas.vue) 中：

1. 新增 import：
```typescript
import DatePickerWidget from '@/components/workbench/widgets/DatePickerWidget.vue';
```

2. 在 `widgetComponents` map 中追加：
```typescript
const widgetComponents: Record<WorkbenchWidgetType, Component> = {
  ...
  datePicker: DatePickerWidget,
};
```

3. 修改 `handleConfigureWidget` 方法，传递 `dashboardWidgets` 给 context：

将：
```typescript
definition.openConfigDialog?.({
  widget,
  onUpdateConfig: async (config) => {
    await workbenchStore.updateWidgetConfig(dashboard.value!.id, widgetId, config);
  },
});
```

改为：
```typescript
definition.openConfigDialog?.({
  widget,
  onUpdateConfig: async (config) => {
    await workbenchStore.updateWidgetConfig(dashboard.value!.id, widgetId, config);
  },
  dashboardWidgets: dashboard.value?.widgets ?? [],
});
```

- [ ] **步骤 3：运行 lint + typecheck**

运行：`npm run lint`
预期：无错误

- [ ] **步骤 4：Commit**

```bash
git add src/workbench/widgetRegistry.ts src/components/workbench/dashboard/DashboardCanvas.vue
git commit -m "feat(workbench): register DatePickerWidget and wire up DashboardCanvas"
```

---

## 任务 7：TodoListWidget 联动接收端改造

**文件：**
- 修改：`src/components/workbench/widgets/TodoListWidget.vue`

- [ ] **步骤 1：添加 eventBus 导入和监听**

在 [TodoListWidget.vue](file:///c:\dev\projects\open-source\siyuan-plugin-bullet-journal\src\components\workbench\widgets\TodoListWidget.vue) 的 `<script setup>` 中：

1. 新增导入（在现有 import 区域末尾追加）：
```typescript
import { eventBus, Events } from '@/utils/eventBus';
```

2. 在 `onMounted` 回调中（现有代码约第 235 行附近），在 `document.addEventListener` 之前追加：
```typescript
const unsubscribeDateRange = eventBus.on(
  Events.WIDGET_DATE_RANGE_CHANGED,
  (payload: { sourceWidgetId: string; targetWidgetId: string; dateRange: { start: string; end: string } }) => {
    if (!props.widget || payload.targetWidgetId !== props.widget.id) return;
    todoState.dateFilterType.value = 'custom';
    todoState.startDate.value = payload.dateRange.start;
    todoState.endDate.value = payload.dateRange.end;
  },
);
```

3. 在 `onUnmounted` 回调中（约第 253 行），在 `preview.dispose()` 之前追加：
```typescript
unsubscribeDateRange?.();
```

- [ ] **步骤 2：运行 lint + typecheck**

运行：`npm run lint`
预期：无错误

- [ ] **步骤 3：运行测试确认无回归**

运行：`npm run test`
预期：所有测试通过

- [ ] **步骤 4：Commit**

```bash
git add src/components/workbench/widgets/TodoListWidget.vue
git commit -m "feat(todo-widget): add eventBus listener for date range linkage from DatePickerWidget"
```

---

## 任务 8：端到端验证

- [ ] **步骤 1：完整构建验证**

运行：`npm run build`
预期：构建成功，无 TS 错误

- [ ] **步骤 2：lint 全量检查**

运行：`npm run lint`
预期：无错误

- [ ] **步骤 3：最终 Commit（如有遗漏修复）**

```bash
git add -A
git commit -m "fix: final adjustments for DatePickerWidget feature"
```

---

## 自检清单

### 规格覆盖度

| 规格章节 | 实现任务 |
|----------|----------|
| §2 数据模型（类型+eventBus） | 任务 1 |
| §4 DatePickerWidget 组件（月/周视图、选择、联动emit） | 任务 3 |
| §5 配置弹框（主弹框+二级弹框+打开函数） | 任务 4 + 任务 5 |
| §6 TodoListWidget 接收端改造 | 任务 7 |
| §7 文件变更清单 | 全部任务覆盖 |
| §8 Widget 注册 | 任务 6 |
| i18n | 任务 2 |

### 占位符扫描

- 无 "待定"、"TODO"、"后续实现"
- 每个步骤包含具体代码或精确命令
- 无模糊描述如 "添加适当的错误处理"

### 类型一致性

- `WorkbenchDatePickerWidgetConfig` 在任务 1 定义 → 任务 3/4/5/6 使用一致
- `WidgetLinkageRule` 在任务 1 定义 → 任务 4/5 使用一致
- `Events.WIDGET_DATE_RANGE_CHANGED` 在任务 1 定义 → 任务 3/7 使用一致
- `WorkbenchWidgetConfigContext.dashboardWidgets` 在任务 6 扩展 → 任务 5/6 使用一致
