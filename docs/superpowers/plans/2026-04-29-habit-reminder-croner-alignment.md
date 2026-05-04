# Habit Reminder Croner Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让习惯提醒、零点跨天推进和 TodoDock 的 today/week 视图都对齐到 `ReminderService + projectStore.currentDate` 这一套单一时钟模型。

**Architecture:** 保留 `ReminderService` 作为唯一提醒编排入口，在现有事项提醒与习惯提醒 Cron 调度之上新增一个零点一次性 job，负责推进 `projectStore.currentDate` 并触发全量重建。桌面端与移动端 TodoDock 去掉各自本地轮询，只消费 `projectStore.currentDate`，从而消除提醒系统与 Todo 视图短时间跨天不一致的问题。

**Tech Stack:** TypeScript, Vue 3, Pinia, Vitest, Croner

---

## File Structure

- Modify: `src/services/reminderService.ts`
  - 在现有事项/习惯 Cron 调度上增加零点刷新 job、统一 stop/cleanup 生命周期。
- Modify: `src/stores/projectStore.ts`
  - 视需要补一个轻量日期推进 action，避免服务层直接散写 `currentDate`。
- Modify: `src/tabs/DesktopTodoDock.vue`
  - 去掉本地 `todayDate` 和分钟轮询，改为直接依赖 `projectStore.currentDate`。
- Modify: `src/mobile/MobileTodoDock.vue`
  - 去掉本地 `todayDate` 和分钟轮询，改为直接依赖 `projectStore.currentDate`，并在日期变化时重算 today/week 筛选。
- Modify: `test/services/reminderService.test.ts`
  - 补零点 job 调度、清理、日期推进相关测试。
- Create or Modify: `test/tabs/DesktopTodoDock.test.ts`
  - 如果仓库已有 Vue 组件测试模式则直接新增；否则复用现有测试设施做最小组件测试。
- Create or Modify: `test/mobile/MobileTodoDock.test.ts`
  - 验证移动端 today/week 筛选对 `projectStore.currentDate` 的依赖。

## Task 1: 为 ReminderService 增加零点日期推进 job

**Files:**
- Modify: `src/services/reminderService.ts`
- Modify: `src/stores/projectStore.ts`
- Test: `test/services/reminderService.test.ts`

- [ ] **Step 1: 先写失败测试，覆盖零点 job 的生命周期**

在 `test/services/reminderService.test.ts` 中新增以下测试，沿用当前文件对 `Cron`、通知和 store stub 的 mock 方式：

```ts
it('启动时应挂载下一次零点刷新 job', () => {
  vi.setSystemTime(new Date('2026-04-07T10:30:00'));
  const projectStore = makeStore() as any;

  service.start({} as any, projectStore);

  expect((service as any).midnightRefreshJob).toBeTruthy();
  expect(Cron).toHaveBeenCalledWith(
    expect.any(Date),
    expect.any(Function),
  );
});

it('零点 job 触发后应推进 currentDate 并重建调度', () => {
  vi.setSystemTime(new Date('2026-04-07T23:59:59'));
  const projectStore = makeStore() as any;
  const rebuildSpy = vi.spyOn(service as any, 'rebuildSchedule');

  service.start({} as any, projectStore);

  vi.setSystemTime(new Date('2026-04-08T00:00:01'));
  (service as any).handleMidnightRefresh();

  expect(projectStore.currentDate).toBe('2026-04-08');
  expect(rebuildSpy).toHaveBeenCalled();
  expect((service as any).midnightRefreshJob).toBeTruthy();
});

it('stop 时应清理零点 job', () => {
  vi.setSystemTime(new Date('2026-04-07T10:30:00'));
  const projectStore = makeStore() as any;

  service.start({} as any, projectStore);
  const midnightJob = (service as any).midnightRefreshJob;
  service.stop();

  expect(midnightJob.stop).toHaveBeenCalled();
  expect((service as any).midnightRefreshJob).toBeNull();
});
```

- [ ] **Step 2: 跑测试，确认按预期失败**

Run:

```bash
npx vitest run test/services/reminderService.test.ts
```

Expected: FAIL，原因应为 `midnightRefreshJob` / `handleMidnightRefresh()` 尚不存在，或 `stop()` 尚未清理零点 job。

- [ ] **Step 3: 写最小实现，让 ReminderService 接管跨天**

