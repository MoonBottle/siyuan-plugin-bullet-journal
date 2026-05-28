# Habit Check-in Time Precision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global habit check-in completion-time precision setting (`day` / `minute` / `second`) that controls both newly written habit record markdown and habit detail UI display without changing existing day-based statistics.

**Architecture:** Extend the shared settings model with a habit-specific precision field, keep `CheckInRecord.date` as the day-only statistic key, and add `CheckInRecord.completedAt` for the full parsed timestamp string. Implement the feature in a narrow vertical slice: parser and service first, then shared display formatting, then PC/mobile settings integration and regression coverage.

**Tech Stack:** Vue 3 SFCs, Pinia, TypeScript, Vitest, SiYuan-style settings components, project i18n JSON.

---

## File Map

**Modify**

- `src/settings/types.ts` — add `HabitCheckInTimePrecision`, persist it in `SettingsData`, define default value
- `src/stores/settingsStore.ts` — load/save the new setting through the plugin bridge
- `src/types/models.ts` — add `completedAt?: string` to `CheckInRecord`
- `src/parser/habitParser.ts` — parse `📅YYYY-MM-DD[ HH:mm[:ss]]` and keep `date` day-only
- `src/services/habitService.ts` — generate markdown using precision-aware timestamps
- `src/components/habit/HabitRecordLog.vue` — show date-only, minute, or second precision for record rows
- `src/components/settings/SettingsDialog.vue` — mount the new habit settings section
- `src/components/settings/CalendarConfigSection.vue` — leave unchanged unless extracting shared patterns becomes necessary
- `src/mobile/drawers/settings/SettingsDrawer.vue` — expose the same precision choice in the existing mobile settings drawer
- `src/i18n/zh_CN.json` — add habit settings labels and precision option copy

**Create**

- `src/components/settings/HabitConfigSection.vue` — desktop/mobile settings section for habit-only preferences
- `src/utils/habitDateTime.ts` — parse/format helpers for habit check-in timestamps
- `test/utils/habitDateTime.test.ts` — helper unit tests

**Test**

- `test/parser/habitParser.test.ts`
- `test/services/habitService.test.ts`
- `test/components/habit/HabitRecordLog.test.ts` or create if missing
- `test/stores/settingsStore.test.ts` if needed for save/load regression

---

### Task 1: Add Settings and Type Surface

**Files:**

- Create: `src/components/settings/HabitConfigSection.vue`
- Modify: `src/settings/types.ts`
- Modify: `src/stores/settingsStore.ts`
- Modify: `src/types/models.ts`
- Modify: `src/i18n/zh_CN.json`

- [ ] **Step 1: Write the failing settings/type test**

Add a focused settings regression in `test/stores/settingsStore.test.ts` if the file exists; otherwise create it with the minimal store contract needed for this feature:

```ts
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '@/settings/types'
import { useSettingsStore } from '@/stores/settingsStore'

vi.mock('@/main', () => ({
  usePlugin: () => ({
    getSettings: () => ({
      ...defaultSettings,
      habitCheckInTimePrecision: 'second',
    }),
    updateSettings: vi.fn(),
  }),
}))

describe('settingsStore habit precision', () => {
  it('loads habitCheckInTimePrecision from plugin settings', () => {
    setActivePinia(createPinia())
    const store = useSettingsStore()
    store.loadFromPlugin()
    expect(store.habitCheckInTimePrecision).toBe('second')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/stores/settingsStore.test.ts`

Expected: FAIL because `habitCheckInTimePrecision` does not exist on the settings model/store.

- [ ] **Step 3: Implement the minimal settings/type surface**

Apply the following changes:

`src/settings/types.ts`

```ts
export type HabitCheckInTimePrecision = 'day' | 'minute' | 'second'

export interface SettingsData {
  // ...
  habitCheckInTimePrecision?: HabitCheckInTimePrecision
}

export const defaultSettings: SettingsData = {
  // ...
  habitCheckInTimePrecision: 'day',
}
```

`src/stores/settingsStore.ts`

```ts
import type { HabitCheckInTimePrecision } from '@/settings/types'

state: () => ({
  // ...
  habitCheckInTimePrecision: 'day' as HabitCheckInTimePrecision,
})

this.habitCheckInTimePrecision = settings.habitCheckInTimePrecision || 'day'

plugin.updateSettings({
  // ...
  habitCheckInTimePrecision: this.habitCheckInTimePrecision,
})
```

`src/types/models.ts`

```ts
export interface CheckInRecord {
  content: string
  date: string
  completedAt?: string
  docId: string
  blockId: string
  // ...
}
```

