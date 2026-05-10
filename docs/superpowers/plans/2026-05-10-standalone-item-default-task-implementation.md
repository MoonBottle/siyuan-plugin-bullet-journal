# Standalone Item Default Task Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support dated standalone items without an explicit task line by synthesizing one document-level default task, and make that behavior consistent across parser flows, recurring write-back, MCP, and user documentation.

**Architecture:** Keep the existing `project -> task -> item` model intact. Extend parser output with a runtime-only synthetic default task marker, teach both plugin and MCP discovery paths to include standalone-item documents, and rely on existing item block positioning fields for recurring occurrence write-back so no virtual task markdown is ever emitted.

**Tech Stack:** TypeScript, Vue 3, Pinia, Vitest, SiYuan Kramdown parsing, MCP data loader utilities.

---

## File Map

**Modify**
- `src/types/models.ts` — add a runtime-only synthetic default task marker to `Task`
- `src/parser/core.ts` — create/reuse the synthetic default task and attach standalone items to it
- `src/parser/markdownParser.ts` — widen empty-directory SQL discovery for standalone-item documents
- `src/mcp/dataLoader.ts` — keep MCP discovery in sync with plugin discovery
- `test/parser/core.test.ts` — add parser regressions for standalone-only, mixed, link/pomodoro, and validity cases
- `test/services/recurringService.test.ts` — add recurrence regression proving standalone items write back as sibling items
- `test/mcp/filterItems.test.ts` — add MCP regression for standalone-item discovery/output
- `docs/user-guide/data-format.md` — document standalone items and default-task behavior

**Verify Existing Behavior**
- `src/services/recurringService.ts` — likely no code change, but validate current insert-point logic against standalone items

**Test**
- `test/parser/core.test.ts`
- `test/services/recurringService.test.ts`
- `test/mcp/filterItems.test.ts`

---

### Task 1: Add the Synthetic Default Task Type Surface

**Files:**
- Modify: `src/types/models.ts`

- [ ] **Step 1: Add the failing type use in parser tests**

Append a minimal assertion target in `test/parser/core.test.ts` that will require the new field:

```ts
expect(project!.tasks[0].isSyntheticDefault).toBe(true);
```

Place it inside the first new standalone-item parser test you add in Task 2 so TypeScript fails before implementation.

- [ ] **Step 2: Run the focused parser test to verify the type gap**

Run: `npx vitest run test/parser/core.test.ts`

Expected: FAIL with a TypeScript or runtime assertion gap because `isSyntheticDefault` is not present on `Task`.

- [ ] **Step 3: Add the runtime-only task marker**

Update `src/types/models.ts` inside `export interface Task`:

```ts
export interface Task {
  id: string;
  name: string;
  level: 'L1' | 'L2' | 'L3';
  date?: string;
  startDateTime?: string;
  endDateTime?: string;
  links?: Link[];
  items: Item[];
  lineNumber: number;
  docId?: string;
  blockId?: string;
  pomodoros?: PomodoroRecord[];
  isSyntheticDefault?: boolean;
}
```

- [ ] **Step 4: Re-run the parser test scaffold**

Run: `npx vitest run test/parser/core.test.ts`

Expected: still FAIL, but now because parser behavior is missing rather than the type surface.

- [ ] **Step 5: Commit the type-only change**

```bash
git add src/types/models.ts
git commit -m "feat(parser): mark synthetic default tasks"
```

### Task 2: Teach the Core Parser to Keep Standalone Items

**Files:**
- Modify: `src/parser/core.ts`
- Modify: `test/parser/core.test.ts`

- [ ] **Step 1: Write failing standalone-item parser tests**

Add these tests to `test/parser/core.test.ts` near other `parseKramdown` coverage:

