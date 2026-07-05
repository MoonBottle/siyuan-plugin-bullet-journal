# 修复：番茄钟弹框未预选事项

## 问题

点击"开始专注"按钮后，桌面端番茄钟弹框（PomodoroTimerDialog）没有预选对应事项。

## 根因

`src/utils/dialog.ts` 第 542-545 行，桌面端 `showPomodoroTimerDialog` 函数在创建 `PomodoroTimerDialog` 组件时，**遗漏了** **`preselectedBlockId`** **prop**：

```ts
// 当前代码（有 bug）
timerDialogApp = createApp(PomodoroTimerDialog, {
  closeDialog,
  initialGroupId,
  // preselectedBlockId 缺失！
})
```

而移动端分支（同文件第 575-582 行）正确传入了 `preselectedBlockId`。

## 修复方案

在 `src/utils/dialog.ts` 第 542-545 行，将 `preselectedBlockId` 传入组件 props：

```ts
timerDialogApp = createApp(PomodoroTimerDialog, {
  closeDialog,
  preselectedBlockId,   // 新增
  initialGroupId,
})
```

## 验证

1. `npm run lint` 通过
2. `npm run typecheck` 通过
3. `npm run test` 通过

