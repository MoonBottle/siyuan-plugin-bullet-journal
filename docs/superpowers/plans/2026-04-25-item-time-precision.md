# Item Time Precision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support `HH:mm` item time parsing and preserve the original minute-vs-second precision when calendar interactions rewrite markdown.

**Architecture:** Keep runtime time values normalized to `HH:mm:ss` so existing reminder, recurrence, and sorting logic keeps working. Add a lightweight precision field on item/event payloads, teach the parser to infer it from the original markdown, and make markdown rewrite paths format times back out using that precision.

**Tech Stack:** TypeScript, Vue 3, Pinia, Vitest, dayjs, existing parser/file utility helpers

---

## File Structure

- Modify: `src/types/models.ts`
  - Add a shared time precision type and thread it through `Item`, `CalendarEvent.extendedProps`, and sibling item payloads.
- Modify: `src/parser/lineParser.ts`
  - Accept `HH:mm` and `HH:mm:ss` in task/item date expressions, normalize to seconds internally, and record precision.
- Modify: `src/utils/fileUtils.ts`
  - Preserve precision when grouping/optimizing date expressions and when rewriting markdown from calendar edits.
- Modify: `src/tabs/CalendarTab.vue`
  - Pass original precision through event drag/resize updates so rewrites stay in `HH:mm` when the source was minute-level.
- Modify: `docs/user-guide/data-format.md`
  - Document that both `HH:mm` and `HH:mm:ss` are supported and that drag/resize preserves original precision.
- Test: `test/parser/lineParser.test.ts`
  - Add parser coverage for minute-level inputs and mixed precision sibling data.
- Test: `test/utils/fileUtils.test.ts`
  - Add rewrite coverage for minute-level preservation and second-level non-regression.

### Task 1: Lock the expected behavior with parser tests

**Files:**
- Modify: `test/parser/lineParser.test.ts`
- Reference: `src/parser/lineParser.ts`
- Reference: `src/types/models.ts`

- [ ] **Step 1: Write the failing parser tests**

```ts
it('支持 HH:mm 时间范围并归一化为秒级时间', () => {
  const items = LineParser.parseItemLine('周会 @2026-03-17 14:00~16:00', 1);

  expect(items).toHaveLength(1);
  expect(items[0].startDateTime).toBe('2026-03-17 14:00:00');
  expect(items[0].endDateTime).toBe('2026-03-17 16:00:00');
  expect(items[0].timePrecision).toBe('minute');
});

it('多日期混合场景保留各自时间精度', () => {
  const items = LineParser.parseItemLine(
    '整理资料 @2026-03-06 09:00~09:30, 2026-03-10 14:00:05~15:00:10',
    1
  );

  expect(items[0].timePrecision).toBe('minute');
  expect(items[1].timePrecision).toBe('second');
  expect(items[0].siblingItems?.[0].timePrecision).toBe('second');
  expect(items[1].siblingItems?.[0].timePrecision).toBe('minute');
});
```

- [ ] **Step 2: Run parser tests to verify they fail**

Run: `npx vitest run test/parser/lineParser.test.ts`

Expected: FAIL on missing `timePrecision` field and minute-format parsing.

- [ ] **Step 3: Add the model surface needed by the tests**

```ts
export type TimePrecision = 'minute' | 'second';

export interface ItemDateTimeInfo {
  date: string;
  startDateTime?: string;
  endDateTime?: string;
  timePrecision?: TimePrecision;
}
```

Add `timePrecision?: TimePrecision` to `Item` and reuse `ItemDateTimeInfo` where sibling item payloads are currently inlined.

- [ ] **Step 4: Update parser regex and normalization logic**

```ts
const TIME_PART = '\\d{2}:\\d{2}(?::\\d{2})?';
const mainRegex = new RegExp(
  `(?:@|📅)(\\d{4}-\\d{2}-\\d{2}(?:~\\d{4}-\\d{2}-\\d{2}|~\\d{2}-\\d{2})?)(?:\\s+(${TIME_PART}(?:~${TIME_PART})?))?`,
  'g'
);

function normalizeTime(time: string): { value: string; precision: TimePrecision } {
  return time.length === 5
    ? { value: `${time}:00`, precision: 'minute' }
    : { value: time, precision: 'second' };
}
```

