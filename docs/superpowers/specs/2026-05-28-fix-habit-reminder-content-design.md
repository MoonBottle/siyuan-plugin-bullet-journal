# 修复习惯提醒内容显示 undefined

## 问题描述

习惯（Habit）提醒通知的内容显示为 `undefined`，而非预期的习惯名称。

**复现**：在笔记中定义一个带提醒的习惯（如 `喝水 🎯2025-05-28 ⏰09:00 🔄daily`），等待提醒触发，通知正文显示 "undefined"。

## 根因分析

`kernelDataWriter.ts` 在写入 `kernel-data.json` 时，将习惯的 `name` 字段错误地映射为 `Habit.content`（可选字段，解析器从未赋值），而非 `Habit.name`：

```typescript
// src/mcp/kernelDataWriter.ts L120-127
habits: habits.map(h => ({
  id: h.blockId,
  name: h.content,        // ❌ h.content 永远是 undefined
  ...
}))
```

解析器 `parseHabitLine` 只设置 `name`（习惯名），不设置 `content`。因此 `h.content` 始终为 `undefined`，导致 kernel-data.json 中 `habits[].name` 为 `undefined`，最终通知显示 "undefined"。

## 修复方案

### 1. 修复 kernelDataWriter.ts — name 字段映射 + 新增 target/unit

**文件**: `src/mcp/kernelDataWriter.ts`

修改 habits 映射逻辑（第 120-127 行）：

```typescript
habits: habits.map(h => ({
  id: h.blockId,
  name: h.name,           // ✅ 使用正确的 name 字段
  type: h.type,
  target: h.target,       // 新增：计数目标值
  unit: h.unit,           // 新增：单位
  reminder: h.reminder,
  targetDate: h.startDate,
  blockId: h.blockId,
})),
```

同步更新 `KernelData` 接口中的 habits 元素类型（第 50-67 行），增加 `target?: number` 和 `unit?: string`。

### 2. 同步 kernel 端类型 — kernel/types.ts

**文件**: `src/kernel/types.ts`

`KernelDataHabit`（第 191-198 行）增加 `target?: number` 和 `unit?: string`。

`TimerEntry.metadata`（第 112-118 行）增加 `target?: number` 和 `unit?: string`。

### 3. 传递 target/unit 到 TimerEntry — kernel/reminder.ts

**文件**: `src/kernel/reminder.ts`

修改 habit entries 的 metadata 构建（第 89-98 行），增加 `target: habit.target` 和 `unit: habit.unit`。

### 4. 优化通知内容 — reminderService.ts

**文件**: `src/services/reminderService.ts`

修改 `triggerHabitNotificationByMetadata`（第 452-464 行），区分二元型和计数型习惯，显示目标值和单位：

```typescript
private triggerHabitNotificationByMetadata(metadata: any): void {
  const title = `🎯 ${metadata.content}`
  const body = metadata.unit
    ? `${metadata.content} ${metadata.target || 0}${metadata.unit}`
    : metadata.content

  void showSystemNotification(title, body, {
    tag: `habit-reminder-${metadata.blockId}`,
    icon: '/plugins/siyuan-plugin-bullet-journal/icon.png',
    onClick: () => {
      this.openBlock(metadata.blockId)
    },
  }).catch((error) => {
    console.error('[ReminderService] Failed to show kernel habit notification:', error)
  })
}
```

## 修复后的通知效果

| 习惯类型 | 笔记内容 | 通知标题 | 通知正文 |
|----------|---------|---------|---------|
| 二元型 | `喝水 🎯2025-05-28 ⏰09:00 🔄daily` | 🎯 喝水 | 喝水 |
| 计数型 | `喝8杯水 🎯2025-05-28 ⏰09:00 🔄daily 8杯` | 🎯 喝8杯水 | 喝8杯水 8杯 |

## 影响范围

- 4 个文件改动，均为局部修改
- kernel-data.json schema 新增 2 个可选字段（向后兼容）
- 不影响现有调度逻辑、webhook 推送、移动端通知