```ts
describe('parseKramdown 独立事项解析', () => {
  it('只有独立事项的文档应生成默认任务并保留事项', () => {
    const kramdown = `## 每日记录
{: id="doc-block" type="doc" }
整理日报 @2026-05-09
{: id="item-1" updated="20260509100000" }`;

    const project = parseKramdown(kramdown, 'standalone-doc');

    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(1);
    expect(project!.tasks[0].name).toBe('默认任务');
    expect(project!.tasks[0].isSyntheticDefault).toBe(true);
    expect(project!.tasks[0].items).toHaveLength(1);
    expect(project!.tasks[0].items[0]).toMatchObject({
      content: '整理日报',
      date: '2026-05-09',
      docId: 'standalone-doc',
      blockId: 'item-1',
    });
  });

  it('显式任务与独立事项混排时应分别归属原任务与默认任务', () => {
    const kramdown = `## 项目
{: id="doc-block" type="doc" }
会前准备 @2026-05-09
{: id="standalone-1" updated="20260509100000" }
开发登录模块 #任务#
{: id="task-1" updated="20260509100100" }
编码实现 @2026-05-10
{: id="item-2" updated="20260509100200" }`;

    const project = parseKramdown(kramdown, 'mixed-doc');

    expect(project).not.toBeNull();
    expect(project!.tasks).toHaveLength(2);
    expect(project!.tasks.find(task => task.isSyntheticDefault)?.items[0].content).toBe('会前准备');
    expect(project!.tasks.find(task => task.name === '开发登录模块')?.items[0].content).toBe('编码实现');
  });

  it('独立事项下方链接与番茄钟仍归属该事项', () => {
    const kramdown = `## 每日记录
{: id="doc-block" type="doc" }
复盘会议 @2026-05-09
{: id="item-1" updated="20260509100000" }
[会议纪要](https://example.com/notes)
{: id="link-1" updated="20260509100001" }
🍅2026-05-09 09:00:00\\~09:25:00
{: id="pomodoro-1" updated="20260509100002" }`;

    const project = parseKramdown(kramdown, 'link-doc');
    const item = project!.tasks[0].items[0];

    expect(item.links?.map(link => link.url)).toContain('https://example.com/notes');
    expect(item.pomodoros).toHaveLength(1);
    expect(item.lastBlockId).toBe('pomodoro-1');
  });
});
```

- [ ] **Step 2: Run the parser tests to capture the current failure**

Run: `npx vitest run test/parser/core.test.ts`

Expected: FAIL because standalone dated lines currently do not create any task/item container.

- [ ] **Step 3: Implement synthetic default task creation in `src/parser/core.ts`**

Make the parser changes in three pieces:

1. Add a helper near the top-level parser state:

```ts
function createSyntheticDefaultTask(lineNumber: number, docId: string): Task {
  return {
    id: `task-default-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: '默认任务',
    level: 'L1',
    items: [],
    lineNumber,
    docId,
    pomodoros: [],
    isSyntheticDefault: true,
  };
}
```

2. Add parser state next to `currentTask`:

```ts
let syntheticDefaultTask: Task | null = null;
```

3. Replace the current item-only-under-task gate with standalone support. Refactor:

```ts
const isDatedNonTaskLine = (content.includes('@') || content.includes('📅')) && !hasTaskTag;

if (isDatedNonTaskLine) {
  const targetTask = currentTask ?? (syntheticDefaultTask ||= createSyntheticDefaultTask(lineNumber, docId));
  hasSeenItemForCurrentTask = true;
  // existing item link collection and item parsing logic
  // ...
  for (const item of items) {
    item.docId = docId;
    item.blockId = block.blockId;
    item.lastBlockId = blocks[lastRelatedBlockIndex].blockId;
    item.pomodoros = sharedPomodoros;
    item.isTaskList = isTaskList;
    item.listItemBlockId = listItemBlockId;
    targetTask.items.push(item);
    currentItem = item;
    lastBlockType = 'item';
  }

  if (!currentTask && syntheticDefaultTask) {
    currentTask = syntheticDefaultTask;
  }
}
```

Also make sure:

- explicit task parsing still pushes any prior `currentTask` before switching,
- synthetic default tasks are pushed into `project.tasks` at the end like normal tasks,
- the final empty-project guard accepts a synthetic task with items.

- [ ] **Step 4: Tighten the final task flush and empty-project guard**

At the end of `parseKramdown`, keep one final flush path:

```ts
if (currentTask) {
  currentTask.docId = docId;
  project.tasks.push(currentTask);
}
```

Then make the null-return guard explicitly depend on real content:

```ts
const hasTaskContent = project.tasks.some(task => task.items.length > 0 || Boolean(task.date));

