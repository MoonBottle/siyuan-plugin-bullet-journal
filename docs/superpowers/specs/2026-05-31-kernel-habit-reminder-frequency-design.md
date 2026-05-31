# Kernel 层习惯提醒频率计算 + Webhook 推送修复

## 问题描述

### 现象

1. 事项提醒（`reminder` 类型）的 Webhook 推送正常
2. 番茄钟完成（`pomodoro`）、休息结束（`break`）、习惯提醒（`habit`）的 Webhook 推送均不触发
3. 习惯提醒在 Kernel 层只在 `startDate` 当天触发一次，之后永远不再触发

### 根因分析

**根因 1：Webhook Channel 默认事件配置不完整**

新建 Webhook Channel 时，`events` 默认为 `['reminder']`（仅订阅事项提醒）。`pomodoro`、`break`、`habit` 三种事件类型未被订阅，导致 `dispatchNotification` 中的 `channel.events.includes(entry.type)` 过滤掉了这些类型。

**根因 2：Kernel 层习惯提醒调度缺少频率信息**

Kernel 层的 `rebuildReminderSchedule` 从 `kernel-data.json` 读取习惯数据，使用 `targetDate`（等于 `startDate`，如 `2026-04-01`）计算提醒时间。这导致：
- 提醒时间固定为 `startDate + reminder.time`（如 `2026-04-01T09:00:00`）
- 到了第二天，这个时间已经过期，被 `if (habitReminderTime < now - 5*60*1000) continue` 跳过
- Kernel 层完全没有频率信息（`KernelDataHabit` 类型中没有 `frequency` 字段）
- 前端的频率判断逻辑（`isDateEligibleForHabit`）无法传递到 Kernel 层

**根因 3：前端在 Kernel 可用时完全放弃调度**

`reminderService.ts` 的 `rebuildSchedule` 在 `kernelAvailable.value === true` 时直接 `return`，不调度任何 cron job。但 Kernel 层又缺少频率信息，导致习惯提醒在 Kernel 模式下完全失效。

## 设计方案

### 方案选择：Kernel 层引入频率计算（方案 B）

Kernel 层自包含频率判断逻辑，不依赖前端运行状态。选择理由：
- 与现有 `reminder` 类型的模式一致（Kernel 从 kernel-data.json 读取后独立调度）
- 可靠性最高，即使前端未运行也能正确调度
- 避免前端/Kernel 之间的竞态条件

### 改动范围

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `src/kernel/types.ts` | 修改 | 扩展 `KernelDataHabit` 类型 |
| `src/kernel/habitSchedule.ts` | **新建** | 简化版频率判断函数（纯日期计算） |
| `src/kernel/reminder.ts` | 修改 | habit 调度逻辑使用频率检查 |
| `src/mcp/kernelDataWriter.ts` | 修改 | 传递频率信息到 kernel-data.json |
| `src/components/settings/WebhookConfigSection.vue` | 修改 | 默认事件改为全部四种类型 |

---

## 详细设计

### 1. 扩展 KernelDataHabit 类型

**文件**：`src/kernel/types.ts`

在现有 `KernelDataHabit` 接口中增加频率相关字段：

```typescript
interface KernelDataHabit {
  // 现有字段（保持不变）
  id: string
  name: string
  type: string
  target?: number
  unit?: string
  reminder?: ReminderConfig
  targetDate: string
  blockId: string

  // 新增字段
  startDate: string
  frequency: {
    type: string               // 'daily' | 'every_n_days' | 'weekly' | 'n_per_week' | 'weekly_days' | 'ebbinghaus'
    interval?: number          // every_n_days: 每 N 天
    daysOfWeek?: number[]      // weekly_days: 指定周几 [0=周日, 1=周一, ...]
    intervals?: number[]       // ebbinghaus: 间隔模板 [1, 2, 4, 7, 15]
    completedDates?: string[]  // ebbinghaus: 已完成的打卡日期（已排序，去重）
  }
  todayCompleted?: boolean     // 今天是否已完成打卡
  todayCount?: number          // 今天的当前打卡值（计数型）
  durationDays?: number
  archivedAt?: string
}
```

