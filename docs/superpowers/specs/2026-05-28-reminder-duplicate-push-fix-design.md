# 修复：文档更新导致提醒重复推送

## 问题描述

当文档内容更新后，已触发的提醒会被重复推送到钉钉/飞书/企微等 webhook 渠道。

## 根因分析

### 链路

1. 提醒触发 → timer ID = `reminder-${item.id}-${date}-${time}` → 推送成功 → `notifiedTimerIds` 记录此 ID
2. 文档更新 → `kernel-data.json` 变化 → `fs-notify` → `rebuildReminderSchedule()`
3. 重新解析后 `item.id` 变化（`item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`，每次不同）
4. 新 timer ID 与旧 ID 不同 → `notifiedTimerIds` 找不到新 ID → `notified` 保持 `false` → 再次触发推送

### 根因

`item.id` 是运行时通过 `Date.now() + Math.random()` 生成的临时标识，每次解析都重新生成，不具备持久性。timer ID 中使用了这个不稳定的 `item.id`，导致 `notifiedTimerIds` 去重机制在 rebuild 后失效。

### 附带问题

`metadata.blockId` 也错误地使用了 `item.id`，导致提醒触发后调用 `openBlock(metadata.blockId)` 打开思源块时定位失败。

### Habit 提醒

Habit 提醒已使用 `habit.blockId` 构建 timer ID（`habit-${habit.blockId}-${date}-${time}`），不存在此问题。

## 修复方案

使用 `blockId`（思源内核分配的持久块标识）替代 `item.id` 构建 timer ID。

## 改动点

### 1. `KernelDataItem` 增加 `blockId` 字段

**文件**：`src/kernel/types.ts`

```typescript
interface KernelDataItem {
  id: string
  blockId: string | undefined  // 新增
  content: string
  // ... 其余不变
}
```

**文件**：`src/mcp/kernelDataWriter.ts`（对应的写入端类型定义）

同步增加 `blockId` 字段。

### 2. `kernelDataWriter.ts` 映射时传入 `blockId`

**文件**：`src/mcp/kernelDataWriter.ts`

```typescript
items: items.map(i => ({
  id: i.id,
  blockId: i.blockId,  // 新增
  content: i.content,
  // ... 其余不变
})),
```

### 3. `reminder.ts` 中 timer ID 和 metadata 改用 `blockId`

**文件**：`src/kernel/reminder.ts`

```typescript
// 之前:
id: `reminder-${item.id}-${item.date}-${reminderTime}`,
metadata: { blockId: item.id, ... }

// 之后:
id: `reminder-${item.blockId || item.id}-${item.date}-${reminderTime}`,
metadata: { blockId: item.blockId || item.id, ... }
```

使用 `item.blockId || item.id` 作为降级策略，确保 `blockId` 缺失时不会崩溃。

## 不受影响的部分

- **Habit 提醒**：已使用 `habit.blockId`，无需改动
- **MCP 工具**：`filter_items` 等不依赖 `blockId` 做去重，不受影响
- **Scheduler 核心逻辑**：`notifiedTimerIds` 机制本身没有问题，ID 稳定后自然恢复
- **Webhook 推送**：`metadata.blockId` 修正后，推送内容中的块定位更准确

## 边界情况

1. **`blockId` 为 `undefined`**：降级到 `item.id`，行为与当前一致
2. **已有 `notifiedTimerIds` 中的旧 ID**：rebuild 后新 ID 格式不同，旧记录自然失效，不会误匹配
3. **跨日提醒**：timer ID 中已包含 `date`，不同日期的提醒天然区分
