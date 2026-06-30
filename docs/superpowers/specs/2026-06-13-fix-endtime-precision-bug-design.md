# 修复：循环任务跳过/迁移时结束时间和时间精度异常

## 问题描述

当循环任务只有开始时间没有结束时间时（如 `📅2026-06-12 17:00`），执行"跳过本次"或"迁移到今天"操作后：

- **跳过本次**：`📅2026-06-12 17:00` → `📅2026-06-15 17:00~18:00`（多出了结束时间）
- **迁移到今天**：`📅2026-06-12 17:00` → `📅2026-06-13 17:00:00~18:00:00`（多出结束时间且精度丢失）

预期行为：
- **跳过本次**：`📅2026-06-12 17:00` → `📅2026-06-15 17:00`
- **迁移到今天**：`📅2026-06-12 17:00` → `📅2026-06-13 17:00`

## 根因分析

### Bug 1（主因）：`addOneHour` 自动推算结束时间

**文件**：`src/utils/blockWriter/render/datePatchRender.ts` 第 352-354 行

```typescript
const formattedEndTime = patch.endTime
  ? formatTimeToSeconds(patch.endTime)
  : (formattedStartTime ? addOneHour(formattedStartTime) : undefined)
```

当 `DatePatch.endTime` 为 `undefined`（用户只设了开始时间）但 `startTime` 存在时，代码自动调用 `addOneHour` 生成结束时间（开始时间 +1 小时）。这个 `formattedEndTime` 通过 `buildUpdatedDateItems` → `buildTimeKey` 最终写入文档，产生 `17:00~18:00` 的时间范围标记。

**影响范围**：所有通过 `writeBlock` + `addDate` patch 的路径，包括 skipOccurrence、migrate、日历拖拽等。

### Bug 2：`buildDatePatch` 未传递 `timePrecision`

**文件**：`src/utils/itemActions.ts` 第 6-27 行

`buildDatePatch` 函数没有传递 `timePrecision`，导致 `applyDate` 中 `inferTimePrecision("17:00:00")` 从 8 字符长度推断为 `'second'`，输出 `17:00:00` 而非原始的 `17:00`。

### Bug 3（关联）：日历拖拽移动时写入 FullCalendar 自动生成的结束时间

**文件**：`src/utils/calendarEventChange.ts` 第 63-66 行

当 `action === 'move'` 且原始 `endDateTime` 为空时，FullCalendar 自动生成的 `end`（start+1h）被当作真实结束时间写回文档。

## 修复方案

### 修复 1：移除 `addOneHour` 自动推算

**文件**：`src/utils/blockWriter/render/datePatchRender.ts`

将第 352-354 行：
```typescript
const formattedEndTime = patch.endTime
  ? formatTimeToSeconds(patch.endTime)
  : (formattedStartTime ? addOneHour(formattedStartTime) : undefined)
```

改为：
```typescript
const formattedEndTime = patch.endTime
  ? formatTimeToSeconds(patch.endTime)
  : undefined
```

**日历展示不受影响**：`dataConverter.ts` 第 170 行已正确处理 `endDateTime` 为空的情况——传给 FullCalendar 的 `end` 为 `undefined`，FullCalendar 使用 `defaultTimedEventDuration`（1 小时）自动展示事件卡片。

### 修复 2：`buildDatePatch` 传递 `timePrecision`

**文件**：`src/utils/itemActions.ts`

在 `buildDatePatch` 返回的 patch 中加入 `timePrecision: item.timePrecision`。

### 修复 3：日历移动操作不写入自动生成的结束时间

**文件**：`src/utils/calendarEventChange.ts`

当 `action === 'move'` 且 `originalEndDateTime` 为空时，不写入 `newEndTime`（即 `endTime: undefined`）。当 `action === 'resize'` 时，用户明确在设置结束时间，应正常写入。

## 修改文件清单

| 文件 | 修改内容 |
|------|---------|
| `src/utils/blockWriter/render/datePatchRender.ts` | 移除 `addOneHour` 调用，`endTime` 为空时保持 `undefined` |
| `src/utils/itemActions.ts` | `buildDatePatch` 增加 `timePrecision: item.timePrecision` |
| `src/utils/calendarEventChange.ts` | move 操作且原始无 endDateTime 时，不写入 newEndTime |

## 验证要点

1. 循环任务 `📅2026-06-12 17:00` 跳过本次后应为 `📅2026-06-15 17:00`（无结束时间，精度保持分钟）
2. 循环任务 `📅2026-06-12 17:00` 迁移到今天后应为 `📅2026-06-13 17:00`（无结束时间，精度保持分钟）
3. 日历视图中只有开始时间的事项卡片仍能正常显示（FullCalendar defaultTimedEventDuration）
4. 日历拖拽移动只改开始时间，不自动添加结束时间
5. 日历拖拽调整大小（resize）能正常设置结束时间
6. 已有结束时间的事项（如 `📅2026-06-12 09:00~10:00`）不受影响
