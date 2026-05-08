# Todo Item 置顶与标签 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Todo item 增加 `📌` 置顶和原生 `#标签` 解析能力，并在桌面 Todo Dock 中提供“已置顶”分组与聚合多选标签筛选。

**Architecture:** 继续沿用当前仓库的“Markdown 行内语义 -> parser 结构字段 -> projectStore 过滤排序 -> Dock 组件展示/交互”链路。第一阶段先在 parser 和 store 层建立稳定数据语义，再把桌面端过滤栏和侧边栏接上，最后补充 `📌` 写回与用户文档。

**Tech Stack:** Vue 3 SFC, Pinia, TypeScript, Vitest, SiYuan plugin APIs, existing item setting utilities

---

## File Structure

### Create

- `src/parser/pinParser.ts`
  - `📌` 解析、剥离、生成
- `src/parser/tagParser.ts`
  - 业务标签提取、保留标签过滤、标签剥离
- `test/parser/pinParser.test.ts`
  - `📌` parser 单元测试
- `test/parser/tagParser.test.ts`
  - 标签 parser 单元测试

### Modify

- `src/types/models.ts`
  - 为 `Item` 增加 `pinned`、`tags`
- `src/parser/lineParser.ts`
  - 将 pin/tag parser 接入 `parseItemLine()`
- `src/stores/projectStore.ts`
  - 搜索增加标签命中；补充标签聚合与置顶分组 getter
- `src/components/todo/TodoFilterBar.vue`
  - 新增标签搜索输入与多选展示
- `src/components/todo/TodoContentPane.vue`
  - 透传标签筛选参数
- `src/components/todo/TodoSidebar.vue`
  - 渲染“已置顶”分组；卡片标签展示；标签点击加入筛选
- `src/tabs/DesktopTodoDock.vue`
  - 管理标签查询、多选标签、聚合候选数据
- `src/utils/itemSettingUtils.ts`
  - 增加 `📌` 写回能力
- `docs/user-guide/data-format.md`
  - 用户文档补充 `📌` 与标签语法
- `test/parser/lineParser.test.ts`
  - item pin/tag 集成测试
- `test/stores/projectStore.test.ts`
  - 标签搜索、聚合、置顶分组测试
- `test/tabs/DesktopTodoDock.test.ts`
  - 过滤栏/已置顶分组/标签交互测试

### Leave Unchanged

- `src/mobile/**`
  - 第一版不把标签筛选和已置顶分组扩展到移动端
- `src/settings/**`
  - 第一版不持久化标签筛选状态

---

### Task 1: 建立 pin/tag parser 与 Item 类型

**Files:**
- Create: `src/parser/pinParser.ts`
- Create: `src/parser/tagParser.ts`
- Create: `test/parser/pinParser.test.ts`
- Create: `test/parser/tagParser.test.ts`
- Modify: `src/types/models.ts`

- [ ] **Step 1: 写 pin parser 的失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { parsePinnedFromLine, stripPinnedMarker, generatePinnedMarker } from '@/parser/pinParser';

describe('pinParser', () => {
  it('识别任意位置的 📌', () => {
    expect(parsePinnedFromLine('修复登录 @2026-05-07 📌')).toBe(true);
    expect(parsePinnedFromLine('📌 修复登录 @2026-05-07')).toBe(true);
    expect(parsePinnedFromLine('修复登录 @2026-05-07')).toBe(false);
  });

  it('剥离图钉并清理空白', () => {
    expect(stripPinnedMarker('修复登录  📌  @2026-05-07')).toBe('修复登录 @2026-05-07');
  });

  it('生成固定图钉标记', () => {
    expect(generatePinnedMarker()).toBe('📌');
  });
});
```

- [ ] **Step 2: 运行 pin parser 测试并确认失败**

Run: `npx vitest run test/parser/pinParser.test.ts`

Expected: FAIL，提示 `Cannot find module '@/parser/pinParser'`

- [ ] **Step 3: 实现最小 pin parser**

```ts
const PIN_MARKER = '📌';

export function parsePinnedFromLine(line: string): boolean {
  return line.includes(PIN_MARKER);
}

export function stripPinnedMarker(text: string): string {
  return text.replaceAll(PIN_MARKER, '').replace(/[ \t]+/g, ' ').trim();
}

