# 节假日数据同步状态与手动刷新 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 CalendarConfigSection 中展示节假日数据的同步状态（来源、覆盖范围、更新时间、同步状态），并支持手动刷新。

**架构：** 扩展 `chinaWorkdayService.ts` 的数据模型增加 `meta` 字段，新增模块级 `reactive` 响应式状态对象供 UI 绑定，改造同步流程在各关键节点更新状态。同步状态随缓存数据一起持久化。

**技术栈：** Vue 3 reactive、TypeScript、现有 SySettingItem/SySettingsActionButton 组件

---

## 文件结构

| 文件 | 职责 | 操作 |
|------|------|------|
| `src/constants/chinaWorkdayFallback.ts` | 定义 `ChinaWorkdayCalendarMeta` 接口，扩展 `ChinaWorkdayCalendarData` 增加 `meta` 字段，为 fallback 数据补充 meta | 修改 |
| `src/services/chinaWorkdayService.ts` | 新增 `holidaySyncState` 响应式状态、`inferYearRange` 工具函数、改造初始化/刷新流程更新状态 | 修改 |
| `src/components/settings/CalendarConfigSection.vue` | 新增节假日同步状态 UI（桌面端 + 移动端） | 修改 |
| `src/i18n/zh_CN.json` | 新增节假日同步状态相关中文翻译 | 修改 |
| `src/i18n/en_US.json` | 新增节假日同步状态相关英文翻译 | 修改 |
| `test/services/chinaWorkdayService.test.ts` | 新增 meta 持久化、响应式状态更新、手动刷新等测试 | 修改 |

---

### 任务 1：扩展数据模型与 fallback 数据

**文件：**
- 修改：`src/constants/chinaWorkdayFallback.ts`

- [ ] **步骤 1：扩展 ChinaWorkdayCalendarData 接口和 fallback 数据**

在 `src/constants/chinaWorkdayFallback.ts` 中：

1. 新增 `ChinaWorkdayCalendarMeta` 接口：

```typescript
export interface ChinaWorkdayCalendarMeta {
  lastUpdated: string | null
  source: 'remote' | 'cache' | 'fallback'
  yearRange: string
}
```

2. 扩展 `ChinaWorkdayCalendarData` 接口，增加可选 `meta` 字段：

```typescript
export interface ChinaWorkdayCalendarData {
  holidays: string[]
  workdays: string[]
  meta?: ChinaWorkdayCalendarMeta
}
```

3. 为 `CHINA_WORKDAY_FALLBACK` 补充 `meta`：

```typescript
export const CHINA_WORKDAY_FALLBACK: ChinaWorkdayCalendarData = {
  holidays: [
    // ... 保持不变
  ],
  workdays: [
    // ... 保持不变
  ],
  meta: {
    lastUpdated: null,
    source: 'fallback',
    yearRange: '2025-2026',
  },
}
```

- [ ] **步骤 2：运行类型检查验证**

运行：`npx vue-tsc --noEmit`
预期：无类型错误

- [ ] **步骤 3：Commit**

```bash
git add src/constants/chinaWorkdayFallback.ts
git commit -m "feat(holiday): 扩展节假日数据模型，增加 meta 字段"
```

---

### 任务 2：扩展 chinaWorkdayService 响应式状态与同步流程

**文件：**
- 修改：`src/services/chinaWorkdayService.ts`

- [ ] **步骤 1：编写失败的测试**

在 `test/services/chinaWorkdayService.test.ts` 中新增测试：

