# Habit Ebbinghaus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `🔄艾宾浩斯` / `🔄ebbinghaus` as a first-class habit frequency type with derived stage scheduling, overdue awareness, and conservative stats behavior.

**Architecture:** Keep markdown as the source of truth and extend the existing `HabitFrequency` union with an `ebbinghaus` variant. Implement the new behavior from the inside out: parser and frequency serialization first, then domain scheduling helpers and stats, then surface the derived state in existing habit UI components and user docs.

**Tech Stack:** TypeScript, Vue 3 SFCs, Pinia composables, Vitest, happy-dom, existing SiYuan plugin parser/domain/UI structure

---

## File Structure

### Create

| File                                        | Responsibility                                                                                      |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `test/domain/habit/habitEbbinghaus.test.ts` | Focused unit coverage for stage derivation, next due date, overdue days, and final-interval looping |

### Modify

| File                                                     | Responsibility                                                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/types/models.ts`                                    | Extend `HabitFrequency`, `HabitDayState`, and `HabitPeriodState` with Ebbinghaus-facing fields               |
| `src/parser/habitParser.ts`                              | Parse/serialize `🔄艾宾浩斯` and custom interval syntax                                                      |
| `test/parser/habitParser.test.ts`                        | Parser regressions for Chinese/English Ebbinghaus syntax and malformed templates                             |
| `src/domain/habit/habitPeriod.ts`                        | Normalize interval templates, derive stage/next due date/overdue days, and integrate with period eligibility |
| `src/domain/habit/habitCompletion.ts`                    | Surface due/overdue/not-needed day-state semantics for Ebbinghaus                                            |
| `test/domain/habit/habitPeriod.test.ts`                  | Verify `getHabitPeriod()` and `isDateEligibleForHabit()` behavior for Ebbinghaus                             |
| `test/domain/habit/habitCompletion.test.ts`              | Verify day/period state for due, overdue, completed, and backfilled records                                  |
| `src/domain/habit/habitStats.ts`                         | Adjust completion-rate denominator and streak behavior for Ebbinghaus                                        |
| `test/domain/habit/habitStats.test.ts`                   | Verify expected-count math and conservative streak handling                                                  |
| `src/components/dialog/HabitCreateDialog.vue`            | Add Ebbinghaus frequency option and optional custom interval input                                           |
| `test/components/dialog/HabitCreateDialog.test.ts`       | Verify create/edit markdown generation and validation                                                        |
| `src/components/habit/HabitListItem.vue`                 | Show `艾宾浩斯` frequency summary and derived schedule hint                                                  |
| `test/components/habit/HabitListItem.test.ts`            | Verify stage/due/overdue text rendering                                                                      |
| `src/components/habit/HabitWorkspaceDetailPane.vue`      | Show current stage, current interval, next due date, and overdue days                                        |
| `test/components/habit/HabitWorkspaceDetailPane.test.ts` | Verify detail metadata rendering                                                                             |
| `src/i18n/zh_CN.json`                                    | Add Chinese labels for Ebbinghaus option, stage text, and overdue hints                                      |
| `src/i18n/en_US.json`                                    | Add English labels for Ebbinghaus option, stage text, and overdue hints                                      |
| `docs/user-guide/data-format.md`                         | Document new frequency syntax and examples                                                                   |
| `docs/user-guide/habit-checkin.md`                       | Document stage progression and missed-date behavior                                                          |

---

## Task 1: Add Ebbinghaus Syntax to the Habit Model and Parser

**Files:**

- Modify: `src/types/models.ts`
- Modify: `src/parser/habitParser.ts`
- Test: `test/parser/habitParser.test.ts`

- [ ] **Step 1: Write the failing parser tests for Chinese and English syntax**

Append these cases to `test/parser/habitParser.test.ts`:

```ts
it('parses default ebbinghaus habit frequency', () => {
  expect(parseHabitFrequency('艾宾浩斯')).toEqual({
    type: 'ebbinghaus',
  })
})

it('parses custom ebbinghaus intervals', () => {
  expect(parseHabitFrequency('艾宾浩斯[1,2,4,7,15]')).toEqual({
    type: 'ebbinghaus',
    intervals: [1, 2, 4, 7, 15],
  })
})

