# 修复循环任务结束时间和精度 bug 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复循环任务跳过/迁移时自动添加结束时间和丢失时间精度的 bug

**架构：** 三个独立修复点：(1) 移除 `datePatchRender.ts` 中的 `addOneHour` 自动推算逻辑；(2) 在 `itemActions.ts` 的 `buildDatePatch` 中传递 `timePrecision`；(3) 在 `calendarEventChange.ts` 中阻止 move 操作写入 FullCalendar 自动生成的结束时间

**技术栈：** Vue 3 + TypeScript + Vitest

---

## 文件结构

| 文件 | 职责 | 操作 |
|------|------|------|
| `src/utils/blockWriter/render/datePatchRender.ts` | 日期 patch 渲染，含 addOneHour 逻辑 | 修改 |
| `src/utils/itemActions.ts` | 事项操作（完成/放弃/迁移/跳过） | 修改 |
| `src/utils/calendarEventChange.ts` | 日历拖拽事件持久化 | 修改 |
| `test/blockWriter/datePatchWriter.test.ts` | renderDatePatch 测试 | 修改 |
| `test/utils/itemActions.test.ts` | itemActions 测试 | 修改 |
| `test/utils/calendarEventChange.test.ts` | calendarEventChange 测试 | 修改 |

---

### 任务 1：修复 `addOneHour` 自动推算结束时间

**文件：**
- 修改：`src/utils/blockWriter/render/datePatchRender.ts:352-354`
- 测试：`test/blockWriter/datePatchWriter.test.ts`

- [ ] **步骤 1：编写失败的测试**

在 `test/blockWriter/datePatchWriter.test.ts` 的 `renderDatePatch — marker order` describe 块之后，新增一个 describe 块：

```typescript
describe('renderDatePatch — endTime handling', () => {
  it('does not add end time when patch has only startTime (no addOneHour)', () => {
    const kramdown = '填工时 ⏰17:01 🔁工作日 📅2026-06-12 17:00'
    const result = renderDatePatch(kramdown, {
      type: 'addDate',
      date: '2026-06-15',
      startTime: '17:00:00',
      endTime: undefined,
      allDay: false,
      originalDate: '2026-06-12',
      timePrecision: 'minute',
      siblingItems: [{ date: '2026-06-12', startDateTime: '2026-06-12 17:00:00', timePrecision: 'minute' as const }],
    })
    expect(result).toContain('📅2026-06-15 17:00')
    expect(result).not.toContain('~18:00')
    expect(result).not.toContain('~')
  })

  it('preserves endTime when explicitly provided', () => {
    const kramdown = '会议 📅2026-06-12 09:00~10:00'
    const result = renderDatePatch(kramdown, {
      type: 'addDate',
      date: '2026-06-15',
      startTime: '09:00:00',
      endTime: '10:00:00',
      allDay: false,
      originalDate: '2026-06-12',
      timePrecision: 'minute',
      siblingItems: [{ date: '2026-06-12', startDateTime: '2026-06-12 09:00:00', endDateTime: '2026-06-12 10:00:00', timePrecision: 'minute' as const }],
    })
    expect(result).toContain('📅2026-06-15 09:00~10:00')
  })

  it('renders allDay date without time when no startTime', () => {
    const kramdown = '全天事项 📅2026-06-12'
    const result = renderDatePatch(kramdown, {
      type: 'addDate',
      date: '2026-06-15',
      allDay: true,
      originalDate: '2026-06-12',
      siblingItems: [{ date: '2026-06-12' }],
    })
    expect(result).toContain('📅2026-06-15')
    expect(result).not.toContain('17:00')
    expect(result).not.toContain('~')
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/blockWriter/datePatchWriter.test.ts`
预期：第一个测试 FAIL，因为 `addOneHour` 仍会生成 `~18:00`

- [ ] **步骤 3：修改 `datePatchRender.ts` 移除 `addOneHour`**

将 `src/utils/blockWriter/render/datePatchRender.ts` 第 352-354 行：

```typescript
const formattedEndTime = patch.endTime
  ? formatTimeToSeconds(patch.endTime)
  : (formattedStartTime ? addOneHour(formattedStartTime) : undefined)
```

改为：

```typescript
const formattedEndTime = patch.endTime
  ? formatTimeToSeconds(patch.endTime)
  : undefined
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/blockWriter/datePatchWriter.test.ts`
预期：所有测试 PASS

- [ ] **步骤 5：Commit**

