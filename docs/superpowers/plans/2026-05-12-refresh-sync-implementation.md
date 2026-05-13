# Refresh Sync Coordination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove full-refresh flicker, guarantee refresh requests are not dropped while a refresh is running, and centralize refresh execution so views no longer call `projectStore.refresh()` directly.

**Architecture:** Introduce a refresh coordinator owned by the plugin runtime, keep `projectStore` focused on pure refresh execution and state application, and downgrade every Tab/Dock/mobile panel from "refresh executor" to "refresh requester + settings sync consumer". Full refreshes build `nextProjects` in memory and replace state atomically instead of clearing and re-pushing.

**Tech Stack:** Vue 3, Pinia, TypeScript, Vitest, BroadcastChannel, SiYuan plugin runtime

---

## File Structure

### New files

- Create: `src/services/refreshCoordinator.ts`
  - Own refresh queue state
  - Accept refresh requests from plugin lifecycle, ws-main, local mutations, and manual UI triggers
  - Decide between `settings-only`, `directed`, and `full`
  - Call into `projectStore`

- Create: `test/services/refreshCoordinator.test.ts`
  - Validate queueing, deduping, escalation to full refresh, and "rerun after in-flight refresh" behavior

- Create: `test/stores/projectStore.refreshFlow.test.ts`
  - Validate no-clear full refresh application and directed remove/replace behavior

### Existing files to modify

- Modify: `src/stores/projectStore.ts`
  - Split full refresh into "build next projects" and "apply next projects"
  - Add atomic full-refresh state replacement
  - Add directed remove support
  - Remove scheduler-like early-return semantics from public refresh path once coordinator owns execution

- Modify: `src/index.ts`
  - Create coordinator during plugin boot
  - Route `ws-main`, `LOCAL_DATA_MUTATED`, manual refresh, and broadcast-triggered requests into coordinator
  - Keep `DATA_REFRESHED` side effects only

- Modify: `src/utils/eventBus.ts`
  - Add explicit refresh-request event(s) or typed payload helpers
  - Keep `DATA_REFRESHED` as completion signal

- Modify: `src/utils/dirtyDocTracker.ts`
  - Keep docId set behavior, but expose helpers needed by coordinator-driven snapshots

- Modify: `src/tabs/CalendarTab.vue`
- Modify: `src/tabs/DesktopTodoDock.vue`
- Modify: `src/tabs/GanttTab.vue`
- Modify: `src/tabs/ProjectTab.vue`
- Modify: `src/tabs/WorkbenchTab.vue`
- Modify: `src/tabs/PomodoroDock.vue`
- Modify: `src/tabs/PomodoroStatsTab.vue`
- Modify: `src/tabs/AiChatDock.vue`
- Modify: `src/tabs/DesktopHabitDock.vue`
- Modify: `src/tabs/QuadrantTab.vue`
- Modify: `src/mobile/panels/MobileTodoPanel.vue`
- Modify: `src/mobile/panels/MobileHabitPanel.vue`
- Modify: `src/components/workbench/view/WorkbenchHabitView.vue`
- Modify: `src/components/workbench/dialogs/HabitWidgetDetailDialog.vue`
- Modify: `src/composables/useHabitWorkspace.ts`
  - Replace direct `projectStore.refresh()` calls inside refresh-event handlers with coordinator requests or local settings patch only

- Modify: `test/index.localDataMutation.test.ts`
  - Update wiring assertions around plugin-side refresh routing

## Task 1: Make Full Refresh Atomic

**Files:**
- Modify: `src/stores/projectStore.ts`
- Create: `test/stores/projectStore.refreshFlow.test.ts`

- [ ] **Step 1: Write the failing store test for atomic full refresh**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useProjectStore } from '@/stores/projectStore';
import { MarkdownParser } from '@/parser/markdownParser';

vi.mock('@/parser/markdownParser', () => ({
  MarkdownParser: vi.fn(),
}));