it('parses english ebbinghaus syntax', () => {
  expect(parseHabitFrequency('ebbinghaus[1,2,4,7,15]')).toEqual({
    type: 'ebbinghaus',
    intervals: [1, 2, 4, 7, 15],
  })
})

it('rejects malformed ebbinghaus intervals', () => {
  expect(parseHabitFrequency('艾宾浩斯[1,2,2]')).toBeNull()
  expect(parseHabitFrequency('艾宾浩斯[0,2,4]')).toBeNull()
  expect(parseHabitFrequency('艾宾浩斯[a,2,4]')).toBeNull()
})

it('serializes ebbinghaus frequency back to markdown', () => {
  expect(buildHabitDefinitionMarkdown({
    name: '英语单词',
    startDate: '2026-05-14',
    type: 'binary',
    frequency: { type: 'ebbinghaus', intervals: [1, 2, 4, 7, 15] },
  })).toBe('英语单词 🎯2026-05-14 🔄艾宾浩斯[1,2,4,7,15]')
})
```

- [ ] **Step 2: Run the parser test file and confirm the new cases fail**

Run:

```bash
npx vitest run test/parser/habitParser.test.ts
```

Expected: FAIL because `parseHabitFrequency()` and `buildHabitDefinitionMarkdown()` do not recognize `ebbinghaus`.

- [ ] **Step 3: Extend `HabitFrequency` and state types with the new variant**

Update `src/types/models.ts`:

```ts
export interface HabitFrequency {
  type: 'daily' | 'every_n_days' | 'weekly' | 'n_per_week' | 'weekly_days' | 'ebbinghaus'
  interval?: number
  daysPerWeek?: number
  daysOfWeek?: number[]
  intervals?: number[]
}

export interface HabitDayState {
  date: string
  hasRecord: boolean
  isCompleted: boolean
  isMissed?: boolean
  isDue?: boolean
  isOverdue?: boolean
  overdueDays?: number
  nextDueDate?: string
  currentStageIndex?: number
  currentIntervalDays?: number
  currentValue?: number
  targetValue?: number
}

export interface HabitPeriodState {
  periodType: 'day' | 'interval' | 'week'
  periodStart: string
  periodEnd: string
  requiredCount: number
  completedCount: number
  remainingCount: number
  isCompleted: boolean
  eligibleToday: boolean
  nextDueDate?: string
  currentStageIndex?: number
  currentIntervalDays?: number
  overdueDays?: number
}
```

- [ ] **Step 4: Implement parser support for default and custom Ebbinghaus syntax**

Patch `src/parser/habitParser.ts` with a template parser and serializer branch:

```ts
function parseEbbinghausIntervals(raw?: string): number[] | null {
  if (!raw) {
    return null
  }

  const values = raw.split(',').map(part => Number.parseInt(part.trim(), 10))
  if (values.length === 0 || values.some(value => !Number.isInteger(value) || value <= 0)) {
    return null
  }

  for (let i = 1; i < values.length; i++) {
    if (values[i] <= values[i - 1]) {
      return null
    }
  }

  return values
}

const ebbinghausMatch = str.match(/^(?:艾宾浩斯|ebbinghaus)(?:\[(.+)\])?$/i)
if (ebbinghausMatch) {
  const intervals = parseEbbinghausIntervals(ebbinghausMatch[1])
  if (ebbinghausMatch[1] && !intervals) {
    return null
  }
  return intervals ? { type: 'ebbinghaus', intervals } : { type: 'ebbinghaus' }
}
```

And in `frequencyToMarkdown()`:

```ts
if (frequency.type === 'ebbinghaus') {
  if (frequency.intervals?.length) {
    return `艾宾浩斯[${frequency.intervals.join(',')}]`
  }
  return '艾宾浩斯'
}
```

- [ ] **Step 5: Re-run the parser tests and verify they pass**

Run:

```bash
npx vitest run test/parser/habitParser.test.ts
```

Expected: PASS including the new Ebbinghaus cases.

- [ ] **Step 6: Commit the parser/model slice**

Run:

```bash
git add src/types/models.ts src/parser/habitParser.ts test/parser/habitParser.test.ts
git commit -m "feat(habit): parse ebbinghaus frequency"
```

---

## Task 2: Implement Derived Ebbinghaus Scheduling in the Domain Layer

**Files:**

- Modify: `src/domain/habit/habitPeriod.ts`
- Modify: `src/domain/habit/habitCompletion.ts`
- Create: `test/domain/habit/habitEbbinghaus.test.ts`
- Modify: `test/domain/habit/habitPeriod.test.ts`
- Modify: `test/domain/habit/habitCompletion.test.ts`

- [ ] **Step 1: Write failing unit tests for stage derivation and day-state semantics**

Create `test/domain/habit/habitEbbinghaus.test.ts`:

```ts
import type { Habit } from '@/types/models'
import { describe, expect, it } from 'vitest'
import { getEbbinghausScheduleState } from '@/domain/habit/habitPeriod'

function mkHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    name: '英语单词',
    docId: 'doc-1',
    blockId: 'habit-1',
    type: 'binary',
    startDate: '2026-05-14',
    records: [],
    frequency: { type: 'ebbinghaus', intervals: [1, 2, 4, 7, 15] },
    ...overrides,
  }
}

describe('getEbbinghausScheduleState', () => {
  it('returns first due date after first completion', () => {
    const state = getEbbinghausScheduleState(mkHabit({
      records: [{ date: '2026-05-14', content: '英语单词' } as any],
    }), '2026-05-15')

    expect(state.currentStageIndex).toBe(0)
    expect(state.currentIntervalDays).toBe(1)
    expect(state.nextDueDate).toBe('2026-05-15')
    expect(state.isDue).toBe(true)
  })

  it('keeps the final interval once the last stage is reached', () => {
    const state = getEbbinghausScheduleState(mkHabit({
      records: [
        { date: '2026-05-14', content: '英语单词' },
        { date: '2026-05-15', content: '英语单词' },
        { date: '2026-05-17', content: '英语单词' },
        { date: '2026-05-21', content: '英语单词' },
        { date: '2026-05-28', content: '英语单词' },
      ] as any,
    }), '2026-06-12')

    expect(state.currentStageIndex).toBe(4)
    expect(state.currentIntervalDays).toBe(15)
    expect(state.nextDueDate).toBe('2026-06-12')
  })

  it('stays overdue on the current stage until make-up completion', () => {
    const state = getEbbinghausScheduleState(mkHabit({
      records: [{ date: '2026-05-14', content: '英语单词' } as any],
    }), '2026-05-18')

    expect(state.nextDueDate).toBe('2026-05-15')
    expect(state.isDue).toBe(true)
    expect(state.isOverdue).toBe(true)
    expect(state.overdueDays).toBe(3)
  })
})
```

Append these cases to `test/domain/habit/habitCompletion.test.ts`:

```ts
it('marks ebbinghaus date as not needed before the next due date', () => {
  const state = getHabitDayState(mkHabit({
    frequency: { type: 'ebbinghaus', intervals: [1, 2, 4, 7, 15] },
    records: [{ date: '2026-05-14', content: '英语单词' } as any],
  }), '2026-05-14')

  expect(state.isDue).toBe(false)
  expect(state.nextDueDate).toBe('2026-05-15')
})
```

- [ ] **Step 2: Run the domain tests and confirm they fail**

Run:

```bash
npx vitest run test/domain/habit/habitPeriod.test.ts test/domain/habit/habitCompletion.test.ts test/domain/habit/habitEbbinghaus.test.ts
```

Expected: FAIL because `getEbbinghausScheduleState()` does not exist and Ebbinghaus semantics are not wired into `getHabitDayState()`.

- [ ] **Step 3: Add explicit Ebbinghaus helper functions to `habitPeriod.ts`**

Implement the helpers in `src/domain/habit/habitPeriod.ts`:

```ts
const DEFAULT_EBBINGHAUS_INTERVALS = [1, 2, 4, 7, 15]