export function generatePinnedMarker(): string {
  return PIN_MARKER;
}
```

- [ ] **Step 4: 运行 pin parser 测试并确认通过**

Run: `npx vitest run test/parser/pinParser.test.ts`

Expected: PASS

- [ ] **Step 5: 写 tag parser 的失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { isReservedTag, parseTagsFromLine, stripTagsFromLine } from '@/parser/tagParser';

describe('tagParser', () => {
  it('提取业务标签并去重', () => {
    expect(parseTagsFromLine('修复登录 @2026-05-07 #前端 #认证 #前端')).toEqual(['前端', '认证']);
  });

  it('排除保留标签', () => {
    expect(parseTagsFromLine('修复登录 @2026-05-07 #done #任务 #前端')).toEqual(['前端']);
  });

  it('仅剥离业务标签，保留状态标签', () => {
    expect(stripTagsFromLine('修复登录 #done #前端 #认证')).toBe('修复登录 #done');
  });

  it('识别保留标签', () => {
    expect(isReservedTag('done')).toBe(true);
    expect(isReservedTag('前端')).toBe(false);
  });
});
```

- [ ] **Step 6: 运行 tag parser 测试并确认失败**

Run: `npx vitest run test/parser/tagParser.test.ts`

Expected: FAIL，提示 `Cannot find module '@/parser/tagParser'`

- [ ] **Step 7: 实现最小 tag parser**

```ts
const RESERVED_TAGS = new Set([
  'done',
  '已完成',
  'abandoned',
  '已放弃',
  'task',
  '任务',
]);

const TAG_REGEX = /(^|\s)#([^\s#]+)/g;

export function isReservedTag(tag: string): boolean {
  return RESERVED_TAGS.has(tag);
}

export function parseTagsFromLine(line: string): string[] {
  const tags: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = TAG_REGEX.exec(line)) !== null) {
    const tag = match[2]?.trim();
    if (!tag || isReservedTag(tag) || tags.includes(tag)) continue;
    tags.push(tag);
  }
  return tags;
}

export function stripTagsFromLine(text: string): string {
  return text
    .replace(TAG_REGEX, (full, prefix, tag) => isReservedTag(tag) ? full : prefix)
    .replace(/[ \t]+/g, ' ')
    .trim();
}
```

- [ ] **Step 8: 运行 tag parser 测试并确认通过**

Run: `npx vitest run test/parser/tagParser.test.ts`

Expected: PASS

- [ ] **Step 9: 为 Item 类型补字段**

```ts
export interface Item {
  id: string;
  content: string;
  date: string;
  // ...
  priority?: PriorityLevel;
  pinned?: boolean;
  tags?: string[];
  isTaskList?: boolean;
  listItemBlockId?: string;
}
```

- [ ] **Step 10: 运行类型相关冒烟测试**

Run: `npx vitest run test/parser/pinParser.test.ts test/parser/tagParser.test.ts`

Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add src/parser/pinParser.ts src/parser/tagParser.ts src/types/models.ts test/parser/pinParser.test.ts test/parser/tagParser.test.ts
git commit -m "feat(parser): add item pin and tag parsers"
```

---

### Task 2: 把 pin/tag 接入 line parser

**Files:**
- Modify: `src/parser/lineParser.ts`
- Modify: `test/parser/lineParser.test.ts`

- [ ] **Step 1: 为 line parser 写失败测试**

```ts
it('解析置顶和业务标签并清洗正文', () => {
  const items = LineParser.parseItemLine('修复登录 @2026-05-07 🔥 📌 #done #前端 #认证', 1);

  expect(items).toHaveLength(1);
  expect(items[0].content).toBe('修复登录');
  expect(items[0].pinned).toBe(true);
  expect(items[0].status).toBe('completed');
  expect(items[0].priority).toBe('high');
  expect(items[0].tags).toEqual(['前端', '认证']);
});

it('多日期事项共享 pinned 与 tags', () => {
  const items = LineParser.parseItemLine('整理资料 @2026-05-07, 2026-05-08 📌 #前端', 1);

  expect(items).toHaveLength(2);
  expect(items.every(item => item.pinned)).toBe(true);
  expect(items[0].tags).toEqual(['前端']);
  expect(items[1].tags).toEqual(['前端']);
});
```

- [ ] **Step 2: 运行 line parser 测试并确认失败**

Run: `npx vitest run test/parser/lineParser.test.ts`

Expected: FAIL，提示 `pinned` / `tags` 断言不匹配

- [ ] **Step 3: 在 line parser 中接入 pin/tag parser**

```ts
import { parsePinnedFromLine, stripPinnedMarker } from './pinParser';
import { parseTagsFromLine, stripTagsFromLine } from './tagParser';

