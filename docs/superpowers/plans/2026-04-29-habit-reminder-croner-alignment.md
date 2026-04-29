# Habit Reminder Croner Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align habit check-in reminders with the existing Croner-based item reminder flow so habits get scheduled Cron jobs, missed-window catch-up, and diff-based cleanup.

**Architecture:** Keep `ReminderService` as the single reminder orchestration entrypoint. Move habit reminder code from “check whether it should fire right now” to “build reminder entries for today”, then let `ReminderService.rebuildSchedule()` apply the same rebuild, catch-up, and cleanup rules to both item jobs and habit jobs.

**Tech Stack:** TypeScript, Vitest, Croner, Pinia-backed project store

---

## File Structure

- Modify: `src/services/habitReminder.ts`
  - Replace the current `getHabitsNeedingReminder(habits, currentDate, now)` window-check helper with a pure entry builder that returns today's habit reminder entries.
- Modify: `src/services/reminderService.ts`
  - Add `habitScheduledJobs`, habit rebuild logic, habit Cron callbacks, and habit notification helper.
- Modify: `test/services/habitReminder.test.ts`
  - Replace the old window-trigger tests with entry-builder tests.
- Modify: `test/services/reminderService.test.ts`
  - Add tests covering habit Cron scheduling, missed-window catch-up, cleanup, and reminder-time changes.

### Task 1: Refactor habit reminder helper to build reminder entries

**Files:**
- Modify: `src/services/habitReminder.ts`
- Test: `test/services/habitReminder.test.ts`

- [ ] **Step 1: Write the failing helper tests**

Add these tests to `test/services/habitReminder.test.ts` and update the import to use `getHabitReminderEntries`:

```ts
import { describe, it, expect } from 'vitest';
import { isCheckInDay, getHabitReminderTime, getHabitReminderEntries } from '@/services/habitReminder';
import type { Habit } from '@/types/models';

function mkHabit(overrides: Partial<Habit> & { name: string }): Habit {
  return {
    docId: 'doc-1',
    blockId: 'habit-1',
    type: 'binary',
    startDate: '2026-04-01',
    records: [],
    frequency: { type: 'daily' },
    ...overrides,
  };
}

describe('getHabitReminderEntries', () => {
  it('今天应提醒的习惯会生成 entry', () => {
    const habit = mkHabit({
      name: '冥想',
      reminder: { type: 'absolute', time: '07:00' },
    });

    const entries = getHabitReminderEntries([habit], '2026-04-07');

    expect(entries).toHaveLength(1);
    expect(entries[0].habit.name).toBe('冥想');
    expect(entries[0].reminderTime).toBe(new Date('2026-04-07T07:00:00').getTime());
    expect(entries[0].key).toBe(`habit-habit-1-2026-04-07-${entries[0].reminderTime}`);
  });

  it('今天已达标的习惯不生成 entry', () => {
    const habit = mkHabit({
      name: '早起',
      reminder: { type: 'absolute', time: '07:00' },
      records: [{
        content: '早起',
        date: '2026-04-07',
        docId: 'doc-1',
        blockId: 'record-1',
        habitId: 'habit-1',
      }],
    });

    expect(getHabitReminderEntries([habit], '2026-04-07')).toHaveLength(0);
  });

  it('非打卡日不生成 entry', () => {
    const habit = mkHabit({
      name: '跑步',
      reminder: { type: 'absolute', time: '07:00' },
      frequency: { type: 'weekly_days', daysOfWeek: [5] },
    });

    expect(getHabitReminderEntries([habit], '2026-04-04')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run test/services/habitReminder.test.ts
```

Expected: FAIL because `getHabitReminderEntries` is not exported yet and the old tests still reference `getHabitsNeedingReminder`.

- [ ] **Step 3: Write the minimal helper implementation**

Update `src/services/habitReminder.ts` to this shape:

```ts
import dayjs from '@/utils/dayjs';
import type { Habit, HabitFrequency } from '@/types/models';
import { calculateHabitStats } from '@/utils/habitStatsUtils';

export interface HabitReminderEntry {
  habit: Habit;
  reminderTime: number;
  key: string;
}

export function isCheckInDay(habit: Habit, date: string): boolean {
  // keep existing implementation
}

function isFrequencyDay(frequency: HabitFrequency, startDate: string, date: string): boolean {
  // keep existing implementation
}

export function getHabitReminderTime(habit: Habit, date: string): Date | null {
  // keep existing implementation
}

export function getHabitReminderEntries(
  habits: Habit[],
  currentDate: string
): HabitReminderEntry[] {
  const entries: HabitReminderEntry[] = [];

  for (const habit of habits) {
    if (!isCheckInDay(habit, currentDate)) continue;

    const stats = calculateHabitStats(habit, currentDate);
    if (stats.isPeriodCompleted) continue;

    const reminderTime = getHabitReminderTime(habit, currentDate);
    if (!reminderTime) continue;

    const reminderTimestamp = reminderTime.getTime();
    entries.push({
      habit,
      reminderTime: reminderTimestamp,
      key: `habit-${habit.blockId}-${currentDate}-${reminderTimestamp}`,
    });
  }

  return entries;
}
```

