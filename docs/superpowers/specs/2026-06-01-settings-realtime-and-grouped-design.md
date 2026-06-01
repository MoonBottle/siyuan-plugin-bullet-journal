# 设置对话框实时生效 + 分组切换 设计规格

**日期：** 2026-06-01
**状态：** 待审查

## 目标

将设置对话框从"暂存态 + 手动保存"模式改为"即时生效 + 分组切换"模式：

1. 设置变更即时持久化，去除底部保存/取消按钮
2. 右侧内容区改为真正的分组模式，根据左侧菜单选择动态展示
3. 搜索功能保持正常

## 当前架构

```
SettingsDialog
  ├── local = reactive(cloneSettings(plugin.getSettings()))  // 暂存草稿
  ├── 11 个 ConfigSection 子组件通过 v-model 修改 local
  ├── IntersectionObserver 监听滚动同步左侧高亮
  ├── handleSave() → plugin.updateSettings(local) + saveSettings()
  └── handleCancel() → closeDialog()
```

**问题：**
- 用户修改后必须点"保存"才生效，容易忘记保存
- 右侧是整体滚动，所有 section 同时在 DOM 中，IntersectionObserver 逻辑复杂
- 搜索时多个 section 同时可见，不够聚焦

## 新架构

### 数据流

```
子组件 emit('update:xxx', newValue)
    │
    ▼
SettingsDialog 接收 emit
    │
    ├── 即时校验（不合法 → showMessage + 阻止更新）
    │
    ├── 合法 → settingsStore.$patch({ xxx: newValue })
    │
    └── applySettings()
          ├── plugin.updateSettings(settingsStore 当前值)
          ├── plugin.saveSettings()
          ├── submitRefreshRequest(createFullRefreshRequest(...))
          └── eventBus.emit(Events.SETTINGS_CHANGED, settings)
```

**关键变更：**
- 删除 `local` reactive 对象，`settingsStore` 成为唯一真相源
- 子组件的 `v-model` 绑定改为读取 `settingsStore` 的值
- 每次变更即时写入 plugin + 持久化
- 删除 `handleSave()` 和 `handleCancel()`
- 关闭对话框 = `closeDialog()`，无需确认

### 右侧内容区

**从整体滚动改为分组切换：**

- 删除 `IntersectionObserver` 及相关逻辑（`isManualScrolling`、`scrollTimeout`）
- 删除 `scrollToSection()` 函数，改为 `activeSection.value = key`
- 右侧从 `v-show` 改为 `v-if="activeSection === item.key"`，只渲染当前选中的 section
- 每个 section 用 `<KeepAlive>` 包裹，避免切换时丢失未持久化的内部状态（如 AiSkillConfigSection 的编辑状态）

### 搜索功能

- 搜索输入 → `visibleMenuItems` 过滤左侧菜单（逻辑不变）
- 如果当前 `activeSection` 不在过滤结果中，自动切换到第一个匹配项
- 搜索清空后，保持当前选中的 section
- 右侧只渲染当前 `activeSection` 对应的 section

### 校验策略

每个字段的 emit 处理函数中即时校验：

| 字段 | 校验规则 | 不合法时行为 |
|------|---------|------------|
| `pomodoro.minFocusMinutes` | 1-60 的有效数字 | showMessage 提示 + 不更新值 |
| AI Provider name | 非空 | showMessage 提示 + 不更新值 |
| AI Provider apiUrl | 非空 | showMessage 提示 + 不更新值 |
| AI Provider apiKey | 非空 | showMessage 提示 + 不更新值 |
| AI Provider models | 至少 1 个 | showMessage 提示 + 不更新值 |

### 底部按钮

- 删除 `sy-settings-dialog__footer` 及其内部的"保存"和"取消"按钮
- 对话框右上角保留 SiYuan 原生的关闭按钮（×），点击即关闭

## 文件变更

| 文件 | 操作 | 变更内容 |
|------|------|---------|
| `src/components/settings/SettingsDialog.vue` | 修改 | 核心改造：删除 local、删除 footer、右侧 v-if 切换、即时持久化逻辑 |
| `src/stores/settingsStore.ts` | 修改 | 添加 `applySettings()` action 封装即时持久化逻辑 |
| `src/components/settings/DirectoryConfigSection.vue` | 不变 | 接口不变，仍 emit `update:xxx` |
| `src/components/settings/GroupConfigSection.vue` | 不变 | 接口不变 |
| `src/components/settings/PomodoroConfigSection.vue` | 修改 | `minFocusMinutes` 改为 emit `update:minFocusMinutes`，以便即时校验拦截 |
| `src/components/settings/CalendarConfigSection.vue` | 不变 | 接口不变 |
| `src/components/settings/HabitConfigSection.vue` | 不变 | 接口不变 |
| `src/components/settings/LunchBreakConfigSection.vue` | 不变 | 接口不变 |
| `src/components/settings/SlashCommandConfigSection.vue` | 不变 | 接口不变 |
| `src/components/settings/AiConfigSection.vue` | 不变 | 接口不变 |
| `src/components/settings/AiSkillConfigSection.vue` | 不变 | 独立持久化，不受影响 |
| `src/components/settings/McpConfigSection.vue` | 不变 | 纯操作，不受影响 |
| `src/components/settings/WebhookConfigSection.vue` | 不变 | 接口不变 |

