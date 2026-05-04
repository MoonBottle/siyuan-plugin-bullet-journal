# Pomodoro Floating Capsule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the desktop pomodoro floating widget from a circular timer button into a two-state capsule that shows task context, mode-aware secondary text, and quick actions without changing core pomodoro timing behavior.

**Architecture:** Keep `TaskAssistantPlugin` as the lifecycle owner for creating, showing, hiding, and dragging the floating element, but move display mapping into a small pure helper and move DOM patching into a focused renderer helper. This keeps `src/index.ts` responsible for orchestration while making the mode-specific text, progress, and action visibility testable in isolation.

**Tech Stack:** TypeScript, Vue/Pinia-adjacent plugin runtime, SCSS, Vitest

---

## File Structure

### Create

- `src/utils/floatingPomodoroViewState.ts`
  - Pure helper that converts current pomodoro/break snapshot data into a renderable floating capsule view state.
- `src/utils/floatingPomodoroDom.ts`
  - DOM renderer helper that patches a floating capsule element from a view state without knowing about SiYuan or Pinia.
- `test/utils/floatingPomodoroViewState.test.ts`
  - Unit tests for time text, secondary text, progress, paused/break labels, and item-title fallback.
- `test/utils/floatingPomodoroDom.test.ts`
  - Unit tests for DOM text/class/button visibility mapping.

### Modify

- `src/index.ts`
  - Replace the circular floating button markup with capsule markup.
  - Use the new helper(s) when rendering focus/break states.
  - Wire action buttons, drag suppression, and dock-click behavior.
- `src/index.scss`
  - Replace the circular floating button styles with compact default capsule and expanded hover state styles.
- `src/i18n/zh_CN.json`
  - Add any missing floating-capsule fallback labels if existing keys are insufficient.
- `src/i18n/en_US.json`
  - Add matching translation keys for the floating capsule labels.

### Test Commands

- `npx vitest run test/utils/floatingPomodoroViewState.test.ts`
- `npx vitest run test/utils/floatingPomodoroDom.test.ts`
- `npx vitest run test/utils/floatingPomodoroViewState.test.ts test/utils/floatingPomodoroDom.test.ts`
- `npm run test`

## Task 1: Add Pure View-State Mapping

**Files:**
- Create: `src/utils/floatingPomodoroViewState.ts`
- Test: `test/utils/floatingPomodoroViewState.test.ts`

- [ ] **Step 1: Write the failing test for countdown, stopwatch, and break mapping**

```ts
import { describe, expect, it } from 'vitest';
import {
  buildFloatingPomodoroViewState,
  type FloatingPomodoroSourceState,
} from '@/utils/floatingPomodoroViewState';

const baseFocus: FloatingPomodoroSourceState = {
  phase: 'focus',
  isPaused: false,
  timerMode: 'countdown',
  remainingSeconds: 18 * 60 + 5,
  accumulatedSeconds: 6 * 60 + 55,
  targetDurationMinutes: 25,
  itemTitle: 'Write capsule spec',
  fallbackTitle: 'Write capsule spec',
  labels: {
    focusing: '专注中',
    paused: '已暂停',
    breakLabel: '休息中',
    unknownItem: '未关联事项',
    focusedMinutes: '已专注 {minutes} 分钟',
    focusedProgress: '已专注 {minutes} 分钟 / 目标 {target} 分钟',
    breakRemaining: '休息剩余 {minutes} 分钟',
  },
};

describe('buildFloatingPomodoroViewState', () => {
  it('maps countdown focus state', () => {
    const state = buildFloatingPomodoroViewState(baseFocus);
    expect(state.primaryText).toBe('18:05');
    expect(state.secondaryText).toBe('已专注 6 分钟 / 目标 25 分钟');
    expect(state.statusLabel).toBe('专注中');
    expect(state.showPauseResume).toBe(true);
    expect(state.showComplete).toBe(true);
    expect(state.showSkipBreak).toBe(false);
    expect(state.progress).toBeCloseTo((6 * 60 + 55) / (25 * 60), 3);
  });

  it('maps stopwatch focus state', () => {
    const state = buildFloatingPomodoroViewState({
      ...baseFocus,
      timerMode: 'stopwatch',
      remainingSeconds: 0,
      accumulatedSeconds: 11 * 60 + 9,
      targetDurationMinutes: 0,
    });
    expect(state.primaryText).toBe('11:09');
    expect(state.secondaryText).toBe('已专注 11 分钟');
    expect(state.showComplete).toBe(true);
  });

  it('maps paused focus state', () => {
    const state = buildFloatingPomodoroViewState({
      ...baseFocus,
      isPaused: true,
    });
    expect(state.statusLabel).toBe('已暂停');
    expect(state.pauseResumeLabel).toBe('继续');
  });

  it('maps break state', () => {
    const state = buildFloatingPomodoroViewState({
      phase: 'break',
      remainingSeconds: 4 * 60 + 12,
      totalSeconds: 5 * 60,
      itemTitle: '',
      fallbackTitle: '',
      labels: baseFocus.labels,
    });
    expect(state.primaryText).toBe('04:12');
    expect(state.secondaryText).toBe('休息剩余 4 分钟');
    expect(state.statusLabel).toBe('休息中');
    expect(state.showPauseResume).toBe(false);
    expect(state.showSkipBreak).toBe(true);
    expect(state.itemTitle).toBe('未关联事项');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx vitest run test/utils/floatingPomodoroViewState.test.ts
```

