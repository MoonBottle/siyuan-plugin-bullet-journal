# 目录扫描模式解耦设计

**日期**: 2025-01-09  
**状态**: 待实现  
**相关文件**: 
- `src/stores/settingsStore.ts`
- `src/stores/projectStore.ts`
- `src/components/settings/DirectoryConfigSection.vue`
- `src/types/models.ts`

---

## 问题背景

### 当前行为的问题

当前逻辑：**一旦配置目录，仅扫描配置目录**。

这导致用户困惑：
- 新用户首次配置目录后，原本可见的任务突然消失
- 用户预期：配置目录 = "特别关注并分组这些目录"
- 实际行为：配置目录 = "**只**扫描这些目录，其他全部忽略"

### 用户反馈场景

```
1. 用户试用插件 → 全空间扫描，看到所有任务
2. 配置了一个"工作"目录 → 个人/学习任务全部消失
3. 用户困惑："为什么我添加了任务但扫描不到？"
```

---

## 设计目标

1. **解耦"扫描范围"与"分组配置"**：两者独立控制
2. **默认安全**：新用户默认看到全部数据，不会因配置而丢失数据
3. **向后兼容**：升级用户数据无损，可自主选择切换
4. **性能可选**：保留"仅扫描配置目录"选项供大工作空间用户

---

## 方案概述

引入 `scanMode` 状态，与 `directories` 配置解耦：

| 概念 | 职责 |
|------|------|
| `scanMode` | 控制扫描范围（`full` = 全空间，`directories` = 仅配置目录） |
| `directories` | 控制项目分组归属（路径 → groupId 映射） |

---

## 详细设计

### 1. 数据模型变更

#### `models.ts` - 新增枚举

```typescript
// 扫描模式
export type ScanMode = 'full' | 'directories';
```

### 2. 新增工具函数

#### `src/utils/directoryUtils.ts` - 路径匹配分组

```typescript
import type { ProjectDirectory } from '@/types/models';

/**
 * 根据文档路径匹配目录配置，返回对应的分组 ID
 * 使用最长路径优先匹配策略
 * 
 * @param docPath 文档路径（如 "工作/项目/重要/A项目"）
 * @param directories 目录配置列表
 * @returns 匹配的分组 ID，未匹配返回 undefined
 */
export function matchGroupId(
  docPath: string,
  directories: ProjectDirectory[]
): string | undefined {
  const enabledDirs = directories.filter(d => d.enabled);
  
  // 按路径长度降序排序，确保最长路径优先匹配
  const sortedDirs = enabledDirs.sort((a, b) => b.path.length - a.path.length);
  
  const matched = sortedDirs.find(d => docPath.startsWith(d.path));
  return matched?.groupId;
}
```

#### `settingsStore.ts` - 状态变更

```typescript
state: () => ({
  // 新增：扫描范围模式，默认全空间扫描
  scanMode: 'full' as ScanMode,
  
  // 现有：目录配置（用于分组匹配）
  directories: [] as ProjectDirectory[],
  groups: [] as ProjectGroup[],
  defaultGroup: '',
  
  // ... 其他配置项保持不变
}),

getters: {
  // 获取启用的目录（用于分组匹配）
  enabledDirectories: (state) => {
    return state.directories.filter(d => d.enabled);
  },
  
  // 新增：判断当前是否为目录扫描模式
  isDirectoryScanMode: (state) => state.scanMode === 'directories',
  
  // ... 其他 getter 保持不变
},

actions: {
  loadFromPlugin() {
    // ...
    this.scanMode = settings.scanMode || 'full'; // 默认全扫描
    this.directories = settings.directories || [];
    // ...
  },
  
  saveToPlugin() {
    plugin.updateSettings({
      scanMode: this.scanMode,
      directories: this.directories,
      // ...
    });
  }
}
```

### 2. 扫描逻辑变更

#### `projectStore.ts` - 加载方法调整

```typescript
async loadProjects(_plugin: any, directories: ProjectDirectory[], scanMode: ScanMode) {
  // 根据 scanMode 决定扫描范围
  const effectiveDirectories = scanMode === 'full' 
    ? null  // 全空间扫描
    : directories.filter(d => d.enabled);  // 仅配置目录
  
  const parser = new MarkdownParser(effectiveDirectories);
  
  if (scanMode === 'full') {
    // 全空间扫描：传入 null 或特殊标记让 parser 扫描全部
    await parser.parseAllProjectsWithCallback(_plugin, (project) => {
      // 扫描完成后，根据 directories 配置确定项目分组
      project.groupId = this.determineGroupId(project.path, directories);
      this.projects.push(project);
    });
  } else {
    // 目录扫描模式：保持原有逻辑
    await parser.parseAllProjectsWithCallback(_plugin, (project) => {
      this.projects.push(project);
    });
  }
}

/**
 * 根据项目路径确定分组（最长路径优先匹配）
 */
private determineGroupId(projectPath: string, directories: ProjectDirectory[]): string | undefined {
  // 过滤启用的目录，按路径长度降序（最长优先）
  const enabledDirs = directories
    .filter(d => d.enabled)
    .sort((a, b) => b.path.length - a.path.length);
  
  for (const dir of enabledDirs) {
    if (projectPath.startsWith(dir.path)) {
      return dir.groupId;
    }
  }
  return undefined; // 未匹配到 = 无分组
}
```