export function getEbbinghausIntervals(frequency?: HabitFrequency): number[] {
  if (frequency?.type !== 'ebbinghaus') {
    return DEFAULT_EBBINGHAUS_INTERVALS
  }

  const values = frequency.intervals?.filter(value => Number.isInteger(value) && value > 0) ?? []
  if (values.length === 0) {
    return DEFAULT_EBBINGHAUS_INTERVALS
  }

  return values
}

export function getEbbinghausScheduleState(habit: Habit, date: string) {
  const intervals = getEbbinghausIntervals(habit.frequency)
  const completedRecords = habit.records
    .filter(record => getHabitRecordStatus(record) !== 'missed')
    .sort((a, b) => a.date.localeCompare(b.date))

  if (completedRecords.length === 0) {
    return {
      currentStageIndex: -1,
      currentIntervalDays: intervals[0],
      nextDueDate: habit.startDate,
      isDue: date >= habit.startDate,
      isOverdue: date > habit.startDate,
      overdueDays: Math.max(dayjs(date).diff(dayjs(habit.startDate), 'day'), 0),
    }
  }

  const currentStageIndex = Math.min(completedRecords.length - 1, intervals.length - 1)
  const nextIntervalIndex = Math.min(completedRecords.length, intervals.length - 1)
  const lastCompletedDate = completedRecords.at(-1)!.date
  const nextDueDate = dayjs(lastCompletedDate).add(intervals[nextIntervalIndex], 'day').format('YYYY-MM-DD')
  const overdueDays = Math.max(dayjs(date).diff(dayjs(nextDueDate), 'day'), 0)

  return {
    currentStageIndex,
    currentIntervalDays: intervals[currentStageIndex],
    nextDueDate,
    isDue: date >= nextDueDate,
    isOverdue: date > nextDueDate,
    overdueDays,
  }
}
```

Also integrate it into `isDateEligibleForHabit()` and `getHabitPeriod()`:

```ts
case 'ebbinghaus': {
  return getEbbinghausScheduleState(habit, date).isDue;
}
```

```ts
if (frequency.type === 'ebbinghaus') {
  return {
    periodType: 'day',
    periodStart: date,
    periodEnd: date,
    requiredCount: getEbbinghausScheduleState(habit, date).isDue ? 1 : 0,
  }
}
```

- [ ] **Step 4: Surface the derived fields through `getHabitDayState()` and `getHabitPeriodState()`**

Patch `src/domain/habit/habitCompletion.ts`:

```ts
const ebbinghausState = habit.frequency?.type === 'ebbinghaus'
  ? getEbbinghausScheduleState(habit, date)
  : null

if (records.length === 0) {
  return {
    date,
    hasRecord: false,
    isCompleted: false,
    isMissed: false,
    isDue: ebbinghausState?.isDue ?? false,
    isOverdue: ebbinghausState?.isOverdue ?? false,
    overdueDays: ebbinghausState?.overdueDays,
    nextDueDate: ebbinghausState?.nextDueDate,
    currentStageIndex: ebbinghausState?.currentStageIndex,
    currentIntervalDays: ebbinghausState?.currentIntervalDays,
  }
}
```

And in `getHabitPeriodState()`:

```ts
const ebbinghausState = habit.frequency?.type === 'ebbinghaus'
  ? getEbbinghausScheduleState(habit, date)
  : null