**设计决策**：
- `targetDate` 保留作为向后兼容字段，但 Kernel 层不再使用它计算提醒时间
- `frequency` 对象包含所有频率类型的必要字段
- `ebbinghaus` 类型的 `completedDates` 由前端在写入 kernel-data.json 时提供（已排序、已去重、仅包含非 missed 的记录）
- `daily`、`weekly`、`n_per_week` 三种类型在 Kernel 层判断时始终返回 true（与前端 `isDateEligibleForHabit` 一致）
- `todayCompleted` 由前端在写入 kernel-data.json 时计算，Kernel 层据此决定是否跳过提醒

### 2. 新建 habitSchedule.ts

**文件**：`src/kernel/habitSchedule.ts`（新建）

实现简化版的频率判断函数，**不依赖 dayjs**，使用原生 Date API。

#### 核心函数

```typescript
export function isDateEligibleForHabit(habit: KernelDataHabit, dateStr: string): boolean
```

#### 内部辅助函数

```typescript
function parseLocalDate(dateStr: string): Date
function daysBetween(dateA: string, dateB: string): number
```

#### 频率判断逻辑

| 频率类型 | 判断逻辑 | 与前端对齐的代码位置 |
|---------|---------|-------------------|
| `daily` | 始终返回 true | `habitPeriod.ts:129-130` |
| `weekly` | 始终返回 true | `habitPeriod.ts:130` |
| `n_per_week` | 始终返回 true | `habitPeriod.ts:131` |
| `every_n_days` | `daysBetween(startDate, date) % interval === 0` | `habitPeriod.ts:133-135` |
| `weekly_days` | `daysOfWeek.includes(date.getDay())` | `habitPeriod.ts:137-138` |
| `ebbinghaus` | 基于 completedDates 计算下一个到期日，判断 `date >= nextDueDate` | `habitPeriod.ts:88-99` |

#### 向后兼容

当 `habit.frequency` 为 `undefined`（旧格式 kernel-data.json）时，`isDateEligibleForHabit` 默认视为 `daily` 频率，始终返回 true（前提是日期在有效期内）。这确保了升级过渡期间旧数据不会导致习惯提醒丢失。

#### 日期有效性检查（所有频率类型共用）

在频率类型判断之前，先检查：
1. `date < startDate` → false（习惯尚未开始）
2. `durationDays` 存在且 `date > startDate + durationDays - 1` → false（习惯已过期）
3. `archivedAt` 存在且 `date > archivedAt` → false（习惯已归档）

#### Ebbinghaus 判断逻辑

与前端 `buildEbbinghausScheduleState`（`habitPeriod.ts:49-82`）对齐：

1. 从 `completedDates` 中筛选 `date < currentDate` 的日期（排除当天）
2. 如果无完成日期 → `date >= startDate` 即为 eligible
3. 如果有完成日期 → 取最后一个完成日期 + 当前阶段间隔天数 = 下一个到期日
4. `date >= nextDueDate` 即为 eligible

阶段计算：`stageIndex = min(completedCount - 1, intervals.length - 1)`

### 3. 修改 reminder.ts 的 habit 调度逻辑

**文件**：`src/kernel/reminder.ts`

#### 当前代码（L77-L103）

```typescript
if (data.habits) {
  for (let j = 0; j < data.habits.length; j++) {
    const habit = data.habits[j]
    if (!habit.reminder || !habit.reminder.enabled) continue
    const habitReminderTime = calculateReminderTime(
      habit.targetDate,    // ← 使用 startDate，不检查频率
      undefined, undefined, undefined, undefined,
      habit.reminder,
    )
    if (habitReminderTime < now - 5 * 60 * 1000) continue
    if (habitReminderTime > now + futureWindowMs) continue
    entries.push({ ... })
  }
}
```

