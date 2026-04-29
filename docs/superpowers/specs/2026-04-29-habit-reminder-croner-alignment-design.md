# 习惯提醒与 Croner 调度对齐设计

**日期**: 2026-04-29
**状态**: Draft

## 背景

普通事项提醒已经从 `setInterval` 轮询切换为基于 `croner` 的一次性调度。当前习惯打卡提醒仍然保留窗口扫描语义：在 `ReminderService.rebuildSchedule()` 结束时执行一次 `checkHabitReminders()`，只有在“当前时间刚好落在 10 秒窗口内”时才会触发提醒。

这导致习惯提醒与普通事项提醒的可靠性模型不一致：

- 浏览器后台恢复后，可能错过 10 秒窗口
- 插件启动较晚时，无法像普通事项一样按宽容窗口补发
- 数据刷新或 `visibilitychange` 没有恰好覆盖提醒时刻时，提醒可能永久丢失

目标是让习惯提醒与普通事项提醒完全对齐，统一为“重建调度 -> 创建 Cron -> 允许宽容窗口补发”的模型。

## 目标

- 让习惯提醒与普通事项提醒使用同一类调度语义
- 避免继续依赖 10 秒扫描窗口触发习惯提醒
- 支持数据刷新、前后台切换、插件晚启动后的稳定补发
- 保持现有提醒展示、跳转块、去重清理等用户体验不变

## 非目标

- 不修改习惯频率规则的业务定义
- 不修改习惯完成判定逻辑
- 不重构普通事项提醒的 Croner 主体设计
- 不为习惯提醒新增独立服务进程或独立 UI

## 当前问题

当前习惯提醒实现分成两部分：

1. `ReminderService` 在 `rebuildSchedule()` 末尾直接调用 `checkHabitReminders()`
2. `habitReminder.ts` 通过 `getHabitsNeedingReminder(habits, currentDate, now)` 判断“此刻是否要弹”

这套实现的问题不是“逻辑错误”，而是调度模型仍是轮询式思维：

- `habitReminder.ts` 输出的是“现在该不该提醒”，而不是“今天什么时候提醒”
- `ReminderService` 没有为习惯维护持久的 `Cron` 作业
- 习惯提醒不会参与统一的 diff、stop、cleanup 过程

## 方案选择

### 方案 A：把习惯提醒并入现有 `ReminderService`

在 `ReminderService.rebuildSchedule()` 中为习惯构建独立的调度条目，并维护单独的 `habitScheduledJobs`。

优点：

- 与普通事项提醒模型一致
- 最大化复用现有 `croner`、补发、去重、清理机制
- 代码改动集中在现有提醒边界内

缺点：

- `ReminderService` 会同时管理两类作业

### 方案 B：新增 `HabitReminderService`

为习惯单独维护一套 `Cron` 调度服务。

优点：

- 职责边界更纯

缺点：

- 与普通事项调度大量重复
- 容易产生两套语义漂移
- 当前规模下收益不足

### 方案 C：保留扫描触发，只增强窗口和触发点

优点：

- 改动最小

缺点：

- 仍不是 Croner 调度模型
- 可靠性弱于普通事项提醒

### 结论

采用方案 A：继续以 `ReminderService` 作为唯一提醒调度入口，但为习惯单独维护一组 `Cron` 作业。

## 设计概览

### 总体原则

- 普通事项和习惯提醒共享统一的调度生命周期
- 两类提醒使用不同 key 空间和不同 job map
- 业务判断与调度判断分离

### 生命周期

触发重建的时机保持不变：

- 插件启动
- 数据刷新后调用 `scheduleRebuild()`
- 页面从后台恢复到前台时

每次重建时：

1. 计算普通事项提醒条目
2. 计算习惯提醒条目
3. 对两类条目分别做“补发 / 调度 / 清理”

## 详细设计

### 1. `ReminderService` 内部结构

新增一组习惯调度作业存储：

- `scheduledJobs: Map<string, Cron>`：普通事项
- `habitScheduledJobs: Map<string, Cron>`：习惯提醒

保留并继续复用：

- `notifiedKeys: Set<string>`
- `scheduleCleanup(key)`
- `openBlock(blockId)`
- `visibilitychange -> rebuildSchedule()`

`stop()` 和 `clearAllJobs()` 需要同时清理两类作业。

### 2. 习惯提醒条目生成

`habitReminder.ts` 不再输出“当前时刻要不要提醒”，而改为输出“今天有哪些提醒条目”。

