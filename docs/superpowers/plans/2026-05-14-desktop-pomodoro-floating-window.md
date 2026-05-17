# Desktop Pomodoro Floating Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a desktop-only detached pomodoro floating window that stays visible when the main SiYuan window is minimized, while keeping the existing inline floating pomodoro, adding `inline` / `desktop` / `both` display modes, and silently falling back to inline mode when desktop window support is unavailable.

**Architecture:** Keep `src/stores/pomodoroStore.ts` as the single source of truth and continue deriving UI state through `src/utils/floatingPomodoroViewState.ts`. Split floating display into two hosts: the existing inline DOM host and a new detached Electron `BrowserWindow` host in `src/utils/detachedPomodoroWindow.ts`, then let `src/index.ts` select and synchronize one or both hosts based on settings and runtime capability.

**Tech Stack:** TypeScript, Vue 3, Pinia, Vitest, SiYuan plugin runtime, Electron remote-style APIs exposed by the SiYuan desktop host.

---

## File Structure

### Existing files to modify

- `src/settings/types.ts`
  - Add the floating display mode type and default pomodoro setting.
- `src/i18n/zh_CN.json`
  - Add Chinese copy for the new floating display mode setting.
- `src/i18n/en_US.json`
  - Add English copy for the new floating display mode setting.
- `src/components/settings/PomodoroConfigSection.vue`
  - Add the display mode selector for desktop and mobile settings UIs.
- `src/index.ts`
  - Refactor current floating pomodoro orchestration into host selection and multi-host synchronization.
- `test/stores/settingsStore.test.ts`
  - Cover the new setting default and persistence path if this file already owns settings shape coverage.
- `test/utils/floatingPomodoroViewState.test.ts`
  - Confirm current floating pomodoro state mapping still behaves after the host refactor.

### New files to create

- `src/utils/detachedPomodoroWindow.ts`
  - Own detached window capability detection, lifecycle, DOM injection, and command callback wiring.
- `test/utils/detachedPomodoroWindow.test.ts`
  - Cover capability detection, fallback branches, state updates, and action dispatch contracts.

### Existing files to inspect while implementing

- `src/utils/floatingPomodoroDom.ts`
  - Reuse the existing floating pomodoro DOM markup and view application helpers.
- `src/utils/floatingPomodoroViewState.ts`
  - Reuse the existing source-state to view-state mapping.
- `src/settings/index.ts`
  - Confirm default settings export path if `defaultPomodoroSettings` is re-exported here.
- `test/utils/floatingPomodoroDom.test.ts`
  - Keep DOM rendering helpers aligned with detached host usage.

---

### Task 1: Add the floating display mode setting and UI