Expected: FAIL with module not found for `@/utils/floatingPomodoroViewState` or missing export errors.

- [ ] **Step 3: Implement the minimal view-state helper**

```ts
export type FloatingPomodoroLabels = {
  focusing: string
  paused: string
  breakLabel: string
  unknownItem: string
  focusedMinutes: string
  focusedProgress: string
  breakRemaining: string
  pause: string
  resume: string
  complete: string
  skipBreak: string
};

export type FloatingPomodoroSourceState =
  | {
    phase: 'focus'
    timerMode: 'countdown' | 'stopwatch'
    isPaused: boolean
    remainingSeconds: number
    accumulatedSeconds: number
    targetDurationMinutes: number
    itemTitle?: string
    fallbackTitle?: string
    labels: FloatingPomodoroLabels
  }
  | {
    phase: 'break'
    remainingSeconds: number
    totalSeconds: number
    itemTitle?: string
    fallbackTitle?: string
    labels: FloatingPomodoroLabels
  };

export type FloatingPomodoroViewState = {
  phase: 'focus' | 'break'
  primaryText: string
  secondaryText: string
  itemTitle: string
  statusLabel: string
  progress: number
  showPauseResume: boolean
  showComplete: boolean
  showSkipBreak: boolean
  pauseResumeLabel: string
  iconKind: 'focus' | 'break'
  isPaused: boolean
};

function formatClock(totalSeconds: number) {
  const normalized = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(normalized / 60).toString().padStart(2, '0');
  const seconds = (normalized % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function resolveItemTitle(itemTitle: string | undefined, fallbackTitle: string | undefined, unknownItem: string) {
  return itemTitle?.trim() || fallbackTitle?.trim() || unknownItem;
}

export function buildFloatingPomodoroViewState(source: FloatingPomodoroSourceState): FloatingPomodoroViewState {
  if (source.phase === 'break') {
    const remainingMinutes = Math.floor(source.remainingSeconds / 60);
    const elapsed = Math.max(0, source.totalSeconds - source.remainingSeconds);
    return {
      phase: 'break',
      primaryText: formatClock(source.remainingSeconds),
      secondaryText: source.labels.breakRemaining.replace('{minutes}', String(remainingMinutes)),
      itemTitle: resolveItemTitle(source.itemTitle, source.fallbackTitle, source.labels.unknownItem),
      statusLabel: source.labels.breakLabel,
      progress: source.totalSeconds > 0 ? Math.min(1, elapsed / source.totalSeconds) : 0,
      showPauseResume: false,
      showComplete: false,
      showSkipBreak: true,
      pauseResumeLabel: '',
      iconKind: 'break',
      isPaused: false,
    };
  }

  const displaySeconds = source.timerMode === 'stopwatch'
    ? source.accumulatedSeconds
    : source.remainingSeconds;
  const focusedMinutes = Math.floor(source.accumulatedSeconds / 60);
  const secondaryText = source.timerMode === 'stopwatch'
    ? source.labels.focusedMinutes.replace('{minutes}', String(focusedMinutes))
    : source.labels.focusedProgress
        .replace('{minutes}', String(focusedMinutes))
        .replace('{target}', String(source.targetDurationMinutes));
  const referenceSeconds = source.timerMode === 'stopwatch'
    ? Math.max(source.accumulatedSeconds, 25 * 60)
    : source.targetDurationMinutes * 60;

  return {
    phase: 'focus',
    primaryText: formatClock(displaySeconds),
    secondaryText,
    itemTitle: resolveItemTitle(source.itemTitle, source.fallbackTitle, source.labels.unknownItem),
    statusLabel: source.isPaused ? source.labels.paused : source.labels.focusing,
    progress: referenceSeconds > 0 ? Math.min(1, source.accumulatedSeconds / referenceSeconds) : 0,
    showPauseResume: true,
    showComplete: true,
    showSkipBreak: false,
    pauseResumeLabel: source.isPaused ? source.labels.resume : source.labels.pause,
    iconKind: 'focus',
    isPaused: source.isPaused,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npx vitest run test/utils/floatingPomodoroViewState.test.ts
```

