# Kernel 层习惯提醒频率计算 + Webhook 推送修复 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让 Kernel 层能够独立判断今天是否为习惯打卡日，并在打卡完成后跳过提醒，同时修复 Webhook Channel 默认事件配置。

**架构：** 在 Kernel 层新增 `habitSchedule.ts`，实现纯日期计算的频率判断和打卡完成判断函数。扩展 `KernelDataHabit` 类型传递频率信息和完整打卡记录。修改 `reminder.ts` 的 habit 调度逻辑使用新函数。

**技术栈：** TypeScript（纯日期计算，不依赖 dayjs） | Vitest

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `src/kernel/types.ts` | 扩展 `KernelDataHabit` 类型，增加 `startDate`、`frequency`、`records`、`durationDays`、`archivedAt` 字段 |
| `src/kernel/habitSchedule.ts` | **新建** — 纯函数：`isDateEligibleForHabit`、`isTodayCompleted`，不依赖任何外部库 |
| `src/kernel/reminder.ts` | 修改 habit 调度逻辑，使用新函数 |
| `src/mcp/kernelDataWriter.ts` | 传递完整频率信息和打卡记录到 kernel-data.json |
| `src/components/settings/WebhookConfigSection.vue` | 默认事件改为全部四种类型 |
| `test/kernel/habitSchedule.test.ts` | **新建** — habitSchedule 的单元测试 |

---

### 任务 1：扩展 KernelDataHabit 类型

**文件：**
- 修改：`src/kernel/types.ts:190-199`

- [ ] **步骤 1：修改 KernelDataHabit 接口**

在 `src/kernel/types.ts` 中，将现有 `KernelDataHabit` 接口从：

```typescript
interface KernelDataHabit {
  id: string
  name: string
  type: string
  target?: number
  unit?: string
  reminder?: ReminderConfig
  targetDate: string
  blockId: string
}
```

改为：

```typescript
interface KernelDataHabit {
  id: string
  name: string
  type: string
  target?: number
  unit?: string
  reminder?: ReminderConfig
  targetDate: string
  blockId: string
  startDate: string
  frequency?: {
    type: string
    interval?: number
    daysOfWeek?: number[]
    intervals?: number[]
  }
  records: Array<{
    date: string
    currentValue?: number
    status?: string
  }>
  durationDays?: number
  archivedAt?: string
}
```

注意：`frequency` 和 `records` 设为可选（`?`），以支持旧格式 kernel-data.json 的向后兼容。`records` 在接口中标记为可选但在运行时应始终存在。

- [ ] **步骤 2：Commit**

```bash
git add src/kernel/types.ts
git commit -m "feat(kernel): 扩展 KernelDataHabit 类型，增加频率和打卡记录字段"
```

---

### 任务 2：创建 habitSchedule.ts 及其测试

**文件：**
- 创建：`src/kernel/habitSchedule.ts`
- 创建：`test/kernel/habitSchedule.test.ts`

- [ ] **步骤 1：编写 isDateEligibleForHabit 的测试（daily 频率）**

创建 `test/kernel/habitSchedule.test.ts`：

```typescript
import type { KernelDataHabit } from '@/kernel/types'
import { describe, expect, it } from 'vitest'
import { isDateEligibleForHabit, isTodayCompleted } from '@/kernel/habitSchedule'

function makeHabit(overrides: Partial<KernelDataHabit> = {}): KernelDataHabit {
  return {
    id: 'h1',
    name: '喝水',
    type: 'binary',
    targetDate: '2026-05-01',
    blockId: 'block-h1',
    startDate: '2026-05-01',
    frequency: { type: 'daily' },
    records: [],
    ...overrides,
  }
}

describe('isDateEligibleForHabit', () => {
  it('daily: 始终返回 true（在有效期内）', () => {
    const habit = makeHabit({ startDate: '2026-05-01' })
    expect(isDateEligibleForHabit(habit, '2026-05-15')).toBe(true)
  })

  it('daily: 早于 startDate 返回 false', () => {
    const habit = makeHabit({ startDate: '2026-05-10' })
    expect(isDateEligibleForHabit(habit, '2026-05-01')).toBe(false)
  })

  it('daily: 超过 durationDays 返回 false', () => {
    const habit = makeHabit({ startDate: '2026-05-01', durationDays: 7 })
    expect(isDateEligibleForHabit(habit, '2026-05-08')).toBe(false)
  })

  it('daily: 最后一天仍返回 true', () => {
    const habit = makeHabit({ startDate: '2026-05-01', durationDays: 7 })
    expect(isDateEligibleForHabit(habit, '2026-05-07')).toBe(true)
  })

  it('已归档习惯返回 false', () => {
    const habit = makeHabit({ archivedAt: '2026-05-10' })
    expect(isDateEligibleForHabit(habit, '2026-05-15')).toBe(false)
  })

  it('归档日期当天仍返回 true', () => {
    const habit = makeHabit({ archivedAt: '2026-05-10' })
    expect(isDateEligibleForHabit(habit, '2026-05-10')).toBe(true)
  })

  it('无 frequency 时默认视为 daily', () => {
    const habit = makeHabit({ frequency: undefined })
    expect(isDateEligibleForHabit(habit, '2026-05-15')).toBe(true)
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/kernel/habitSchedule.test.ts`
预期：FAIL，报错模块未找到

