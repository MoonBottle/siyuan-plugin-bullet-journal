# 设置对话框实时生效 + 分组切换 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将设置对话框从暂存态改为即时持久化，右侧从整体滚动改为分组切换，去除底部保存/取消按钮

**架构：** 删除 `local` reactive 暂存对象，`settingsStore` 成为唯一真相源。emit 路径的字段即时校验+持久化；引用直接修改路径的字段通过 deep watch + 防抖自动保存。右侧用 `v-if` + `<KeepAlive>` 动态切换 section。

**技术栈：** Vue 3.5 + Pinia 3 + TypeScript

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/stores/settingsStore.ts` | 修改 | 添加 `pomodoro`/`ai`/`customSlashCommands`/`webhook` 到 state，新增 `applySettings()` action |
| `src/components/settings/SettingsDialog.vue` | 修改 | 核心改造：删除 local、删除 footer、右侧 v-if 切换、双路径持久化 |
| `src/components/settings/PomodoroConfigSection.vue` | 修改 | `minFocusMinutes` 改为 emit 模式 |

---

### 任务 1：扩展 settingsStore state 和添加 applySettings action

**文件：**
- 修改：`src/stores/settingsStore.ts`

当前 `settingsStore` 的 state 中缺少 `pomodoro`、`ai`、`customSlashCommands`、`webhook` 字段。需要补齐这些字段，使 `settingsStore` 能完整代表 `SettingsData`，成为唯一真相源。

- [ ] **步骤 1：扩展 state，添加缺失字段**

在 `src/stores/settingsStore.ts` 的 `state()` 中添加以下字段（参考 `SettingsData` 类型定义）：

```typescript
state: () => ({
  scanMode: 'full' as ScanMode,
  directories: [] as ProjectDirectory[],
  groups: [] as ProjectGroup[],
  defaultGroup: '',
  calendarDefaultView: 'timeGridDay',
  lunchBreakStart: '12:00',
  lunchBreakEnd: '13:00',
  habitCheckInTimePrecision: 'day' as HabitCheckInTimePrecision,
  showPomodoroBlocks: true,
  showPomodoroTotal: true,
  calendarDateClickBehavior: 'click' as 'click' | 'dblclick',
  todoDock: {
    hideCompleted: false,
    hideAbandoned: false,
    showLinks: false,
    showReminderAndRecurring: false,
    sortRules: [...defaultTodoSortRules],
    selectedGroup: '',
  },
  focusWorkbench: {
    selectedGroup: '',
  },
  pomodoro: { ...defaultPomodoroSettings } as PomodoroSettings,
  ai: {
    providers: [] as AIProviderConfig[],
    activeProviderId: null as string | null,
  },
  customSlashCommands: [] as CustomSlashCommand[],
  webhook: {
    enabled: false,
    channels: [] as WebhookChannel[],
  } as WebhookConfig,
  loaded: false,
}),
```

需要在文件顶部添加新的 import：

```typescript
import type { AIProviderConfig } from '@/types/ai'
import type {
  CustomSlashCommand,
  PomodoroSettings,
  WebhookConfig,
} from '@/settings/types'
import { defaultPomodoroSettings } from '@/settings/types'
```

- [ ] **步骤 2：在 loadFromPlugin() 中加载新字段**

在 `loadFromPlugin()` 方法的 `if (plugin && plugin.getSettings)` 块内，在 `this.loaded = true` 之前添加：

```typescript
this.pomodoro = {
  ...defaultPomodoroSettings,
  ...settings.pomodoro,
}
this.ai = settings.ai || { providers: [], activeProviderId: null }
this.customSlashCommands = settings.customSlashCommands || []
this.webhook = settings.webhook || { enabled: false, channels: [] }
```

- [ ] **步骤 3：在 saveToPlugin() 中保存新字段**

在 `saveToPlugin()` 方法的 `plugin.updateSettings({...})` 调用中添加：

```typescript
pomodoro: this.pomodoro,
ai: this.ai,
customSlashCommands: this.customSlashCommands,
webhook: this.webhook,
```

- [ ] **步骤 4：添加 applySettings action**

在 `actions` 中添加：

```typescript
async applySettings(partial: Partial<SettingsData>) {
  this.$patch(partial)
  const plugin = usePlugin() as any
  if (!plugin?.updateSettings) return
  plugin.updateSettings(this.$state as SettingsData)
  await plugin.saveSettings()
  const settings = plugin.getSettings()
  submitRefreshRequest(
    createFullRefreshRequest(
      RefreshReasons.SETTINGS_DIALOG_SAVE,
      settings as Record<string, unknown>,
    ),
  )
  eventBus.emit(Events.SETTINGS_CHANGED, settings)
},
```

需要在文件顶部添加 import：

```typescript
import {
  eventBus,
  Events,
} from '@/utils/eventBus'
import {
  createFullRefreshRequest,
  RefreshReasons,
  submitRefreshRequest,
} from '@/utils/refreshRequests'
```

- [ ] **步骤 5：运行 lint 验证**

```powershell
npx eslint src/stores/settingsStore.ts 2>&1
```

预期：无错误

- [ ] **步骤 6：运行 typecheck 验证**

```powershell
npx tsc --noEmit src/stores/settingsStore.ts 2>&1 | Select-Object -First 20
```

预期：无类型错误

- [ ] **步骤 7：Commit**

```bash
git add src/stores/settingsStore.ts
git commit -m "feat: 扩展 settingsStore 添加 pomodoro/ai/webhook/slashCommands 字段和 applySettings action"
```

---

### 任务 2：修改 PomodoroConfigSection 的 minFocusMinutes 为 emit 模式

**文件：**
- 修改：`src/components/settings/PomodoroConfigSection.vue`

当前 `minFocusMinutes` 通过 `@input="pomodoro.minFocusMinutes = parseInt(...)"` 直接修改 props 引用。改为 emit 模式，以便父组件在校验失败时阻止更新。

- [ ] **步骤 1：修改桌面版 minFocusMinutes 输入**

将第 58-65 行的：

```html
<input
  type="number"
  class="b3-text-field fn__flex-center fn__size200"
  :value="pomodoro.minFocusMinutes ?? 5"
  min="1"
  max="60"
  @input="pomodoro.minFocusMinutes = parseInt(($event.target as HTMLInputElement).value)"
