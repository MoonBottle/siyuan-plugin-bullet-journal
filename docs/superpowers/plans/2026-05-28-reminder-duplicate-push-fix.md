# 修复：文档更新导致提醒重复推送 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 使用 `blockId` 替代 `item.id` 构建 timer ID，修复文档更新后提醒重复推送的 bug。

**架构：** 在 `KernelDataItem` 中增加 `blockId` 字段，写入端映射时传入 `blockId`，kernel 端 `rebuildReminderSchedule()` 中 timer ID 和 metadata.blockId 改用 `blockId`（降级到 `item.id`）。Habit 提醒已使用 `blockId`，无需改动。

**技术栈：** TypeScript, Vitest

---

### 任务 1：`KernelDataItem` 接口增加 `blockId` 字段

**文件：**
- 修改：`src/kernel/types.ts:168-191`
- 修改：`src/mcp/kernelDataWriter.ts:16-49`

- [ ] **步骤 1：在 `src/kernel/types.ts` 的 `KernelDataItem` 接口中增加 `blockId` 字段**

在 `id: string` 之后增加 `blockId: string | undefined`：

```typescript
interface KernelDataItem {
  id: string
  blockId: string | undefined
  content: string
  // ... 其余不变
}
```

- [ ] **步骤 2：在 `src/mcp/kernelDataWriter.ts` 的 `KernelData.items` 类型中增加 `blockId` 字段**

在 `items: Array<{` 的 `id: string` 之后增加 `blockId: string | undefined`：

```typescript
  items: Array<{
    id: string
    blockId: string | undefined
    content: string
    // ... 其余不变
  }>
```

- [ ] **步骤 3：运行 lint 验证类型一致性**

运行：`npx eslint src/kernel/types.ts src/mcp/kernelDataWriter.ts`
预期：无错误

- [ ] **步骤 4：Commit**

```bash
git add src/kernel/types.ts src/mcp/kernelDataWriter.ts
git commit -m "fix: add blockId field to KernelDataItem interface"
```

---

### 任务 2：`kernelDataWriter.ts` 映射时传入 `blockId`

**文件：**
- 修改：`src/mcp/kernelDataWriter.ts:98-121`

- [ ] **步骤 1：在 `writeKernelData` 的 items 映射中增加 `blockId` 字段**

在 `id: i.id,` 之后增加 `blockId: i.blockId,`：

```typescript
    items: items.map(i => ({
      id: i.id,
      blockId: i.blockId,
      content: i.content,
      date: i.date,
      // ... 其余不变
    })),
```

- [ ] **步骤 2：运行 lint 验证**

运行：`npx eslint src/mcp/kernelDataWriter.ts`
预期：无错误

- [ ] **步骤 3：Commit**

```bash
git add src/mcp/kernelDataWriter.ts
git commit -m "fix: map blockId from Item to KernelDataItem in writeKernelData"
```

---

### 任务 3：`reminder.ts` 中 timer ID 和 metadata 改用 `blockId`

**文件：**
- 修改：`src/kernel/reminder.ts:60-70`

- [ ] **步骤 1：编写失败的测试**

在 `test/kernel/reminder.dedup.test.ts` 中增加测试，验证 rebuild 后 timer ID 使用 `blockId` 而非 `item.id`：

在 `makeItem` 函数中增加 `blockId` 字段：

```typescript
function makeItem(overrides: Partial<KernelData['items'][0]> = {}): KernelData['items'][0] {
  return {
    id: 'item-1',
    blockId: 'stable-block-id',
    content: 'test item',
    date: '2026-05-28',
    startDateTime: undefined,
    endDateTime: undefined,
    status: 'todo',
    projectName: undefined,
    taskName: undefined,
    projectId: 'proj-1',
    links: undefined,
    pomodoros: [],
    reminder: {
      enabled: true,
      type: 'absolute',
      time: '10:00',
    },
    ...overrides,
  }
}
```

在文件末尾增加新的 describe 块：