return {
  ...period,
  completedCount: normalizedCompletedCount,
  remainingCount: Math.max(requiredCount - normalizedCompletedCount, 0),
  isCompleted: normalizedCompletedCount >= requiredCount,
  eligibleToday: habit.frequency?.type === 'ebbinghaus'
    ? Boolean(ebbinghausState?.isDue)
    : isDateEligibleForHabit(habit, date),
  nextDueDate: ebbinghausState?.nextDueDate,
  currentStageIndex: ebbinghausState?.currentStageIndex,
  currentIntervalDays: ebbinghausState?.currentIntervalDays,
  overdueDays: ebbinghausState?.overdueDays,
}
```

- [ ] **Step 5: Re-run the domain tests and verify they pass**

Run:

```bash
npx vitest run test/domain/habit/habitPeriod.test.ts test/domain/habit/habitCompletion.test.ts test/domain/habit/habitEbbinghaus.test.ts
```

Expected: PASS with due, overdue, and final-stage looping covered.

- [ ] **Step 6: Commit the domain scheduling slice**

Run:

```bash
git add src/domain/habit/habitPeriod.ts src/domain/habit/habitCompletion.ts test/domain/habit/habitPeriod.test.ts test/domain/habit/habitCompletion.test.ts test/domain/habit/habitEbbinghaus.test.ts
git commit -m "feat(habit): derive ebbinghaus schedule state"
```

---

## Task 3: Adjust Stats for Ebbinghaus Completion Windows

**Files:**

- Modify: `src/domain/habit/habitStats.ts`
- Modify: `test/domain/habit/habitStats.test.ts`

- [ ] **Step 1: Write failing stats tests for denominator and streak behavior**

Append to `test/domain/habit/habitStats.test.ts`:

```ts
it('uses due review count instead of active days for ebbinghaus completion rate', () => {
  const habit = mkHabit({
    startDate: '2026-05-14',
    frequency: { type: 'ebbinghaus', intervals: [1, 2, 4, 7, 15] },
    records: [
      { date: '2026-05-14', content: '英语单词' },
      { date: '2026-05-15', content: '英语单词' },
    ] as any,
  })

  const stats = calculateHabitStats(habit, '2026-05-20')
  expect(stats.totalCheckins).toBe(2)
  expect(stats.completionRate).toBeCloseTo(2 / 3, 5)
})

it('returns zero streaks for ebbinghaus habits in the first release', () => {
  const habit = mkHabit({
    frequency: { type: 'ebbinghaus', intervals: [1, 2, 4, 7, 15] },
    records: [{ date: '2026-05-14', content: '英语单词' } as any],
  })

  const stats = calculateHabitStats(habit, '2026-05-20')
  expect(stats.currentStreak).toBe(0)
  expect(stats.longestStreak).toBe(0)
})
```

- [ ] **Step 2: Run the stats tests and confirm they fail**

Run:

```bash
npx vitest run test/domain/habit/habitStats.test.ts
```

Expected: FAIL because completion rate is currently based on fixed daily/weekly windows and streaks still use generic period states.

- [ ] **Step 3: Add Ebbinghaus-specific expected-count math to `habitStats.ts`**

Patch `src/domain/habit/habitStats.ts`:

```ts
function countEbbinghausDueCompletions(habit: Habit, currentDate: string) {
  const completedDates = getCompletedRecordDates(habit).filter(date => date <= currentDate)
  if (habit.frequency?.type !== 'ebbinghaus') {
    return {
      completedCount: completedDates.length,
      expectedCount: completedDates.length,
    }
  }

  const intervals = getEbbinghausIntervals(habit.frequency)
  let expectedCount = 0
  let anchorDate = habit.startDate

  while (anchorDate <= currentDate) {
    expectedCount++
    const nextIndex = Math.min(expectedCount - 1, intervals.length - 1)
    anchorDate = dayjs(anchorDate).add(intervals[nextIndex], 'day').format('YYYY-MM-DD')
  }

  return {
    completedCount: completedDates.length,
    expectedCount,
  }
}
```

Then branch `calculateStreaks()` and `countExpectedAndCompletedForRange()`:

```ts
if (habit.frequency?.type === 'ebbinghaus') {
  return { currentStreak: 0, longestStreak: 0 }
}
```

```ts
if (habit.frequency?.type === 'ebbinghaus') {
  return countEbbinghausWindowForRange(habit, start, end)
}
```

Use a helper that counts due nodes between `start` and `end` from the derived schedule instead of counting active days.

- [ ] **Step 4: Re-run the stats tests and verify they pass**

Run:

```bash
npx vitest run test/domain/habit/habitStats.test.ts test/domain/habit/habitEbbinghaus.test.ts
```

Expected: PASS with conservative streak behavior and due-count denominators.

- [ ] **Step 5: Commit the stats slice**

Run:

```bash
git add src/domain/habit/habitStats.ts test/domain/habit/habitStats.test.ts
git commit -m "feat(habit): adapt stats for ebbinghaus cadence"
```

---

## Task 4: Add the Frequency Option to the Create Dialog

**Files:**

- Modify: `src/components/dialog/HabitCreateDialog.vue`
- Modify: `test/components/dialog/HabitCreateDialog.test.ts`
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`