- [ ] **步骤 3：实现 habitSchedule.ts（基础结构 + daily + 日期有效性）**

创建 `src/kernel/habitSchedule.ts`：

```typescript
import type { KernelDataHabit } from './types'

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function daysBetween(dateA: string, dateB: string): number {
  const a = parseLocalDate(dateA)
  const b = parseLocalDate(dateB)
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((b.getTime() - a.getTime()) / msPerDay)
}

function isDateInValidRange(habit: KernelDataHabit, dateStr: string): boolean {
  if (dateStr < habit.startDate) return false
  if (habit.archivedAt && dateStr > habit.archivedAt) return false
  if (habit.durationDays !== undefined) {
    const endDate = addDays(habit.startDate, habit.durationDays - 1)
    if (dateStr > endDate) return false
  }
  return true
}

function addDays(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr)
  d.setDate(d.getDate() + days)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isDateEligibleForHabit(habit: KernelDataHabit, dateStr: string): boolean {
  if (!isDateInValidRange(habit, dateStr)) return false

  const frequency = habit.frequency
  if (!frequency) return true

  switch (frequency.type) {
    case 'daily':
    case 'weekly':
    case 'n_per_week':
      return true
    case 'every_n_days': {
      const interval = frequency.interval ?? 2
      return daysBetween(habit.startDate, dateStr) % interval === 0
    }
    case 'weekly_days': {
      const d = parseLocalDate(dateStr)
      return (frequency.daysOfWeek ?? []).includes(d.getDay())
    }
    case 'ebbinghaus':
      return isEbbinghausDueOnDate(habit, dateStr)
    default:
      return true
  }
}

function getCompletedDates(habit: KernelDataHabit): string[] {
  return [...new Set(
    (habit.records ?? [])
      .filter(r => r.status !== 'missed')
      .map(r => r.date),
  )].sort()
}

function isEbbinghausDueOnDate(habit: KernelDataHabit, dateStr: string): boolean {
  const intervals = habit.frequency?.intervals ?? [1, 2, 4, 7, 15]
  const completedDates = getCompletedDates(habit)
  const priorCompleted = completedDates.filter(d => d < dateStr)

  if (priorCompleted.length === 0) {
    return dateStr >= habit.startDate
  }

  const stageIndex = Math.min(priorCompleted.length - 1, intervals.length - 1)
  const intervalDays = intervals[stageIndex]
  const lastCompleted = priorCompleted.at(-1)!
  const nextDueDate = addDays(lastCompleted, intervalDays)

  return dateStr >= nextDueDate
}

export function isTodayCompleted(habit: KernelDataHabit, today: string): boolean {
  const todayRecords = (habit.records ?? []).filter(
    r => r.date === today && r.status !== 'missed',
  )
  if (todayRecords.length === 0) return false

  if (habit.type === 'binary') return true

  const currentValue = todayRecords.reduce(
    (sum, r) => sum + (r.currentValue ?? 1), 0,
  )
  return currentValue >= (habit.target ?? 1)
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/kernel/habitSchedule.test.ts`
预期：PASS

- [ ] **步骤 5：补充 every_n_days 频率测试**

在 `test/kernel/habitSchedule.test.ts` 中追加：

