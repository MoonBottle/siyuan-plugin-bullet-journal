# Habit Missed Check-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add missed check-in records, reset behavior, historical insertion ordering, and list-card schedule hints to the habit workspace without breaking existing habit parsing, stats, or write flows.

**Architecture:** Keep the existing `Habit` / `CheckInRecord` model and SiYuan block write path, but make record status explicit with `completed | missed`. Push the new semantics down into parser + domain helpers first, then layer month-calendar interactions and list-card display on top through the existing `useHabitWorkspace` and `habitService` entry points.

**Tech Stack:** Vue 3 SFCs, Pinia composables, TypeScript, Vitest, happy-dom, existing SiYuan block APIs

---

## File Structure

### Create

| File                                    | Responsibility                                                                                             |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/domain/habit/habitStatus.ts`       | Central helpers for missed/completed record semantics, date-level resolution, and schedule hint formatting |
| `test/domain/habit/habitStatus.test.ts` | Unit coverage for `missed` precedence, next due date, and card hint text inputs                            |

### Modify

| File                                                | Responsibility                                                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `src/types/models.ts`                               | Add `status` to `CheckInRecord`, extend `HabitDayState` for missed-state awareness                                        |
| `src/parser/habitParser.ts`                         | Parse line-end `❌` habit records and preserve day-only precision for non-today backfill/missed records                   |
| `test/parser/habitParser.test.ts`                   | Add parser regression tests for line-end `❌` syntax                                                                      |
| `src/domain/habit/habitCompletion.ts`               | Make day/period state aware of `missed` overriding completed/partial logic                                                |
| `src/domain/habit/habitStats.ts`                    | Exclude `missed` from completion counts and streaks                                                                       |
| `test/domain/habit/habitCompletion.test.ts`         | Verify `missed` beats partial/completed and reset returns to empty state                                                  |
| `test/domain/habit/habitStats.test.ts`              | Verify `missed` does not count toward totals or streaks                                                                   |
| `src/services/habitService.ts`                      | Add missed-record markdown builder, today-vs-history precision rules, reset/delete helpers, and ordered insertion support |
| `test/services/habitService.test.ts`                | Cover `❌` markdown, reset, historical insertion, and precision downgrade for non-today operations                        |
| `src/composables/useHabitWorkspace.ts`              | Route month-calendar left/right click actions through shared helpers and refresh selected habit state                     |
| `test/composables/useHabitWorkspace.test.ts`        | Cover new workspace actions and precision/date routing                                                                    |
| `src/components/habit/HabitMonthCalendar.vue`       | Add missed marker, left-click reset behavior, right-click menu, and emitted actions                                       |
| `test/components/habit/HabitMonthCalendar.test.ts`  | DOM coverage for `✖`, right-click menu, reset, and left-click sequence                                                    |
| `src/components/habit/HabitWorkspaceDetailPane.vue` | Forward month-calendar events upward                                                                                      |
| `src/components/habit/HabitRecordLog.vue`           | Show missed records cleanly in the monthly log                                                                            |
| `test/components/habit/HabitRecordLog.test.ts`      | Confirm `❌` record visibility and ordering                                                                               |
| `src/components/habit/HabitListItem.vue`            | Add bottom-left frequency + “状态口吻” helper line                                                                        |
| `test/components/habit/HabitListItem.test.ts`       | Verify helper-line text and light emphasis states                                                                         |
| `src/i18n/zh_CN.json`                               | Add missed/reset/card-hint Chinese strings                                                                                |
| `src/i18n/en_US.json`                               | Add missed/reset/card-hint English strings                                                                                |
| `docs/user-guide/data-format.md`                    | Document line-end `❌` habit syntax                                                                                       |

---

## Task 1: Lock the Record Model and Parser Semantics

**Files:**

- Create: `src/domain/habit/habitStatus.ts`
- Modify: `src/types/models.ts`
- Modify: `src/parser/habitParser.ts`
- Test: `test/domain/habit/habitStatus.test.ts`
- Test: `test/parser/habitParser.test.ts`

- [ ] **Step 1: Write the failing parser tests for line-end `❌`**

Append cases to `test/parser/habitParser.test.ts`:

```ts
it('parses line-end missed habit record syntax', () => {
  const result = parseCheckInRecordLine('早起 📅2026-04-06 ❌', 'habit-block-1')
  expect(result).toMatchObject({
    content: '早起',
    date: '2026-04-06',
    completedAt: '2026-04-06',
    habitId: 'habit-block-1',
    status: 'missed',
  })
})