```typescript
it('exposes holidaySyncState with correct initial values', async () => {
  const service = await import('@/services/chinaWorkdayService')
  await service.__resetChinaWorkdayStateForTest()

  expect(service.holidaySyncState.status).toBe('idle')
  expect(service.holidaySyncState.source).toBe('fallback')
  expect(service.holidaySyncState.lastUpdated).toBeNull()
  expect(service.holidaySyncState.yearRange).toBe('2025-2026')
  expect(service.holidaySyncState.errorMessage).toBe('')
})

it('updates holidaySyncState when cache is loaded', async () => {
  const service = await import('@/services/chinaWorkdayService')
  await service.__resetChinaWorkdayStateForTest()

  const plugin = {
    loadData: vi.fn().mockResolvedValue(JSON.stringify({
      holidays: ['2026-10-01'],
      workdays: ['2026-10-10'],
      meta: {
        lastUpdated: '2026-06-01T10:00:00+08:00',
        source: 'remote',
        yearRange: '2026',
      },
    })),
    saveData: vi.fn(),
  }

  await service.initializeChinaWorkdayCalendar(plugin as any)

  expect(service.holidaySyncState.source).toBe('cache')
  expect(service.holidaySyncState.lastUpdated).toBe('2026-06-01T10:00:00+08:00')
  expect(service.holidaySyncState.yearRange).toBe('2026')
})

it('updates holidaySyncState to syncing/success when refresh succeeds', async () => {
  const service = await import('@/services/chinaWorkdayService')
  await service.__resetChinaWorkdayStateForTest()

  const plugin = {
    loadData: vi.fn().mockResolvedValue(null),
    saveData: vi.fn().mockResolvedValue(undefined),
  }

  await service.initializeChinaWorkdayCalendar(plugin as any)

  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      Years: {
        2026: {
          StartDate: '2026-10-01',
          EndDate: '2026-10-03',
          CompDays: ['2026-10-10'],
        },
      },
    }),
  }))

  const result = await service.refreshChinaWorkdayCalendar()

  expect(result).toBe(true)
  expect(service.holidaySyncState.status).toBe('success')
  expect(service.holidaySyncState.source).toBe('remote')
  expect(service.holidaySyncState.lastUpdated).not.toBeNull()
  expect(service.holidaySyncState.yearRange).toBe('2026')
})

it('updates holidaySyncState to error when refresh fails', async () => {
  const service = await import('@/services/chinaWorkdayService')
  await service.__resetChinaWorkdayStateForTest()

  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

  const result = await service.refreshChinaWorkdayCalendar()

  expect(result).toBe(false)
  expect(service.holidaySyncState.status).toBe('error')
  expect(service.holidaySyncState.errorMessage).toBeTruthy()
})

it('persists meta in cache data', async () => {
  const service = await import('@/services/chinaWorkdayService')
  await service.__resetChinaWorkdayStateForTest()

  const plugin = {
    loadData: vi.fn().mockResolvedValue(null),
    saveData: vi.fn().mockResolvedValue(undefined),
  }

  await service.initializeChinaWorkdayCalendar(plugin as any)

  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      Years: {
        2026: {
          StartDate: '2026-10-01',
          EndDate: '2026-10-03',
          CompDays: ['2026-10-10'],
        },
      },
    }),
  }))

  await service.refreshChinaWorkdayCalendar()

  expect(plugin.saveData).toHaveBeenCalledWith(
    'china-workday-calendar.json',
    expect.stringContaining('"meta"'),
  )
  expect(plugin.saveData).toHaveBeenCalledWith(
    'china-workday-calendar.json',
    expect.stringContaining('"lastUpdated"'),
  )
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/services/chinaWorkdayService.test.ts`
预期：新测试 FAIL（`holidaySyncState` 不存在、`refreshChinaWorkdayCalendar` 不返回 boolean）

- [ ] **步骤 3：实现响应式状态和同步流程改造**

在 `src/services/chinaWorkdayService.ts` 中：

1. 新增 import：

```typescript
import { reactive } from 'vue'
```

2. 新增 `inferYearRange` 工具函数（在 `isWeekend` 函数之后）：

```typescript
function inferYearRange(data: { holidays: string[], workdays: string[] }): string {
  const years = new Set<number>()
  for (const d of [...data.holidays, ...data.workdays]) {
    const year = Number(d.substring(0, 4))
    if (year > 2000 && year < 2100) {
      years.add(year)
    }
  }
  const sorted = [...years].sort()
  return sorted.length > 0 ? sorted.join('-') : ''
}
```

3. 新增 `holidaySyncState` 响应式对象（在 `activeCalendar` 声明之后）：

```typescript
export const holidaySyncState = reactive({
  status: 'idle' as 'idle' | 'syncing' | 'success' | 'error',
  lastUpdated: null as string | null,
  source: 'fallback' as 'remote' | 'cache' | 'fallback',
  yearRange: inferYearRange(CHINA_WORKDAY_FALLBACK),
  errorMessage: '',
})
```

4. 修改 `normalizeCalendarData` 函数，保留 meta：

```typescript
function normalizeCalendarData(data: ChinaWorkdayCalendarData): ChinaWorkdayCalendarData {
  return {
    holidays: [...new Set(data.holidays)].sort(),
    workdays: [...new Set(data.workdays)].sort(),
    meta: data.meta,
  }
}
```

5. 修改 `parseCalendarData` 函数，解析 meta：

在 `return normalizeCalendarData(...)` 调用中，增加 meta 传递：