在 `src/services/reminderService.ts` 中补这组最小实现：

```ts
private midnightRefreshJob: Cron | null = null;

private scheduleMidnightRefresh(): void {
  if (this.midnightRefreshJob) {
    this.midnightRefreshJob.stop();
    this.midnightRefreshJob = null;
  }

  const nextMidnight = new Date();
  nextMidnight.setHours(24, 0, 0, 0);

  this.midnightRefreshJob = new Cron(nextMidnight, () => {
    this.handleMidnightRefresh();
  });
}

private handleMidnightRefresh(): void {
  if (!this.projectStore) return;

  const nextDate = dayjs().format('YYYY-MM-DD');
  if (typeof this.projectStore.setCurrentDate === 'function') {
    this.projectStore.setCurrentDate(nextDate);
  } else {
    this.projectStore.currentDate = nextDate;
  }

  this.rebuildSchedule();
  this.scheduleMidnightRefresh();
}
```

同时做这几个接线动作：

```ts
start(_plugin: Plugin, projectStore: ProjectStoreType): void {
  this.projectStore = projectStore;
  this.requestNotificationPermission();
  this.setupVisibilityListener();
  this.rebuildSchedule();
  this.scheduleMidnightRefresh();
}

private clearAllJobs(): void {
  for (const [, job] of this.scheduledJobs) job.stop();
  this.scheduledJobs.clear();

  for (const [, job] of this.habitScheduledJobs) job.stop();
  this.habitScheduledJobs.clear();

  if (this.midnightRefreshJob) {
    this.midnightRefreshJob.stop();
    this.midnightRefreshJob = null;
  }
}
```

如果要避免服务层直接写 store state，则在 `src/stores/projectStore.ts` 增加一个极小 action：

```ts
setCurrentDate(newDate: string) {
  this.currentDate = newDate;
}
```

- [ ] **Step 4: 跑测试，确认转绿**

Run:

```bash
npx vitest run test/services/reminderService.test.ts
```

Expected: PASS，现有事项/习惯提醒测试继续通过，新增零点 job 生命周期测试转绿。

- [ ] **Step 5: 提交这一小步**

```bash
git add src/services/reminderService.ts src/stores/projectStore.ts test/services/reminderService.test.ts
git commit -m "feat(reminder): refresh schedules at midnight"
```

## Task 2: 桌面 TodoDock 收口到 projectStore.currentDate

**Files:**
- Modify: `src/tabs/DesktopTodoDock.vue`
- Test: `test/tabs/DesktopTodoDock.test.ts`

- [ ] **Step 1: 先写失败测试，锁定桌面端不再自管日期**

新增 `test/tabs/DesktopTodoDock.test.ts`，最小覆盖两个行为：

```ts
it('today 过滤应直接使用 projectStore.currentDate', async () => {
  const projectStore = createProjectStoreStub({ currentDate: '2026-04-07' });
  const wrapper = mount(DesktopTodoDock, {
    global: {
      plugins: [createTestingPinia({ stubActions: false })],
      provide: { projectStore },
    },
  });

  expect((wrapper.vm as any).dateRange).toEqual({
    start: '1970-01-01',
    end: '2026-04-07',
  });

  projectStore.currentDate = '2026-04-08';
  await nextTick();

  expect((wrapper.vm as any).dateRange).toEqual({
    start: '1970-01-01',
    end: '2026-04-08',
  });
});

it('卸载时不应再清理本地跨天 interval', async () => {
  const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
  const wrapper = mount(DesktopTodoDock, { /* same test shell */ });

  wrapper.unmount();

  expect(clearIntervalSpy).not.toHaveBeenCalledWith(expect.any(Number));
});
```

如果现有组件测试基座不能直接 mount Dock，可退一步抽取一个纯函数 helper，例如：

```ts
export function buildTodoDateRange(
  filterType: DateFilterType,
  currentDate: string,
  startDate: string,
  endDate: string,
) { /* ... */ }
```

然后对 helper 写单测；不要为了凑组件测试强行引入大规模测试基建。

- [ ] **Step 2: 跑测试，确认失败**

Run:

```bash
npx vitest run test/tabs/DesktopTodoDock.test.ts
```

Expected: FAIL，原因应为组件仍在使用 `todayDate` 本地 ref 和 `setInterval` 轮询。