- [ ] **Step 1: Write failing dialog tests for Ebbinghaus create/edit flows**

Append to `test/components/dialog/HabitCreateDialog.test.ts`:

```ts
it('保存时应生成默认艾宾浩斯 markdown', async () => {
  const mounted = mountDialog()
  await setInputValue(getByTestId(mounted.container, 'habit-name-input'), '英语单词')
  await setInputValue(getByTestId(mounted.container, 'habit-start-date-input'), '2026-05-14')

  mounted.container
    .querySelector('[data-testid="habit-frequency-ebbinghaus-button"]')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await nextTick()

  mounted.container.querySelector('.btn-save')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await nextTick()

  expect(mounted.getSavedMarkdown()).toBe('英语单词 🎯2026-05-14 🔄艾宾浩斯')
})

it('保存时应生成带自定义间隔的艾宾浩斯 markdown', async () => {
  const mounted = mountDialog()
  await setInputValue(getByTestId(mounted.container, 'habit-name-input'), '英语单词')
  mounted.container
    .querySelector('[data-testid="habit-frequency-ebbinghaus-button"]')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await nextTick()

  await setInputValue(getByTestId(mounted.container, 'habit-ebbinghaus-intervals-input'), '1,2,4,7,15')
  mounted.container.querySelector('.btn-save')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await nextTick()

  expect(mounted.getSavedMarkdown()).toBe('英语单词 🎯2026-05-14 🔄艾宾浩斯[1,2,4,7,15]')
})
```

- [ ] **Step 2: Run the dialog tests and confirm they fail**

Run:

```bash
npx vitest run test/components/dialog/HabitCreateDialog.test.ts
```

Expected: FAIL because the `ebbinghaus` option and custom interval input do not exist.

- [ ] **Step 3: Add the dialog option, validation, and markdown generation**

Patch `src/components/dialog/HabitCreateDialog.vue`:

```ts
const form = reactive({
  // existing fields...
  ebbinghausIntervals: props.initialData?.frequency?.type === 'ebbinghaus'
    ? (props.initialData.frequency.intervals?.join(',') ?? '')
    : '',
})

const frequencyOptions = computed(() => [
  { value: 'daily', label: t('habit').freqDaily || '每天' },
  { value: 'every_n_days', label: t('habit').freqEveryNDays || '每N天' },
  { value: 'weekly', label: t('habit').freqWeekly || '每周' },
  { value: 'n_per_week', label: t('habit').freqNPerWeek || '每周N天' },
  { value: 'weekly_days', label: t('habit').freqWeeklyDays || '指定周几' },
  { value: 'ebbinghaus', label: t('habit').freqEbbinghaus || '艾宾浩斯' },
])
```

Add the input in the template:

```vue
<div v-if="form.frequencyType === 'ebbinghaus'" class="freq-detail">
  <input
    v-model="form.ebbinghausIntervals"
    type="text"
    class="form-input"
    data-testid="habit-ebbinghaus-intervals-input"
    :placeholder="t('habit').freqEbbinghausPlaceholder || '1,2,4,7,15'"
  />
</div>
```

In `buildMarkdown()`:

```ts
case 'ebbinghaus': {
  const normalized = form.ebbinghausIntervals
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .join(',');
  line += normalized ? ` 🔄艾宾浩斯[${normalized}]` : ' 🔄艾宾浩斯';
  break;
}
```

- [ ] **Step 4: Add i18n entries and rerun the dialog tests**

Update `src/i18n/zh_CN.json` and `src/i18n/en_US.json`:

```json
"freqEbbinghaus": "艾宾浩斯",
"freqEbbinghausPlaceholder": "1,2,4,7,15"
```

Run:

```bash
npx vitest run test/components/dialog/HabitCreateDialog.test.ts
```

Expected: PASS with both default and custom interval flows.

- [ ] **Step 5: Commit the dialog/i18n slice**

Run:

