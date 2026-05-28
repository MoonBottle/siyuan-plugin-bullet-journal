# 修复习惯提醒内容显示 undefined 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复习惯提醒通知显示 `undefined` 的 bug，并优化通知内容以区分二元型/计数型习惯

**架构：** 在 kernel-data.json 写入阶段将 `h.content`（undefined）修正为 `h.name`（习惯名），同时新增 `target`/`unit` 字段传递到 TimerEntry metadata，最终在 reminderService 中根据类型渲染丰富内容。

**技术栈：** TypeScript, SiYuan Plugin API

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `src/mcp/kernelDataWriter.ts` | 修改：habits 映射逻辑，修复 name + 新增 target/unit |
| `src/kernel/types.ts` | 修改：KernelDataHabit 和 TimerEntry.metadata 类型增加 target/unit |
| `src/kernel/reminder.ts` | 修改：habit timer entry metadata 传递 target/unit |
| `src/services/reminderService.ts` | 修改：triggerHabitNotificationByMetadata 区分二元/计数型 |

---

### 任务 1：修复 kernelDataWriter.ts — 修复 name 映射 + 新增 target/unit

**文件：**
- 修改：`src/mcp/kernelDataWriter.ts:50-67`（KernelData 接口 habits 类型）
- 修改：`src/mcp/kernelDataWriter.ts:120-127`（habits 映射逻辑）

- [ ] **步骤 1：更新 KernelData 接口中的 habits 元素类型**

在 `src/mcp/kernelDataWriter.ts` 中，找到 `KernelData` 接口的 `habits` 数组元素类型（第 50-67 行），在 `blockId: string` 之前增加 `target?: number` 和 `unit?: string`：

```typescript
  habits: Array<{
    id: string
    name: string
    type: string
    target?: number
    unit?: string
    reminder?: {
      enabled: boolean
      type: 'absolute' | 'relative'
      time?: string
      alertMode?: {
        type: 'ontime' | 'before' | 'custom'
        minutes?: number
      }
      relativeTo?: 'start' | 'end'
      offsetMinutes?: number
    }
    targetDate: string
    blockId: string
  }>
```

- [ ] **步骤 2：修复 habits 映射逻辑**

在 `src/mcp/kernelDataWriter.ts` 中，找到 `writeKernelData` 函数的 habits 映射（第 120-127 行），将 `name: h.content` 改为 `name: h.name`，并新增 `target: h.target` 和 `unit: h.unit`：

```typescript
    habits: habits.map(h => ({
      id: h.blockId,
      name: h.name,
      type: h.type,
      target: h.target,
      unit: h.unit,
      reminder: h.reminder,
      targetDate: h.startDate,
      blockId: h.blockId,
    })),
```

- [ ] **步骤 3：Commit**

```bash
git add src/mcp/kernelDataWriter.ts
git commit -m "fix(kernel-data): use habit.name instead of habit.content for notification display"
```

---

### 任务 2：更新 kernel/types.ts — 同步类型定义

**文件：**
- 修改：`src/kernel/types.ts:108-119`（TimerEntry.metadata）
- 修改：`src/kernel/types.ts:191-198`（KernelDataHabit）

- [ ] **步骤 1：更新 TimerEntry.metadata 类型**

在 `src/kernel/types.ts` 中，找到 `TimerEntry` 接口的 `metadata`（第 112-117 行），增加 `target?` 和 `unit?`：

```typescript
interface TimerEntry {
  id: string
  type: 'reminder' | 'pomodoro' | 'break' | 'habit'
  endTime: number
  metadata: {
    blockId: string
    content: string
    projectName?: string
    taskName?: string
    target?: number
    unit?: string
  }
  notified: boolean
}
```

- [ ] **步骤 2：更新 KernelDataHabit 类型**

在 `src/kernel/types.ts` 中，找到 `KernelDataHabit` 接口（第 191-198 行），增加 `target?` 和 `unit?`：

```typescript
interface KernelDataHabit {
  id: string
  name: string
  type: string
  target?: number
  unit?: string
  reminder?: ReminderConfig
  targetDate: string
  blockId: string
}
```

- [ ] **步骤 3：Commit**

```bash
git add src/kernel/types.ts
git commit -m "fix(kernel-types): add target/unit to KernelDataHabit and TimerEntry.metadata"
```

---

### 任务 3：更新 kernel/reminder.ts — 传递 target/unit 到 TimerEntry

**文件：**
- 修改：`src/kernel/reminder.ts:89-98`（habit entry metadata 构建）

- [ ] **步骤 1：更新 habit entries 的 metadata**

在 `src/kernel/reminder.ts` 中，找到 habit entries 的 metadata 构建（第 93-96 行），增加 `target` 和 `unit`：

```typescript
        entries.push({
          id: `habit-${habit.blockId}-${habit.targetDate}-${habitReminderTime}`,
          type: 'habit',
          endTime: Math.floor(habitReminderTime / 1000),
          metadata: {
            blockId: habit.blockId,
            content: habit.name,
            target: habit.target,
            unit: habit.unit,
          },
          notified: false,
        })
```

- [ ] **步骤 2：Commit**

```bash
git add src/kernel/reminder.ts
git commit -m "fix(kernel-reminder): pass target/unit through to timer entry metadata"
```

---

### 任务 4：优化 reminderService.ts — 区分二元/计数型通知内容

**文件：**
- 修改：`src/services/reminderService.ts:452-464`（triggerHabitNotificationByMetadata）

- [ ] **步骤 1：更新 triggerHabitNotificationByMetadata**

在 `src/services/reminderService.ts` 中，找到 `triggerHabitNotificationByMetadata` 方法（第 452-464 行），修改为：

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

- [ ] **步骤 2：Commit**

```bash
git add src/services/reminderService.ts
git commit -m "fix(reminder-service): show habit name with target/unit in kernel notifications"
```

---

### 任务 5：验证

- [ ] **步骤 1：运行 lint**

运行：`npm run lint`
预期：无错误

- [ ] **步骤 2：运行 TypeScript 类型检查**

运行：`npx tsc --noEmit`
预期：无类型错误

- [ ] **步骤 3：运行测试**

运行：`npm run test`
预期：所有测试通过