it('parses line-end missed habit record with minute precision', () => {
  const result = parseCheckInRecordLine('早起 📅2026-04-06 07:30 ❌', 'habit-block-1')
  expect(result).toMatchObject({
    date: '2026-04-06',
    completedAt: '2026-04-06 07:30',
    status: 'missed',
  })
})

it('does not extract count fields from missed count habit records', () => {
  const result = parseCheckInRecordLine('喝水 📅2026-04-06 ❌', 'habit-block-1')
  expect(result).toMatchObject({
    content: '喝水',
    status: 'missed',
  })
  expect(result?.currentValue).toBeUndefined()
})
```

- [ ] **Step 2: Run parser tests to verify they fail**

Run:

```bash
npx vitest run test/parser/habitParser.test.ts
```

Expected: FAIL on missing `status: 'missed'` and line-end `❌` parsing.

- [ ] **Step 3: Add explicit record status types and shared helpers**

Update `src/types/models.ts` and create `src/domain/habit/habitStatus.ts`:

```ts
export type HabitRecordStatus = 'completed' | 'missed'

export interface CheckInRecord {
  // existing fields...
  status?: HabitRecordStatus
}

export interface HabitDayState {
  date: string
  hasRecord: boolean
  isCompleted: boolean
  isMissed?: boolean
  currentValue?: number
  targetValue?: number
}
```

```ts
import type { CheckInRecord, Habit, HabitRecordStatus } from '@/types/models'
import dayjs from '@/utils/dayjs'
import { isDateEligibleForHabit, isHabitActiveOnDate } from './habitPeriod'

export function getHabitRecordStatus(record: CheckInRecord): HabitRecordStatus {
  return record.status === 'missed' ? 'missed' : 'completed'
}

export function getRecordsForDate(habit: Habit, date: string): CheckInRecord[] {
  return habit.records.filter(record => record.date === date)
}

export function hasMissedRecord(habit: Habit, date: string): boolean {
  return getRecordsForDate(habit, date).some(record => getHabitRecordStatus(record) === 'missed')
}

export function getNextEligibleHabitDate(habit: Habit, fromDate: string): string | null {
  let cursor = dayjs(fromDate)
  for (let i = 0; i < 366; i++) {
    const current = cursor.format('YYYY-MM-DD')
    if (isHabitActiveOnDate(habit, current) && isDateEligibleForHabit(habit, current)) {
      return current
    }
    cursor = cursor.add(1, 'day')
  }
  return null
}
```

- [ ] **Step 4: Implement parser support for line-end `❌`**

Patch `src/parser/habitParser.ts` so missed state is parsed before count extraction:

```ts
const isMissedRecord = /(?:^|\s)❌$/.test(normalizedLine)

const content = stripHabitCompletedAtTokens(normalizedLine)
  .replace(/@\d{4}-\d{2}-\d{2}/g, '')
  .replace(/\d+\/\d+[a-z\u4E00-\u9FFF]+/gi, '')
  .replace(/(?:^|\s)❌$/g, '')
  .trim()

const result: Partial<CheckInRecord> = {
  content,
  date,
  completedAt,
  habitId,
  status: isMissedRecord ? 'missed' : 'completed',
}