if (!hasTaskContent && project.pomodoros!.length === 0 && project.habits.length === 0) {
  return null;
}
```

- [ ] **Step 5: Re-run parser tests**

Run: `npx vitest run test/parser/core.test.ts`

Expected: PASS for the new standalone-item coverage and existing parser regressions.

- [ ] **Step 6: Commit the parser behavior**

```bash
git add src/parser/core.ts test/parser/core.test.ts
git commit -m "feat(parser): keep standalone items under default task"
```

### Task 3: Keep Standalone Documents Discoverable in Plugin and MCP Scans

**Files:**
- Modify: `src/parser/markdownParser.ts`
- Modify: `src/mcp/dataLoader.ts`
- Modify: `test/mcp/filterItems.test.ts`

- [ ] **Step 1: Write the failing MCP discovery regression**

Append this test to `test/mcp/filterItems.test.ts`:

```ts
it('全库扫描时应发现只有独立事项的文档', async () => {
  const client = {
    sql: vi.fn().mockResolvedValue([
      {
        id: 'doc-standalone',
        path: '日记/2026-05-09',
        notebookId: 'notebook-1',
      },
    ]),
    getBlockKramdown: vi.fn().mockResolvedValue(`## Daily Note
{: id="doc-block" type="doc" }
整理日报 @2026-05-09
{: id="item-1" updated="20260509100000" }`),
  } as unknown as SiYuanClient;

  const result = await executeFilterItems(client, [], {
    startDate: '2026-05-09',
    endDate: '2026-05-09',
  }, 'full');

  expect(result.items).toHaveLength(1);
  expect(result.items[0]).toMatchObject({
    content: '整理日报',
    taskName: '默认任务',
    projectName: 'Daily Note',
  });
});
```

- [ ] **Step 2: Run the MCP test to verify discovery currently fails**

Run: `npx vitest run test/mcp/filterItems.test.ts`

Expected: FAIL because the full-scan SQL only discovers documents containing task markers.

- [ ] **Step 3: Expand plugin-side fallback discovery SQL**

Update `src/parser/markdownParser.ts` inside `getAllDocs()`:

```ts
const sqlQuery = `
  SELECT id, hpath as path, box as notebookId
  FROM blocks
  WHERE type = 'd'
  AND id IN (
    SELECT DISTINCT root_id FROM blocks
    WHERE (
      content LIKE '%#任务%'
      OR content LIKE '%#task%'
      OR content LIKE '%📋%'
      OR content LIKE '%🎯%'
      OR content LIKE '%@20%'
      OR content LIKE '%📅20%'
    )
    AND root_id IS NOT NULL AND root_id != ''
    AND type IN ('p', 'h', 'l', 'i')
  )
  ORDER BY updated DESC
  LIMIT 1000
`;
```

Keep the change limited to the empty-directory fallback path.

- [ ] **Step 4: Mirror the same discovery rule in MCP**

Update `src/mcp/dataLoader.ts`:

```ts
const SQL_GET_ALL_PROJECT_DOCS = `
  SELECT id, hpath as path, box as notebookId
  FROM blocks
  WHERE type = 'd'
  AND id IN (
    SELECT DISTINCT root_id FROM blocks
    WHERE (
      content LIKE '%#任务%'
      OR content LIKE '%#task%'
      OR content LIKE '%📋%'
      OR content LIKE '%🎯%'
      OR content LIKE '%@20%'
      OR content LIKE '%📅20%'
    )
    AND root_id IS NOT NULL AND root_id != ''
    AND type IN ('p', 'h', 'l', 'i')
  )
  ORDER BY updated DESC
  LIMIT 1000
`;
```

Do not change MCP item flattening logic beyond that.

- [ ] **Step 5: Re-run the MCP regression**

Run: `npx vitest run test/mcp/filterItems.test.ts`

Expected: PASS, including the new standalone-item document case.

- [ ] **Step 6: Commit the discovery changes**

```bash
git add src/parser/markdownParser.ts src/mcp/dataLoader.ts test/mcp/filterItems.test.ts
git commit -m "feat(scan): discover standalone item documents"
```

### Task 4: Verify Recurring Write-Back for Standalone Items

**Files:**
- Modify: `test/services/recurringService.test.ts`
- Verify: `src/services/recurringService.ts`

- [ ] **Step 1: Add the failing standalone recurrence regression**

Append this test to `test/services/recurringService.test.ts` in the `createNextOccurrence` block:

```ts
it('独立事项创建下次 occurrence 时不应写出虚拟任务标题', async () => {
  mockInsertBlock.mockResolvedValue([{ id: 'new-block-id' }]);

  const item: Item = {
    id: '1',
    content: '整理日报',
    date: '2026-05-09',
    status: 'completed',
    lineNumber: 1,
    docId: 'doc1',
    blockId: 'item-block',
    lastBlockId: 'pomodoro-block',
    repeatRule: { type: 'daily' },
    task: {
      id: 'task-default',
      name: '默认任务',
      level: 'L1',
      items: [],
      lineNumber: 1,
      isSyntheticDefault: true,
    },
  };

  await createNextOccurrence({} as any, item);

  expect(mockInsertBlock).toHaveBeenCalledWith(
    'markdown',
    expect.not.stringContaining('📋 默认任务'),
    undefined,
    'pomodoro-block',
    undefined,
  );
  expect(mockInsertBlock.mock.calls[0][1]).toContain('📅2026-05-10');
});
```

- [ ] **Step 2: Run the recurrence test to confirm current behavior**

Run: `npx vitest run test/services/recurringService.test.ts`

Expected: PASS if current insert-point logic is already item-based; FAIL only if the implementation accidentally serializes task context.

- [ ] **Step 3: If needed, keep `src/services/recurringService.ts` item-based**

If the test fails, make the minimal fix by ensuring `buildNextOccurrenceBlock()` only serializes item content/date/reminder/repeat metadata and never reads `item.task?.name`:

```ts
function buildNextOccurrenceBlock(item: Item, nextDate: string): string {
  const { reminder, repeatRule, endCondition } = item;
  let content = stripRecurringMarkers(stripReminderMarker(item.content))
    .replace(/[@📅]\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}:\d{2}(?:~\d{2}:\d{2}:\d{2})?)?/g, '')
    .replace(/[✅❌✔️]/gu, '')
    .trim();
  // do not prepend any task-derived markdown here
  // ...
}
```

If the test already passes, leave the implementation file unchanged and keep the new regression only.

- [ ] **Step 4: Re-run the recurrence suite**

Run: `npx vitest run test/services/recurringService.test.ts`

Expected: PASS, including the standalone-item recurrence case.

- [ ] **Step 5: Commit the recurrence verification**

```bash
git add test/services/recurringService.test.ts src/services/recurringService.ts
git commit -m "test(recurring): cover standalone item write-back"
```

### Task 5: Update User Documentation for Standalone Items

**Files:**
- Modify: `docs/user-guide/data-format.md`

- [ ] **Step 1: Add the failing doc checklist to your review notes**

Before editing, confirm the doc currently still implies “事项位于任务下方” everywhere. Use this as the failing acceptance checklist:

```text
1. 文档结构说明里允许直接写独立事项
2. 任务与事项关系一节不再暗示所有事项都必须有手写任务头
3. 重复事项示例允许独立事项场景
```

- [ ] **Step 2: Update the standalone-item docs**

Edit `docs/user-guide/data-format.md` in these places:

1. In `### 3. 事项区`, change the location description from “任务下方的内容” to wording that includes both task children and direct document entries.
2. Add a short subsection after the basic item syntax:

