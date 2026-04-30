# Workday Recurring Holiday Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `🔁工作日` recurring items advance by China legal holidays and makeup workdays instead of only skipping weekends.

**Architecture:** Add a focused `chinaWorkdayService` that loads built-in holiday data, optionally refreshes it from the remote `holidayAPI.json`, and exposes synchronous workday checks for recurrence code. Keep the recurring behavior surface unchanged except for `workday` date advancement, and initialize the calendar data in plugin startup without blocking core plugin load.

**Tech Stack:** TypeScript, Vue plugin runtime, Vitest, existing SiYuan API wrapper, built-in `fetch`/runtime network APIs already available to the plugin.

---

## File Structure

- Create: `src/constants/chinaWorkdayFallback.ts`
  - Built-in fallback holiday/workday data in the plugin's internal format.
- Create: `src/services/chinaWorkdayService.ts`
  - Loads fallback/cache data, refreshes from remote, and exposes workday helpers.
- Modify: `src/parser/recurringParser.ts`
  - Route `workday` next-date calculation through the new service.
- Modify: `src/index.ts`
  - Trigger one non-blocking calendar initialization/refresh during plugin startup.
- Create: `test/services/chinaWorkdayService.test.ts`
  - Service-level tests for holiday/workday rules and fallback behavior.
- Modify: `test/parser/recurringParser.test.ts`
  - Add `workday` date advancement coverage for holiday and makeup-workday cases.
- Modify: `test/services/recurringService.test.ts`
  - Add integration checks that recurring item creation and skip use the corrected dates.

### Task 1: Add Parser-Level Failing Tests For China Workday Advancement

**Files:**
- Modify: `test/parser/recurringParser.test.ts`

- [ ] **Step 1: Write the failing tests**

Add the following cases under `describe('getNextOccurrenceDate', ...)` in `test/parser/recurringParser.test.ts`:

```ts
    it('应该计算工作日的下一次（跳过中国法定节假日）', () => {
      const rule: RepeatRule = { type: 'workday' };
      const result = getNextOccurrenceDate('2026-04-30', rule);
      expect(result).toBe('2026-05-06');
    });

    it('应该计算工作日的下一次（命中补班周六）', () => {
      const rule: RepeatRule = { type: 'workday' };
      const result = getNextOccurrenceDate('2026-05-08', rule);
      expect(result).toBe('2026-05-09');
    });
```

- [ ] **Step 2: Run the parser test to verify it fails**

Run:

```bash
npx vitest run test/parser/recurringParser.test.ts
```

Expected: FAIL because the current `workday` branch only skips Saturday/Sunday and returns `2026-05-01` for `2026-04-30`.

- [ ] **Step 3: Commit the failing test**

```bash
git add test/parser/recurringParser.test.ts
git commit -m "test(recurring): cover china holiday workday advancement"
```

### Task 2: Add Recurring Service Integration Failing Tests

**Files:**
- Modify: `test/services/recurringService.test.ts`

- [ ] **Step 1: Write the failing integration tests**

Add the following cases under `describe('skipCurrentOccurrence', ...)` and `describe('createNextOccurrence', ...)` in `test/services/recurringService.test.ts`:

```ts
    it('工作日重复遇到法定节假日时应跳过到节后工作日', async () => {
      mockUpdateBlock.mockResolvedValue([{ id: 'new-block-id' }]);

      const item: Item = {
        id: '1',
        content: '节前任务',
        date: '2026-04-30',
        status: 'pending',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'block123',
        repeatRule: { type: 'workday' }
      };

      const result = await skipCurrentOccurrence({} as any, item);
      expect(result).toBe(true);
      expect(mockUpdateBlock).toHaveBeenCalledWith(
        'markdown',
        expect.stringContaining('📅2026-05-06'),
        'block123'
      );
    });

    it('工作日重复创建下一次时应命中补班周六', async () => {
      mockInsertBlock.mockResolvedValue([{ id: 'new-block-id' }]);

      const item: Item = {
        id: '1',
        content: '节后任务',
        date: '2026-05-08',
        status: 'completed',
        lineNumber: 1,
        docId: 'doc1',
        blockId: 'block123',
        repeatRule: { type: 'workday' }
      };

      const result = await createNextOccurrence({} as any, item);
      expect(result).toBe(true);
      expect(mockInsertBlock).toHaveBeenCalledWith(
        'markdown',
        expect.stringContaining('📅2026-05-09'),
        undefined,
        'block123',
        undefined,
      );
    });
```