Use the parsed precision to populate each item and sibling payload while keeping `startDateTime` / `endDateTime` normalized to `HH:mm:ss`.

- [ ] **Step 5: Re-run parser tests**

Run: `npx vitest run test/parser/lineParser.test.ts`

Expected: PASS for the new minute-format cases and all existing parser assertions.

- [ ] **Step 6: Commit the parser slice**

```bash
git add test/parser/lineParser.test.ts src/parser/lineParser.ts src/types/models.ts
git commit -m "feat(parser): support minute precision item times"
```

### Task 2: Lock markdown rewrite precision with file utility tests

**Files:**
- Modify: `test/utils/fileUtils.test.ts`
- Reference: `src/utils/fileUtils.ts`
- Reference: `src/tabs/CalendarTab.vue`

- [ ] **Step 1: Write the failing rewrite tests**

```ts
it('分钟精度事项更新时间后保持 HH:mm 格式', async () => {
  mockGetBlockKramdown.mockResolvedValue({
    kramdown: '周会 📅2026-03-17 14:00~16:00\\n{: id="block-1" }'
  });
  mockUpdateBlock.mockResolvedValue(undefined);

  const result = await updateBlockDateTime(
    'block-1',
    '2026-03-18',
    '15:30:00',
    '17:30:00',
    false,
    '2026-03-17',
    [],
    'pending',
    undefined,
    'minute'
  );

  expect(result).toBe(true);
  expect(mockUpdateBlock).toHaveBeenCalledWith(
    'markdown',
    '周会 📅2026-03-18 15:30~17:30\\n{: id="block-1" }',
    'block-1'
  );
});

it('秒级事项更新时间后继续输出 HH:mm:ss 格式', async () => {
  mockGetBlockKramdown.mockResolvedValue({
    kramdown: '校时 📅2026-03-17 14:00:05~16:00:10\\n{: id="block-1" }'
  });
  mockUpdateBlock.mockResolvedValue(undefined);

  const result = await updateBlockDateTime(
    'block-1',
    '2026-03-18',
    '15:30:05',
    '17:30:10',
    false,
    '2026-03-17',
    [],
    'pending',
    undefined,
    'second'
  );

  expect(result).toBe(true);
  expect(mockUpdateBlock.mock.calls[0][1]).toContain('15:30:05~17:30:10');
});
```

- [ ] **Step 2: Run the file utility tests to verify they fail**

Run: `npx vitest run test/utils/fileUtils.test.ts`

Expected: FAIL because `updateBlockDateTime` does not accept or honor precision yet.

- [ ] **Step 3: Define formatter helpers in `src/utils/fileUtils.ts`**

```ts
function formatTimeForPrecision(timeStr: string, precision: TimePrecision = 'second'): string {
  const normalized = formatTimeToSeconds(timeStr);
  return precision === 'minute' ? normalized.slice(0, 5) : normalized;
}

function buildTimeKey(
  item: ItemDateTimeInfo,
  fallbackPrecision: TimePrecision = 'second'
): string {
  const precision = item.timePrecision ?? fallbackPrecision;
  const startTime = item.startDateTime?.split(' ')[1];
  const endTime = item.endDateTime?.split(' ')[1];

  if (!startTime) return '';
  if (!endTime) return formatTimeForPrecision(startTime, precision);
  return `${formatTimeForPrecision(startTime, precision)}~${formatTimeForPrecision(endTime, precision)}`;
}
```

Then replace the current `timeKey` construction sites so optimization is driven by both time value and precision.

- [ ] **Step 4: Extend `updateBlockDateTime` to carry precision through rewrites**

```ts
export async function updateBlockDateTime(
  blockId: string,
  newDate: string,
  newStartTime?: string,
  newEndTime?: string,
  allDay: boolean = false,
  originalDate?: string,
  siblingItems?: ItemDateTimeInfo[],
  status?: ItemStatus,
  writer?: BlockWriter,
  timePrecision: TimePrecision = 'second'
): Promise<boolean> {
  const formattedStartTime = newStartTime ? formatTimeToSeconds(newStartTime) : undefined;
  const formattedEndTime = newEndTime
    ? formatTimeToSeconds(newEndTime)
    : (formattedStartTime ? addOneHour(formattedStartTime) : undefined);

  const updatedItem: ItemDateTimeInfo = {
    date: newDate,
    startDateTime: allDay ? undefined : (formattedStartTime ? `${newDate} ${formattedStartTime}` : undefined),
    endDateTime: allDay ? undefined : (formattedEndTime ? `${newDate} ${formattedEndTime}` : undefined),
    timePrecision: allDay ? undefined : timePrecision
  };
}
```