```bash
git add src/components/dialog/HabitCreateDialog.vue test/components/dialog/HabitCreateDialog.test.ts src/i18n/zh_CN.json src/i18n/en_US.json
git commit -m "feat(habit): add ebbinghaus create dialog option"
```

---

## Task 5: Surface Derived Status in Habit UI Components

**Files:**

- Modify: `src/components/habit/HabitListItem.vue`
- Modify: `src/components/habit/HabitWorkspaceDetailPane.vue`
- Modify: `test/components/habit/HabitListItem.test.ts`
- Modify: `test/components/habit/HabitWorkspaceDetailPane.test.ts`

- [ ] **Step 1: Write failing UI tests for Ebbinghaus list/detail labels**

Append to `test/components/habit/HabitListItem.test.ts`:

```ts
it('renders ebbinghaus schedule hints', async () => {
  const wrapper = mount(HabitListItem, {
    props: {
      habit: mkHabit({ frequency: { type: 'ebbinghaus', intervals: [1, 2, 4, 7, 15] } }),
      dayState: {
        date: '2026-05-18',
        hasRecord: false,
        isCompleted: false,
        isDue: true,
        isOverdue: true,
        overdueDays: 3,
        nextDueDate: '2026-05-15',
        currentStageIndex: 0,
        currentIntervalDays: 1,
      },
      periodState: {
        periodType: 'day',
        periodStart: '2026-05-18',
        periodEnd: '2026-05-18',
        requiredCount: 1,
        completedCount: 0,
        remainingCount: 1,
        isCompleted: false,
        eligibleToday: true,
      },
    },
  })

  expect(wrapper.text()).toContain('艾宾浩斯')
  expect(wrapper.text()).toContain('已逾期')
})
```

Append to `test/components/habit/HabitWorkspaceDetailPane.test.ts`:

```ts
it('shows stage and next due date for ebbinghaus habits', async () => {
  const wrapper = mount(HabitWorkspaceDetailPane, {
    props: {
      habit: mkHabit({ frequency: { type: 'ebbinghaus', intervals: [1, 2, 4, 7, 15] } }),
      selectedDate: '2026-05-18',
      stats: mkStats(),
    },
  })

  expect(wrapper.text()).toContain('第 1 阶段')
  expect(wrapper.text()).toContain('下次打卡')
})
```

- [ ] **Step 2: Run the component tests and confirm they fail**

Run:

```bash
npx vitest run test/components/habit/HabitListItem.test.ts test/components/habit/HabitWorkspaceDetailPane.test.ts
```

Expected: FAIL because the current components have no Ebbinghaus-specific labels or detail rows.

- [ ] **Step 3: Add frequency summary and overdue/stage hints to `HabitListItem.vue`**

Patch `src/components/habit/HabitListItem.vue`:

```ts
if (frequency.type === 'ebbinghaus') {
  return t('habit').freqEbbinghaus || '艾宾浩斯'
}
```

And branch the schedule hint:

```ts
if (props.habit.frequency?.type === 'ebbinghaus') {
  if (props.dayState.isCompleted) {
    return t('habit').selectedDayCompleted
  }
  if (props.dayState.isOverdue) {
    return t('habit').overdueDays.replace('{n}', String(props.dayState.overdueDays || 0))
  }
  if (props.dayState.isDue) {
    return t('habit').dueToday
  }
  return t('habit').noNeedToday
}
```

- [ ] **Step 4: Add stage/detail metadata to `HabitWorkspaceDetailPane.vue`**

Add a computed block that reads `getHabitDayState(habit, selectedDate)` and renders:

```vue
<div v-if="habit.frequency?.type === 'ebbinghaus'" class="habit-detail-ebbinghaus">
  <div>{{ t('habit').ebbinghausStage.replace('{n}', String((dayState.currentStageIndex ?? -1) + 1)) }}
</div>

  <div>
{{ t('habit').ebbinghausInterval.replace('{n}', String(dayState.currentIntervalDays ?? 0)) }}
</div>

  <div>
{{ t('habit').nextDueDate.replace('{date}', dayState.nextDueDate || '-') }}
</div>

  <div v-if="dayState.isOverdue">
    {{ t('habit').overdueDays.replace('{n}', String(dayState.overdueDays || 0)) }}
  </div>
</div>
```