```typescript
describe('isDateEligibleForHabit - every_n_days', () => {
  it('每2天：startDate 当天返回 true', () => {
    const habit = makeHabit({
      startDate: '2026-05-01',
      frequency: { type: 'every_n_days', interval: 2 },
    })
    expect(isDateEligibleForHabit(habit, '2026-05-01')).toBe(true)
  })

  it('每2天：间隔日返回 true', () => {
    const habit = makeHabit({
      startDate: '2026-05-01',
      frequency: { type: 'every_n_days', interval: 2 },
    })
    expect(isDateEligibleForHabit(habit, '2026-05-03')).toBe(true)
  })

  it('每2天：非间隔日返回 false', () => {
    const habit = makeHabit({
      startDate: '2026-05-01',
      frequency: { type: 'every_n_days', interval: 2 },
    })
    expect(isDateEligibleForHabit(habit, '2026-05-02')).toBe(false)
  })
})
```

- [ ] **步骤 6：运行测试验证通过**

运行：`npx vitest run test/kernel/habitSchedule.test.ts`
预期：PASS

- [ ] **步骤 7：补充 weekly_days 频率测试**

在 `test/kernel/habitSchedule.test.ts` 中追加：

```typescript
describe('isDateEligibleForHabit - weekly_days', () => {
  it('每周一三五：周一返回 true', () => {
    const habit = makeHabit({
      startDate: '2026-05-01',
      frequency: { type: 'weekly_days', daysOfWeek: [1, 3, 5] },
    })
    expect(isDateEligibleForHabit(habit, '2026-05-04')).toBe(true)
  })

  it('每周一三五：周二返回 false', () => {
    const habit = makeHabit({
      startDate: '2026-05-01',
      frequency: { type: 'weekly_days', daysOfWeek: [1, 3, 5] },
    })
    expect(isDateEligibleForHabit(habit, '2026-05-05')).toBe(false)
  })
})
```

- [ ] **步骤 8：运行测试验证通过**

运行：`npx vitest run test/kernel/habitSchedule.test.ts`
预期：PASS

- [ ] **步骤 9：补充 ebbinghaus 频率测试**

在 `test/kernel/habitSchedule.test.ts` 中追加：

```typescript
describe('isDateEligibleForHabit - ebbinghaus', () => {
  it('无打卡记录时：startDate 当天返回 true', () => {
    const habit = makeHabit({
      startDate: '2026-05-01',
      frequency: { type: 'ebbinghaus', intervals: [1, 2, 4] },
      records: [],
    })
    expect(isDateEligibleForHabit(habit, '2026-05-01')).toBe(true)
  })

  it('无打卡记录时：startDate 之后返回 false', () => {
    const habit = makeHabit({
      startDate: '2026-05-01',
      frequency: { type: 'ebbinghaus', intervals: [1, 2, 4] },
      records: [],
    })
    expect(isDateEligibleForHabit(habit, '2026-05-02')).toBe(false)
  })

  it('5月1日打卡后：5月2日（间隔1天）返回 true', () => {
    const habit = makeHabit({
      startDate: '2026-05-01',
      frequency: { type: 'ebbinghaus', intervals: [1, 2, 4] },
      records: [{ date: '2026-05-01', status: 'completed' }],
    })
    expect(isDateEligibleForHabit(habit, '2026-05-02')).toBe(true)
  })

  it('5月1日打卡后：5月3日（间隔1天已过）返回 true', () => {
    const habit = makeHabit({
      startDate: '2026-05-01',
      frequency: { type: 'ebbinghaus', intervals: [1, 2, 4] },
      records: [{ date: '2026-05-01', status: 'completed' }],
    })
    expect(isDateEligibleForHabit(habit, '2026-05-03')).toBe(true)
  })

  it('5月1日和2日打卡后：5月5日（间隔2天）返回 true', () => {
    const habit = makeHabit({
      startDate: '2026-05-01',
      frequency: { type: 'ebbinghaus', intervals: [1, 2, 4] },
      records: [
        { date: '2026-05-01', status: 'completed' },
        { date: '2026-05-02', status: 'completed' },
      ],
    })
    expect(isDateEligibleForHabit(habit, '2026-05-05')).toBe(true)
  })

  it('5月1日和2日打卡后：5月4日（间隔2天未到）返回 false', () => {
    const habit = makeHabit({
      startDate: '2026-05-01',
      frequency: { type: 'ebbinghaus', intervals: [1, 2, 4] },
      records: [
        { date: '2026-05-01', status: 'completed' },
        { date: '2026-05-02', status: 'completed' },
      ],
    })
    expect(isDateEligibleForHabit(habit, '2026-05-04')).toBe(false)
  })

  it('missed 记录不计入完成日期', () => {
    const habit = makeHabit({
      startDate: '2026-05-01',
      frequency: { type: 'ebbinghaus', intervals: [1, 2, 4] },
      records: [
        { date: '2026-05-01', status: 'completed' },
        { date: '2026-05-02', status: 'missed' },
      ],
    })
    expect(isDateEligibleForHabit(habit, '2026-05-03')).toBe(true)
    expect(isDateEligibleForHabit(habit, '2026-05-04')).toBe(false)
  })
})
```

