# 目录扫描模式解耦实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 引入 `scanMode` 状态解耦扫描范围与分组配置，默认全空间扫描避免用户困惑

**Architecture:** 新增 `ScanMode` 类型控制扫描范围（`'full'` 全扫描 / `'directories'` 仅配置目录），新增 `matchGroupId` 工具函数实现最长路径优先匹配，Parser 和 Store 根据 `scanMode` 分支处理

**Tech Stack:** TypeScript, Vue 3, Pinia, Vite

**Design Doc:** `docs/superpowers/specs/2025-01-09-directory-scan-mode-design.md`

---

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/types/models.ts` | 修改 | 添加 `ScanMode` 类型 |
| `src/utils/directoryUtils.ts` | 新建 | `matchGroupId` 路径匹配工具函数 |
| `src/utils/__tests__/directoryUtils.test.ts` | 新建 | `matchGroupId` 单元测试 |
| `src/settings.ts` | 修改 | `SettingsData` 添加 `scanMode` 字段 |
| `src/stores/settingsStore.ts` | 修改 | 添加 `scanMode` 状态，更新读写方法 |
| `src/parser/markdownParser.ts` | 修改 | 构造函数接收 `scanMode`，解析逻辑分支 |
| `src/stores/projectStore.ts` | 修改 | `loadProjects` 接收 `scanMode`，全扫描时匹配分组 |
| `src/components/settings/DirectoryConfigSection.vue` | 修改 | 添加扫描模式选择 UI |
| `src/components/settings/SettingsDialog.vue` | 修改 | 传递 `scanMode` 到目录配置组件 |
| `src/index.ts` | 修改 | 启动时传递 `scanMode` |
| `src/i18n/zh.ts` | 修改 | 添加扫描模式中文翻译 |
| `src/i18n/en.ts` | 修改 | 添加扫描模式英文翻译 |

---

## Task 1: 添加 ScanMode 类型定义

**Files:**
- Modify: `src/types/models.ts:180-186` (ProjectGroup 定义后)

**Context:** 在 `ProjectGroup` 接口后添加 `ScanMode` 类型定义

- [ ] **Step 1: 添加 ScanMode 类型**

```typescript
// src/types/models.ts - 在 ProjectGroup 后添加

// 扫描模式
export type ScanMode = 'full' | 'directories';
```

- [ ] **Step 2: 验证类型导出**

检查文件确保类型正确导出，无语法错误。

- [ ] **Step 3: Commit**

```bash
git add src/types/models.ts
git commit -m "feat: add ScanMode type definition"
```

---

## Task 2: 创建 matchGroupId 工具函数及测试

**Files:**
- Create: `src/utils/directoryUtils.ts`
- Create: `src/utils/__tests__/directoryUtils.test.ts`

**Context:** 独立的路径匹配工具函数，最长路径优先策略

- [ ] **Step 1: 创建工具函数文件**

```typescript
// src/utils/directoryUtils.ts
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
  
  if (enabledDirs.length === 0) {
    return undefined;
  }
  
  // 按路径长度降序排序，确保最长路径优先匹配
  const sortedDirs = [...enabledDirs].sort((a, b) => b.path.length - a.path.length);
  
  const matched = sortedDirs.find(d => docPath.startsWith(d.path));
  return matched?.groupId;
}
```

- [ ] **Step 2: 创建单元测试文件**

```typescript
// src/utils/__tests__/directoryUtils.test.ts
import { describe, it, expect } from 'vitest';
import { matchGroupId } from '../directoryUtils';
import type { ProjectDirectory } from '@/types/models';

