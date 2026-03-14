# 番茄钟专注完成弹框自动保存计划

## 问题描述

当番茄钟专注完成后，会弹出"专注完成"对话框让用户填写说明并保存。但问题是：如果用户不是点击"保存"按钮，而是通过其他方式关闭弹框（如点击遮罩层、按 ESC 键、点击 X 按钮），专注记录没有被保存下来。

## 问题分析

1. **数据流分析**：
   - 专注完成后，`pomodoroStore.completePomodoro()` 将记录保存到 `pending-pomodoro-completion.json`
   - 然后触发 `POMODORO_PENDING_COMPLETION` 事件显示弹框
   - 用户点击"保存"后，`savePomodoroRecordFromPending()` 将记录写入思源块/属性，并删除 `pending-pomodoro-completion.json`

2. **问题点**：
   - 如果用户不点击保存直接关闭弹框，`pending-pomodoro-completion.json` 中的记录不会被处理
   - 下次打开插件时，虽然有 `loadPendingCompletion` 函数可以读取待完成记录，但没有自动触发保存逻辑

3. **弹框关闭方式**：
   - 点击遮罩层关闭
   - 按 ESC 键关闭
   - 点击右上角 X 按钮关闭
   - 这些都会触发 Dialog 的 `destroyCallback`

## 解决方案

### 方案：在弹框关闭时自动保存记录

修改 `PomodoroCompleteDialog.vue`，在组件卸载时检查是否已保存，如果未保存则自动保存记录。

**具体修改**：

1. **在 `PomodoroCompleteDialog.vue` 中添加 `onBeforeUnmount` 钩子**：
   - 检查 `saved` 状态，如果为 `false`（用户未点击保存）
   - 自动调用 `savePomodoroRecordFromPending` 保存记录（不填说明）

2. **修改 `showPomodoroCompleteDialog` 函数**（`dialog.ts`）：
   - 在 `destroyCallback` 中确保组件有机会执行保存逻辑

3. **修改 `PomodoroDock.vue` 中的弹框关闭逻辑**：
   - 在 `destroyCallback` 中检查是否需要自动保存

## 实现步骤

### 步骤 1：修改 PomodoroCompleteDialog.vue

添加 `onBeforeUnmount` 钩子，在组件卸载时自动保存未保存的记录：

```typescript
import { ref, onBeforeUnmount } from 'vue';

// ... 现有代码 ...

onBeforeUnmount(async () => {
  // 如果用户未点击保存按钮，自动保存记录（不填说明）
  if (!saved.value && props.pending) {
    await pomodoroStore.savePomodoroRecordFromPending(
      plugin,
      props.pending,
      '' // 空说明
    );
  }
});
```

### 步骤 2：验证 pomodoroStore.savePomodoroRecordFromPending 的健壮性

确保该函数在组件卸载时也能正常工作（不依赖已卸载的组件状态）。

### 步骤 3：测试各种关闭场景

- 点击遮罩层关闭
- 按 ESC 键关闭
- 点击 X 按钮关闭
- 点击保存按钮关闭（正常流程）

## 预期结果

- 用户点击"保存"按钮：正常保存，显示休息选项
- 用户通过其他方式关闭弹框：自动保存专注记录（不填说明），不显示休息选项
- 专注记录始终能被保存，不会丢失

## 文件变更

1. `src/components/pomodoro/PomodoroCompleteDialog.vue` - 添加自动保存逻辑
