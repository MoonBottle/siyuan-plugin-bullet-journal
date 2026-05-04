# Habit Spec Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将习惯系统当前代码实现整体重构到 `2026-04-07-habit-checkin-design.md` 与 `2026-04-29-habit-spec-alignment-design.md` 的统一语义，并补齐提醒设置、斜杠编辑、真实打卡、撤销与历史编辑等漏实现功能。

**Architecture:** 新增 `src/domain/habit/` 作为唯一的周期/完成度/统计语义来源，`habitReminder.ts`、`habitStatsUtils.ts` 和 UI 组件都只消费领域结果，不再各自推导周频逻辑。功能补齐与语义对齐放在同一条迁移链路中：先建领域测试，再迁移 service，再落地 slash/dialog/UI，最后清理兼容字段。

**Tech Stack:** TypeScript, Vue 3, Pinia, Vitest, SiYuan block API

---

## File Structure

- Create: `src/domain/habit/habitPeriod.ts`
  - 计算周期边界、要求数、日期资格与周期类型。
- Create: `src/domain/habit/habitCompletion.ts`
  - 聚合 record，输出单日状态、周期状态与周期进度。
- Create: `src/domain/habit/habitStats.ts`
  - 基于 period/completion 结果计算完成率、streak、聚合统计。
- Modify: `src/types/models.ts`
  - 补充 `HabitDayState`、`HabitPeriodState`、重构后的 `HabitStats` 类型。
- Modify: `src/utils/habitStatsUtils.ts`
  - 退化为领域层适配 facade，保留现有导出入口以减小调用面。
- Modify: `src/services/habitReminder.ts`
  - 改为消费领域层结果，重写 weekly / n_per_week 提醒语义。
- Modify: `src/services/habitService.ts`
  - 明确“增量打卡”和“设定具体值”的边界，补历史插入能力。
- Modify: `src/components/dialog/HabitCreateDialog.vue`
  - 增加 reminder 字段、编辑模式支持和 markdown 生成逻辑。
- Modify: `src/utils/dialog.ts`
  - 让 `showHabitCreateDialog()` 支持 `initialData` 和编辑回调。
- Modify: `src/utils/slashCommands.ts`
  - 实现 `/xg` 创建/编辑分流与 `/dk` 真正打卡。
- Modify: `src/tabs/DesktopHabitDock.vue`
  - 使用 day/period/stats 三类状态，补 refresh、设值、删除入口。
- Modify: `src/mobile/MobileHabitDock.vue`
  - 使用 day/period/stats 三类状态，补 refresh、设值、删除入口。
- Modify: `src/components/habit/HabitListItem.vue`
  - 改为消费单日状态与周期状态，不再复用 `isPeriodCompleted`。
- Modify: `src/components/habit/HabitStatsCards.vue`
  - 对齐 `HabitStats` 新字段。
- Modify: `src/components/habit/HabitRecordLog.vue`
  - 增加编辑 / 删除操作入口。
- Create: `test/domain/habit/habitPeriod.test.ts`
- Create: `test/domain/habit/habitCompletion.test.ts`
- Create: `test/domain/habit/habitStats.test.ts`
- Modify: `test/services/habitReminder.test.ts`
- Modify: `test/services/habitService.test.ts`
- Create: `test/utils/slashCommands.habit.test.ts`
- Create: `test/components/habit/HabitListItem.test.ts`
- Create: `test/components/habit/HabitRecordLog.test.ts`
- Modify: `test/utils/habitStatsUtils.test.ts`

## Task 1: 建立习惯领域层与基础类型

**Files:**
- Create: `src/domain/habit/habitPeriod.ts`
- Create: `src/domain/habit/habitCompletion.ts`
- Create: `src/domain/habit/habitStats.ts`
- Modify: `src/types/models.ts`
- Test: `test/domain/habit/habitPeriod.test.ts`
- Test: `test/domain/habit/habitCompletion.test.ts`
- Test: `test/domain/habit/habitStats.test.ts`

- [ ] **Step 1: 先写周期层失败测试**

在 `test/domain/habit/habitPeriod.test.ts` 写这组最小用例：