// parseItemLine 内
const pinned = parsePinnedFromLine(line);
const tags = parseTagsFromLine(line);

content = stripPinnedMarker(content);
content = stripTagsFromLine(content);

items.push({
  id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  content,
  date,
  startDateTime,
  endDateTime,
  timePrecision,
  lineNumber,
  docId: '',
  status,
  links: mergedLinks.length > 0 ? mergedLinks : undefined,
  siblingItems: siblingItems.length > 0 ? siblingItems : undefined,
  dateRangeStart,
  dateRangeEnd,
  reminder,
  repeatRule,
  endCondition,
  priority,
  pinned,
  tags: tags.length > 0 ? tags : undefined,
});
```

- [ ] **Step 4: 运行 line parser 测试并确认通过**

Run: `npx vitest run test/parser/lineParser.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/parser/lineParser.ts test/parser/lineParser.test.ts
git commit -m "feat(parser): parse item pinned markers and business tags"
```

---

### Task 3: 扩展 projectStore 搜索、标签聚合与置顶分组

**Files:**
- Modify: `src/stores/projectStore.ts`
- Modify: `test/stores/projectStore.test.ts`

- [ ] **Step 1: 为 store 写失败测试**

```ts
it('searchQuery 可命中业务标签', () => {
  const store = useProjectStore();
  store.$patch({
    currentDate: '2026-05-07',
    projects: [createMockProject([
      mkItem('2026-05-07', 'a', { content: '修复登录', tags: ['前端'] }),
      mkItem('2026-05-07', 'b', { content: '写报价单', tags: ['销售'] }),
    ])],
  });

  const result = store.getFilteredAndSortedItems({ groupId: '', searchQuery: '#前端' });
  expect(result.map(item => item.blockId)).toEqual(['a']);
});

it('聚合标签候选并按数量降序、名称升序排序', () => {
  const store = useProjectStore();
  store.$patch({
    currentDate: '2026-05-07',
    projects: [createMockProject([
      mkItem('2026-05-07', 'a', { tags: ['前端', '认证'] }),
      mkItem('2026-05-07', 'b', { tags: ['前端'] }),
      mkItem('2026-05-07', 'c', { tags: ['产品'] }),
    ])],
  });

  expect(store.getTodoTagOptions('').map(tag => `${tag.value}:${tag.count}`)).toEqual([
    '前端:2',
    '产品:1',
    '认证:1',
  ]);
});

it('按标签多选 OR 语义过滤并分离已置顶分组', () => {
  const store = useProjectStore();
  store.$patch({
    currentDate: '2026-05-07',
    projects: [createMockProject([
      mkItem('2026-05-07', 'a', { content: '修复登录', tags: ['前端'], pinned: true }),
      mkItem('2026-05-07', 'b', { content: '写报价单', tags: ['销售'] }),
      mkItem('2026-05-07', 'c', { content: '同步需求', tags: ['前端', '产品'] }),
    ])],
  });

  const grouped = store.getGroupedTodoItems({
    groupId: '',
    selectedTags: ['前端', '销售'],
  });

  expect(grouped.pinnedItems.map(item => item.blockId)).toEqual(['a']);
  expect(grouped.regularItems.map(item => item.blockId)).toEqual(['c', 'b']);
});
```

- [ ] **Step 2: 运行 store 测试并确认失败**

Run: `npx vitest run test/stores/projectStore.test.ts`

Expected: FAIL，提示缺少 `getTodoTagOptions` / `getGroupedTodoItems` 或搜索未命中标签

- [ ] **Step 3: 在 projectStore 中补充过滤和聚合 API**

```ts
type TodoTagOption = {
  value: string;
  count: number;
};

type TodoFilterParams = {
  groupId: string;
  searchQuery?: string;
  dateRange?: { start: string; end: string } | null;
  priorities?: PriorityLevel[];
  includeNoPriority?: boolean;
  sortRules?: TodoSortRule[];
  selectedTags?: string[];
};