Expected: PASS with 4 passing tests in `floatingPomodoroViewState.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/utils/floatingPomodoroViewState.ts test/utils/floatingPomodoroViewState.test.ts
git commit -m "feat(pomodoro): add floating capsule view state helper"
```

## Task 2: Add DOM Renderer for Capsule Content

**Files:**
- Create: `src/utils/floatingPomodoroDom.ts`
- Test: `test/utils/floatingPomodoroDom.test.ts`

- [ ] **Step 1: Write the failing DOM renderer test**

```ts
import { describe, expect, it } from 'vitest';
import { applyFloatingPomodoroViewState, createFloatingPomodoroMarkup } from '@/utils/floatingPomodoroDom';
import type { FloatingPomodoroViewState } from '@/utils/floatingPomodoroViewState';

function makeState(overrides: Partial<FloatingPomodoroViewState> = {}): FloatingPomodoroViewState {
  return {
    phase: 'focus',
    primaryText: '18:05',
    secondaryText: '已专注 6 分钟 / 目标 25 分钟',
    itemTitle: 'Write capsule spec',
    statusLabel: '专注中',
    progress: 0.3,
    showPauseResume: true,
    showComplete: true,
    showSkipBreak: false,
    pauseResumeLabel: '暂停',
    iconKind: 'focus',
    isPaused: false,
    ...overrides,
  };
}

describe('applyFloatingPomodoroViewState', () => {
  it('renders focus content and button visibility', () => {
    const host = document.createElement('div');
    host.innerHTML = createFloatingPomodoroMarkup();
    applyFloatingPomodoroViewState(host, makeState());
    expect(host.querySelector('.floating-tomato-primary')?.textContent).toBe('18:05');
    expect(host.querySelector('.floating-tomato-item')?.textContent).toBe('Write capsule spec');
    expect(host.querySelector('.floating-tomato-status')?.textContent).toBe('专注中');
    expect((host.querySelector('.floating-tomato-progress-fill') as HTMLElement).style.transform).toBe('scaleX(0.3)');
    expect(host.querySelector('.floating-tomato-action--pause')?.hasAttribute('hidden')).toBe(false);
    expect(host.querySelector('.floating-tomato-action--skip')?.hasAttribute('hidden')).toBe(true);
  });

  it('renders break content and hides focus actions', () => {
    const host = document.createElement('div');
    host.innerHTML = createFloatingPomodoroMarkup();
    applyFloatingPomodoroViewState(host, makeState({
      phase: 'break',
      primaryText: '04:12',
      secondaryText: '休息剩余 4 分钟',
      statusLabel: '休息中',
      showPauseResume: false,
      showComplete: false,
      showSkipBreak: true,
      iconKind: 'break',
    }));
    expect(host.querySelector('.floating-tomato-status')?.textContent).toBe('休息中');
    expect(host.querySelector('.floating-tomato-action--pause')?.hasAttribute('hidden')).toBe(true);
    expect(host.querySelector('.floating-tomato-action--skip')?.hasAttribute('hidden')).toBe(false);
    expect(host.querySelector('.floating-tomato-btn')?.classList.contains('is-break')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx vitest run test/utils/floatingPomodoroDom.test.ts
```

Expected: FAIL with missing module/export errors for `@/utils/floatingPomodoroDom`.

- [ ] **Step 3: Implement the markup and DOM patch helper**

