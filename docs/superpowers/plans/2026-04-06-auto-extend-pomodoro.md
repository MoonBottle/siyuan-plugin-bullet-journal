# Auto-Extend Pomodoro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a countdown pomodoro ends and the user doesn't interact with the completion dialog within a configurable time, automatically extend the countdown and continue the same focus session.

**Architecture:** Add auto-extend logic in pomodoroStore. After `completePomodoro()` saves the pending completion and opens the dialog, start a setTimeout. If the timeout fires before user interaction, load the pending data, delete it, create a new active pomodoro with extended target, restart the timer, and emit an event to close the dialog. Dialogs listen for this event and set a `skipAutoSave` flag to prevent `onBeforeUnmount` from auto-saving.

**Tech Stack:** Vue 3 + Pinia + TypeScript + EventBus

---

### Task 1: Add POMODORO_AUTO_EXTENDED event

**Files:**

- Modify: `src/utils/eventBus.ts:74-91`

- [ ] **Step 1: Add new event constant**

Add to the `Events` object in `src/utils/eventBus.ts`, after the `BREAK_ENDED` line:

```ts
  POMODORO_AUTO_EXTENDED: 'pomodoro:auto-extended', // 自动延迟番茄钟，通知弹窗关闭
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/eventBus.ts
git commit -m "feat: add POMODORO_AUTO_EXTENDED event"
```

---

### Task 2: Add settings fields and i18n

**Files:**

- Modify: `src/settings/types.ts:17-25,58-66`
- Modify: `src/i18n/zh_CN.json` (add keys after `minFocusMinutesDesc` line)
- Modify: `src/i18n/en_US.json` (add keys after `minFocusMinutesDesc` line)

- [ ] **Step 1: Add fields to PomodoroSettings interface**

In `src/settings/types.ts`, add these 4 fields to the `PomodoroSettings` interface (after `minFocusMinutes`):

```ts
  autoExtendEnabled?: boolean;        // 是否开启自动延迟，默认 false
  autoExtendWaitSeconds?: number;     // 弹窗等待时间（秒），默认 30
  autoExtendMinutes?: number;         // 每次延长分钟数，默认 5
  autoExtendMaxCount?: number;        // 最大延迟次数，默认 3
```

- [ ] **Step 2: Add defaults**

In `src/settings/types.ts`, add to `defaultPomodoroSettings` (after `minFocusMinutes: 5,`):

```ts
  autoExtendEnabled: false,
  autoExtendWaitSeconds: 30,
  autoExtendMinutes: 5,
  autoExtendMaxCount: 3,
```

- [ ] **Step 3: Add zh_CN i18n keys**

In `src/i18n/zh_CN.json`, add after the `"minFocusMinutesDesc"` line (around line 257):

```json
      "autoExtendEnabled": "自动延迟",
      "autoExtendEnabledDesc": "倒计时结束且未操作弹窗时，自动延长倒计时继续专注",
      "autoExtendWaitSeconds": "等待时间（秒）",
      "autoExtendWaitSecondsDesc": "弹窗弹出后等待多少秒触发自动延迟",
      "autoExtendMinutes": "延长分钟数",
      "autoExtendMinutesDesc": "每次自动延迟增加的倒计时分钟数",
      "autoExtendMaxCount": "最大延迟次数",
      "autoExtendMaxCountDesc": "达到最大次数后弹窗将保持打开",
```

- [ ] **Step 4: Add en_US i18n keys**

In `src/i18n/en_US.json`, add after the `"minFocusMinutesDesc"` line (around line 236):

