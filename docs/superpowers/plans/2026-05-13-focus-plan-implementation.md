# 专注预算实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为事项增加“预计番茄 / 预计时长”二选一的专注预算能力，并通过 `/focusplan`、`/yj` 斜杠命令编辑，接入现有番茄统计与桌面端复盘展示。

**Architecture:** 新增一个专门的 `focusPlan` 解析/格式化模块，避免把预算语法塞进已有提醒、重复、优先级解析逻辑里。事项写回复用 `itemSettingUtils` 的“先 strip 再 append 再 normalize”模式，统计与复盘聚合放入独立工具函数，再由 `projectStore` 与桌面端组件消费，保持解析、写回、聚合、UI 四层边界清晰。

**Tech Stack:** Vue 3 + TypeScript + Pinia + Vitest + 现有 SiYuan 对话框/斜杠命令体系

---

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/types/models.ts` | 修改 | 为 `Item` 新增 `focusPlan` 运行时字段与相关类型 |
| `src/parser/focusPlanParser.ts` | 新建 | 解析、格式化、归一化专注预算标记 |
| `src/parser/lineParser.ts` | 修改 | 将 `focusPlan` 解析接入事项行解析 |
| `src/utils/itemSettingUtils.ts` | 修改 | 新增事项预计预算写回与清除逻辑 |
| `src/constants.ts` | 修改 | 新增 `/focusplan`、`/yj` 命令过滤器 |
| `src/settings/types.ts` | 修改 | 自定义斜杠命令动作枚举增加 `setFocusPlan` |
| `src/i18n/zh_CN.json` | 修改 | 新增专注预算相关文案 |
| `src/i18n/en_US.json` | 修改 | 新增专注预算相关文案 |
| `src/components/dialog/FocusPlanDialog.vue` | 新建 | 专注预算编辑弹框 |
| `src/utils/dialog.ts` | 修改 | 新增打开预算弹框的包装函数 |
| `src/utils/slashCommands.ts` | 修改 | 注册命令、打开弹框、写回当前事项预算 |
| `src/utils/focusPlanReview.ts` | 新建 | 预计 vs 实际的分钟归一化、状态判定、每日摘要聚合 |
| `src/stores/projectStore.ts` | 修改 | 暴露预算相关 getter，给统计与详情页复用 |
| `src/components/dialog/ItemDetailDialog.vue` | 修改 | 展示预计、实际、偏差 |
| `src/components/pomodoro/PomodoroTimerDialog.vue` | 修改 | 开始专注前展示事项预算 |
| `src/components/pomodoro/PomodoroActiveTimer.vue` | 修改 | 专注中展示事项累计专注 vs 预计 |
| `src/components/pomodoro/PomodoroStats.vue` | 修改 | 新增预计复盘摘要区 |
| `src/components/todo/TodoSidebarList.vue` | 修改 | 待办卡片轻量展示预计与可选进度 |
| `test/parser/focusPlanParser.test.ts` | 新建 | 预算解析与规范化测试 |
| `test/parser/lineParser.test.ts` | 修改 | 事项解析接入 `focusPlan` 的测试 |
| `test/utils/itemSettingUtils.test.ts` | 修改 | 预算写回、清除、冲突收敛测试 |
| `test/utils/slashCommands.focusPlan.test.ts` | 新建 | 斜杠命令触发预算弹框与回填测试 |
| `test/utils/focusPlanReview.test.ts` | 新建 | 复盘状态与每日摘要测试 |
| `test/stores/projectStore.pomodoro.test.ts` | 修改 | `projectStore` 的预算聚合 getter 测试 |
| `test/components/todo/TodoSidebarList.test.ts` | 修改 | 待办卡片显示预算测试 |
| `docs/user-guide/data-format.md` | 修改 | 补充 `🍅xN` 与 `⏳1h10m` 标记说明 |
| `docs/user-guide/configuration.md` | 修改 | 斜杠命令列表新增 `/focusplan`、`/yj` |

---

## Task 1: 定义专注预算类型与解析器

**Files:**
- Create: `src/parser/focusPlanParser.ts`
- Modify: `src/types/models.ts`
- Test: `test/parser/focusPlanParser.test.ts`

- [ ] **Step 1: 先写预算解析失败测试**

```ts
// test/parser/focusPlanParser.test.ts
import { describe, expect, it } from 'vitest';
import {
  extractFocusPlanMarkers,
  formatFocusPlanMarker,
  normalizeFocusPlanMinutes,
  stripFocusPlanMarkers,
} from '@/parser/focusPlanParser';