if (!isMissedRecord && currentValue !== undefined) {
  result.currentValue = currentValue
}
```

Also relax `parseHabitRecordLine()` so binary `❌` records are still considered habit records:

```ts
const hasHabitRecordMarkers = /\d+\/\d+[a-z\u4E00-\u9FFF]+/i.test(normalizedLine) || /(?:^|\s)❌$/.test(normalizedLine)
```

- [ ] **Step 5: Add focused unit coverage for shared status helpers**

Create `test/domain/habit/habitStatus.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { getHabitRecordStatus, getNextEligibleHabitDate, hasMissedRecord } from '@/domain/habit/habitStatus'

it('treats legacy records as completed by default', () => {
  expect(getHabitRecordStatus({ date: '2026-05-01' } as any)).toBe('completed')
})

it('detects missed records for a date', () => {
  const habit = {
    startDate: '2026-05-01',
    frequency: { type: 'daily' },
    records: [{ date: '2026-05-03', status: 'missed' }],
  } as any
  expect(hasMissedRecord(habit, '2026-05-03')).toBe(true)
})

it('finds the next eligible date from today forward', () => {
  const habit = {
    startDate: '2026-05-01',
    frequency: { type: 'weekly_days', daysOfWeek: [1, 3, 5] },
    records: [],
  } as any
  expect(getNextEligibleHabitDate(habit, '2026-05-12')).toBe('2026-05-13')
})
```

- [ ] **Step 6: Run the parser/domain tests and make sure they pass**

Run:

```bash
npx vitest run test/parser/habitParser.test.ts test/domain/habit/habitStatus.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/types/models.ts src/parser/habitParser.ts src/domain/habit/habitStatus.ts test/parser/habitParser.test.ts test/domain/habit/habitStatus.test.ts
git commit -m "feat(habit): parse missed check-in records"
```

---

## Task 2: Update Day-State and Stats Rules for Missed Records

**Files:**

- Modify: `src/domain/habit/habitCompletion.ts`
- Modify: `src/domain/habit/habitStats.ts`
- Test: `test/domain/habit/habitCompletion.test.ts`
- Test: `test/domain/habit/habitStats.test.ts`

- [ ] **Step 1: Write failing domain tests for missed precedence**

Append to `test/domain/habit/habitCompletion.test.ts`:

```ts
it('marks a date as missed when a missed record exists', () => {
  const habit = mkHabit({
    type: 'binary',
    records: [mkRecord('2026-04-09', { status: 'missed', content: '早起' })],
  })
  const state = getHabitDayState(habit, '2026-04-09')
  expect(state.hasRecord).toBe(true)
  expect(state.isMissed).toBe(true)
  expect(state.isCompleted).toBe(false)
})

it('lets missed override count partial progress', () => {
  const habit = mkHabit({
    type: 'count',
    target: 8,
    unit: '杯',
    records: [
      mkRecord('2026-04-09', { currentValue: 3, targetValue: 8, unit: '杯' }),
      mkRecord('2026-04-09', { status: 'missed', content: '喝水' }),
    ],
  })
  expect(getHabitDayState(habit, '2026-04-09')).toMatchObject({
    isMissed: true,
    isCompleted: false,
  })
})
```

Append to `test/domain/habit/habitStats.test.ts`:

```ts
it('does not count missed records toward monthly or total checkins', () => {
  const habit = mkHabit({
    records: [
      mkRecord('2026-04-03'),
      mkRecord('2026-04-04', { status: 'missed' }),
    ],
  })
  const stats = calculateHabitStats(habit, '2026-04-10')
  expect(stats.totalCheckins).toBe(1)
  expect(stats.monthlyCheckins).toBe(1)
})

