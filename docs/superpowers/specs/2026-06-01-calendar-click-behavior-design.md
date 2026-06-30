# 日历视图点击行为配置 — 设计规格

## 概述

在月视图和周视图中，单击日期格子会无条件进入日视图，用户在进行长期任务规划时容易误触。本设计新增两个独立配置项，允许用户选择"单击"或"双击"进入下级视图，双击模式下单击仅做视觉选中高亮。

## 背景

- FullCalendar 的 `dateClick` 回调在月视图/周视图中无条件切换到 `timeGridDay`
- `navLinkWeekClick` 回调在月视图中无条件切换到 `timeGridWeek`
- 两者均构建 drill-down 返回栈，支持逐级返回

## 需求

| # | 需求 | 优先级 |
|---|------|--------|
| 1 | 日期格子点击行为可配置（单击/双击） | P0 |
| 2 | 周数列点击行为可配置（单击/双击），独立于日期格子设置 | P0 |
| 3 | 双击模式下，单击仅做视觉选中高亮（FullCalendar `.fc-highlight`） | P0 |
| 4 | 作用范围仅限月视图（`dayGridMonth`）和周视图（`timeGridWeek`），日视图/列表视图不受影响 | P1 |
| 5 | 默认值为 `'click'`，保持向后兼容 | P0 |
| 6 | 移动端强制使用单击模式，忽略用户设置（移动端 dblclick 不可靠） | P1 |

## 方案选型

采用 **方案 A：FullCalendar dateClick + 原生 dblclick**。

- 保留 FullCalendar `dateClick` 处理单击逻辑
- 在"双击模式"下将 `dateClick` 降级为仅选中高亮
- 在容器上监听原生 `dblclick` 事件执行视图切换
- `navLinkWeekClick` 同理改造

选型理由：改动最小，复用 FullCalendar 原生事件系统，不破坏现有拖拽和事件点击行为。

## 数据模型

### SettingsData 新增字段

```typescript
// src/settings/types.ts
calendarDateClickBehavior: 'click' | 'dblclick'  // 默认 'click'
calendarWeekClickBehavior: 'click' | 'dblclick'   // 默认 'click'
```

### defaultSettings

```typescript
calendarDateClickBehavior: 'click',
calendarWeekClickBehavior: 'click',
```

## 组件改动

### CalendarView.vue

#### Props 新增

```typescript
dateClickBehavior?: 'click' | 'dblclick'  // 默认 'click'
weekClickBehavior?: 'click' | 'dblclick'   // 默认 'click'
```

#### FullCalendar 配置新增

```typescript
selectable: true,
unselectAuto: true,
```

#### dateClick 回调改造

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
}
```

#### navLinkWeekClick 回调改造

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
}
```

#### 新增原生 dblclick 监听

在 `onMounted` 中对 FullCalendar 容器添加 `dblclick` 事件监听，`onUnmounted` 中移除：

```typescript
const handleDblClick = (e: MouseEvent) => {
  if (!calendarInstance) return
  if (plugin?.isMobile) return  // 移动端忽略

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

### CalendarTab.vue

- 向 CalendarView 传递新 props：`:date-click-behavior` 和 `:week-click-behavior`
- `handleDataRefresh` 的 `storeKeys` 数组增加 `calendarDateClickBehavior` 和 `calendarWeekClickBehavior`

### settingsStore.ts

- state 新增两个字段
- `loadFromPlugin()` 读取两个字段
- `saveToPlugin()` 保存两个字段

### CalendarConfigSection.vue

新增两个 SySelect 设置项，选项为"单击"和"双击"。桌面端使用 `SySettingItem` + `SySelect`，iOS 移动端使用 `ios-cell-select` 样式。

### SettingsDialog.vue

- `CalendarConfigSection` 组件绑定新增两个 v-model
- 保存时透传到 settingsStore

## i18n

### zh_CN.json

```json
"calendar": {
  "dateClickBehavior": "日期点击进入方式",
  "dateClickBehaviorDesc": "在月视图或周视图中，点击日期格子进入日视图的方式",
  "weekClickBehavior": "周数列点击进入方式",
  "weekClickBehaviorDesc": "在月视图中，点击左侧周数列进入周视图的方式",
  "clickBehaviorSingle": "单击",
  "clickBehaviorDouble": "双击"
}
```

### en_US.json

```json
"calendar": {
  "dateClickBehavior": "Date click to enter day view",
  "dateClickBehaviorDesc": "How to enter day view by clicking a date cell in month or week view",
  "weekClickBehavior": "Week number click to enter week view",
  "weekClickBehaviorDesc": "How to enter week view by clicking the week number in month view",
  "clickBehaviorSingle": "Single click",
  "clickBehaviorDouble": "Double click"
}
```

## 边界情况

1. **事件条上的双击**：`closest('[data-date]')` 返回 null，不触发视图切换
2. **日视图/列表视图下双击**：viewType 判断限定为 `dayGridMonth` 和 `timeGridWeek`，其他视图下双击无响应
3. **设置切换即时生效**：CalendarView 的 `dateClick` 回调通过响应式 `props` 读取最新值，无需重新初始化 FullCalendar
4. **select 与拖拽不冲突**：`selectable: true` 不影响 `eventDrop` / `eventResize`
5. **移动端**：`handleDblClick` 中检测移动端，强制走单击路径

## 影响范围

| 文件 | 改动类型 |
|------|----------|
| `src/settings/types.ts` | 新增 2 个字段 + 默认值 |
| `src/stores/settingsStore.ts` | 新增 state / load / save |
| `src/components/calendar/CalendarView.vue` | Props 新增 + dateClick / navLinkWeekClick 改造 + dblclick 监听 |
| `src/tabs/CalendarTab.vue` | 传递新 props + storeKeys 扩展 |
| `src/components/settings/CalendarConfigSection.vue` | 新增 2 个设置项 |
| `src/components/settings/SettingsDialog.vue` | 绑定新字段 |
| `src/i18n/zh_CN.json` | 新增翻译 |
| `src/i18n/en_US.json` | 新增翻译 |