```ts
import type { FloatingPomodoroViewState } from '@/utils/floatingPomodoroViewState';

export function createFloatingPomodoroMarkup() {
  return `
    <div class="floating-tomato-shell">
      <div class="floating-tomato-main">
        <div class="floating-tomato-icon" aria-hidden="true"></div>
        <div class="floating-tomato-summary">
          <div class="floating-tomato-topline">
            <span class="floating-tomato-status"></span>
            <span class="floating-tomato-primary"></span>
          </div>
          <div class="floating-tomato-item"></div>
          <div class="floating-tomato-secondary"></div>
        </div>
        <div class="floating-tomato-actions">
          <button type="button" class="floating-tomato-action floating-tomato-action--pause" data-action="pause"></button>
          <button type="button" class="floating-tomato-action floating-tomato-action--complete" data-action="complete"></button>
          <button type="button" class="floating-tomato-action floating-tomato-action--skip" data-action="skip"></button>
        </div>
      </div>
      <div class="floating-tomato-progress">
        <div class="floating-tomato-progress-fill"></div>
      </div>
    </div>
  `;
}

export function applyFloatingPomodoroViewState(host: HTMLElement, state: FloatingPomodoroViewState) {
  host.classList.toggle('is-break', state.phase === 'break');
  host.classList.toggle('is-paused', state.isPaused);
  (host.querySelector('.floating-tomato-status') as HTMLElement).textContent = state.statusLabel;
  (host.querySelector('.floating-tomato-primary') as HTMLElement).textContent = state.primaryText;
  (host.querySelector('.floating-tomato-item') as HTMLElement).textContent = state.itemTitle;
  (host.querySelector('.floating-tomato-secondary') as HTMLElement).textContent = state.secondaryText;

  const pauseBtn = host.querySelector('.floating-tomato-action--pause') as HTMLButtonElement;
  const completeBtn = host.querySelector('.floating-tomato-action--complete') as HTMLButtonElement;
  const skipBtn = host.querySelector('.floating-tomato-action--skip') as HTMLButtonElement;
  pauseBtn.hidden = !state.showPauseResume;
  completeBtn.hidden = !state.showComplete;
  skipBtn.hidden = !state.showSkipBreak;
  pauseBtn.textContent = state.pauseResumeLabel;
  completeBtn.textContent = 'end';
  skipBtn.textContent = 'skip';

  const fill = host.querySelector('.floating-tomato-progress-fill') as HTMLElement;
  fill.style.transform = `scaleX(${Math.max(0, Math.min(1, state.progress))})`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npx vitest run test/utils/floatingPomodoroDom.test.ts
```

Expected: PASS with 2 passing tests in `floatingPomodoroDom.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/utils/floatingPomodoroDom.ts test/utils/floatingPomodoroDom.test.ts
git commit -m "feat(pomodoro): add floating capsule dom renderer"
```

## Task 3: Integrate Capsule Rendering Into `TaskAssistantPlugin`

**Files:**
- Modify: `src/index.ts`
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`

- [ ] **Step 1: Add a focused integration test or snapshot-free behavior test for label wiring if new i18n keys are required**

```ts
import { describe, expect, it } from 'vitest';
import { buildFloatingPomodoroViewState } from '@/utils/floatingPomodoroViewState';

describe('floating pomodoro labels', () => {
  it('uses explicit unknown-item fallback text', () => {
    const state = buildFloatingPomodoroViewState({
      phase: 'break',
      remainingSeconds: 60,
      totalSeconds: 300,
      itemTitle: '',
      fallbackTitle: '',
      labels: {
        focusing: 'Focus',
        paused: 'Paused',
        breakLabel: 'Break',
        unknownItem: 'No linked item',
        focusedMinutes: 'Focused {minutes} min',
        focusedProgress: 'Focused {minutes} min / Target {target} min',
        breakRemaining: '{minutes} min left',
        pause: 'Pause',
        resume: 'Resume',
        complete: 'End',
        skipBreak: 'Skip',
      },
    });
    expect(state.itemTitle).toBe('No linked item');
  });
});
```

- [ ] **Step 2: Run the targeted tests to verify the integration baseline**

Run:

```bash
npx vitest run test/utils/floatingPomodoroViewState.test.ts test/utils/floatingPomodoroDom.test.ts
```

Expected: PASS. This protects the helper seam before editing `src/index.ts`.

- [ ] **Step 3: Refactor `src/index.ts` to use the new helpers and expanded capsule markup**

```ts
import {
  applyFloatingPomodoroViewState,
  createFloatingPomodoroMarkup,
} from '@/utils/floatingPomodoroDom';
import {
  buildFloatingPomodoroViewState,
  type FloatingPomodoroLabels,
} from '@/utils/floatingPomodoroViewState';

