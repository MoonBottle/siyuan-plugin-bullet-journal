# Example Document Content Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the auto-generated example document so first-time users see a layered, realistic walkthrough centered on standalone items, pomodoro usage, task organization, and slash-command-first habit entry.

**Architecture:** Keep the behavior surface unchanged: `createExampleDocument()` still creates and opens one document, but `generateExampleContent()` becomes a clearer content builder that emits a structured bilingual example instead of isolated feature sentences. Add focused unit coverage around the generated markdown so the new structure, ordering, and slash-command hints stay stable.

**Tech Stack:** TypeScript, Vitest, existing i18n helpers, existing `exampleDocUtils.ts` utility

---

## File Structure

- Modify: `src/utils/exampleDocUtils.ts`
  - Keep document creation flow unchanged
  - Replace the current flat sample strings with structured zh/en example content
  - Optionally extract small local helpers/constants inside the same file if that makes the content readable
- Create: `test/utils/exampleDocUtils.test.ts`
  - Add unit tests for generated markdown structure in Chinese and English locales
  - Lock in the required command hints and ordering constraints

### Task 1: Add regression tests for the new example-document shape

**Files:**

- Create: `test/utils/exampleDocUtils.test.ts`
- Modify: `src/utils/exampleDocUtils.ts`

- [ ] **Step 1: Write the failing test for Chinese example content**

Create `test/utils/exampleDocUtils.test.ts` with a focused test that mocks locale, dates, and translation tags, then asserts the generated Chinese example contains the required sections in the required order.

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFormat = vi.fn(() => '2026-05-12')
const mockAdd = vi.fn(() => ({
  format: vi.fn(() => '2026-05-13'),
}))
const mockSubtract = vi.fn(() => ({
  format: vi.fn(() => '2026-05-11'),
}))

const mockDayjs = vi.fn(() => ({
  format: mockFormat,
  add: mockAdd,
  subtract: mockSubtract,
}))

let currentLocale = 'zh_CN'

vi.mock('@/utils/dayjs', () => ({
  default: mockDayjs,
}))

vi.mock('@/i18n', () => ({
  getCurrentLocale: () => currentLocale,
  t: (key: string) => {
    if (key === 'taskTag')
      return '#任务'
    if (key === 'dateMarker')
      return '📅'
    if (key === 'statusTag') {
      return {
        completed: '#已完成',
        abandoned: '#已放弃',
      }
    }
    return key
  },
}))