```bash
git add src/utils/blockWriter/render/datePatchRender.ts test/blockWriter/datePatchWriter.test.ts
git commit -m "fix(blockWriter): 移除 addOneHour 自动推算结束时间逻辑`n`n当 DatePatch.endTime 为空时不再自动加 1 小时作为结束时间，`n修复跳过/迁移操作凭空生成结束时间的 bug。"
```

---

### 任务 2：修复 `buildDatePatch` 未传递 `timePrecision`

**文件：**
- 修改：`src/utils/itemActions.ts:6-27`
- 测试：`test/utils/itemActions.test.ts`

- [ ] **步骤 1：编写失败的测试**

在 `test/utils/itemActions.test.ts` 的 `migrateItem` describe 块中，新增测试：

```typescript
it('preserves timePrecision when migrating timed item', async () => {
  const item = createItem({
    blockId: 'block-1',
    date: '2026-05-13',
    startDateTime: '2026-05-13 17:00:00',
    timePrecision: 'minute',
    siblingItems: [],
  })
  const result = await migrateItem(item)
  expect(result).toBe(true)
  expect(mockWriteBlock).toHaveBeenCalledWith(
    { blockId: 'block-1' },
    expect.objectContaining({
      type: 'addDate',
      startTime: '17:00:00',
      allDay: false,
      timePrecision: 'minute',
    }),
  )
})

