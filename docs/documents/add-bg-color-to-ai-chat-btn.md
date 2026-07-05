# 给 AiChatView 新建会话按钮增加背景色

## Summary

为 `AiChatView.vue` 中第 16-22 行的"新建会话"按钮（`ai-chat-view__sidebar-header-btn`）添加默认背景色，使其在未 hover 状态下也有视觉辨识度。

## Current State Analysis

当前 `&__sidebar-header-btn` 样式（第 217-237 行）：
- 无默认 `background` 属性，按钮在未 hover 时完全透明
- hover 状态使用 `var(--b3-theme-hover)`
- 项目中类似图标按钮（如 `SyButton.vue` 的 `sy-icon-btn`）hover 时使用 `var(--b3-theme-surface)` 作为背景

## Proposed Changes

**文件：** `src/components/workbench/view/AiChatView.vue`

在 `&__sidebar-header-btn` 样式块中添加默认背景色：

```scss
&__sidebar-header-btn {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-surface-lighter);  // 新增：默认背景色
  transition: background-color 0.15s;

  &:hover {
    background: var(--b3-theme-hover);  // 保持不变
  }
  // ... 其余不变
}
```

选择 `var(--b3-theme-surface-lighter)` 的理由：
- 与同文件中 sidebar 的 `border: 1px solid var(--b3-theme-surface-lighter)` 风格一致
- 比纯透明更有辨识度，但不会过于突兀
- hover 时过渡到 `var(--b3-theme-hover)` 仍有交互反馈

## Verification

1. `npm run lint` 通过
2. `npm run typecheck` 通过
3. `npm run test` 通过