```ts
import { describe, it, expect } from 'vitest';
import {
  getHabitPeriod,
  isDateEligibleForHabit,
} from '@/domain/habit/habitPeriod';
import type { Habit } from '@/types/models';

function mkHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    name: '早起',
    docId: 'doc-1',
    blockId: 'habit-1',
    type: 'binary',
    startDate: '2026-04-01',
    records: [],
    frequency: { type: 'daily' },
    ...overrides,
  };
}

describe('getHabitPeriod', () => {
  it('weekly 应返回自然周边界和 requiredCount=1', () => {
    const habit = mkHabit({ frequency: { type: 'weekly' } });
    const period = getHabitPeriod(habit, '2026-04-09');

    expect(period.periodType).toBe('week');
    expect(period.periodStart).toBe('2026-04-06');
    expect(period.periodEnd).toBe('2026-04-12');
    expect(period.requiredCount).toBe(1);
  });

  it('every_n_days 应返回 interval 周期边界', () => {
    const habit = mkHabit({ frequency: { type: 'every_n_days', interval: 3 } });
    const period = getHabitPeriod(habit, '2026-04-08');

    expect(period.periodType).toBe('interval');
    expect(period.periodStart).toBe('2026-04-07');
    expect(period.periodEnd).toBe('2026-04-09');
    expect(period.requiredCount).toBe(1);
  });
});

describe('isDateEligibleForHabit', () => {
  it('weekly 在当周每天都有资格', () => {
    const habit = mkHabit({ frequency: { type: 'weekly' } });
    expect(isDateEligibleForHabit(habit, '2026-04-08')).toBe(true);
    expect(isDateEligibleForHabit(habit, '2026-04-12')).toBe(true);
  });

  it('weekly_days 仅要求日具备资格', () => {
    const habit = mkHabit({ frequency: { type: 'weekly_days', daysOfWeek: [1, 3, 5] } });
    expect(isDateEligibleForHabit(habit, '2026-04-08')).toBe(true);
    expect(isDateEligibleForHabit(habit, '2026-04-09')).toBe(false);
  });
});
```

- [ ] **Step 2: 写完成层失败测试**

在 `test/domain/habit/habitCompletion.test.ts` 写：

```ts
import { describe, it, expect } from 'vitest';
import {
  getHabitDayState,
  getHabitPeriodState,
} from '@/domain/habit/habitCompletion';
import type { CheckInRecord, Habit } from '@/types/models';

function mkRecord(date: string, overrides: Partial<CheckInRecord> = {}): CheckInRecord {
  return {
    content: '喝水',
    date,
    docId: 'doc-1',
    blockId: `record-${date}`,
    habitId: 'habit-1',
    ...overrides,
  };
}

function mkHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    name: '喝水',
    docId: 'doc-1',
    blockId: 'habit-1',
    type: 'count',
    startDate: '2026-04-01',
    target: 8,
    unit: '杯',
    records: [],
    frequency: { type: 'n_per_week', daysPerWeek: 3 },
    ...overrides,
  };
}

describe('getHabitDayState', () => {
  it('计数型单日取最大 currentValue', () => {
    const habit = mkHabit({
      records: [
        mkRecord('2026-04-09', { currentValue: 3, targetValue: 8 }),
        mkRecord('2026-04-09', { currentValue: 7, targetValue: 8 }),
      ],
    });
    const state = getHabitDayState(habit, '2026-04-09');

    expect(state.hasRecord).toBe(true);
    expect(state.currentValue).toBe(7);
    expect(state.isCompleted).toBe(false);
  });
});

describe('getHabitPeriodState', () => {
  it('n_per_week 应统计当周 completedCount / requiredCount', () => {
    const habit = mkHabit({
      records: [
        mkRecord('2026-04-07', { currentValue: 8, targetValue: 8 }),
        mkRecord('2026-04-08', { currentValue: 8, targetValue: 8 }),
      ],
    });
    const state = getHabitPeriodState(habit, '2026-04-09');

    expect(state.requiredCount).toBe(3);
    expect(state.completedCount).toBe(2);
    expect(state.remainingCount).toBe(1);
    expect(state.isCompleted).toBe(false);
    expect(state.eligibleToday).toBe(true);
  });
});
```

- [ ] **Step 3: 写统计层失败测试**

在 `test/domain/habit/habitStats.test.ts` 写：

```ts
import { describe, it, expect } from 'vitest';
import { calculateHabitStats } from '@/domain/habit/habitStats';
import type { Habit, CheckInRecord } from '@/types/models';

function mkRecord(date: string, overrides: Partial<CheckInRecord> = {}): CheckInRecord {
  return {
    content: '周报',
    date,
    docId: 'doc-1',
    blockId: `record-${date}`,
    habitId: 'habit-1',
    ...overrides,
  };
}

function mkHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    name: '周报',
    docId: 'doc-1',
    blockId: 'habit-1',
    type: 'binary',
    startDate: '2026-04-01',
    records: [],
    frequency: { type: 'weekly' },
    ...overrides,
  };
}

describe('calculateHabitStats', () => {
  it('weekly 完成率应按周数而不是自然天数计算', () => {
    const habit = mkHabit({
      records: [mkRecord('2026-04-03'), mkRecord('2026-04-08'), mkRecord('2026-04-15')],
    });
    const stats = calculateHabitStats(habit, '2026-04-20');

    expect(stats.completionRate).toBeCloseTo(3 / 4, 5);
  });

  it('durationDays 到期应返回 isEnded=true', () => {
    const habit = mkHabit({ durationDays: 7 });
    const stats = calculateHabitStats(habit, '2026-04-07');
    expect(stats.isEnded).toBe(true);
  });
});
```