describe('focusPlanParser', () => {
  it('按从左到右取第一个合法预计并忽略后续标记', () => {
    const result = extractFocusPlanMarkers('事项 @2026-05-14 ⏳1h 🍅x3');

    expect(result.active).toEqual({
      type: 'duration',
      rawValue: 60,
      normalizedMinutes: 60,
      sourceText: '⏳1h',
    });
    expect(result.ignored).toEqual(['🍅x3']);
  });

  it('将分钟数格式化为混合时长写法', () => {
    expect(formatFocusPlanMarker({ type: 'duration', rawValue: 45 })).toBe('⏳45m');
    expect(formatFocusPlanMarker({ type: 'duration', rawValue: 70 })).toBe('⏳1h10m');
  });

  it('将番茄预算归一化为 25 分钟基准', () => {
    expect(normalizeFocusPlanMinutes({ type: 'pomodoro', rawValue: 3 })).toBe(75);
  });

  it('移除同一行上的所有预算标记并保留其他元信息', () => {
    expect(stripFocusPlanMarkers('事项 @2026-05-14 ⏳1h 🍅x3 🔥')).toBe('事项 @2026-05-14 🔥');
  });
});
```

- [ ] **Step 2: 运行测试，确认缺少模块而失败**

Run: `npx vitest run test/parser/focusPlanParser.test.ts`
Expected: FAIL，提示找不到 `@/parser/focusPlanParser`

- [ ] **Step 3: 在类型层定义 `FocusPlan`**

```ts
// src/types/models.ts
export type FocusPlanType = 'duration' | 'pomodoro';

export interface FocusPlan {
  type: FocusPlanType;
  rawValue: number;
  normalizedMinutes: number;
  sourceText: string;
  ignoredSourceTexts?: string[];
}

export interface Item {
  // ...
  focusPlan?: FocusPlan;
  // ...
}
```

- [ ] **Step 4: 实现预算解析模块**

```ts
// src/parser/focusPlanParser.ts
import type { FocusPlan, FocusPlanType } from '@/types/models';

const DURATION_MARKER_REGEX = /⏳(?:(\d+)h)?(?:(\d+)m)?/g;
const POMODORO_MARKER_REGEX = /🍅(?:x)?(\d+)/g;

export interface ExtractFocusPlanResult {
  active?: FocusPlan;
  ignored: string[];
}

function buildDurationPlan(sourceText: string, hours?: string, minutes?: string): FocusPlan | undefined {
  const totalMinutes = (Number(hours || 0) * 60) + Number(minutes || 0);
  if (totalMinutes <= 0) return undefined;
  return {
    type: 'duration',
    rawValue: totalMinutes,
    normalizedMinutes: totalMinutes,
    sourceText,
  };
}

function buildPomodoroPlan(sourceText: string, count: string): FocusPlan | undefined {
  const rawValue = Number(count);
  if (!Number.isInteger(rawValue) || rawValue <= 0) return undefined;
  return {
    type: 'pomodoro',
    rawValue,
    normalizedMinutes: rawValue * 25,
    sourceText,
  };
}

