# 提取设置菜单代码重构计划

## 目标
将 `src/index.ts` 中设置菜单相关的代码提取到独立的模块中，减少主文件的代码量，提高可维护性。

## 当前状况
- `src/index.ts` 共 1743 行代码
- 设置菜单相关代码约 380-1500 行，约 1120 行
- 主要包含：目录配置、分组管理、午休时间、MCP配置、AI服务配置等设置项

## 提取方案

### 1. 创建新的设置模块 `src/settings/`

```
src/settings/
├── index.ts          # 设置模块入口，导出创建设置面板的主函数
├── types.ts          # 设置相关的类型定义
├── directoryConfig.ts # 目录配置设置项
├── groupConfig.ts    # 分组管理设置项
├── lunchBreakConfig.ts # 午休时间设置项
├── mcpConfig.ts      # MCP配置设置项
├── aiConfig.ts       # AI服务配置设置项
└── utils.ts          # 设置相关的工具函数
```

### 2. 提取内容

#### settings/types.ts
- `SettingsData` 接口
- `TodoDockSettings` 接口
- `AIChatHistory` 接口
- 其他设置相关类型

#### settings/index.ts
- 主函数 `createSettingsPanel(plugin: HKWorkPlugin): Setting`
- 整合所有设置项

#### settings/directoryConfig.ts
- 目录配置设置项的创建函数
- 依赖：`renderDirectoriesList`, `populateGroupSelect`, `updateAllGroupSelects`

#### settings/groupConfig.ts
- 分组管理设置项的创建函数
- 依赖：`renderGroupsList`, `updateDefaultGroupSelect`

#### settings/lunchBreakConfig.ts
- 午休时间设置项的创建函数

#### settings/mcpConfig.ts
- MCP配置设置项的创建函数

#### settings/aiConfig.ts
- AI服务配置设置项的创建函数（约 700 行，最复杂）
- 包含：供应商列表、新增/编辑供应商卡片

#### settings/utils.ts
- `updateDefaultGroupSelect`
- `populateGroupSelect`
- `updateAllGroupSelects`
- `renderGroupsList`
- `renderDirectoriesList`

### 3. 修改 `src/index.ts`

**删除的内容：**
- `TodoDockSettings` 接口定义
- `AIChatHistory` 接口定义
- `SettingsData` 接口定义
- `defaultSettings` 常量
- `settings` 全局变量
- `chatHistory` 全局变量
- `registerSetting` 方法及其所有内部代码
- `renderGroupsList` 方法
- `renderDirectoriesList` 方法
- `updateDefaultGroupSelect` 方法
- `populateGroupSelect` 方法
- `updateAllGroupSelects` 方法

**保留的内容：**
- `sharedPinia` 相关代码
- `onload`, `onunload`, `uninstall` 方法
- `loadSettings`, `saveSettings` 方法
- `loadAIChatHistory`, `saveAIChatHistory` 方法
- `getSettings`, `updateSettings` 方法
- `getAIChatHistory` 方法
- `saveAISettings`, `saveAIChatHistoryFromStore` 方法
- `getEnabledDirectories` 方法
- `handleDocTreeMenu` 方法
- `registerTabs`, `registerDocks`, `registerTopBar` 方法
- `openCustomTab`, `getTabIcon`, `getTabTitle` 方法
- `registerEventListeners`, `onWsMain`, `scheduleRefresh` 方法

**新增的内容：**
- 从 `settings/index` 导入 `createSettingsPanel`
- 修改 `registerSetting` 方法，调用 `createSettingsPanel(this)`

### 4. 依赖关系处理

需要在设置模块中访问的 `HKWorkPlugin` 方法：
- `loadSettings()` - 重新加载设置
- `saveSettings()` - 保存设置
- `getSettings()` - 获取设置
- `updateSettings()` - 更新设置

需要共享的状态：
- `settings` - 设置数据（通过 `plugin.getSettings()` 访问）
- `defaultSettings` - 默认设置（在 settings 模块中定义）

### 5. 实施步骤

1. **创建 `src/settings/types.ts`** - 提取类型定义
2. **创建 `src/settings/utils.ts`** - 提取工具函数
3. **创建 `src/settings/directoryConfig.ts`** - 提取目录配置
4. **创建 `src/settings/groupConfig.ts`** - 提取分组管理
5. **创建 `src/settings/lunchBreakConfig.ts`** - 提取午休时间
6. **创建 `src/settings/mcpConfig.ts`** - 提取 MCP 配置
7. **创建 `src/settings/aiConfig.ts`** - 提取 AI 配置（最复杂）
8. **创建 `src/settings/index.ts`** - 整合所有设置项
9. **修改 `src/index.ts`** - 简化设置相关代码

## 预期结果

- `src/index.ts` 代码量从 1743 行减少到约 600-700 行
- 设置相关代码独立成模块，便于维护
- 各设置项职责清晰，便于后续扩展