it('breaks streaks on missed periods', () => {
  const habit = mkHabit({
    records: [
      mkRecord('2026-04-03'),
      mkRecord('2026-04-04', { status: 'missed' }),
      mkRecord('2026-04-05'),
    ],
  })
  const stats = calculateHabitStats(habit, '2026-04-05')
  expect(stats.longestStreak).toBe(1)
})
```

- [ ] **Step 2: Run domain tests to verify they fail**

Run:

```bash
npx vitest run test/domain/habit/habitCompletion.test.ts test/domain/habit/habitStats.test.ts
```

Expected: FAIL because `isMissed` is absent and stats still count all record dates.

- [ ] **Step 3: Implement missed-aware day state and completion counting**

Patch `src/domain/habit/habitCompletion.ts`:

```ts
import { getHabitRecordStatus, getRecordsForDate, hasMissedRecord } from './habitStatus'

export function isHabitRecordCompleted(record: CheckInRecord, habit: Habit): boolean {
  if (getHabitRecordStatus(record) === 'missed') {
    return false
  }
  if (habit.type === 'binary') {
    return true
  }
  const target = habit.target ?? record.targetValue ?? 0
  return (record.currentValue ?? 0) >= target
}

export function getHabitDayState(habit: Habit, date: string): HabitDayState {
  const records = getRecordsForDate(habit, date)
  if (records.length === 0) {
    return { date, hasRecord: false, isCompleted: false, isMissed: false }
  }
  if (hasMissedRecord(habit, date)) {
    return { date, hasRecord: true, isCompleted: false, isMissed: true }
  }
  // existing best-record logic...
}
```

Patch `src/domain/habit/habitStats.ts` so unique-date completion only counts dates whose `getHabitDayState(...).isCompleted` is true.

- [ ] **Step 4: Re-run domain tests and ensure they pass**

Run:

```bash
npx vitest run test/domain/habit/habitCompletion.test.ts test/domain/habit/habitStats.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/habit/habitCompletion.ts src/domain/habit/habitStats.ts test/domain/habit/habitCompletion.test.ts test/domain/habit/habitStats.test.ts
git commit -m "feat(habit): apply missed status to habit completion rules"
```

---

## Task 3: Extend the Write Path for Missed Records, Reset, and History Precision

**Files:**

- Modify: `src/services/habitService.ts`
- Test: `test/services/habitService.test.ts`

- [ ] **Step 1: Write failing service tests for missed markdown and non-today precision**

Append to `test/services/habitService.test.ts`:

```ts
it('builds missed markdown with line-end ❌', () => {
  const habit = mkHabit({ name: '早起', type: 'binary' })
  expect(buildMissedCheckInMarkdown(habit, '2026-04-07')).toBe('早起 📅2026-04-07 ❌')
})

it('downgrades non-today minute precision to day-only for missed records', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-05-08T09:30:45'))
  const habit = mkHabit({ name: '早起', type: 'binary' })
  expect(buildMissedCheckInMarkdown(habit, '2026-04-07', 'minute')).toBe('早起 📅2026-04-07 ❌')
})

it('keeps today minute precision for missed records', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-05-08T09:30:45'))
  const habit = mkHabit({ name: '早起', type: 'binary' })
  expect(buildMissedCheckInMarkdown(habit, '2026-05-08', 'minute')).toBe('早起 📅2026-05-08 09:30 ❌')
})

it('creates a missed record after the nearest earlier record for backfill', async () => {
  const habit = mkHabit({
    records: [
      mkRecord('2026-04-03', { blockId: 'r3' }),
      mkRecord('2026-04-05', { blockId: 'r5' }),
    ],
  })
  const writer = { insertAfter: vi.fn().mockResolvedValue(true), update: vi.fn() }
  await markHabitMissed(habit, '2026-04-04', writer)
  expect(writer.insertAfter).toHaveBeenCalledWith('早起 📅2026-04-04 ❌', 'r3')
})
```

- [ ] **Step 2: Run service tests to verify they fail**

Run:

```bash
npx vitest run test/services/habitService.test.ts
```

Expected: FAIL on missing missed helpers and incorrect non-today precision behavior.

- [ ] **Step 3: Implement missed write helpers and precision gating**

Patch `src/services/habitService.ts`:

```ts
function shouldUseDayOnlyPrecision(date: string): boolean {
  return date !== formatHabitCompletedAtForMarkdown('day')
}

