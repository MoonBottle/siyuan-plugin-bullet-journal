# 斜杠命令弹框前删除 slash 文本

## 问题

当前部分弹框类斜杠命令（`/fq` 优先级、`/yxj` 提醒、`/jt` 重复、`/gz` 专注计划、`/rq` 日期选择）在弹出对话框时，slash 命令文本仍然残留在编辑器中。用户看到弹框的同时，编辑器里还留着 `/fq` 之类的文本，体验割裂。

## 当前 slash 清理时机分类

| 命令 | 清理时机 | 模式 |
|------|---------|------|
| `/jt` 今日 | 随 patch 一起提交 | 直接执行 |
| `/mr` 明日 | 随 patch 一起提交 | 直接执行 |
| `/rq` 日期选择 | 弹框确认后随 patch 一起提交 | ❌ 弹框期间 slash 残留 |
| `/wc` 完成 | 随 patch 一起提交 | 直接执行 |
| `/fq` 放弃 | 随 patch 一起提交 | 直接执行 |
| `/calendar` 等 | 弹框前先删 | ✅ |
| `/gantt` | 弹框前先删 | ✅ |
| `/focus` 专注 | 弹框前先删 | ✅ |
| `/todo` | 弹框前先删 | ✅ |
| `/setProjectDir` | 弹框前先删 | ✅ |
| `/markAsTask` | 随 patch 一起提交 | 直接执行 |
| `/viewDetail` | 弹框前先删 | ✅ |
| `/setFocusPlan` 专注计划 | 弹框确认后随 leadingPatches 提交 | ❌ 弹框期间 slash 残留 |
| `/setReminder` 提醒 | 弹框确认后随 leadingPatches 提交 | ❌ 弹框期间 slash 残留 |
| `/setRecurring` 重复 | 弹框确认后随 leadingPatches 提交 | ❌ 弹框期间 slash 残留 |
| `/setPriority` 优先级 | 弹框确认后随 patch 一起提交 | ❌ 弹框期间 slash 残留 |
| `/createSkill` | 弹框前先删 | ✅ |
| `/createHabit` | 弹框前先删 | ✅ |
| `/checkIn` | 弹框前先删 | ✅ |

**需要修复的 5 个命令：** `/rq`、`/setPriority`、`/setReminder`、`/setRecurring`、`/setFocusPlan`

## 设计决策

### 核心冲突

`leadingPatches` 机制的设计初衷是让 slash 清理和业务 patch 在同一次 `writeBlock` 调用中合并提交（单次 transaction），保证原子性。

如果弹框前先删 slash：
- ✅ 用户体验好：弹框弹出时编辑器已干净
- ⚠️ 用户取消弹框时，slash 已被删除，无法恢复原文本

### 方案选择

**方案 A：弹框前先删 slash，取消时不恢复**

- 弹框弹出前立即执行 `removeSlashCommand`
- 用户取消弹框时，slash 已删除，不恢复
- 理由：slash 本身是临时输入，删除后不影响用户内容

**方案 B：弹框前先删 slash，取消时恢复**

- 弹框弹出前立即执行 `removeSlashCommand`
- 用户取消弹框时，通过 undo 恢复（SiYuan 原生支持 Ctrl+Z）
- 理由：用户有后悔药

**方案 C（推荐）：弹框前先删 slash，确认时不再重复删**

- 弹框弹出前立即执行 `removeSlashCommand`
- 弹框确认回调中，不再包含 `removeSlashCommand` patch（因为已经删了）
- 取消时不恢复（slash 是临时输入）
- 与 `calendar`、`focus`、`viewDetail` 等已有命令的模式完全一致

选择方案 C，理由：
1. 与已有命令（calendar、focus、viewDetail 等）的模式一致
2. 代码更简单：不需要 `leadingPatches` 机制
3. 用户体验一致：所有弹框类命令行为统一

## 实施步骤

### 步骤 1：修改 `setPriorityForBlock`

**当前行为：** 弹框确认回调中 `writeBlock(writeContext, [removeSlashCommand, setPriority])`
**改为：** 弹框前先 `removeSlashCommandViaWriter`，确认回调中 `writeBlock({ blockId }, { type: 'setPriority', priority })`

文件：`src/utils/slashCommands.ts` 的 `setPriorityForBlock` 函数（行 1641-1687）

### 步骤 2：修改 `setReminderForBlock`

**当前行为：** 弹框通过 `leadingPatches` 传递 `removeSlashCommand`
**改为：** 弹框前先 `removeSlashCommandViaWriter`，弹框 options 不再传 `leadingPatches`

文件：`src/utils/slashCommands.ts` 的 `setReminderForBlock` 函数（行 1437-1468）

### 步骤 3：修改 `setRecurringForBlock`

**当前行为：** 弹框通过 `leadingPatches` 传递 `removeSlashCommand`
**改为：** 弹框前先 `removeSlashCommandViaWriter`，弹框 options 不再传 `leadingPatches`

文件：`src/utils/slashCommands.ts` 的 `setRecurringForBlock` 函数（行 1506-1538）

### 步骤 4：修改 `setFocusPlanForBlock`

**当前行为：** 弹框通过 `leadingPatches` 传递 `removeSlashCommand`
**改为：** 弹框前先 `removeSlashCommandViaWriter`，弹框 options 不再传 `leadingPatches`

文件：`src/utils/slashCommands.ts` 的 `setFocusPlanForBlock` 函数（行 1470-1501）

### 步骤 5：修改 `markAsDateItem`

**当前行为：** 弹框确认回调中 `writeDatePatchForSlashCommand`（内含 `removeSlashCommand`）
**改为：** 弹框前先 `removeSlashCommandViaWriter`，确认回调中只执行 `writeBlock({ blockId }, { type: 'addDate', ... })`

文件：`src/utils/slashCommands.ts` 的 `markAsDateItem` 函数（行 1220-1260）

### 步骤 6：清理 `leadingPatches` 机制

5 个命令全部改完后，`leadingPatches` 不再有调用者。检查是否可以移除：

- `ItemSettingWriteOptions.leadingPatches` 字段
- `buildWritePayload` 中的 `leadingPatches` 合并逻辑

文件：`src/utils/itemSettingUtils.ts`

### 步骤 7：运行测试确认无回归

```bash
npx vitest run
npm run lint
```

## 注意事项

1. **`writeContext` 在弹框前使用后失效**：`removeSlashCommandViaWriter` 会消费 `writeContext` 中的 `slashRange`/`slashStartOffset`/`slashEndOffset`，弹框确认回调中不能再使用同一个 `writeContext`，应改用 `{ blockId }` 简单上下文
2. **`getValidatedItemFromNode` 中已有 slash 清理**：当 item 无效时，该函数内部已调用 `removeSlashCommandViaWriter`，不需要重复清理
3. **`captureDeferredSlashWriteContext` 必须在弹框前调用**：因为弹框弹出后 DOM 焦点转移，`getActiveSlashRange()` 可能返回 null