#### 改后代码

```typescript
if (data.habits) {
  const today = formatDate(new Date())
  for (let j = 0; j < data.habits.length; j++) {
    const habit = data.habits[j]
    if (!habit.reminder || !habit.reminder.enabled) continue
    if (!isDateEligibleForHabit(habit, today)) continue
    if (habit.todayCompleted) continue              // ← 新增：今天已完成则跳过
    const habitReminderTime = calculateReminderTime(
      today,               // ← 使用今天，不是 startDate
      undefined, undefined, undefined, undefined,
      habit.reminder,
    )
    if (habitReminderTime < now - 5 * 60 * 1000) continue
    if (habitReminderTime > now + futureWindowMs) continue
    entries.push({
      id: `habit-${habit.blockId}-${today}-${habitReminderTime}`,
      type: 'habit',
      endTime: Math.floor(habitReminderTime / 1000),
      metadata: {
        blockId: habit.blockId,
        content: habit.name,
        target: habit.target,
        unit: habit.unit,
      },
      notified: false,
    })
  }
}
```

**关键变化**：
- 增加 `isDateEligibleForHabit(habit, today)` 检查（频率判断）
- 增加 `habit.todayCompleted` 检查（打卡完成判断）——如果用户在提醒时间之前已完成打卡，则不注册提醒
- `calculateReminderTime` 的第一个参数从 `habit.targetDate` 改为 `today`
- timer ID 中的日期部分从 `habit.targetDate` 改为 `today`，确保每天生成不同的 ID

**todayCompleted 的更新时机**：前端打卡后会更新 habit records → 触发 `writeKernelData` → kernel-data.json 写入 `todayCompleted: true` → kernel 的 fs-notify 触发 `rebuildReminderSchedule()` → 读取到 `todayCompleted: true` → 不再注册提醒。这个链路确保了打卡后提醒及时取消。

### 4. 修改 kernelDataWriter.ts

**文件**：`src/mcp/kernelDataWriter.ts`

#### 当前 habits 映射（L134-L143）

```typescript
habits: habits.map((h) => ({
  id: h.blockId,
  name: h.name,
  type: h.type,
  target: h.target,
  unit: h.unit,
  reminder: h.reminder,
  targetDate: h.startDate,
  blockId: h.blockId,
})),
```

#### 改后 habits 映射

```typescript
habits: habits.map((h) => ({
  id: h.blockId,
  name: h.name,
  type: h.type,
  target: h.target,
  unit: h.unit,
  reminder: h.reminder,
  targetDate: h.startDate,
  blockId: h.blockId,
  startDate: h.startDate,
  frequency: {
    type: h.frequency?.type ?? 'daily',
    interval: h.frequency?.interval,
    daysOfWeek: h.frequency?.daysOfWeek,
    intervals: h.frequency?.type === 'ebbinghaus' ? h.frequency?.intervals : undefined,
    completedDates: h.frequency?.type === 'ebbinghaus'
      ? [...new Set(
          h.records
            .filter(r => r.status !== 'missed')
            .map(r => r.date)
        )].sort()
      : undefined,
  },
  todayCompleted: computeTodayCompleted(h),
  todayCount: computeTodayCount(h),
  durationDays: h.durationDays,
  archivedAt: h.archivedAt,
})),
```

**辅助函数**（在 kernelDataWriter.ts 中新增）：

```typescript
function computeTodayCompleted(habit: Habit): boolean {
  const today = new Date().toISOString().slice(0, 10)
  const todayRecords = habit.records.filter(r => r.date === today && r.status !== 'missed')
  if (todayRecords.length === 0) return false
  if (habit.type === 'binary') return true
  const currentValue = todayRecords.reduce((sum, r) => sum + (r.currentValue ?? 1), 0)
  return currentValue >= (habit.target ?? 1)
}

function computeTodayCount(habit: Habit): number {
  const today = new Date().toISOString().slice(0, 10)
  return habit.records
    .filter(r => r.date === today && r.status !== 'missed')
    .reduce((sum, r) => sum + (r.currentValue ?? 1), 0)
}
```