### 4. UI 配置界面变更

#### `DirectoryConfigSection.vue` - 新增扫描模式选择

```vue
<template>
  <SySettingsSection icon="iconFolder" :title="t('settings').dirConfig.title" :description="t('settings').dirConfig.description">
    
    <!-- 新增：扫描模式选择 -->
    <SySettingItem
      :label="t('settings').scanMode.label"
      :description="t('settings').scanMode.description"
    >
      <div class="scan-mode-options">
        <label class="scan-mode-option" :class="{ active: scanMode === 'full' }">
          <input 
            v-model="scanMode" 
            type="radio" 
            value="full"
          />
          <span class="option-icon">🌐</span>
          <span class="option-content">
            <strong>{{ t('settings').scanMode.full.label }}</strong>
            <small>{{ t('settings').scanMode.full.description }}</small>
          </span>
        </label>
        
        <label class="scan-mode-option" :class="{ active: scanMode === 'directories' }">
          <input 
            v-model="scanMode" 
            type="radio" 
            value="directories"
          />
          <span class="option-icon">📁</span>
          <span class="option-content">
            <strong>{{ t('settings').scanMode.directories.label }}</strong>
            <small>{{ t('settings').scanMode.directories.description }}</small>
          </span>
        </label>
      </div>
    </SySettingItem>
    
    <!-- 目录配置列表 -->
    <div class="sy-directory-list">
      <div
        v-for="(dir, index) in directories"
        :key="dir.id"
        class="sy-directory-item fn__flex"
      >
        <input
          v-model="dir.path"
          type="text"
          class="b3-text-field fn__flex-center sy-directory-item__path"
          :placeholder="t('settings').projectDirectories.pathPlaceholder"
        />
        <SySelect
          :model-value="dir.groupId ?? ''"
          :options="groupOptions"
          :placeholder="t('settings').projectGroups.noGroup"
          class="sy-directory-item__group"
          @update:model-value="(v) => { dir.groupId = v || undefined; }"
        />
        <SyButton
          icon="iconTrashcan"
          :aria-label="t('settings').projectGroups.deleteButton"
          @click="removeDir(index)"
        />
        <SySwitch v-model="dir.enabled" />
      </div>
    </div>
    <SySettingsActionButton icon="iconAdd" :text="t('settings').projectDirectories.addButton" @click="addDir" />
    
    <!-- 提示信息 -->
    <div v-if="scanMode === 'full' && directories.length > 0" class="scan-mode-hint">
      <SyIcon icon="iconInfo" />
      <span>{{ t('settings').scanMode.fullWithDirectoriesHint }}</span>
    </div>
  </SySettingsSection>
</template>

<script setup lang="ts">
// ... 新增 scanMode 的 prop 和 emit
const props = defineProps<{
  directories: ProjectDirectory[];
  groups: ProjectGroup[];
  defaultGroup: string;
  scanMode: ScanMode;  // 新增
}>();

const emit = defineEmits<{
  'update:directories': [value: ProjectDirectory[]];
  'update:defaultGroup': [value: string];
  'update:scanMode': [value: ScanMode];  // 新增
}>();
</script>
```

### 5. 国际化文本（i18n）

```typescript
// 中文
{
  scanMode: {
    label: '扫描范围',
    description: '选择插件从哪些文档中读取任务数据',
    full: {
      label: '扫描整个工作空间',
      description: '所有文档都会被扫描，适合日常使用'
    },
    directories: {
      label: '仅扫描配置目录',
      description: '只扫描下方配置的目录，适合大型工作空间'
    },
    fullWithDirectoriesHint: '当前为全局扫描模式，目录配置仅用于分组归类'
  }
}

// English
{
  scanMode: {
    label: 'Scan Scope',
    description: 'Choose where the plugin reads task data from',
    full: {
      label: 'Scan entire workspace',
      description: 'All documents will be scanned, suitable for daily use'
    },
    directories: {
      label: 'Scan configured directories only',
      description: 'Only scan directories configured below, suitable for large workspaces'
    },
    fullWithDirectoriesHint: 'Currently in global scan mode, directory config is only used for grouping'
  }
}
```

### 5. 刷新逻辑调整

```typescript
// projectStore.ts
async refresh(_plugin: any, directories: ProjectDirectory[], scanMode: ScanMode) {
  // 刷新时也使用 scanMode 决定刷新范围
  const effectiveDirectories = scanMode === 'full' ? null : directories;
  
  // ... 后续刷新逻辑
}
```

---

## 相关文件变更汇总