/>
```

改为：

```html
<input
  type="number"
  class="b3-text-field fn__flex-center fn__size200"
  :value="pomodoro.minFocusMinutes ?? 5"
  min="1"
  max="60"
  @input="handleMinFocusMinutesInput(($event.target as HTMLInputElement).value)"
/>
```

- [ ] **步骤 2：修改移动版 minFocusMinutes 输入**

将第 354-361 行的：

```html
<input
  type="number"
  class="ios-number-input"
  :value="pomodoro.minFocusMinutes ?? 5"
  min="1"
  max="60"
  @input="pomodoro.minFocusMinutes = parseInt(($event.target as HTMLInputElement).value) || 5"
/>
```

改为：

```html
<input
  type="number"
  class="ios-number-input"
  :value="pomodoro.minFocusMinutes ?? 5"
  min="1"
  max="60"
  @input="handleMinFocusMinutesInput(($event.target as HTMLInputElement).value)"
/>
```

- [ ] **步骤 3：添加 handleMinFocusMinutesInput 函数**

在 `<script setup>` 中添加：

```typescript
const handleMinFocusMinutesInput = (rawValue: string) => {
  const value = parseInt(rawValue)
  if (Number.isNaN(value) || value < 1 || value > 60) return
  emit('update:pomodoro', {
    ...props.pomodoro,
    minFocusMinutes: value,
  })
}
```

- [ ] **步骤 4：运行 lint 验证**

```powershell
npx eslint src/components/settings/PomodoroConfigSection.vue 2>&1
```

预期：无错误

- [ ] **步骤 5：Commit**

```bash
git add src/components/settings/PomodoroConfigSection.vue
git commit -m "refactor: PomodoroConfigSection minFocusMinutes 改为 emit 模式"
```

---

### 任务 3：核心改造 SettingsDialog.vue

**文件：**
- 修改：`src/components/settings/SettingsDialog.vue`

这是最大的改造任务。主要变更：
1. 删除 `local` reactive 对象，改为从 `settingsStore` 读取
2. 右侧从整体滚动改为 `v-if` + `<KeepAlive>` 动态切换
3. 删除底部保存/取消按钮
4. 添加双路径持久化逻辑（emit 路径 + deep watch 路径）
5. 删除 IntersectionObserver 和 scrollToSection

- [ ] **步骤 1：重写模板部分**

将整个 `<template>` 替换为：

```html
<template>
  <div class="sy-settings-dialog">
    <div class="sy-settings-dialog__body">
      <div class="sy-settings-dialog__sidebar">
        <div class="sy-settings-sidebar__search">
          <div class="sy-settings-search-wrap">
            <svg class="sy-settings-search__icon">
              <use xlink:href="#iconSearch"></use>
            </svg>
            <input
              v-model="searchQuery"
              type="text"
              class="b3-text-field sy-settings-search"
              :placeholder="t('settings').searchPlaceholder"
            />
          </div>
        </div>
        <nav class="sy-settings-sidebar__menu">
          <div
            v-for="item in visibleMenuItems"
            :key="item.key"
            class="sy-settings-menu-item"
            :class="{ 'sy-settings-menu-item--active': activeSection === item.key }"
            @click="activeSection = item.key"
          >
            <svg
              v-if="item.icon"
              class="sy-settings-menu-item__icon"
            >
              <use :xlink:href="`#${item.icon}`"></use>
            </svg>
            <span class="sy-settings-menu-item__title">{{ item.title }}</span>
          </div>
        </nav>
      </div>

      <div class="sy-settings-dialog__content">
        <KeepAlive>
          <component
            :is="currentSectionComponent"
            v-bind="currentSectionProps"
            v-on="currentSectionEvents"
          />
        </KeepAlive>
      </div>
    </div>
  </div>
