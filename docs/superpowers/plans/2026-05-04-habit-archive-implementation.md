# Habit Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit habit archive support backed by Markdown `📦YYYY-MM-DD`, so archived habits are hidden from active lists, cannot be checked in, and stop producing reminders while preserving history and detail views.

**Architecture:** Keep the feature aligned with the existing “document is the source of truth” habit model. Parsing owns `archivedAt`, domain/composable layers own active-vs-archived filtering and guard logic, and detail surfaces own archive/unarchive actions by rewriting the habit definition line instead of adding parallel metadata stores.

**Tech Stack:** Vue 3 SFCs, Pinia-backed composables, TypeScript, Vitest with happy-dom, existing SiYuan block update helpers.

---

## File Structure

- Modify: `src/types/models.ts`
  - Add `archivedAt?: string` to `Habit`
- Modify: `src/parser/habitParser.ts`
  - Parse `📦YYYY-MM-DD` on habit definition lines
  - Reject malformed archive markers and record-line archive markers
- Modify: `src/parser/core.ts`
  - Ensure parsed `archivedAt` flows into project habits without affecting record parsing
- Modify: `src/domain/habit/habitStats.ts`
  - Preserve existing `isEnded` logic, add helpers or local guards for active status where needed
- Modify: `src/composables/useHabitWorkspace.ts`
  - Hide archived habits from default `habits` list
  - Block `checkInHabit()` / `incrementHabit()` when archived
  - Expose archive/unarchive actions for detail surfaces
- Modify: `src/components/habit/HabitWorkspaceDetailPane.vue`
  - Add archive / unarchive action in detail header action area
  - Show archived state notice and disable check-in inputs in detail
- Modify: `src/tabs/DesktopHabitDock.vue`
  - Pass archive actions/state through current detail shell
- Modify: `src/mobile/components/habit/MobileHabitDetailSheet.vue`
  - Surface archive / unarchive action in mobile detail
- Modify: `src/mobile/panels/MobileHabitPanel.vue`
  - Wire archive/unarchive through existing mobile habit detail flow
- Modify: `src/services/habitReminder.ts`
  - Skip archived habits entirely
- Modify: `src/utils/slashCommands.ts`
  - `/dk` on archived habit definition lines should stop and toast “习惯已归档”
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`
  - Add archive-related strings
- Test: `test/parser/habitParser.test.ts`
- Test: `test/composables/useHabitWorkspace.test.ts`
- Test: `test/services/habitReminder.test.ts`
- Test: `test/utils/slashCommands.habit.test.ts`
- Test: `test/tabs/DesktopHabitDock.test.ts`
- Test: `test/mobile/MobileHabitDetailSheet.test.ts`

---

### Task 1: Parse And Model `archivedAt`

**Files:**
- Modify: `src/types/models.ts`
- Modify: `src/parser/habitParser.ts`
- Test: `test/parser/habitParser.test.ts`

- [ ] **Step 1: Write the failing parser tests**

Add cases like:

```ts
it('parses archivedAt from a habit definition line', () => {
  const result = parseHabitLine('喝水 🎯2026-04-01 8杯 🔄每天 📦2026-05-04');

  expect(result).not.toBeNull();
  expect(result?.archivedAt).toBe('2026-05-04');
});

it('does not treat malformed archive text as archived', () => {
  const result = parseHabitLine('喝水 🎯2026-04-01 8杯 🔄每天 📦今天');

  expect(result).not.toBeNull();
  expect(result?.archivedAt).toBeUndefined();
});

