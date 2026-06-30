# 日历视图点击行为配置 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 新增两个设置项，允许用户在月视图/周视图中选择"单击"或"双击"进入下级日视图/周视图，双击模式下单击仅做视觉选中高亮。

**架构：** 在 settings 数据模型中新增 `calendarDateClickBehavior` 和 `calendarWeekClickBehavior` 两个字段（类型 `'click' | 'dblclick'`，默认 `'click'`）。CalendarView 组件接收对应 props，在 `dateClick` 和 `navLinkWeekClick` 回调中根据设置决定行为；双击模式下通过原生 `dblclick` 事件监听器触发视图切换。

**技术栈：** Vue 3 (Composition API) + Pinia + FullCalendar 6 + TypeScript

**规格：** `docs/superpowers/specs/2026-06-01-calendar-click-behavior-design.md`

---

### 任务 1：i18n 翻译

**文件：**
- 修改：`src/i18n/zh_CN.json`
- 修改：`src/i18n/en_US.json`

- [ ] **步骤 1：添加中文翻译**

在 `src/i18n/zh_CN.json` 的 `settings.calendar` 对象中（第 289 行 `"pomodoroNoFocus"` 之后）新增以下字段：

```json
      "pomodoroNoFocus": "暂无专注记录",
      "dateClickBehavior": "日期点击进入方式",
      "dateClickBehaviorDesc": "在月视图或周视图中，点击日期格子进入日视图的方式",
      "weekClickBehavior": "周数列点击进入方式",
      "weekClickBehaviorDesc": "在月视图中，点击左侧周数列进入周视图的方式",
      "clickBehaviorSingle": "单击",
      "clickBehaviorDouble": "双击"
```

- [ ] **步骤 2：添加英文翻译**

在 `src/i18n/en_US.json` 的 `settings.calendar` 对象中（第 289 行 `"pomodoroNoFocus"` 之后）新增以下字段：

```json
      "pomodoroNoFocus": "No focus records",
      "dateClickBehavior": "Date Click to Enter Day View",
      "dateClickBehaviorDesc": "How to enter day view by clicking a date cell in month or week view",
      "weekClickBehavior": "Week Number Click to Enter Week View",
      "weekClickBehaviorDesc": "How to enter week view by clicking the week number in month view",
      "clickBehaviorSingle": "Single click",
      "clickBehaviorDouble": "Double click"
```

- [ ] **步骤 3：Commit**

```bash
git add src/i18n/zh_CN.json src/i18n/en_US.json
git commit -m "feat(calendar): add i18n for click behavior settings"
```

---

### 任务 2：SettingsData 类型与默认值

**文件：**
- 修改：`src/settings/types.ts:123-153`（`SettingsData` 接口）
- 修改：`src/settings/types.ts:193-227`（`defaultSettings`）

- [ ] **步骤 1：在 SettingsData 接口添加字段**

在 `src/settings/types.ts` 第 131 行 `calendarDefaultView: string` 之后新增：

```typescript
  calendarDefaultView: string
  calendarDateClickBehavior: 'click' | 'dblclick'
  calendarWeekClickBehavior: 'click' | 'dblclick'
```

- [ ] **步骤 2：在 defaultSettings 添加默认值**

在 `src/settings/types.ts` 第 200 行 `calendarDefaultView: 'timeGridDay'` 之后新增：

```typescript
  calendarDefaultView: 'timeGridDay',
  calendarDateClickBehavior: 'click',
  calendarWeekClickBehavior: 'click',
```

- [ ] **步骤 3：Commit**

```bash
git add src/settings/types.ts
git commit -m "feat(calendar): add click behavior fields to SettingsData"
```

---

### 任务 3：settingsStore 同步

**文件：**
- 修改：`src/stores/settingsStore.ts:17-43`（state）
- 修改：`src/stores/settingsStore.ts:78-115`（loadFromPlugin）
- 修改：`src/stores/settingsStore.ts:120-140`（saveToPlugin）

- [ ] **步骤 1：state 新增字段**

在 `src/stores/settingsStore.ts` 第 30 行 `showPomodoroTotal: true,` 之后新增：

```typescript
    showPomodoroTotal: true,
    calendarDateClickBehavior: 'click' as 'click' | 'dblclick',
    calendarWeekClickBehavior: 'click' as 'click' | 'dblclick',
```

- [ ] **步骤 2：loadFromPlugin 读取字段**

在 `src/stores/settingsStore.ts` 第 98 行 `this.showPomodoroTotal = settings.showPomodoroTotal ?? true` 之后新增：