## SettingsDialog.vue 模板变更

**之前：**
```html
<div class="sy-settings-dialog__content">
  <div id="section-dir" class="sy-settings-section-wrapper">
    <DirectoryConfigSection v-show="sectionVisible('dir')" v-model:directories="local.directories" ... />
  </div>
  <!-- 重复 11 个 section，全部在 DOM 中 -->
</div>
<div class="sy-settings-dialog__footer">
  <button @click="handleCancel">取消</button>
  <button @click="handleSave">保存</button>
</div>
```

**之后：**
```html
<div class="sy-settings-dialog__content">
  <KeepAlive>
    <component :is="currentSectionComponent" v-bind="currentSectionProps" v-on="currentSectionEvents" />
  </KeepAlive>
</div>
<!-- 无 footer -->
```

其中 `currentSectionComponent` 根据 `activeSection` 动态计算：

```typescript
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

const currentSectionComponent = computed(() => sectionComponentMap[activeSection.value])
```

## settingsStore 新增 applySettings() action

```typescript
async applySettings(partial: Partial<SettingsData>) {
  this.$patch(partial)
  const settings = this.$state as SettingsData
  this.plugin.updateSettings(settings)
  await this.plugin.saveSettings()
  submitRefreshRequest(createFullRefreshRequest(RefreshReasons.SETTINGS_DIALOG_SAVE, settings as Record<string, unknown>))
  eventBus.emit(Events.SETTINGS_CHANGED, settings)
}
```

**注意：** `settingsStore` 需要持有 `plugin` 引用。当前 `settingsStore` 已有 `loadFromPlugin()` 和 `saveToPlugin()` 方法，需要确保 `plugin` 实例在 store 初始化时被注入。

## 双路径持久化策略

子组件修改设置值有两种路径，需要分别处理：

### 路径 A：emit 路径（可校验）

CalendarConfigSection、HabitConfigSection、LunchBreakConfigSection、SlashCommandConfigSection、AiConfigSection、WebhookConfigSection 以及 PomodoroConfigSection 的 `minFocusMinutes` 字段。

这些字段通过 `emit('update:xxx', newValue)` 通知父组件，父组件在处理函数中：
1. 即时校验（不合法 → showMessage + 阻止更新）
2. 合法 → `settingsStore.applySettings({ xxx: newValue })`

### 路径 B：引用直接修改路径（不可校验）

DirectoryConfigSection 的 `dir.path`/`dir.enabled`/`dir.groupId`、GroupConfigSection 的 `group.name`、PomodoroConfigSection 的 `pomodoro.enableFloatingButton` 等布尔/字符串字段。

这些字段通过 reactive 引用直接修改 `settingsStore.$state` 的嵌套属性，不经过 emit。

**处理方式：** 在 SettingsDialog 中添加 `watch` 监听 `settingsStore.$state` 的深层变化，使用防抖（500ms）触发自动保存：

```typescript
watch(
  () => ({ ...settingsStore.$state }),
  () => {
    debouncedSave()
  },
  { deep: true },
)

function debouncedSave() {
  plugin.updateSettings(settingsStore.$state)
  plugin.saveSettings()
  submitRefreshRequest(createFullRefreshRequest(RefreshReasons.SETTINGS_DIALOG_SAVE, settingsStore.$state as Record<string, unknown>))
  eventBus.emit(Events.SETTINGS_CHANGED, settingsStore.$state)
}
```

**为什么两条路径并存：** 将所有引用直接修改改为 emit 模式需要改造 DirectoryConfigSection 和 GroupConfigSection 的内部实现（数组项属性绑定），工作量大且风险高。双路径方案在保持子组件接口不变的前提下实现即时持久化。

## 边界情况

1. **AiSkillConfigSection 和 McpConfigSection** 不走 settingsStore，有独立持久化。`<KeepAlive>` 确保切换时不丢失状态。
2. **WebhookConfigSection** 内部有自己的 `localWebhook` 深拷贝。改为即时持久化后，其 emit `update:webhook` 时触发 `applySettings({ webhook: newValue })`。
3. **对话框关闭时的 destroyCallback**：当前会调用 `plugin.loadSettings()` 重新加载。改为即时持久化后，这个回调仍然保留——它确保下次打开时数据一致，不会造成问题。
4. **并发写入保护**：`plugin.saveSettings()` 已有 400ms 防抖保护（`lastAISettingsSaveTime`），即时持久化不会导致磁盘 I/O 风暴。
5. **移动端设置**：`MobileSettingsDrawer` 是独立组件，不在本次改造范围内。但 `settingsStore.applySettings()` 可被移动端复用。