private getFloatingPomodoroLabels(): FloatingPomodoroLabels {
  return {
    focusing: t('pomodoroActive').focusing,
    paused: t('pomodoroActive').paused,
    breakLabel: t('settings').pomodoro.breakLabel,
    unknownItem: (t('pomodoro') as any).floatingUnknownItem,
    focusedMinutes: (t('pomodoro') as any).floatingFocusedMinutes,
    focusedProgress: (t('pomodoro') as any).floatingFocusedProgress,
    breakRemaining: (t('pomodoro') as any).floatingBreakRemaining,
    pause: t('pomodoroActive').pause,
    resume: t('pomodoroActive').resume,
    complete: t('pomodoroActive').endFocus,
    skipBreak: t('settings').pomodoro.skipBreak,
  };
}

private createFloatingTomatoButton(): HTMLElement {
  const btn = document.createElement('div');
  btn.className = 'floating-tomato-btn';
  btn.innerHTML = createFloatingPomodoroMarkup();

  btn.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (btn.classList.contains('dragging')) return;
    if (target.closest('[data-action=\"pause\"]')) return void this.togglePomodoroPause();
    if (target.closest('[data-action=\"complete\"]')) return void this.completeFocusFromFloatingButton();
    if (target.closest('[data-action=\"skip\"]')) return void this.skipBreakFromFloatingButton();
    this.togglePomodoroDock();
  });

  this.makeDraggable(btn);
  return btn;
}

private updateTimerDisplaysFromStore(data?: ..., isBreak?: boolean) {
  // derive source snapshot exactly once
  // build helper state
  // apply to floating button host
  const viewState = buildFloatingPomodoroViewState({
    phase: effectiveIsBreak ? 'break' : 'focus',
    ...mappedFields,
    labels: this.getFloatingPomodoroLabels(),
  });
  if (this.floatingTomatoEl) {
    applyFloatingPomodoroViewState(this.floatingTomatoEl, viewState);
  }
}
```

Also add the minimal new translation keys only if existing keys cannot cover the spec:

```json
"pomodoro": {
  "floatingUnknownItem": "未关联事项",
  "floatingFocusedMinutes": "已专注 {minutes} 分钟",
  "floatingFocusedProgress": "已专注 {minutes} 分钟 / 目标 {target} 分钟",
  "floatingBreakRemaining": "休息剩余 {minutes} 分钟"
}
```

- [ ] **Step 4: Run targeted tests again after the integration edit**

Run:

```bash
npx vitest run test/utils/floatingPomodoroViewState.test.ts test/utils/floatingPomodoroDom.test.ts
```

Expected: PASS. No regressions from integrating the helpers into `src/index.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts src/i18n/zh_CN.json src/i18n/en_US.json
git add src/utils/floatingPomodoroViewState.ts src/utils/floatingPomodoroDom.ts
git add test/utils/floatingPomodoroViewState.test.ts test/utils/floatingPomodoroDom.test.ts
git commit -m "feat(pomodoro): integrate floating capsule renderer"
```

## Task 4: Replace Circular Styles With Capsule Styles

**Files:**
- Modify: `src/index.scss`

- [ ] **Step 1: Write a narrow DOM renderer test that asserts state classes stay compatible with the planned SCSS selectors**

```ts
import { describe, expect, it } from 'vitest';
import { applyFloatingPomodoroViewState, createFloatingPomodoroMarkup } from '@/utils/floatingPomodoroDom';
import type { FloatingPomodoroViewState } from '@/utils/floatingPomodoroViewState';