```json
      "autoExtendEnabled": "Auto Extend",
      "autoExtendEnabledDesc": "Automatically extend countdown when the completion dialog is not handled in time",
      "autoExtendWaitSeconds": "Wait Time (seconds)",
      "autoExtendWaitSecondsDesc": "Seconds to wait before triggering auto-extend",
      "autoExtendMinutes": "Extend Duration (minutes)",
      "autoExtendMinutesDesc": "Minutes to add to the countdown on each auto-extend",
      "autoExtendMaxCount": "Max Extend Count",
      "autoExtendMaxCountDesc": "Dialog stays open after reaching max count",
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Success

- [ ] **Step 6: Commit**

```bash
git add src/settings/types.ts src/i18n/zh_CN.json src/i18n/en_US.json
git commit -m "feat: add auto-extend pomodoro settings and i18n"
```

---

### Task 3: Add settings UI

**Files:**

- Modify: `src/components/settings/PomodoroConfigSection.vue`

- [ ] **Step 1: Add setting items to template**

In `src/components/settings/PomodoroConfigSection.vue`, add after the `minFocusMinutes` SySettingItem block (after the `</SySettingItem>` that contains the minFocusMinutes input, around line 50, before `</SySettingItemList>`):

```html
<SySettingItem
  :label="t('settings').pomodoro.autoExtendEnabled"
  :description="t('settings').pomodoro.autoExtendEnabledDesc"
>
  <SySwitch v-model="pomodoro.autoExtendEnabled" />
</SySettingItem>
<template v-if="pomodoro.autoExtendEnabled">
  <SySettingItem
    :label="t('settings').pomodoro.autoExtendWaitSeconds"
    :description="t('settings').pomodoro.autoExtendWaitSecondsDesc"
  >
    <input
      type="number"
      class="b3-text-field fn__flex-center fn__size200"
      :value="pomodoro.autoExtendWaitSeconds ?? 30"
      @input="pomodoro.autoExtendWaitSeconds = parseInt(($event.target as HTMLInputElement).value)"
      min="10"
      max="300"
    />
  </SySettingItem>
  <SySettingItem
    :label="t('settings').pomodoro.autoExtendMinutes"
    :description="t('settings').pomodoro.autoExtendMinutesDesc"
  >
    <input
      type="number"
      class="b3-text-field fn__flex-center fn__size200"
      :value="pomodoro.autoExtendMinutes ?? 5"
      @input="pomodoro.autoExtendMinutes = parseInt(($event.target as HTMLInputElement).value)"
      min="1"
      max="60"
    />
  </SySettingItem>
  <SySettingItem
    :label="t('settings').pomodoro.autoExtendMaxCount"
    :description="t('settings').pomodoro.autoExtendMaxCountDesc"
  >
    <input
      type="number"
      class="b3-text-field fn__flex-center fn__size200"
      :value="pomodoro.autoExtendMaxCount ?? 3"
      @input="pomodoro.autoExtendMaxCount = parseInt(($event.target as HTMLInputElement).value)"
      min="1"
      max="10"
    />
  </SySettingItem>
</template>

```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Success

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/PomodoroConfigSection.vue
git commit -m "feat: add auto-extend settings UI in PomodoroConfigSection"
```

---

### Task 4: Add auto-extend logic to pomodoroStore

**Files:**

- Modify: `src/stores/pomodoroStore.ts`

This is the core task. Changes to the store:

1. Add `autoExtendCount` and `autoExtendTimeoutId` to state
2. Add `loadPendingCompletion` import
3. Modify `completePomodoro()` to start auto-extend timer
4. Add `autoExtendPomodoro()` action
5. Add `cancelAutoExtend()` action
6. Modify `startPomodoro()` to reset autoExtendCount

- [ ] **Step 1: Add loadPendingCompletion to imports**

In `src/stores/pomodoroStore.ts`, update the import from `@/utils/pomodoroStorage` (line 11-19). Add `loadPendingCompletion`:

```ts
import {
  loadActivePomodoro,
  loadPendingCompletion,
  removeActiveBreak,
  removeActivePomodoro,
  removePendingCompletion,
  saveActiveBreak,
  saveActivePomodoro,
  savePendingCompletion
} from '@/utils/pomodoroStorage'
```

- [ ] **Step 2: Add state fields**

In the `PomodoroState` interface (lines 27-39), add after `isBreakOverlayVisible: boolean;`:

```ts
// 自动延迟状态（不持久化）
autoExtendCount: number
autoExtendTimeoutId: ReturnType<typeof setTimeout> | null
```