`src/i18n/zh_CN.json`

```json
"habitSettings": {
  "title": "习惯",
  "checkInTimePrecision": "打卡完成时间精度",
  "checkInTimePrecisionDesc": "控制习惯打卡记录写入与展示的时间精度",
  "precisionDay": "到日",
  "precisionMinute": "到分",
  "precisionSecond": "到秒"
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/stores/settingsStore.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/settings/types.ts src/stores/settingsStore.ts src/types/models.ts src/i18n/zh_CN.json test/stores/settingsStore.test.ts
git commit -m "feat(habit): add check-in time precision setting"
```

### Task 2: Implement Shared Habit Timestamp Helpers

**Files:**

- Create: `src/utils/habitDateTime.ts`
- Test: `test/utils/habitDateTime.test.ts`

- [ ] **Step 1: Write the failing helper tests**

Create `test/utils/habitDateTime.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import {
  extractHabitCompletedAt,
  formatHabitCompletedAtForDisplay,
  formatHabitCompletedAtForMarkdown,
} from '@/utils/habitDateTime'

describe('extractHabitCompletedAt', () => {
  it('parses day precision from record markdown', () => {
    expect(extractHabitCompletedAt('喝水 📅2026-05-08')).toEqual({
      date: '2026-05-08',
      completedAt: '2026-05-08',
    })
  })

  it('parses minute precision from record markdown', () => {
    expect(extractHabitCompletedAt('喝水 📅2026-05-08 21:30')).toEqual({
      date: '2026-05-08',
      completedAt: '2026-05-08 21:30',
    })
  })

  it('parses second precision from record markdown', () => {
    expect(extractHabitCompletedAt('喝水 📅2026-05-08 21:30:45')).toEqual({
      date: '2026-05-08',
      completedAt: '2026-05-08 21:30:45',
    })
  })
})

describe('formatHabitCompletedAtForMarkdown', () => {
  it('formats minute precision using current local time', () => {
    vi.setSystemTime(new Date('2026-05-08T21:30:45'))
    expect(formatHabitCompletedAtForMarkdown('minute')).toBe('2026-05-08 21:30')
  })
})

describe('formatHabitCompletedAtForDisplay', () => {
  it('does not fake time for old day-only records under second precision', () => {
    expect(formatHabitCompletedAtForDisplay('2026-05-08', 'second')).toBe('5/8')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/utils/habitDateTime.test.ts`

Expected: FAIL because the helper module does not exist yet.

- [ ] **Step 3: Implement the minimal helper module**

Create `src/utils/habitDateTime.ts`:

```ts
import type { HabitCheckInTimePrecision } from '@/settings/types'
import dayjs from '@/utils/dayjs'

const HABIT_COMPLETED_AT_RE = /📅(\d{4}-\d{2}-\d{2})(?: (\d{2}:\d{2})(?::(\d{2}))?)?/

export function extractHabitCompletedAt(markdown: string): { date: string, completedAt: string } | null {
  const match = markdown.match(HABIT_COMPLETED_AT_RE)
  if (!match) {
    return null
  }

  const date = match[1]
  const minutePart = match[2]
  const secondPart = match[3]
  const completedAt = minutePart
    ? `${date} ${minutePart}${secondPart ? `:${secondPart}` : ''}`
    : date

  return { date, completedAt }
}

export function formatHabitCompletedAtForMarkdown(
  precision: HabitCheckInTimePrecision,
  now: Date = new Date(),
): string {
  const value = dayjs(now)
  if (precision === 'second') {
    return value.format('YYYY-MM-DD HH:mm:ss')
  }
  if (precision === 'minute') {
    return value.format('YYYY-MM-DD HH:mm')
  }
  return value.format('YYYY-MM-DD')
}

export function formatHabitCompletedAtForDisplay(
  completedAt: string | undefined,
  precision: HabitCheckInTimePrecision,
): string {
  if (!completedAt) {
    return ''
  }
  if (!completedAt.includes(' ')) {
    return dayjs(completedAt).format('M/D')
  }
  if (precision === 'second' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(completedAt)) {
    return dayjs(completedAt).format('M/D HH:mm:ss')
  }
  return dayjs(completedAt).format('M/D HH:mm')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/utils/habitDateTime.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/habitDateTime.ts test/utils/habitDateTime.test.ts
git commit -m "feat(habit): add check-in timestamp helpers"
```

### Task 3: Extend Habit Record Parsing

**Files:**

- Modify: `src/parser/habitParser.ts`
- Test: `test/parser/habitParser.test.ts`

