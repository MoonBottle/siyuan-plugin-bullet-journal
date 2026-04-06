# Progress Bar Direction Auto-Adapt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically determine progress bar direction based on timer type (stopwatch=extend, countdown/break=shrink) and remove the manual `statusBarDirection` setting.

**Architecture:** Add a utility function `getProgressDirection(timerMode)` that returns `'extend'` or `'shrink'`. All progress bar rendering code (circular rings, linear timeline bar, bottom status bar) calls this function instead of reading a setting. Remove the `statusBarDirection` setting from types, defaults, settings UI, and i18n files.

**Tech Stack:** Vue 3 + TypeScript + Pinia + SVG

---

### Task 1: Add utility function and unit test

**Files:**
- Create: `src/utils/progressDirection.ts`
- Create: `test/utils/progressDirection.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { getProgressDirection } from '@/utils/progressDirection'

describe('getProgressDirection', () => {
  it('returns extend for stopwatch mode', () => {
    expect(getProgressDirection('stopwatch')).toBe('extend')
  })

  it('returns shrink for countdown mode', () => {
    expect(getProgressDirection('countdown')).toBe('shrink')
  })

  it('returns shrink when timerMode is undefined (break)', () => {
    expect(getProgressDirection(undefined)).toBe('shrink')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/utils/progressDirection.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```ts
export type ProgressBarDirection = 'extend' | 'shrink'

/**
 * 根据计时模式自动确定进度条方向：
 * - 正计时 (stopwatch) → extend（从空到满）
 * - 倒计时 (countdown) / 休息 (undefined) → shrink（从满到空）
 */