- [ ] **Step 4: 跑测试，确认领域层尚未存在**

Run:

```bash
npx vitest run test/domain/habit/habitPeriod.test.ts test/domain/habit/habitCompletion.test.ts test/domain/habit/habitStats.test.ts
```

Expected: FAIL，原因应为 `@/domain/habit/*` 文件不存在或导出未定义。

- [ ] **Step 5: 写最小领域实现与类型**

在 `src/types/models.ts` 增加：

```ts
export interface HabitDayState {
  date: string;
  hasRecord: boolean;
  isCompleted: boolean;
  currentValue?: number;
  targetValue?: number;
}

export interface HabitPeriodState {
  periodType: 'day' | 'interval' | 'week';
  periodStart: string;
  periodEnd: string;
  requiredCount: number;
  completedCount: number;
  remainingCount: number;
  isCompleted: boolean;
  eligibleToday: boolean;
}
```

在 `src/domain/habit/habitPeriod.ts` 写最小骨架：

```ts
import dayjs from '@/utils/dayjs';
import type { Habit, HabitPeriodState } from '@/types/models';

export function isHabitActiveOnDate(habit: Habit, date: string): boolean {
  if (date < habit.startDate) return false;
  if (!habit.durationDays) return true;
  const endDate = dayjs(habit.startDate).add(habit.durationDays - 1, 'day').format('YYYY-MM-DD');
  return date <= endDate;
}

export function isDateEligibleForHabit(habit: Habit, date: string): boolean {
  if (!isHabitActiveOnDate(habit, date)) return false;
  const frequency = habit.frequency ?? { type: 'daily' };
  const current = dayjs(date);

  switch (frequency.type) {
    case 'daily':
    case 'weekly':
    case 'n_per_week':
      return true;
    case 'every_n_days': {
      const interval = frequency.interval ?? 2;
      return current.diff(dayjs(habit.startDate), 'day') % interval === 0;
    }
    case 'weekly_days':
      return (frequency.daysOfWeek ?? []).includes(current.day());
    default:
      return true;
  }
}

export function getHabitPeriod(habit: Habit, date: string): Omit<HabitPeriodState, 'completedCount' | 'remainingCount' | 'isCompleted' | 'eligibleToday'> {
  const frequency = habit.frequency ?? { type: 'daily' };
  if (frequency.type === 'every_n_days') {
    const interval = frequency.interval ?? 2;
    const diff = dayjs(date).diff(dayjs(habit.startDate), 'day');
    const offset = Math.floor(diff / interval) * interval;
    const start = dayjs(habit.startDate).add(offset, 'day');
    return {
      periodType: 'interval',
      periodStart: start.format('YYYY-MM-DD'),
      periodEnd: start.add(interval - 1, 'day').format('YYYY-MM-DD'),
      requiredCount: 1,
    };
  }

  if (frequency.type === 'daily') {
    return {
      periodType: 'day',
      periodStart: date,
      periodEnd: date,
      requiredCount: 1,
    };
  }

  const weekStart = dayjs(date).startOf('week').add(1, 'day');
  const weekEnd = weekStart.add(6, 'day');
  const requiredCount =
    frequency.type === 'weekly'
      ? 1
      : frequency.type === 'n_per_week'
        ? (frequency.daysPerWeek ?? 1)
        : (frequency.daysOfWeek ?? []).filter((dow) => {
            for (let i = 0; i < 7; i++) {
              if (weekStart.add(i, 'day').day() === dow)
                return true;
            }
            return false;
          }).length;

  return {
    periodType: 'week',
    periodStart: weekStart.format('YYYY-MM-DD'),
    periodEnd: weekEnd.format('YYYY-MM-DD'),
    requiredCount,
  };
}
```

在 `src/domain/habit/habitCompletion.ts` 和 `src/domain/habit/habitStats.ts` 分别实现 `getHabitDayState()`、`getHabitPeriodState()`、`calculateHabitStats()`，并让 weekly / every_n_days / n_per_week 的统计按 spec 计算。

- [ ] **Step 6: 跑领域测试，确认转绿**

Run:

```bash
npx vitest run test/domain/habit/habitPeriod.test.ts test/domain/habit/habitCompletion.test.ts test/domain/habit/habitStats.test.ts
```

Expected: PASS。

- [ ] **Step 7: 提交这一小步**

```bash
git add src/types/models.ts src/domain/habit/habitPeriod.ts src/domain/habit/habitCompletion.ts src/domain/habit/habitStats.ts test/domain/habit/habitPeriod.test.ts test/domain/habit/habitCompletion.test.ts test/domain/habit/habitStats.test.ts
git commit -m "feat(habit): add unified domain period model"
```

## Task 2: 将 habitStatsUtils 与 habitReminder 收口到领域层

**Files:**
- Modify: `src/utils/habitStatsUtils.ts`
- Modify: `src/services/habitReminder.ts`
- Modify: `test/utils/habitStatsUtils.test.ts`
- Modify: `test/services/habitReminder.test.ts`