```typescript
        this.showPomodoroTotal = settings.showPomodoroTotal ?? true
        this.calendarDateClickBehavior = settings.calendarDateClickBehavior || 'click'
        this.calendarWeekClickBehavior = settings.calendarWeekClickBehavior || 'click'
```

- [ ] **步骤 3：saveToPlugin 保存字段**

在 `src/stores/settingsStore.ts` 第 135 行 `showPomodoroTotal: this.showPomodoroTotal,` 之后新增：

```typescript
          showPomodoroTotal: this.showPomodoroTotal,
          calendarDateClickBehavior: this.calendarDateClickBehavior,
          calendarWeekClickBehavior: this.calendarWeekClickBehavior,
```

- [ ] **步骤 4：Commit**

```bash
git add src/stores/settingsStore.ts
git commit -m "feat(calendar): add click behavior to settingsStore"
```

---

### 任务 4：CalendarView 组件交互改造

**文件：**
- 修改：`src/components/calendar/CalendarView.vue:216-219`（Props 定义）
- 修改：`src/components/calendar/CalendarView.vue:540-550`（dateClick 回调）
- 修改：`src/components/calendar/CalendarView.vue:458-465`（navLinkWeekClick 回调）
- 修改：`src/components/calendar/CalendarView.vue`（FullCalendar 配置 + dblclick 监听）

- [ ] **步骤 1：Props 新增**

在 `src/components/calendar/CalendarView.vue` 第 216-219 行的 `Props` 接口中，`initialView` 之后新增两个可选字段：

```typescript
interface Props {
  events: CalendarEvent[]
  initialView?: string
  dateClickBehavior?: 'click' | 'dblclick'
  weekClickBehavior?: 'click' | 'dblclick'
}
```

- [ ] **步骤 2：FullCalendar 配置新增 selectable**

在 `src/components/calendar/CalendarView.vue` 第 473 行 `editable: true,` 之前新增：

```typescript
      selectable: true,
      unselectAuto: true,
      editable: true,
```

- [ ] **步骤 3：改造 dateClick 回调**

将 `src/components/calendar/CalendarView.vue` 第 540-550 行的 `dateClick` 回调替换为：

```typescript
      dateClick: (info) => {
        if (!calendarInstance) return
        const currentViewType = calendarInstance.view.type

        if (props.dateClickBehavior === 'dblclick'
            && (currentViewType === 'dayGridMonth' || currentViewType === 'timeGridWeek')) {
          calendarInstance.select(info.dateStr)
          return
        }

        calendarInstance.changeView('timeGridDay')
        calendarInstance.gotoDate(info.dateStr)
        emit('navigated')
        if (currentViewType !== 'timeGridDay') {
          emit('dayViewFromClick', currentViewType)
        }
      },
```

- [ ] **步骤 4：改造 navLinkWeekClick 回调**

将 `src/components/calendar/CalendarView.vue` 第 458-465 行的 `navLinkWeekClick` 回调替换为：

```typescript
      navLinkWeekClick: (weekStart: Date) => {
        if (!calendarInstance) return
        const currentViewType = calendarInstance.view.type

        if (props.weekClickBehavior === 'dblclick' && currentViewType === 'dayGridMonth') {
          const weekEnd = dayjs(weekStart).add(6, 'day').toDate()
          calendarInstance.select(weekStart, weekEnd)
          return
        }

        calendarInstance.changeView('timeGridWeek')
        calendarInstance.gotoDate(weekStart)
        emit('navigated')
        emit('weekViewFromClick', currentViewType)
      },
```

- [ ] **步骤 5：新增 dblclick 事件监听**

在 `src/components/calendar/CalendarView.vue` 的 `onMounted` 回调中（在 `calendarInstance.render()` 之前），添加原生 dblclick 监听：

```typescript
    calendarInstance.el.addEventListener('dblclick', handleDblClick)
```

在 `onUnmounted` 回调中添加清理逻辑：

```typescript
  onUnmounted(() => {
    if (calendarInstance) {
      calendarInstance.el.removeEventListener('dblclick', handleDblClick)
      calendarInstance.destroy()
    }
  })
```

在组件逻辑区域（`onMounted` 之前）添加 `handleDblClick` 函数：