- [ ] **Step 5: Add the remaining i18n strings and rerun the component tests**

Update i18n:

```json
"ebbinghausStage": "第 {n} 阶段",
"ebbinghausInterval": "间隔 {n} 天",
"nextDueDate": "下次打卡 {date}",
"overdueDays": "已逾期 {n} 天"
```

Run:

```bash
npx vitest run test/components/habit/HabitListItem.test.ts test/components/habit/HabitWorkspaceDetailPane.test.ts
```

Expected: PASS with correct list and detail rendering.

- [ ] **Step 6: Commit the UI slice**

Run:

```bash
git add src/components/habit/HabitListItem.vue src/components/habit/HabitWorkspaceDetailPane.vue test/components/habit/HabitListItem.test.ts test/components/habit/HabitWorkspaceDetailPane.test.ts src/i18n/zh_CN.json src/i18n/en_US.json
git commit -m "feat(habit): show ebbinghaus schedule hints"
```

---

## Task 6: Update User Docs and Run the Targeted Regression Suite

**Files:**

- Modify: `docs/user-guide/data-format.md`
- Modify: `docs/user-guide/habit-checkin.md`

- [ ] **Step 1: Update the user-guide syntax reference**

Patch `docs/user-guide/data-format.md` in the habit frequency table and examples:

```md
| `🔄艾宾浩斯` | `🔄ebbinghaus` | 按艾宾浩斯阶段推进复习打卡 |
| `🔄艾宾浩斯[1,2,4,7,15]` | `🔄ebbinghaus[1,2,4,7,15]` | 自定义复习间隔模板 |

```

Add an example block:

```md
英语单词 🎯2026-05-14 🔄艾宾浩斯
英语单词 🎯2026-05-14 🔄艾宾浩斯[1,2,4,7,15]

```

- [ ] **Step 2: Update the habit check-in guide with progression rules**

Patch `docs/user-guide/habit-checkin.md`:

```md
### 艾宾浩斯频率

- 第一次完成打卡后，进入第 1 个阶段，下一次打卡日按模板的第一个间隔计算
- 漏打不会自动回退，也不会自动跳过
- 漏打后会停留在当前阶段，直到用户补打
- 到达最后一个阶段后，会持续按最后一个间隔循环

```

- [ ] **Step 3: Run the focused regression suite**

Run:

```bash
npx vitest run test/parser/habitParser.test.ts test/domain/habit/habitPeriod.test.ts test/domain/habit/habitCompletion.test.ts test/domain/habit/habitEbbinghaus.test.ts test/domain/habit/habitStats.test.ts test/components/dialog/HabitCreateDialog.test.ts test/components/habit/HabitListItem.test.ts test/components/habit/HabitWorkspaceDetailPane.test.ts
```

Expected: PASS for all targeted parser, domain, and UI coverage added by this plan.

- [ ] **Step 4: Run the full habit regression suite**

Run:

```bash
npx vitest run test/services/habitService.test.ts test/services/habitReminder.test.ts test/utils/habitStatsUtils.test.ts test/components/habit/HabitMonthCalendar.test.ts test/components/habit/HabitWeekBar.test.ts test/components/habit/HabitWorkspaceListPane.test.ts test/mobile/MobileHabitPanel.test.ts test/tabs/DesktopHabitDock.test.ts
```

Expected: PASS with no regressions in existing habit flows.

- [ ] **Step 5: Commit docs and final verification**

Run:

```bash
git add docs/user-guide/data-format.md docs/user-guide/habit-checkin.md
git commit -m "docs(habit): document ebbinghaus frequency"
```

---

## Self-Review

- Spec coverage: parser syntax, derived schedule, missed-date behavior, UI detail, conservative streaks, and docs are all mapped to Tasks 1-6.
- Placeholder scan: no `TBD`, `TODO`, or “similar to previous task” shortcuts remain.
- Type consistency: the plan uses `type: 'ebbinghaus'`, `intervals`, `getEbbinghausIntervals()`, and `getEbbinghausScheduleState()` consistently across parser, domain, stats, and UI tasks.