```typescript
return normalizeCalendarData({
  holidays: parsed.holidays.filter((item: unknown): item is string => typeof item === 'string'),
  workdays: parsed.workdays.filter((item: unknown): item is string => typeof item === 'string'),
  meta: parsed.meta?.lastUpdated !== undefined
    ? {
        lastUpdated: typeof parsed.meta.lastUpdated === 'string' ? parsed.meta.lastUpdated : null,
        source: ['remote', 'cache', 'fallback'].includes(parsed.meta.source) ? parsed.meta.source : 'fallback',
        yearRange: typeof parsed.meta.yearRange === 'string' ? parsed.meta.yearRange : '',
      }
    : undefined,
})
```

6. 修改 `initializeChinaWorkdayCalendar` 函数，更新响应式状态：

```typescript
export async function initializeChinaWorkdayCalendar(plugin?: PersistenceAdapter): Promise<void> {
  if (plugin) {
    setChinaWorkdayPersistenceAdapter(plugin)
  }

  const cached = await loadCachedCalendar()
  if (cached) {
    activeCalendar = cached
    holidaySyncState.source = cached.meta?.source === 'remote' ? 'cache' : (cached.meta?.source ?? 'cache')
    holidaySyncState.lastUpdated = cached.meta?.lastUpdated ?? null
    holidaySyncState.yearRange = cached.meta?.yearRange || inferYearRange(cached)
  } else {
    activeCalendar = CHINA_WORKDAY_FALLBACK
    holidaySyncState.source = 'fallback'
    holidaySyncState.lastUpdated = null
    holidaySyncState.yearRange = inferYearRange(CHINA_WORKDAY_FALLBACK)
  }
}
```

7. 修改 `refreshChinaWorkdayCalendar` 函数，返回 boolean 并更新响应式状态：

```typescript
export async function refreshChinaWorkdayCalendar(): Promise<boolean> {
  holidaySyncState.status = 'syncing'
  holidaySyncState.errorMessage = ''

  try {
    const response = await fetch(HOLIDAY_API_URL)
    if (!response.ok) {
      holidaySyncState.status = 'error'
      holidaySyncState.errorMessage = `HTTP ${response.status}`
      return false
    }

    const payload = await response.json() as HolidayApiPayload
    const converted = convertHolidayPayload(payload)
    if (!converted) {
      holidaySyncState.status = 'error'
      holidaySyncState.errorMessage = 'Invalid data format'
      return false
    }

    const now = new Date().toISOString()
    const yearRange = inferYearRange(converted)
    const dataWithMeta: ChinaWorkdayCalendarData = {
      ...converted,
      meta: {
        lastUpdated: now,
        source: 'remote',
        yearRange,
      },
    }

    activeCalendar = dataWithMeta
    await saveCachedCalendar(dataWithMeta)

    holidaySyncState.status = 'success'
    holidaySyncState.source = 'remote'
    holidaySyncState.lastUpdated = now
    holidaySyncState.yearRange = yearRange

    return true
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    holidaySyncState.status = 'error'
    holidaySyncState.errorMessage = msg
    console.warn('[ChinaWorkdayService] Failed to refresh remote calendar:', error)
    return false
  }
}
```

8. 修改 `__resetChinaWorkdayStateForTest` 函数，重置响应式状态：

```typescript
export async function __resetChinaWorkdayStateForTest(): Promise<void> {
  activeCalendar = CHINA_WORKDAY_FALLBACK
  persistenceAdapter = null
  holidaySyncState.status = 'idle'
  holidaySyncState.lastUpdated = null
  holidaySyncState.source = 'fallback'
  holidaySyncState.yearRange = inferYearRange(CHINA_WORKDAY_FALLBACK)
  holidaySyncState.errorMessage = ''
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/services/chinaWorkdayService.test.ts`
预期：所有测试 PASS

- [ ] **步骤 5：运行 lint 和类型检查**

运行：`npm run lint && npx vue-tsc --noEmit`
预期：无错误

- [ ] **步骤 6：Commit**

```bash
git add src/services/chinaWorkdayService.ts test/services/chinaWorkdayService.test.ts
git commit -m "feat(holiday): 新增响应式同步状态，改造同步流程更新状态"
```

---

### 任务 3：新增 i18n 翻译

**文件：**
- 修改：`src/i18n/zh_CN.json`
- 修改：`src/i18n/en_US.json`

- [ ] **步骤 1：在 `settings.calendar` 对象中新增节假日同步状态翻译**