- [ ] **Step 1: Write the failing parser tests**

Append these cases in `test/parser/habitParser.test.ts`:

```ts
it('parses completedAt with minute precision while keeping date day-only', () => {
  const result = parseCheckInRecordLine('喝水 3/8杯 📅2026-05-08 08:30', 'habit-block-1')
  expect(result).not.toBeNull()
  expect(result!.date).toBe('2026-05-08')
  expect(result!.completedAt).toBe('2026-05-08 08:30')
})

it('parses completedAt with second precision while keeping date day-only', () => {
  const result = parseCheckInRecordLine('喝水 3/8杯 📅2026-05-08 08:30:45', 'habit-block-1')
  expect(result).not.toBeNull()
  expect(result!.date).toBe('2026-05-08')
  expect(result!.completedAt).toBe('2026-05-08 08:30:45')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/parser/habitParser.test.ts`

Expected: FAIL because `parseCheckInRecordLine()` only captures day precision.

- [ ] **Step 3: Implement the minimal parser change**

In `src/parser/habitParser.ts`, replace the date extraction with the shared helper:

```ts
import { extractHabitCompletedAt } from '@/utils/habitDateTime'

const completedAtInfo = extractHabitCompletedAt(normalizedLine)
  || (() => {
    const legacyDate = normalizedLine.match(/@(\d{4}-\d{2}-\d{2})/)
    return legacyDate ? { date: legacyDate[1], completedAt: legacyDate[1] } : null
  })()

if (!completedAtInfo) {
  return null
}

const { date, completedAt } = completedAtInfo

const result: Partial<CheckInRecord> = {
  content,
  date,
  completedAt,
  habitId,
}
```

Also update content stripping to remove the optional time portion:

```ts
.replace(/📅\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}(?::\d{2})?)?/g, '')
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/parser/habitParser.test.ts test/utils/habitDateTime.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/parser/habitParser.ts test/parser/habitParser.test.ts src/utils/habitDateTime.ts test/utils/habitDateTime.test.ts
git commit -m "feat(habit): parse check-in timestamp precision"
```

### Task 4: Update Habit Service Markdown Generation

**Files:**

- Modify: `src/services/habitService.ts`
- Modify: `test/services/habitService.test.ts`

- [ ] **Step 1: Write the failing service tests**

Add explicit precision-aware cases in `test/services/habitService.test.ts`:

```ts
it('builds binary habit markdown with second precision timestamp', () => {
  vi.setSystemTime(new Date('2026-05-08T21:30:45'))
  const habit = mkHabit({ name: '早起', type: 'binary' })
  const md = buildCheckInMarkdown(habit, '2026-05-08', undefined, 'second')
  expect(md).toBe('早起 📅2026-05-08 21:30:45')
})

it('builds count habit markdown with minute precision timestamp', () => {
  vi.setSystemTime(new Date('2026-05-08T21:30:45'))
  const habit = mkHabit({ name: '喝水', type: 'count', target: 8, unit: '杯' })
  const md = buildCheckInMarkdown(habit, '2026-05-08', 3, 'minute')
  expect(md).toBe('喝水 3/8杯 📅2026-05-08 21:30')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/services/habitService.test.ts`

Expected: FAIL because `buildCheckInMarkdown()` does not accept precision.

- [ ] **Step 3: Implement the minimal service change**

In `src/services/habitService.ts`:

```ts
import type { HabitCheckInTimePrecision } from '@/settings/types'
import { formatHabitCompletedAtForMarkdown } from '@/utils/habitDateTime'

export function buildCheckInMarkdown(
  habit: Habit,
  date: string,
  currentValue?: number,
  precision: HabitCheckInTimePrecision = 'day',
): string {
  const completedAt = formatHabitCompletedAtForMarkdown(precision)
  const dateMarker = `📅${completedAt.startsWith(date) ? completedAt : date}`

  if (habit.type === 'binary') {
    return `${habit.name} ${dateMarker}`
  }

  const target = habit.target ?? 0
  const unit = habit.unit ?? ''
  const value = currentValue ?? 0
  return `${habit.name} ${value}/${target}${unit} ${dateMarker}`
}
```

Then thread `precision` through `checkIn`, `checkInCount`, and `setCheckInValue` with a conservative default:

```ts
export async function checkIn(
  habit: Habit,
  date: string,
  writer?: BlockWriter,
  precision: HabitCheckInTimePrecision = 'day',
): Promise<boolean> {
  const markdown = buildCheckInMarkdown(habit, date, undefined, precision)
  // ...
}
```

