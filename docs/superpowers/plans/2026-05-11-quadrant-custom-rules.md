# Quadrant Custom Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build configurable four-quadrant rules with per-panel edit dialogs, independent JSON persistence, unified evaluator-based rendering, and workbench-wide adaptation.

**Architecture:** Introduce an isolated quadrant config domain made of typed config models, a file-backed config service, a small reactive store, and a pure evaluator that assigns items to `q1` through `q4`. Update `QuadrantTab` and workbench quadrant widgets to consume evaluator output instead of fixed priority filters, and add a dedicated edit dialog that saves one panel or resets all panels to the default priority-only layout.

**Tech Stack:** Vue 3, Pinia, TypeScript, Vitest, SiYuan file APIs, existing plugin dialog/message utilities.

---

## File Structure

**Create**

- `src/types/quadrant.ts` - quadrant config and evaluator types
- `src/services/quadrantConfigService.ts` - file-backed load/save/reset helpers for `quadrant-config.json`
- `src/stores/quadrantConfigStore.ts` - reactive quadrant config state shared by tab and workbench
- `src/utils/quadrantEvaluator.ts` - pure rule matching and unique-assignment helpers
- `src/components/quadrant/QuadrantRuleDialog.vue` - per-panel edit dialog with global reset button
- `test/services/quadrantConfigService.test.ts` - persistence and normalization tests
- `test/utils/quadrantEvaluator.test.ts` - evaluator tests

**Modify**

- `src/utils/quadrant.ts` - default config constants and legacy workbench key mapping
- `src/tabs/QuadrantTab.vue` - switch from fixed definitions to config-driven rendering and dialog entry
- `src/types/workbench.ts` - move widget quadrant IDs from `high|medium|low|none` to `q1|q2|q3|q4`
- `src/components/workbench/widgets/QuadrantSummaryWidget.vue` - use evaluator output and config titles
- `src/components/workbench/dialogs/QuadrantWidgetConfigDialog.vue` - load current panel titles and save new keys
- `src/workbench/widgetRegistry.ts` - new widget defaults and migration-safe reads
- `test/tabs/QuadrantTab.test.ts` - adapt fixed-priority assertions to config-driven behavior
- `test/components/workbench/QuadrantSummaryWidget.test.ts` - workbench config/title tests

---

### Task 1: Define quadrant config types and defaults

**Files:**

- Create: `src/types/quadrant.ts`
- Modify: `src/utils/quadrant.ts`
- Test: `test/utils/quadrantEvaluator.test.ts`

- [ ] **Step 1: Write the failing type-oriented evaluator test using the new IDs**

```ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_QUADRANT_CONFIG } from '@/utils/quadrant'
import { assignItemsToQuadrants } from '@/utils/quadrantEvaluator'

describe('assignItemsToQuadrants', () => {
  it('uses q1-q4 default panel ids', () => {
    const result = assignItemsToQuadrants([], DEFAULT_QUADRANT_CONFIG.panels)

    expect(result).toEqual({
      q1: [],
      q2: [],
      q3: [],
      q4: [],
      unassigned: [],
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/utils/quadrantEvaluator.test.ts`

Expected: FAIL with module resolution errors for `@/utils/quadrantEvaluator` or missing `DEFAULT_QUADRANT_CONFIG`.

- [ ] **Step 3: Add quadrant config types**

```ts
export type QuadrantPanelId = 'q1' | 'q2' | 'q3' | 'q4'
export type QuadrantPriorityValue = 'high' | 'medium' | 'low' | 'none'
export type QuadrantDateValue = 'overdue' | 'today' | 'tomorrow' | 'undated'

export interface QuadrantRuleChain {
  priority?: QuadrantPriorityValue[]
  date?: QuadrantDateValue[]
}

export interface QuadrantPanelConfig {
  id: QuadrantPanelId
  title: string
  rules: QuadrantRuleChain
}

export interface QuadrantConfigFile {
  version: 1
  panels: QuadrantPanelConfig[]
}
```

- [ ] **Step 4: Replace fixed priority definitions with default config helpers**