| 文件 | 变更类型 | 变更内容 |
|------|---------|---------|
| `src/types/models.ts` | 新增 | `ScanMode` 类型定义 |
| `src/utils/directoryUtils.ts` | 新增 | `matchGroupId` 工具函数 |
| `src/settings.ts` | 修改 | `SettingsData` 添加 `scanMode` 字段 |
| `src/stores/settingsStore.ts` | 修改 | 添加 `scanMode` 状态，更新读写方法 |
| `src/stores/projectStore.ts` | 修改 | `loadProjects` 接收 `scanMode` 参数，调用 `matchGroupId` |
| `src/parser/markdownParser.ts` | 修改 | 构造函数接收 `scanMode`，解析逻辑分支处理 |
| `src/components/settings/DirectoryConfigSection.vue` | 修改 | 添加扫描模式选择 UI |
| `src/components/settings/SettingsDialog.vue` | 修改 | 传递 `scanMode` 到配置组件 |
| `src/index.ts` | 修改 | 启动时传递 `scanMode` 到 `loadProjects` |
| `src/i18n/*.ts` | 修改 | 添加扫描模式相关翻译 |

## 迁移策略

### 现有用户升级处理

```typescript
// settingsStore.ts - loadFromPlugin
loadFromPlugin() {
  const plugin = usePlugin() as any;
  if (plugin && plugin.getSettings) {
    const settings = plugin.getSettings();
    
    // 新增：scanMode 不存在时默认为 'full'（全扫描）
    this.scanMode = settings.scanMode || 'full';
    
    // 原有配置保持不变
    this.directories = settings.directories || [];
    // ...
  }
}
```

### 对用户的影响

| 用户场景 | 升级后体验 |
|---------|-----------|
| 未配置过目录 | 无变化，默认全扫描 |
| 配置了目录 | **数据重新出现**：默认切换为全扫描模式，所有任务可见 |
| 需要原行为 | 手动切换到"仅扫描配置目录"模式 |

---

## 边界情况处理

### 1. 全扫描模式 + 空目录配置
- 所有项目显示为"未分组"
- 分组筛选器显示"未分组"选项

### 2. 全扫描模式 + 有目录配置
- 匹配的项目按配置分组
- 未匹配项目显示为"未分组"
- 分组筛选器正常工作

### 3. 目录扫描模式 + 空目录配置
- 等同于未配置目录
- 提示用户："未配置扫描目录，请添加或切换到全局扫描"

### 4. 路径匹配冲突
- 使用**最长路径优先**策略
- 例如：`/工作/重要` 优先于 `/工作`

---

## 实现检查清单

- [ ] `models.ts` 添加 `ScanMode` 类型定义
- [ ] 新建 `src/utils/directoryUtils.ts` 实现 `matchGroupId`
- [ ] `settings.ts` `SettingsData` 添加 `scanMode` 字段
- [ ] `settingsStore.ts` 添加 `scanMode` 状态
- [ ] `settingsStore.ts` 更新 `loadFromPlugin` 和 `saveToPlugin`
- [ ] `markdownParser.ts` 构造函数添加 `scanMode` 参数
- [ ] `markdownParser.ts` `parseAllProjectsWithCallback` 根据 `scanMode` 分支处理
- [ ] `projectStore.ts` 更新 `loadProjects` 接收 `scanMode` 参数
- [ ] `projectStore.ts` 全扫描时调用 `matchGroupId` 匹配分组
- [ ] `projectStore.ts` 更新 `refresh` 方法传递 `scanMode`
- [ ] `DirectoryConfigSection.vue` 添加扫描模式 UI
- [ ] `SettingsDialog.vue` 传递 `scanMode` 到 `DirectoryConfigSection`
- [ ] `index.ts` 启动时获取 `scanMode` 并传递
- [ ] i18n 添加扫描模式相关翻译
- [ ] 测试：全扫描模式 + 目录配置 = 正确分组
- [ ] 测试：目录扫描模式 = 仅扫描配置目录
- [ ] 测试：升级后默认全扫描
- [ ] 测试：最长路径优先匹配逻辑

---

## 设计验证

### 原困惑场景的新体验

```
之前：
1. 用户试用插件 → 看到所有任务
2. 配置"工作"目录 → 个人任务消失 ❌
3. 用户困惑

之后：
1. 用户试用插件 → 看到所有任务（默认全扫描）
2. 配置"工作"目录 → 任务仍在，"工作"目录的项目被正确分组 ✓
3. （可选）用户根据需要切换到"仅扫描配置目录"模式
```

### 决策逻辑清晰

| 用户想做什么 | 操作 |
|-------------|------|
| 给项目分组 | 配置目录 + 选择分组 |
| 限制扫描范围提升性能 | 切换到"仅扫描配置目录"模式 |
| 同时实现以上两点 | 配置目录 + 切换到目录扫描模式 |

---

## 后续优化方向（可选）

1. **智能模式建议**：根据工作空间大小建议合适的扫描模式
2. **快速添加未分组项目**：在全扫描模式下，提供"将此项目所在目录加入配置"快捷按钮
3. **目录有效性检查**：检测配置的目录路径是否存在于思源笔记中