```typescript
const handleDblClick = (e: MouseEvent) => {
  if (!calendarInstance) return
  if (plugin?.isMobile) return

  const viewType = calendarInstance.view.type

  if (props.dateClickBehavior === 'dblclick'
      && (viewType === 'dayGridMonth' || viewType === 'timeGridWeek')) {
    const dateEl = (e.target as HTMLElement).closest('[data-date]')
    if (dateEl) {
      const dateStr = dateEl.getAttribute('data-date')
      if (dateStr) {
        calendarInstance.changeView('timeGridDay')
        calendarInstance.gotoDate(dateStr)
        emit('navigated')
        emit('dayViewFromClick', viewType)
      }
    }
  }
}
```

- [ ] **步骤 6：Commit**

```bash
git add src/components/calendar/CalendarView.vue
git commit -m "feat(calendar): implement date/week click behavior with select highlight and dblclick"
```

---

### 任务 5：CalendarTab 传递 props 与 storeKeys 扩展

**文件：**
- 修改：`src/tabs/CalendarTab.vue:39-50`（CalendarView 模板绑定）
- 修改：`src/tabs/CalendarTab.vue:212`（storeKeys 数组）

- [ ] **步骤 1：CalendarView 模板绑定新增 props**

在 `src/tabs/CalendarTab.vue` 第 46 行 `:initial-view="currentView"` 之后新增：

```html
        :initial-view="currentView"
        :date-click-behavior="settingsStore.calendarDateClickBehavior"
        :week-click-behavior="settingsStore.calendarWeekClickBehavior"
```

- [ ] **步骤 2：handleDataRefresh storeKeys 扩展**

在 `src/tabs/CalendarTab.vue` 第 212 行 `storeKeys` 数组末尾（`'showPomodoroTotal'` 之后）新增：

```typescript
  const storeKeys = ['directories', 'groups', 'defaultGroup', 'calendarDefaultView', 'lunchBreakStart', 'lunchBreakEnd', 'showPomodoroBlocks', 'showPomodoroTotal', 'todoDock', 'scanMode', 'calendarDateClickBehavior', 'calendarWeekClickBehavior']
```

- [ ] **步骤 3：Commit**

```bash
git add src/tabs/CalendarTab.vue
git commit -m "feat(calendar): pass click behavior props and extend storeKeys"
```

---

### 任务 6：CalendarConfigSection 设置面板 UI

**文件：**
- 修改：`src/components/settings/CalendarConfigSection.vue:149-160`（props/emits）
- 修改：`src/components/settings/CalendarConfigSection.vue:36-38`（桌面端模板，SySettingItem）
- 修改：`src/components/settings/CalendarConfigSection.vue:136-137`（iOS 移动端模板）

- [ ] **步骤 1：Props 和 Emits 新增**

在 `src/components/settings/CalendarConfigSection.vue` 第 149-160 行的 `defineProps` 和 `defineEmits` 中新增：

```typescript
defineProps<{
  calendarDefaultView: string
  showPomodoroBlocks?: boolean
  showPomodoroTotal?: boolean
  isMobile?: boolean
  calendarDateClickBehavior?: 'click' | 'dblclick'
  calendarWeekClickBehavior?: 'click' | 'dblclick'
}>()

defineEmits<{
  'update:calendarDefaultView': [value: string]
  'update:showPomodoroBlocks': [value: boolean]
  'update:showPomodoroTotal': [value: boolean]
  'update:calendarDateClickBehavior': [value: 'click' | 'dblclick']
  'update:calendarWeekClickBehavior': [value: 'click' | 'dblclick']
}>()
```

- [ ] **步骤 2：桌面端新增两个 SySettingItem**

在 `src/components/settings/CalendarConfigSection.vue` 第 36 行（`showPomodoroTotal` 的 `SySettingItem` 闭合标签）之后、`</SySettingItemList>` 之前新增：

```html
        </SySettingItem>
        <SySettingItem
          :label="t('settings').calendar.dateClickBehavior"
          :description="t('settings').calendar.dateClickBehaviorDesc"
        >
          <SySelect
            :model-value="calendarDateClickBehavior ?? 'click'"
            :options="clickBehaviorOptions"
            @update:model-value="$emit('update:calendarDateClickBehavior', $event)"
          />
        </SySettingItem>
        <SySettingItem
          :label="t('settings').calendar.weekClickBehavior"
          :description="t('settings').calendar.weekClickBehaviorDesc"
        >
          <SySelect
            :model-value="calendarWeekClickBehavior ?? 'click'"
            :options="clickBehaviorOptions"
            @update:model-value="$emit('update:calendarWeekClickBehavior', $event)"
          />
        </SySettingItem>
      </SySettingItemList>
```

- [ ] **步骤 3：iOS 移动端新增两个 ios-cell-select**