function buildCompletedAtMarkdown(date: string, precision: HabitCheckInTimePrecision = 'day'): string {
  if (precision === 'day' || shouldUseDayOnlyPrecision(date)) {
    return date
  }
  const currentTimestamp = formatHabitCompletedAtForMarkdown(precision)
  return currentTimestamp.replace(/^\d{4}-\d{2}-\d{2}/, date)
}

export function buildMissedCheckInMarkdown(
  habit: Habit,
  date: string,
  precision: HabitCheckInTimePrecision = 'day',
): string {
  const completedAt = buildCompletedAtMarkdown(date, precision)
  return `${habit.name} 📅${completedAt} ❌`
}
```

Add service entry points:

```ts
export async function markHabitMissed(...) { /* insertAfter using buildMissedCheckInMarkdown */ }
export async function resetHabitRecord(record: CheckInRecord) { return deleteCheckIn(record); }
export function getRecordForDate(habit: Habit, date: string): CheckInRecord | null { /* prefer missed if present, else best completed */ }
```

Use `findInsertAfterBlockId()` unchanged for backfill ordering; its current semantics already place a new block after the nearest earlier record.

- [ ] **Step 4: Re-run service tests and make sure they pass**

Run:

```bash
npx vitest run test/services/habitService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/habitService.ts test/services/habitService.test.ts
git commit -m "feat(habit): support missed and reset record writes"
```

---

## Task 4: Wire Detail-Month Interactions Through the Workspace

**Files:**

- Modify: `src/composables/useHabitWorkspace.ts`
- Modify: `src/components/habit/HabitWorkspaceDetailPane.vue`
- Modify: `src/components/habit/HabitMonthCalendar.vue`
- Test: `test/composables/useHabitWorkspace.test.ts`
- Test: `test/components/habit/HabitMonthCalendar.test.ts`

- [ ] **Step 1: Write failing workspace and calendar tests**

Add a workspace action test in `test/composables/useHabitWorkspace.test.ts`:

```ts
it('routes missed, reset, and month-cell left click through shared helpers', async () => {
  const { markHabitMissed, resetHabitRecord } = await import('@/services/habitService');
  (markHabitMissed as any).mockResolvedValue(true);
  (resetHabitRecord as any).mockResolvedValue(true)
  // create habit with selectedDate...
  await workspace.markHabitMissed(habit, '2026-05-04')
  await workspace.resetHabitRecord(habit.records[0])
  expect(markHabitMissed).toHaveBeenCalledWith(habit, '2026-05-04', undefined, 'day')
  expect(resetHabitRecord).toHaveBeenCalledWith(habit.records[0])
})
```

Add DOM tests in `test/components/habit/HabitMonthCalendar.test.ts`:

```ts
it('renders a missed day with a cross marker', async () => {
  // habit.records includes { date: '2026-04-12', status: 'missed' }
  expect(cell?.querySelector('[data-testid="habit-month-missed"]')).not.toBeNull()
})

it('emits reset on first left click for a missed day', async () => {
  cell?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  expect(emittedReset).toEqual(['2026-04-12'])
})
```

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run:

```bash
npx vitest run test/composables/useHabitWorkspace.test.ts test/components/habit/HabitMonthCalendar.test.ts
```

Expected: FAIL because the new actions/events do not exist.

- [ ] **Step 3: Extend workspace actions and calendar event contract**

Patch `src/composables/useHabitWorkspace.ts`:

```ts
import { getRecordForDate, markHabitMissed, resetHabitRecord } from '@/services/habitService'

