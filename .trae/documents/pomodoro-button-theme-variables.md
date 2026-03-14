# Pomodoro 按钮思源主题变量优化计划

## 问题分析

从用户提供的截图可以看出，在深色主题下，选中状态的按钮（黄色/亮色背景）上的文字看不清。

查看思源官方主题文件 `docs/API/theme.css`，发现以下关键变量：

```css
/* 主色 */
--b3-theme-primary: #3575f0;
--b3-theme-secondary: #ff9200;  /* 橙色，适合暂停按钮 */
--b3-theme-error: #d23f31;
--b3-theme-success: #65b84d;

/* 文字颜色 */
--b3-theme-on-primary: #fff;
--b3-theme-on-secondary: #fff;
--b3-theme-on-error: #fff;
--b3-theme-on-background: #222;
--b3-theme-on-surface: #5f6368;
```

**注意**：官方主题中没有定义 `--b3-theme-on-success` 和 `--b3-theme-warning`、`--b3-theme-on-warning` 变量。

## 问题定位

从截图看，深色主题下：
1. 按钮背景变成了亮色（黄色/白色）
2. 但文字颜色可能也是亮色，导致对比度不足

这说明在深色主题中，`--b3-theme-primary` 可能变成了亮色，但 `--b3-theme-on-primary` 没有相应调整为深色。

## 需要修改的内容

### 1. 暂停按钮 - 使用 secondary 色
**文件**: `src/components/pomodoro/PomodoroActiveTimer.vue`
**位置**: 第 608-615 行

当前代码:
```css
.pause-btn {
  background: #f5a623;
  color: #fff;

  &:hover {
    background: #e09400;
  }
}
```

修改为使用官方定义的 secondary 色:
```css
.pause-btn {
  background: var(--b3-theme-secondary);
  color: var(--b3-theme-on-secondary);

  &:hover {
    opacity: 0.9;
  }
}
```

### 2. 恢复按钮 - 修复 on-success 变量
**文件**: `src/components/pomodoro/PomodoroActiveTimer.vue`
**位置**: 第 617-624 行

当前代码:
```css
.resume-btn {
  background: var(--b3-theme-success);
  color: var(--b3-theme-on-success, #fff);
  ...
}
```

由于官方主题没有 `--b3-theme-on-success`，应该使用 `--b3-theme-on-primary` 或固定白色:
```css
.resume-btn {
  background: var(--b3-theme-success);
  color: #fff;

  &:hover {
    opacity: 0.9;
  }
}
```

### 3. 计时模式按钮 - 确保文字颜色正确
**文件**: `src/components/pomodoro/PomodoroTimerDialog.vue`
**位置**: 第 396-400 行

当前代码:
```css
&.active {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  border-color: var(--b3-theme-primary);
}
```

这个看起来是正确的，但如果在某些主题下有问题，可以考虑添加 fallback:
```css
&.active {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary, #fff);
  border-color: var(--b3-theme-primary);
}
```

### 4. 时长选择按钮
**文件**: `src/components/pomodoro/PomodoroTimerDialog.vue`
**位置**: 第 428-432 行

同上，添加 fallback:
```css
&.active {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary, #fff);
  border-color: var(--b3-theme-primary);
}
```

### 5. 开始专注按钮
**文件**: `src/components/pomodoro/PomodoroTimerDialog.vue`
**位置**: 第 495-514 行

添加 fallback:
```css
.start-btn {
  ...
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary, #fff);
  ...
}
```

### 6. 结束专注按钮
**文件**: `src/components/pomodoro/PomodoroActiveTimer.vue`
**位置**: 第 626-633 行

添加 fallback:
```css
.end-btn {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary, #fff);
  ...
}
```

## 思源主题变量使用建议

根据官方 theme.css，推荐使用的变量：

| 用途 | 背景色 | 文字色 |
|------|--------|--------|
| 主要操作按钮 | `--b3-theme-primary` | `--b3-theme-on-primary` |
| 暂停/警告按钮 | `--b3-theme-secondary` | `--b3-theme-on-secondary` |
| 成功/恢复按钮 | `--b3-theme-success` | `#fff` (固定白色) |
| 错误/取消按钮 | `--b3-theme-error` | `--b3-theme-on-error` |

**注意**：`--b3-theme-warning`、`--b3-theme-on-warning`、`--b3-theme-on-success`、`--b3-theme-info`、`--b3-theme-on-info` 在官方主题中未定义，应避免使用。

## 实施步骤

1. 修改 `PomodoroActiveTimer.vue`:
   - 暂停按钮使用 `--b3-theme-secondary` 和 `--b3-theme-on-secondary`
   - 恢复按钮使用固定白色 `#fff` 替代 `--b3-theme-on-success`
   - 结束按钮添加 fallback `#fff`

2. 修改 `PomodoroTimerDialog.vue`:
   - 所有使用 `--b3-theme-on-primary` 的地方添加 fallback `#fff`