- [ ] **Step 1: 先写提醒失败测试，锁定 weekly / n_per_week 新语义**

在 `test/services/habitReminder.test.ts` 增加：

```ts
it('weekly 未达标时周内每天都生成 reminder entry', () => {
  const habit = mkHabit({
    name: '周报',
    frequency: { type: 'weekly' },
    reminder: { type: 'absolute', time: '09:00' },
    records: [],
  });

  expect(getHabitReminderEntries([habit], '2026-04-08')).toHaveLength(1);
  expect(getHabitReminderEntries([habit], '2026-04-10')).toHaveLength(1);
});

it('weekly 达标后当周不再生成 reminder entry', () => {
  const habit = mkHabit({
    name: '周报',
    frequency: { type: 'weekly' },
    reminder: { type: 'absolute', time: '09:00' },
    records: [{
      content: '周报',
      date: '2026-04-08',
      docId: 'doc-1',
      blockId: 'record-1',
      habitId: 'habit-1',
    }],
  });

  expect(getHabitReminderEntries([habit], '2026-04-10')).toHaveLength(0);
});
```

- [ ] **Step 2: 再写统计 facade 失败测试**

在 `test/utils/habitStatsUtils.test.ts` 增加：

```ts
it('calculateHabitStats 应返回 isEnded 而不是旧的 isCompleted', () => {
  const habit = mkHabit({ name: '早起', durationDays: 7 });
  const stats = calculateHabitStats(habit, '2026-04-07');
  expect(stats.isEnded).toBe(true);
});

it('weekly 完成率应按周数透传领域层结果', () => {
  const habit = mkHabit({
    name: '周报',
    frequency: { type: 'weekly' },
    records: [mkRecord('2026-04-03'), mkRecord('2026-04-08')],
  });
  const stats = calculateHabitStats(habit, '2026-04-20');
  expect(stats.completionRate).toBeCloseTo(2 / 4, 5);
});
```

- [ ] **Step 3: 跑测试，确认旧语义失败**

Run:

```bash
npx vitest run test/services/habitReminder.test.ts test/utils/habitStatsUtils.test.ts
```

Expected: FAIL，原因应为 `habitReminder.ts` 仍使用旧 `isCheckInDay()` 模型，`habitStatsUtils.ts` 仍输出旧字段与旧算法。

- [ ] **Step 4: 写最小适配实现**

将 `src/utils/habitStatsUtils.ts` 改成对领域层的薄封装：

```ts
export { calculateHabitStats, calculateAllHabitStats, isRecordCompleted } from '@/domain/habit/habitStats';
```

并在 `src/services/habitReminder.ts` 中改为：

```ts
import {
  isDateEligibleForHabit,
} from '@/domain/habit/habitPeriod';
import {
  getHabitPeriodState,
} from '@/domain/habit/habitCompletion';

export function getHabitReminderEntries(habits: Habit[], currentDate: string): HabitReminderEntry[] {
  const entries: HabitReminderEntry[] = [];

  for (const habit of habits) {
    if (!isDateEligibleForHabit(habit, currentDate))
      continue;

    const periodState = getHabitPeriodState(habit, currentDate);
    if (periodState.isCompleted)
      continue;

    const reminderTime = getHabitReminderTime(habit, currentDate);
    if (!reminderTime)
      continue;

    const timestamp = reminderTime.getTime();
    entries.push({
      habit,
      reminderTime: timestamp,
      key: `habit-${habit.blockId}-${currentDate}-${timestamp}`,
    });
  }

  return entries;
}
```

保留 `getHabitReminderTime()`，但删除或降级旧 `isCheckInDay()` 路径，避免继续被业务误用。

- [ ] **Step 5: 跑测试，确认转绿**

Run:

```bash
npx vitest run test/services/habitReminder.test.ts test/utils/habitStatsUtils.test.ts
```

Expected: PASS。

- [ ] **Step 6: 提交这一小步**

```bash
git add src/utils/habitStatsUtils.ts src/services/habitReminder.ts test/utils/habitStatsUtils.test.ts test/services/habitReminder.test.ts
git commit -m "refactor(habit): align reminder and stats with domain model"
```

## Task 3: 为 HabitCreateDialog 与 dialog 入口补 reminder + 编辑模式

**Files:**
- Modify: `src/components/dialog/HabitCreateDialog.vue`
- Modify: `src/utils/dialog.ts`
- Test: `test/components/dialog/HabitCreateDialog.test.ts`

- [ ] **Step 1: 先写失败测试，锁定 reminder 输出与编辑预填**