it('does not parse archive markers on record lines', () => {
  expect(parseCheckInRecordLine('喝水 3/8杯 📅2026-05-01 📦2026-05-04', 'habit-1')).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run test/parser/habitParser.test.ts
```

Expected:
- FAIL
- `archivedAt` is missing from parsed results
- record-line archive marker test fails against current parser behavior

- [ ] **Step 3: Write minimal implementation**

In `src/types/models.ts`, extend the interface:

```ts
export interface Habit {
  // ...
  archivedAt?: string;
}
```

In `src/parser/habitParser.ts`, add archive marker parsing near other habit markers:

```ts
const archiveMatch = line.match(/(?:^|\s)📦(\d{4}-\d{2}-\d{2})(?=\s|$)/);
if (archiveMatch) {
  result.archivedAt = archiveMatch[1];
}
```

And reject archive markers in check-in records:

```ts
if (normalizedLine.includes('📦')) {
  return null;
}
```

Keep malformed archive text ignored rather than throwing or nulling the whole habit definition.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run test/parser/habitParser.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/models.ts src/parser/habitParser.ts test/parser/habitParser.test.ts
git commit -m "feat(habit): parse archive marker"
```

---

### Task 2: Hide Archived Habits From Active Workspace Lists

**Files:**
- Modify: `src/composables/useHabitWorkspace.ts`
- Test: `test/composables/useHabitWorkspace.test.ts`

- [ ] **Step 1: Write the failing composable test**

Add a focused test:

```ts
it('filters archived habits out of the default workspace list', async () => {
  projectStore.projects = [{
    id: 'p1',
    name: 'P1',
    items: [],
    links: [],
    habits: [
      { ...createHabit('active-1'), archivedAt: undefined },
      { ...createHabit('archived-1'), archivedAt: '2026-05-04' },
    ],
  }] as any;

  const { useHabitWorkspace } = await import('@/composables/useHabitWorkspace');
  const workspace = useHabitWorkspace();

  expect(workspace.habits.value.map(h => h.blockId)).toEqual(['active-1']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run test/composables/useHabitWorkspace.test.ts
```

Expected:
- FAIL
- Archived habit still appears in `habits.value`

- [ ] **Step 3: Write minimal implementation**

In `src/composables/useHabitWorkspace.ts`, filter the computed habit list:

```ts
const habits = computed(() => {
  const source = groupId.value
    ? projectStore.getHabitsByGroup(groupId.value)
    : projectStore.habits;

  return source.filter(habit => !habit.archivedAt);
});
```

Do not remove archived habits from the store itself; only hide them from the active workspace list.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run test/composables/useHabitWorkspace.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/composables/useHabitWorkspace.ts test/composables/useHabitWorkspace.test.ts
git commit -m "feat(habit): hide archived habits from active workspace"
```

---

### Task 3: Block Check-In And Increment For Archived Habits

**Files:**
- Modify: `src/composables/useHabitWorkspace.ts`
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`
- Test: `test/composables/useHabitWorkspace.test.ts`

- [ ] **Step 1: Write the failing guard tests**

Add tests like:

```ts
it('does not call binary check-in service for archived habits', async () => {
  const archivedHabit = { ...createHabit('habit-1'), archivedAt: '2026-05-04' };
  const { useHabitWorkspace } = await import('@/composables/useHabitWorkspace');
  const workspace = useHabitWorkspace();

  await workspace.checkInHabit(archivedHabit as any);

  expect(checkIn).not.toHaveBeenCalled();
});

it('does not call count check-in service for archived habits', async () => {
  const archivedHabit = { ...createHabit('habit-1'), type: 'count', target: 8, unit: '杯', archivedAt: '2026-05-04' };
  const { useHabitWorkspace } = await import('@/composables/useHabitWorkspace');
  const workspace = useHabitWorkspace();

  await workspace.incrementHabit(archivedHabit as any);

  expect(checkInCount).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run test/composables/useHabitWorkspace.test.ts
```

Expected:
- FAIL
- Archived habits still call `checkIn` / `checkInCount`

- [ ] **Step 3: Write minimal implementation**

Add a shared guard inside `useHabitWorkspace`:

```ts
function isHabitArchived(habit: Habit) {
  return Boolean(habit.archivedAt);
}
```

Use it in actions:

```ts
async function checkInHabit(habit: Habit) {
  if (isHabitArchived(habit)) {
    showMessage(t('habit').archivedCannotCheckIn);
    return false;
  }
  // existing behavior
}

async function incrementHabit(habit: Habit) {
  if (isHabitArchived(habit)) {
    showMessage(t('habit').archivedCannotCheckIn);
    return false;
  }
  // existing behavior
}
```

Add i18n keys:

```json
"archived": "已归档",
"archive": "归档",
"unarchive": "取消归档",
"archivedCannotCheckIn": "习惯已归档"
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run test/composables/useHabitWorkspace.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/composables/useHabitWorkspace.ts src/i18n/zh_CN.json src/i18n/en_US.json test/composables/useHabitWorkspace.test.ts
git commit -m "feat(habit): block archived habit check-ins"
```

---

### Task 4: Add Archive/Unarchive Mutation Service

**Files:**
- Modify: `src/services/habitService.ts`
- Test: `test/services/habitService.test.ts`

- [ ] **Step 1: Write the failing service tests**

Add tests like:

```ts
it('archives a habit by appending 📦YYYY-MM-DD to the definition line', async () => {
  vi.mocked(getBlockByID).mockResolvedValue({ markdown: '喝水 🎯2026-04-01 8杯 🔄每天' } as any);

  await archiveHabit(createHabit({ blockId: 'habit-1' }) as any, '2026-05-04');

  expect(updateBlock).toHaveBeenCalledWith('habit-1', '喝水 🎯2026-04-01 8杯 🔄每天 📦2026-05-04');
});

it('unarchives a habit by removing the 📦YYYY-MM-DD marker only', async () => {
  vi.mocked(getBlockByID).mockResolvedValue({ markdown: '喝水 🎯2026-04-01 8杯 🔄每天 📦2026-05-04' } as any);

  await unarchiveHabit(createHabit({ blockId: 'habit-1', archivedAt: '2026-05-04' }) as any);

  expect(updateBlock).toHaveBeenCalledWith('habit-1', '喝水 🎯2026-04-01 8杯 🔄每天');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run test/services/habitService.test.ts
```

Expected:
- FAIL
- `archiveHabit` / `unarchiveHabit` do not exist yet

- [ ] **Step 3: Write minimal implementation**

In `src/services/habitService.ts`, add:

```ts
export async function archiveHabit(habit: Habit, archiveDate: string): Promise<boolean> {
  const block = await getBlockByID(habit.blockId);
  const markdown = block?.markdown?.trim();
  if (!markdown || habit.archivedAt) return false;

  const next = `${markdown} 📦${archiveDate}`;
  await updateBlock(habit.blockId, next);
  return true;
}

export async function unarchiveHabit(habit: Habit): Promise<boolean> {
  const block = await getBlockByID(habit.blockId);
  const markdown = block?.markdown;
  if (!markdown || !habit.archivedAt) return false;

  const next = markdown.replace(/\s*📦\d{4}-\d{2}-\d{2}(?=\s|$)/, '').trim();
  await updateBlock(habit.blockId, next);
  return true;
}
```

Reuse the repo’s existing block read/write helpers from `src/api.ts` / `src/utils/fileUtils.ts` according to current service conventions.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run test/services/habitService.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/habitService.ts test/services/habitService.test.ts
git commit -m "feat(habit): add archive mutation service"
```

---

### Task 5: Surface Archive Actions In Desktop Habit Detail

**Files:**
- Modify: `src/components/habit/HabitWorkspaceDetailPane.vue`
- Modify: `src/tabs/DesktopHabitDock.vue`
- Test: `test/tabs/DesktopHabitDock.test.ts`

- [ ] **Step 1: Write the failing desktop tests**

Add tests that assert:

```ts
it('renders an archive action for active habits in detail mode', async () => {
  // enter detail
  expect(mounted.container.querySelector('[data-testid="habit-detail-archive"]')).not.toBeNull();
});

it('renders an unarchive action for archived habits in detail mode', async () => {
  mounted.projectStore.projects[0].habits = [createHabit({ archivedAt: '2026-05-04' })];
  // select archived habit directly
  expect(mounted.container.querySelector('[data-testid="habit-detail-unarchive"]')).not.toBeNull();
});
```

Also assert archived detail disables today actions, for example by stubbing `HabitCountInput` or checking a disabled prop/test id path exposed by the pane.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run test/tabs/DesktopHabitDock.test.ts
```

Expected:
- FAIL
- No archive/unarchive action exists in detail

- [ ] **Step 3: Write minimal implementation**

In `HabitWorkspaceDetailPane.vue`, add props and emits:

```ts
const props = defineProps<{
  selectedHabit: Habit;
  // ...
  isArchived?: boolean;
}>();

const emit = defineEmits<{
  'archive': [];
  'unarchive': [];
  'open-doc': [];
}>();
```

Render mutually exclusive actions:

```vue
<button
  v-if="!selectedHabit.archivedAt"
  data-testid="habit-detail-archive"
  @click="emit('archive')"
>
  {{ t('habit').archive }}
</button>
<button
  v-else
  data-testid="habit-detail-unarchive"
  @click="emit('unarchive')"
>
  {{ t('habit').unarchive }}
</button>
```

And gate the detail input surfaces:

```vue
<div v-if="selectedHabit.archivedAt" class="habit-detail__archived-tip" data-testid="habit-detail-archived-tip">
  {{ t('habit').archived }}
</div>
```

Pass handlers from `DesktopHabitDock.vue` using new composable actions from Task 6.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run test/tabs/DesktopHabitDock.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/habit/HabitWorkspaceDetailPane.vue src/tabs/DesktopHabitDock.vue test/tabs/DesktopHabitDock.test.ts
git commit -m "feat(habit): add desktop archive actions"
```

---

### Task 6: Wire Archive/Unarchive Through `useHabitWorkspace`

**Files:**
- Modify: `src/composables/useHabitWorkspace.ts`
- Test: `test/composables/useHabitWorkspace.test.ts`

- [ ] **Step 1: Write the failing composable action tests**

Add tests such as:

```ts
it('archives the selected habit through the habit service', async () => {
  archiveHabit.mockResolvedValue(true);
  const workspace = useHabitWorkspace();
  workspace.selectHabit(habit);

  await workspace.archiveSelectedHabit();

  expect(archiveHabit).toHaveBeenCalledWith(expect.objectContaining({ blockId: habit.blockId }), expect.any(String));
});

it('unarchives the selected habit through the habit service', async () => {
  unarchiveHabit.mockResolvedValue(true);
  const workspace = useHabitWorkspace();
  workspace.selectHabit({ ...habit, archivedAt: '2026-05-04' } as any);

  await workspace.unarchiveSelectedHabit();

  expect(unarchiveHabit).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run test/composables/useHabitWorkspace.test.ts
```

Expected:
- FAIL
- New composable actions do not exist yet

- [ ] **Step 3: Write minimal implementation**

Add actions like:

```ts
async function archiveSelectedHabit() {
  if (!selectedHabit.value || selectedHabit.value.archivedAt) return false;
  return archiveHabit(selectedHabit.value, dayjs().format('YYYY-MM-DD'));
}

async function unarchiveSelectedHabit() {
  if (!selectedHabit.value || !selectedHabit.value.archivedAt) return false;
  return unarchiveHabit(selectedHabit.value);
}
```

Return them from the composable and let document refresh update store state naturally rather than manually mutating the cached habit.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run test/composables/useHabitWorkspace.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/composables/useHabitWorkspace.ts test/composables/useHabitWorkspace.test.ts
git commit -m "feat(habit): wire archive actions through workspace"
```

---

### Task 7: Add Mobile Detail Archive Actions

**Files:**
- Modify: `src/mobile/components/habit/MobileHabitDetailSheet.vue`
- Modify: `src/mobile/panels/MobileHabitPanel.vue`
- Test: `test/mobile/MobileHabitDetailSheet.test.ts`

- [ ] **Step 1: Write the failing mobile tests**

Add assertions that the sheet:

```ts
it('shows archive action for active habits', async () => {
  expect(screen.getByTestId('mobile-habit-archive')).not.toBeNull();
});

it('shows unarchive action for archived habits', async () => {
  // mount with archivedAt
  expect(screen.getByTestId('mobile-habit-unarchive')).not.toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run test/mobile/MobileHabitDetailSheet.test.ts
```

Expected:
- FAIL

- [ ] **Step 3: Write minimal implementation**

In the mobile detail header/actions area, mirror desktop semantics:

```vue
<button
  v-if="!habit.archivedAt"
  data-testid="mobile-habit-archive"
  @click="emit('archive')"
>
  {{ t('habit').archive }}
</button>
<button
  v-else
  data-testid="mobile-habit-unarchive"
  @click="emit('unarchive')"
>
  {{ t('habit').unarchive }}
</button>
```

Pass these handlers from `MobileHabitPanel.vue` using the composable actions created in Task 6.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run test/mobile/MobileHabitDetailSheet.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/mobile/components/habit/MobileHabitDetailSheet.vue src/mobile/panels/MobileHabitPanel.vue test/mobile/MobileHabitDetailSheet.test.ts
git commit -m "feat(habit): add mobile archive actions"
```

---

### Task 8: Stop Archived Habits From Producing Reminders

**Files:**
- Modify: `src/services/habitReminder.ts`
- Test: `test/services/habitReminder.test.ts`

- [ ] **Step 1: Write the failing reminder test**

Add:

```ts
it('does not create reminder entries for archived habits', () => {
  const entries = getHabitReminderEntries([
    {
      ...createHabit(),
      archivedAt: '2026-05-04',
      reminder: { time: '09:00' },
    } as any,
  ], '2026-05-04');

  expect(entries).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run test/services/habitReminder.test.ts
```

Expected:
- FAIL

- [ ] **Step 3: Write minimal implementation**

In `getHabitReminderEntries()` and any lower-level reminder eligibility function, short-circuit:

```ts
if (habit.archivedAt) {
  return false;
}
```

or:

```ts
if (habit.archivedAt) continue;
```

depending on the function layer.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run test/services/habitReminder.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/habitReminder.ts test/services/habitReminder.test.ts
git commit -m "feat(habit): skip reminders for archived habits"
```

---

### Task 9: Make `/dk` Respect Archived Habits

**Files:**
- Modify: `src/utils/slashCommands.ts`
- Test: `test/utils/slashCommands.habit.test.ts`

- [ ] **Step 1: Write the failing slash-command test**

Add:

```ts
it('/dk on an archived habit definition line should stop with archived message', async () => {
  const handler = getActionHandler('checkIn', { openHabitDock: vi.fn() } as any, ['/dk']);
  mockProjectStore.habits = [{
    ...createHabit(),
    archivedAt: '2026-05-04',
  }] as any;

  await handler?.({
    nodeElement: createHabitDefinitionNode('喝水 🎯2026-04-01 8杯 🔄每天 📦2026-05-04'),
  } as any);

  expect(checkIn).not.toHaveBeenCalled();
  expect(showMessage).toHaveBeenCalledWith('习惯已归档');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run test/utils/slashCommands.habit.test.ts
```

Expected:
- FAIL

- [ ] **Step 3: Write minimal implementation**

In the habit branch of `/dk`, after locating the store habit:

```ts
if (habit.archivedAt) {
  showMessage(t('habit').archivedCannotCheckIn);
  return;
}
```

Apply the same guard before both binary and count paths.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run test/utils/slashCommands.habit.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/slashCommands.ts test/utils/slashCommands.habit.test.ts
git commit -m "feat(habit): block slash check-in for archived habits"
```

---

### Task 10: Final Focused Regression

**Files:**
- Test: `test/parser/habitParser.test.ts`
- Test: `test/composables/useHabitWorkspace.test.ts`
- Test: `test/services/habitService.test.ts`
- Test: `test/services/habitReminder.test.ts`
- Test: `test/utils/slashCommands.habit.test.ts`
- Test: `test/tabs/DesktopHabitDock.test.ts`
- Test: `test/mobile/MobileHabitDetailSheet.test.ts`

- [ ] **Step 1: Run the focused archive regression suite**

Run:

```bash
npx vitest run test/parser/habitParser.test.ts test/composables/useHabitWorkspace.test.ts test/services/habitService.test.ts test/services/habitReminder.test.ts test/utils/slashCommands.habit.test.ts test/tabs/DesktopHabitDock.test.ts test/mobile/MobileHabitDetailSheet.test.ts
```

Expected:
- PASS
- No archive-related failures

- [ ] **Step 2: Run one broader habit UI sanity suite**

Run:

```bash
npx vitest run test/components/habit/HabitListItem.test.ts test/components/habit/HabitRecordLog.test.ts test/mobile/MobileHabitPanel.test.ts
```

Expected:
- PASS
- No regression in list/detail/log rendering

- [ ] **Step 3: Commit final verification checkpoint**

```bash
git add -A
git commit -m "test(habit): verify archive workflow"
```

---

## Self-Review

- **Spec coverage:** Covered Markdown persistence, active list hiding, reminder skip, check-in blocking, detail archive actions, `/dk` archived guard, and separate `archivedAt` semantics without replacing `isEnded`.
- **Placeholder scan:** No `TODO`, `TBD`, “similar to above”, or unspecified “handle edge cases” placeholders remain.
- **Type consistency:** Uses one persisted field name throughout: `archivedAt`. Active gating consistently refers to `Boolean(habit.archivedAt)` rather than introducing a second stored `isArchived` field.
