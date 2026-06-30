# createHabit 斜杠命令修复：await 清除 + 空块更新当前块

## 背景

`/createHabit` 斜杠命令存在两个问题：

1. **斜杠命令文本未被正确清除**：使用 `void`（fire-and-forget）调用 `removeSlashCommandViaWriter`，在弹框打开前移除操作可能尚未完成，导致斜杠文本残留在块中。
2. **空块场景行为不一致**：当用户在一个空块上输入 `/createHabit` 时，当前逻辑会使用 `insertBlockAfter` 新增一个块，而不是在当前空块上直接创建习惯定义。

## 修复方案

### 修复 1：await 斜杠清除

将 `createHabit` case 的回调改为 `async`，使用 `await` 确保斜杠命令从 DOM 中完全移除后再打开弹框。这与 `markAsDateItem`（`date` 命令）、`setReminderForBlock` 等其他弹框命令的模式一致。

```diff
-    void removeSlashCommandViaWriter(protyle, nodeElement, { blockId });
+    await removeSlashCommandViaWriter(protyle, nodeElement, { blockId });
```

回调签名从同步改为 async：

```diff
-    return (protyle, nodeElement) => {
+    return async (protyle, nodeElement) => {
```

### 修复 2：空块更新当前块

在弹框回调中，引入语义化变量 `shouldUpdateCurrentBlock`，当块无实质内容（`!text`，移除斜杠后为空）或当前块已是习惯定义（`parsedHabit` 存在）时，使用 `writeBlock` 更新当前块而非 `insertBlockAfter` 新增块。

```typescript
const shouldUpdateCurrentBlock = Boolean(parsedHabit || !text);
```

## 变更后的完整代码

```typescript
case 'createHabit':
  return async (protyle, nodeElement) => {
    const blockText = nodeElement?.textContent || '';
    const text = processLineText(blockText, filter).trim();
    const blockId = nodeElement?.getAttribute?.('data-node-id') || '';
    const parsedHabit = parseHabitLine(text);
    const matchedRecord = findHabitAndRecordByRecordBlockId(blockId);
    const parsedRecord = parseHabitRecordLine(text, blockId);

    await removeSlashCommandViaWriter(protyle, nodeElement, { blockId });

    if (matchedRecord || parsedRecord) {
      showMessage(t('slash').checkIn || '打卡', 2000, 'info');
      return;
    }

    const shouldUpdateCurrentBlock = Boolean(parsedHabit || !text);

    showHabitCreateDialog((markdown) => {
      if (!blockId) {
        return;
      }

      const nextHabit = parseHabitLine(markdown);
      if (!nextHabit) {
        return;
      }

      void (shouldUpdateCurrentBlock
        ? writeBlock({ blockId, nodeElement, protyle }, { type: 'setHabitDefinition', habit: nextHabit })
        : insertBlockAfter(blockId, { type: 'setHabitDefinition', habit: nextHabit }));
    }, parsedHabit || undefined);
  };
```

## 行为变更

| 场景 | 修复前 | 修复后 |
|------|--------|--------|
| 空块 + `/createHabit` | 斜杠可能残留 + 新增块 | 斜杠清除 + 更新当前块 |
| 有内容块 + `/createHabit` | 斜杠可能残留 + 新增块 | 斜杠清除 + 新增块 |
| 已有习惯定义 + `/createHabit` | 斜杠可能残留 + 更新当前块 | 斜杠清除 + 更新当前块 |
| 打卡记录 + `/createHabit` | 显示"打卡"提示 | 不变 |

## 影响范围

- **修改文件**：`src/utils/slashCommands.ts`（`createHabit` case，约 30 行）
- **无新增依赖**：仅修改现有逻辑
- **无接口变更**：不涉及公共 API 或类型定义

## 设计决策

1. **选择 `await` 而非 `void`**：参照代码库中所有打开弹框的 slash 命令（`setReminder`、`setPriority`、`date` 等）的一致模式。
2. **空块判断使用 `!text`**：`text` 是 `processLineText(blockText, filter).trim()` 的结果，已移除斜杠命令文本。空块的 `text` 为空字符串，`!text` 为 `true`。
3. **`shouldUpdateCurrentBlock` 在回调外计算**：通过闭包传递给回调，逻辑清晰，与 `parsedHabit` 的判断位置一致。