describe('matchGroupId', () => {
  const createDir = (path: string, groupId: string, enabled = true): ProjectDirectory => ({
    id: `dir-${path}`,
    path,
    enabled,
    groupId
  });

  it('should return undefined when no directories provided', () => {
    const result = matchGroupId('工作/项目A', []);
    expect(result).toBeUndefined();
  });

  it('should return undefined when no directories enabled', () => {
    const dirs = [createDir('工作', 'group1', false)];
    const result = matchGroupId('工作/项目A', dirs);
    expect(result).toBeUndefined();
  });

  it('should match exact path', () => {
    const dirs = [createDir('工作', 'work-group')];
    const result = matchGroupId('工作/项目A', dirs);
    expect(result).toBe('work-group');
  });

  it('should return undefined when path does not match', () => {
    const dirs = [createDir('工作', 'work-group')];
    const result = matchGroupId('个人/日记', dirs);
    expect(result).toBeUndefined();
  });

  it('should use longest path first matching', () => {
    const dirs = [
      createDir('工作', 'work-group'),
      createDir('工作/重要', 'important-group')
    ];
    // 应该匹配最长路径 "工作/重要"
    const result = matchGroupId('工作/重要/项目A', dirs);
    expect(result).toBe('important-group');
  });

  it('should match multiple levels', () => {
    const dirs = [
      createDir('工作', 'work'),
      createDir('学习', 'study'),
      createDir('个人', 'personal')
    ];
    expect(matchGroupId('工作/2024/项目', dirs)).toBe('work');
    expect(matchGroupId('学习/前端/React', dirs)).toBe('study');
    expect(matchGroupId('个人/健康/运动', dirs)).toBe('personal');
  });

  it('should handle empty groupId', () => {
    const dirs = [{ id: 'dir1', path: '工作', enabled: true }];
    const result = matchGroupId('工作/项目A', dirs);
    expect(result).toBeUndefined();
  });
});
```

- [ ] **Step 3: 运行测试确保通过**

```bash
npm test -- src/utils/__tests__/directoryUtils.test.ts
```

Expected: All 7 tests pass

- [ ] **Step 4: Commit**

```bash
git add src/utils/directoryUtils.ts src/utils/__tests__/directoryUtils.test.ts
git commit -m "feat: add matchGroupId utility with longest-path-first matching"
```

---

## Task 3: Settings 数据模型添加 scanMode

**Files:**
- Modify: `src/settings.ts`

**Context:** 在 `SettingsData` 接口和 `defaultSettings` 中添加 `scanMode`

- [ ] **Step 1: 找到 SettingsData 接口**

```typescript
// src/settings.ts - 找到 SettingsData 接口，添加 scanMode 字段
export interface SettingsData {
  // ... 现有字段
  directories: ProjectDirectory[];
  groups: ProjectGroup[];
  defaultGroup: string;
  // ... 其他字段
}
```

- [ ] **Step 2: 添加 scanMode 字段**

```typescript
// src/settings.ts - SettingsData 接口
export interface SettingsData {
  // 新增：扫描模式
  scanMode: ScanMode;
  