在 `src/i18n/zh_CN.json` 的 `settings.calendar` 对象中（`"clickBehaviorDouble": "双击"` 之后），新增：

```json
"holidayData": {
  "title": "节假日数据",
  "source": "数据来源",
  "sourceRemote": "远程同步",
  "sourceCache": "本地缓存",
  "sourceFallback": "内置数据",
  "yearRange": "覆盖范围",
  "lastUpdated": "上次更新",
  "syncStatus": "同步状态",
  "statusIdle": "未同步",
  "statusSyncing": "同步中...",
  "statusSuccess": "已同步",
  "statusError": "同步失败",
  "refresh": "刷新数据",
  "refreshing": "刷新中...",
  "refreshSuccess": "节假日数据已更新",
  "refreshFailed": "节假日数据同步失败"
}
```

在 `src/i18n/en_US.json` 的 `settings.calendar` 对象中，新增：

```json
"holidayData": {
  "title": "Holiday Data",
  "source": "Data Source",
  "sourceRemote": "Remote Sync",
  "sourceCache": "Local Cache",
  "sourceFallback": "Built-in Data",
  "yearRange": "Coverage",
  "lastUpdated": "Last Updated",
  "syncStatus": "Sync Status",
  "statusIdle": "Not synced",
  "statusSyncing": "Syncing...",
  "statusSuccess": "Synced",
  "statusError": "Sync failed",
  "refresh": "Refresh Data",
  "refreshing": "Refreshing...",
  "refreshSuccess": "Holiday data updated",
  "refreshFailed": "Holiday data sync failed"
}
```

- [ ] **步骤 2：运行 lint 验证 JSON 格式**

运行：`npm run lint`
预期：无错误

- [ ] **步骤 3：Commit**

```bash
git add src/i18n/zh_CN.json src/i18n/en_US.json
git commit -m "feat(i18n): 新增节假日同步状态翻译"
```

---

### 任务 4：CalendarConfigSection 新增节假日同步状态 UI

**文件：**
- 修改：`src/components/settings/CalendarConfigSection.vue`

- [ ] **步骤 1：在 CalendarConfigSection 中新增节假日同步状态 UI**

1. 新增 import：

```typescript
import { holidaySyncState, refreshChinaWorkdayCalendar } from '@/services/chinaWorkdayService'
import { showMessage } from '@/utils/dialog'
```

移除不再需要的 `SySettingsActionButton` import（如果不用的话），但这里需要用到 `SySettingsActionButton`，所以新增：

```typescript
import SySettingsActionButton from '@/components/settings/SySettingsActionButton.vue'
```

2. 新增手动刷新处理函数：

```typescript
const isRefreshing = ref(false)

async function handleRefreshHoliday() {
  isRefreshing.value = true
  const success = await refreshChinaWorkdayCalendar()
  isRefreshing.value = false
  const tSettings = t('settings').calendar.holidayData
  showMessage(success ? tSettings.refreshSuccess : tSettings.refreshFailed)
}
```

3. 在桌面端模板中，在 `</SySettingsSection>` 之前（即日历配置 Section 之后），新增节假日数据 Section：

```html
<!-- Holiday Data Section -->
<SySettingsSection
  icon="iconRefresh"
  :title="t('settings').calendar.holidayData.title"
>
  <SySettingItemList>
    <SySettingItem
      :label="t('settings').calendar.holidayData.source"
    >
      <span class="holiday-source">
        {{ sourceLabel }}
      </span>
    </SySettingItem>
    <SySettingItem
      :label="t('settings').calendar.holidayData.yearRange"
    >
      <span>{{ holidaySyncState.yearRange || '-' }}</span>
    </SySettingItem>
    <SySettingItem
      :label="t('settings').calendar.holidayData.lastUpdated"
    >
      <span>{{ formattedLastUpdated }}</span>
    </SySettingItem>
    <SySettingItem
      :label="t('settings').calendar.holidayData.syncStatus"
    >
      <span
        class="sync-status"
        :class="syncStatusClass"
      >
        {{ syncStatusLabel }}
      </span>
    </SySettingItem>
  </SySettingItemList>
  <SySettingsActionButton
    :text="isRefreshing ? t('settings').calendar.holidayData.refreshing : t('settings').calendar.holidayData.refresh"
    :disabled="isRefreshing"
    @click="handleRefreshHoliday"
  />
</SySettingsSection>
```

4. 新增计算属性（在 script setup 中）：

