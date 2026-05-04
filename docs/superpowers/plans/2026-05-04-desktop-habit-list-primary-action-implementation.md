# Desktop Habit List Primary Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swap the primary and secondary desktop HabitDock list item actions so the card body opens habit detail and the right-side auxiliary icon opens the source document.

**Architecture:** Keep the change localized to the desktop habit list interaction layer. `HabitListItem.vue` owns the local click semantics, `HabitWorkspaceListPane.vue` remains the event router between list items and the dock, and `DesktopHabitDock.vue` keeps the existing document-opening and detail-selection logic while receiving the remapped events.

**Tech Stack:** Vue 3 SFCs, Pinia-backed composables, Vitest with happy-dom, TypeScript.

---

## File Structure

- Modify: `src/components/habit/HabitListItem.vue`
  - Swap desktop `handleMainClick()` from `open-doc` to `open-detail`
  - Replace the desktop calendar button with a document button while keeping mobile hidden behavior unchanged
  - Update test ids / aria labels only where needed to match the new semantic role
- Modify: `src/components/habit/HabitWorkspaceListPane.vue`
  - Keep event wiring minimal, but ensure the remapped list-item events still forward correctly to `select-habit` and `open-doc`
- Modify: `test/components/habit/HabitListItem.test.ts`
  - Update desktop click expectations
  - Add/adjust assertions for the new document-icon action
- Modify: `test/tabs/DesktopHabitDock.test.ts`
  - Update stubbed `HabitListItem` event semantics
  - Verify main click enters detail and right-side action opens the document

---

### Task 1: Swap Desktop HabitListItem Click Semantics

**Files:**
- Modify: `src/components/habit/HabitListItem.vue`
- Test: `test/components/habit/HabitListItem.test.ts`

- [ ] **Step 1: Write the failing test**

Update the existing desktop interaction tests in `test/components/habit/HabitListItem.test.ts` so they describe the new behavior:

```ts
it('clicking main body emits open-detail only on desktop', async () => {
  const emits = {
    openDoc: vi.fn(),
    openDetail: vi.fn(),
    openCalendar: vi.fn(),
    checkIn: vi.fn(),
    increment: vi.fn(),
  };

  const mounted = mountComponent({ habit, dayState, periodState }, emits);
  await nextTick();

  mounted.container.querySelector('[data-testid="habit-list-item-main"]')?.click();

  expect(emits.openDetail).toHaveBeenCalledTimes(1);
  expect(emits.openDetail).toHaveBeenCalledWith(habit);
  expect(emits.openDoc).not.toHaveBeenCalled();
  expect(emits.openCalendar).not.toHaveBeenCalled();
});

it('clicking desktop document action emits open-doc only', async () => {
  const emits = {
    openDoc: vi.fn(),
    openDetail: vi.fn(),
    openCalendar: vi.fn(),
    checkIn: vi.fn(),
    increment: vi.fn(),
  };

  const mounted = mountComponent({ habit, dayState, periodState }, emits);
  await nextTick();

  mounted.container.querySelector('[data-testid="habit-list-item-open-doc"]')?.click();

  expect(emits.openDoc).toHaveBeenCalledTimes(1);
  expect(emits.openDoc).toHaveBeenCalledWith(habit);
  expect(emits.openDetail).not.toHaveBeenCalled();
  expect(emits.openCalendar).not.toHaveBeenCalled();
});
```

Also update the current “calendar action” desktop test to target the new document action test id instead of the old calendar test id.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run test/components/habit/HabitListItem.test.ts
```

Expected:
- FAIL
- The desktop main click test still receives `open-doc`
- The new document-action test fails because the old calendar button/test id still exists

- [ ] **Step 3: Write minimal implementation**

Update `src/components/habit/HabitListItem.vue`:

```ts
function handleMainClick() {
  emit('open-detail', props.habit);
}
```

Replace the desktop auxiliary button:

```vue
<button
  v-if="!isMobile"
  class="habit-calendar-btn"
  data-testid="habit-list-item-open-doc"
  :aria-label="t('todo').openDoc"
  @click.stop="emit('open-doc', habit)"
>
  <svg><use xlink:href="#iconFile"></use></svg>
</button>
```

Keep the existing mobile branch unchanged:
- mobile main click still emits `open-detail`
- mobile still hides the auxiliary desktop-only icon
- check-in / increment buttons remain untouched

Do not rename emitted event names globally; only swap which event is emitted from which desktop click target.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run test/components/habit/HabitListItem.test.ts
```

Expected:
- PASS
- Desktop main click now emits `open-detail`
- Desktop auxiliary action emits `open-doc`
- Mobile tests remain green

- [ ] **Step 5: Commit**

```bash
git add src/components/habit/HabitListItem.vue test/components/habit/HabitListItem.test.ts
git commit -m "refactor(habit): swap desktop list primary action"
```

---

### Task 2: Align DesktopHabitDock Event Flow With New Semantics