创建 `test/components/dialog/HabitCreateDialog.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import HabitCreateDialog from '@/components/dialog/HabitCreateDialog.vue';

describe('HabitCreateDialog', () => {
  it('编辑模式应预填 reminder 和 frequency', async () => {
    const wrapper = mount(HabitCreateDialog, {
      props: {
        initialData: {
          name: '喝水',
          startDate: '2026-04-01',
          type: 'count',
          target: 8,
          unit: '杯',
          reminder: { type: 'absolute', time: '09:00' },
          frequency: { type: 'weekly' },
        },
      },
    });

    expect((wrapper.vm as any).form.name).toBe('喝水');
    expect((wrapper.vm as any).form.reminderTime).toBe('09:00');
    expect((wrapper.vm as any).form.frequencyType).toBe('weekly');
  });

  it('保存时应生成包含 reminder 的 markdown', async () => {
    const wrapper = mount(HabitCreateDialog);
    (wrapper.vm as any).form.name = '喝水';
    (wrapper.vm as any).form.startDate = '2026-04-01';
    (wrapper.vm as any).form.type = 'count';
    (wrapper.vm as any).form.target = 8;
    (wrapper.vm as any).form.unit = '杯';
    (wrapper.vm as any).form.reminderTime = '09:00';
    (wrapper.vm as any).form.frequencyType = 'daily';

    await wrapper.find('.btn-save').trigger('click');

    expect(wrapper.emitted('save')?.[0]?.[0]).toBe('喝水 🎯2026-04-01 8杯 ⏰09:00 🔄每天');
  });
});
```

- [ ] **Step 2: 跑测试，确认当前组件没有 reminder 字段**

Run:

```bash
npx vitest run test/components/dialog/HabitCreateDialog.test.ts
```

Expected: FAIL，原因应为 `form.reminderTime` 不存在且 markdown 中不会生成 `⏰09:00`。

- [ ] **Step 3: 写最小实现**

在 `src/components/dialog/HabitCreateDialog.vue`：

```ts
const props = defineProps<{
  initialData?: Partial<{
    name: string;
    startDate: string;
    durationDays?: number;
    type: 'binary' | 'count';
    target?: number;
    unit?: string;
    reminder?: { type: 'absolute'; time?: string };
    frequency?: HabitFrequency;
  }>;
}>();

const form = reactive({
  // ...
  reminderTime: props.initialData?.reminder?.time || '',
});
```

在模板里加入：

```vue
<div class="form-group">
  <label class="form-label">{{ t('habit').reminderLabel || '提醒时间（可选）' }}</label>
  <input v-model="form.reminderTime" type="time" class="form-input" />
</div>
```

在 `buildMarkdown()` 中加：

```ts
if (form.reminderTime) {
  line += ` ⏰${form.reminderTime}`;
}
```

在 `src/utils/dialog.ts` 将签名改成：

```ts
export function showHabitCreateDialog(
  onSave: (markdown: string) => void,
  initialData?: Record<string, any>,
): Dialog
```

并把 `initialData` 传给组件：

```ts
const app = createApp(HabitCreateDialog, {
  initialData,
  onSave: (markdown: string) => {
    onSave(markdown);
    dialog.destroy();
  },
  onCancel: () => dialog.destroy(),
});
```

- [ ] **Step 4: 跑测试，确认转绿**

Run:

```bash
npx vitest run test/components/dialog/HabitCreateDialog.test.ts
```

Expected: PASS。

- [ ] **Step 5: 提交这一小步**

```bash
git add src/components/dialog/HabitCreateDialog.vue src/utils/dialog.ts test/components/dialog/HabitCreateDialog.test.ts
git commit -m "feat(habit): support reminder fields in habit dialog"
```

## Task 4: 修正 habitService 的“增量 vs 设值”边界，并补历史插入顺序

**Files:**
- Modify: `src/services/habitService.ts`
- Modify: `test/services/habitService.test.ts`

- [ ] **Step 1: 先写失败测试，锁定设值不应误增量**

在 `test/services/habitService.test.ts` 补：

```ts
it('setCheckInValue 应把值设为目标值，而不是在现有值上累加', async () => {
  const writer = vi.fn().mockResolvedValue(true);
  const habit = mkHabit({
    name: '喝水',
    type: 'count',
    target: 8,
    unit: '杯',
    records: [mkRecord('2026-04-07', { currentValue: 3, targetValue: 8, unit: '杯' })],
  });

  const result = await setCheckInValue(habit, '2026-04-07', 4, writer);

  expect(result).toBe(true);
  expect(writer).toHaveBeenCalledWith('喝水 4/8杯 📅2026-04-07', 'record-2026-04-07');
});

it('findInsertAfterBlockId 应为历史补打卡选择最近的前序 record', () => {
  const habit = mkHabit({
    records: [
      mkRecord('2026-04-05', { blockId: 'r5' }),
      mkRecord('2026-04-07', { blockId: 'r7' }),
    ],
    blockId: 'habit-1',
  });

  expect(findInsertAfterBlockId(habit, '2026-04-06')).toBe('r5');
  expect(findInsertAfterBlockId(habit, '2026-04-04')).toBe('habit-1');
});
```