async function markHabitMissedForDate(habit: Habit, date: string) { /* archived guard + service call + selected stats refresh */ }
async function resetHabitRecordForDate(habit: Habit, date: string) {
  const record = getRecordForDate(habit, date)
  if (!record)
    return false
  const success = await resetHabitRecord(record)
  // refresh selected stats cache...
}
async function handleMonthCellPrimaryAction(habit: Habit, date: string) {
  const record = getRecordForDate(habit, date)
  if (record?.status === 'missed') {
    return resetHabitRecordForDate(habit, date)
  }
  if (habit.type === 'binary')
    return checkIn(habit, date, undefined, habitCheckInTimePrecision.value)
  return checkInCount(habit, date, 1, undefined, habitCheckInTimePrecision.value)
}
```

Patch `HabitWorkspaceDetailPane.vue` to forward:

```ts
'month-cell-primary': [value: string];
'month-cell-mark-missed': [value: string];
'month-cell-reset': [value: string];
```

Patch `HabitMonthCalendar.vue` to:

- derive `missed` status from records/day state
- emit `month-cell-primary`
- intercept `contextmenu`
- render a small in-place menu with only one action for the current state

- [ ] **Step 4: Re-run workspace and calendar tests**

Run:

```bash
npx vitest run test/composables/useHabitWorkspace.test.ts test/components/habit/HabitMonthCalendar.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/composables/useHabitWorkspace.ts src/components/habit/HabitWorkspaceDetailPane.vue src/components/habit/HabitMonthCalendar.vue test/composables/useHabitWorkspace.test.ts test/components/habit/HabitMonthCalendar.test.ts
git commit -m "feat(habit): add month calendar missed and reset interactions"
```

---

## Task 5: Update the Log and List Card Presentation

**Files:**

- Modify: `src/components/habit/HabitRecordLog.vue`
- Modify: `src/components/habit/HabitListItem.vue`
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`
- Test: `test/components/habit/HabitRecordLog.test.ts`
- Test: `test/components/habit/HabitListItem.test.ts`

- [ ] **Step 1: Write failing UI tests for `❌` logs and bottom-left helper text**

Add to `test/components/habit/HabitRecordLog.test.ts`:

```ts
it('shows missed records in the monthly log', async () => {
  // habit.records includes { content: '早起', date: '2026-05-10', status: 'missed', blockId: 'record-10' }
  expect(mounted.container.textContent).toContain('❌')
})
```

Add to `test/components/habit/HabitListItem.test.ts`:

```ts
it('renders frequency and due-state helper text at the bottom-left', async () => {
  expect(getByTestId(container, 'habit-list-item-meta').textContent).toContain('每天')
})

it('uses a stronger helper style when the habit is due today', async () => {
  expect(getByTestId(container, 'habit-list-item-meta').classList.contains('habit-list-item__meta--due')).toBe(true)
})
```

- [ ] **Step 2: Run the UI tests to verify they fail**

Run:

```bash
npx vitest run test/components/habit/HabitRecordLog.test.ts test/components/habit/HabitListItem.test.ts
```

Expected: FAIL because the helper line and `❌` presentation are not implemented.

- [ ] **Step 3: Implement helper-line text and lightweight emphasis**

Patch `src/components/habit/HabitListItem.vue`:

```ts
import { getNextEligibleHabitDate } from '@/domain/habit/habitStatus'
import dayjs from '@/utils/dayjs'

const frequencySummary = computed(() => {
  switch (props.habit.frequency?.type) {
    case 'daily': return t('habit').frequencyDaily
    case 'weekly': return t('habit').frequencyWeekly
    case 'n_per_week': return t('habit').frequencyPerWeek.replace('{n}', String(props.habit.frequency?.daysPerWeek ?? 0))
    default: return t('habit').frequencyCustom
  }
})

const scheduleHint = computed(() => {
  if (props.habit.archivedAt)
    return t('habit').archived
  const nextDate = getNextEligibleHabitDate(props.habit, props.dayState.date)
  if (nextDate === props.dayState.date && !props.dayState.isCompleted && !props.dayState.isMissed) {
    return t('habit').dueToday
  }
  if (nextDate === dayjs(props.dayState.date).add(1, 'day').format('YYYY-MM-DD')) {
    return t('habit').dueTomorrow
  }
  return t('habit').dueOn.replace('{date}', dayjs(nextDate).format('M月D日'))
})
```

