# 修复 `src/kernel/utils.ts` ESLint 错误

## 问题分析

`calculateReminderTime` 函数中使用了两次 `var baseTime`，导致以下 7 个 ESLint 错误：

| 行号 | 错误 | 原因 |
|------|------|------|
| 17 | `vars-on-top` / `no-var` | 使用 `var` 声明，应改用 `let`/`const` |
| 26 | `vars-on-top` / `no-var` | 使用 `var` 声明，应改用 `let`/`const` |
| 26 | `ts/no-redeclare` | `baseTime` 在同一函数作用域内重复声明 |
| 28, 32, 36 | `block-scoped-var` | `baseTime` 在 `if` 块外使用，但声明在 `if` 块内 |

## 根本原因

`var` 具有函数作用域提升特性，原代码利用了这一点：在 `if (reminder.type === 'absolute')` 块内声明 `var baseTime`（行17），然后在 `else` 分支再次声明 `var baseTime`（行26），并在函数末尾（行36）使用。由于 `var` 提升，这实际上等价于在函数顶部声明一次，然后两次赋值。但 ESLint 规则禁止这种模式。

## 修复方案

将两处 `var baseTime` 替换为 `let baseTime`，并将声明提升到函数作用域顶部（`if` 语句之前），消除重复声明和作用域问题：

```typescript
export function calculateReminderTime(
  itemDate: string,
  startDateTime: string | undefined,
  endDateTime: string | undefined,
  startTime: string | undefined,
  endTime: string | undefined,
  reminder: ReminderConfig,
): number {
  let baseTime: number                                    // ← 声明提升到顶部
  if (reminder.type === 'absolute') {
    baseTime = new Date(`${itemDate}T${reminder.time || '00:00'}:00`).getTime()  // ← var → 赋值
    if (reminder.alertMode && reminder.alertMode.type === 'before' && reminder.alertMode.minutes) {
      return baseTime - reminder.alertMode.minutes * 60000
    }
    if (reminder.alertMode && reminder.alertMode.type === 'custom' && reminder.alertMode.minutes) {
      return baseTime - reminder.alertMode.minutes * 60000
    }
    return baseTime
  }
  if (reminder.relativeTo === 'end') {                    // ← 删除 var 声明，仅保留赋值
    baseTime = endDateTime
      ? new Date(endDateTime).getTime()
      : new Date(`${itemDate}T${endTime || '23:59'}:00`).getTime()
  } else {
    baseTime = startDateTime
      ? new Date(startDateTime).getTime()
      : new Date(`${itemDate}T${startTime || '00:00'}:00`).getTime()
  }
  return baseTime - (reminder.offsetMinutes || 0) * 60000
}
```

## 修改步骤

1. 在 `if (reminder.type === 'absolute')` 之前添加 `let baseTime: number`
2. 将行 17 的 `var baseTime = ...` 改为 `baseTime = ...`（去掉 `var`，保留赋值）
3. 将行 26 的 `var baseTime: number` 删除，仅保留后续的赋值逻辑

## 验证

修改后运行 `npm run lint` 确认 7 个错误全部消除，无新增错误。