- [ ] **Step 2: 跑测试，确认历史插入 helper 尚不存在**

Run:

```bash
npx vitest run test/services/habitService.test.ts
```

Expected: FAIL，原因应为 `findInsertAfterBlockId` 未定义，或插入逻辑仍总是使用 `lastBlockId`。

- [ ] **Step 3: 写最小实现**

在 `src/services/habitService.ts` 增加：

```ts
export function findInsertAfterBlockId(habit: Habit, date: string): string {
  const sorted = [...habit.records].sort((a, b) => a.date.localeCompare(b.date));
  let previousId = habit.blockId;

  for (const record of sorted) {
    if (record.date > date)
      break;
    previousId = record.blockId;
  }

  return previousId;
}
```

并把创建 record 的插入点统一改成：

```ts
const previousId = findInsertAfterBlockId(habit, date);
```

保留 `checkInCount()` 只做增量：

```ts
if (existingRecord) {
  const currentValue = (existingRecord.currentValue ?? 0) + incrementBy;
  return await setCheckInValue(habit, date, currentValue, writer);
}
```

但所有“明确设值”的 UI 将在后续任务改调 `setCheckInValue()`。

- [ ] **Step 4: 跑测试，确认转绿**

Run:

```bash
npx vitest run test/services/habitService.test.ts
```

Expected: PASS。

- [ ] **Step 5: 提交这一小步**

```bash
git add src/services/habitService.ts test/services/habitService.test.ts
git commit -m "fix(habit): separate set-value from incremental check-in"
```

## Task 5: 实现 `/xg` 编辑与 `/dk` 真打卡

**Files:**
- Modify: `src/utils/slashCommands.ts`
- Modify: `src/parser/habitParser.ts`
- Test: `test/utils/slashCommands.habit.test.ts`

- [ ] **Step 1: 先写 slash 失败测试**

创建 `test/utils/slashCommands.habit.test.ts`：

```ts
import { describe, it, expect, vi } from 'vitest';
import { getActionHandler } from '@/utils/slashCommands';
import * as dialog from '@/utils/dialog';
import * as habitService from '@/services/habitService';

describe('habit slash commands', () => {
  it('/xg 在习惯行上应进入编辑模式', () => {
    const showSpy = vi.spyOn(dialog, 'showHabitCreateDialog').mockReturnValue({} as any);
    const handler = getActionHandler('createHabit', { openHabitDock: vi.fn() } as any, ['/xg']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-1');
    node.textContent = '喝水 🎯2026-04-01 8杯 ⏰09:00 🔄每天';

    handler({} as any, node);

    expect(showSpy).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
      name: '喝水',
      target: 8,
      unit: '杯',
    }));
  });

  it('/dk 应调用真实打卡逻辑而不是 placeholder', async () => {
    const checkInSpy = vi.spyOn(habitService, 'checkIn').mockResolvedValue(true);
    const handler = getActionHandler('checkIn', { openHabitDock: vi.fn() } as any, ['/dk']);
    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-1');
    node.textContent = '早起 🎯2026-04-01 🔄每天';

    await handler({} as any, node);

    expect(checkInSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 跑测试，确认旧 placeholder 失败**

Run:

```bash
npx vitest run test/utils/slashCommands.habit.test.ts
```

Expected: FAIL，原因应为 `showHabitCreateDialog()` 只支持单参数，且 `/dk` 仍是 placeholder。

- [ ] **Step 3: 写最小实现**

在 `src/parser/habitParser.ts` 暴露一个用于编辑预填的辅助：

```ts
export function parseHabitLine(line: string): Partial<Habit> | null
```

保持现有返回结构，供 slash command 直接复用。

在 `src/utils/slashCommands.ts` 的 `createHabit` 分支中：

```ts
const text = nodeElement?.textContent?.trim() || '';
const parsedHabit = parseHabitLine(text);

showHabitCreateDialog((markdown) => {
  const blockId = nodeElement?.getAttribute?.('data-node-id');
  if (!blockId)
    return;

  if (parsedHabit) {
    updateBlock('markdown', markdown, blockId);
  } else {
    insertBlock('markdown', markdown, undefined, blockId);
  }
}, parsedHabit || undefined);
```

在 `checkIn` 分支中至少落地习惯定义行和今日 record 两条主路径：

```ts
const text = nodeElement?.textContent?.trim() || '';
const parsedHabit = parseHabitLine(text);
const parsedRecord = parseCheckInRecordLine(text, '');