In the `state()` return object (lines 42-52), add after `isBreakOverlayVisible: false`:

```ts
    autoExtendCount: 0,
    autoExtendTimeoutId: null,
```

- [ ] **Step 3: Modify startPomodoro to reset autoExtendCount**

In `startPomodoro()` action (around line 83, after `try {`), add as the first line inside the try block:

```ts
// 重置自动延迟计数
this.autoExtendCount = 0
this.cancelAutoExtend()
```

- [ ] **Step 4: Modify completePomodoro to start auto-extend timer**

In `completePomodoro()` action, after `eventBus.emit(Events.POMODORO_PENDING_COMPLETION, pending);` (line 468), add:

```ts
// 启动自动延迟倒计时（如果开启）
this.scheduleAutoExtend(pluginToUse)
```

- [ ] **Step 5: Add scheduleAutoExtend action**

Add this new action after `completePomodoro()`:

```ts
    /**
     * 启动自动延迟倒计时
     */
    scheduleAutoExtend(plugin: any) {
      this.cancelAutoExtend();

      const settings = plugin?.getSettings?.()?.pomodoro ?? defaultPomodoroSettings;
      if (!settings.autoExtendEnabled) return;
      if (this.autoExtendCount >= (settings.autoExtendMaxCount ?? 3)) return;

      const waitSeconds = settings.autoExtendWaitSeconds ?? 30;
      this.autoExtendTimeoutId = setTimeout(() => {
        this.autoExtendTimeoutId = null;
        this.autoExtendPomodoro(plugin);
      }, waitSeconds * 1000);
    },
```

- [ ] **Step 6: Add autoExtendPomodoro action**

Add after `scheduleAutoExtend`:

```ts
    /**
     * 自动延迟番茄钟：从 pending 恢复并延长倒计时
     */
    async autoExtendPomodoro(plugin: any) {
      try {
        const pending = await loadPendingCompletion(plugin);
        if (!pending) {
          console.log('[Pomodoro] 自动延迟：无待完成记录，跳过');
          return;
        }

        // 删除 pending 文件
        await removePendingCompletion(plugin);

        const settings = plugin?.getSettings?.()?.pomodoro ?? defaultPomodoroSettings;
        const extendMinutes = settings.autoExtendMinutes ?? 5;
        const newTargetMinutes = Math.ceil(pending.accumulatedSeconds / 60) + extendMinutes;

        // 基于 pending 数据创建新的 active pomodoro
        const pomodoroData: ActivePomodoroData = {
          blockId: pending.blockId,
          itemId: pending.itemId,
          itemContent: pending.itemContent,
          startTime: pending.startTime,
          targetDurationMinutes: newTargetMinutes,
          accumulatedSeconds: pending.accumulatedSeconds,
          isPaused: false,
          pauseCount: 0,
          totalPausedSeconds: 0,
          projectId: pending.projectId,
          projectName: pending.projectName,
          projectLinks: pending.projectLinks,
          taskId: pending.taskId,
          taskName: pending.taskName,
          taskLevel: pending.taskLevel,
          taskLinks: pending.taskLinks,
          itemStatus: pending.itemStatus,
          itemLinks: pending.itemLinks,
          timerMode: 'countdown'
        };

        const saved = await saveActivePomodoro(plugin, pomodoroData);
        if (!saved) {
          console.error('[Pomodoro] 自动延迟：保存失败');
          return;
        }

        const remainingSeconds = newTargetMinutes * 60 - pending.accumulatedSeconds;
        this.activePomodoro = {
          ...pomodoroData,
          remainingSeconds
        };

        this.startTimer();

        this.autoExtendCount++;

        // 通知弹窗关闭
        eventBus.emit(Events.POMODORO_AUTO_EXTENDED);

        const msg = `🔄 已自动延迟 ${extendMinutes} 分钟（第 ${this.autoExtendCount} 次）`;
        showMessage(msg);
        console.log(`[Pomodoro] 自动延迟：第 ${this.autoExtendCount} 次，延长 ${extendMinutes} 分钟`);
      } catch (error) {
        console.error('[Pomodoro] 自动延迟失败:', error);
      }
    },
```