  // 现有字段
  directories: ProjectDirectory[];
  groups: ProjectGroup[];
  defaultGroup: string;
  calendarDefaultView: string;
  lunchBreakStart: string;
  lunchBreakEnd: string;
  showPomodoroBlocks: boolean;
  showPomodoroTotal: boolean;
  todoDock: {
    hideCompleted: boolean;
    hideAbandoned: boolean;
  };
  ai: {
    providers: AIProviderConfig[];
    activeProviderId: string | null;
    showToolCalls?: boolean;
  };
  pomodoro: PomodoroSettings;
  customSlashCommands: SlashCommandConfig[];
}
```

- [ ] **Step 3: 更新 defaultSettings**

```typescript
// src/settings.ts - defaultSettings 对象
export const defaultSettings: SettingsData = {
  // 新增：默认全空间扫描
  scanMode: 'full',
  
  // 现有默认值
  directories: [],
  groups: [],
  defaultGroup: '',
  calendarDefaultView: 'timeGridDay',
  lunchBreakStart: '12:00',
  lunchBreakEnd: '13:00',
  showPomodoroBlocks: true,
  showPomodoroTotal: true,
  todoDock: {
    hideCompleted: false,
    hideAbandoned: false
  },
  ai: {
    providers: [],
    activeProviderId: null,
    showToolCalls: true
  },
  pomodoro: defaultPomodoroSettings,
  customSlashCommands: []
};
```

- [ ] **Step 4: Commit**

```bash
git add src/settings.ts
git commit -m "feat: add scanMode to SettingsData with default 'full'"
```

---

## Task 4: SettingsStore 添加 scanMode 状态

**Files:**
- Modify: `src/stores/settingsStore.ts`

**Context:** 添加 `scanMode` 到 state、getters 和 actions

- [ ] **Step 1: 更新 state**

```typescript
// src/stores/settingsStore.ts - state 函数
state: () => ({
  // 新增：扫描模式，默认全空间扫描
  scanMode: 'full' as ScanMode,
  
  // 现有状态
  directories: [] as ProjectDirectory[],
  groups: [] as ProjectGroup[],
  defaultGroup: '',
  calendarDefaultView: 'timeGridDay',
  lunchBreakStart: '12:00',
  lunchBreakEnd: '13:00',
  showPomodoroBlocks: true,
  showPomodoroTotal: true,
  todoDock: {
    hideCompleted: false,
    hideAbandoned: false
  },
  loaded: false
}),
```

- [ ] **Step 2: 添加 getter**

```typescript
// src/stores/settingsStore.ts - getters 对象
getters: {
  // 新增：判断当前是否为目录扫描模式
  isDirectoryScanMode: (state) => state.scanMode === 'directories',
  
  // 现有 getters
  enabledDirectories: (state) => {
    return state.directories.filter(d => d.enabled);
  },
  // ... 其他 getters
},
```

- [ ] **Step 3: 更新 loadFromPlugin**

```typescript
// src/stores/settingsStore.ts - loadFromPlugin action
loadFromPlugin() {
  const plugin = usePlugin() as any;
  console.log('[Bullet Journal] loadFromPlugin called, plugin:', plugin);
  if (plugin && plugin.getSettings) {
    const settings = plugin.getSettings();
    console.log('[Bullet Journal] getSettings returned:', settings);
    
    // 新增：scanMode（默认 'full'）
    this.scanMode = settings.scanMode || 'full';
    
    // 现有加载逻辑
    this.directories = settings.directories || [];
    this.groups = settings.groups || [];
    this.defaultGroup = settings.defaultGroup || '';
    this.calendarDefaultView = settings.calendarDefaultView || 'timeGridDay';
    this.lunchBreakStart = settings.lunchBreakStart || '12:00';
    this.lunchBreakEnd = settings.lunchBreakEnd || '13:00';
    this.showPomodoroBlocks = settings.showPomodoroBlocks ?? true;
    this.showPomodoroTotal = settings.showPomodoroTotal ?? true;
    this.todoDock = settings.todoDock || { hideCompleted: false, hideAbandoned: false };
    this.loaded = true;
    
    console.log('[Bullet Journal] loadFromPlugin completed, scanMode:', this.scanMode);
  }
},
```

- [ ] **Step 4: 更新 saveToPlugin**

```typescript
// src/stores/settingsStore.ts - saveToPlugin action
saveToPlugin() {
  const plugin = usePlugin() as any;
  if (plugin && plugin.updateSettings) {
    plugin.updateSettings({
      // 新增：保存 scanMode
      scanMode: this.scanMode,
      
      // 现有配置
      directories: this.directories,
      groups: this.groups,
      defaultGroup: this.defaultGroup,
      calendarDefaultView: this.calendarDefaultView,
      lunchBreakStart: this.lunchBreakStart,
      lunchBreakEnd: this.lunchBreakEnd,
      showPomodoroBlocks: this.showPomodoroBlocks,
      showPomodoroTotal: this.showPomodoroTotal,
      todoDock: this.todoDock
    });
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/stores/settingsStore.ts
git commit -m "feat: add scanMode state to settingsStore"
```

---

## Task 5: MarkdownParser 支持 scanMode

**Files:**
- Modify: `src/parser/markdownParser.ts`

**Context:** 构造函数接收 `scanMode`，解析逻辑根据模式分支处理

- [ ] **Step 1: 导入 ScanMode 类型**

```typescript
// src/parser/markdownParser.ts - 导入部分
import type { Project, Item, ProjectDirectory, PomodoroRecord, ScanMode } from '@/types/models';
```

- [ ] **Step 2: 修改构造函数**

```typescript
// src/parser/markdownParser.ts - MarkdownParser 类
export class MarkdownParser {
  private directories: ProjectDirectory[];
  private scanMode: ScanMode;

  constructor(directories: ProjectDirectory[], scanMode: ScanMode = 'directories') {
    this.directories = directories?.filter(d => d.enabled) || [];
    this.scanMode = scanMode;
  }
  // ...
}
```

- [ ] **Step 3: 修改 parseAllProjectsWithCallback 方法**

```typescript
// src/parser/markdownParser.ts - parseAllProjectsWithCallback 方法
public async parseAllProjectsWithCallback(
  _plugin: any,
  onProjectReady: (project: Project) => void
): Promise<void> {
  console.log('[Task Assistant][Parser] 开始流式解析项目，scanMode:', this.scanMode, '目录数量:', this.directories.length);
  const processedDocIds = new Set<string>();

  if (this.scanMode === 'full') {
    // 全扫描模式：扫描所有文档
    const docs = await this.getAllDocs();
    for (const doc of docs) {
      if (processedDocIds.has(doc.id)) continue;
      processedDocIds.add(doc.id);
      try {
        // 全扫描时 groupId 由外部根据路径匹配决定，这里传 undefined
        const project = await this.parseAndProcessSingleDocument(
          doc.id,
          doc.notebookId,
          undefined,
          doc.path,
          _plugin
        );
        if (project) {
          onProjectReady(project);
        }
      } catch (error) {
        console.error(`[Task Assistant] Error parsing project document ${doc.id}:`, error);
      }
    }
  } else {
    // 目录扫描模式：只扫描配置的目录
    for (const directory of this.directories) {
      const docs = await this.getProjectDocs(directory.path);
      for (const doc of docs) {
        if (processedDocIds.has(doc.id)) continue;
        processedDocIds.add(doc.id);
        try {
          const project = await this.parseAndProcessSingleDocument(
            doc.id,
            doc.notebookId,
            directory.groupId,
            doc.path,
            _plugin
          );
          if (project) {
            onProjectReady(project);
          }
        } catch (error) {
          console.error(`[Bullet Journal] Error parsing project document ${doc.id}:`, error);
        }
      }
    }
  }

  console.log('[Task Assistant][Parser] 流式解析完成，项目总数:', processedDocIds.size);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/parser/markdownParser.ts
git commit -m "feat: MarkdownParser support scanMode parameter"
```

---

## Task 6: ProjectStore 集成 scanMode 和分组匹配

**Files:**
- Modify: `src/stores/projectStore.ts`

**Context:** `loadProjects` 接收 `scanMode`，全扫描时调用 `matchGroupId`

- [ ] **Step 1: 导入依赖**

```typescript
// src/stores/projectStore.ts - 导入部分
import { matchGroupId } from '@/utils/directoryUtils';
import type { ScanMode } from '@/types/models';
```

- [ ] **Step 2: 修改 loadProjects 方法签名和实现**

```typescript
// src/stores/projectStore.ts - loadProjects action
/**
 * 加载项目数据（首次加载，显示加载状态）
 * 流式更新：每解析完一个项目就立即显示
 * 
 * @param _plugin 插件实例
 * @param scanMode 扫描模式
 * @param directories 目录配置（用于分组匹配）
 */
async loadProjects(_plugin: any, scanMode: ScanMode, directories: ProjectDirectory[]) {
  if (this.loading) return;
  
  const enabledDirs = directories.filter(d => d.enabled);
  console.log('[Task Assistant] Loading projects, scanMode:', scanMode, 'enabledDirs:', enabledDirs.length);
  
  this.loading = true;

  try {
    // 清空现有数据，避免重复
    this.projects = [];
    
    // 创建 parser，传入 scanMode
    const parser = new MarkdownParser(enabledDirs, scanMode);

    // 流式解析：每解析完一个项目就立即添加到 store
    await parser.parseAllProjectsWithCallback(_plugin, (project) => {
      // 全扫描模式下，需要根据路径匹配确定分组
      if (scanMode === 'full' && enabledDirs.length > 0 && project.path) {
        project.groupId = matchGroupId(project.path, enabledDirs);
      }
      this.projects.push(project);
      console.log('[Task Assistant] Project loaded:', project.name, 'groupId:', project.groupId);
    });

    this.currentDate = dayjs().format('YYYY-MM-DD');
    console.log('[Task Assistant] Total projects loaded:', this.projects.length);

    // 触发数据刷新完成事件
    eventBus.emit(Events.DATA_REFRESHED, { plugin: _plugin, items: this.items });
  } catch (error) {
    console.error('[Task Assistant] Failed to load projects:', error);
  } finally {
    this.loading = false;
  }
}
```

- [ ] **Step 3: 修改 refresh 方法**

```typescript
// src/stores/projectStore.ts - refresh action
/**
 * 刷新数据（后台刷新，不显示加载状态）
 * 支持定向刷新：只更新变更的项目
 * 
 * @param _plugin 插件实例
 * @param directories 目录配置
 * @param scanMode 扫描模式
 */
async refresh(_plugin: any, directories: ProjectDirectory[], scanMode: ScanMode) {
  // 如果正在刷新，跳过
  if (this.refreshing) return;

  this.refreshing = true;
  this.refreshKey++;

  const newDate = dayjs().format('YYYY-MM-DD');
  console.log('[Task Assistant] Refresh started, scanMode:', scanMode, 'date:', newDate);

  try {
    const dirtyDocIds = dirtyDocTracker.getDirtyDocs();

    if (dirtyDocIds.length > 0) {
      // 定向刷新：只更新指定文档
      await this.refreshDirtyDocs(_plugin, directories, dirtyDocIds, scanMode);
    } else {
      // 全量刷新
      await this.refreshFull(_plugin, directories, scanMode);
    }

    this.currentDate = newDate;
    eventBus.emit(Events.DATA_REFRESHED, { plugin: _plugin, items: this.items });
  } catch (error) {
    console.error('[Task Assistant] Refresh failed:', error);
    // 出错时回退到全量刷新
    await this.refreshFull(_plugin, directories, scanMode);
  } finally {
    this.refreshing = false;
  }
}

/**
 * 全量刷新
 */
private async refreshFull(_plugin: any, directories: ProjectDirectory[], scanMode: ScanMode): Promise<void> {
  console.log('[Task Assistant] Full refresh, scanMode:', scanMode);

  const enabledDirs = directories.filter(d => d.enabled);
  const parser = new MarkdownParser(enabledDirs, scanMode);

  // 清空现有数据
  this.projects = [];

  // 流式解析
  await parser.parseAllProjectsWithCallback(_plugin, (project) => {
    // 全扫描模式下匹配分组
    if (scanMode === 'full' && enabledDirs.length > 0 && project.path) {
      project.groupId = matchGroupId(project.path, enabledDirs);
    }
    this.projects.push(project);
  });

  dirtyDocTracker.clearAll();
}

/**
 * 定向刷新脏文档
 */
private async refreshDirtyDocs(
  _plugin: any,
  directories: ProjectDirectory[],
  dirtyDocIds: string[],
  scanMode: ScanMode
): Promise<void> {
  console.log('[Task Assistant] Refreshing dirty docs:', dirtyDocIds, 'scanMode:', scanMode);

  const enabledDirs = directories.filter(d => d.enabled);
  const parser = new MarkdownParser(enabledDirs, scanMode);

  // 只解析脏文档
  for (const docId of dirtyDocIds) {
    try {
      // 从现有项目获取 groupId 和 path
      const existingProject = this.projects.find(p => p.id === docId);
      let groupId = existingProject?.groupId;
      let path = existingProject?.path;
      
      // 如果没有 path，从思源查询
      if (!path) {
        try {
          path = await getHPathByID(docId);
        } catch (e) {
          console.warn('[Task Assistant] Failed to get hpath for doc:', docId);
          path = '';
        }
      }

      // 全扫描模式下需要重新匹配分组
      if (scanMode === 'full' && enabledDirs.length > 0 && path) {
        groupId = matchGroupId(path, enabledDirs);
      }

      const project = await parser.parseAndProcessSingleDocument(
        docId, '', groupId, path, _plugin
      );

      if (project) {
        this.updateProjectsIncrementally([project]);
        console.log('[Task Assistant] Project refreshed:', project.name);
      }
    } catch (error) {
      console.error(`[Task Assistant] Failed to refresh doc ${docId}:`, error);
    }
  }

  dirtyDocTracker.clearDirty(dirtyDocIds);
  console.log('[Task Assistant] Dirty docs refreshed:', dirtyDocIds.length);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/stores/projectStore.ts
git commit -m "feat: ProjectStore integrate scanMode and group matching"
```

---

## Task 7: 目录配置组件添加扫描模式 UI

**Files:**
- Modify: `src/components/settings/DirectoryConfigSection.vue`

**Context:** 添加扫描模式选择 UI，使用单选按钮组

- [ ] **Step 1: 导入 ScanMode 类型**

```typescript
// src/components/settings/DirectoryConfigSection.vue - script setup
import type { ProjectDirectory, ProjectGroup, ScanMode } from '@/types/models';
```

- [ ] **Step 2: 更新 props 和 emits**

```typescript
// src/components/settings/DirectoryConfigSection.vue - script setup
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
```

- [ ] **Step 3: 在模板中添加扫描模式选择**

```vue
<!-- src/components/settings/DirectoryConfigSection.vue - template -->
<template>
  <SySettingsSection icon="iconFolder" :title="t('settings').dirConfig.title" :description="t('settings').dirConfig.description">
    
    <!-- 新增：扫描模式选择 -->
    <div class="scan-mode-section">
      <div class="scan-mode-label">{{ t('settings').scanMode.label }}</div>
      <div class="scan-mode-options">
        <label class="scan-mode-option" :class="{ active: scanMode === 'full' }">
          <input 
            type="radio" 
            :checked="scanMode === 'full'"
            @change="$emit('update:scanMode', 'full')"
          />
          <span class="option-icon">🌐</span>
          <span class="option-content">
            <strong>{{ t('settings').scanMode.full.label }}</strong>
            <small>{{ t('settings').scanMode.full.description }}</small>
          </span>
        </label>
        
        <label class="scan-mode-option" :class="{ active: scanMode === 'directories' }">
          <input 
            type="radio" 
            :checked="scanMode === 'directories'"
            @change="$emit('update:scanMode', 'directories')"
          />
          <span class="option-icon">📁</span>
          <span class="option-content">
            <strong>{{ t('settings').scanMode.directories.label }}</strong>
            <small>{{ t('settings').scanMode.directories.description }}</small>
          </span>
        </label>
      </div>
      
      <!-- 提示信息 -->
      <div v-if="scanMode === 'full' && directories.length > 0" class="scan-mode-hint">
        <span class="hint-icon">💡</span>
        <span>{{ t('settings').scanMode.fullWithDirectoriesHint }}</span>
      </div>
    </div>
    
    <!-- 目录配置列表 -->
    <div class="sy-directory-list">
      <!-- ... 原有目录列表代码 ... -->
    </div>
    
    <SySettingsActionButton icon="iconAdd" :text="t('settings').projectDirectories.addButton" @click="addDir" />
  </SySettingsSection>
</template>
```

- [ ] **Step 4: 添加样式**

```vue
<!-- src/components/settings/DirectoryConfigSection.vue - style -->
<style scoped>
/* ... 原有样式 ... */

.scan-mode-section {
  margin-bottom: 20px;
  padding: 16px;
  background: var(--b3-theme-surface);
  border-radius: 8px;
}

.scan-mode-label {
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--b3-theme-on-surface);
}

.scan-mode-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.scan-mode-option {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.scan-mode-option:hover {
  background: var(--b3-theme-surface-light);
}

.scan-mode-option.active {
  border-color: var(--b3-theme-primary);
  background: var(--b3-theme-primary-light);
}

.scan-mode-option input[type="radio"] {
  margin-top: 2px;
}

.option-icon {
  font-size: 20px;
}

.option-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.option-content strong {
  font-size: 14px;
  color: var(--b3-theme-on-surface);
}

.option-content small {
  font-size: 12px;
  color: var(--b3-theme-on-surface-light);
}

.scan-mode-hint {
  margin-top: 12px;
  padding: 10px 12px;
  background: var(--b3-theme-primary-light);
  border-radius: 6px;
  font-size: 12px;
  color: var(--b3-theme-on-primary-light);
  display: flex;
  align-items: center;
  gap: 8px;
}

.hint-icon {
  font-size: 14px;
}
</style>
```

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/DirectoryConfigSection.vue
git commit -m "feat: add scan mode selection UI to DirectoryConfigSection"
```

---

## Task 8: SettingsDialog 传递 scanMode

**Files:**
- Modify: `src/components/settings/SettingsDialog.vue`

**Context:** 在 SettingsDialog 中管理 scanMode 状态并传递给 DirectoryConfigSection

- [ ] **Step 1: 找到 DirectoryConfigSection 的使用位置**

```vue
<!-- src/components/settings/SettingsDialog.vue -->
<!-- 找到 DirectoryConfigSection 组件的使用 -->
```

- [ ] **Step 2: 更新 DirectoryConfigSection 的绑定**

```vue
<!-- src/components/settings/SettingsDialog.vue - template -->
<DirectoryConfigSection
  v-model:directories="settings.directories"
  v-model:defaultGroup="settings.defaultGroup"
  v-model:scanMode="settings.scanMode"  <!-- 新增 -->
  :groups="settings.groups"
/>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/SettingsDialog.vue
git commit -m "feat: pass scanMode to DirectoryConfigSection in SettingsDialog"
```

---

## Task 9: index.ts 启动时传递 scanMode

**Files:**
- Modify: `src/index.ts`

**Context:** 在插件启动时获取 `scanMode` 并传递给 `loadProjects`

- [ ] **Step 1: 修改 onload 中的初始加载逻辑**

```typescript
// src/index.ts - onload 方法
async onload() {
  // ... 前面的初始化代码 ...

  // 首次加载项目数据（所有 Tab/Dock 共享这份数据）
  const settings = this.getSettings();
  const scanMode = settings.scanMode || 'full';  // 新增：获取 scanMode
  const enabledDirs = settings.directories.filter(d => d.enabled);
  
  console.log('[Task Assistant] Init loadProjects check:', {
    scanMode,
    directoriesCount: settings.directories.length,
    enabledDirsCount: enabledDirs.length,
    enabledDirs: enabledDirs.map(d => d.path)
  });
  
  console.log('[Task Assistant] Starting initial loadProjects...');
  const projectStore = useProjectStore(pinia);
  
  // 修改：传递 scanMode
  projectStore.loadProjects(this, scanMode, settings.directories).then(async () => {
    console.log('[Task Assistant] Initial loadProjects completed');
    // ...
  }).catch(err => {
    console.error('[Task Assistant] Failed to load projects on init:', err);
  });

  // ... 后续代码 ...
}
```

- [ ] **Step 2: 找到并修改其他调用 loadProjects/refresh 的地方**

搜索 `projectStore.refresh` 和 `projectStore.loadProjects` 的调用，更新参数：

```typescript
// 找到类似这样的调用，添加 scanMode 参数
await projectStore.refresh(this, this.getEnabledDirectories(), settings.scanMode);

// 如果 settings 不可用，从 getSettings() 获取
const settings = this.getSettings();
await projectStore.refresh(this, settings.directories, settings.scanMode);
```

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: pass scanMode when loading projects on plugin init"
```

---

## Task 10: 添加国际化翻译

**Files:**
- Modify: `src/i18n/zh.ts`
- Modify: `src/i18n/en.ts`

**Context:** 添加扫描模式相关的中文和英文翻译

- [ ] **Step 1: 添加中文翻译**

```typescript
// src/i18n/zh.ts - settings 对象内添加
{
  settings: {
    // ... 现有翻译
    
    // 新增：扫描模式
    scanMode: {
      label: '扫描范围',
      full: {
        label: '扫描整个工作空间',
        description: '所有包含任务标记的文档都会被扫描和展示'
      },
      directories: {
        label: '仅扫描配置目录',
        description: '只扫描下方配置的目录中的文档，适合大型工作空间'
      },
      fullWithDirectoriesHint: '当前为全局扫描模式，目录配置仅用于分组归类'
    }
  }
}
```

- [ ] **Step 2: 添加英文翻译**

```typescript
// src/i18n/en.ts - settings 对象内添加
{
  settings: {
    // ... existing translations
    
    // Add: scan mode
    scanMode: {
      label: 'Scan Scope',
      full: {
        label: 'Scan entire workspace',
        description: 'All documents containing task markers will be scanned and displayed'
      },
      directories: {
        label: 'Scan configured directories only',
        description: 'Only scan documents in configured directories below, suitable for large workspaces'
      },
      fullWithDirectoriesHint: 'Currently in global scan mode, directory config is only used for grouping'
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/i18n/zh.ts src/i18n/en.ts
git commit -m "feat: add i18n translations for scan mode"
```

---

## Task 11: 集成测试

**Files:**
- Manual testing in Siyuan Note environment

**Context:** 在思源笔记环境中测试完整功能

- [ ] **Step 1: 构建插件**

```bash
npm run build
```

Expected: Build succeeds with no errors

- [ ] **Step 2: 安装插件到思源笔记**

将构建产物复制到思源笔记插件目录，重启思源。

- [ ] **Step 3: 测试场景 1 - 新用户默认全扫描**

1. 清除插件数据（模拟新用户）
2. 启动插件
3. 观察控制台日志：`scanMode: 'full'`
4. 验证：所有包含任务的文档都被扫描

- [ ] **Step 4: 测试场景 2 - 配置目录后全扫描**

1. 在设置中添加一个目录配置（如 "工作"）
2. 保存设置
3. 刷新数据
4. 验证：所有文档仍被扫描
5. 验证："工作"目录下的项目正确显示分组

- [ ] **Step 5: 测试场景 3 - 切换到目录扫描模式**

1. 在设置中选择"仅扫描配置目录"
2. 保存设置
3. 刷新数据
4. 验证：只扫描配置目录下的文档

- [ ] **Step 6: 测试场景 4 - 最长路径优先匹配**

1. 配置两个目录：
   - `/工作` → group "work"
   - `/工作/重要` → group "important"
2. 创建文档 `/工作/重要/项目A`
3. 验证：该项目分组为 "important"（最长路径匹配）

- [ ] **Step 7: Commit**

```bash
git commit --allow-empty -m "test: manual testing completed"
```

---

## 总结

### 所有变更文件

| 文件 | 操作 | 状态 |
|------|------|------|
| `src/types/models.ts` | 添加 `ScanMode` 类型 | ⬜ |
| `src/utils/directoryUtils.ts` | 新建 `matchGroupId` | ⬜ |
| `src/utils/__tests__/directoryUtils.test.ts` | 新建单元测试 | ⬜ |
| `src/settings.ts` | 添加 `scanMode` 字段 | ⬜ |
| `src/stores/settingsStore.ts` | 添加 `scanMode` 状态 | ⬜ |
| `src/parser/markdownParser.ts` | 支持 `scanMode` | ⬜ |
| `src/stores/projectStore.ts` | 集成 `scanMode` | ⬜ |
| `src/components/settings/DirectoryConfigSection.vue` | 添加扫描模式 UI | ⬜ |
| `src/components/settings/SettingsDialog.vue` | 传递 `scanMode` | ⬜ |
| `src/index.ts` | 启动时传递 `scanMode` | ⬜ |
| `src/i18n/zh.ts` | 中文翻译 | ⬜ |
| `src/i18n/en.ts` | 英文翻译 | ⬜ |

### 关键设计决策

1. **默认全扫描** - 新用户不会丢失数据
2. **最长路径优先** - 精确匹配避免歧义
3. **独立工具函数** - `matchGroupId` 可复用、可测试
4. **向后兼容** - 升级用户数据无损