if (parsedHabit) {
  // 根据习惯类型走 checkIn / checkInCount
} else if (parsedRecord) {
  // 今日 count record -> setCheckInValue or increment
  // 历史 record -> config.openHabitDock()
}
```

先做到和当前测试一致，再在后续执行中补齐历史 record 分流细节。

- [ ] **Step 4: 跑测试，确认转绿**

Run:

```bash
npx vitest run test/utils/slashCommands.habit.test.ts
```

Expected: PASS。

- [ ] **Step 5: 提交这一小步**

```bash
git add src/utils/slashCommands.ts src/parser/habitParser.ts test/utils/slashCommands.habit.test.ts
git commit -m "feat(habit): implement slash edit and check-in flows"
```

## Task 6: 调整桌面/移动 Habit UI，补删除与 refresh 闭环

**Files:**
- Modify: `src/tabs/DesktopHabitDock.vue`
- Modify: `src/mobile/MobileHabitDock.vue`
- Modify: `src/components/habit/HabitListItem.vue`
- Modify: `src/components/habit/HabitStatsCards.vue`
- Modify: `src/components/habit/HabitRecordLog.vue`
- Create: `test/components/habit/HabitListItem.test.ts`
- Create: `test/components/habit/HabitRecordLog.test.ts`

- [ ] **Step 1: 先写列表态失败测试，锁定 day state 与 period state 分离**

在 `test/components/habit/HabitListItem.test.ts` 写：

```ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import HabitListItem from '@/components/habit/HabitListItem.vue';

describe('HabitListItem', () => {
  it('今天未打卡但当前周期已达标时，按钮仍显示未打卡而卡片显示周期完成态', () => {
    const wrapper = mount(HabitListItem, {
      props: {
        habit: { name: '周报', type: 'binary', records: [], blockId: 'h1', docId: 'd1', startDate: '2026-04-01', frequency: { type: 'weekly' } },
        dayState: { date: '2026-04-10', hasRecord: false, isCompleted: false },
        periodState: { periodType: 'week', periodStart: '2026-04-06', periodEnd: '2026-04-12', requiredCount: 1, completedCount: 1, remainingCount: 0, isCompleted: true, eligibleToday: true },
        stats: { habitId: 'h1', totalCheckins: 1, monthlyCheckins: 1, completionRate: 1, weeklyCompletionRate: 1, monthlyCompletionRate: 1, currentStreak: 1, longestStreak: 1, isEnded: false },
      },
    });

    expect(wrapper.text()).toContain('本周已达标');
    expect(wrapper.text()).toContain('打卡');
  });
});
```

- [ ] **Step 2: 再写日志操作失败测试**

在 `test/components/habit/HabitRecordLog.test.ts` 写：

```ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import HabitRecordLog from '@/components/habit/HabitRecordLog.vue';