```typescript
describe('rebuildReminderSchedule — timer ID uses blockId', () => {
  it('uses blockId instead of item.id in timer ID when blockId is present', async () => {
    const item = makeItem({ id: 'volatile-id-123', blockId: 'stable-block-id' })
    const data: KernelData = {
      version: 1,
      updatedAt: new Date().toISOString(),
      groups: [],
      projects: [],
      items: [item],
      habits: [],
    }
    mockStorageGet.mockResolvedValue({
      json: () => Promise.resolve(data),
    })

    await callRebuild()

    expect(mockRegisterTimers).toHaveBeenCalledOnce()
    const registered = mockRegisterTimers.mock.calls[0][0] as TimerEntry[]
    expect(registered.length).toBe(1)
    expect(registered[0].id).toContain('stable-block-id')
    expect(registered[0].id).not.toContain('volatile-id-123')
  })

  it('uses blockId in metadata.blockId when blockId is present', async () => {
    const item = makeItem({ id: 'volatile-id-456', blockId: 'stable-block-id-2' })
    const data: KernelData = {
      version: 1,
      updatedAt: new Date().toISOString(),
      groups: [],
      projects: [],
      items: [item],
      habits: [],
    }
    mockStorageGet.mockResolvedValue({
      json: () => Promise.resolve(data),
    })

    await callRebuild()

    const registered = mockRegisterTimers.mock.calls[0][0] as TimerEntry[]
    expect(registered[0].metadata.blockId).toBe('stable-block-id-2')
  })

  it('falls back to item.id when blockId is undefined', async () => {
    const item = makeItem({ id: 'fallback-id', blockId: undefined })
    const data: KernelData = {
      version: 1,
      updatedAt: new Date().toISOString(),
      groups: [],
      projects: [],
      items: [item],
      habits: [],
    }
    mockStorageGet.mockResolvedValue({
      json: () => Promise.resolve(data),
    })

    await callRebuild()

    const registered = mockRegisterTimers.mock.calls[0][0] as TimerEntry[]
    expect(registered[0].id).toContain('fallback-id')
    expect(registered[0].metadata.blockId).toBe('fallback-id')
  })

  it('rebuild with same blockId produces same timer ID, preserving notified state', async () => {
    const item = makeItem({ id: 'old-volatile-id', blockId: 'stable-block-id' })
    const data: KernelData = {
      version: 1,
      updatedAt: new Date().toISOString(),
      groups: [],
      projects: [],
      items: [item],
      habits: [],
    }
    mockStorageGet.mockResolvedValue({
      json: () => Promise.resolve(data),
    })

    await callRebuild()
    const firstId = (mockRegisterTimers.mock.calls[0][0] as TimerEntry[])[0].id

    vi.clearAllMocks()
    mockCancelTimersByType.mockReturnValue(undefined)
    mockRegisterTimers.mockReturnValue(undefined)

    const item2 = makeItem({ id: 'new-volatile-id', blockId: 'stable-block-id' })
    const data2: KernelData = {
      version: 1,
      updatedAt: new Date().toISOString(),
      groups: [],
      projects: [],
      items: [item2],
      habits: [],
    }
    mockStorageGet.mockResolvedValue({
      json: () => Promise.resolve(data2),
    })

    await callRebuild()
    const secondId = (mockRegisterTimers.mock.calls[0][0] as TimerEntry[])[0].id

    expect(firstId).toBe(secondId)
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/kernel/reminder.dedup.test.ts`
预期：FAIL — 新测试中 `registered[0].id` 包含 `volatile-id-123` 而非 `stable-block-id`

- [ ] **步骤 3：修改 `src/kernel/reminder.ts` 中 timer ID 和 metadata 使用 `blockId`**

将第 60-70 行从：

```typescript
        entries.push({
          id: `reminder-${item.id}-${item.date}-${reminderTime}`,
          type: 'reminder',
          endTime: Math.floor(reminderTime / 1000),
          metadata: {
            blockId: item.id,
            content: item.content,
            projectName: item.projectName,
            taskName: item.taskName,
          },
          notified: false,
        })
```

改为：

```typescript
        entries.push({
          id: `reminder-${item.blockId || item.id}-${item.date}-${reminderTime}`,
          type: 'reminder',
          endTime: Math.floor(reminderTime / 1000),
          metadata: {
            blockId: item.blockId || item.id,
            content: item.content,
            projectName: item.projectName,
            taskName: item.taskName,
          },
          notified: false,
        })
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/kernel/reminder.dedup.test.ts`
预期：PASS — 所有测试通过

- [ ] **步骤 5：运行全量测试确认无回归**

运行：`npx vitest run`
预期：PASS — 所有测试通过

- [ ] **步骤 6：Commit**

```bash
git add src/kernel/reminder.ts test/kernel/reminder.dedup.test.ts
git commit -m "fix: use blockId instead of item.id for reminder timer ID to prevent duplicate push on rebuild"
```

---

### 任务 4：最终验证

- [ ] **步骤 1：运行 lint**

运行：`npm run lint`
预期：无错误

- [ ] **步骤 2：运行全量测试**

运行：`npm run test`
预期：PASS

- [ ] **步骤 3：运行构建**

运行：`npm run build`
预期：构建成功