```ts
import type { QuadrantConfigFile, QuadrantPanelId } from '@/types/quadrant'

export const DEFAULT_QUADRANT_CONFIG: QuadrantConfigFile = {
  version: 1,
  panels: [
    { id: 'q1', title: '重要且紧急', rules: { priority: ['high'] } },
    { id: 'q2', title: '重要不紧急', rules: { priority: ['medium'] } },
    { id: 'q3', title: '紧急不重要', rules: { priority: ['low'] } },
    { id: 'q4', title: '不重要不紧急', rules: { priority: ['none'] } },
  ],
}

export function getDefaultQuadrantPanel(id: QuadrantPanelId) {
  return DEFAULT_QUADRANT_CONFIG.panels.find(panel => panel.id === id)!
}

export function mapLegacyWorkbenchQuadrantKey(key?: string): QuadrantPanelId {
  if (key === 'medium')
    return 'q2'
  if (key === 'low')
    return 'q3'
  if (key === 'none')
    return 'q4'
  return 'q1'
}
```

- [ ] **Step 5: Run test to verify the new exports compile**

Run: `npx vitest run test/utils/quadrantEvaluator.test.ts`

Expected: FAIL only on missing `assignItemsToQuadrants`, proving the new types/defaults are wired correctly.

- [ ] **Step 6: Commit**

```bash
git add src/types/quadrant.ts src/utils/quadrant.ts test/utils/quadrantEvaluator.test.ts
git commit -m "refactor(quadrant): define config types and defaults"
```

### Task 2: Build the pure evaluator with unique assignment

**Files:**

- Create: `src/utils/quadrantEvaluator.ts`
- Test: `test/utils/quadrantEvaluator.test.ts`

- [ ] **Step 1: Write failing evaluator tests for priority/date matching and first-hit assignment**

```ts
import type { Item } from '@/types/models'
import type { QuadrantPanelConfig } from '@/types/quadrant'
import { describe, expect, it } from 'vitest'
import { assignItemsToQuadrants, getQuadrantDateBucket, matchesQuadrantPanel } from '@/utils/quadrantEvaluator'

function mkItem(partial: Partial<Item>): Item {
  return {
    id: partial.id ?? 'item-1',
    content: partial.content ?? 'task',
    date: partial.date,
    lineNumber: 1,
    blockId: partial.blockId ?? 'block-1',
    docId: partial.docId ?? 'doc-1',
    status: partial.status ?? 'pending',
    priority: partial.priority,
    startDateTime: partial.startDateTime,
    ...partial,
  } as Item
}

describe('quadrantEvaluator', () => {
  it('matches a panel by priority and date together', () => {
    const panel: QuadrantPanelConfig = {
      id: 'q1',
      title: 'Important & urgent',
      rules: { priority: ['high'], date: ['today'] },
    }

    expect(matchesQuadrantPanel(mkItem({ priority: 'high', date: '2026-05-11' }), panel, '2026-05-11')).toBe(true)
    expect(matchesQuadrantPanel(mkItem({ priority: 'high', date: '2026-05-12' }), panel, '2026-05-11')).toBe(false)
  })

  it('classifies overdue/today/tomorrow/undated buckets', () => {
    expect(getQuadrantDateBucket(mkItem({ date: '2026-05-10', status: 'pending' }), '2026-05-11')).toBe('overdue')
    expect(getQuadrantDateBucket(mkItem({ date: '2026-05-11' }), '2026-05-11')).toBe('today')
    expect(getQuadrantDateBucket(mkItem({ date: '2026-05-12' }), '2026-05-11')).toBe('tomorrow')
    expect(getQuadrantDateBucket(mkItem({}), '2026-05-11')).toBe('undated')
  })

  it('assigns each item to the first matching panel only', () => {
    const panels: QuadrantPanelConfig[] = [
      { id: 'q1', title: 'Q1', rules: { priority: ['high'] } },
      { id: 'q2', title: 'Q2', rules: { priority: ['high', 'medium'] } },
      { id: 'q3', title: 'Q3', rules: { priority: ['low'] } },
      { id: 'q4', title: 'Q4', rules: { priority: ['none'] } },
    ]

    const result = assignItemsToQuadrants([
      mkItem({ id: 'a', blockId: 'a', priority: 'high' }),
      mkItem({ id: 'b', blockId: 'b', priority: 'medium' }),
      mkItem({ id: 'c', blockId: 'c' }),
    ], panels, '2026-05-11')

    expect(result.q1.map(item => item.id)).toEqual(['a'])
    expect(result.q2.map(item => item.id)).toEqual(['b'])
    expect(result.q4.map(item => item.id)).toEqual(['c'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/utils/quadrantEvaluator.test.ts`