describe('generateExampleContent', () => {
  beforeEach(() => {
    currentLocale = 'zh_CN'
  })

  it('builds a layered Chinese onboarding example', async () => {
    const { generateExampleContent } = await import('@/utils/exampleDocUtils')

    const content = generateExampleContent()

    expect(content).toContain('## 任务助手示例')
    expect(content).toContain('整理日报 📅2026-05-12')
    expect(content).toContain('复盘会议 📅2026-05-12 18:00')
    expect(content).toContain('番茄专注示例')
    expect(content).toContain(`🍅2026-05-12 10:00:00~10:25:00`)
    expect(content).toContain('首页改版 📋 @L1')
    expect(content).toContain('/jt /today')
    expect(content).toContain('/xg /habit')

    const standaloneIndex = content.indexOf('## 快速开始')
    const pomodoroIndex = content.indexOf('## 事项和番茄钟')
    const projectIndex = content.indexOf('## 任务和事项')
    const moreIndex = content.indexOf('## 更多玩法')
    const slashIndex = content.indexOf('## 常用斜杠命令')

    expect(standaloneIndex).toBeGreaterThanOrEqual(0)
    expect(pomodoroIndex).toBeGreaterThan(standaloneIndex)
    expect(projectIndex).toBeGreaterThan(pomodoroIndex)
    expect(moreIndex).toBeGreaterThan(projectIndex)
    expect(slashIndex).toBeGreaterThan(moreIndex)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx vitest run test/utils/exampleDocUtils.test.ts
```

Expected: FAIL because `generateExampleContent` is not exported yet and the current content does not contain the new section headings or slash-command pairs.

- [ ] **Step 3: Export the content generator for direct testing**

Modify `src/utils/exampleDocUtils.ts` so the pure content function is exported without changing `createExampleDocument()` behavior.

```ts
export function generateExampleContent(): string {
  // existing content builder body
}
```

Keep `createExampleDocument()` calling the same function:

```ts
const content = generateExampleContent()
```

- [ ] **Step 4: Run the test again to verify it still fails on content shape**

Run:

```bash
npx vitest run test/utils/exampleDocUtils.test.ts
```

Expected: FAIL on missing headings/content, confirming the test is checking the intended structure rather than only export visibility.

- [ ] **Step 5: Commit the test harness setup**

```bash
git add test/utils/exampleDocUtils.test.ts src/utils/exampleDocUtils.ts
git commit -m "test(example-doc): cover generated sample structure"
```

### Task 2: Rewrite the Chinese example content into a layered walkthrough

**Files:**

- Modify: `src/utils/exampleDocUtils.ts`
- Test: `test/utils/exampleDocUtils.test.ts`

- [ ] **Step 1: Write a failing assertion for Chinese habit and slash-command guidance**

Extend the Chinese test so it requires the standalone-item hint, the pomodoro explanation, and the habit slash-command recommendation rather than a hand-written habit-only workflow.

```ts
expect(content).toContain('你也可以在 daily note 里直接写独立事项')
expect(content).toContain('专注结束后会自动在事项下追加一条番茄记录')
expect(content).toContain('创建或编辑习惯，推荐使用 /xg /habit')
expect(content).not.toContain('这是一个已放弃的事项')
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx vitest run test/utils/exampleDocUtils.test.ts
```

Expected: FAIL because the current Chinese example is still a flat list with no layered guidance.

- [ ] **Step 3: Implement the structured Chinese example**

Rewrite the Chinese branch in `src/utils/exampleDocUtils.ts` to emit one realistic sample document with six sections:

```ts
return `## 任务助手示例

先看前半部分就能开始使用；后半部分展示更多能力。

## 快速开始

你也可以在 daily note 里直接写独立事项：

整理日报 ${dateMarker}${today}
复盘会议 ${dateMarker}${today} 18:00
跟进发布问题 ${dateMarker}${tomorrow}

> 不想手写日期时，可用 /jt /today 和 /mt /tomorrow

## 事项和番茄钟

番茄专注示例 ${dateMarker}${today} 10:00~10:25
🍅${today} 10:00:00~10:25:00 第一次专注记录

> 专注结束后会自动在事项下追加一条番茄记录，也可以手写。

## 任务和事项

首页改版 ${taskTag} @L1

整理需求反馈 ${dateMarker}${yesterday} ${completedTag}
设计首页原型 ${dateMarker}${today} 🔥
评审视觉稿 ${dateMarker}${tomorrow} ⏰14:00

发布准备 ${taskTag} @L1

检查发布清单 ${dateMarker}${today}
发布例行检查 ${dateMarker}${tomorrow} 🔁每周

> 待办变多后，再用 /rw /task 把内容整理成任务；完成事项可用 /wc /done

## 更多玩法

晨间拉伸 🎯${today} 🔄每天
> 创建或编辑习惯，推荐使用 /xg /habit

整理培训资料 ${dateMarker}${today}, ${tomorrow}

[需求文档](https://example.com/spec)

## 常用斜杠命令

- /jt /today：添加今日事项
- /mt /tomorrow：添加明日事项
- /rw /task：标记为任务
- /wc /done：标记为完成
- /xg /habit：创建或编辑习惯
- /tx /reminder：设置提醒
- /cf /recurring：设置重复
- /zz /focus：开始番茄钟
`
```

Keep the wording tight. Do not add back the abandoned-state teaching sentence or the long command list.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npx vitest run test/utils/exampleDocUtils.test.ts
```

Expected: PASS for the Chinese test.

- [ ] **Step 5: Commit the Chinese content rewrite**

```bash
git add src/utils/exampleDocUtils.ts test/utils/exampleDocUtils.test.ts
git commit -m "feat(example-doc): restructure zh onboarding sample"
```

### Task 3: Add English coverage and rewrite the English example to match

**Files:**

- Modify: `src/utils/exampleDocUtils.ts`
- Modify: `test/utils/exampleDocUtils.test.ts`

- [ ] **Step 1: Write the failing test for English example content**

Add a second test that switches locale to `en_US` and expects the same teaching structure with English copy and paired slash commands.

```ts
it('builds a layered English onboarding example', async () => {
  currentLocale = 'en_US'
  const { generateExampleContent } = await import('@/utils/exampleDocUtils')

  const content = generateExampleContent()

  expect(content).toContain('## Task Assistant Example')
  expect(content).toContain('## Quick Start')
  expect(content).toContain('You can also add standalone items in a daily note')
  expect(content).toContain('## Items and Pomodoro')
  expect(content).toContain('## Tasks and Items')
  expect(content).toContain('## More Examples')
  expect(content).toContain('## Common Slash Commands')
  expect(content).toContain('/jt /today')
  expect(content).toContain('/xg /habit')
  expect(content).toContain('Create or edit habits with /xg /habit')
  expect(content).not.toContain('This is an abandoned item')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx vitest run test/utils/exampleDocUtils.test.ts
```

Expected: FAIL because the English example still uses the old flat sample text and single-command phrasing.

- [ ] **Step 3: Implement the structured English example**

Rewrite the English branch in `src/utils/exampleDocUtils.ts` to mirror the same section order and command-pair strategy.

```ts
return `## Task Assistant Example

Start with the first half. The rest shows more features when you need them.

## Quick Start

You can also add standalone items in a daily note:

Write daily summary ${dateMarker}${today}
Review meeting notes ${dateMarker}${today} 18:00
Follow up on release issues ${dateMarker}${tomorrow}

> Skip manual dates with /jt /today and /mt /tomorrow

## Items and Pomodoro

Pomodoro focus example ${dateMarker}${today} 10:00~10:25
🍅${today} 10:00:00~10:25:00 First focus record

> After a focus session, the pomodoro record is added under the item automatically. You can also write it manually.

## Tasks and Items

Homepage refresh ${taskTag} @L1

Review user feedback ${dateMarker}${yesterday} ${completedTag}
Design the homepage draft ${dateMarker}${today} 🔥
Review visual draft ${dateMarker}${tomorrow} ⏰14:00

Release prep ${taskTag} @L1

Check the release checklist ${dateMarker}${today}
Weekly release review ${dateMarker}${tomorrow} 🔁weekly

> When items start to pile up, use /rw /task to organize them. Mark completed items with /wc /done.

## More Examples

Morning stretch 🎯${today} 🔄daily
> Create or edit habits with /xg /habit

Prepare workshop material ${dateMarker}${today}, ${tomorrow}

[Spec doc](https://example.com/spec)

## Common Slash Commands

- /jt /today: Add today's item
- /mt /tomorrow: Add tomorrow's item
- /rw /task: Mark as task
- /wc /done: Mark as done
- /xg /habit: Create or edit habits
- /tx /reminder: Set reminder
- /cf /recurring: Set recurring
- /zz /focus: Start pomodoro
`
```

Keep the command list aligned with the Chinese version, and keep bilingual command pairs even in English locale.

- [ ] **Step 4: Run the targeted test to verify both locales pass**

Run:

```bash
npx vitest run test/utils/exampleDocUtils.test.ts
```

Expected: PASS with both zh and en tests green.

- [ ] **Step 5: Commit the English content rewrite**

```bash
git add src/utils/exampleDocUtils.ts test/utils/exampleDocUtils.test.ts
git commit -m "feat(example-doc): align en sample with onboarding flow"
```

### Task 4: Verify document creation flow still works with the new content

**Files:**

- Modify: `src/utils/exampleDocUtils.ts` (only if cleanup is still needed)
- Test: `test/utils/exampleDocUtils.test.ts`

- [ ] **Step 1: Add a small integration-style assertion around `createExampleDocument` input**

Extend `test/utils/exampleDocUtils.test.ts` by mocking `createDocWithMd` and checking that `createExampleDocument()` passes the newly generated structured markdown through unchanged.

```ts
const createDocWithMd = vi.fn(async () => 'doc-id')
const pushMsg = vi.fn(async () => {})
const openDocument = vi.fn(async () => {})
const expandDocTree = vi.fn()

vi.mock('@/api', () => ({
  createDocWithMd,
  pushMsg,
}))

vi.mock('@/utils/fileUtils', () => ({
  openDocument,
}))

vi.mock('@/utils/notebookUtils', () => ({
  getOrCreateTaskAssistantNotebook: vi.fn(async () => ({
    id: 'notebook-id',
    name: 'Task Assistant',
  })),
}))

vi.mock('siyuan', () => ({
  expandDocTree,
}))

it('passes the structured content into document creation', async () => {
  currentLocale = 'zh_CN'
  const { createExampleDocument } = await import('@/utils/exampleDocUtils')

  await createExampleDocument()

  expect(createDocWithMd).toHaveBeenCalledTimes(1)
  expect(createDocWithMd.mock.calls[0][2]).toContain('## 快速开始')
  expect(createDocWithMd.mock.calls[0][2]).toContain('/xg /habit')
})
```

- [ ] **Step 2: Run the targeted test to verify it fails if the plumbing is wrong**

Run:

```bash
npx vitest run test/utils/exampleDocUtils.test.ts
```

Expected: PASS if the content builder export and document creation path are already wired correctly; otherwise FAIL and fix the mock/import wiring before proceeding. This step is specifically a plumbing check, not a new feature check.

- [ ] **Step 3: Do minimal cleanup only if the test exposed wiring issues**

If needed, keep the implementation scoped to readability and testability only. Acceptable cleanup inside `src/utils/exampleDocUtils.ts`:

```ts
function buildSlashCommandHint(lines: string[]): string {
  return lines.join('\n')
}
```

Do not change notebook creation, document open, or success-message behavior.

- [ ] **Step 4: Run the focused tests and one existing consumer test**

Run:

```bash
npx vitest run test/utils/exampleDocUtils.test.ts test/components/todo/TodoSidebarList.test.ts
```

Expected: PASS. The existing component test should remain green because the public API of `createExampleDocument()` did not change.

- [ ] **Step 5: Commit the verification pass**

```bash
git add src/utils/exampleDocUtils.ts test/utils/exampleDocUtils.test.ts
git commit -m "test(example-doc): verify generated content wiring"
```

## Self-Review

- Spec coverage:
  - Standalone items front-loaded: covered in Task 1 and Task 2
  - Pomodoro moved before task hierarchy: covered in Task 1 and Task 2
  - Task organization shown as second-layer workflow: covered in Task 2 and Task 3
  - Bilingual slash-command pairs: covered in Task 1 and Task 3
  - Habit creation via `/xg` / `/habit`: covered in Task 2 and Task 3
  - No `data-format.md` changes: respected by file scope
- Placeholder scan:
  - No `TODO`/`TBD` placeholders
  - Commands, files, and expected results are explicit
- Type consistency:
  - Uses existing `createExampleDocument()` name
  - Uses `generateExampleContent()` as the pure function export consistently in tests and implementation