</template>
```

- [ ] **步骤 2：重写 script setup 部分**

将整个 `<script setup>` 替换为：

```typescript
<script setup lang="ts">
import type { Component } from 'vue'
import type {
  AIProviderConfig,
} from '@/types/ai'
import type {
  CustomSlashCommand,
  PomodoroSettings,
  SettingsData,
  WebhookConfig,
} from '@/settings/types'
import { showMessage } from 'siyuan'
import {
  computed,
  onUnmounted,
  ref,
  watch,
} from 'vue'
import { t } from '@/i18n'
import { useSettingsStore } from '@/stores/settingsStore'
import AiConfigSection from './AiConfigSection.vue'
import AiSkillConfigSection from './AiSkillConfigSection.vue'
import CalendarConfigSection from './CalendarConfigSection.vue'
import DirectoryConfigSection from './DirectoryConfigSection.vue'
import GroupConfigSection from './GroupConfigSection.vue'
import HabitConfigSection from './HabitConfigSection.vue'
import LunchBreakConfigSection from './LunchBreakConfigSection.vue'
import McpConfigSection from './McpConfigSection.vue'
import PomodoroConfigSection from './PomodoroConfigSection.vue'
import SlashCommandConfigSection from './SlashCommandConfigSection.vue'
import WebhookConfigSection from './WebhookConfigSection.vue'

const props = defineProps<{
  plugin: any
  closeDialog: () => void
}>()

const settingsStore = useSettingsStore()
const searchQuery = ref('')
const activeSection = ref('dir')

interface MenuItem {
  key: string
  title: string
  icon: string
}

const menuItems = computed<MenuItem[]>(() => {
  const settings = t('settings') as Record<string, any>
  return [
    { key: 'dir', title: settings.dirConfig?.title ?? '目录配置', icon: 'iconFolder' },
    { key: 'group', title: settings.groupManage?.title ?? '分组管理', icon: 'iconGroups' },
    { key: 'pomodoro', title: settings.pomodoro?.title ?? '番茄钟', icon: 'iconClock' },
    { key: 'calendar', title: settings.calendar?.title ?? '日历', icon: 'iconCalendar' },
    { key: 'habit', title: settings.habitSettings?.title ?? '习惯', icon: 'iconCheck' },
    { key: 'lunch', title: settings.lunchBreak?.title ?? '午休时间', icon: 'iconClock' },
    { key: 'slash', title: settings.slashCommands?.title ?? '斜杠命令', icon: 'iconCode' },
    { key: 'ai', title: settings.ai?.title ?? 'AI 服务配置', icon: 'iconSparkles' },
    { key: 'skill', title: settings.aiSkills?.title ?? 'AI 技能配置', icon: 'iconPlugin' },
    { key: 'mcp', title: settings.mcp?.title ?? 'MCP 配置', icon: 'iconLink' },
    { key: 'webhook', title: settings.webhook?.title ?? 'Webhook 通知', icon: 'iconLink' },
  ]
})

const sectionKeywords: Record<string, string> = computed(() => {
  const s = t('settings') as Record<string, unknown>
  return {
    dir: collectStrings({ dirConfig: s.dirConfig, projectDirectories: s.projectDirectories }).join(' '),
    group: collectStrings({ groupManage: s.groupManage, projectGroups: s.projectGroups }).join(' '),
    pomodoro: collectStrings(s.pomodoro).join(' '),
    calendar: collectStrings(s.calendar).join(' '),
    habit: collectStrings(s.habitSettings).join(' '),
    ai: collectStrings(s.ai).join(' '),
    mcp: collectStrings(s.mcp).join(' '),
    webhook: collectStrings(s.webhook).join(' '),
    lunch: collectStrings(s.lunchBreak).join(' '),
    slash: collectStrings(s.slashCommands).join(' '),
    skill: collectStrings(s.aiSkills).join(' '),
  }
})