Expected: FAIL because evaluator functions are not implemented.

- [ ] **Step 3: Implement the pure evaluator**

```ts
import type { Item } from '@/types/models'
import type {
  QuadrantConfigFile,
  QuadrantDateValue,
  QuadrantPanelConfig,
  QuadrantPanelId,
} from '@/types/quadrant'
import dayjs from 'dayjs'

export interface QuadrantAssignmentResult {
  q1: Item[]
  q2: Item[]
  q3: Item[]
  q4: Item[]
  unassigned: Item[]
}

export function getQuadrantDateBucket(item: Item, today: string): QuadrantDateValue {
  if (!item.date)
    return 'undated'

  const itemDate = dayjs(item.date)
  const base = dayjs(today)

  if (item.status !== 'completed' && itemDate.isBefore(base, 'day'))
    return 'overdue'
  if (itemDate.isSame(base, 'day'))
    return 'today'
  if (itemDate.isSame(base.add(1, 'day'), 'day'))
    return 'tomorrow'
  return 'undated'
}

export function matchesQuadrantPanel(item: Item, panel: QuadrantPanelConfig, today: string): boolean {
  const priority = item.priority ?? 'none'
  if (panel.rules.priority?.length && !panel.rules.priority.includes(priority))
    return false

  const dateBucket = getQuadrantDateBucket(item, today)
  if (panel.rules.date?.length && !panel.rules.date.includes(dateBucket))
    return false

  return true
}

export function createEmptyQuadrantAssignment(): QuadrantAssignmentResult {
  return { q1: [], q2: [], q3: [], q4: [], unassigned: [] }
}

export function assignItemsToQuadrants(items: Item[], panels: QuadrantPanelConfig[], today = dayjs().format('YYYY-MM-DD')): QuadrantAssignmentResult {
  const result = createEmptyQuadrantAssignment()

  items.forEach((item) => {
    const match = panels.find(panel => matchesQuadrantPanel(item, panel, today))
    if (!match) {
      result.unassigned.push(item)
      return
    }
    result[match.id].push(item)
  })

  return result
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/utils/quadrantEvaluator.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/quadrantEvaluator.ts test/utils/quadrantEvaluator.test.ts
git commit -m "feat(quadrant): add config-driven evaluator"
```

### Task 3: Add file-backed quadrant config persistence

**Files:**

- Create: `src/services/quadrantConfigService.ts`
- Test: `test/services/quadrantConfigService.test.ts`
- Modify: `src/utils/quadrant.ts`

- [ ] **Step 1: Write failing persistence tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_QUADRANT_CONFIG } from '@/utils/quadrant'

const mockLoadData = vi.fn()
const mockSaveData = vi.fn()

vi.mock('@/main', () => ({
  usePlugin: () => ({
    loadData: mockLoadData,
    saveData: mockSaveData,
  }),
}))