- [ ] **Step 3: 写最小实现，移除桌面端本地跨天轮询**

修改 `src/tabs/DesktopTodoDock.vue`：

```ts
const currentDate = computed(() => projectStore.currentDate);

const dateRange = computed(() => {
  if (dateFilterType.value === 'all') return null;
  if (dateFilterType.value === 'today') {
    return { start: '1970-01-01', end: currentDate.value };
  }
  if (dateFilterType.value === 'week') {
    const nextWeek = dayjs(currentDate.value).add(6, 'day').format('YYYY-MM-DD');
    return { start: '1970-01-01', end: nextWeek };
  }
  return { start: startDate.value, end: endDate.value };
});

const completedDateRange = computed(() => {
  if (dateFilterType.value === 'all') return null;
  if (dateFilterType.value === 'today') {
    return { start: currentDate.value, end: currentDate.value };
  }
  if (dateFilterType.value === 'week') {
    const nextWeek = dayjs(currentDate.value).add(6, 'day').format('YYYY-MM-DD');
    return { start: currentDate.value, end: nextWeek };
  }
  return { start: startDate.value, end: endDate.value };
});
```

并删除：

```ts
const todayDate = ref(...)
let dateCheckTimer ...
const startDateCheck = () => ...
```

同时删掉 `onMounted()` 里的 `startDateCheck()` 和 `onUnmounted()` 里的 interval cleanup。

- [ ] **Step 4: 跑测试，确认转绿**

Run:

```bash
npx vitest run test/tabs/DesktopTodoDock.test.ts
```

Expected: PASS，桌面端 dateRange/completedDateRange 会随 `projectStore.currentDate` 变化而变化。

- [ ] **Step 5: 提交这一小步**

```bash
git add src/tabs/DesktopTodoDock.vue test/tabs/DesktopTodoDock.test.ts
git commit -m "refactor(todo): use store date in desktop dock"
```

## Task 3: 移动 TodoDock 收口到 projectStore.currentDate

**Files:**
- Modify: `src/mobile/MobileTodoDock.vue`
- Test: `test/mobile/MobileTodoDock.test.ts`

- [ ] **Step 1: 先写失败测试，覆盖移动端 today/week 重新计算**

新增 `test/mobile/MobileTodoDock.test.ts`，至少覆盖这两个行为：

```ts
it('today 筛选应基于 projectStore.currentDate 计算 dateRange', async () => {
  const projectStore = createProjectStoreStub({ currentDate: '2026-04-07' });
  const wrapper = mount(MobileTodoDock, createMobileDockMountOptions(projectStore));

  expect((wrapper.vm as any).state.dateRange).toEqual({
    start: '1970-01-01',
    end: '2026-04-07',
  });

  projectStore.currentDate = '2026-04-08';
  await nextTick();

  expect((wrapper.vm as any).state.dateRange).toEqual({
    start: '1970-01-01',
    end: '2026-04-08',
  });
});

it('week 筛选在 currentDate 变化后应重新应用', async () => {
  const projectStore = createProjectStoreStub({ currentDate: '2026-04-07' });
  const wrapper = mount(MobileTodoDock, createMobileDockMountOptions(projectStore));

  (wrapper.vm as any).state.dateFilter = 'week';
  (wrapper.vm as any).applyFilters();
  expect((wrapper.vm as any).state.dateRange).toEqual({
    start: '1970-01-01',
    end: '2026-04-13',
  });

  projectStore.currentDate = '2026-04-08';
  await nextTick();

  expect((wrapper.vm as any).state.dateRange).toEqual({
    start: '1970-01-01',
    end: '2026-04-14',
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run:

```bash
npx vitest run test/mobile/MobileTodoDock.test.ts
```

Expected: FAIL，原因应为移动端当前仍依赖 `todayDate` 本地 ref，并且只有 interval 命中时才会重新 `applyFilters()`。

- [ ] **Step 3: 写最小实现，移除移动端本地跨天轮询**

修改 `src/mobile/MobileTodoDock.vue`：

```ts
const currentDate = computed(() => projectStore.currentDate);