- [ ] **Step 7: Add cancelAutoExtend action**

Add after `autoExtendPomodoro`:

```ts
    /**
     * 取消自动延迟
     */
    cancelAutoExtend() {
      if (this.autoExtendTimeoutId) {
        clearTimeout(this.autoExtendTimeoutId);
        this.autoExtendTimeoutId = null;
      }
      this.autoExtendCount = 0;
    },
```

- [ ] **Step 8: Cancel auto-extend in savePomodoroRecordFromPending and handleDiscard flows**

In `savePomodoroRecordFromPending()` action, add at the beginning (after the `try {`):

```ts
// 用户确认保存，取消自动延迟
this.cancelAutoExtend()
```

- [ ] **Step 9: Verify build**

Run: `npm run build`
Expected: Success

- [ ] **Step 10: Commit**

```bash
git add src/stores/pomodoroStore.ts
git commit -m "feat: add auto-extend logic to pomodoroStore"
```

---

### Task 5: Update PomodoroCompleteDialog to handle auto-extend

**Files:**

- Modify: `src/components/pomodoro/PomodoroCompleteDialog.vue`

- [ ] **Step 1: Add eventBus import and Events**

Update the imports at the top of the `<script setup>` block. Add after `import { t } from '@/i18n';`:

```ts
import { eventBus, Events } from '@/utils/eventBus'
```

- [ ] **Step 2: Add skipAutoSave ref and event listener**

After `const discarded = ref(false);` (line 161), add:

```ts
const skipAutoSave = ref(false)

// 监听自动延迟事件，关闭弹窗并跳过自动保存
const unsubscribeAutoExtend = eventBus.on(Events.POMODORO_AUTO_EXTENDED, () => {
  skipAutoSave.value = true
  props.closeDialog()
})
```

- [ ] **Step 3: Update onBeforeUnmount to skip auto-save**

Replace the existing `onBeforeUnmount` block (lines 225-239):

```ts
onBeforeUnmount(async () => {
  // 清理自动延迟事件监听
  unsubscribeAutoExtend()

  // 自动延迟关闭时不保存
  if (skipAutoSave.value) {
    return
  }

  // 如果用户选择不记录，则不保存
  if (discarded.value) {
    return
  }
  // 正常情况：未保存且专注时长足够，自动保存
  if (!saved.value && props.pending && !isDurationTooShort.value) {
    await pomodoroStore.savePomodoroRecordFromPending(
      plugin,
      props.pending,
      description.value
    )
  }
  // 如果时长过短且未保存也未丢弃，则不自动保存（让用户决定）
})
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Success

- [ ] **Step 5: Commit**

```bash
git add src/components/pomodoro/PomodoroCompleteDialog.vue
git commit -m "feat: PomodoroCompleteDialog handles auto-extend event"
```

---

### Task 6: Update PomodoroDock to handle auto-extend event

**Files:**

- Modify: `src/tabs/PomodoroDock.vue`

The PomodoroDock's `openCompleteDialog` function creates a SiYuan Dialog. We need to listen for `POMODORO_AUTO_EXTENDED` and destroy it.

- [ ] **Step 1: Find and add event listener**

In `src/tabs/PomodoroDock.vue`, find the `openCompleteDialog` function. After the `setTimeout` block that mounts the Vue app (around line 142, after the `}, 0);`), add:

```ts
// 监听自动延迟事件，关闭完成弹窗
const unsubscribeAutoExtend = eventBus.on(Events.POMODORO_AUTO_EXTENDED, () => {
  closeCompleteDialog()
})

