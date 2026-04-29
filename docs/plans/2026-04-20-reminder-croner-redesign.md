# 提醒服务重构：使用 croner 替代 setInterval 轮询

**日期**: 2026-04-20
**状态**: 已确认，待实现

## 问题诊断

提醒通知经常未能触发，对比番茄钟（稳定触发）发现 3 个根因：

### 1. getter 与 checker 竞态条件（最严重）

`itemsNeedingReminder` getter 过滤 `reminderTime > now` 的事项，但 checker 需要 `reminderTime <= now` 才触发。如果 getter 在两次 check 之间因 reactive 更新重新求值，已到期事项被标记为 "tooLate" 永远无法触发。

### 2. 浏览器后台节流

ReminderService 无 `visibilitychange` 监听。浏览器后台 `setInterval` 从 10s 被节流到 1min+，10s 检测窗口可能被完全跳过。

### 3. 检测窗口 = 检查间隔

检查间隔 10s，检测窗口也是 10s，任何延迟都会导致错过。

## 方案选择

| 方案 | 描述 | 结论 |
|------|------|------|
| A. 修复现有轮询 | 加 visibilitychange、放宽窗口、修复 getter | 根本问题（竞态）仍在 |
| B. croner 调度 | 每个事项创建 `new Cron(date, callback)` | **采用** |
| C. 手写 setTimeout | 自己管理 timer + visibilitychange | 等于重新造轮子 |

选择 croner 的理由：
- 支持传入 Date 对象做一次性调度
- 内置处理浏览器后台节流和 missed execution
- 零依赖、~3KB gzipped、支持浏览器和 TypeScript
- API 简洁：`new Cron(date, callback)` + `.stop()`

## 新架构

```
数据刷新时（loadProjects / refresh / scheduleRefresh）
  → ReminderService.scheduleRebuild()（300ms 防抖）
    → rebuildSchedule()
      → 遍历所有事项，计算 reminderTime
      → 已过期未通知的 → 立即触发通知
      → 未来 24h 内的 → 创建 Cron(date, callback)
      → 增量 diff：删除不存在的 job，新增/保留有效的 job

visibilitychange → visible
  → rebuildSchedule()（检查遗漏）
```

## 改动范围

| 文件 | 改动 |
|------|------|
| `src/services/reminderService.ts` | 完整重写 |
| `src/index.ts` | scheduleRefresh 中加 `reminderService.scheduleRebuild()` |
| `package.json` | 添加 `croner` 依赖 |

### 不变的部分

- `showSystemNotification` — 不变
- `calculateReminderTime` — 不变
- `reminderParser.ts` — 不变
- `itemsNeedingReminder` getter — 保留（UI 可能仍在使用）
- 番茄钟相关 — 不变

## 核心接口

```typescript
class ReminderService {
  start(plugin: Plugin, projectStore: ProjectStore): void;
  stop(): void;
  scheduleRebuild(): void;  // 新增，外部数据刷新时调用

  // 私有
  private rebuildSchedule(): void;
  private setupVisibilityListener(): void;
  private clearAllJobs(): void;
  private triggerNotification(item: Item): void;
  private scheduleCleanup(key: string): void;

  private scheduledJobs: Map<string, Cron>;   // key → Cron 实例
  private notifiedKeys: Set<string>;           // 已通知的 key
  private projectStore: ProjectStore | null;
  private plugin: Plugin | null;
  private rebuildTimer: ReturnType<typeof setTimeout> | null;
}
```