it('preserves timePrecision as second when item has second precision', async () => {
  const item = createItem({
    blockId: 'block-1',
    date: '2026-05-13',
    startDateTime: '2026-05-13 17:00:30',
    timePrecision: 'second',
    siblingItems: [],
  })
  const result = await migrateItem(item)
  expect(result).toBe(true)
  expect(mockWriteBlock).toHaveBeenCalledWith(
    { blockId: 'block-1' },
    expect.objectContaining({
      type: 'addDate',
      timePrecision: 'second',
    }),
  )
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/utils/itemActions.test.ts`
预期：新增测试 FAIL，因为 `buildDatePatch` 不传递 `timePrecision`

- [ ] **步骤 3：修改 `itemActions.ts` 传递 `timePrecision`**

在 `src/utils/itemActions.ts` 的 `buildDatePatch` 函数返回值中增加 `timePrecision`：

将：
```typescript
function buildDatePatch(item: Item, targetDate: string) {
  const completeSiblingItems = [
    ...(item.siblingItems || []),
    ...(item.date
      ? [{
          date: item.date,
          startDateTime: item.startDateTime,
          endDateTime: item.endDateTime,
        }]
      : []),
  ]

  return {
    type: 'addDate' as const,
    date: targetDate,
    startTime: item.startDateTime ? item.startDateTime.split(' ')[1] : undefined,
    endTime: item.endDateTime ? item.endDateTime.split(' ')[1] : undefined,
    allDay: !item.startDateTime,
    originalDate: item.date,
    siblingItems: completeSiblingItems,
  }
}
```

改为：
```typescript
function buildDatePatch(item: Item, targetDate: string) {
  const completeSiblingItems = [
    ...(item.siblingItems || []),
    ...(item.date
      ? [{
          date: item.date,
          startDateTime: item.startDateTime,
          endDateTime: item.endDateTime,
          timePrecision: item.timePrecision,
        }]
      : []),
  ]

  return {
    type: 'addDate' as const,
    date: targetDate,
    startTime: item.startDateTime ? item.startDateTime.split(' ')[1] : undefined,
    endTime: item.endDateTime ? item.endDateTime.split(' ')[1] : undefined,
    allDay: !item.startDateTime,
    originalDate: item.date,
    siblingItems: completeSiblingItems,
    timePrecision: item.timePrecision,
  }
}
```

变更点：
1. `siblingItems` 中当前事项也增加 `timePrecision: item.timePrecision`
2. 返回值增加 `timePrecision: item.timePrecision`

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/utils/itemActions.test.ts`
预期：所有测试 PASS

- [ ] **步骤 5：Commit**

```bash
git add src/utils/itemActions.ts test/utils/itemActions.test.ts
git commit -m "fix(itemActions): buildDatePatch 传递 timePrecision`n`n修复迁移操作丢失时间精度的 bug，`n确保 17:00 不会变成 17:00:00。"
```

---

### 任务 3：修复日历移动操作写入自动生成的结束时间

**文件：**
- 修改：`src/utils/calendarEventChange.ts:63-97`
- 测试：`test/utils/calendarEventChange.test.ts`

- [ ] **步骤 1：编写失败的测试**

在 `test/utils/calendarEventChange.test.ts` 中新增测试：

```typescript
it('does not write endTime when moving event without original endDateTime', async () => {
  mockWriteBlock.mockResolvedValue(true)

  const result = await persistCalendarEventChange({
    blockId: 'block-1',
    allDay: false,
    start: '2026-05-02T17:00:00',
    end: '2026-05-02T18:00:00',
    date: '2026-05-01',
    originalStartDateTime: '2026-05-01 17:00:00',
    originalEndDateTime: undefined,
    timePrecision: 'minute',
    siblingItems: [],
    status: 'pending',
  }, 'move')

  expect(result).toBe(true)
  expect(mockWriteBlock).toHaveBeenCalledWith(
    { blockId: 'block-1' },
    expect.objectContaining({
      type: 'addDate',
      startTime: '17:00:00',
      endTime: undefined,
      allDay: false,
      timePrecision: 'minute',
    }),
  )
})

it('writes endTime when resizing event without original endDateTime', async () => {
  mockWriteBlock.mockResolvedValue(true)

  const result = await persistCalendarEventChange({
    blockId: 'block-1',
    allDay: false,
    start: '2026-05-02T17:00:00',
    end: '2026-05-02T18:30:00',
    date: '2026-05-01',
    originalStartDateTime: '2026-05-01 17:00:00',
    originalEndDateTime: undefined,
    timePrecision: 'minute',
    siblingItems: [],
    status: 'pending',
  }, 'resize')

  expect(result).toBe(true)
  expect(mockWriteBlock).toHaveBeenCalledWith(
    { blockId: 'block-1' },
    expect.objectContaining({
      type: 'addDate',
      startTime: '17:00:00',
      endTime: '18:30:00',
      allDay: false,
      timePrecision: 'minute',
    }),
  )
})

it('writes endTime when moving event with original endDateTime', async () => {
  mockWriteBlock.mockResolvedValue(true)

  const result = await persistCalendarEventChange({
    blockId: 'block-1',
    allDay: false,
    start: '2026-05-02T09:00:00',
    end: '2026-05-02T10:30:00',
    date: '2026-05-01',
    originalStartDateTime: '2026-05-01 09:00:00',
    originalEndDateTime: '2026-05-01 10:00:00',
    siblingItems: [],
    status: 'pending',
  }, 'move')

  expect(result).toBe(true)
  expect(mockWriteBlock).toHaveBeenCalledWith(
    { blockId: 'block-1' },
    expect.objectContaining({
      type: 'addDate',
      startTime: '09:00:00',
      endTime: '10:30:00',
      allDay: false,
    }),
  )
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/utils/calendarEventChange.test.ts`
预期：第一个测试 FAIL，因为 `persistCalendarEventChange` 会把 FullCalendar 自动生成的 `end` 作为 `endTime` 写入

- [ ] **步骤 3：修改 `calendarEventChange.ts`**

在 `src/utils/calendarEventChange.ts` 中，修改 `newEndTime` 的赋值逻辑。将第 63-66 行：

```typescript
if (eventInfo.end && eventInfo.end.includes('T')) {
  const time = eventInfo.end.split('T')[1]
  newEndTime = time.substring(0, 8)
}
```

改为：

```typescript
if (eventInfo.end && eventInfo.end.includes('T')) {
  const time = eventInfo.end.split('T')[1]
  newEndTime = time.substring(0, 8)
}

// 移动操作且原始无结束时间时，不写入 FullCalendar 自动生成的结束时间
if (action === 'move' && !originalEndDateTime) {
  newEndTime = ''
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/utils/calendarEventChange.test.ts`
预期：所有测试 PASS

- [ ] **步骤 5：Commit**

```bash
git add src/utils/calendarEventChange.ts test/utils/calendarEventChange.test.ts
git commit -m "fix(calendar): 移动操作不写入自动生成的结束时间`n`n当 move 操作且原始无 endDateTime 时，`n不将 FullCalendar 自动计算的 end 写回文档。`nresize 操作仍正常写入结束时间。"
```

---

### 任务 4：全量验证

- [ ] **步骤 1：运行全量测试**

运行：`npm run test`
预期：所有测试 PASS

- [ ] **步骤 2：运行 lint**

运行：`npm run lint`
预期：无错误

- [ ] **步骤 3：运行 typecheck**

运行：`npm run typecheck`
预期：无错误

- [ ] **步骤 4：检查 `addOneHour` 函数是否仍被引用**

搜索 `addOneHour` 在 `datePatchRender.ts` 中的其他调用。如果不再被使用，删除该函数定义（第 48-60 行）。

- [ ] **步骤 5：最终 Commit（如有清理）**

如果删除了 `addOneHour` 函数：

```bash
git add src/utils/blockWriter/render/datePatchRender.ts
git commit -m "refactor(blockWriter): 删除未使用的 addOneHour 函数"
```