- [ ] **Step 2: Run the recurring service test to verify it fails**

Run:

```bash
npx vitest run test/services/recurringService.test.ts
```

Expected: FAIL because `getNextOccurrenceDate()` still returns weekend-only workdays.

- [ ] **Step 3: Commit the failing integration tests**

```bash
git add test/services/recurringService.test.ts
git commit -m "test(recurring): cover holiday-aware workday integration"
```

### Task 3: Add China Workday Fallback Data And Service Tests

**Files:**
- Create: `src/constants/chinaWorkdayFallback.ts`
- Create: `test/services/chinaWorkdayService.test.ts`

- [ ] **Step 1: Write the failing service tests**

Create `test/services/chinaWorkdayService.test.ts` with the following content:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api', () => ({
  getFile: vi.fn(),
  putFile: vi.fn(),
}));

describe('chinaWorkdayService', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('treats legal holiday dates as non-workdays', async () => {
    const service = await import('@/services/chinaWorkdayService');
    await service.__resetChinaWorkdayStateForTest();

    expect(service.isChinaWorkday('2026-05-01')).toBe(false);
    expect(service.isChinaWorkday('2026-05-05')).toBe(false);
  });

  it('treats makeup weekend dates as workdays', async () => {
    const service = await import('@/services/chinaWorkdayService');
    await service.__resetChinaWorkdayStateForTest();

    expect(service.isChinaWorkday('2026-05-09')).toBe(true);
  });

  it('falls back to normal weekdays when no special date is matched', async () => {
    const service = await import('@/services/chinaWorkdayService');
    await service.__resetChinaWorkdayStateForTest();

    expect(service.isChinaWorkday('2026-03-20')).toBe(true);
    expect(service.isChinaWorkday('2026-03-21')).toBe(false);
  });

  it('finds the next china workday across a holiday break', async () => {
    const service = await import('@/services/chinaWorkdayService');
    await service.__resetChinaWorkdayStateForTest();

    expect(service.getNextChinaWorkday('2026-04-30')).toBe('2026-05-06');
  });
});
```

- [ ] **Step 2: Add the fallback data file**

Create `src/constants/chinaWorkdayFallback.ts` with a minimal but explicit fallback dataset for the covered scenarios:

```ts
export interface ChinaWorkdayCalendarData {
  holidays: string[]
  workdays: string[]
}

export const CHINA_WORKDAY_FALLBACK: ChinaWorkdayCalendarData = {
  holidays: [
    '2026-05-01',
    '2026-05-02',
    '2026-05-03',
    '2026-05-04',
    '2026-05-05',
  ],
  workdays: [
    '2026-05-09',
  ],
};
```

- [ ] **Step 3: Run the service test to verify it fails**

Run:

```bash
npx vitest run test/services/chinaWorkdayService.test.ts
```

Expected: FAIL because `chinaWorkdayService.ts` does not exist yet.

- [ ] **Step 4: Commit the fallback data and failing test scaffold**

```bash
git add src/constants/chinaWorkdayFallback.ts test/services/chinaWorkdayService.test.ts
git commit -m "test(workday): add china workday service coverage"
```

### Task 4: Implement The Minimal China Workday Service

**Files:**
- Create: `src/services/chinaWorkdayService.ts`
- Create: `src/constants/chinaWorkdayFallback.ts`
- Test: `test/services/chinaWorkdayService.test.ts`

- [ ] **Step 1: Write the minimal implementation**

Create `src/services/chinaWorkdayService.ts` with this initial implementation:

```ts
import { CHINA_WORKDAY_FALLBACK, type ChinaWorkdayCalendarData } from '@/constants/chinaWorkdayFallback';