**设计决策**：
- `completedDates` 仅在 `ebbinghaus` 类型时生成，其他类型不传递（减少数据量）
- 使用 `[...new Set()]` 去重，`.sort()` 排序
- 仅包含 `status !== 'missed'` 的记录（与前端 `getCompletedEbbinghausDates` 一致）
- `todayCompleted` 由前端实时计算，Kernel 层据此决定是否跳过提醒
- `todayCount` 为计数型习惯提供当前值（可用于未来扩展提醒内容）

### 5. 修改 Webhook Channel 默认事件

**文件**：`src/components/settings/WebhookConfigSection.vue`

#### 当前代码（L168-L177）

```typescript
function createEmptyChannel(): WebhookChannel {
  return {
    id: `ch-${Date.now()}`,
    name: '',
    type: 'dingtalk',
    url: '',
    enabled: true,
    events: ['reminder'],
  }
}
```

#### 改后代码

```typescript
function createEmptyChannel(): WebhookChannel {
  return {
    id: `ch-${Date.now()}`,
    name: '',
    type: 'dingtalk',
    url: '',
    enabled: true,
    events: ['reminder', 'pomodoro', 'break', 'habit'],
  }
}
```

**注意**：此改动仅影响新建的 channel。已有 channel 的 events 配置不会被修改。

---

## 零点刷新机制

现有的零点刷新链路无需改动：

```
scheduler.ts checkTimers() 检测日期变更 (L216-221)
  → siyuan.rpc.broadcast('date-changed', { date: today })
  → rebuildReminderSchedule()  ← 调用方自动触发
```

改动后的 `rebuildReminderSchedule` 在每次午夜调用时：
1. 读取最新的 `kernel-data.json`（含频率信息）
2. 取今天日期 `formatDate(new Date())`
3. 对每个 habit 调用 `isDateEligibleForHabit(habit, today)`
4. 仅注册 eligible 的习惯提醒，使用今天的日期计算提醒时间

## 数据流（改后）

```
前端解析笔记 → Habit 对象（含 frequency + records）
  → writeKernelData() 映射完整频率信息
  → kernel-data.json（含 startDate, frequency, completedDates）
  → Kernel rebuildReminderSchedule()
    → isDateEligibleForHabit(habit, today) ← 新增频率检查
    → calculateReminderTime(today, ...) ← 使用今天日期
    → registerTimers(entries)
  → scheduler checkTimers() 每秒检测
    → 午夜日期变更 → rebuildReminderSchedule() → 重新计算
    → timer 到期 → dispatchNotification()
      → webhook channel.events.includes('habit') ← 默认已包含
      → sendWebhook()
```

## 测试要点

1. **频率判断**：验证所有 6 种频率类型在 Kernel 层的判断结果与前端 `isDateEligibleForHabit` 一致
2. **打卡完成跳过**：验证 `todayCompleted: true` 时 Kernel 层不注册提醒
3. **打卡后提醒取消**：验证用户打卡后，kernel-data.json 更新触发 `rebuildReminderSchedule`，已注册的提醒被移除
4. **计数型部分完成**：验证 `todayCount < target` 时提醒仍注册（未达标）
5. **零点刷新**：验证午夜后习惯提醒能正确重新调度（`todayCompleted` 重置为 false）
6. **Ebbinghaus**：验证基于 completedDates 的到期日计算正确
7. **已过期习惯**：验证 `durationDays` 到期后不再注册提醒
8. **已归档习惯**：验证 `archivedAt` 存在时不再注册提醒
9. **Webhook 推送**：验证新建 channel 默认包含全部四种事件类型
10. **向后兼容**：验证不含 `frequency` 字段的旧格式 kernel-data.json 不会报错（fallback 为 daily）