Use the same signature pattern for `checkInCount()` and `setCheckInValue()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/services/habitService.test.ts test/parser/habitParser.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/habitService.ts test/services/habitService.test.ts
git commit -m "feat(habit): write precision-aware check-in markdown"
```

### Task 5: Surface the Setting in Desktop and Mobile UI

**Files:**

- Create: `src/components/settings/HabitConfigSection.vue`
- Modify: `src/components/settings/SettingsDialog.vue`
- Modify: `src/mobile/drawers/settings/SettingsDrawer.vue`
- Modify: `src/i18n/zh_CN.json`

- [ ] **Step 1: Write the failing UI tests**

If settings component tests already exist, extend them. Otherwise create minimal coverage:

```ts
import { mount } from '@vue/test-utils'
import HabitConfigSection from '@/components/settings/HabitConfigSection.vue'

it('emits habitCheckInTimePrecision updates from desktop setting select', async () => {
  const wrapper = mount(HabitConfigSection, {
    props: {
      habitCheckInTimePrecision: 'day',
    },
  })

  await wrapper.find('select, [data-testid=\"habit-checkin-time-precision-select\"]').setValue('second')
  expect(wrapper.emitted('update:habitCheckInTimePrecision')?.[0]).toEqual(['second'])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/components/settings/HabitConfigSection.test.ts`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the desktop/mobile settings UI**

Create `src/components/settings/HabitConfigSection.vue` with the same dual-layout pattern already used in `CalendarConfigSection.vue`:

```vue
<script setup lang="ts">
import SySelect from '@/components/SiyuanTheme/SySelect.vue'
import SySettingItem from '@/components/SiyuanTheme/SySettingItem.vue'
import SySettingItemList from '@/components/SiyuanTheme/SySettingItemList.vue'
import { t } from '@/i18n'
import SySettingsSection from './SySettingsSection.vue'

defineProps<{
  habitCheckInTimePrecision: 'day' | 'minute' | 'second'
  isMobile?: boolean
}>()

defineEmits<{
  'update:habitCheckInTimePrecision': [value: 'day' | 'minute' | 'second']
}>()

const precisionOptions = [
  { value: 'day', label: t('settings').habitSettings.precisionDay },
  { value: 'minute', label: t('settings').habitSettings.precisionMinute },
  { value: 'second', label: t('settings').habitSettings.precisionSecond },
]
</script>
```

Mount it in `src/components/settings/SettingsDialog.vue`:

```vue
<div id="section-habit" class="sy-settings-section-wrapper">
  <HabitConfigSection
    v-show="sectionVisible('habit')"
    v-model:habit-check-in-time-precision="local.habitCheckInTimePrecision"
  />
</div>
```

Add the new menu item and keyword mapping:

```ts
{ key: 'habit', title: settings.habitSettings?.title ?? '习惯', icon: 'iconCheck', sectionId: 'section-habit' }
```

In `src/mobile/drawers/settings/SettingsDrawer.vue`, add a new card-style row using the existing mobile drawer style:

```vue
<div class="form-section">
  <label class="section-label">{{ t('settings').habitSettings.title }}</label>
  <div class="setting-item">
    <div class="setting-info">
      <div class="setting-icon">
        <svg><use xlink:href="#iconCheck"></use></svg>
      </div>

      <span class="setting-label">
{{ t('settings').habitSettings.checkInTimePrecision }}
</span>

    </div>
    <div class="setting-control">
      <select
        :value="settingsStore.habitCheckInTimePrecision"
        class="precision-select"
        @change="updateHabitPrecision(($event.target as HTMLSelectElement).value as 'day' | 'minute' | 'second')"
      >
        <option value="day">{{ t('settings').habitSettings.precisionDay }}</option>
        <option value="minute">{{ t('settings').habitSettings.precisionMinute }}</option>
        <option value="second">{{ t('settings').habitSettings.precisionSecond }}</option>
      </select>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/components/settings/HabitConfigSection.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/HabitConfigSection.vue src/components/settings/SettingsDialog.vue src/mobile/drawers/settings/SettingsDrawer.vue src/i18n/zh_CN.json test/components/settings/HabitConfigSection.test.ts
git commit -m "feat(settings): expose habit check-in precision controls"
```

### Task 6: Use the Setting in Habit Record Display

**Files:**

- Modify: `src/components/habit/HabitRecordLog.vue`
- Test: `test/components/habit/HabitRecordLog.test.ts`

- [ ] **Step 1: Write the failing display tests**