let activeCalendar: ChinaWorkdayCalendarData = CHINA_WORKDAY_FALLBACK;

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isChinaWorkday(dateStr: string): boolean {
  if (activeCalendar.workdays.includes(dateStr)) {
    return true;
  }

  if (activeCalendar.holidays.includes(dateStr)) {
    return false;
  }

  return !isWeekend(new Date(dateStr));
}

export function getNextChinaWorkday(dateStr: string): string {
  const date = new Date(dateStr);

  do {
    date.setDate(date.getDate() + 1);
  } while (!isChinaWorkday(formatDate(date)));

  return formatDate(date);
}

export async function initializeChinaWorkdayCalendar(): Promise<void> {
  activeCalendar = CHINA_WORKDAY_FALLBACK;
}

export async function __resetChinaWorkdayStateForTest(): Promise<void> {
  activeCalendar = CHINA_WORKDAY_FALLBACK;
}
```

- [ ] **Step 2: Run the service test to verify it passes**

Run:

```bash
npx vitest run test/services/chinaWorkdayService.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit the minimal service**

```bash
git add src/services/chinaWorkdayService.ts src/constants/chinaWorkdayFallback.ts test/services/chinaWorkdayService.test.ts
git commit -m "feat(workday): add fallback china workday service"
```

### Task 5: Wire Workday Recurrence Through The New Service

**Files:**
- Modify: `src/parser/recurringParser.ts`
- Test: `test/parser/recurringParser.test.ts`
- Test: `test/services/recurringService.test.ts`

- [ ] **Step 1: Replace the weekend-only workday branch**

Update the imports and `workday` branch in `src/parser/recurringParser.ts`:

```ts
import { getNextChinaWorkday } from '@/services/chinaWorkdayService';
```

Replace:

```ts
    case 'workday':
      do {
        date.setDate(date.getDate() + 1);
      } while (date.getDay() === 0 || date.getDay() === 6);
      break;
```

With:

```ts
    case 'workday':
      return getNextChinaWorkday(currentDate);
```

Keep the existing `return formatDate(date);` for the other branches unchanged.

- [ ] **Step 2: Run the parser and recurring service tests**

Run:

```bash
npx vitest run test/parser/recurringParser.test.ts test/services/recurringService.test.ts
```

Expected: PASS for the new holiday-aware workday cases.

- [ ] **Step 3: Commit the recurrence integration**

```bash
git add src/parser/recurringParser.ts test/parser/recurringParser.test.ts test/services/recurringService.test.ts
git commit -m "fix(recurring): use china workday calendar for workday rule"
```

### Task 6: Add Cache And Remote Refresh Service Coverage

**Files:**
- Modify: `test/services/chinaWorkdayService.test.ts`
- Modify: `src/services/chinaWorkdayService.ts`

- [ ] **Step 1: Extend the service test with cache and refresh behavior**

Append these cases to `test/services/chinaWorkdayService.test.ts`:

```ts
import { getFile, putFile } from '@/api';

const mockedGetFile = vi.mocked(getFile);
const mockedPutFile = vi.mocked(putFile);

  it('uses cached data when present during initialization', async () => {
    mockedGetFile.mockResolvedValueOnce(JSON.stringify({
      holidays: ['2026-10-01'],
      workdays: ['2026-10-10'],
    }));

    const service = await import('@/services/chinaWorkdayService');
    await service.initializeChinaWorkdayCalendar();

    expect(service.isChinaWorkday('2026-10-01')).toBe(false);
    expect(service.isChinaWorkday('2026-10-10')).toBe(true);
  });

  it('keeps current data when remote refresh fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const service = await import('@/services/chinaWorkdayService');
    await service.__resetChinaWorkdayStateForTest();
    await service.refreshChinaWorkdayCalendar();

    expect(service.getNextChinaWorkday('2026-04-30')).toBe('2026-05-06');
  });

  it('overrides active data and writes cache when remote refresh succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        Years: [
          {
            StartDate: '2026-10-01',
            EndDate: '2026-10-03',
            CompDays: ['2026-10-10'],
          },
        ],
      }),
    }));

    const service = await import('@/services/chinaWorkdayService');
    await service.__resetChinaWorkdayStateForTest();
    await service.refreshChinaWorkdayCalendar();

    expect(service.isChinaWorkday('2026-10-01')).toBe(false);
    expect(service.isChinaWorkday('2026-10-10')).toBe(true);
    expect(mockedPutFile).toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run the service test to verify the new cases fail**

Run:

```bash
npx vitest run test/services/chinaWorkdayService.test.ts
```

Expected: FAIL because cache I/O and remote refresh are not implemented yet.

- [ ] **Step 3: Commit the new failing tests**

```bash
git add test/services/chinaWorkdayService.test.ts
git commit -m "test(workday): cover cache and remote refresh behavior"
```

### Task 7: Implement Cache Loading And Remote Refresh

**Files:**
- Modify: `src/services/chinaWorkdayService.ts`
- Test: `test/services/chinaWorkdayService.test.ts`

- [ ] **Step 1: Implement cache/refresh support**

Update `src/services/chinaWorkdayService.ts` to add a cache path, cache parsing, remote conversion, and refresh helpers:

```ts
import { getFile, putFile } from '@/api';
import { CHINA_WORKDAY_FALLBACK, type ChinaWorkdayCalendarData } from '@/constants/chinaWorkdayFallback';