describe('HabitRecordLog', () => {
  it('应暴露 edit/delete 事件入口', async () => {
    const wrapper = mount(HabitRecordLog, {
      props: {
        habit: {
          name: '喝水',
          type: 'count',
          blockId: 'h1',
          docId: 'd1',
          startDate: '2026-04-01',
          target: 8,
          unit: '杯',
          frequency: { type: 'daily' },
          records: [{
            content: '喝水',
            date: '2026-04-07',
            docId: 'd1',
            blockId: 'r1',
            habitId: 'h1',
            currentValue: 5,
            targetValue: 8,
            unit: '杯',
          }],
        },
      },
    });

    await wrapper.find('[data-action=\"edit-record\"]').trigger('click');
    await wrapper.find('[data-action=\"delete-record\"]').trigger('click');

    expect(wrapper.emitted('edit-record')).toHaveLength(1);
    expect(wrapper.emitted('delete-record')).toHaveLength(1);
  });
});
```

- [ ] **Step 3: 跑测试，确认现有组件不支持这些 props / 事件**

Run:

```bash
npx vitest run test/components/habit/HabitListItem.test.ts test/components/habit/HabitRecordLog.test.ts
```

Expected: FAIL。

- [ ] **Step 4: 写最小 UI 实现**

在 `HabitListItem.vue` 把 props 改成：

```ts
const props = defineProps<{
  habit: Habit;
  dayState: HabitDayState;
  periodState: HabitPeriodState;
  stats?: HabitStats;
}>();
```

并改按钮与灰化逻辑：

```ts
const isTodayCompleted = computed(() => props.dayState.isCompleted);
const isPeriodCompleted = computed(() => props.periodState.isCompleted);
```

模板加一行：

```vue
<span v-if="isPeriodCompleted" class="habit-list-item__period-done">{{ t('habit').periodCompleted || '本周已达标' }}</span>
```

在 `HabitRecordLog.vue` 增加：

```ts
const emit = defineEmits<{
  'edit-record': [record: CheckInRecord];
  'delete-record': [record: CheckInRecord];
}>();
```

模板里加按钮：

```vue
<button data-action="edit-record" @click="emit('edit-record', record)">编辑</button>
<button data-action="delete-record" @click="emit('delete-record', record)">删除</button>
```

在 `DesktopHabitDock.vue` 与 `MobileHabitDock.vue`：

- 详情页顶部设值调用 `setCheckInValue()`，不再调用 `checkInCount()`。
- 打卡成功后显式 `projectStore.refresh(...)`。
- 接收 `HabitRecordLog` 的 `edit-record` / `delete-record` 事件，删除时调用 `deleteCheckIn()`，编辑时对计数型 record 打开最小输入路径或先复用 `setCheckInValue()`。

- [ ] **Step 5: 跑测试，确认转绿**

Run:

```bash
npx vitest run test/components/habit/HabitListItem.test.ts test/components/habit/HabitRecordLog.test.ts
```

Expected: PASS。

- [ ] **Step 6: 提交这一小步**

```bash
git add src/tabs/DesktopHabitDock.vue src/mobile/MobileHabitDock.vue src/components/habit/HabitListItem.vue src/components/habit/HabitStatsCards.vue src/components/habit/HabitRecordLog.vue test/components/habit/HabitListItem.test.ts test/components/habit/HabitRecordLog.test.ts
git commit -m "feat(habit): align ui states and record actions"
```

## Task 7: 运行聚焦回归并清理兼容层

**Files:**
- Modify: `src/types/models.ts`
- Modify: `src/utils/habitStatsUtils.ts`
- Modify: `test/utils/habitStatsUtils.test.ts`
- Modify: any files touched in prior tasks if cleanup required

- [ ] **Step 1: 跑聚焦测试集**

Run:

```bash
npx vitest run test/domain/habit/habitPeriod.test.ts test/domain/habit/habitCompletion.test.ts test/domain/habit/habitStats.test.ts test/services/habitReminder.test.ts test/services/habitService.test.ts test/components/dialog/HabitCreateDialog.test.ts test/utils/slashCommands.habit.test.ts test/components/habit/HabitListItem.test.ts test/components/habit/HabitRecordLog.test.ts test/utils/habitStatsUtils.test.ts
```

Expected: PASS。

- [ ] **Step 2: 跑现有习惯相关旧测试，确认兼容层没有破坏原入口**

Run:

```bash
npx vitest run test/stores/projectStore.test.ts test/parser/core.test.ts test/services/reminderService.test.ts
```

Expected: PASS；如果 `test/parser/core.test.ts` 文件不存在，则改为实际仓库中覆盖 habit 解析的 parser 测试文件。

- [ ] **Step 3: 清理旧字段与过时注释**

删除或替换这些旧语义痕迹：

```ts
// 删除旧 HabitStats 中的 isCompleted / isPeriodCompleted 依赖
// 将 UI 文案注释中的“今天已打卡”与“当前周期已达标”拆开
// 删除 habitReminder.ts 中对旧 isCheckInDay() 的业务依赖
```

同步更新 `test/utils/habitStatsUtils.test.ts` 中旧断言：

```ts
expect(stats.isEnded).toBe(false);
expect(stats.weeklyCompletionRate).toBeGreaterThanOrEqual(0);
```

- [ ] **Step 4: 跑全量测试**

Run:

```bash
npm test
```

Expected: PASS。

- [ ] **Step 5: 提交收尾清理**

```bash
git add src/types/models.ts src/utils/habitStatsUtils.ts src/services/habitReminder.ts src/services/habitService.ts src/utils/slashCommands.ts src/components/dialog/HabitCreateDialog.vue src/utils/dialog.ts src/tabs/DesktopHabitDock.vue src/mobile/MobileHabitDock.vue src/components/habit/HabitListItem.vue src/components/habit/HabitStatsCards.vue src/components/habit/HabitRecordLog.vue test/domain/habit/habitPeriod.test.ts test/domain/habit/habitCompletion.test.ts test/domain/habit/habitStats.test.ts test/services/habitReminder.test.ts test/services/habitService.test.ts test/components/dialog/HabitCreateDialog.test.ts test/utils/slashCommands.habit.test.ts test/components/habit/HabitListItem.test.ts test/components/habit/HabitRecordLog.test.ts test/utils/habitStatsUtils.test.ts
git commit -m "refactor(habit): align implementation with habit specs"
```

## Self-Review

- Spec coverage:
  - 领域层拆分、周期语义统一由 Task 1 覆盖。
  - reminder / stats 语义收口由 Task 2 覆盖。
  - reminder 设置、编辑模式由 Task 3 覆盖。
  - 设值/增量分离、历史插入顺序由 Task 4 覆盖。
  - `/xg` 编辑与 `/dk` 真打卡由 Task 5 覆盖。
  - UI 状态拆分、删除 / 编辑入口、桌面 refresh 由 Task 6 覆盖。
  - 兼容层清理和全量回归由 Task 7 覆盖。
- Placeholder scan:
  - 没有 `TBD`、`TODO`、`implement later` 之类占位词。
  - 每个任务都给了具体文件、测试代码、命令和预期结果。
- Type consistency:
  - `HabitDayState`、`HabitPeriodState`、`HabitStats.isEnded` 在所有任务中命名一致。
  - 设值接口统一用 `setCheckInValue()`，增量接口统一用 `checkInCount()`。