const applyFilters = () => {
  if (state.dateFilter === 'today') {
    state.dateRange = { start: '1970-01-01', end: currentDate.value };
  } else if (state.dateFilter === 'week') {
    const nextWeek = dayjs(currentDate.value).add(6, 'day').format('YYYY-MM-DD');
    state.dateRange = { start: '1970-01-01', end: nextWeek };
  } else if (state.dateFilter === 'all') {
    state.dateRange = null;
  }
};

const completedDateRange = computed(() => {
  if (state.dateFilter === 'all') return null;
  if (state.dateFilter === 'today') {
    return { start: currentDate.value, end: currentDate.value };
  }
  if (state.dateFilter === 'week') {
    const nextWeek = dayjs(currentDate.value).add(6, 'day').format('YYYY-MM-DD');
    return { start: currentDate.value, end: nextWeek };
  }
  return state.dateRange;
});

watch(
  () => projectStore.currentDate,
  () => {
    if (state.dateFilter === 'today' || state.dateFilter === 'week') {
      applyFilters();
    }
  }
);
```

并删除：

```ts
const todayDate = ref(...)
let dateCheckTimer ...
const startDateCheck = () => ...
```

同时删掉 `onMounted()` 里的 `startDateCheck()` 与 `onUnmounted()` 中对应 cleanup。

- [ ] **Step 4: 跑测试，确认转绿**

Run:

```bash
npx vitest run test/mobile/MobileTodoDock.test.ts
```

Expected: PASS，移动端 today/week 筛选在 `projectStore.currentDate` 推进后立即同步。

- [ ] **Step 5: 提交这一小步**

```bash
git add src/mobile/MobileTodoDock.vue test/mobile/MobileTodoDock.test.ts
git commit -m "refactor(todo): use store date in mobile dock"
```

## Task 4: 跑聚焦回归，验证提醒与 Todo 跨天统一

**Files:**
- Test: `test/services/reminderService.test.ts`
- Test: `test/tabs/DesktopTodoDock.test.ts`
- Test: `test/mobile/MobileTodoDock.test.ts`
- Test: `test/services/habitReminder.test.ts`

- [ ] **Step 1: 跑提醒相关聚焦测试**

Run:

```bash
npx vitest run test/services/habitReminder.test.ts test/services/reminderService.test.ts
```

Expected: PASS，确认习惯提醒条目构建、事项/习惯 Cron 调度与零点刷新不会互相打架。

- [ ] **Step 2: 跑 TodoDock 聚焦测试**

Run:

```bash
npx vitest run test/tabs/DesktopTodoDock.test.ts test/mobile/MobileTodoDock.test.ts
```

Expected: PASS，确认两端都已不再维护本地跨天轮询。

- [ ] **Step 3: 跑一组 store 回归测试**

Run:

```bash
npx vitest run test/stores/projectStore.test.ts
```

Expected: PASS，确认 `currentDate` 作为统一日期源不会破坏现有 store 行为。

- [ ] **Step 4: 如组件测试基建允许，再跑全量测试**

Run:

```bash
npm test
```

Expected: PASS；如果全量太重，至少保留前 3 步结果作为本轮交付依据。

- [ ] **Step 5: 视差异决定是否补一个收尾提交**

如果前面步骤没有新增修复，则不需要额外提交；若验证中产生小修正，再执行：

```bash
git add src/services/reminderService.ts src/stores/projectStore.ts src/tabs/DesktopTodoDock.vue src/mobile/MobileTodoDock.vue test/services/reminderService.test.ts test/tabs/DesktopTodoDock.test.ts test/mobile/MobileTodoDock.test.ts
git commit -m "test(reminder): cover midnight date alignment"
```

## Self-Review

- Spec coverage:
  - 习惯提醒 Cron 化已在既有实现基础上保留，并由 Task 1 补齐零点推进。
  - `projectStore.currentDate` 成为唯一日期源由 Task 1/2/3 共同覆盖。
  - Desktop/Mobile TodoDock 去掉本地轮询由 Task 2/3 覆盖。
  - 零点推进后提醒与视图同步刷新由 Task 1 和 Task 3 的测试共同覆盖。
- Placeholder scan:
  - 没有 `TBD` / `TODO` / “后续补上” 之类占位语。
  - 每个任务都给了明确文件、测试命令和最小实现方向。
- Type consistency:
  - `midnightRefreshJob`、`scheduleMidnightRefresh()`、`handleMidnightRefresh()`、`projectStore.currentDate` 在整份计划中命名一致。