const HOLIDAY_API_URL = 'https://raw.githubusercontent.com/lanceliao/china-holiday-calender/master/holidayAPI.json';
const CACHE_PATH = '/data/storage/petal/siyuan-plugin-bullet-journal/china-workday-calendar.json';

interface HolidayApiYear {
  StartDate: string
  EndDate: string
  CompDays?: string[]
}

interface HolidayApiPayload {
  Years?: HolidayApiYear[]
}

let activeCalendar: ChinaWorkdayCalendarData = CHINA_WORKDAY_FALLBACK;

function enumerateDateRange(start: string, end: string): string[] {
  const result: string[] = [];
  const date = new Date(start);
  const endDate = new Date(end);

  while (date <= endDate) {
    result.push(formatDate(date));
    date.setDate(date.getDate() + 1);
  }

  return result;
}

function parseCalendarData(raw: string): ChinaWorkdayCalendarData | null {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.holidays) || !Array.isArray(parsed.workdays)) {
      return null;
    }
    return {
      holidays: parsed.holidays,
      workdays: parsed.workdays,
    };
  } catch {
    return null;
  }
}

function convertHolidayPayload(payload: HolidayApiPayload): ChinaWorkdayCalendarData | null {
  if (!Array.isArray(payload.Years)) {
    return null;
  }

  const holidays = new Set<string>();
  const workdays = new Set<string>();

  for (const year of payload.Years) {
    for (const day of enumerateDateRange(year.StartDate, year.EndDate)) {
      holidays.add(day);
    }

    for (const day of year.CompDays || []) {
      workdays.add(day);
    }
  }

  return {
    holidays: [...holidays].sort(),
    workdays: [...workdays].sort(),
  };
}

async function loadCachedCalendar(): Promise<ChinaWorkdayCalendarData | null> {
  const raw = await getFile(CACHE_PATH);
  if (typeof raw !== 'string' || !raw.trim()) {
    return null;
  }
  return parseCalendarData(raw);
}

async function saveCachedCalendar(data: ChinaWorkdayCalendarData): Promise<void> {
  await putFile(CACHE_PATH, JSON.stringify(data, null, 2));
}

export async function initializeChinaWorkdayCalendar(): Promise<void> {
  const cached = await loadCachedCalendar();
  activeCalendar = cached || CHINA_WORKDAY_FALLBACK;
}

export async function refreshChinaWorkdayCalendar(): Promise<void> {
  try {
    const response = await fetch(HOLIDAY_API_URL);
    if (!response.ok) {
      return;
    }

    const payload = await response.json() as HolidayApiPayload;
    const converted = convertHolidayPayload(payload);
    if (!converted) {
      return;
    }

    activeCalendar = converted;
    await saveCachedCalendar(converted);
  } catch {
    // keep current calendar
  }
}
```

- [ ] **Step 2: Export a stable test reset helper**

Keep this helper at the bottom of `src/services/chinaWorkdayService.ts`:

```ts
export async function __resetChinaWorkdayStateForTest(): Promise<void> {
  activeCalendar = CHINA_WORKDAY_FALLBACK;
}
```

- [ ] **Step 3: Run the service test to verify it passes**

Run:

```bash
npx vitest run test/services/chinaWorkdayService.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit cache and refresh support**