const visibleMenuItems = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return menuItems.value
  return menuItems.value.filter((item) => {
    const kw = sectionKeywords.value[item.key]?.toLowerCase() ?? ''
    return kw.includes(q)
  })
})

watch(visibleMenuItems, (items) => {
  if (items.length > 0 && !items.some((i) => i.key === activeSection.value)) {
    activeSection.value = items[0].key
  }
})

function collectStrings(obj: unknown): string[] {
  if (obj == null) return []
  if (typeof obj === 'string') return [obj]
  if (Array.isArray(obj)) return obj.flatMap(collectStrings)
  if (typeof obj === 'object') return Object.values(obj).flatMap(collectStrings)
  return []
}

const sectionComponentMap: Record<string, Component> = {
  dir: DirectoryConfigSection,
  group: GroupConfigSection,
  pomodoro: PomodoroConfigSection,
  calendar: CalendarConfigSection,
  habit: HabitConfigSection,
  lunch: LunchBreakConfigSection,
  slash: SlashCommandConfigSection,
  ai: AiConfigSection,
  skill: AiSkillConfigSection,
  mcp: McpConfigSection,
  webhook: WebhookConfigSection,
}

const currentSectionComponent = computed(() => sectionComponentMap[activeSection.value] ?? DirectoryConfigSection)

const currentSectionProps = computed(() => {
  switch (activeSection.value) {
    case 'dir':
      return {
        directories: settingsStore.directories,
        defaultGroup: settingsStore.defaultGroup,
        scanMode: settingsStore.scanMode,
        groups: settingsStore.groups,
      }
    case 'group':
      return {
        groups: settingsStore.groups,
        defaultGroup: settingsStore.defaultGroup,
        directories: settingsStore.directories,
      }
    case 'pomodoro':
      return { pomodoro: settingsStore.pomodoro }
    case 'calendar':
      return {
        calendarDefaultView: settingsStore.calendarDefaultView,
        showPomodoroBlocks: settingsStore.showPomodoroBlocks,
        showPomodoroTotal: settingsStore.showPomodoroTotal,
        calendarDateClickBehavior: settingsStore.calendarDateClickBehavior,
      }
    case 'habit':
      return { habitCheckInTimePrecision: settingsStore.habitCheckInTimePrecision }
    case 'lunch':
      return {
        lunchBreakStart: settingsStore.lunchBreakStart,
        lunchBreakEnd: settingsStore.lunchBreakEnd,
      }
    case 'slash':
      return { modelValue: settingsStore.customSlashCommands }
    case 'ai':
      return { ai: settingsStore.ai }
    case 'skill':
      return {}
    case 'mcp':
      return {}
    case 'webhook':
      return { webhook: settingsStore.webhook }
    default:
      return {}
  }
})

const currentSectionEvents = computed(() => {
  switch (activeSection.value) {
    case 'dir':
      return {
        'update:directories': (val: any) => settingsStore.applySettings({ directories: val }),
        'update:defaultGroup': (val: string) => settingsStore.applySettings({ defaultGroup: val }),
        'update:scanMode': (val: any) => settingsStore.applySettings({ scanMode: val }),
      }
    case 'group':
      return {
        'update:groups': (val: any) => settingsStore.applySettings({ groups: val }),
        'update:defaultGroup': (val: string) => settingsStore.applySettings({ defaultGroup: val }),
        'update:directories': (val: any) => settingsStore.applySettings({ directories: val }),
      }
    case 'pomodoro':
      return {
        'update:pomodoro': handlePomodoroUpdate,
      }
    case 'calendar':
      return {
        'update:calendarDefaultView': (val: string) => settingsStore.applySettings({ calendarDefaultView: val }),
        'update:showPomodoroBlocks': (val: boolean) => settingsStore.applySettings({ showPomodoroBlocks: val }),
        'update:showPomodoroTotal': (val: boolean) => settingsStore.applySettings({ showPomodoroTotal: val }),
        'update:calendarDateClickBehavior': (val: any) => settingsStore.applySettings({ calendarDateClickBehavior: val }),
      }
    case 'habit':
      return {
        'update:habitCheckInTimePrecision': (val: any) => settingsStore.applySettings({ habitCheckInTimePrecision: val }),
      }
    case 'lunch':
      return {
        'update:lunchBreakStart': (val: string) => settingsStore.applySettings({ lunchBreakStart: val }),
        'update:lunchBreakEnd': (val: string) => settingsStore.applySettings({ lunchBreakEnd: val }),
      }
    case 'slash':
      return {
        'update:modelValue': (val: CustomSlashCommand[]) => settingsStore.applySettings({ customSlashCommands: val }),
      }
    case 'ai':
      return {
        'update:ai': handleAiUpdate,
      }
    case 'webhook':
      return {
        'update:webhook': (val: WebhookConfig) => settingsStore.applySettings({ webhook: val }),
      }
    default:
      return {}
  }
})