describe('floating capsule state classes', () => {
  it('adds paused class for paused focus state', () => {
    const host = document.createElement('div');
    host.innerHTML = createFloatingPomodoroMarkup();
    applyFloatingPomodoroViewState(host, {
      phase: 'focus',
      primaryText: '18:05',
      secondaryText: '已专注 6 分钟 / 目标 25 分钟',
      itemTitle: 'Write capsule spec',
      statusLabel: '已暂停',
      progress: 0.3,
      showPauseResume: true,
      showComplete: true,
      showSkipBreak: false,
      pauseResumeLabel: '继续',
      iconKind: 'focus',
      isPaused: true,
    } satisfies FloatingPomodoroViewState);
    expect(host.querySelector('.floating-tomato-btn')?.classList.contains('is-paused')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the DOM tests to confirm the selector contract**

Run:

```bash
npx vitest run test/utils/floatingPomodoroDom.test.ts
```

Expected: PASS.

- [ ] **Step 3: Replace the circular SCSS block with capsule styles**

```scss
.floating-tomato-btn {
  position: fixed;
  right: 60px;
  bottom: 60px;
  z-index: 2147483647;
  width: 104px;
  min-height: 42px;
  padding: 0;
  border-radius: 999px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
  overflow: hidden;
  cursor: pointer;
  user-select: none;
  touch-action: none;
  transition: width 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;

  .floating-tomato-shell {
    position: relative;
    min-height: 42px;
  }

  .floating-tomato-main {
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    padding: 8px 10px 10px;
  }

  .floating-tomato-item,
  .floating-tomato-secondary,
  .floating-tomato-actions,
  .floating-tomato-status {
    opacity: 0;
    pointer-events: none;
  }

  &:hover:not(.dragging) {
    width: 256px;

    .floating-tomato-item,
    .floating-tomato-secondary,
    .floating-tomato-actions,
    .floating-tomato-status {
      opacity: 1;
      pointer-events: auto;
    }
  }

  &.is-break .floating-tomato-progress-fill {
    background: var(--b3-card-success-color);
  }

  &.is-paused .floating-tomato-progress-fill {
    background: var(--b3-card-warning-color);
  }

  &.dragging {
    transition: none;
  }
}
```

- [ ] **Step 4: Run the targeted DOM tests after the style refactor**

Run:

```bash
npx vitest run test/utils/floatingPomodoroDom.test.ts
```

Expected: PASS. DOM contract remains unchanged while styles change.

- [ ] **Step 5: Commit**

```bash
git add src/index.scss test/utils/floatingPomodoroDom.test.ts
git commit -m "style(pomodoro): restyle floating timer as capsule"
```

## Task 5: Full Verification and Manual Desktop Checks

**Files:**
- Modify: none expected
- Test: `test/utils/floatingPomodoroViewState.test.ts`
- Test: `test/utils/floatingPomodoroDom.test.ts`

- [ ] **Step 1: Run the focused floating-capsule tests together**

Run:

```bash
npx vitest run test/utils/floatingPomodoroViewState.test.ts test/utils/floatingPomodoroDom.test.ts
```

Expected: PASS with all floating-capsule tests green.

- [ ] **Step 2: Run the broader repository test suite**

Run:

```bash
npm run test
```

Expected: PASS. If unrelated failures already exist, record them explicitly before proceeding.

- [ ] **Step 3: Run a dev build for manual inspection**

Run:

```bash
npm run dev
```

Expected: Vite watch build starts successfully and updates the SiYuan plugin output.

- [ ] **Step 4: Perform manual desktop verification in SiYuan**

Manual checklist:

- Start a countdown pomodoro and verify the default floating capsule shows icon + time only.
- Hover the capsule and verify the expanded state shows task name, status label, secondary text, and action buttons.
- Click `暂停`, then hover again and verify the label changes to `已暂停` and the main action changes to `继续`.
- Start a stopwatch pomodoro and verify the secondary text switches to `已专注 X 分钟`.
- Finish a focus session into break mode and verify the action set changes to only `跳过休息`.
- Drag the capsule and verify it moves without opening the dock or expanding mid-drag.
- Click the main body of the capsule and verify Pomodoro Dock toggles as before.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts src/index.scss src/i18n/zh_CN.json src/i18n/en_US.json
git add src/utils/floatingPomodoroViewState.ts src/utils/floatingPomodoroDom.ts
git add test/utils/floatingPomodoroViewState.test.ts test/utils/floatingPomodoroDom.test.ts
git commit -m "feat(pomodoro): ship floating capsule widget"
```

## Self-Review

### Spec coverage

- 双态胶囊默认态/展开态：Task 3 + Task 4
- 倒计时/正计时/休息态文案映射：Task 1
- 拖拽、按钮点击、Dock 点击边界：Task 3 + Task 5 manual verification
- 视觉胶囊化、状态色、进度线：Task 4
- 移动端保持原路径：Task 3 integration note; no new mobile-specific tasks required

No spec gaps found.

### Placeholder scan

- No `TODO` / `TBD`
- All test commands are explicit
- All file paths are explicit
- Each implementation task includes concrete code or command content

### Type consistency

- `FloatingPomodoroSourceState` feeds `buildFloatingPomodoroViewState`
- `FloatingPomodoroViewState` feeds `applyFloatingPomodoroViewState`
- `src/index.ts` owns labels and runtime data mapping only

The helper names and property names are consistent across tasks.