- [ ] **步骤 10：运行测试验证通过**

运行：`npx vitest run test/kernel/habitSchedule.test.ts`
预期：PASS

- [ ] **步骤 11：补充 isTodayCompleted 测试**

在 `test/kernel/habitSchedule.test.ts` 中追加：

```typescript
describe('isTodayCompleted', () => {
  it('二元型：有今天的记录返回 true', () => {
    const habit = makeHabit({
      type: 'binary',
      records: [{ date: '2026-05-15', status: 'completed' }],
    })
    expect(isTodayCompleted(habit, '2026-05-15')).toBe(true)
  })

  it('二元型：无记录返回 false', () => {
    const habit = makeHabit({ type: 'binary', records: [] })
    expect(isTodayCompleted(habit, '2026-05-15')).toBe(false)
  })

  it('二元型：missed 记录返回 false', () => {
    const habit = makeHabit({
      type: 'binary',
      records: [{ date: '2026-05-15', status: 'missed' }],
    })
    expect(isTodayCompleted(habit, '2026-05-15')).toBe(false)
  })

  it('计数型：currentValue >= target 返回 true', () => {
    const habit = makeHabit({
      type: 'count',
      target: 8,
      records: [{ date: '2026-05-15', currentValue: 8, status: 'completed' }],
    })
    expect(isTodayCompleted(habit, '2026-05-15')).toBe(true)
  })

  it('计数型：currentValue < target 返回 false', () => {
    const habit = makeHabit({
      type: 'count',
      target: 8,
      records: [{ date: '2026-05-15', currentValue: 5, status: 'completed' }],
    })
    expect(isTodayCompleted(habit, '2026-05-15')).toBe(false)
  })

  it('计数型：多条记录累加', () => {
    const habit = makeHabit({
      type: 'count',
      target: 8,
      records: [
        { date: '2026-05-15', currentValue: 3, status: 'completed' },
        { date: '2026-05-15', currentValue: 5, status: 'completed' },
      ],
    })
    expect(isTodayCompleted(habit, '2026-05-15')).toBe(true)
  })

  it('不同日期的记录不影响判断', () => {
    const habit = makeHabit({
      type: 'binary',
      records: [
        { date: '2026-05-14', status: 'completed' },
      ],
    })
    expect(isTodayCompleted(habit, '2026-05-15')).toBe(false)
  })
})
```

- [ ] **步骤 12：运行测试验证通过**

运行：`npx vitest run test/kernel/habitSchedule.test.ts`
预期：PASS

- [ ] **步骤 13：Commit**

```bash
git add src/kernel/habitSchedule.ts test/kernel/habitSchedule.test.ts
git commit -m "feat(kernel): 新增 habitSchedule 频率判断和打卡完成判断函数"
```

---

### 任务 3：修改 reminder.ts 使用新函数

**文件：**
- 修改：`src/kernel/reminder.ts:1-10`（导入）
- 修改：`src/kernel/reminder.ts:77-103`（habit 调度逻辑）

- [ ] **步骤 1：在 reminder.ts 中导入新函数**

在 `src/kernel/reminder.ts` 的导入部分，添加：

```typescript
import { isDateEligibleForHabit, isTodayCompleted } from './habitSchedule'
```

- [ ] **步骤 2：修改 habit 调度逻辑**

将 `rebuildReminderSchedule` 中的 habit 遍历部分（L77-L103）从：