export function getProgressDirection(timerMode?: 'countdown' | 'stopwatch'): ProgressBarDirection {
  return timerMode === 'stopwatch' ? 'extend' : 'shrink'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/utils/progressDirection.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/progressDirection.ts test/utils/progressDirection.test.ts
git commit -m "feat: add getProgressDirection utility function with tests"
```

---

### Task 2: Update PomodoroActiveTimer (circular ring + timeline bar)

**Files:**
- Modify: `src/components/pomodoro/PomodoroActiveTimer.vue:209-322`

This component has two progress indicators that need direction logic:
1. **Circular ring** (`strokeDashoffset` computed at lines 312-322)
2. **Linear timeline bar** (`timelineProgress` computed at lines 302-309, used in template at lines 50-51)

- [ ] **Step 1: Add import for the utility function**

In `<script setup>`, add after the existing imports (after line 222):

```ts
import { getProgressDirection } from '@/utils/progressDirection';
```

- [ ] **Step 2: Add a direction computed property**

Add after `isStopwatch` computed (after line 254):

```ts
// 进度条方向：正计时延长，倒计时缩短
const progressDirection = computed(() => getProgressDirection(pomodoroStore.activePomodoro?.timerMode));
```

- [ ] **Step 3: Update `strokeDashoffset` computed**

Replace the existing `strokeDashoffset` computed (lines 312-322):

```ts
// 进度环偏移量：根据方向决定填充效果
const strokeDashoffset = computed(() => {
  if (!pomodoroStore.activePomodoro) {
    return progressDirection.value === 'shrink' ? 0 : circumference;
  }

  const elapsedSeconds = pomodoroStore.activePomodoro.accumulatedSeconds;
  const totalSeconds = isStopwatch.value
    ? stopwatchReferenceSeconds
    : pomodoroStore.activePomodoro.targetDurationMinutes * 60;
  const progress = Math.min(1, elapsedSeconds / totalSeconds);

  return progressDirection.value === 'shrink'
    ? circumference * progress
    : circumference * (1 - progress);
});
```

- [ ] **Step 4: Update timeline progress to support direction**

Replace the existing `timelineProgress` computed (lines 302-309):

```ts
// 时间线进度（0-100）：根据方向决定显示效果
const timelineProgress = computed(() => {
  if (!pomodoroStore.activePomodoro) return 0;
  const elapsedSeconds = pomodoroStore.activePomodoro.accumulatedSeconds;
  const totalSeconds = isStopwatch.value
    ? stopwatchReferenceSeconds
    : pomodoroStore.activePomodoro.targetDurationMinutes * 60;
  const progress = Math.min(100, Math.max(0, (elapsedSeconds / totalSeconds) * 100));
  return progressDirection.value === 'shrink' ? 100 - progress : progress;
});
```

- [ ] **Step 5: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/components/pomodoro/PomodoroActiveTimer.vue
git commit -m "feat: PomodoroActiveTimer progress direction adapts to timer mode"
```

---

### Task 3: Update PomodoroBreakTimer (circular ring)

**Files:**
- Modify: `src/components/pomodoro/PomodoroBreakTimer.vue:52-96`

Break timer ring should always shrink (breaks are countdown).

- [ ] **Step 1: Update `strokeDashoffset` computed to use shrink direction**

Replace the existing `strokeDashoffset` computed (lines 71-77):

```ts
// 进度环：休息倒计时，从满到空（shrink）
const strokeDashoffset = computed(() => {
  const remaining = pomodoroStore.breakRemainingSeconds;
  const total = totalBreakSeconds.value;
  const elapsed = Math.max(0, total - remaining);
  const progress = total > 0 ? elapsed / total : 0;
  return circumference * progress;
});
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/pomodoro/PomodoroBreakTimer.vue
git commit -m "feat: PomodoroBreakTimer ring shrinks from full to empty"
```

---

### Task 4: Update PomodoroBreakOverlay (circular ring)

**Files:**
- Modify: `src/components/pomodoro/PomodoroBreakOverlay.vue:70-128`

Overlay break ring should also always shrink.

- [ ] **Step 1: Update `strokeDashoffset` computed to use shrink direction**

Replace the existing `strokeDashoffset` computed (lines 97-103):

```ts
// 进度环：休息倒计时，从满到空（shrink）
const strokeDashoffset = computed(() => {
  const remaining = pomodoroStore.breakRemainingSeconds;
  const total = totalBreakSeconds.value;
  const elapsed = Math.max(0, total - remaining);
  const progress = total > 0 ? elapsed / total : 0;
  return circumference * progress;
});
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/pomodoro/PomodoroBreakOverlay.vue
git commit -m "feat: PomodoroBreakOverlay ring shrinks from full to empty"
```

---

### Task 5: Update bottom status bar progress bar in src/index.ts

**Files:**
- Modify: `src/index.ts:1641-1656` (showStatusBar method)
- Modify: `src/index.ts:1906-1916` (break progress update)
- Modify: `src/index.ts:1946-1956` (focus progress update)

This file uses DOM manipulation (not Vue), so we import the utility function and use it directly.

- [ ] **Step 1: Add import at the top of the file**

Find the existing imports block near the top of `src/index.ts` and add:

```ts
import { getProgressDirection } from '@/utils/progressDirection';
```

- [ ] **Step 2: Update `showStatusBar` — remove setting-based direction**

Replace lines 1652-1654 in `showStatusBar()`:

```ts
    const initialWidth = '0%';
```

(Remove the `direction` and `initialWidth` condition — default to 0%. The first tick will set the correct direction.)

- [ ] **Step 3: Update break progress — replace setting with dynamic direction**

Replace lines 1911-1915 (inside the break progress block):

```ts
            const elapsed = Math.max(0, totalSeconds - d.remainingSeconds);
            const progress = totalSeconds > 0 ? Math.min(1, elapsed / totalSeconds) : 0;
            // 休息固定为 shrink 方向
            const displayProgress = 1 - progress;
            fill.style.width = `${displayProgress * 100}%`;
```

(Remove the `direction` variable read from settings, hard-code shrink for break.)

- [ ] **Step 4: Update focus progress — replace setting with dynamic direction**

Replace lines 1951-1955 (inside the focus progress block):

```ts
          const refSeconds = isStopwatch ? 25 * 60 : targetSeconds;
          const progress = Math.min(1, accumulatedSeconds / refSeconds);
          const direction = getProgressDirection(d.timerMode);
          const displayProgress = direction === 'shrink' ? (1 - progress) : progress;
          fill.style.width = `${displayProgress * 100}%`;
```

(Replace `pomodoro.statusBarDirection` with `getProgressDirection(d.timerMode)`.)

- [ ] **Step 5: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/index.ts
git commit -m "feat: bottom status bar progress direction adapts to timer mode"
```

---

### Task 6: Remove statusBarDirection setting

**Files:**
- Modify: `src/settings/types.ts:23,65`
- Modify: `src/components/settings/PomodoroConfigSection.vue:22-31,83-86`
- Modify: `src/i18n/zh_CN.json:254-257`
- Modify: `src/i18n/en_US.json:233-236`

- [ ] **Step 1: Remove from PomodoroSettings type and defaults**

In `src/settings/types.ts`:
- Remove line 23: `statusBarDirection?: 'extend' | 'shrink';`
- Remove line 65: `statusBarDirection: 'extend',` from `defaultPomodoroSettings`

- [ ] **Step 2: Remove setting UI from PomodoroConfigSection.vue**

In `src/components/settings/PomodoroConfigSection.vue`:
- Remove lines 22-31 (the `<SySettingItem>` block for `statusBarDirection`)
- Remove lines 83-86 (the `statusBarDirectionOptions` const)

- [ ] **Step 3: Remove i18n keys from zh_CN.json**

In `src/i18n/zh_CN.json`, remove these 4 lines:
```json
      "statusBarDirection": "底栏进度条方向",
      "statusBarDirectionDesc": "进度条的显示方式",
      "statusBarDirectionExtend": "逐渐延长",
      "statusBarDirectionShrink": "逐渐缩短",
```

- [ ] **Step 4: Remove i18n keys from en_US.json**

In `src/i18n/en_US.json`, remove these 4 lines:
```json
      "statusBarDirection": "Status Bar Direction",
      "statusBarDirectionDesc": "How the progress bar displays",
      "statusBarDirectionExtend": "Extend (fill up)",
      "statusBarDirectionShrink": "Shrink (count down)",
```

- [ ] **Step 5: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 6: Verify tests pass**

Run: `npm run test`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/settings/types.ts src/components/settings/PomodoroConfigSection.vue src/i18n/zh_CN.json src/i18n/en_US.json
git commit -m "refactor: remove statusBarDirection setting, now auto-determined by timer mode"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: Success

- [ ] **Step 2: Run all tests**

Run: `npm run test`
Expected: All pass

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 4: Verify no remaining references to statusBarDirection**

Run: `grep -r "statusBarDirection" src/ --include="*.ts" --include="*.vue" --include="*.json"`
Expected: No matches
