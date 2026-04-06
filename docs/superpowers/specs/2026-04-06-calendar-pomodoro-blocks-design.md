# 日历日视图番茄钟时间块设计

## 背景

日历日视图（timeGridDay）只能看到事项的时间安排（如"开会 9:00-10:00"），但看不出用户实际专注了多久。用户希望直观了解每个事项的实际专注时间分布。

来源：用户需求

## 核心效果

在日历日视图的时间轴上，根据番茄钟记录的 `startTime`~`endTime` 绘制半透明番茄红色背景色块，色块高度对应专注时长，内部显示时长文字（如 `25min`）。事项条右侧显示该事项的专注总时长（如 `共专注75min`）。

```
时间轴
09:00 ┌─────────────────────────────┐
      │ 开会：需求评审     共专注75min│  ← 事项条右侧显示总时长
      │ ┌────┐  ┌────┐  ┌────┐      │
      │ │🍅  │  │🍅  │  │🍅  │      │  ← 三个背景色块，按实际时间纵向排列
      │ │25m │  │25m │  │25m │      │
10:00 │ └────┘  └────┘  └────┘      │
```

- 番茄钟色块按 `startTime~endTime` 纵向定位在时间轴上
- 事项条右侧追加显示专注总时长
- 色块是背景层，事项条是前景层，互不干扰

## 实现方案：FullCalendar Background Events + 事项条增强

### 1. 番茄钟背景事件

利用 FullCalendar 的 background event 功能，将每个有 `startTime` 和 `endTime` 的 `PomodoroRecord` 转为只读背景事件：

```ts
{
  id: `pomodoro-${record.id}`,
  start: `${record.date}T${record.startTime}`,
  end: `${record.date}T${record.endTime}`,
  display: 'background',
  backgroundColor: 'rgba(231, 76, 60, 0.15)',
  extendedProps: {
    isPomodoroBlock: true,
    durationMinutes: record.actualDurationMinutes ?? record.durationMinutes,
    description: record.description,
  }
}
```

- 不可交互（background events 不响应拖拽/点击）
- 只为有 `startTime` 且有 `endTime` 的记录生成（无时间的不显示）
- 只显示日历当前可见日期范围内的记录

### 2. 事项条右侧总时长

修改日历事件的渲染函数 `renderEventContent`，对有番茄钟记录的事项，在事项条右侧显示专注总时长文字：

- 计算 `pomodoros` 数组的总专注时长（`actualDurationMinutes ?? durationMinutes` 之和）
- 格式化为 `共专注75min` 或 `共1h15min`
- 只在有番茄钟记录时显示

### 3. 色块内时长文字

由于 FullCalendar 的 background events 默认不渲染内容文字，需要通过 CSS `::after` 伪元素或自定义 `eventDidMount` 回调注入时长文字：

- 在 `eventDidMount` 钩子中检测 `isPomodoroBlock`
- 注入 `<span class="pomodoro-block-label">25min</span>`
- 样式：小字号、番茄红色文字、居中

## 配置

在设置中增加日历相关配置项：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `showPomodoroBlocks` | `boolean` | `true` | 日历日视图是否显示番茄钟时间块 |
| `showPomodoroTotal` | `boolean` | `true` | 事项条是否显示专注总时长 |

放在日历设置区域（CalendarConfigSection 或相关位置）。两个开关独立控制，方便用户按需显示。

## 边界情况

- **无 startTime/endTime 的番茄钟：** 不生成背景事件（无法定位到时间轴）
- **跨时区的 startTime/endTime：** 使用 dayjs 本地格式化，与日历保持一致
- **番茄钟时间与事项时间不重叠：** 色块独立显示在时间轴上（如午休后单独做了一次番茄钟）
- **周视图/月视图/列表视图：** 番茄钟背景事件在这些视图中不显示（通过 FullCalendar 的 `eventConstraint` 或在生成时限制只对日视图生效）
- **事项条宽度不够显示总时长：** 总时长文字缩小字号或溢出隐藏
- **多个番茄钟时间重叠：** FullCalendar 会自动并排显示 background events

## 影响范围

| 文件 | 改动 |
|------|------|
| `src/utils/dataConverter.ts` | 新增番茄钟 → background event 转换函数 |
| `src/components/calendar/CalendarView.vue` | `eventDidMount` 注入时长文字；`renderEventContent` 显示总时长 |
| `src/settings/types.ts` | 新增 `showPomodoroBlocks` 和 `showPomodoroTotal` 配置字段 |
| `src/components/settings/` 相关 | 设置 UI 开关 |
| `src/i18n/zh_CN.json` + `en_US.json` | 翻译 key |
| `src/index.scss` 或组件样式 | 番茄钟色块和时长文字样式 |