在 `src/components/settings/CalendarConfigSection.vue` 第 136 行（`showPomodoroTotal` 的 ios-cell 闭合 div）之后、`</div>`（ios-group 闭合）之前新增：

```html
      </div>
      <!-- Date Click Behavior -->
      <div class="ios-group">
        <div class="ios-cell ios-cell-select">
          <div class="cell-content">
            <div class="cell-title">
              {{ t('settings').calendar.dateClickBehavior }}
            </div>
          </div>
          <div class="cell-accessory">
            <select
              :value="calendarDateClickBehavior ?? 'click'"
              class="ios-select"
              @change="$emit('update:calendarDateClickBehavior', ($event.target as HTMLSelectElement).value)"
            >
              <option value="click">
                {{ t('settings').calendar.clickBehaviorSingle }}
              </option>
              <option value="dblclick">
                {{ t('settings').calendar.clickBehaviorDouble }}
              </option>
            </select>
          </div>
        </div>
        <div class="cell-footer">
          {{ t('settings').calendar.dateClickBehaviorDesc }}
        </div>
      </div>
      <!-- Week Click Behavior -->
      <div class="ios-group">
        <div class="ios-cell ios-cell-select">
          <div class="cell-content">
            <div class="cell-title">
              {{ t('settings').calendar.weekClickBehavior }}
            </div>
          </div>
          <div class="cell-accessory">
            <select
              :value="calendarWeekClickBehavior ?? 'click'"
              class="ios-select"
              @change="$emit('update:calendarWeekClickBehavior', ($event.target as HTMLSelectElement).value)"
            >
              <option value="click">
                {{ t('settings').calendar.clickBehaviorSingle }}
              </option>
              <option value="dblclick">
                {{ t('settings').calendar.clickBehaviorDouble }}
              </option>
            </select>
          </div>
        </div>
        <div class="cell-footer">
          {{ t('settings').calendar.weekClickBehaviorDesc }}
        </div>
      </div>
    </div>
  </template>
```

- [ ] **步骤 4：新增 clickBehaviorOptions 常量**

在 `src/components/settings/CalendarConfigSection.vue` 第 162 行 `viewOptions` 之后新增：

```typescript
const clickBehaviorOptions = [
  {
    value: 'click',
    label: t('settings').calendar.clickBehaviorSingle,
  },
  {
    value: 'dblclick',
    label: t('settings').calendar.clickBehaviorDouble,
  },
]
```

- [ ] **步骤 5：Commit**

```bash
git add src/components/settings/CalendarConfigSection.vue
git commit -m "feat(calendar): add click behavior settings to CalendarConfigSection"
```

---

### 任务 7：SettingsDialog 绑定与保存

**文件：**
- 修改：`src/components/settings/SettingsDialog.vue:79-85`（CalendarConfigSection 模板绑定）
- 修改：`src/components/settings/SettingsDialog.vue:496-508`（handleSave $patch）

- [ ] **步骤 1：CalendarConfigSection 模板绑定新增**

在 `src/components/settings/SettingsDialog.vue` 第 83 行 `v-model:show-pomodoro-total="local.showPomodoroTotal"` 之后新增：

```html
            v-model:show-pomodoro-total="local.showPomodoroTotal"
            v-model:calendar-date-click-behavior="local.calendarDateClickBehavior"
            v-model:calendar-week-click-behavior="local.calendarWeekClickBehavior"
```

- [ ] **步骤 2：handleSave $patch 新增字段**

在 `src/components/settings/SettingsDialog.vue` 第 506 行 `showPomodoroTotal: settings.showPomodoroTotal ?? true,` 之后新增：

```typescript
      showPomodoroTotal: settings.showPomodoroTotal ?? true,
      calendarDateClickBehavior: settings.calendarDateClickBehavior || 'click',
      calendarWeekClickBehavior: settings.calendarWeekClickBehavior || 'click',
```

- [ ] **步骤 3：Commit**

```bash
git add src/components/settings/SettingsDialog.vue
git commit -m "feat(calendar): bind click behavior settings in SettingsDialog"
```

---

### 任务 8：Lint 验证与构建检查

- [ ] **步骤 1：运行 ESLint**

```bash
npm run lint
```

预期：无新增错误（已有 warning 可忽略）

- [ ] **步骤 2：运行构建**

```bash
npm run build
```

预期：构建成功，无 TypeScript 错误

- [ ] **步骤 3：如有 lint 或构建错误，修复后 commit**

```bash
git add -A
git commit -m "fix(calendar): resolve lint/build issues for click behavior feature"
```