Create or extend `test/components/habit/HabitRecordLog.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import HabitRecordLog from '@/components/habit/HabitRecordLog.vue'

it('renders minute precision from completedAt', () => {
  const wrapper = mount(HabitRecordLog, {
    props: {
      habit: {
        type: 'binary',
        target: undefined,
        unit: undefined,
        records: [
          {
            blockId: 'record-1',
            docId: 'doc-1',
            habitId: 'habit-1',
            content: '喝水',
            date: '2026-05-08',
            completedAt: '2026-05-08 08:30',
          },
        ],
      },
      viewMonth: '2026-05',
    },
  })

  expect(wrapper.text()).toContain('5/8 08:30')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/components/habit/HabitRecordLog.test.ts`

Expected: FAIL because the component still formats `record.date` as `M/D`.

- [ ] **Step 3: Implement the minimal display change**

In `src/components/habit/HabitRecordLog.vue`, inject the settings store and shared formatter:

```ts
import { useSettingsStore } from '@/stores/settingsStore'
import { formatHabitCompletedAtForDisplay } from '@/utils/habitDateTime'

const settingsStore = useSettingsStore()

function formatRecordDate(record: CheckInRecord): string {
  return formatHabitCompletedAtForDisplay(
    record.completedAt || record.date,
    settingsStore.habitCheckInTimePrecision || 'day',
  )
}
```

Update the template:

```vue
<div class="habit-record-log__date">
{{ formatRecordDate(record) }}
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/components/habit/HabitRecordLog.test.ts test/utils/habitDateTime.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/habit/HabitRecordLog.vue test/components/habit/HabitRecordLog.test.ts
git commit -m "feat(habit): show precision-aware check-in timestamps"
```

### Task 7: Wire Runtime Call Sites and Run Regression Suite

**Files:**

- Modify: call sites that invoke `checkIn`, `checkInCount`, `setCheckInValue` after searching with `rg -n "checkIn\\(|checkInCount\\(|setCheckInValue\\(" src`
- Test: `test/services/habitService.test.ts`
- Test: `test/parser/habitParser.test.ts`
- Test: `test/components/habit/HabitRecordLog.test.ts`
- Test: any focused habit interaction tests that fail due to new signatures

- [ ] **Step 1: Write or adjust the failing integration test**

If there is an existing slash command or habit action test, add an assertion that the service receives the selected precision:

```ts
expect(checkIn).toHaveBeenCalledWith(expect.anything(), '2026-05-08', undefined, 'minute')
```

If no such test exists, add a focused integration regression in the nearest existing habit action test file.

- [ ] **Step 2: Run the focused integration test to verify it fails**

Run the exact file you changed, for example:

`npx vitest run test/utils/slashCommands.habit.test.ts`

Expected: FAIL because the caller still uses the old service signature.

- [ ] **Step 3: Thread the setting through runtime call sites**

Update each call site to read from the effective settings source once and pass it through:

```ts
const precision = settingsStore.habitCheckInTimePrecision || 'day'
await checkIn(habit, currentDate, undefined, precision)
await checkInCount(habit, currentDate, 1, undefined, precision)
await setCheckInValue(habit, currentDate, nextValue, undefined, precision)
```

Keep the change narrow: do not refactor unrelated habit action orchestration.

- [ ] **Step 4: Run the regression suite**

Run:

```bash
npx vitest run test/utils/habitDateTime.test.ts test/parser/habitParser.test.ts test/services/habitService.test.ts test/components/habit/HabitRecordLog.test.ts
```

If a runtime call-site test was updated, add it to the same command.

Expected: PASS for all habit timestamp precision coverage and no regressions in existing habit parsing/service behavior.

- [ ] **Step 5: Commit**

```bash
git add src test
git commit -m "feat(habit): wire check-in time precision end to end"
```

## Self-Review

### Spec coverage

- Global precision setting: covered in Tasks 1 and 5
- `completedAt` data model: covered in Tasks 1 through 4
- Parser support for day/minute/second: covered in Tasks 2 and 3
- Markdown writing precision: covered in Task 4
- UI display precision: covered in Task 6
- PC and mobile settings entry: covered in Task 5
- No change to day-based statistics: protected by Tasks 3, 4, and 7 regression steps

### Placeholder scan

- No `TODO` / `TBD` placeholders remain
- Each code-changing step includes the concrete code shape to add
- Each verification step includes explicit commands and expected outcomes

### Type consistency

- Settings key is consistently `habitCheckInTimePrecision`
- Precision type is consistently `'day' | 'minute' | 'second'`
- Record field is consistently `completedAt?: string`