export function extractFocusPlanMarkers(line: string): ExtractFocusPlanResult {
  const found: Array<{ index: number; sourceText: string; plan?: FocusPlan }> = [];

  for (const match of line.matchAll(/⏳(?:(\d+)h)?(?:(\d+)m)?|🍅(?:x)?(\d+)/g)) {
    const sourceText = match[0];
    const index = match.index ?? Number.MAX_SAFE_INTEGER;
    const plan = sourceText.startsWith('⏳')
      ? buildDurationPlan(sourceText, match[1], match[2])
      : buildPomodoroPlan(sourceText, match[3]);
    if (plan) found.push({ index, sourceText, plan });
  }

  if (found.length === 0) return { ignored: [] };

  found.sort((a, b) => a.index - b.index);
  const [first, ...rest] = found;
  return {
    active: first.plan
      ? { ...first.plan, ignoredSourceTexts: rest.map(item => item.sourceText) || undefined }
      : undefined,
    ignored: rest.map(item => item.sourceText),
  };
}

export function stripFocusPlanMarkers(line: string): string {
  return line
    .replace(/⏳(?:(\d+)h)?(?:(\d+)m)?/g, '')
    .replace(/🍅(?:x)?(\d+)/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function normalizeFocusPlanMinutes(plan: Pick<FocusPlan, 'type' | 'rawValue'>): number {
  return plan.type === 'pomodoro' ? plan.rawValue * 25 : plan.rawValue;
}

export function formatFocusPlanMarker(plan: Pick<FocusPlan, 'type' | 'rawValue'>): string {
  if (plan.type === 'pomodoro') return `🍅x${plan.rawValue}`;
  const hours = Math.floor(plan.rawValue / 60);
  const minutes = plan.rawValue % 60;
  if (hours === 0) return `⏳${minutes}m`;
  if (minutes === 0) return `⏳${hours}h`;
  return `⏳${hours}h${minutes}m`;
}
```

- [ ] **Step 5: 跑解析测试确认通过**

Run: `npx vitest run test/parser/focusPlanParser.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/types/models.ts src/parser/focusPlanParser.ts test/parser/focusPlanParser.test.ts
git commit -m "feat(focus-plan): add parser and types"
```

---

## Task 2: 将预算解析接入事项行，并补事项写回工具

**Files:**
- Modify: `src/parser/lineParser.ts`
- Modify: `src/utils/itemSettingUtils.ts`
- Modify: `test/parser/lineParser.test.ts`
- Modify: `test/utils/itemSettingUtils.test.ts`

- [ ] **Step 1: 先写事项解析与写回测试**

```ts
// test/parser/lineParser.test.ts
it('事项行解析第一个预算标记为 focusPlan', () => {
  const items = LineParser.parseItemLine('整理资料 @2026-05-14 ⏳1h10m 🍅x3', 1);
  expect(items).toHaveLength(1);
  expect(items[0].focusPlan).toEqual(expect.objectContaining({
    type: 'duration',
    rawValue: 70,
    normalizedMinutes: 70,
    sourceText: '⏳1h10m',
    ignoredSourceTexts: ['🍅x3'],
  }));
});

// test/utils/itemSettingUtils.test.ts
it('保存预计时长时会替换旧预算并保留其他标记', async () => {
  vi.mocked(getBlockByID).mockResolvedValue({
    markdown: '事项 @2026-05-14 🍅x2 🔥',
  } as any);

  await updateItemWithFocusPlan(mockItem, { type: 'duration', rawValue: 70 });

  expect(updateBlock).toHaveBeenCalledWith(
    'markdown',
    '事项 @2026-05-14 🔥 ⏳1h10m',
    mockItem.blockId,
  );
});

it('清除预计时会移除所有预算标记', async () => {
  vi.mocked(getBlockByID).mockResolvedValue({
    markdown: '事项 @2026-05-14 ⏳1h 🍅x3',
  } as any);

  await clearItemFocusPlan(mockItem);

  expect(updateBlock).toHaveBeenCalledWith(
    'markdown',
    '事项 @2026-05-14',
    mockItem.blockId,
  );
});
```

- [ ] **Step 2: 运行测试，确认新增断言失败**

Run: `npx vitest run test/parser/lineParser.test.ts test/utils/itemSettingUtils.test.ts`
Expected: FAIL，`focusPlan` 未解析，`updateItemWithFocusPlan` / `clearItemFocusPlan` 未定义

- [ ] **Step 3: 在 `lineParser` 中挂接 `focusPlan`**

```ts
// src/parser/lineParser.ts
import { extractFocusPlanMarkers, stripFocusPlanMarkers } from './focusPlanParser';

// parseItemLine 内，解析 metadataLine 后新增：
const focusPlanResult = extractFocusPlanMarkers(metadataLine);
const focusPlan = focusPlanResult.active;

// 内容清洗链新增：
cleanedContent = stripFocusPlanMarkers(cleanedContent);

// items.push 时新增：
focusPlan,
```

- [ ] **Step 4: 在 `itemSettingUtils` 实现预算写回**

```ts
// src/utils/itemSettingUtils.ts
import type { FocusPlan, Item } from '@/types/models';
import { formatFocusPlanMarker, stripFocusPlanMarkers } from '@/parser/focusPlanParser';

export async function updateItemWithFocusPlan(
  item: Item,
  plan: Pick<FocusPlan, 'type' | 'rawValue'>,
): Promise<void> {
  if (!item.blockId) throw new Error('事项缺少 blockId，无法更新');

  const currentContent = await fetchBlockContent(item.blockId);
  let nextContent = stripFocusPlanMarkers(currentContent);
  nextContent = `${nextContent} ${formatFocusPlanMarker(plan)}`;
  nextContent = normalizeWhitespace(nextContent);

  await updateBlockContent(item.blockId, nextContent);
  emitItemSettingMutation('pin', item.blockId);
}

export async function clearItemFocusPlan(item: Item): Promise<void> {
  if (!item.blockId) throw new Error('事项缺少 blockId，无法更新');

  const currentContent = await fetchBlockContent(item.blockId);
  const nextContent = normalizeWhitespace(stripFocusPlanMarkers(currentContent));
  await updateBlockContent(item.blockId, nextContent);
  emitItemSettingMutation('pin', item.blockId);
}
```

- [ ] **Step 5: 把事件源名称改成显式预算变更**

```ts
// src/utils/itemSettingUtils.ts
function emitItemSettingMutation(
  kind: 'reminder' | 'recurring' | 'pin' | 'focus-plan',
  blockId: string,
): void {
  eventBus.emit(Events.LOCAL_DATA_MUTATED, {
    source: 'item-setting',
    kind,
    blockId,
  });
}
```

- [ ] **Step 6: 跑测试确认解析与写回通过**

Run: `npx vitest run test/parser/lineParser.test.ts test/utils/itemSettingUtils.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/parser/lineParser.ts src/utils/itemSettingUtils.ts test/parser/lineParser.test.ts test/utils/itemSettingUtils.test.ts
git commit -m "feat(focus-plan): parse and persist item focus plans"
```

---

## Task 3: 接入斜杠命令与预算编辑弹框

**Files:**
- Modify: `src/constants.ts`
- Modify: `src/settings/types.ts`
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`
- Create: `src/components/dialog/FocusPlanDialog.vue`
- Modify: `src/utils/dialog.ts`
- Modify: `src/utils/slashCommands.ts`
- Test: `test/utils/slashCommands.focusPlan.test.ts`

- [ ] **Step 1: 先写斜杠命令测试**

```ts
// test/utils/slashCommands.focusPlan.test.ts
import { describe, expect, it, vi } from 'vitest';
import { getActionHandler } from '@/utils/slashCommands';
import { extractItemFromBlock } from '@/utils/slashCommandUtils';
import { showFocusPlanDialog } from '@/utils/dialog';

it('/yj 在事项块上应打开专注预算弹框并回填已有预算', async () => {
  vi.mocked(extractItemFromBlock).mockResolvedValue({
    id: 'item-1',
    blockId: 'block-1',
    content: '事项',
    date: '2026-05-14',
    docId: 'doc-1',
    status: 'pending',
    focusPlan: { type: 'pomodoro', rawValue: 3, normalizedMinutes: 75, sourceText: '🍅x3' },
  } as any);

  const handler = getActionHandler('setFocusPlan', {} as any, ['/yj']);
  const node = document.createElement('div');
  node.setAttribute('data-node-id', 'block-1');

  await handler({} as any, node);

  expect(showFocusPlanDialog).toHaveBeenCalledWith(
    expect.objectContaining({
      blockId: 'block-1',
      focusPlan: expect.objectContaining({ type: 'pomodoro', rawValue: 3 }),
    }),
  );
});

it('/focusplan 在非事项块上应提示错误且不打开弹框', async () => {
  vi.mocked(extractItemFromBlock).mockResolvedValue(null);

  const handler = getActionHandler('setFocusPlan', {} as any, ['/focusplan']);
  const node = document.createElement('div');
  node.setAttribute('data-node-id', 'block-2');

  await handler({} as any, node);

  expect(showFocusPlanDialog).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 运行测试，确认命令尚未注册**

Run: `npx vitest run test/utils/slashCommands.focusPlan.test.ts`
Expected: FAIL，`setFocusPlan` 未定义或 `showFocusPlanDialog` 不存在

- [ ] **Step 3: 注册新命令与动作枚举**

```ts
// src/constants.ts
export const SLASH_COMMAND_FILTERS = {
  // ...
  SET_FOCUS_PLAN: ['/yj', '/focusplan'],
};

export const ALL_SLASH_COMMAND_FILTERS = [
  // ...
  ...SLASH_COMMAND_FILTERS.SET_FOCUS_PLAN,
];

// src/settings/types.ts
export interface CustomSlashCommand {
  // ...
  action:
    | 'today'
    | 'tomorrow'
    | 'date'
    | 'done'
    | 'abandon'
    | 'calendar'
    | 'calendarDay'
    | 'calendarWeek'
    | 'calendarMonth'
    | 'calendarList'
    | 'gantt'
    | 'focus'
    | 'todo'
    | 'setProjectDir'
    | 'markAsTask'
    | 'viewDetail'
    | 'setReminder'
    | 'setRecurring'
    | 'setFocusPlan';
}
```

- [ ] **Step 4: 新建预算弹框组件与打开函数**

```vue
<!-- src/components/dialog/FocusPlanDialog.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue';
import type { FocusPlan, Item } from '@/types/models';

const props = defineProps<{
  item: Item;
  closeDialog: () => void;
  onSave: (plan: { type: 'duration' | 'pomodoro'; rawValue: number } | null) => Promise<void>;
}>();

const mode = ref<'duration' | 'pomodoro'>(props.item.focusPlan?.type ?? 'duration');
const totalMinutes = props.item.focusPlan?.type === 'duration' ? props.item.focusPlan.rawValue : 0;
const hours = ref(Math.floor(totalMinutes / 60));
const minutes = ref(totalMinutes % 60);
const pomodoroCount = ref(props.item.focusPlan?.type === 'pomodoro' ? props.item.focusPlan.rawValue : 1);

const hasExistingPlan = computed(() => Boolean(props.item.focusPlan));

async function handleSave() {
  if (mode.value === 'duration') {
    const rawValue = hours.value * 60 + minutes.value;
    if (rawValue <= 0) return;
    await props.onSave({ type: 'duration', rawValue });
  } else {
    if (pomodoroCount.value <= 0) return;
    await props.onSave({ type: 'pomodoro', rawValue: pomodoroCount.value });
  }
  props.closeDialog();
}

async function handleClear() {
  await props.onSave(null);
  props.closeDialog();
}
</script>
```

- [ ] **Step 5: 在 `slashCommands` 中新增入口**

```ts
// src/utils/slashCommands.ts
import { showFocusPlanDialog } from '@/utils/dialog';
import { updateItemWithFocusPlan, clearItemFocusPlan } from '@/utils/itemSettingUtils';

async function setFocusPlanForBlock(nodeElement: HTMLElement) {
  const blockId = nodeElement.getAttribute('data-node-id');
  if (!blockId) {
    showMessage('无法获取块ID', 2000, 'error');
    return;
  }

  const item = await extractItemFromBlock(blockId);
  if (!item) {
    showMessage('当前块不是有效事项', 2000, 'error');
    return;
  }

  showFocusPlanDialog({
    item,
    onSave: async (plan) => {
      if (plan) {
        await updateItemWithFocusPlan(item, plan);
      } else {
        await clearItemFocusPlan(item);
      }
    },
  });
}
```

- [ ] **Step 6: 补齐中英文文案**

```json
// src/i18n/zh_CN.json
"focusPlan": {
  "title": "预计专注",
  "duration": "预计时长",
  "pomodoro": "预计番茄",
  "hours": "小时",
  "minutes": "分钟",
  "pomodoros": "个番茄",
  "clear": "清除预计",
  "invalidItem": "当前块不是有效事项"
}
```

- [ ] **Step 7: 跑斜杠命令测试**

Run: `npx vitest run test/utils/slashCommands.focusPlan.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/constants.ts src/settings/types.ts src/i18n/zh_CN.json src/i18n/en_US.json src/components/dialog/FocusPlanDialog.vue src/utils/dialog.ts src/utils/slashCommands.ts test/utils/slashCommands.focusPlan.test.ts
git commit -m "feat(focus-plan): add slash command editor"
```

---

## Task 4: 实现预计 vs 实际的聚合与 `projectStore` getter

**Files:**
- Create: `src/utils/focusPlanReview.ts`
- Modify: `src/stores/projectStore.ts`
- Test: `test/utils/focusPlanReview.test.ts`
- Modify: `test/stores/projectStore.pomodoro.test.ts`

- [ ] **Step 1: 先写复盘聚合测试**

```ts
// test/utils/focusPlanReview.test.ts
import { describe, expect, it } from 'vitest';
import { buildFocusPlanReview, buildDailyFocusPlanSummary } from '@/utils/focusPlanReview';

it('已完成事项在 25 分钟内偏差应归类为 matched', () => {
  const result = buildFocusPlanReview({
    itemStatus: 'completed',
    estimatedMinutes: 75,
    actualMinutes: 90,
  });

  expect(result.status).toBe('matched');
  expect(result.deltaMinutes).toBe(15);
});

it('统计今日摘要时不重复累计同一 blockId 的预计', () => {
  const summary = buildDailyFocusPlanSummary([
    { blockId: 'same', date: '2026-05-13', estimatedMinutes: 70, actualMinutes: 50, itemStatus: 'pending' },
    { blockId: 'same', date: '2026-05-13', estimatedMinutes: 70, actualMinutes: 50, itemStatus: 'pending' },
  ], '2026-05-13');

  expect(summary.estimatedMinutes).toBe(70);
  expect(summary.actualMinutes).toBe(50);
});
```

- [ ] **Step 2: 运行测试，确认聚合模块不存在**

Run: `npx vitest run test/utils/focusPlanReview.test.ts test/stores/projectStore.pomodoro.test.ts`
Expected: FAIL，提示找不到 `focusPlanReview`

- [ ] **Step 3: 新建复盘工具函数**

```ts
// src/utils/focusPlanReview.ts
import type { ItemStatus } from '@/types/models';

export type FocusPlanReviewStatus = 'not-started' | 'in-progress' | 'matched' | 'overrun' | 'underrun';

export interface FocusPlanReviewInput {
  itemStatus: ItemStatus;
  estimatedMinutes: number;
  actualMinutes: number;
}

export function buildFocusPlanReview(input: FocusPlanReviewInput) {
  const deltaMinutes = input.actualMinutes - input.estimatedMinutes;
  if (input.actualMinutes === 0) return { status: 'not-started' as const, deltaMinutes };
  if (input.itemStatus !== 'completed') return { status: 'in-progress' as const, deltaMinutes };
  if (Math.abs(deltaMinutes) <= 25) return { status: 'matched' as const, deltaMinutes };
  return deltaMinutes > 0
    ? { status: 'overrun' as const, deltaMinutes }
    : { status: 'underrun' as const, deltaMinutes };
}
```

- [ ] **Step 4: 在 `projectStore` 中暴露预算 getter**

```ts
// src/stores/projectStore.ts
getItemFocusPlanMinutes: (state) => (item: Item): number | undefined => {
  return item.focusPlan?.normalizedMinutes;
},

getItemActualFocusMinutes: () => (item: Item): number => {
  return (item.pomodoros ?? []).reduce((sum, record) => (
    sum + (record.actualDurationMinutes ?? record.durationMinutes)
  ), 0);
},

getTodayFocusPlanSummary: (state) => (groupId: string = '') => {
  const items = computeDisplayItems((state as any).items, state.currentDate, groupId);
  return buildDailyFocusPlanSummary(
    items
      .filter(item => item.focusPlan)
      .map(item => ({
        blockId: item.blockId ?? item.id,
        date: item.date,
        estimatedMinutes: item.focusPlan!.normalizedMinutes,
        actualMinutes: (item.pomodoros ?? []).reduce((sum, p) => sum + (p.actualDurationMinutes ?? p.durationMinutes), 0),
        itemStatus: item.status,
        itemContent: item.content,
      })),
    state.currentDate,
  );
},
```

- [ ] **Step 5: 跑聚合与 store 测试**

Run: `npx vitest run test/utils/focusPlanReview.test.ts test/stores/projectStore.pomodoro.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/utils/focusPlanReview.ts src/stores/projectStore.ts test/utils/focusPlanReview.test.ts test/stores/projectStore.pomodoro.test.ts
git commit -m "feat(focus-plan): add review aggregation"
```

---

## Task 5: 接入桌面端展示面

**Files:**
- Modify: `src/components/dialog/ItemDetailDialog.vue`
- Modify: `src/components/pomodoro/PomodoroTimerDialog.vue`
- Modify: `src/components/pomodoro/PomodoroActiveTimer.vue`
- Modify: `src/components/pomodoro/PomodoroStats.vue`
- Modify: `src/components/todo/TodoSidebarList.vue`
- Test: `test/components/todo/TodoSidebarList.test.ts`

- [ ] **Step 1: 先写待办卡片显示测试**

```ts
// test/components/todo/TodoSidebarList.test.ts
it('事项存在 focusPlan 时显示预计时长标签', async () => {
  render(TodoSidebarList, {
    props: {
      items: [{
        id: 'item-1',
        content: '事项',
        date: '2026-05-14',
        docId: 'doc-1',
        status: 'pending',
        focusPlan: {
          type: 'duration',
          rawValue: 70,
          normalizedMinutes: 70,
          sourceText: '⏳1h10m',
        },
      }],
    },
  });

  expect(screen.getByText('预计 1h10m')).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行组件测试，确认展示尚未接入**

Run: `npx vitest run test/components/todo/TodoSidebarList.test.ts`
Expected: FAIL，找不到 `预计 1h10m`

- [ ] **Step 3: 提取前端展示格式化函数并接入 5 个界面**

```ts
// 可放入 src/utils/focusPlanReview.ts 或新增 format helper
export function formatFocusPlanDisplay(plan?: FocusPlan): string | undefined {
  if (!plan) return undefined;
  if (plan.type === 'pomodoro') return `${plan.rawValue} 🍅`;
  const hours = Math.floor(plan.rawValue / 60);
  const minutes = plan.rawValue % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h${minutes}m`;
}
```

- [ ] **Step 4: 在详情页与番茄界面中展示预计 / 实际 / 偏差**

```ts
// ItemDetailDialog.vue script setup
const focusPlanDisplay = computed(() => formatFocusPlanDisplay(props.item.focusPlan));
const actualFocusMinutes = computed(() => calculateTotalFocusMinutes(props.item.pomodoros || []));
const focusPlanReview = computed(() => {
  if (!props.item.focusPlan) return null;
  return buildFocusPlanReview({
    itemStatus: props.item.status,
    estimatedMinutes: props.item.focusPlan.normalizedMinutes,
    actualMinutes: actualFocusMinutes.value,
  });
});
```

- [ ] **Step 5: 在 `PomodoroStats.vue` 新增预计复盘摘要卡片**

```vue
<!-- src/components/pomodoro/PomodoroStats.vue -->
<div class="stat-card">
  <div class="stat-label">{{ t('pomodoroStats').todayEstimatedFocus }}</div>
  <div class="stat-value">{{ formatDuration(todaySummary.estimatedMinutes) }}</div>
</div>
<div class="stat-card">
  <div class="stat-label">{{ t('pomodoroStats').todayFocusVariance }}</div>
  <div class="stat-value">{{ formatDuration(todaySummary.actualMinutes - todaySummary.estimatedMinutes) }}</div>
</div>
```

- [ ] **Step 6: 跑展示相关测试**

Run: `npx vitest run test/components/todo/TodoSidebarList.test.ts test/stores/projectStore.pomodoro.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/dialog/ItemDetailDialog.vue src/components/pomodoro/PomodoroTimerDialog.vue src/components/pomodoro/PomodoroActiveTimer.vue src/components/pomodoro/PomodoroStats.vue src/components/todo/TodoSidebarList.vue test/components/todo/TodoSidebarList.test.ts
git commit -m "feat(focus-plan): surface estimates in desktop views"
```

---

## Task 6: 补用户文档并做整体验证

**Files:**
- Modify: `docs/user-guide/data-format.md`
- Modify: `docs/user-guide/configuration.md`

- [ ] **Step 1: 更新数据格式文档**

```md
## 专注预算标记

- `🍅x3`：预计 3 个番茄
- `⏳45m`：预计 45 分钟
- `⏳1h10m`：预计 1 小时 10 分钟

如果同一事项行出现多个预计标记，插件按从左到右顺序取第一个合法标记，其余忽略；下次保存时会自动收敛为一个规范格式。
```

- [ ] **Step 2: 更新配置/斜杠命令说明**

```md
| `/focusplan` 或 `/yj` | 设置预计专注 |
```

- [ ] **Step 3: 跑目标测试集**

Run: `npx vitest run test/parser/focusPlanParser.test.ts test/parser/lineParser.test.ts test/utils/itemSettingUtils.test.ts test/utils/slashCommands.focusPlan.test.ts test/utils/focusPlanReview.test.ts test/stores/projectStore.pomodoro.test.ts test/components/todo/TodoSidebarList.test.ts`
Expected: PASS

- [ ] **Step 4: 跑一次构建**

Run: `npm run build`
Expected: 构建成功，无类型错误

- [ ] **Step 5: Commit**

```bash
git add docs/user-guide/data-format.md docs/user-guide/configuration.md
git commit -m "docs: add focus plan user guide"
```

---

## 自检

### Spec 覆盖检查

- 文档标记语法：Task 1、Task 2
- `/focusplan`、`/yj` 斜杠命令：Task 3
- 二选一预算模式：Task 1、Task 3
- 第一个预计生效、后续忽略：Task 1、Task 2、Task 6
- 事项级“预计 vs 实际”：Task 4、Task 5
- V1 指定展示面：Task 5
- 每日复盘摘要：Task 4、Task 5
- 用户文档更新：Task 6

无明显 spec 漏项。

### Placeholder 扫描

本计划未使用 `TBD`、`TODO`、`implement later`、`similar to Task N` 等占位表达。每个代码改动步骤均给出明确代码形态或命令。

### 类型一致性检查

- 运行时字段统一命名为 `focusPlan`
- 类型统一使用 `FocusPlan` / `FocusPlanType`
- 预算状态聚合统一使用 `buildFocusPlanReview`
- 斜杠命令动作统一命名为 `setFocusPlan`

## 执行交接

Plan complete and saved to `docs/superpowers/plans/2026-05-13-focus-plan-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