**Files:**
- Modify: `src/settings/types.ts`
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`
- Modify: `src/components/settings/PomodoroConfigSection.vue`
- Test: `test/stores/settingsStore.test.ts`

- [ ] **Step 1: Write the failing settings test**

Add a test to `test/stores/settingsStore.test.ts` that proves the new mode defaults to `inline` when pomodoro settings are initialized.

```ts
it('defaults pomodoro floating display mode to inline', () => {
  const settings = structuredClone(defaultSettings);
  expect(settings.pomodoro?.floatingDisplayMode).toBe('inline');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx vitest run test/stores/settingsStore.test.ts
```

Expected: FAIL with `expected undefined to be 'inline'` or equivalent missing-property failure.

- [ ] **Step 3: Add the settings type and default**

Update `src/settings/types.ts` to introduce the mode union and default value.

```ts
export type PomodoroFloatingDisplayMode = 'inline' | 'desktop' | 'both';

export interface PomodoroSettings {
  enableStatusBar?: boolean;
  enableStatusBarTimer?: boolean;
  enableFloatingButton?: boolean;
  floatingDisplayMode?: PomodoroFloatingDisplayMode;
  recordMode: 'block' | 'attr';
}

export const defaultPomodoroSettings: PomodoroSettings = {
  enableStatusBar: false,
  enableStatusBarTimer: false,
  enableFloatingButton: true,
  floatingDisplayMode: 'inline',
  recordMode: 'block',
};
```

- [ ] **Step 4: Add i18n copy for the new selector**

Update `src/i18n/zh_CN.json` and `src/i18n/en_US.json` with these keys under `settings.pomodoro`:

```json
{
  "floatingDisplayMode": "悬浮显示方式",
  "floatingDisplayModeDesc": "选择番茄钟悬浮条显示在页内、桌面悬浮窗，或同时显示",
  "floatingDisplayModeInline": "页内悬浮",
  "floatingDisplayModeDesktop": "桌面悬浮窗",
  "floatingDisplayModeBoth": "同时显示"
}
```

```json
{
  "floatingDisplayMode": "Floating display mode",
  "floatingDisplayModeDesc": "Choose whether the pomodoro floating capsule appears inline, in a desktop floating window, or both",
  "floatingDisplayModeInline": "Inline",
  "floatingDisplayModeDesktop": "Desktop floating window",
  "floatingDisplayModeBoth": "Both"
}
```

- [ ] **Step 5: Add the selector to the pomodoro settings UI**

Update `src/components/settings/PomodoroConfigSection.vue` to render a `SySelect` on desktop and a native `<select>` on mobile.

```ts
const floatingDisplayModeOptions = [
  { value: 'inline', label: t('settings').pomodoro.floatingDisplayModeInline },
  { value: 'desktop', label: t('settings').pomodoro.floatingDisplayModeDesktop },
  { value: 'both', label: t('settings').pomodoro.floatingDisplayModeBoth },
];
```

```vue
<SySettingItem
  :label="t('settings').pomodoro.floatingDisplayMode"
  :description="t('settings').pomodoro.floatingDisplayModeDesc"
>
  <SySelect
    :model-value="pomodoro.floatingDisplayMode || 'inline'"
    :options="floatingDisplayModeOptions"
    @update:model-value="emit('update:pomodoro', { ...pomodoro, floatingDisplayMode: $event as 'inline' | 'desktop' | 'both' })"
  />
</SySettingItem>
```

- [ ] **Step 6: Run the focused settings test to verify it passes**

Run:

```bash
npx vitest run test/stores/settingsStore.test.ts
```

Expected: PASS, including the new default-mode assertion.

- [ ] **Step 7: Commit the settings task**

Run:

```bash
git add src/settings/types.ts src/i18n/zh_CN.json src/i18n/en_US.json src/components/settings/PomodoroConfigSection.vue test/stores/settingsStore.test.ts
git commit -m "feat(settings): add pomodoro floating display modes"
```

---

### Task 2: Add the detached window utility with tests first

**Files:**
- Create: `src/utils/detachedPomodoroWindow.ts`
- Test: `test/utils/detachedPomodoroWindow.test.ts`

- [ ] **Step 1: Write the failing detached-window capability tests**

Create `test/utils/detachedPomodoroWindow.test.ts` with coverage for capability detection and lifecycle.

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  createDetachedPomodoroWindowHost,
  detectDetachedPomodoroWindowSupport,
} from '@/utils/detachedPomodoroWindow';

describe('detectDetachedPomodoroWindowSupport', () => {
  it('returns false outside desktop frontend', () => {
    expect(detectDetachedPomodoroWindowSupport({
      frontEnd: 'mobile',
      runtimeRequire: vi.fn(),
    })).toBe(false);
  });

  it('returns true when BrowserWindow is available in desktop frontend', () => {
    const runtimeRequire = vi.fn(() => ({
      BrowserWindow: vi.fn(),
      getCurrentWindow: vi.fn(),
    }));

    expect(detectDetachedPomodoroWindowSupport({
      frontEnd: 'desktop',
      runtimeRequire,
    })).toBe(true);
  });
});

describe('createDetachedPomodoroWindowHost', () => {
  it('falls back to unavailable host when support detection fails', () => {
    const host = createDetachedPomodoroWindowHost({
      frontEnd: 'desktop-window',
      runtimeRequire: undefined,
      createMarkup: () => '<div />',
      applyViewState: vi.fn(),
      onAction: vi.fn(),
    });

    expect(host.isAvailable()).toBe(false);
  });
});
```

- [ ] **Step 2: Run the detached-window test to verify it fails**

Run:

```bash
npx vitest run test/utils/detachedPomodoroWindow.test.ts
```

Expected: FAIL because `@/utils/detachedPomodoroWindow` does not exist yet.

- [ ] **Step 3: Implement the detached window host utility**

Create `src/utils/detachedPomodoroWindow.ts` with a narrow API surface.

```ts
import type { FloatingPomodoroViewState } from '@/utils/floatingPomodoroViewState';

export interface DetachedPomodoroWindowHost {
  isAvailable(): boolean;
  show(state: FloatingPomodoroViewState): void;
  update(state: FloatingPomodoroViewState): void;
  hide(): void;
  destroy(): void;
}

export function detectDetachedPomodoroWindowSupport(input: {
  frontEnd: string | undefined;
  runtimeRequire?: ((id: string) => any) | undefined;
}): boolean {
  if (input.frontEnd !== 'desktop' || !input.runtimeRequire) {
    return false;
  }

  try {
    const remote = input.runtimeRequire('@electron/remote');
    return typeof remote?.BrowserWindow === 'function';
  } catch {
    return false;
  }
}
```

Implement `createDetachedPomodoroWindowHost(...)` so that:

- unsupported environments return a no-op host
- supported environments lazily create one `BrowserWindow`
- the window loads a minimal `data:` HTML document
- `show()` creates the window if needed and syncs the first state
- `update()` syncs state through `webContents.executeJavaScript(...)`
- `hide()` closes the window for focus end
- `destroy()` always tears down listeners and the window instance

- [ ] **Step 4: Add detached-window action wiring in the utility**

Within the same file, expose only three actions from the detached window DOM:

```ts
export type DetachedPomodoroAction = 'pause' | 'resume' | 'complete';
```

When building the HTML shell, register:

```ts
window.__BULLET_JOURNAL_POMODORO_ACTION__ = (action) => {
  // bridged back to host callback
};
```

Then map the floating capsule buttons to:

- focus + paused => `resume`
- focus + running => `pause`
- focus end button => `complete`

- [ ] **Step 5: Expand the detached-window tests to cover update and destroy**

Add test coverage with fake `BrowserWindow` and fake `webContents`.

```ts
it('calls executeJavaScript when updating an existing detached window', () => {
  const executeJavaScript = vi.fn();
  const BrowserWindow = vi.fn(() => ({
    loadURL: vi.fn(),
    showInactive: vi.fn(),
    close: vi.fn(),
    isDestroyed: vi.fn(() => false),
    webContents: { executeJavaScript, on: vi.fn() },
    on: vi.fn(),
    once: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    setVisibleOnAllWorkspaces: vi.fn(),
  }));

  const host = createDetachedPomodoroWindowHost({
    frontEnd: 'desktop',
    runtimeRequire: () => ({ BrowserWindow }),
    createMarkup: () => '<div />',
    applyViewState: vi.fn(),
    onAction: vi.fn(),
  });

  host.show({ phase: 'focus', status: '专注中', title: '事项', primaryText: '25:00', secondaryText: '', progress: 0, pauseResumeLabel: '暂停', endLabel: '结束专注', isPaused: false });
  host.update({ phase: 'focus', status: '专注中', title: '事项', primaryText: '24:59', secondaryText: '', progress: 0.01, pauseResumeLabel: '暂停', endLabel: '结束专注', isPaused: false });

  expect(executeJavaScript).toHaveBeenCalled();
});
```

- [ ] **Step 6: Run the detached-window tests to verify they pass**

Run:

```bash
npx vitest run test/utils/detachedPomodoroWindow.test.ts
```

Expected: PASS for capability detection, no-op fallback, update, and destroy coverage.

- [ ] **Step 7: Commit the detached-window utility task**

Run:

```bash
git add src/utils/detachedPomodoroWindow.ts test/utils/detachedPomodoroWindow.test.ts
git commit -m "feat(pomodoro): add detached floating window host"
```

---

### Task 3: Refactor `src/index.ts` to support inline, desktop, and both hosts

**Files:**
- Modify: `src/index.ts`
- Test: `test/utils/floatingPomodoroViewState.test.ts`

- [ ] **Step 1: Write the failing view-state regression test**

Add or extend `test/utils/floatingPomodoroViewState.test.ts` so the host refactor cannot change source-to-view behavior.

```ts
it('builds focus view state for countdown mode', () => {
  const state = buildFloatingPomodoroViewState({
    phase: 'focus',
    remainingSeconds: 1500,
    accumulatedSeconds: 300,
    isPaused: false,
    itemTitle: '编写实现计划',
    timerMode: 'countdown',
    targetDurationMinutes: 25,
    labels: {
      focusing: '专注中',
      paused: '已暂停',
      breaking: '休息中',
      pause: '暂停',
      resume: '继续',
      endFocus: '结束专注',
      skipBreak: '跳过休息',
      unknownItem: '未关联事项',
    },
  });

  expect(state.title).toBe('编写实现计划');
  expect(state.pauseResumeLabel).toBe('暂停');
  expect(state.endLabel).toBe('结束专注');
});
```

- [ ] **Step 2: Run the regression test to establish a baseline**

Run:

```bash
npx vitest run test/utils/floatingPomodoroViewState.test.ts
```

Expected: PASS before the refactor. This is a guardrail step, not a failing test.

- [ ] **Step 3: Extract host selection helpers in `src/index.ts`**

Refactor the current floating pomodoro code in `src/index.ts` so host selection is explicit.

```ts
private getFloatingDisplayMode(): 'inline' | 'desktop' | 'both' {
  return this.settingUtils.get('pomodoro')?.floatingDisplayMode ?? 'inline';
}

private shouldUseInlineFloating(): boolean {
  const mode = this.getFloatingDisplayMode();
  return mode === 'inline' || mode === 'both' || !this.canUseDetachedFloating();
}

private shouldUseDetachedFloating(): boolean {
  const mode = this.getFloatingDisplayMode();
  return (mode === 'desktop' || mode === 'both') && this.canUseDetachedFloating();
}
```

Keep the existing inline floating DOM methods intact where possible and call them only when `shouldUseInlineFloating()` is true.

- [ ] **Step 4: Add detached host creation and synchronization in `src/index.ts`**

Still in `src/index.ts`, instantiate and use the new detached host.

```ts
private detachedPomodoroWindowHost = createDetachedPomodoroWindowHost({
  frontEnd: window.siyuan?.config?.system?.workspaceDir ? 'desktop' : this.getFrontend(),
  runtimeRequire: (window as typeof window & { require?: (id: string) => any }).require,
  createMarkup: createFloatingPomodoroMarkup,
  applyViewState: applyFloatingPomodoroViewState,
  onAction: (action) => this.handleDetachedPomodoroAction(action),
});
```

When updating floating state:

```ts
const viewState = buildFloatingPomodoroViewState(source);

if (this.shouldUseInlineFloating()) {
  applyFloatingPomodoroViewState(this.floatingTomatoBtn, viewState);
  this.showFloatingTomatoButton();
} else {
  this.hideFloatingTomatoButton();
}

if (this.shouldUseDetachedFloating()) {
  this.detachedPomodoroWindowHost.show(viewState);
} else {
  this.detachedPomodoroWindowHost.hide();
}
```

- [ ] **Step 5: Wire detached-window actions back to existing pomodoro actions**

Add a focused adapter in `src/index.ts`.

```ts
private async handleDetachedPomodoroAction(action: 'pause' | 'resume' | 'complete') {
  const plugin = this;
  const store = this.pomodoroStore;

  if (!store?.activePomodoro) {
    return;
  }

  if (action === 'pause') {
    await store.pausePomodoro(plugin);
    return;
  }

  if (action === 'resume') {
    await store.resumePomodoro(plugin);
    return;
  }

  await store.completePomodoro(plugin);
}
```

Use the existing store methods only. Do not create duplicated timer mutation logic in the plugin class.

- [ ] **Step 6: Ensure cleanup closes the detached host**

Add detached host teardown anywhere the plugin already tears down floating UI:

```ts
this.detachedPomodoroWindowHost.hide();
this.detachedPomodoroWindowHost.destroy();
```

This must run on:

- focus end
- floating hide path
- plugin unload

- [ ] **Step 7: Run targeted tests after the host refactor**

Run:

```bash
npx vitest run test/utils/floatingPomodoroViewState.test.ts test/utils/detachedPomodoroWindow.test.ts test/stores/settingsStore.test.ts
```

Expected: PASS for settings, detached-window, and view-state coverage.

- [ ] **Step 8: Commit the host-refactor task**

Run:

```bash
git add src/index.ts test/utils/floatingPomodoroViewState.test.ts
git commit -m "feat(pomodoro): support inline and detached floating hosts"
```

---

### Task 4: Verify no regression in existing floating pomodoro rendering

**Files:**
- Test: `test/utils/floatingPomodoroDom.test.ts`
- Test: `test/stores/pomodoroStore.test.ts`

- [ ] **Step 1: Add a regression test for focus action visibility**

Extend `test/utils/floatingPomodoroDom.test.ts` to prove focus-mode rendering still exposes pause and complete actions.

```ts
it('shows pause and complete actions in focus mode', () => {
  const host = document.createElement('div');
  host.innerHTML = createFloatingPomodoroMarkup();

  applyFloatingPomodoroViewState(host, {
    phase: 'focus',
    status: '专注中',
    title: '事项',
    primaryText: '25:00',
    secondaryText: '已专注 0 分钟 / 目标 25 分钟',
    progress: 0,
    pauseResumeLabel: '暂停',
    endLabel: '结束专注',
    isPaused: false,
  });

  expect(host.querySelector('.floating-tomato-action--pause')?.hasAttribute('hidden')).toBe(false);
  expect(host.querySelector('.floating-tomato-action--complete')?.hasAttribute('hidden')).toBe(false);
  expect(host.querySelector('.floating-tomato-action--skip')?.hasAttribute('hidden')).toBe(true);
});
```

- [ ] **Step 2: Run the rendering regression test**

Run:

```bash
npx vitest run test/utils/floatingPomodoroDom.test.ts
```

Expected: PASS, proving detached host reuse does not require new DOM behavior.

- [ ] **Step 3: Run a focused pomodoro store regression suite**

Run:

```bash
npx vitest run test/stores/pomodoroStore.test.ts
```

Expected: PASS, proving detached host work did not alter store-side timer behavior.

- [ ] **Step 4: Commit the regression coverage task**

Run:

```bash
git add test/utils/floatingPomodoroDom.test.ts test/stores/pomodoroStore.test.ts
git commit -m "test(pomodoro): cover floating host regressions"
```

---

### Task 5: Final verification and manual desktop validation

**Files:**
- Modify: none
- Test: no new files

- [ ] **Step 1: Run the complete focused automated suite**

Run:

```bash
npx vitest run test/stores/settingsStore.test.ts test/utils/floatingPomodoroViewState.test.ts test/utils/floatingPomodoroDom.test.ts test/utils/detachedPomodoroWindow.test.ts test/stores/pomodoroStore.test.ts
```

Expected: PASS for all targeted floating-window coverage.

- [ ] **Step 2: Build the plugin bundle**

Run:

```bash
npm run build
```

Expected: successful plugin build with no TypeScript or Vite errors.

- [ ] **Step 3: Perform manual desktop verification**

Check these cases in a desktop SiYuan environment:

```text
1. 设置为 inline：只显示页内悬浮
2. 设置为 desktop：显示独立悬浮窗，主窗口最小化后仍存在
3. 设置为 both：页内悬浮和独立悬浮窗同时存在
4. 从独立悬浮窗点击 暂停 / 继续 / 结束专注：Dock 与页内悬浮同步更新
5. 结束专注后：独立悬浮窗关闭
6. 切到不支持 detached window 的环境：desktop/both 自动退回 inline
```

- [ ] **Step 4: Record final status and commit**

Run:

```bash
git status --short
git add src/settings/types.ts src/i18n/zh_CN.json src/i18n/en_US.json src/components/settings/PomodoroConfigSection.vue src/utils/detachedPomodoroWindow.ts src/index.ts test/stores/settingsStore.test.ts test/utils/floatingPomodoroViewState.test.ts test/utils/floatingPomodoroDom.test.ts test/utils/detachedPomodoroWindow.test.ts test/stores/pomodoroStore.test.ts
git commit -m "feat(pomodoro): add desktop floating window mode"
```

Expected: clean working tree after the final feature commit.

---

## Self-Review

### Spec coverage

- Desktop detached window support: Task 2 and Task 3
- `inline` / `desktop` / `both` settings: Task 1 and Task 3
- Silent fallback: Task 2 and Task 3
- Reuse existing floating view state and DOM mapping: Task 2, Task 3, Task 4
- Core detached actions (`pause` / `resume` / `complete`): Task 2 and Task 3
- Cleanup on focus end and unload: Task 3
- Regression verification: Task 4 and Task 5

No spec gaps remain.

### Placeholder scan

- No `TODO`, `TBD`, or deferred placeholders remain.
- Each implementation task names exact files and explicit commands.
- Each code-changing task includes concrete snippets instead of generic instructions.

### Type consistency

- The plan uses `floatingDisplayMode` consistently.
- Detached actions are consistently named `pause`, `resume`, and `complete`.
- The detached host is always treated as a host wrapper, not a second state source.
