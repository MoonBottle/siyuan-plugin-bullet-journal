# 全库扫描模式下过滤未启用目录 — 设计文档

**日期**: 2026-06-14
**状态**: 已批准

## 背景

项目有两种扫描模式：`full`（全库扫描）和 `directories`（指定目录扫描）。在全库扫描模式下，目录配置（`ProjectDirectory`）仅用于分组归类，不过滤文档。用户希望在全库扫描模式下，未启用的目录路径下的文档也被排除。

## 需求

- **过滤粒度**: 目录路径级别
- **过滤方式**: 复用现有 `ProjectDirectory.enabled` 字段，在全库扫描模式下也生效
- **过滤语义**: 黑名单模式——全库扫描时排除未启用目录路径下的文档
- **空配置行为**: 无目录配置或所有目录都启用时，全库扫描行为不变

## 方案

**应用层过滤**: SQL 查询不变，在获取文档列表后，通过路径前缀匹配过滤掉未启用目录下的文档。

选择理由：
1. 全库扫描上限仅 1000 篇，SQL 层过滤性能收益有限
2. 路径匹配精确性更重要，应用层可复用已有逻辑
3. 改动最小、风险最低

## 设计

### 1. 新增工具函数 `isExcludedByDisabledDirectories`

**文件**: `src/utils/directoryUtils.ts`

```typescript
/**
 * 判断文档路径是否被未启用的目录排除
 * @param docPath 文档的 hpath
 * @param directories 所有目录配置
 * @returns true 表示该文档应被排除
 */
export function isExcludedByDisabledDirectories(
  docPath: string,
  directories: ProjectDirectory[],
): boolean {
  const disabledDirs = directories.filter(d => !d.enabled)
  if (disabledDirs.length === 0) return false

  // 按路径长度降序排序，确保最长路径优先匹配
  const sorted = [...disabledDirs].sort((a, b) => b.path.length - a.path.length)
  return sorted.some(d => docPath.startsWith(d.path))
}
```

### 2. MarkdownParser 构造函数改造

**文件**: `src/parser/markdownParser.ts`

新增 `allDirectories` 属性保留完整列表：

```typescript
private allDirectories: ProjectDirectory[]

constructor(directories: ProjectDirectory[], scanMode: ScanMode = 'full') {
  this.allDirectories = directories || []
  this.directories = directories?.filter((d) => d.enabled) || []
  this.scanMode = scanMode
}
```

### 3. 全库扫描分支应用过滤

**文件**: `src/parser/markdownParser.ts` — `parseAllProjectsWithCallback()`

```typescript
if (this.scanMode === 'full') {
  const docs = await this.getAllDocs()
  for (const doc of docs) {
    // 新增：排除未启用目录下的文档
    if (isExcludedByDisabledDirectories(doc.path, this.allDirectories)) {
      continue
    }
    const project = await this.parseAndProcessSingleDocument(...)
    if (project) onProjectReady(project)
  }
}
```

### 4. MCP 端同步修改

**文件**: `src/mcp/dataLoader.ts` — `loadProjectsAndItems()`

```typescript
if (useFullScan) {
  const docs = await getAllDocs()
  for (const doc of docs) {
    // 新增：排除未启用目录下的文档
    if (isExcludedByDisabledDirectories(doc.path || '', directories)) {
      continue
    }
    // ... 后续解析逻辑不变
  }
}
```

### 5. 设置界面文案调整

**文件**: `src/components/settings/DirectoryConfigSection.vue`

全库扫描模式下的提示从"以下目录配置仅用于分组归类"改为"以下目录配置用于分组归类和过滤。未启用的目录在全库扫描时将被排除。"

**文件**: `src/mobile/drawers/settings/MobileDirectoryConfig.vue`

同步修改提示文案。

**i18n**: 新增或修改对应的 i18n key。

### 6. 不需要改动的部分

- `ProjectDirectory` 数据结构不变
- `settingsStore` 不变
- `index.ts` 中 `loadProjects` 的调用不变
- 增量刷新逻辑不变

## 边界情况

| 场景 | 预期行为 |
|------|---------|
| 无目录配置 | 全库扫描行为不变 |
| 所有目录都启用 | 全库扫描行为不变 |
| 所有目录都未启用 | 排除已配置路径下的文档 |
| 部分目录未启用 | 排除未启用路径下的文档 |
| 文档路径同时匹配启用和未启用目录 | 按最长路径匹配决定 |
| 目录扫描模式 | 行为不变 |

## 测试策略

1. **单元测试**: 为 `isExcludedByDisabledDirectories` 编写测试，覆盖所有边界情况
2. **集成测试**: 验证 `MarkdownParser` 在全库扫描模式下正确排除
3. **MCP 端测试**: 验证 `dataLoader.ts` 的过滤逻辑
