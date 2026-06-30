# createHabit 斜杠命令修复实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复 `/createHabit` 斜杠命令的两个问题：斜杠文本未被正确清除（`void` → `await`）和空块场景应更新当前块而非新增块。

**架构：** 在 `slashCommands.ts` 的 `createHabit` case 中，将回调改为 async 函数以支持 `await` 清除斜杠命令，并引入 `shouldUpdateCurrentBlock` 语义化变量控制更新/插入分支。

**技术栈：** TypeScript、现有 `writeBlock` / `insertBlockAfter` / `removeSlashCommandViaWriter` 工具函数

---

## 文件结构

- **修改**：`src/utils/slashCommands.ts:880-910`（`createHabit` case）
- **无需新增文件**

---

### 任务 1：修复 createHabit 斜杠命令

**文件：**
- 修改：`src/utils/slashCommands.ts:880-910`

- [ ] **步骤 1：修改 createHabit case**

将 `createHabit` case 从同步回调改为 async 回调，使用 `await` 清除斜杠命令，并引入 `shouldUpdateCurrentBlock` 变量：

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

变更点：
1. 第 881 行：`return (protyle, nodeElement) => {` → `return async (protyle, nodeElement) => {`
2. 第 889 行：`void removeSlashCommandViaWriter(...)` → `await removeSlashCommandViaWriter(...)`
3. 第 905 行后新增：`const shouldUpdateCurrentBlock = Boolean(parsedHabit || !text);`
4. 第 906 行：`parsedHabit` → `shouldUpdateCurrentBlock`

- [ ] **步骤 2：运行 lint 验证**

运行：`npm run lint`
预期：无新增错误

- [ ] **步骤 3：运行类型检查**

运行：`npx tsc --noEmit`（如果项目支持）
预期：无类型错误。确认 async 返回与 `(protyle: any, nodeElement: HTMLElement) => void` 类型兼容（`checkIn` case 已有先例，第 911 行）

- [ ] **步骤 4：Commit**

```bash
git add src/utils/slashCommands.ts
git commit -m "fix(createHabit): await 清除斜杠命令，空块场景更新当前块"
```