建议新增接口：

```ts
interface HabitReminderEntry {
  habit: Habit;
  reminderTime: number;
  key: string;
}

function getHabitReminderEntries(
  habits: Habit[],
  currentDate: string
): HabitReminderEntry[]
```

过滤规则：

- 今天是打卡日
- 今天尚未完成
- 配置了提醒
- 能解析出今天的提醒时间

### 3. Key 设计

习惯提醒 key 设计为：

```ts
habit-${habit.blockId}-${currentDate}-${reminderTimestamp}
```

理由：

- 与普通事项 key 空间隔离
- 如果用户当天修改提醒时间，旧 key 会自然失效，旧 job 会被清掉
- 避免仅用 `blockId + date` 导致提醒时间变更后状态不一致

### 4. 重建语义

习惯提醒与普通事项完全对齐，采用相同时间语义：

- 未来 24 小时内：创建 `Cron`
- 已过期但在宽容窗口内：立即补发
- 已过期且超出宽容窗口：静默跳过并标记已处理

宽容窗口沿用普通事项当前值：

- `MISSED_THRESHOLD_MS = 5 * 60 * 1000`

理由：

- 保持两类提醒语义一致
- 避免习惯提醒出现“事项可补发、习惯不可补发”的用户困惑

### 5. Cron 作业管理

习惯提醒重建时维护一个新的 `habitNewEntries`：

- diff 删除不再存在的旧 job
- 为新增 key 创建新的 `Cron`
- 已存在 key 直接复用

Cron 回调行为：

1. 检查 `notifiedKeys`
2. 触发习惯通知
3. 写入 `notifiedKeys`
4. 调用 `scheduleCleanup(key)`
5. 从 `habitScheduledJobs` 删除自身

### 6. 通知触发

新增私有方法：

```ts
private triggerHabitNotification(habit: Habit): void
```

行为保持与当前实现一致：

- 标题：`🎯 ${habit.name}`
- 内容：二值习惯显示名称；计数习惯显示目标值和单位
- 点击通知跳转对应块

### 7. `habitReminder.ts` 的职责调整

保留：

- `isCheckInDay()`
- `getHabitReminderTime()`
- 频率与完成度判断逻辑

删除或替换：

- `getHabitsNeedingReminder(habits, currentDate, now)`

改为：

- `getHabitReminderEntries(habits, currentDate)`

这样 `habitReminder.ts` 只负责业务判断，不再负责“当前时刻命中窗口”的调度判断。

## 错误处理

- 单个习惯提醒时间解析失败时跳过该习惯，不阻断整体重建
- 某个 Cron 回调触发失败时，仅记录日志，不影响其他作业
- 若 `projectStore` 不可用，直接退出重建流程

## 测试设计

### `habitReminder.ts`

- 今天为打卡日时生成提醒条目
- 非打卡日不生成提醒条目
- 今日已完成的习惯不生成提醒条目
- 绝对时间提醒能生成正确时间戳
- 相对时间提醒能生成正确时间戳

### `ReminderService`

- 未来习惯提醒会创建 `habitScheduledJobs`
- 宽容窗口内的已过期习惯提醒会立即补发
- 超出宽容窗口的已过期习惯提醒不会补发
- 修改提醒时间后旧 job 被移除、新 job 被创建
- `stop()` 会清理习惯与事项两类 job

## 兼容性与迁移

- 不涉及数据格式迁移
- 不涉及用户配置变更
- 仅改变运行时调度方式

## 影响范围

- `src/services/reminderService.ts`
- `src/services/habitReminder.ts`
- `test/services/reminderService.test.ts`
- 新增或更新 `habitReminder` 相关测试

## 风险与控制

### 风险 1：两类 job 清理不完整

控制：

- 抽出统一的清理逻辑
- 在 `stop()` 与测试中覆盖两类 map 的清理

### 风险 2：习惯提醒与事项提醒 key 冲突

控制：

- 习惯 key 使用 `habit-` 前缀

### 风险 3：提醒时间变更后残留旧 job

控制：

- key 含 `reminderTimestamp`
- 每次重建做完整 diff

## 实施摘要

本次改动不引入新服务，而是在现有 `ReminderService` 内为习惯提醒新增一套与普通事项等价的 Croner 调度流程。`habitReminder.ts` 从“窗口命中判断器”调整为“提醒条目生成器”，从而实现业务判断与调度判断解耦，并使习惯提醒获得与普通事项相同的稳定性语义。