function matchesSearchQuery(item: Item, searchQuery?: string): boolean {
  const q = normalizeString(searchQuery?.replace(/^#/, ''));
  if (!q) return true;
  return [
    item.content,
    item.project?.name,
    item.task?.name,
    ...(item.tags ?? []),
  ].some(value => normalizeString(value).includes(q));
}

function matchesSelectedTags(item: Item, selectedTags?: string[]): boolean {
  if (!selectedTags?.length) return true;
  const tagSet = new Set(item.tags ?? []);
  return selectedTags.some(tag => tagSet.has(tag));
}

function splitPinnedItems(items: Item[]) {
  return {
    pinnedItems: items.filter(item => item.pinned),
    regularItems: items.filter(item => !item.pinned),
  };
}
```

- [ ] **Step 4: 暴露 store 视图模型方法**

```ts
function getTodoTagOptions(groupId: string): TodoTagOption[] {
  const counts = new Map<string, number>();
  for (const item of getFilteredAndSortedItems({ groupId })) {
    for (const tag of item.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function getGroupedTodoItems(params: TodoFilterParams) {
  return splitPinnedItems(getFilteredAndSortedItems(params));
}
```

- [ ] **Step 5: 运行 store 测试并确认通过**

Run: `npx vitest run test/stores/projectStore.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/stores/projectStore.ts test/stores/projectStore.test.ts
git commit -m "feat(store): add todo tag aggregation and pinned grouping"
```

---

### Task 4: 在桌面过滤栏加入聚合标签多选

**Files:**
- Modify: `src/components/todo/TodoFilterBar.vue`
- Modify: `src/tabs/DesktopTodoDock.vue`
- Modify: `src/components/todo/TodoContentPane.vue`
- Modify: `test/tabs/DesktopTodoDock.test.ts`

- [ ] **Step 1: 为 DesktopTodoDock 写失败测试**

```ts
it('将聚合标签候选透传给过滤栏并响应多选更新', async () => {
  const filterBarProps = vi.fn();

  vi.doMock('@/components/todo/TodoFilterBar.vue', () => ({
    default: defineComponent({
      name: 'TodoFilterBarStub',
      props: ['tagOptions', 'selectedTags', 'tagQuery'],
      emits: ['update:selectedTags', 'update:tagQuery'],
      setup(props) {
        filterBarProps(props);
        return () => h('button', {
          'data-testid': 'tag-filter-trigger',
          onClick: () => {
            (props as any).onUpdateSelectedTags?.(['前端']);
          },
        });
      },
    }),
  }));
});
```

- [ ] **Step 2: 运行桌面 Dock 测试并确认失败**

Run: `npx vitest run test/tabs/DesktopTodoDock.test.ts`

Expected: FAIL，提示过滤栏缺少 `tagOptions` / `selectedTags` props

- [ ] **Step 3: 扩展过滤栏 props 和 emits**

```ts
type TagOption = { value: string; count: number };

withDefaults(defineProps<{
  // ...
  tagQuery?: string;
  selectedTags?: string[];
  tagOptions?: TagOption[];
}>(), {
  tagQuery: '',
  selectedTags: () => [],
  tagOptions: () => [],
});

const emit = defineEmits<{
  // ...
  (event: 'update:tagQuery', value: string): void;
  (event: 'update:selectedTags', value: string[]): void;
}>();
```

- [ ] **Step 4: 为过滤栏加入标签搜索 UI**

```vue
<div class="tag-search-row">
  <div class="search-box">
    <svg class="search-icon"><use xlink:href="#iconTags"></use></svg>
    <input
      :value="tagQuery"
      type="text"
      :placeholder="t('todo').tagSearchPlaceholder"
      class="search-input"
      @input="emit('update:tagQuery', ($event.target as HTMLInputElement).value)"
    />
  </div>
  <div v-if="selectedTags.length" class="selected-tag-list">
    <button
      v-for="tag in selectedTags"
      :key="tag"
      class="selected-tag-chip"
      @click="emit('update:selectedTags', selectedTags.filter(value => value !== tag))"
    >
      #{{ tag }}
    </button>
  </div>
  <div v-if="filteredTagOptions.length" class="tag-option-list">
    <button
      v-for="option in filteredTagOptions"
      :key="option.value"
      class="tag-option-chip"
      @click="toggleTag(option.value)"
    >
      #{{ option.value }} ({{ option.count }})
    </button>
  </div>
</div>
```

- [ ] **Step 5: 在 DesktopTodoDock 中管理标签查询和已选标签**

```ts
const tagQuery = ref('');
const selectedTags = ref<string[]>([]);

const tagOptions = computed(() => projectStore.getTodoTagOptions(selectedGroup.value));

function updateSelectedTags(next: string[]) {
  selectedTags.value = next;
}
```

并透传给过滤栏与内容面板：

```vue
<TodoFilterBar
  :tag-query="tagQuery"
  :selected-tags="selectedTags"
  :tag-options="tagOptions"
  @update:tag-query="tagQuery = $event"
  @update:selected-tags="updateSelectedTags($event)"
/>

<TodoContentPane
  :selected-tags="selectedTags"
/>
```

- [ ] **Step 6: 运行桌面 Dock 测试并确认通过**

Run: `npx vitest run test/tabs/DesktopTodoDock.test.ts`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/todo/TodoFilterBar.vue src/components/todo/TodoContentPane.vue src/tabs/DesktopTodoDock.vue test/tabs/DesktopTodoDock.test.ts
git commit -m "feat(todo): add aggregated tag filter bar"
```

---

### Task 5: 在 TodoSidebar 渲染已置顶分组与标签

**Files:**
- Modify: `src/components/todo/TodoSidebar.vue`
- Modify: `src/components/todo/TodoContentPane.vue`
- Modify: `test/tabs/DesktopTodoDock.test.ts`

- [ ] **Step 1: 为 Sidebar 展示写失败测试**

```ts
it('有置顶事项时渲染已置顶分组并展示标签', async () => {
  projectStore.getGroupedTodoItems = vi.fn(() => ({
    pinnedItems: [{ id: 'p1', content: '修复登录', status: 'pending', tags: ['前端'], pinned: true }],
    regularItems: [],
  })) as any;

  const mounted = mountDock();
  await nextTick();

  expect(mounted.container.textContent).toContain('已置顶');
  expect(mounted.container.textContent).toContain('#前端');
});
```

- [ ] **Step 2: 运行桌面 Dock 测试并确认失败**

Run: `npx vitest run test/tabs/DesktopTodoDock.test.ts`

Expected: FAIL，提示不存在“已置顶”分组或标签文案

- [ ] **Step 3: 在 Sidebar 中改为消费分组结果**

```ts
const groupedItems = computed(() => projectStore.getGroupedTodoItems({
  groupId: props.groupId,
  searchQuery: props.searchQuery,
  dateRange: props.dateRange,
  priorities: props.priorities,
  sortRules: props.sortRules,
  selectedTags: props.selectedTags,
}));

const pinnedItems = computed(() => groupedItems.value.pinnedItems);
const regularItems = computed(() => groupedItems.value.regularItems);
```

模板新增：

```vue
<div v-if="pinnedItems.length > 0" class="todo-section">
  <div class="section-label">已置顶 ({{ pinnedItems.length }})</div>
  <div class="todo-items">
    <Card v-for="item in pinnedItems" :key="item.id">
      <div class="item-content">📌 {{ item.content }}</div>
      <div v-if="item.tags?.length" class="item-tag-list">
        <button
          v-for="tag in item.tags"
          :key="tag"
          class="item-tag-chip"
          @click.stop="emit('add-tag-filter', tag)"
        >
          #{{ tag }}
        </button>
      </div>
    </Card>
  </div>
</div>
```

- [ ] **Step 4: 运行桌面 Dock 测试并确认通过**

Run: `npx vitest run test/tabs/DesktopTodoDock.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/todo/TodoSidebar.vue src/components/todo/TodoContentPane.vue test/tabs/DesktopTodoDock.test.ts
git commit -m "feat(todo): show pinned section and tag chips in sidebar"
```

---

### Task 6: 增加 `📌` UI 写回

**Files:**
- Modify: `src/utils/itemSettingUtils.ts`
- Modify: `src/components/todo/TodoSidebar.vue`
- Modify: `test/tabs/DesktopTodoDock.test.ts`

- [ ] **Step 1: 为 itemSettingUtils 写失败测试或调用侧失败测试**

```ts
it('点击图钉按钮时调用置顶写回工具', async () => {
  const toggleItemPinned = vi.fn().mockResolvedValue(undefined);
  vi.doMock('@/utils/itemSettingUtils', () => ({
    toggleItemPinned,
  }));

  const mounted = mountDock();
  await nextTick();

  (mounted.container.querySelector('[data-testid=\"todo-pin-toggle-p1\"]') as HTMLElement)
    .dispatchEvent(new MouseEvent('click', { bubbles: true }));

  expect(toggleItemPinned).toHaveBeenCalled();
});
```

- [ ] **Step 2: 运行桌面 Dock 测试并确认失败**

Run: `npx vitest run test/tabs/DesktopTodoDock.test.ts`

Expected: FAIL，提示缺少 pin toggle 工具或按钮

- [ ] **Step 3: 在 itemSettingUtils 中增加 `toggleItemPinned`**

```ts
import { generatePinnedMarker, parsePinnedFromLine, stripPinnedMarker } from '@/parser/pinParser';

export async function toggleItemPinned(item: Item): Promise<void> {
  if (!item.blockId) {
    throw new Error('事项缺少 blockId，无法更新');
  }

  const currentContent = await fetchBlockContent(item.blockId);
  const nextPinned = !parsePinnedFromLine(currentContent);
  let newContent = stripPinnedMarker(currentContent);

  if (nextPinned) {
    newContent = `${newContent} ${generatePinnedMarker()}`;
  }

  newContent = normalizeWhitespace(newContent);
  await updateBlockContent(item.blockId, newContent);
  emitItemSettingMutation('pin', item.blockId);
}
```

同时把 `emitItemSettingMutation` 的 `kind` 扩展为：

```ts
kind: 'reminder' | 'recurring' | 'pin'
```

- [ ] **Step 4: 在 Sidebar 上挂图钉按钮**

```vue
<span
  class="block__icon"
  :data-testid="`todo-pin-toggle-${item.id}`"
  :aria-label="item.pinned ? t('todo').unpin : t('todo').pin"
  @click.stop="handleTogglePinned(item)"
>
  <svg><use :xlink:href="item.pinned ? '#iconPin' : '#iconPin'"></use></svg>
</span>
```

```ts
async function handleTogglePinned(item: Item) {
  await toggleItemPinned(item);
}
```

- [ ] **Step 5: 运行桌面 Dock 测试并确认通过**

Run: `npx vitest run test/tabs/DesktopTodoDock.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/utils/itemSettingUtils.ts src/components/todo/TodoSidebar.vue test/tabs/DesktopTodoDock.test.ts
git commit -m "feat(todo): support pinned item writeback"
```

---

### Task 7: 更新用户文档并跑回归

**Files:**
- Modify: `docs/user-guide/data-format.md`
- Test: `test/parser/pinParser.test.ts`
- Test: `test/parser/tagParser.test.ts`
- Test: `test/parser/lineParser.test.ts`
- Test: `test/stores/projectStore.test.ts`
- Test: `test/tabs/DesktopTodoDock.test.ts`

- [ ] **Step 1: 更新用户文档**

````md
## 置顶标记

使用 `📌` 将事项固定到 Todo Dock 顶部的“已置顶”分组：

```markdown
修复登录回调 📅2026-05-07 📌
```

## 事项标签

事项可直接使用思源原生标签：

```markdown
修复登录回调 📅2026-05-07 📌 #前端 #认证
```

- `#done`、`#已完成`、`#abandoned`、`#已放弃`、`#task`、`#任务` 不计入业务标签
- Todo Dock 的主搜索可命中标签
- 主搜索框下方的标签搜索框支持从解析结果聚合出的标签中多选筛选
````

- [ ] **Step 2: 运行 parser/store/UI 回归测试**

Run: `npx vitest run test/parser/pinParser.test.ts test/parser/tagParser.test.ts test/parser/lineParser.test.ts test/stores/projectStore.test.ts test/tabs/DesktopTodoDock.test.ts`

Expected: PASS

- [ ] **Step 3: 运行项目测试冒烟**

Run: `npm test`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/user-guide/data-format.md test/parser/pinParser.test.ts test/parser/tagParser.test.ts test/parser/lineParser.test.ts test/stores/projectStore.test.ts test/tabs/DesktopTodoDock.test.ts
git commit -m "docs(todo): document item pinned tags and tag filters"
```

---

## Self-Review

### Spec coverage

- `📌` 持久化解析：Task 1, Task 2, Task 6
- 业务标签解析与保留标签排除：Task 1, Task 2
- 已置顶独立分组：Task 3, Task 5
- 主搜索命中标签：Task 3
- 独立标签搜索框：Task 4
- 聚合候选、多选 OR 语义、数量降序 + 名称升序：Task 3, Task 4
- 卡片标签展示与点击快捷加入筛选：Task 5
- 用户文档更新：Task 7

未覆盖项：无。

### Placeholder scan

- 没有 `TODO` / `TBD` / “类似 Task N” 之类占位语句
- 每个代码步骤都给了明确文件和代码骨架
- 每个测试步骤都有具体命令和预期

### Type consistency

- 新增字段统一使用 `Item.pinned`、`Item.tags`
- store 过滤参数统一使用 `selectedTags`
- 聚合候选统一使用 `TodoTagOption { value, count }`

---

Plan complete and saved to `docs/superpowers/plans/2026-05-07-item-pin-tag-implementation-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