```typescript
if (data.habits) {
  for (let j = 0; j < data.habits.length; j++) {
    const habit = data.habits[j]
    if (!habit.reminder || !habit.reminder.enabled) continue
    const habitReminderTime = calculateReminderTime(
      habit.targetDate,
      undefined,
      undefined,
      undefined,
      undefined,
      habit.reminder,
    )
    if (habitReminderTime < now - 5 * 60 * 1000) continue
    if (habitReminderTime > now + futureWindowMs) continue
    entries.push({
      id: `habit-${habit.blockId}-${habit.targetDate}-${habitReminderTime}`,
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

改为：

```typescript
if (data.habits) {
  const today = formatDate(new Date())
  for (let j = 0; j < data.habits.length; j++) {
    const habit = data.habits[j]
    if (!habit.reminder || !habit.reminder.enabled) continue
    if (!isDateEligibleForHabit(habit, today)) continue
    if (isTodayCompleted(habit, today)) continue
    const habitReminderTime = calculateReminderTime(
      today,
      undefined,
      undefined,
      undefined,
      undefined,
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

- [ ] **步骤 3：更新现有 reminder.dedup.test.ts 以适配新签名**

检查 `test/kernel/reminder.dedup.test.ts` 中的 mock 数据，确保 habits 数组包含新字段（`startDate`、`frequency`、`records`）。如果现有测试使用旧格式，添加默认值。

- [ ] **步骤 4：运行所有 kernel 测试**

运行：`npx vitest run test/kernel/`
预期：全部 PASS

- [ ] **步骤 5：Commit**

```bash
git add src/kernel/reminder.ts test/kernel/reminder.dedup.test.ts
git commit -m "feat(kernel): reminder 调度使用频率检查和打卡完成判断"
```

---

### 任务 4：修改 kernelDataWriter.ts 传递完整数据

**文件：**
- 修改：`src/mcp/kernelDataWriter.ts:58-77`（KernelDataHabit 类型）
- 修改：`src/mcp/kernelDataWriter.ts:134-143`（habits 映射）

- [ ] **步骤 1：更新 kernelDataWriter.ts 中的 habits 类型定义**

将 `KernelData` 接口中的 `habits` 数组元素类型从：

```typescript
habits: Array<{
  id: string
  name: string
  type: string
  target?: number
  unit?: string
  reminder?: { ... }
  targetDate: string
  blockId: string
}>
```

改为：

```typescript
habits: Array<{
  id: string
  name: string
  type: string
  target?: number
  unit?: string
  reminder?: { ... }
  targetDate: string
  blockId: string
  startDate: string
  frequency?: {
    type: string
    interval?: number
    daysOfWeek?: number[]
    intervals?: number[]
  }
  records: Array<{
    date: string
    currentValue?: number
    status?: string
  }>
  durationDays?: number
  archivedAt?: string
}>
```

- [ ] **步骤 2：更新 habits 映射逻辑**

将 `writeKernelData` 中的 habits 映射从：

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

改为：

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
  frequency: h.frequency
    ? {
        type: h.frequency.type,
        interval: h.frequency.interval,
        daysOfWeek: h.frequency.daysOfWeek,
        intervals: h.frequency.type === 'ebbinghaus' ? h.frequency.intervals : undefined,
      }
    : undefined,
  records: (h.records ?? []).map(r => ({
    date: r.date,
    currentValue: r.currentValue,
    status: r.status,
  })),
  durationDays: h.durationDays,
  archivedAt: h.archivedAt,
})),
```

- [ ] **步骤 3：运行 mcp 测试**

运行：`npx vitest run test/mcp/`
预期：全部 PASS

- [ ] **步骤 4：Commit**

```bash
git add src/mcp/kernelDataWriter.ts
git commit -m "feat(mcp): kernelDataWriter 传递完整频率信息和打卡记录"
```

---

### 任务 5：修改 Webhook Channel 默认事件

**文件：**
- 修改：`src/components/settings/WebhookConfigSection.vue:175`

- [ ] **步骤 1：修改 createEmptyChannel 函数**

将 `events: ['reminder']` 改为 `events: ['reminder', 'pomodoro', 'break', 'habit']`。

- [ ] **步骤 2：Commit**

```bash
git add src/components/settings/WebhookConfigSection.vue
git commit -m "fix(settings): webhook channel 默认订阅全部四种事件类型"
```

---

### 任务 6：全量验证

- [ ] **步骤 1：运行全部测试**

运行：`npx vitest run`
预期：全部 PASS

- [ ] **步骤 2：运行 lint**

运行：`npm run lint`
预期：无错误

- [ ] **步骤 3：最终 Commit（如有 lint 修复）**

```bash
git add -A
git commit -m "fix: lint 修复"
```