```bash
git add src/services/chinaWorkdayService.ts test/services/chinaWorkdayService.test.ts
git commit -m "feat(workday): add holiday cache and remote refresh"
```

### Task 8: Initialize The Calendar In Plugin Startup

**Files:**
- Modify: `src/index.ts`
- Test: `test/services/chinaWorkdayService.test.ts`

- [ ] **Step 1: Add a startup initialization call**

Import the service in `src/index.ts`:

```ts
import {
  initializeChinaWorkdayCalendar,
  refreshChinaWorkdayCalendar,
} from '@/services/chinaWorkdayService';
```

In `onload()`, after settings/i18n initialization and before recurrence behavior is used, add:

```ts
    await initializeChinaWorkdayCalendar();
    void refreshChinaWorkdayCalendar();
```

If `onload()` cannot safely await this without slowing core startup, keep the same order but use:

```ts
    void initializeChinaWorkdayCalendar().then(() => {
      void refreshChinaWorkdayCalendar();
    });
```

Choose the variant that matches the existing startup style around async initialization in `src/index.ts`.

- [ ] **Step 2: Run the focused test suite**

Run:

```bash
npx vitest run test/services/chinaWorkdayService.test.ts test/parser/recurringParser.test.ts test/services/recurringService.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit startup wiring**

```bash
git add src/index.ts src/services/chinaWorkdayService.ts test/services/chinaWorkdayService.test.ts test/parser/recurringParser.test.ts test/services/recurringService.test.ts
git commit -m "feat(workday): initialize holiday calendar on plugin load"
```

### Task 9: Run Full Regression Checks And Clean Up

**Files:**
- Modify: `src/services/chinaWorkdayService.ts` (only if test cleanup is needed)
- Modify: `test/services/chinaWorkdayService.test.ts` (only if mocks need tightening)

- [ ] **Step 1: Run the full recurring-related regression set**

Run:

```bash
npx vitest run test/services/chinaWorkdayService.test.ts test/parser/recurringParser.test.ts test/services/recurringService.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the broader project test suite**

Run:

```bash
npm test
```

Expected: PASS, or if unrelated failures exist, capture the exact failing files and confirm they are pre-existing or unrelated before proceeding.

- [ ] **Step 3: Inspect the final diff**

Run:

```bash
git diff -- src/constants/chinaWorkdayFallback.ts src/services/chinaWorkdayService.ts src/parser/recurringParser.ts src/index.ts test/services/chinaWorkdayService.test.ts test/parser/recurringParser.test.ts test/services/recurringService.test.ts
```

Expected: Only the holiday-aware workday changes and their tests.

- [ ] **Step 4: Commit final polish if needed**

```bash
git add src/constants/chinaWorkdayFallback.ts src/services/chinaWorkdayService.ts src/parser/recurringParser.ts src/index.ts test/services/chinaWorkdayService.test.ts test/parser/recurringParser.test.ts test/services/recurringService.test.ts
git commit -m "chore(workday): finalize holiday-aware recurring coverage"
```

## Self-Review

- Spec coverage:
  - Built-in fallback data: covered by Tasks 3, 4, 7.
  - Remote refresh + local cache: covered by Tasks 6, 7, 8.
  - `workday` recurrence behavior only: covered by Tasks 1, 2, 5.
  - Startup initialization: covered by Task 8.
  - Non-goals preserved: Tasks touch only recurrence workday logic, startup wiring, and tests.
- Placeholder scan:
  - No `TODO`/`TBD`.
  - All test additions include concrete code and commands.
  - Each implementation step includes concrete code or exact file edits.
- Type consistency:
  - `ChinaWorkdayCalendarData`, `isChinaWorkday`, `getNextChinaWorkday`, `initializeChinaWorkdayCalendar`, and `refreshChinaWorkdayCalendar` are referenced consistently across tasks.