```markdown
### 独立事项

如果你只想快速记录待办，也可以不写任务头，直接输入带日期的事项：

```markdown
整理日报 @2026-05-09
复盘会议 @2026-05-09 18:00
```

这类事项会被插件自动归入一个内部默认任务（如“默认任务”），因此仍会正常出现在 Todo、日历、甘特图、提醒和重复事项功能中。
```

3. In `## 任务与事项的关系`, add one paragraph clarifying that explicit tasks are recommended for project decomposition, while daily-note capture may use standalone items directly.

- [ ] **Step 3: Review the rendered markdown content manually**

Run: `Select-String -Path 'docs\\user-guide\\data-format.md' -Pattern '独立事项','默认任务','任务与事项的关系' -Context 2,4`

Expected: output shows the new standalone-item section and the updated relationship wording.

- [ ] **Step 4: Commit the docs update**

```bash
git add docs/user-guide/data-format.md
git commit -m "docs(user-guide): describe standalone items"
```

### Task 6: Final Verification Sweep

**Files:**
- Modify if needed: `docs/superpowers/plans/2026-05-10-standalone-item-default-task-implementation.md`

- [ ] **Step 1: Run the focused regression commands**

Run each command separately:

```bash
npx vitest run test/parser/core.test.ts
npx vitest run test/services/recurringService.test.ts
npx vitest run test/mcp/filterItems.test.ts
```

Expected: all PASS.

- [ ] **Step 2: Run the broader relevant test slice**

Run:

```bash
npx vitest run test/parser/core.test.ts test/services/recurringService.test.ts test/mcp/filterItems.test.ts
```

Expected: PASS with no newly introduced failures in the targeted slice.

- [ ] **Step 3: Inspect the final diff for scope control**

Run:

```bash
git diff -- src/types/models.ts src/parser/core.ts src/parser/markdownParser.ts src/mcp/dataLoader.ts test/parser/core.test.ts test/services/recurringService.test.ts test/mcp/filterItems.test.ts docs/user-guide/data-format.md
```

Expected: diff only covers standalone-item parsing, discovery, MCP parity, recurrence verification, and docs.

- [ ] **Step 4: Commit the verification checkpoint if any follow-up fix was needed**

```bash
git add src/types/models.ts src/parser/core.ts src/parser/markdownParser.ts src/mcp/dataLoader.ts test/parser/core.test.ts test/services/recurringService.test.ts test/mcp/filterItems.test.ts docs/user-guide/data-format.md
git commit -m "test(parser): verify standalone item support end to end"
```

- [ ] **Step 5: Record any deviations inline**

If implementation differed from this plan, append a short note at the bottom of this file under:

```markdown
## Implementation Notes

- [date] [what changed and why]
```

Do not leave the section empty; only add it if deviations actually occurred.
