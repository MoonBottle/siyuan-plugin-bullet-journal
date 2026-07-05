# 修复 recurringService.ts 中的 Unicode 正则 ESLint 错误

## 问题分析

日志中报告了 4 个 ESLint 错误，全部集中在 `src/services/recurringService.ts` 的第 28-29 行：

| 行 | 错误 | 原因 |
|----|------|------|
| 28:27 | `regexp/no-misleading-unicode-character` | `📅` (U+1F4C5) 是补充平面字符，在字符类 `[@📅]` 中被拆为代理对 |
| 28:27 | `no-misleading-character-class` | 同上，代理对在字符类中被错误拆分 |
| 29:28 | `regexp/no-misleading-unicode-character` | `✔️` 是 `✔`(U+2714) + `️`(U+FE0F 变体选择符)，组合字符在字符类中被拆分 |
| 29:28 | `no-misleading-character-class` | 同上，组合字符在字符类中语义不正确 |

### 根因

1. **第 28 行** `DATE_MARKER_RE`：字符类 `[@📅]` 中 `📅` 是补充平面字符（U+1F4C5 > U+FFFF），没有 `u` 标志时被解释为两个独立的代理项码元，导致字符类实际匹配 `@`、高代理 `\uD83D`、低代理 `\uDCC5` 中的任意一个——这是实际 bug
2. **第 29 行** `STATUS_ICON_RE`：字符类 `[✅❌✔️]` 中 `✔️` 是 `✔` + VS16 的组合字符序列，在字符类中被拆为两个独立码点，语义不精确

## 修复方案

### 修复 1：第 28 行 `DATE_MARKER_RE`

**当前代码：**
```typescript
const DATE_MARKER_RE = /[@📅]\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}:\d{2}(?:~\d{2}:\d{2}:\d{2})?)?/g
```

**修复为：**
```typescript
const DATE_MARKER_RE = /(?:@|📅)\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}:\d{2}(?:~\d{2}:\d{2}:\d{2})?)?/gu
```

理由：
- 将字符类 `[@📅]` 改为交替 `(?:@|📅)`，与代码库中其他同类模式保持一致（见 `lineParser.ts:67`、`datePatchRender.ts:21/27/28`）
- 添加 `u` 标志，确保 `📅` 被正确识别为单个码点
- 这是**实际 bug 修复**，不仅消除 lint 错误，还修正了代理对拆分导致的错误匹配行为

### 修复 2：第 29 行 `STATUS_ICON_RE`

**当前代码：**
```typescript
const STATUS_ICON_RE = /[✅❌✔️]/gu
```

**修复为：**
```typescript
const STATUS_ICON_RE = /[✅❌]/gu
```

理由：
- 根据数据格式文档（`docs/user-guide/data-format.md`），系统的状态标记只有 `✅`（已完成）和 `❌`（已放弃），`✔️` 不是系统支持的状态标记
- 代码库中其他同类正则（`lineParser.ts:70` 的 `STATUS_EMOJI_RE = /[✅❌📅📋]/gu`、`kramdownModifier.ts:36` 的 `STATUS_MARKERS_RE`、`datePatchRender.ts:30` 的 `STATUS_MARKERS_RE`）均不包含 `✔️`
- 直接移除 `✔️`，消除组合字符问题，同时与代码库其他位置保持一致
- 功能影响：`✔️` 本不是系统支持的状态标记，移除后无实际功能损失

## 影响范围

- 仅修改 `src/services/recurringService.ts` 第 28-29 行
- 修复 1 是实际 bug 修复，行为变化：修复前匹配结果可能以孤立低代理开头，修复后正确匹配完整 emoji
- 修复 2 移除非系统标记 `✔️`，与代码库其他同类正则保持一致

## 验证步骤

1. 运行 `npm run lint` 确认 4 个错误全部消除
2. 运行 `npm run test` 确认无回归
