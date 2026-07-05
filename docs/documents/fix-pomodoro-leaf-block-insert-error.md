# 修复番茄专注结束后插入文档内容报错

## 问题摘要

**错误信息：**
```
block [20260605090112-g2hqsou] type "p" is a leaf block and cannot have children;
use previousID to place the block as its sibling instead
```

**触发场景：** 番茄专注倒计时结束后，用户在补填弹窗中确认保存时，向思源文档写入番茄记录失败。

## 根因分析

### 错误抛点

[src/stores/pomodoroStore.ts:727](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/stores/pomodoroStore.ts#L727) 和 [src/stores/pomodoroStore.ts:1032](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/stores/pomodoroStore.ts#L1032) 两处均调用：

```ts
await appendBlock('markdown', blockContent, pending.blockId)
```

### 数据流追踪

1. 用户开始专注 → [startPomodoro](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/stores/pomodoroStore.ts#L203) 接收 `parentBlockId`（事项块 ID），保存到 `pomodoroData.blockId`
2. 倒计时结束 → [completePomodoro](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/stores/pomodoroStore.ts#L570) 把 `ap.blockId` 写入 `pending.blockId`
3. 用户确认保存 → [savePomodoroRecordFromPending](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/stores/pomodoroStore.ts#L664) 在第 727 行调用 `appendBlock(..., pending.blockId)`

### 根因

- `pending.blockId` 是**事项块**（`NodeParagraph`，即 "p" 类型），是**叶子块**，不能有子块
- [appendBlock](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/api.ts#L227) 的语义是"作为父块的最后一个子块追加"，对叶子块无效
- 思源 API 因此返回错误，并提示应该用 `previousID` 把新块作为兄弟节点插入

### 对比证据

项目内其他所有"插入新块"的业务都走 [insertBlockAfter](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/utils/blockWriter/index.ts#L59)（基于 `insertBlock` + `previousID`），番茄钟是唯一例外：

| 调用方 | 用途 | API |
|---|---|---|
| recurringService | 循环任务新事项 | insertBlockAfter |
| aiToolsExecutor | AI 创建事项 | insertBlockAfter |
| quickCreate | 快速创建事项 | insertBlockAfter |
| slashCommands | 斜杠菜单插入 | insertBlockAfter |
| **pomodoroStore** | **番茄记录** | **appendBlock（错误）** |

PRD（[docs/prd/pomodoro.md:120](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/docs/prd/pomodoro.md#L120)）的字段说明"事项块ID（完成时在此块**下**添加番茄钟记录）"，实际语义应为"在事项块**之后**插入番茄记录行"，与错误提示一致。

## 修复方案

把两处 `appendBlock` 改为 `insertBlockAfter`（项目既定封装，使用 `previousID` 把番茄记录作为事项块的**兄弟节点**紧随其后插入）。

### 改动清单

#### 改动 1：[src/stores/pomodoroStore.ts](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/stores/pomodoroStore.ts) — 导入替换

- 移除：`appendBlock`（从 `@/api` 导入列表中删除，第 13 行）
- 新增：在已有的 `writeBlock` 导入行（第 22 行 `from '@/utils/blockWriter'`）中追加 `insertBlockAfter`

```ts
// 改前
import {
  appendBlock,
  getBlockAttrs,
  setBlockAttrs,
} from '@/api'
import { writeBlock } from '@/utils/blockWriter'

// 改后
import {
  getBlockAttrs,
  setBlockAttrs,
} from '@/api'
import {
  insertBlockAfter,
  writeBlock,
} from '@/utils/blockWriter'
```

#### 改动 2：[src/stores/pomodoroStore.ts:727](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/stores/pomodoroStore.ts#L727) — savePomodoroRecordFromPending

```ts
// 改前
} else {
  await appendBlock('markdown', blockContent, pending.blockId)
}

// 改后
} else {
  await insertBlockAfter(pending.blockId, {
    type: 'replaceMarkdown',
    markdown: blockContent,
  })
}
```

#### 改动 3：[src/stores/pomodoroStore.ts:1031-1032](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/stores/pomodoroStore.ts#L1031) — markExpiredPomodoroComplete

```ts
// 改前
const pomodoroContent = `🍅${valueContent}`
await appendBlock('markdown', pomodoroContent, data.blockId)

// 改后
const pomodoroContent = `🍅${valueContent}`
await insertBlockAfter(data.blockId, {
  type: 'replaceMarkdown',
  markdown: pomodoroContent,
})
```

### Patch 类型确认

`replaceMarkdown` 是 [InsertableBlockPatch](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/utils/blockWriter/shared/types.ts) 的合法成员，其他调用方（如 slashCommands.habit.test.ts:330）也是按 `{ type: 'replaceMarkdown', markdown }` 的形状使用，符合现有约定。

## 假设与决策

- **假设 1：** `pending.blockId` / `data.blockId` 在所有触发路径上都是叶子块（事项段落）。证据：startPomodoro 接收的 `parentBlockId` 来自事项块，PRD 第 120 行明确为"事项块ID"。
- **假设 2：** 项目其他位置使用 `insertBlockAfter` 的方式（`previousID`）已被验证可行，可安全套用。证据：5 处业务调用、4 个测试文件均按此封装编写。
- **决策：** 不引入新的"判断块类型"分支逻辑，统一改为兄弟节点插入。理由：错误提示本身就是思源官方推荐方案，且与项目既有约定一致；行为差异（从"子块"变"兄弟块"）对用户无感知，因为 p 块本来就容纳不下子块，原行为从未生效过。

## 不在本次范围

- 不改 `recordMode === 'attr'` 分支（走 setBlockAttrs，不触发该错误）
- 不改 `ChatPanel.vue:577` 与 `quickCreate.ts:229` 的 `appendBlock`（这两处 parentID 是**文档 ID**，文档是容器块，appendBlock 合法）
- 不重构番茄钟存储结构

## 验证步骤

1. **类型检查：**
   ```powershell
   npm run typecheck
   ```
2. **Lint：**
   ```powershell
   npm run lint
   ```
3. **单测：**
   ```powershell
   npm run test
   ```
   重点：`test/stores/pomodoroStore.test.ts` 应继续通过。该测试当前 mock 了 `appendBlock`（第 85 行），但相关用例未对 `appendBlock` 做断言（搜索结果仅在 mock 中出现），因此替换为 `insertBlockAfter` 后需要同步把 mock 改为 `insertBlockAfter`（来自 `@/utils/blockWriter`），否则 store 内部调用会拿到未 mock 的真实实现。具体调整：
   - 第 84-88 行 `vi.mock('@/api', ...)` 中移除 `appendBlock`
   - 新增/修改 `vi.mock('@/utils/blockWriter', ...)`，加入 `insertBlockAfter: vi.fn().mockResolvedValue(true)` 与 `writeBlock: vi.fn().mockResolvedValue(true)`
4. **手动回归（用户验证）：**
   - 启动一个番茄专注 → 等待倒计时结束（或手动结束）→ 在补填弹窗中输入描述 → 确认保存
   - 预期：番茄记录以 `🍅...` 段落形式插入到事项块**正下方**，不再报错
   - 同样验证重启后过期番茄钟自动完成的路径

## 影响文件清单

- `src/stores/pomodoroStore.ts`（导入 + 2 处调用）
- `test/stores/pomodoroStore.test.ts`（mock 调整）