describe('projectStore full refresh application', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('keeps previous projects visible until full refresh completes', async () => {
    const store = useProjectStore();
    store.projects = [
      { id: 'old-doc', name: 'Old', path: '/old', tasks: [], habits: [] } as any,
    ];

    let onProjectReady: ((project: any) => void) | null = null;
    vi.mocked(MarkdownParser).mockImplementation(() => ({
      parseAllProjectsWithCallback: vi.fn(async (_plugin, cb) => {
        onProjectReady = cb;
        await Promise.resolve();
        cb({ id: 'new-doc', name: 'New', path: '/new', tasks: [], habits: [] });
      }),
    }) as any);

    const refreshPromise = store.refreshFull({} as any, 'full', []);
    expect(store.projects.map(project => project.id)).toEqual(['old-doc']);

    await refreshPromise;
    expect(store.projects.map(project => project.id)).toEqual(['new-doc']);
    expect(onProjectReady).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/stores/projectStore.refreshFlow.test.ts -v`

Expected: FAIL because `refreshFull()` clears `projects` before rebuilding them.

- [ ] **Step 3: Implement atomic full refresh in `projectStore`**

Replace the destructive clear-and-push path with a builder + single apply path:

```ts
async buildProjectsFromParser(
  parser: MarkdownParser,
  _plugin: any,
  scanMode: ScanMode,
  directories: ProjectDirectory[],
): Promise<Project[]> {
  const enabledDirs = directories.filter(d => d.enabled);
  const nextProjects: Project[] = [];

  await parser.parseAllProjectsWithCallback(_plugin, (project) => {
    if (scanMode === 'full' && enabledDirs.length > 0 && project.path) {
      project.groupId = matchGroupId(project.path, enabledDirs);
    }
    nextProjects.push(project);
  });

  return nextProjects;
}

applyProjects(nextProjects: Project[]) {
  this.projects = nextProjects;
}

async refreshFull(_plugin: any, scanMode: ScanMode, directories: ProjectDirectory[]): Promise<void> {
  const enabledDirs = directories.filter(d => d.enabled);
  const parser = new MarkdownParser(enabledDirs, scanMode);
  const nextProjects = await this.buildProjectsFromParser(parser, _plugin, scanMode, directories);
  this.applyProjects(nextProjects);
  dirtyDocTracker.clearAll();
}
```

- [ ] **Step 4: Add directed remove support while the store file is open**

Add a helper and use it from the directed refresh path:

```ts
removeProjectsByIds(projectIds: string[]) {
  if (projectIds.length === 0) return;
  const idSet = new Set(projectIds);
  this.projects = this.projects.filter(project => !idSet.has(project.id));
}
```

In `refreshDirtyDocs()`:

```ts
if (project) {
  this.updateProjectsIncrementally([project]);
}
else {
  this.removeProjectsByIds([docId]);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/stores/projectStore.refreshFlow.test.ts -v`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add test/stores/projectStore.refreshFlow.test.ts src/stores/projectStore.ts
git commit -m "fix(refresh): apply full refresh atomically"
```

## Task 2: Add a Real Refresh Queue

**Files:**
- Create: `src/services/refreshCoordinator.ts`
- Create: `test/services/refreshCoordinator.test.ts`
- Modify: `src/utils/dirtyDocTracker.ts`
- Modify: `src/utils/eventBus.ts`

- [ ] **Step 1: Write the failing coordinator queue tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createRefreshCoordinator } from '@/services/refreshCoordinator';

describe('refreshCoordinator', () => {
  it('reruns refresh after a second request arrives during an in-flight refresh', async () => {
    const calls: string[] = [];
    let releaseFirstRun!: () => void;

    const coordinator = createRefreshCoordinator({
      runFullRefresh: vi.fn(async () => {
        calls.push('full');
        await new Promise<void>((resolve) => {
          releaseFirstRun = resolve;
        });
      }),
      runDirectedRefresh: vi.fn(async () => {
        calls.push('directed');
      }),
      applySettingsOnly: vi.fn(),
      emitRefreshCompleted: vi.fn(),
    });

    const first = coordinator.request({ type: 'directed', docIds: ['doc-1'] });
    const second = coordinator.request({ type: 'directed', docIds: ['doc-2'] });

    releaseFirstRun();
    await Promise.all([first, second]);

    expect(calls).toEqual(['directed', 'directed']);
  });

  it('escalates to full refresh when any queued request requires full', async () => {
    const runFullRefresh = vi.fn(async () => {});
    const runDirectedRefresh = vi.fn(async () => {});

    const coordinator = createRefreshCoordinator({
      runFullRefresh,
      runDirectedRefresh,
      applySettingsOnly: vi.fn(),
      emitRefreshCompleted: vi.fn(),
    });

    await coordinator.request({ type: 'directed', docIds: ['doc-1'] });
    await coordinator.request({ type: 'full', reason: 'moveDoc' });

    expect(runFullRefresh).toHaveBeenCalled();
    expect(runDirectedRefresh).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/services/refreshCoordinator.test.ts -v`

Expected: FAIL because `refreshCoordinator.ts` does not exist yet.

- [ ] **Step 3: Implement the coordinator**

Create `src/services/refreshCoordinator.ts`:

```ts
export type RefreshRequest =
  | { type: 'settings-only'; payload?: Record<string, unknown> }
  | { type: 'directed'; docIds: string[]; reason?: string }
  | { type: 'full'; reason: string };

type RefreshCoordinatorOptions = {
  runFullRefresh: () => Promise<void>;
  runDirectedRefresh: (docIds: string[]) => Promise<void>;
  applySettingsOnly: (payload?: Record<string, unknown>) => Promise<void> | void;
  emitRefreshCompleted: () => void;
};

export function createRefreshCoordinator(options: RefreshCoordinatorOptions) {
  let running = false;
  let pendingFull = false;
  let pendingSettingsPayload: Record<string, unknown> | undefined;
  const pendingDocIds = new Set<string>();

  const consumePending = () => {
    const snapshot = {
      full: pendingFull,
      payload: pendingSettingsPayload,
      docIds: [...pendingDocIds],
    };
    pendingFull = false;
    pendingSettingsPayload = undefined;
    pendingDocIds.clear();
    return snapshot;
  };

  const mergeRequest = (request: RefreshRequest) => {
    if (request.type === 'full') {
      pendingFull = true;
      return;
    }

    if (request.type === 'settings-only') {
      pendingSettingsPayload = {
        ...(pendingSettingsPayload ?? {}),
        ...(request.payload ?? {}),
      };
      return;
    }

    request.docIds.forEach(docId => pendingDocIds.add(docId));
  };

  const drain = async () => {
    if (running) return;
    running = true;

    try {
      while (pendingFull || pendingDocIds.size > 0 || pendingSettingsPayload) {
        const snapshot = consumePending();

        if (snapshot.full) {
          await options.runFullRefresh();
        }
        else if (snapshot.docIds.length > 0) {
          await options.runDirectedRefresh(snapshot.docIds);
        }
        else {
          await options.applySettingsOnly(snapshot.payload);
        }

        options.emitRefreshCompleted();
      }
    }
    finally {
      running = false;
    }
  };

  return {
    request: async (request: RefreshRequest) => {
      mergeRequest(request);
      await drain();
    },
  };
}
```

- [ ] **Step 4: Expose small helper changes in support files**

In `src/utils/dirtyDocTracker.ts`, add one snapshot helper:

```ts
consumeDirtyDocs(): string[] {
  const docs = Array.from(this.dirtyDocIds);
  this.dirtyDocIds.clear();
  return docs;
}
```

In `src/utils/eventBus.ts`, add an explicit refresh request event:

```ts
REFRESH_REQUEST_SUBMITTED: 'refresh:request-submitted',
```

- [ ] **Step 5: Run coordinator tests**

Run: `npx vitest run test/services/refreshCoordinator.test.ts -v`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/services/refreshCoordinator.ts src/utils/dirtyDocTracker.ts src/utils/eventBus.ts test/services/refreshCoordinator.test.ts
git commit -m "feat(refresh): add queued refresh coordinator"
```

## Task 3: Route Plugin Events Through the Coordinator

**Files:**
- Modify: `src/index.ts`
- Modify: `test/index.localDataMutation.test.ts`

- [ ] **Step 1: Update the plugin wiring test first**

Replace the current regex assertion with coordinator-based routing checks:

```ts
it('registers LOCAL_DATA_MUTATED and routes it through refresh coordinator requests', () => {
  const indexSource = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf-8');

  expect(indexSource).toMatch(
    /this\.registerAppEventListener\(\s*Events\.LOCAL_DATA_MUTATED,[\s\S]*refreshCoordinator\?\.request\(\{\s*type:\s*['"]directed['"]/s,
  );
});

it('keeps reminder scheduling only after DATA_REFRESHED', () => {
  const indexSource = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf-8');

  expect(indexSource).toMatch(
    /this\.registerAppEventListener\(\s*Events\.DATA_REFRESHED,\s*\(\)\s*=>\s*\{[\s\S]*reminderService\.scheduleRebuild\(\);[\s\S]*\}\s*\)/s,
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/index.localDataMutation.test.ts -v`

Expected: FAIL because `index.ts` still routes through `scheduleRefresh()`.

- [ ] **Step 3: Add coordinator lifecycle and request helpers to `index.ts`**

Add a field:

```ts
private refreshCoordinator: ReturnType<typeof createRefreshCoordinator> | null = null;
```

Initialize it after Pinia/store setup:

```ts
this.refreshCoordinator = createRefreshCoordinator({
  runFullRefresh: async () => {
    await projectStore.refreshFull(this, settings.scanMode || 'full', settings.directories.filter(d => d.enabled));
  },
  runDirectedRefresh: async (docIds) => {
    dirtyDocTracker.markDirty(docIds);
    await projectStore.refreshDirtyDocs(
      this,
      settings.scanMode || 'full',
      settings.directories,
      docIds,
    );
  },
  applySettingsOnly: async () => {
    // no-op here; views patch their settings store
  },
  emitRefreshCompleted: () => {
    eventBus.emit(Events.DATA_REFRESHED, { plugin: this, items: projectStore.items });
  },
});
```

Add a small helper:

```ts
private requestRefresh(request: RefreshRequest) {
  return this.refreshCoordinator?.request(request);
}
```

- [ ] **Step 4: Replace `scheduleRefresh()` call sites with explicit requests**

Examples:

```ts
this.registerAppEventListener(Events.LOCAL_DATA_MUTATED, (payload?: { blockId?: string }) => {
  const docIds = payload?.blockId ? [payload.blockId] : [];
  void this.requestRefresh({ type: 'directed', docIds, reason: 'local-mutation' });
});
```

```ts
if (fullRefreshCmds.includes(data.cmd)) {
  void this.requestRefresh({ type: 'full', reason: data.cmd });
  return;
}
```

```ts
if (rootIDs.length > 0) {
  void this.requestRefresh({ type: 'directed', docIds: rootIDs, reason: data.cmd });
}
else {
  void this.requestRefresh({ type: 'full', reason: `${data.cmd}:missing-rootIDs` });
}
```

Keep `scheduleRefresh()` only if it becomes a thin debounce wrapper around `requestRefresh()`. Otherwise delete it.

- [ ] **Step 5: Run the focused wiring test**

Run: `npx vitest run test/index.localDataMutation.test.ts -v`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/index.ts test/index.localDataMutation.test.ts
git commit -m "refactor(refresh): route plugin refresh events through coordinator"
```

## Task 4: Remove View-Owned Refresh Execution

**Files:**
- Modify: `src/tabs/CalendarTab.vue`
- Modify: `src/tabs/DesktopTodoDock.vue`
- Modify: `src/tabs/GanttTab.vue`
- Modify: `src/tabs/ProjectTab.vue`
- Modify: `src/tabs/WorkbenchTab.vue`
- Modify: `src/tabs/PomodoroDock.vue`
- Modify: `src/tabs/PomodoroStatsTab.vue`
- Modify: `src/tabs/AiChatDock.vue`
- Modify: `src/tabs/DesktopHabitDock.vue`
- Modify: `src/tabs/QuadrantTab.vue`
- Modify: `src/mobile/panels/MobileTodoPanel.vue`
- Modify: `src/mobile/panels/MobileHabitPanel.vue`
- Modify: `src/components/workbench/view/WorkbenchHabitView.vue`
- Modify: `src/components/workbench/dialogs/HabitWidgetDetailDialog.vue`
- Modify: `src/composables/useHabitWorkspace.ts`

- [ ] **Step 1: Normalize one representative tab first**

Use `src/tabs/CalendarTab.vue` as the template.

Replace:

```ts
const handleDataRefresh = async (payload?: Record<string, unknown>) => {
  // patch settings
  await nextTick();
  await projectStore.refresh(plugin, settingsStore.scanMode, settingsStore.directories);
};
```

With:

```ts
const handleDataRefresh = async (payload?: Record<string, unknown>) => {
  const storeKeys = ['directories', 'groups', 'defaultGroup', 'calendarDefaultView', 'lunchBreakStart', 'lunchBreakEnd', 'showPomodoroBlocks', 'showPomodoroTotal', 'todoDock', 'scanMode'];
  const patch: Record<string, unknown> = {};

  for (const key of storeKeys) {
    if (payload?.[key] !== undefined) {
      patch[key] = payload[key];
    }
  }

  if (Object.keys(patch).length > 0) {
    settingsStore.$patch(patch);
  }
  else {
    settingsStore.loadFromPlugin();
  }

  await nextTick();
};
```

- [ ] **Step 2: Update manual refresh buttons to request, not execute**

For each view:

```ts
const handleRefresh = async () => {
  if (!plugin) return;
  eventBus.emit(Events.REFRESH_REQUEST_SUBMITTED, { type: 'full', reason: 'manual-view-refresh' });
};
```

For BroadcastChannel listeners, keep payload patching but remove direct refresh execution:

```ts
onRefresh: payload => handleDataRefresh(payload),
```

- [ ] **Step 3: Apply the same pattern to the remaining views**

Checklist:

```ts
// remove direct calls like:
await projectStore.refresh(plugin, settingsStore.scanMode, settingsStore.directories);

// keep:
unsubscribeRefresh = eventBus.on(Events.DATA_REFRESH, handleDataRefresh);
```

Where a workflow truly needs an immediate data pull after an explicit user action, replace it with:

```ts
eventBus.emit(Events.REFRESH_REQUEST_SUBMITTED, { type: 'directed', docIds: [docId], reason: 'habit-action' });
```

- [ ] **Step 4: Run the affected UI-focused tests**

Run: `npm test -- --runInBand`

Expected: PASS, with any failures pointing to components still assuming they own refresh execution.

- [ ] **Step 5: Commit**

```bash
git add src/tabs src/mobile/panels src/components/workbench src/composables
git commit -m "refactor(refresh): remove view-owned refresh execution"
```

## Task 5: Finalize Request Types and Regression Coverage

**Files:**
- Modify: `src/utils/eventBus.ts`
- Modify: `src/index.ts`
- Modify: `src/services/refreshCoordinator.ts`
- Modify: `test/services/refreshCoordinator.test.ts`
- Modify: `test/stores/projectStore.refreshFlow.test.ts`
- Modify: `test/index.localDataMutation.test.ts`

- [ ] **Step 1: Add explicit request payload typing**

In `src/utils/eventBus.ts`:

```ts
export type RefreshRequestPayload =
  | { type: 'settings-only'; payload?: Record<string, unknown> }
  | { type: 'directed'; docIds: string[]; reason?: string }
  | { type: 'full'; reason: string };
```

Use that type in `index.ts`:

```ts
private requestRefresh(request: RefreshRequestPayload) {
  return this.refreshCoordinator?.request(request);
}
```

- [ ] **Step 2: Add tests for settings-only and full-refresh escalation**

Extend `test/services/refreshCoordinator.test.ts`:

```ts
it('applies settings-only payloads without running project refresh', async () => {
  const applySettingsOnly = vi.fn(async () => {});
  const runFullRefresh = vi.fn(async () => {});
  const runDirectedRefresh = vi.fn(async () => {});

  const coordinator = createRefreshCoordinator({
    runFullRefresh,
    runDirectedRefresh,
    applySettingsOnly,
    emitRefreshCompleted: vi.fn(),
  });

  await coordinator.request({
    type: 'settings-only',
    payload: { calendarDefaultView: 'timeGridWeek' },
  });

  expect(applySettingsOnly).toHaveBeenCalledWith({ calendarDefaultView: 'timeGridWeek' });
  expect(runFullRefresh).not.toHaveBeenCalled();
  expect(runDirectedRefresh).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run the targeted regression suite**

Run:

```bash
npx vitest run test/services/refreshCoordinator.test.ts test/stores/projectStore.refreshFlow.test.ts test/index.localDataMutation.test.ts -v
```

Expected:

- `refreshCoordinator` tests PASS
- `projectStore.refreshFlow` tests PASS
- `index.localDataMutation` tests PASS

- [ ] **Step 4: Run the full repository test suite**

Run: `npm test`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/eventBus.ts src/index.ts src/services/refreshCoordinator.ts test/services/refreshCoordinator.test.ts test/stores/projectStore.refreshFlow.test.ts test/index.localDataMutation.test.ts
git commit -m "test(refresh): cover coordinated refresh flows"
```

## Self-Review

### Spec coverage

- Atomic full refresh without flicker: Task 1
- Refresh queue / pending rerun: Task 2
- Centralized execution in plugin runtime: Task 3
- Views stop calling `projectStore.refresh()` directly: Task 4
- Explicit request typing and regression coverage: Task 5
- `DATA_REFRESHED` remains the post-refresh side-effect boundary: Tasks 3 and 5

No spec section is left without an implementing task.

### Placeholder scan

- No `TODO`, `TBD`, or "implement later" markers remain
- Every code-changing step includes concrete snippets
- Every validation step includes an exact command

### Type consistency

- Coordinator request type name: `RefreshRequest` / `RefreshRequestPayload`
- Completion signal remains `Events.DATA_REFRESHED`
- Request signal added as `Events.REFRESH_REQUEST_SUBMITTED`
- Atomic store entry points remain `refreshFull()`, `refreshDirtyDocs()`, `applyProjects()`, `removeProjectsByIds()`
