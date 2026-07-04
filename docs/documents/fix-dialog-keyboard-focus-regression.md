# 修复弹框前删除 slash 后键盘导航失效

## 问题

上一次提交 `64e4f18` 将 5 个弹框类斜杠命令改为"弹框前先删 slash"，但引入了焦点竞争问题：`removeSlashCommandViaWriter` 使用 `void` 丢弃 Promise，其异步链中的 `focusByWbr` 会在弹框打开后把焦点抢回编辑器，导致弹框内的键盘事件（上下键选择、回车确认）失效。

## 根因

时序竞争：

```
1. void removeSlashCommandViaWriter(...)   ← 异步开始，不等待
2. showPrioritySettingDialog(...)          ← 同步创建弹框
3. 弹框 requestAnimationFrame → focus()   ← 下一帧聚焦弹框
4. removeSlashCommandViaWriter 异步链完成 → focusByWbr()  ← 抢回编辑器焦点！
```

`focusByWbr` 在 `commitViaProtyle` 中执行，会调用 `window.getSelection().removeAllRanges()` + `addRange()`，直接覆盖弹框的焦点。

## 修复方案

**在弹框命令场景下，await `removeSlashCommandViaWriter` 完成后再打开弹框。**

这样 `focusByWbr` 在弹框打开前执行完毕，弹框的 `requestAnimationFrame` focus 不会被覆盖。

### 具体修改

1. **`setPriorityForBlock`**：`void` → `await`
2. **`setReminderForBlock`**：`void` → `await`
3. **`setRecurringForBlock`**：`void` → `await`
4. **`setFocusPlanForBlock`**：`void` → `await`
5. **`markAsDateItem`**：`void` → `await`

所有 5 个函数已经是 `async`，只需把 `void` 改为 `await`。

### 为什么不选其他方案

- **跳过 focusByWbr（caretPolicy: 'none'）**：需要修改 blockWriter 核心逻辑，侵入性大
- **弹框侧 setTimeout 延迟**：hack 性强，延迟时间不可控
- **await 是最简洁的修复**：确保时序正确，不引入额外复杂度

### 影响范围

- 只影响 5 个弹框命令的 slash 清理时序
- `calendar`/`viewDetail`/`focus` 等不涉及键盘交互的弹框命令保持 `void` 不变（它们的弹框不需要键盘焦点）
- 但为了一致性，也可以统一改为 `await`，不影响功能

## 实施步骤

1. 将 5 个弹框命令中的 `void removeSlashCommandViaWriter(...)` 改为 `await removeSlashCommandViaWriter(...)`
2. 运行测试确认无回归