// 将取消订阅存储以便在对话框关闭时清理
const originalDestroyCallback = completeDialog.destroy
// 注意：Dialog 的 destroyCallback 已在上方定义，我们在 closeCompleteDialog 中处理清理
// 由于 closeCompleteDialog 已经会 destroy 对话框，
// 我们需要在 completeDialog 被销毁时取消订阅
const originalCloseCompleteDialog = closeCompleteDialog
// 替换为带清理的版本（直接在下方重新定义不可行，因为 closeCompleteDialog 是 const）
// 改为在 destroyCallback 中处理
```

Wait, this approach is getting complicated because `closeCompleteDialog` is a `const`. Let me rethink.

Actually, the simplest approach: add the event listener INSIDE the `destroyCallback` cleanup. Add a module-level variable to store the unsubscribe function.

Find the variable declarations at the top of the `<script setup>` block (around line 94-95) and add:

```ts
const unsubscribeAutoExtendCompleteDialog: (() => void) | null = null
```

Then in `openCompleteDialog`, after creating the dialog (after `completeDialog = new Dialog({...})`), add:

```ts
// 监听自动延迟事件
unsubscribeAutoExtendCompleteDialog = eventBus.on(Events.POMODORO_AUTO_EXTENDED, () => {
  closeCompleteDialog()
})
```

And in `closeCompleteDialog`, add cleanup at the beginning:

```ts
  const closeCompleteDialog = () => {
    if (unsubscribeAutoExtendCompleteDialog) {
      unsubscribeAutoExtendCompleteDialog();
      unsubscribeAutoExtendCompleteDialog = null;
    }
    if (completeDialog) {
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Success

- [ ] **Step 3: Commit**

```bash
git add src/tabs/PomodoroDock.vue
git commit -m "feat: PomodoroDock closes complete dialog on auto-extend"
```

---

### Task 7: Update dialog.ts showPomodoroCompleteDialog to handle auto-extend

**Files:**

- Modify: `src/utils/dialog.ts:563-599`

- [ ] **Step 1: Add event listener in showPomodoroCompleteDialog**

Find `showPomodoroCompleteDialog` function (around line 563). After the `setTimeout` block that mounts the Vue app (after line 596), add the auto-extend listener:

```ts
// 监听自动延迟事件，关闭弹窗
const unsubscribeAutoExtend = eventBus.on(Events.POMODORO_AUTO_EXTENDED, () => {
  closeDialog()
})

// 覆盖 destroyCallback 以同时清理事件监听
const originalDestroy = dialog.destroy.bind(dialog)
dialog.destroy = () => {
  unsubscribeAutoExtend()
  originalDestroy()
}
```

Make sure `eventBus` and `Events` are imported at the top of the file. Check if they already are:

```ts
import { eventBus, Events } from '@/utils/eventBus'
```

If not present, add this import.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Success

- [ ] **Step 3: Commit**

```bash
git add src/utils/dialog.ts
git commit -m "feat: showPomodoroCompleteDialog closes on auto-extend event"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: Success

- [ ] **Step 2: Run tests**

Run: `npm run test`
Expected: All pass (525+)

- [ ] **Step 3: Run lint on changed files**

Run: `npx eslint src/stores/pomodoroStore.ts src/components/pomodoro/PomodoroCompleteDialog.vue src/utils/eventBus.ts src/settings/types.ts src/components/settings/PomodoroConfigSection.vue`
Expected: No errors (or only pre-existing eslint config issue)

- [ ] **Step 4: Verify all spec requirements are covered**

Check that each spec requirement has a corresponding implementation:

- [x] 4 config fields in PomodoroSettings
- [x] completePomodoro starts auto-extend timer
- [x] autoExtendPomodoro creates new active pomodoro from pending
- [x] cancelAutoExtend clears timeout and resets count
- [x] startPomodoro resets autoExtendCount
- [x] savePomodoroRecordFromPending cancels auto-extend
- [x] POMODORO_AUTO_EXTENDED event
- [x] PomodoroCompleteDialog listens for event, skipAutoSave
- [x] PomodoroDock listens for event, closes dialog
- [x] showPomodoroCompleteDialog listens for event, closes dialog
- [x] Settings UI with conditional display
- [x] i18n keys in zh_CN and en_US
- [x] Plugin restart recovery does NOT trigger auto-extend
