# 节假日数据同步状态与手动刷新

## 背景

当前节假日数据（中国法定节假日/调休工作日）通过 `chinaWorkdayService.ts` 管理，仅在插件启动时异步刷新一次（fire-and-forget），用户无法感知同步状态，也无法手动触发刷新。需要在设置菜单中展示同步状态信息并支持手动刷新。

## 需求

1. 在 CalendarConfigSection 中显示节假日数据的同步状态
2. 显示：最后更新时间、数据来源标识、数据覆盖范围、同步状态指示
3. 支持手动点击按钮刷新
4. 重启后同步时间等状态信息保留

## 方案

扩展 `chinaWorkdayService.ts`，增加响应式状态对象，UI 直接绑定。同步状态随缓存数据一起持久化，重启后恢复。

## 数据模型

### 扩展 ChinaWorkdayCalendarData

```typescript
interface ChinaWorkdayCalendarMeta {
  lastUpdated: string | null    // ISO 时间戳，如 "2026-06-09T10:30:00+08:00"
  source: 'remote' | 'cache' | 'fallback'
  yearRange: string             // 如 "2025-2026"
}

interface ChinaWorkdayCalendarData {
  holidays: string[]
  workdays: string[]
  meta?: ChinaWorkdayCalendarMeta
}
```

`meta` 随 holidays/workdays 一起通过 `persistenceAdapter.saveData()` 缓存，重启后从缓存恢复。

### 响应式状态

在 `chinaWorkdayService.ts` 中新增模块级响应式对象：

```typescript
export const holidaySyncState = reactive({
  status: 'idle' as 'idle' | 'syncing' | 'success' | 'error',
  lastUpdated: null as string | null,
  source: 'fallback' as 'remote' | 'cache' | 'fallback',
  yearRange: '',
  errorMessage: '',
})
```

组件直接 import `holidaySyncState` 绑定到模板。

## 同步流程改造

| 时机 | status | source | lastUpdated | yearRange |
|------|--------|--------|-------------|-----------|
| 初始化（fallback） | idle | fallback | null | 从 fallback 数据推断 |
| 缓存加载成功 | idle | cache | 从缓存 meta 恢复 | 从缓存 meta 恢复 |
| 远程同步中 | syncing | — | — | — |
| 远程同步成功 | success | remote | 当前时间 | 从远程数据推断 |
| 远程同步失败 | error | 保持不变 | 保持不变 | 保持不变 |

`refreshChinaWorkdayCalendar()` 改为返回 `Promise<boolean>`，供手动刷新时判断结果。

### yearRange 推断逻辑

从 holidays/workdays 数组中提取最小和最大年份：

```typescript
function inferYearRange(data: { holidays: string[], workdays: string[] }): string {
  const years = new Set<number>()
  for (const d of [...data.holidays, ...data.workdays]) {
    years.add(Number(d.substring(0, 4)))
  }
  const sorted = [...years].sort()
  return sorted.length > 0 ? sorted.join('-') : ''
}
```

## UI 设计

在 CalendarConfigSection 底部新增一个"节假日数据"设置组，位于现有日历配置项之后。

### 桌面端

使用现有 `SySettingsSection` + `SySettingItem` 组件：

```
┌─ 节假日数据 ──────────────────────────────┐
│ 数据来源      远程同步 / 本地缓存 / 内置数据   │
│ 覆盖范围      2025-2026年                   │
│ 上次更新      2026-06-09 10:30              │
│ 同步状态      ● 已同步 / ⟳ 同步中 / ✕ 失败   │
│              [🔄 刷新]                      │
└───────────────────────────────────────────┘
```

- 同步状态颜色：绿色=成功、灰色=同步中、红色=失败
- 刷新按钮使用 `SySettingsActionButton`，同步中时 disabled 并显示 loading
- 刷新成功/失败通过 `showMessage()` toast 反馈

### 移动端

使用 iOS cell 风格，同样的信息展示，刷新按钮放在组底部。

## 涉及文件

| 文件 | 改动 |
|------|------|
| `src/services/chinaWorkdayService.ts` | 扩展数据模型、新增响应式状态、改造同步流程 |
| `src/constants/chinaWorkdayFallback.ts` | 为 fallback 数据补充 meta |
| `src/components/settings/CalendarConfigSection.vue` | 新增节假日同步状态 UI |
| `src/i18n/zh_CN.json` | 新增中文翻译 |
| `src/i18n/en_US.json` | 新增英文翻译 |
| `test/services/chinaWorkdayService.test.ts` | 更新测试 |

## 错误处理

- 远程同步失败：`status` 设为 `error`，`errorMessage` 记录简短原因，UI 显示"同步失败"和重试按钮
- 缓存损坏：降级到 fallback，`source` 设为 `fallback`
- 网络超时：与现有行为一致，静默降级