Then remove the obsolete `HabitReminder` interface and `getHabitsNeedingReminder`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run test/services/habitReminder.test.ts
```

Expected: PASS with the new helper tests green.

- [ ] **Step 5: Commit**

```bash
git add src/services/habitReminder.ts test/services/habitReminder.test.ts
git commit -m "refactor(reminder): build habit reminder entries"
```

### Task 2: Add Cron-based habit scheduling to ReminderService

**Files:**
- Modify: `src/services/reminderService.ts`
- Test: `test/services/reminderService.test.ts`

- [ ] **Step 1: Write the failing ReminderService tests for habit scheduling**

Extend `test/services/reminderService.test.ts` with a habit-aware store helper and these cases:

```ts
import type { Habit } from '@/types/models';

function mkHabit(overrides: Partial<Habit> & { name: string }): Habit {
  return {
    docId: 'doc-1',
    blockId: 'habit-1',
    type: 'binary',
    startDate: '2026-04-01',
    records: [],
    frequency: { type: 'daily' },
    ...overrides,
  };
}

function makeStore(items: Item | Item[] = [], habits: Habit[] = []) {
  return {
    currentDate: '2026-04-07',
    getHabits: () => habits,
    projects: [{ tasks: [{ items: Array.isArray(items) ? items : [items] }] }],
  };
}

it('未来习惯提醒应创建独立的 Cron job', () => {
  const habit = mkHabit({
    name: '冥想',
    reminder: { type: 'absolute', time: '07:00' },
  });

  vi.setSystemTime(new Date('2026-04-07T06:00:00'));
  service.start({} as any, makeStore([], [habit]) as any);

  expect((service as any).habitScheduledJobs.size).toBe(1);
});

it('习惯提醒在宽容窗口内应立即补发', () => {
  const habit = mkHabit({
    name: '冥想',
    reminder: { type: 'absolute', time: '07:00' },
  });

  vi.setSystemTime(new Date('2026-04-07T07:03:00'));
  service.start({} as any, makeStore([], [habit]) as any);

  expect(mockShowSystemNotification).toHaveBeenCalledWith(
    expect.stringContaining('🎯'),
    expect.stringContaining('冥想'),
    expect.objectContaining({ tag: 'habit-reminder-habit-1' }),
  );
});