function handlePomodoroUpdate(newPomodoro: PomodoroSettings) {
  if (newPomodoro.minFocusMinutes !== undefined) {
    const v = newPomodoro.minFocusMinutes
    if (Number.isNaN(v) || v < 1 || v > 60) {
      showMessage('最小专注时间必须在 1-60 分钟之间', 3000, 'error')
      return
    }
  }
  settingsStore.applySettings({ pomodoro: newPomodoro })
}

function handleAiUpdate(newAi: { providers: AIProviderConfig[]; activeProviderId: string | null }) {
  if (newAi.providers) {
    for (const provider of newAi.providers) {
      if (!provider.name?.trim()) {
        showMessage((t('settings') as any).ai?.messageEnterConfigName ?? '请输入配置名称', 3000, 'error')
        return
      }
      if (!provider.apiUrl?.trim()) {
        showMessage((t('settings') as any).ai?.messageEnterApiUrl ?? '请输入 API 地址', 3000, 'error')
        return
      }
      if (!provider.apiKey?.trim()) {
        showMessage((t('settings') as any).ai?.messageEnterApiKey ?? '请输入 API Key', 3000, 'error')
        return
      }
      if (!provider.models || provider.models.length === 0) {
        showMessage((t('settings') as any).ai?.messageAddOneModel ?? '请至少添加一个模型', 3000, 'error')
        return
      }
    }
  }
  settingsStore.applySettings({ ai: newAi })
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => settingsStore.$state,
  () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      const plugin = props.plugin
      if (!plugin?.updateSettings) return
      plugin.updateSettings(settingsStore.$state as SettingsData)
      plugin.saveSettings()
    }, 500)
  },
  { deep: true },
)

onUnmounted(() => {
  if (saveTimer) clearTimeout(saveTimer)
})
</script>
```

- [ ] **步骤 3：更新样式**

删除 `.sy-settings-dialog__footer` 相关样式（第 678-686 行）。其余样式保持不变。

- [ ] **步骤 4：运行 lint 验证**

```powershell
npx eslint src/components/settings/SettingsDialog.vue 2>&1
```

预期：无错误

- [ ] **步骤 5：运行 typecheck 验证**

```powershell
npx tsc --noEmit 2>&1 | Select-String "SettingsDialog" | Select-Object -First 10
```

预期：无类型错误

- [ ] **步骤 6：Commit**

```bash
git add src/components/settings/SettingsDialog.vue
git commit -m "feat: SettingsDialog 改为即时持久化 + 分组切换 + 去除保存按钮"
```

---

### 任务 4：验证和修复

- [ ] **步骤 1：运行完整 lint 检查**

```powershell
npm run lint 2>&1
```

预期：退出码 0

- [ ] **步骤 2：运行测试套件**

```powershell
npm run test 2>&1 | Select-String -Pattern "(Test Files|Tests )" | Select-Object -Last 3
```

预期：测试通过数与改造前一致

- [ ] **步骤 3：手动验证清单**

在思源笔记中打开设置对话框，逐项验证：

1. ✅ 左侧菜单点击切换，右侧只展示对应 section
2. ✅ 搜索输入关键词，左侧菜单过滤，右侧自动切换到匹配项
3. ✅ 搜索清空后，保持当前选中
4. ✅ 底部无保存/取消按钮
5. ✅ 修改目录配置后关闭对话框，重新打开确认已保存
6. ✅ 修改番茄钟设置后关闭对话框，重新打开确认已保存
7. ✅ 修改 AI Provider 后关闭对话框，重新打开确认已保存
8. ✅ 输入无效的 minFocusMinutes（如 0 或 100），提示错误且不保存
9. ✅ AI Provider 缺少必填字段时提示错误且不保存
10. ✅ AiSkillConfigSection 和 McpConfigSection 切换后状态不丢失

- [ ] **步骤 4：修复发现的问题（如有）**

- [ ] **步骤 5：最终 Commit**

```bash
git add -A
git commit -m "fix: 修复设置对话框改造后的验证问题"
```