Also make the item-content cleanup regex accept both `HH:mm` and `HH:mm:ss`.

- [ ] **Step 5: Re-run the file utility tests**

Run: `npx vitest run test/utils/fileUtils.test.ts`

Expected: PASS for the new precision-preserving rewrite cases and existing date rewrite coverage.

- [ ] **Step 6: Commit the rewrite slice**

```bash
git add test/utils/fileUtils.test.ts src/utils/fileUtils.ts
git commit -m "feat(calendar): preserve item time precision on rewrite"
```

### Task 3: Wire the calendar event flow to pass precision through drag/resize

**Files:**
- Modify: `src/types/models.ts`
- Modify: `src/tabs/CalendarTab.vue`
- Reference: `src/components/calendar/CalendarView.vue`

- [ ] **Step 1: Add the event payload field**

```ts
extendedProps: {
  originalStartDateTime?: string;
  originalEndDateTime?: string;
  timePrecision?: TimePrecision;
  siblingItems?: ItemDateTimeInfo[];
}
```

If `CalendarEvent` construction already spreads from `Item`, use that existing pipeline rather than inventing a parallel mapper.

- [ ] **Step 2: Update the calendar tab handoff**

```ts
const timePrecision
  = eventInfo.timePrecision
    || eventInfo.extendedProps?.timePrecision
    || 'second';

const success = await updateBlockDateTime(
  blockId,
  newDate,
  newStartTime,
  newEndTime,
  allDay,
  originalDate,
  completeSiblingItems,
  status,
  undefined,
  timePrecision
);
```

Do not change the existing `startStr` / `endStr` extraction beyond what is needed to pass the precision through.

- [ ] **Step 3: Run focused tests plus type check-by-build**

Run: `npx vitest run test/parser/lineParser.test.ts test/utils/fileUtils.test.ts`

Expected: PASS

Run: `npm run build`

Expected: successful build with no new TypeScript errors.

- [ ] **Step 4: Commit the calendar wiring**

```bash
git add src/tabs/CalendarTab.vue src/types/models.ts
git commit -m "feat(calendar): thread item time precision through events"
```

### Task 4: Update docs and perform final verification

**Files:**
- Modify: `docs/user-guide/data-format.md`
- Reference: `src/parser/lineParser.ts`
- Reference: `src/utils/fileUtils.ts`

- [ ] **Step 1: Update the user guide examples**

```md
| 时间范围 | `@YYYY-MM-DD HH:mm~HH:mm` / `@YYYY-MM-DD HH:mm:ss~HH:mm:ss` | 事项时间范围 |

> 提示：事项支持 `HH:mm` 与 `HH:mm:ss` 两种格式。拖动或拉伸日历事件后，会保留原始时间精度。

整理资料 @2026-03-06 09:00~09:30, 2026-03-10 14:00:00~15:00:00
```

- [ ] **Step 2: Run the final verification set**

Run: `npx vitest run test/parser/lineParser.test.ts test/utils/fileUtils.test.ts`

Expected: PASS

Run: `npm run test`

Expected: PASS for the repo test suite, or a documented pre-existing failure unrelated to this change.

- [ ] **Step 3: Commit docs and verification results**

```bash
git add docs/user-guide/data-format.md
git commit -m "docs: describe minute precision item times"
```

## Self-Review

- Spec coverage:
  - `HH:mm` parsing: Task 1
  - internal normalization to `HH:mm:ss`: Task 1
  - markdown rewrite preserving original precision: Task 2
  - calendar drag/resize path: Task 3
  - user-facing documentation: Task 4
- Placeholder scan:
  - No `TODO` / `TBD` markers remain.
- Type consistency:
  - `TimePrecision` and `ItemDateTimeInfo` are the shared names used across parser, models, file utils, and calendar payloads.