it('习惯提醒时间变化后应删除旧 job 并创建新 job', () => {
  vi.setSystemTime(new Date('2026-04-07T06:00:00'));
  const store = makeStore([], [mkHabit({
    name: '冥想',
    reminder: { type: 'absolute', time: '07:00' },
  })]) as any;

  service.start({} as any, store);
  const oldJobs = new Map((service as any).habitScheduledJobs);

  store.getHabits = () => [mkHabit({
    name: '冥想',
    reminder: { type: 'absolute', time: '08:00' },
  })];
  (service as any).rebuildSchedule();

  const oldJob = Array.from(oldJobs.values())[0];
  expect(oldJob.stop).toHaveBeenCalled();
  expect((service as any).habitScheduledJobs.size).toBe(1);
});
```

Also strengthen the lifecycle test:

```ts
it('启动和停止后应清理所有 job', () => {
  const projectStore = makeStore([], [
    mkHabit({ name: '冥想', reminder: { type: 'absolute', time: '07:00' } }),
  ]) as any;

  vi.setSystemTime(new Date('2026-04-07T06:00:00'));
  service.start({} as any, projectStore);
  service.stop();

  expect((service as any).scheduledJobs.size).toBe(0);
  expect((service as any).habitScheduledJobs.size).toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run test/services/reminderService.test.ts
```

Expected: FAIL because `habitScheduledJobs` does not exist and habit reminders are still fired by `checkHabitReminders()` rather than Cron scheduling.

- [ ] **Step 3: Implement minimal ReminderService changes**

Refactor `src/services/reminderService.ts` along these lines:

```ts
import { Cron } from 'croner';
import type { Plugin } from 'siyuan';
import type { Habit, Item } from '@/types/models';
import { useProjectStore } from '@/stores';
import { calculateReminderTime } from '@/parser/reminderParser';
import { showSystemNotification } from '@/utils/notification';
import { getHabitReminderEntries } from '@/services/habitReminder';

type ProjectStoreType = ReturnType<typeof useProjectStore>;

function makeScheduleKey(item: Item, reminderTime: number): string {
  return `${item.blockId}-${item.date}-${reminderTime}`;
}

const MISSED_THRESHOLD_MS = 5 * 60 * 1000;
const FUTURE_WINDOW_MS = 24 * 60 * 60 * 1000;

export class ReminderService {
  private scheduledJobs: Map<string, Cron> = new Map();
  private habitScheduledJobs: Map<string, Cron> = new Map();
  private notifiedKeys: Set<string> = new Set();
  private projectStore: ProjectStoreType | null = null;
  private rebuildTimer: ReturnType<typeof setTimeout> | null = null;
  private visibilityHandler: (() => void) | null = null;

  private rebuildSchedule(): void {
    if (!this.projectStore) return;

    const now = Date.now();
    const newEntries = new Map<string, { item: Item; reminderTime: number }>();
    const habitNewEntries = new Map<string, { habit: Habit; reminderTime: number }>();

    // keep existing item scan, but use MISSED_THRESHOLD_MS and FUTURE_WINDOW_MS constants

    const habits = typeof this.projectStore.getHabits === 'function'
      ? this.projectStore.getHabits('')
      : [];

    for (const entry of getHabitReminderEntries(habits, this.projectStore.currentDate)) {
      if (entry.reminderTime <= now && (now - entry.reminderTime) <= MISSED_THRESHOLD_MS) {
        if (!this.notifiedKeys.has(entry.key)) {
          this.triggerHabitNotification(entry.habit);
          this.notifiedKeys.add(entry.key);
          this.scheduleCleanup(entry.key);
        }
      } else if (entry.reminderTime <= now) {
        if (!this.notifiedKeys.has(entry.key)) {
          this.notifiedKeys.add(entry.key);
        }
      } else if (entry.reminderTime < now + FUTURE_WINDOW_MS) {
        habitNewEntries.set(entry.key, {
          habit: entry.habit,
          reminderTime: entry.reminderTime,
        });
      }
    }

    // keep existing item diff logic

    for (const [key, job] of this.habitScheduledJobs) {
      if (!habitNewEntries.has(key)) {
        job.stop();
        this.habitScheduledJobs.delete(key);
      }
    }

    for (const [key, { habit, reminderTime }] of habitNewEntries) {
      if (this.habitScheduledJobs.has(key)) continue;

      const job = new Cron(new Date(reminderTime), () => {
        if (!this.notifiedKeys.has(key)) {
          this.triggerHabitNotification(habit);
          this.notifiedKeys.add(key);
          this.scheduleCleanup(key);
        }
        this.habitScheduledJobs.delete(key);
      });

      this.habitScheduledJobs.set(key, job);
    }
  }

  private clearAllJobs(): void {
    for (const [, job] of this.scheduledJobs) {
      job.stop();
    }
    this.scheduledJobs.clear();

    for (const [, job] of this.habitScheduledJobs) {
      job.stop();
    }
    this.habitScheduledJobs.clear();
  }

  private triggerHabitNotification(habit: Habit): void {
    const title = `🎯 ${habit.name}`;
    const body = habit.type === 'count'
      ? `${habit.name} ${habit.target || 0}${habit.unit || ''}`
      : habit.name;

    showSystemNotification(title, body, {
      tag: `habit-reminder-${habit.blockId}`,
      icon: '/plugins/siyuan-plugin-bullet-journal/icon.png',
      onClick: () => {
        this.openBlock(habit.blockId);
      },
    });
  }
}
```

Important implementation notes:

- Delete `checkHabitReminders()`
- Import `Habit` because `triggerHabitNotification` now takes a typed habit
- Keep habit keys in the `habit-...-timestamp` format from Task 1

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run test/services/reminderService.test.ts
```

Expected: PASS with both item reminder tests and new habit scheduling tests green.

- [ ] **Step 5: Commit**

```bash
git add src/services/reminderService.ts test/services/reminderService.test.ts
git commit -m "feat(reminder): schedule habit reminders with croner"
```

### Task 3: Run focused regression coverage for the aligned reminder flow

**Files:**
- Test: `test/services/habitReminder.test.ts`
- Test: `test/services/reminderService.test.ts`

- [ ] **Step 1: Run the focused reminder test suite**

Run:

```bash
npx vitest run test/services/habitReminder.test.ts test/services/reminderService.test.ts
```

Expected: PASS with all habit helper and reminder orchestration tests green.

- [ ] **Step 2: Run the parser/store regression slice that already depends on merged reminder behavior**

Run:

```bash
npx vitest run test/stores/projectStore.test.ts test/parser/core.test.ts
```

Expected: PASS, confirming the reminder refactor did not break habit parsing assumptions or store-level habit access.

- [ ] **Step 3: Review the final diff before closing**

Run:

```bash
git diff -- src/services/habitReminder.ts src/services/reminderService.ts test/services/habitReminder.test.ts test/services/reminderService.test.ts
```

Expected: Diff shows only the helper refactor, habit Cron scheduling, and aligned tests described in the spec.

- [ ] **Step 4: Commit the verification pass if test fixes were needed**

If the verification steps required no further edits, do nothing. If small fixes were required, commit them with:

```bash
git add src/services/habitReminder.ts src/services/reminderService.ts test/services/habitReminder.test.ts test/services/reminderService.test.ts
git commit -m "test(reminder): cover habit croner alignment"
```

## Self-Review

- Spec coverage:
  - Helper role change is covered by Task 1.
  - Habit Cron scheduling, catch-up, cleanup, and reminder-time changes are covered by Task 2.
  - Focused verification across helper, service, parser, and store tests is covered by Task 3.
- Placeholder scan:
  - No `TBD`/`TODO` placeholders remain.
  - Every code-changing step includes concrete code or commands.
- Type consistency:
  - `HabitReminderEntry`, `habitScheduledJobs`, `getHabitReminderEntries`, and `triggerHabitNotification` are named consistently across all tasks.