**Files:**
- Modify: `test/tabs/DesktopHabitDock.test.ts`
- Modify: `src/components/habit/HabitWorkspaceListPane.vue`
- Modify: `src/tabs/DesktopHabitDock.vue`
- Test: `test/tabs/DesktopHabitDock.test.ts`

- [ ] **Step 1: Write the failing test**

Update the `HabitListItem` stub in `test/tabs/DesktopHabitDock.test.ts` so it matches the new intended contract:

```ts
vi.mock('@/components/habit/HabitListItem.vue', () => ({
  default: defineComponent({
    name: 'HabitListItemStub',
    props: ['habit'],
    emits: ['open-doc', 'open-detail', 'check-in', 'increment'],
    setup(props, { emit }) {
      return () => h('div', { 'data-testid': `habit-list-item-${props.habit.blockId}` }, [
        h('button', {
          'data-testid': 'habit-list-item-main',
          onClick: () => emit('open-detail', props.habit),
        }),
        h('button', {
          'data-testid': 'habit-list-item-open-doc',
          onClick: () => emit('open-doc', props.habit),
        }),
        h('button', {
          'data-testid': 'habit-list-item-check-in',
          onClick: () => emit('check-in', props.habit),
        }),
        h('button', {
          'data-testid': 'habit-list-item-increment',
          onClick: () => emit('increment', props.habit),
        }),
      ]);
    },
  }),
}));
```

Update/add expectations:

```ts
it('opening a list item main action enters detail mode', async () => {
  mounted.container.querySelector('[data-testid="habit-list-item-main"]')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await nextTick();

  expect(mounted.container.querySelector('[data-testid="habit-detail-header"]')?.textContent)
    .toContain('喝水');
});

it('desktop document action opens the habit document', async () => {
  mounted.container.querySelector('[data-testid="habit-list-item-open-doc"]')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await nextTick();

  expect(openDocumentAtLine).toHaveBeenCalledWith('doc-1', undefined, 'habit-1');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run test/tabs/DesktopHabitDock.test.ts
```

Expected:
- FAIL
- The current list-pane routing still maps `open-calendar` to `select-habit`
- The test stub and actual component contract are now out of sync until implementation is updated

- [ ] **Step 3: Write minimal implementation**

Adjust `src/components/habit/HabitWorkspaceListPane.vue` so the list item event mapping reflects the new spec:

```vue
<HabitListItem
  ...
  @open-doc="emit('open-doc', $event)"
  @open-detail="emit('select-habit', $event)"
  @check-in="emit('check-in', $event)"
  @increment="emit('increment', $event)"
/>
```

Remove the now-unused `@open-calendar="emit('select-habit', $event)"` desktop path if it is no longer emitted by `HabitListItem`.

In `src/tabs/DesktopHabitDock.vue`, keep the existing wiring:

```vue
<HabitWorkspaceListPane
  ...
  @open-doc="openHabitDoc"
  @select-habit="selectHabit"
/>
```

No behavior change is required in `DesktopHabitDock.vue` itself beyond accepting the existing `select-habit` / `open-doc` flow, unless the compiler surfaces an obsolete prop or listener path.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run test/tabs/DesktopHabitDock.test.ts
```

Expected:
- PASS
- Main click enters detail mode
- Auxiliary document action opens the document
- Existing refresh / check-in / increment tests remain green

- [ ] **Step 5: Commit**

```bash
git add src/components/habit/HabitWorkspaceListPane.vue src/tabs/DesktopHabitDock.vue test/tabs/DesktopHabitDock.test.ts
git commit -m "feat(habit): remap desktop dock list actions"
```

---

### Task 3: Final Focused Regression

**Files:**
- Test: `test/components/habit/HabitListItem.test.ts`
- Test: `test/tabs/DesktopHabitDock.test.ts`

- [ ] **Step 1: Run the focused combined regression**

Run:

```bash
npx vitest run test/components/habit/HabitListItem.test.ts test/tabs/DesktopHabitDock.test.ts
```

Expected:
- PASS
- No failures
- Desktop interaction semantics match the approved spec

- [ ] **Step 2: Sanity-check no mobile regression leaked in**

Run:

```bash
npx vitest run test/mobile/MobileHabitPanel.test.ts test/mobile/MobileHabitDetailSheet.test.ts
```

Expected:
- PASS
- No mobile interaction regression

- [ ] **Step 3: Commit final verification checkpoint**

```bash
git add -A
git commit -m "test(habit): verify desktop primary action swap"
```

---

## Self-Review

- **Spec coverage:** Covered all five acceptance points from `2026-05-04-desktop-habit-list-primary-action-design.md`:
  - desktop main click enters detail: Task 1 + Task 2
  - auxiliary icon becomes document opener: Task 1 + Task 2
  - document opens corresponding habit block: Task 2
  - check-in button unchanged: Task 1 + Task 2 regression assertions
  - detail back behavior unchanged: existing `DesktopHabitDock.test.ts` retained in Task 2
- **Placeholder scan:** No `TODO` / `TBD` / “similar to” placeholders remain.
- **Type consistency:** The plan keeps the public event names `open-doc`, `open-detail`, `select-habit`, `check-in`, `increment` consistent across files.