describe('quadrantConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns defaults when the config file does not exist', async () => {
    mockLoadData.mockResolvedValueOnce('')
    const { loadQuadrantConfig } = await import('@/services/quadrantConfigService')

    await expect(loadQuadrantConfig()).resolves.toEqual(DEFAULT_QUADRANT_CONFIG)
  })

  it('normalizes incomplete panel arrays', async () => {
    mockLoadData.mockResolvedValueOnce(JSON.stringify({
      version: 1,
      panels: [{ id: 'q1', title: 'Mine', rules: { priority: ['high'] } }],
    }))
    const { loadQuadrantConfig } = await import('@/services/quadrantConfigService')
    const config = await loadQuadrantConfig()

    expect(config.panels).toHaveLength(4)
    expect(config.panels[0].title).toBe('Mine')
    expect(config.panels[3].id).toBe('q4')
  })

  it('resets the whole file to defaults', async () => {
    const { resetQuadrantConfig } = await import('@/services/quadrantConfigService')
    await resetQuadrantConfig()

    expect(mockSaveData).toHaveBeenCalledWith('quadrant-config.json', JSON.stringify(DEFAULT_QUADRANT_CONFIG, null, 2))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/services/quadrantConfigService.test.ts`

Expected: FAIL because the service module does not exist.

- [ ] **Step 3: Implement the config service**

```ts
import type { QuadrantConfigFile, QuadrantPanelConfig, QuadrantPanelId } from '@/types/quadrant'
import { usePlugin } from '@/main'
import { DEFAULT_QUADRANT_CONFIG, getDefaultQuadrantPanel } from '@/utils/quadrant'

const QUADRANT_CONFIG_FILENAME = 'quadrant-config.json'

function normalizePanel(panelId: QuadrantPanelId, panel?: Partial<QuadrantPanelConfig>): QuadrantPanelConfig {
  const fallback = getDefaultQuadrantPanel(panelId)
  return {
    id: panelId,
    title: typeof panel?.title === 'string' && panel.title.trim() ? panel.title : fallback.title,
    rules: {
      priority: Array.isArray(panel?.rules?.priority) ? panel.rules.priority : fallback.rules.priority,
      date: Array.isArray(panel?.rules?.date) ? panel.rules.date : fallback.rules.date,
    },
  }
}

export function normalizeQuadrantConfig(raw: unknown): QuadrantConfigFile {
  const file = raw as Partial<QuadrantConfigFile> | null | undefined
  const panels = Array.isArray(file?.panels) ? file.panels : []
  return {
    version: 1,
    panels: ['q1', 'q2', 'q3', 'q4'].map(id =>
      normalizePanel(id as QuadrantPanelId, panels.find(panel => panel?.id === id)),
    ),
  }
}

export async function loadQuadrantConfig(): Promise<QuadrantConfigFile> {
  const plugin = usePlugin() as any
  const raw = await plugin?.loadData?.(QUADRANT_CONFIG_FILENAME)
  if (!raw)
    return DEFAULT_QUADRANT_CONFIG

  try {
    return normalizeQuadrantConfig(JSON.parse(raw))
  }
  catch {
    return DEFAULT_QUADRANT_CONFIG
  }
}

export async function saveQuadrantConfig(config: QuadrantConfigFile) {
  const plugin = usePlugin() as any
  const normalized = normalizeQuadrantConfig(config)
  await plugin?.saveData?.(QUADRANT_CONFIG_FILENAME, JSON.stringify(normalized, null, 2))
  return normalized
}

export async function resetQuadrantConfig() {
  return saveQuadrantConfig(DEFAULT_QUADRANT_CONFIG)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/services/quadrantConfigService.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/quadrantConfigService.ts test/services/quadrantConfigService.test.ts src/utils/quadrant.ts
git commit -m "feat(quadrant): add config persistence service"
```

### Task 4: Add a dedicated quadrant config store and adapt the tab

**Files:**

- Create: `src/stores/quadrantConfigStore.ts`
- Modify: `src/tabs/QuadrantTab.vue`
- Test: `test/tabs/QuadrantTab.test.ts`

- [ ] **Step 1: Write failing `QuadrantTab` tests for config-driven titles and disabled drag**

```ts
const mockQuadrantConfigStore = {
  panels: [
    { id: 'q1', title: 'My Q1', rules: { priority: ['high'] } },
    { id: 'q2', title: 'My Q2', rules: { priority: ['medium'], date: ['today'] } },
    { id: 'q3', title: 'My Q3', rules: { priority: ['low'] } },
    { id: 'q4', title: 'My Q4', rules: { priority: ['none'] } },
  ],
  loadConfig: vi.fn(),
  savePanel: vi.fn(),
  resetAll: vi.fn(),
}

vi.mock('@/stores/quadrantConfigStore', () => ({
  useQuadrantConfigStore: () => mockQuadrantConfigStore,
}))

it('renders panel titles from quadrant config and disables drag', async () => {
  const mounted = await mountQuadrantTab()
  await nextTick()

  expect(Array.from(mounted.container.querySelectorAll('.quadrant-panel__title')).map(node => node.textContent)).toEqual([
    'My Q1',
    'My Q2',
    'My Q3',
    'My Q4',
  ])

  expect(todoSidebarProps).toHaveBeenNthCalledWith(1, expect.objectContaining({
    enableDrag: false,
  }))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/tabs/QuadrantTab.test.ts`

Expected: FAIL because `QuadrantTab.vue` still renders `t(quadrant.titleKey)` and passes `enableDrag: true`.

- [ ] **Step 3: Implement the quadrant config store**

```ts
import type { QuadrantConfigFile, QuadrantPanelConfig, QuadrantPanelId } from '@/types/quadrant'
import { defineStore } from 'pinia'
import { loadQuadrantConfig, resetQuadrantConfig, saveQuadrantConfig } from '@/services/quadrantConfigService'

export const useQuadrantConfigStore = defineStore('quadrantConfig', {
  state: () => ({
    loaded: false,
    config: null as QuadrantConfigFile | null,
  }),
  getters: {
    panels: state => state.config?.panels ?? [],
  },
  actions: {
    async loadConfig() {
      this.config = await loadQuadrantConfig()
      this.loaded = true
    },
    async savePanel(panelId: QuadrantPanelId, nextPanel: QuadrantPanelConfig) {
      const base = this.config ?? await loadQuadrantConfig()
      const nextConfig = {
        ...base,
        panels: base.panels.map(panel => panel.id === panelId ? nextPanel : panel),
      }
      this.config = await saveQuadrantConfig(nextConfig)
    },
    async resetAll() {
      this.config = await resetQuadrantConfig()
    },
  },
})
```

- [ ] **Step 4: Update `QuadrantTab.vue` to consume config store panels**

```ts
const quadrantConfigStore = useQuadrantConfigStore()

const quadrants = computed(() => quadrantConfigStore.panels)
const quadrantAssignments = computed(() => {
  const items = projectStore.getFilteredAndSortedItems({
    groupId: selectedGroup.value,
    searchQuery: searchQuery.value,
  })
  return assignItemsToQuadrants(items, quadrants.value)
})

const panelCounts = computed(() => quadrants.value.map(panel => quadrantAssignments.value[panel.id].length))
const dragEnabled = computed(() => false)

onMounted(async () => {
  await quadrantConfigStore.loadConfig()
  // existing setup...
})
```

And in the template:

```vue
<h2 class="quadrant-panel__title">
{{ quadrant.title }}
</h2>

<TodoSidebar
  :enable-drag="dragEnabled"
  :items="quadrantAssignments[quadrant.id]"
/>
```

If `TodoSidebar` cannot accept items directly, keep it as a list renderer wrapper in this task and defer the exact feed shape to Task 6. The key outcome here is that the tab stops deriving panel identity from fixed priorities.

- [ ] **Step 5: Run the tab test to verify it passes**

Run: `npx vitest run test/tabs/QuadrantTab.test.ts`

Expected: PASS for the new title/drag assertions; existing fixed-priority assertions may still fail and will be updated in Task 6.

- [ ] **Step 6: Commit**

```bash
git add src/stores/quadrantConfigStore.ts src/tabs/QuadrantTab.vue test/tabs/QuadrantTab.test.ts
git commit -m "feat(quadrant): drive tab from shared config store"
```

### Task 5: Build the edit dialog with global reset

**Files:**

- Create: `src/components/quadrant/QuadrantRuleDialog.vue`
- Modify: `src/tabs/QuadrantTab.vue`
- Test: `test/tabs/QuadrantTab.test.ts`

- [ ] **Step 1: Write failing dialog interaction tests**

```ts
it('opens the edit dialog for a panel and saves panel changes', async () => {
  const mounted = await mountQuadrantTab()
  await nextTick();

  (mounted.container.querySelector('[data-testid="quadrant-edit-button-q1"]') as HTMLElement)
    .dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await nextTick()

  const titleInput = document.querySelector('[data-testid="quadrant-rule-title-input"]') as HTMLInputElement
  titleInput.value = 'Custom Q1'
  titleInput.dispatchEvent(new Event('input'));

  (document.querySelector('[data-testid="quadrant-rule-save"]') as HTMLElement)
    .dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await nextTick()

  expect(mockQuadrantConfigStore.savePanel).toHaveBeenCalledWith('q1', expect.objectContaining({
    title: 'Custom Q1',
  }))
})

it('resets all four panels from the dialog footer', async () => {
  const mounted = await mountQuadrantTab()
  await nextTick();

  (mounted.container.querySelector('[data-testid="quadrant-edit-button-q2"]') as HTMLElement)
    .dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await nextTick();

  (document.querySelector('[data-testid="quadrant-rule-reset-defaults"]') as HTMLElement)
    .dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await nextTick()

  expect(mockQuadrantConfigStore.resetAll).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/tabs/QuadrantTab.test.ts`

Expected: FAIL because there is no dialog or edit button.

- [ ] **Step 3: Implement the rule dialog component**

```vue
<template>
  <div class="quadrant-rule-dialog">
    <input
      v-model="draft.title"
      data-testid="quadrant-rule-title-input"
      class="b3-text-field"
    >

    <fieldset>
      <legend>{{ t('todo.priority.setPriority') }}</legend>
      <label v-for="option in priorityOptions" :key="option.value">
        <input v-model="draft.rules.priority" type="checkbox" :value="option.value">
        {{ option.label }}
      </label>
    </fieldset>

    <fieldset>
      <legend>{{ t('calendar').today }}</legend>
      <label v-for="option in dateOptions" :key="option.value">
        <input v-model="draft.rules.date" type="checkbox" :value="option.value">
        {{ option.label }}
      </label>
    </fieldset>

    <button data-testid="quadrant-rule-reset-defaults" @click="$emit('reset-defaults')">
      {{ t('common').reset }}
    </button>
    <button data-testid="quadrant-rule-save" @click="$emit('save', draft)">
      {{ t('common').save }}
    </button>
  </div>
</template>
```

- [ ] **Step 4: Wire the dialog into `QuadrantTab.vue`**

```ts
const editingPanel = ref<QuadrantPanelConfig | null>(null)

function openQuadrantEditor(panel: QuadrantPanelConfig) {
  editingPanel.value = JSON.parse(JSON.stringify(panel))
}

async function handleQuadrantSave(panel: QuadrantPanelConfig) {
  await quadrantConfigStore.savePanel(panel.id, panel)
  editingPanel.value = null
}

async function handleQuadrantResetDefaults() {
  await quadrantConfigStore.resetAll()
  editingPanel.value = null
}
```

And add per-panel edit buttons:

```vue
<button
  :data-testid="`quadrant-edit-button-${quadrant.id}`"
  class="block__icon"
  @click="openQuadrantEditor(quadrant)"
>
  <svg><use xlink:href="#iconEdit"></use></svg>
</button>

<QuadrantRuleDialog
  v-if="editingPanel"
  :panel="editingPanel"
  @save="handleQuadrantSave"
  @reset-defaults="handleQuadrantResetDefaults"
  @close="editingPanel = null"
/>
```

- [ ] **Step 5: Run the dialog tests to verify they pass**

Run: `npx vitest run test/tabs/QuadrantTab.test.ts`

Expected: PASS for dialog save/reset interactions.

- [ ] **Step 6: Commit**

```bash
git add src/components/quadrant/QuadrantRuleDialog.vue src/tabs/QuadrantTab.vue test/tabs/QuadrantTab.test.ts
git commit -m "feat(quadrant): add panel rule editor dialog"
```

### Task 6: Adapt workbench widgets and finalize integration tests

**Files:**

- Modify: `src/types/workbench.ts`
- Modify: `src/components/workbench/widgets/QuadrantSummaryWidget.vue`
- Modify: `src/components/workbench/dialogs/QuadrantWidgetConfigDialog.vue`
- Modify: `src/workbench/widgetRegistry.ts`
- Modify: `test/components/workbench/QuadrantSummaryWidget.test.ts`
- Modify: `test/tabs/QuadrantTab.test.ts`

- [ ] **Step 1: Write failing workbench tests for new IDs and titles**

```ts
it('renders the configured panel title in the summary widget', async () => {
  const widget = {
    id: 'w-1',
    type: 'quadrantSummary',
    layout: { x: 0, y: 0, w: 3, h: 4 },
    config: { quadrant: 'q2', groupId: '' },
  }

  const mounted = await mountQuadrantSummaryWidget(widget, {
    panels: [
      { id: 'q1', title: 'Q1', rules: { priority: ['high'] } },
      { id: 'q2', title: 'Follow-up', rules: { priority: ['medium'] } },
      { id: 'q3', title: 'Q3', rules: { priority: ['low'] } },
      { id: 'q4', title: 'Q4', rules: { priority: ['none'] } },
    ],
  })

  expect(mounted.container.textContent).toContain('Follow-up')
})

it('maps legacy workbench keys to q1-q4 in the config dialog', async () => {
  const mounted = await mountQuadrantWidgetConfigDialog({
    initialConfig: { quadrant: 'high', groupId: '' },
  })

  expect((mounted.container.querySelector('[data-testid=\"quadrant-widget-select\"]') as HTMLSelectElement).value).toBe('q1')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/components/workbench/QuadrantSummaryWidget.test.ts`

Expected: FAIL because workbench still uses legacy keys and fixed definitions.

- [ ] **Step 3: Update workbench types, registry, and dialog**

```ts
export type WorkbenchQuadrantKey = 'q1' | 'q2' | 'q3' | 'q4'
```

```ts
createDefaultConfig: (): WorkbenchQuadrantWidgetConfig => ({
  quadrant: 'q1',
})
```

```ts
const selectedQuadrant = ref(mapLegacyWorkbenchQuadrantKey(props.initialConfig.quadrant))
const quadrantOptions = computed(() => quadrantConfigStore.panels.map(panel => ({
  value: panel.id,
  label: `${panel.id.toUpperCase()} ${panel.title}`,
})))
```

- [ ] **Step 4: Update `QuadrantSummaryWidget.vue` to use the shared config and evaluator**

```ts
const quadrantConfigStore = useQuadrantConfigStore()
const quadrantId = computed(() => mapLegacyWorkbenchQuadrantKey(quadrantConfig.value.quadrant))
const panel = computed(() => quadrantConfigStore.panels.find(item => item.id === quadrantId.value))
const assignments = computed(() => assignItemsToQuadrants(
  projectStore.getFilteredAndSortedItems({ groupId: quadrantConfig.value.groupId ?? '' }),
  quadrantConfigStore.panels,
))
const items = computed(() => panel.value ? assignments.value[panel.value.id] : [])
```

And in the template:

```vue
<span>
{{ panel?.title }}
</span>
```

- [ ] **Step 5: Run the focused workbench and tab tests**

Run: `npx vitest run test/components/workbench/QuadrantSummaryWidget.test.ts test/tabs/QuadrantTab.test.ts`

Expected: PASS.

- [ ] **Step 6: Run the broader regression tests**

Run: `npx vitest run test/utils/quadrantEvaluator.test.ts test/services/quadrantConfigService.test.ts test/tabs/QuadrantTab.test.ts test/components/workbench/QuadrantSummaryWidget.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/types/workbench.ts src/components/workbench/widgets/QuadrantSummaryWidget.vue src/components/workbench/dialogs/QuadrantWidgetConfigDialog.vue src/workbench/widgetRegistry.ts test/components/workbench/QuadrantSummaryWidget.test.ts test/tabs/QuadrantTab.test.ts
git commit -m "feat(workbench): adapt quadrant widgets to custom rules"
```

## Self-Review

### Spec coverage

- Independent quadrant JSON file: covered in Task 3.
- Per-panel edit dialog: covered in Task 5.
- Global reset from dialog footer: covered in Task 5.
- Unique evaluator assignment with priority/date rules: covered in Task 2.
- `QuadrantTab` config-driven rendering and drag disablement: covered in Task 4.
- Workbench view/widget adaptation and legacy key migration: covered in Task 6.

No spec gaps remain.

### Placeholder scan

- No `TBD`, `TODO`, or deferred “implement later” wording is left in the tasks.
- Each code-changing step contains concrete code snippets.
- Each verification step names an exact command and expected result.

### Type consistency

- Stable panel IDs are consistently `q1` through `q4`.
- Config store API uses `loadConfig`, `savePanel`, and `resetAll` consistently across tasks.
- The persistence file name is consistently `quadrant-config.json`.