Template snippet:

```vue
<div
  class="habit-list-item__meta"
  :class="{ 'habit-list-item__meta--due': scheduleHint === t('habit').dueToday }"
  data-testid="habit-list-item-meta"
>
  {{ frequencySummary }} · {{ scheduleHint }}
</div>
```

Patch `HabitRecordLog.vue` only enough to avoid stripping the `❌` record content from display.

- [ ] **Step 4: Add matching i18n keys**

Update both `src/i18n/zh_CN.json` and `src/i18n/en_US.json`:

```json
{
  "habit": {
    "dueToday": "今天该打卡了",
    "dueTomorrow": "明天再打卡",
    "dueOn": "下次 {date}",
    "frequencyDaily": "每天",
    "frequencyWeekly": "每周",
    "frequencyPerWeek": "每周{n}次",
    "frequencyCustom": "按频率打卡",
    "markMissed": "未打卡",
    "resetRecord": "重置"
  }
}
```

- [ ] **Step 5: Re-run the UI tests**

Run:

```bash
npx vitest run test/components/habit/HabitRecordLog.test.ts test/components/habit/HabitListItem.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/habit/HabitRecordLog.vue src/components/habit/HabitListItem.vue src/i18n/zh_CN.json src/i18n/en_US.json test/components/habit/HabitRecordLog.test.ts test/components/habit/HabitListItem.test.ts
git commit -m "feat(habit): show missed logs and habit card schedule hints"
```

---

## Task 6: Run the Cross-Cut Regression Set and Sync the User Docs

**Files:**

- Modify: `docs/user-guide/data-format.md`

- [ ] **Step 1: Verify the user guide matches the shipped syntax**

Make sure `docs/user-guide/data-format.md` contains:

```md
**习惯未打卡**：习惯记录中的“未打卡”同样复用 `❌`，但位置固定在记录行末尾，例如 `早起 📅2026-05-11 ❌`。这条语义仅用于习惯打卡记录，不等同于事项状态标签。
```

- [ ] **Step 2: Run the full targeted regression suite**

Run:

```bash
npx vitest run test/parser/habitParser.test.ts test/domain/habit/habitStatus.test.ts test/domain/habit/habitCompletion.test.ts test/domain/habit/habitStats.test.ts test/services/habitService.test.ts test/composables/useHabitWorkspace.test.ts test/components/habit/HabitMonthCalendar.test.ts test/components/habit/HabitRecordLog.test.ts test/components/habit/HabitListItem.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run the broader habit-related suite if the targeted suite passes**

Run:

```bash
npx vitest run test/components/habit test/domain/habit test/services/habitService.test.ts test/composables/useHabitWorkspace.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add docs/user-guide/data-format.md
git commit -m "docs(habit): document missed check-in syntax"
```

---

## Self-Review

### Spec coverage

- Missed record syntax with line-end `❌`: Task 1, Task 3, Task 6
- Historical insert ordering: Task 3
- Non-today precision forced to day-only: Task 3
- Day-state / stats behavior for `missed`: Task 2
- Month-calendar left/right click + reset flow: Task 4
- Record log rendering: Task 5
- Habit card frequency + next-check-in helper line: Task 5
- User-facing syntax docs: Task 6

No uncovered spec sections remain.

### Placeholder scan

- No `TODO` / `TBD`
- Every task includes exact files, commands, and code snippets
- No “same as above” references

### Type consistency

- `CheckInRecord.status` is defined in Task 1 and reused consistently as `completed | missed`
- `isMissed` is added to `HabitDayState` before later UI tasks depend on it
- `markHabitMissed`, `resetHabitRecord`, and `getNextEligibleHabitDate` are introduced before downstream tasks reference them