```typescript
const sourceLabel = computed(() => {
  const h = t('settings').calendar.holidayData
  switch (holidaySyncState.source) {
    case 'remote': return h.sourceRemote
    case 'cache': return h.sourceCache
    case 'fallback': return h.sourceFallback
  }
})

const formattedLastUpdated = computed(() => {
  if (!holidaySyncState.lastUpdated) return '-'
  const d = new Date(holidaySyncState.lastUpdated)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
})

const syncStatusLabel = computed(() => {
  const h = t('settings').calendar.holidayData
  switch (holidaySyncState.status) {
    case 'idle': return h.statusIdle
    case 'syncing': return h.statusSyncing
    case 'success': return h.statusSuccess
    case 'error': return h.statusError
  }
})

const syncStatusClass = computed(() => ({
  'sync-status--success': holidaySyncState.status === 'success',
  'sync-status--syncing': holidaySyncState.status === 'syncing',
  'sync-status--error': holidaySyncState.status === 'error',
}))
```

5. 新增样式（在 `<style>` 中）：

```scss
.holiday-source {
  color: var(--b3-theme-on-surface);
  font-size: 14px;
}

.sync-status {
  font-size: 14px;

  &--success {
    color: var(--b3-theme-success, #65b84f);
  }

  &--syncing {
    color: var(--b3-theme-on-surface-light, #999);
  }

  &--error {
    color: var(--b3-theme-error, #d23f31);
  }
}
```

6. 在移动端模板中（`<template v-else>` 内），在 `</div>` 结束之前新增 iOS 风格的节假日数据组：

```html
<!-- Holiday Data Group -->
<div class="ios-group-header">
  <div class="header-icon">
    📊
  </div>
  <div class="header-info">
    <div class="header-title">
      {{ t('settings').calendar.holidayData.title }}
    </div>
  </div>
</div>

<div class="ios-group">
  <div class="ios-cell">
    <div class="cell-content">
      <div class="cell-title">
        {{ t('settings').calendar.holidayData.source }}
      </div>
    </div>
    <div class="cell-accessory">
      <span class="holiday-source">{{ sourceLabel }}</span>
    </div>
  </div>
  <div class="ios-cell">
    <div class="cell-content">
      <div class="cell-title">
        {{ t('settings').calendar.holidayData.yearRange }}
      </div>
    </div>
    <div class="cell-accessory">
      <span>{{ holidaySyncState.yearRange || '-' }}</span>
    </div>
  </div>
  <div class="ios-cell">
    <div class="cell-content">
      <div class="cell-title">
        {{ t('settings').calendar.holidayData.lastUpdated }}
      </div>
    </div>
    <div class="cell-accessory">
      <span>{{ formattedLastUpdated }}</span>
    </div>
  </div>
  <div class="ios-cell">
    <div class="cell-content">
      <div class="cell-title">
        {{ t('settings').calendar.holidayData.syncStatus }}
      </div>
    </div>
    <div class="cell-accessory">
      <span
        class="sync-status"
        :class="syncStatusClass"
      >
        {{ syncStatusLabel }}
      </span>
    </div>
  </div>
  <div class="ios-cell ios-cell-action">
    <button
      class="ios-refresh-btn"
      :disabled="isRefreshing"
      @click="handleRefreshHoliday"
    >
      {{ isRefreshing ? t('settings').calendar.holidayData.refreshing : t('settings').calendar.holidayData.refresh }}
    </button>
  </div>
</div>
```

7. 新增移动端样式：

```scss
.ios-cell-action {
  justify-content: center;
  padding: 8px 16px;
}

.ios-refresh-btn {
  background: none;
  border: none;
  color: #007aff;
  font-size: 16px;
  cursor: pointer;
  padding: 8px 16px;

  &:disabled {
    color: #c7c7cc;
    cursor: not-allowed;
  }
}
```

- [ ] **步骤 2：运行 lint 和类型检查**

运行：`npm run lint && npx vue-tsc --noEmit`
预期：无错误

- [ ] **步骤 3：Commit**

```bash
git add src/components/settings/CalendarConfigSection.vue
git commit -m "feat(settings): 新增节假日同步状态 UI 和手动刷新"
```

---

### 任务 5：全量验证

- [ ] **步骤 1：运行全部测试**

运行：`npm run test`
预期：所有测试 PASS

- [ ] **步骤 2：运行 lint**

运行：`npm run lint`
预期：无错误

- [ ] **步骤 3：运行类型检查**

运行：`npx vue-tsc --noEmit`
预期：无错误

- [ ] **步骤 4：运行构建**

运行：`npm run build`
预期：构建成功
