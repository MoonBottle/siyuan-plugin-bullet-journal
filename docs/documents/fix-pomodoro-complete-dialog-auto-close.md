# 修复"专注完成"弹窗被自动延迟提前关闭

## 问题描述

当开启"自动延迟"功能后，专注结束后弹出"专注完成"弹窗。用户在弹窗中输入框内思考如何撰写"输入事项说明"时，系统的自动延迟倒计时仍在运行。一旦倒计时结束，弹窗被自动关闭并进入专注延长时段，导致用户丢失撰写内容的机会。

## 需求（基于社区讨论共识）

1. "专注完成"弹窗弹出后，自动延迟倒计时**正常运行**（保持功能有效性）
2. 当用户**点击输入框（focus 事件）**进入编辑模式时（代表用户正在考虑撰写），**取消自动延迟倒计时**
3. 在弹窗操作区增加一个**"专注延长"按钮**，用户可手动触发专注延长

## 实现步骤

### Step 1: 修改 `src/stores/pomodoroStore.ts`

在 `autoExtendPomodoro` 方法上方的 `scheduleAutoExtend` 和 `cancelAutoExtend` 之后，新增一个公开方法 `manualExtendPomodoro`，供弹窗组件调用：

```typescript
manualExtendPomodoro(plugin: any) {
  this.cancelAutoExtend();
  this.autoExtendPomodoro(plugin);
}
```

该方法先取消自动延迟定时器（避免重复触发），然后执行与自动延迟相同的延长逻辑。

### Step 2: 修改 `src/components/pomodoro/PomodoroCompleteDialog.vue`

#### 2a. 为 textarea 添加 `@focus` 事件处理

在 `<textarea>` 上添加 `@focus="handleInputFocus"`，当用户点击输入框进入编辑模式时：
- 调用 `pomodoroStore.cancelAutoExtend()` 取消自动延迟倒计时
- 设置一个标志位 `inputFocused` 为 `true`

#### 2b. 添加"专注延长"按钮

在操作区（`dialog-actions`）中，为非 `saved` 且非 `isDurationTooShort` 的状态添加一个"专注延长"按钮：
- 按钮文本使用 i18n key `t('pomodoroComplete').extendFocus`
- 点击后调用 `handleExtend()` 方法
- `handleExtend()` 中调用 `pomodoroStore.manualExtendPomodoro(plugin)`，这会触发 `POMODORO_AUTO_EXTENDED` 事件，弹窗会自动关闭

按钮样式与现有 `save-btn` 风格一致，但使用次要颜色（如 `b3-theme-surface-lighter` 背景）。

#### 2c. 调整操作区布局

当存在"专注延长"按钮时，按钮布局从左到右为：
- `[专注延长]` → `[保存]`（右对齐）

### Step 3: 添加 i18n 翻译键

#### `src/i18n/zh_CN.json` 中 `pomodoroComplete` 对象新增：
```json
"extendFocus": "专注延长"
```

#### `src/i18n/en_US.json` 中 `pomodoroComplete` 对象新增：
```json
"extendFocus": "Extend Focus"
```

## 影响范围

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/stores/pomodoroStore.ts` | 新增方法 | 添加 `manualExtendPomodoro` 公开方法 |
| `src/components/pomodoro/PomodoroCompleteDialog.vue` | 修改 | 添加 focus 事件处理 + 专注延长按钮 |
| `src/i18n/zh_CN.json` | 新增键值 | `pomodoroComplete.extendFocus` |
| `src/i18n/en_US.json` | 新增键值 | `pomodoroComplete.extendFocus` |

## 验证要点

1. 开启"自动延迟"，专注结束后弹窗出现，不操作 → 自动延迟倒计时正常触发，弹窗关闭并延长专注 ✅
2. 弹窗出现后点击输入框（focus）→ 自动延迟倒计时被取消，弹窗保持打开 ✅
3. 弹窗出现后点击"专注延长"按钮 → 立即触发延长，弹窗关闭 ✅
4. 弹窗出现后输入内容再点击"保存" → 正常保存，不受影响 ✅
