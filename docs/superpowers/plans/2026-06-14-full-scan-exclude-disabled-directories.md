# 全库扫描模式下过滤未启用目录 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在全库扫描模式下，排除未启用目录路径下的文档，使 `enabled` 字段在全库扫描时也生效

**架构：** 新增 `isExcludedByDisabledDirectories` 工具函数，在 `MarkdownParser` 和 MCP `dataLoader` 的全库扫描分支中调用该函数过滤文档。MarkdownParser 构造函数需保留完整目录列表（含未启用的）以供过滤使用。

**技术栈：** TypeScript, Vitest

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/utils/directoryUtils.ts` | 修改 | 新增 `isExcludedByDisabledDirectories` 函数 |
| `test/utils/directoryUtils.test.ts` | 修改 | 新增 `isExcludedByDisabledDirectories` 测试用例 |
| `src/parser/markdownParser.ts` | 修改 | 构造函数保留完整目录列表，全库扫描分支应用过滤 |
| `src/mcp/dataLoader.ts` | 修改 | 全库扫描分支应用过滤 |
| `src/i18n/zh_CN.json` | 修改 | 更新 `fullScanDirectoriesHint` 文案 |
| `src/i18n/en_US.json` | 修改 | 更新 `fullScanDirectoriesHint` 文案 |
| `src/components/settings/DirectoryConfigSection.vue` | 无需修改 | 已使用 i18n key，文案随 i18n 更新自动生效 |
| `src/mobile/drawers/settings/MobileDirectoryConfig.vue` | 无需修改 | 已使用 i18n key，文案随 i18n 更新自动生效 |

---

### 任务 1：新增 `isExcludedByDisabledDirectories` 工具函数及测试

**文件：**
- 修改：`src/utils/directoryUtils.ts`
- 测试：`test/utils/directoryUtils.test.ts`

- [ ] **步骤 1：编写失败的测试**

在 `test/utils/directoryUtils.test.ts` 中新增测试：

```typescript
import { isExcludedByDisabledDirectories } from '@/utils/directoryUtils'

describe('isExcludedByDisabledDirectories', () => {
  const createDir = (path: string, enabled = true): ProjectDirectory => ({
    id: `dir-${path}`,
    path,
    enabled,
  })

  it('should return false when no directories provided', () => {
    expect(isExcludedByDisabledDirectories('工作/项目A', [])).toBe(false)
  })

  it('should return false when all directories are enabled', () => {
    const dirs = [createDir('工作', true), createDir('学习', true)]
    expect(isExcludedByDisabledDirectories('工作/项目A', dirs)).toBe(false)
  })

  it('should return true when doc path matches a disabled directory', () => {
    const dirs = [createDir('归档', false)]
    expect(isExcludedByDisabledDirectories('归档/2024/项目A', dirs)).toBe(true)
  })

  it('should return false when doc path matches only enabled directories', () => {
    const dirs = [createDir('工作', true)]
    expect(isExcludedByDisabledDirectories('工作/项目A', dirs)).toBe(false)
  })

  it('should use longest path first matching', () => {
    const dirs = [
      createDir('工作', true),
      createDir('工作/归档', false),
    ]
    // 路径匹配更长的未启用目录，应排除
    expect(isExcludedByDisabledDirectories('工作/归档/项目A', dirs)).toBe(true)
    // 路径匹配启用的目录，不排除
    expect(isExcludedByDisabledDirectories('工作/进行中/项目A', dirs)).toBe(false)
  })

  it('should return false when doc path does not match any disabled directory', () => {
    const dirs = [createDir('归档', false)]
    expect(isExcludedByDisabledDirectories('工作/项目A', dirs)).toBe(false)
  })

  it('should handle multiple disabled directories', () => {
    const dirs = [
      createDir('归档', false),
      createDir('模板', false),
      createDir('工作', true),
    ]
    expect(isExcludedByDisabledDirectories('归档/2024/项目A', dirs)).toBe(true)
    expect(isExcludedByDisabledDirectories('模板/日报', dirs)).toBe(true)
    expect(isExcludedByDisabledDirectories('工作/项目A', dirs)).toBe(false)
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/utils/directoryUtils.test.ts`
预期：FAIL，报错 `isExcludedByDisabledDirectories is not exported`

- [ ] **步骤 3：编写实现代码**

在 `src/utils/directoryUtils.ts` 末尾新增：

```typescript
/**
 * 判断文档路径是否被未启用的目录排除
 * 在全库扫描模式下，未启用目录路径下的文档将被排除
 *
 * @param docPath 文档路径（hpath）
 * @param directories 所有目录配置（含启用和未启用的）
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

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/utils/directoryUtils.test.ts`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/utils/directoryUtils.ts test/utils/directoryUtils.test.ts
git commit -m "feat: 新增 isExcludedByDisabledDirectories 工具函数`n`n在全库扫描模式下，未启用目录路径下的文档将被排除。`n复用现有 ProjectDirectory.enabled 字段，黑名单模式过滤。"
```

---

### 任务 2：MarkdownParser 构造函数改造及全库扫描过滤

**文件：**
- 修改：`src/parser/markdownParser.ts`

- [ ] **步骤 1：修改构造函数，保留完整目录列表**

将 `markdownParser.ts` 第 24-31 行：

```typescript
export class MarkdownParser {
  private directories: ProjectDirectory[]
  private scanMode: ScanMode

  constructor(directories: ProjectDirectory[], scanMode: ScanMode = 'full') {
    this.directories = directories?.filter((d) => d.enabled) || []
    this.scanMode = scanMode
  }
```

改为：

```typescript
export class MarkdownParser {
  private directories: ProjectDirectory[]
  private allDirectories: ProjectDirectory[]
  private scanMode: ScanMode

  constructor(directories: ProjectDirectory[], scanMode: ScanMode = 'full') {
    this.allDirectories = directories || []
    this.directories = directories?.filter((d) => d.enabled) || []
    this.scanMode = scanMode
  }
```

- [ ] **步骤 2：添加 import**

在 `markdownParser.ts` 顶部 import 区域（约第 6-12 行），新增：

```typescript
import { isExcludedByDisabledDirectories } from '@/utils/directoryUtils'
```

- [ ] **步骤 3：在 `parseAllProjectsWithCallback` 全库扫描分支添加过滤**

将 `parseAllProjectsWithCallback` 方法中全库扫描分支（约第 276-296 行）：

```typescript
if (this.scanMode === 'full') {
  // 全扫描模式
  const docs = await this.getAllDocs()
  for (const doc of docs) {
    if (processedDocIds.has(doc.id)) continue
    processedDocIds.add(doc.id)
    try {
      const project = await this.parseAndProcessSingleDocument(
```

改为：

```typescript
if (this.scanMode === 'full') {
  // 全扫描模式
  const docs = await this.getAllDocs()
  for (const doc of docs) {
    if (processedDocIds.has(doc.id)) continue
    processedDocIds.add(doc.id)
    // 排除未启用目录下的文档
    if (isExcludedByDisabledDirectories(doc.path, this.allDirectories)) continue
    try {
      const project = await this.parseAndProcessSingleDocument(
```

- [ ] **步骤 4：在 `parseAllProjects` 全库扫描分支添加过滤**

将 `parseAllProjects` 方法中全库扫描分支（约第 41-60 行）：

```typescript
if (this.scanMode === 'full') {
  // 目录配置为空：扫描所有文档
  const docs = await this.getAllDocs()
  for (const doc of docs) {
    if (processedDocIds.has(doc.id)) continue
    processedDocIds.add(doc.id)
    try {
      const project = await this.parseProjectDocument(
```

改为：

```typescript
if (this.scanMode === 'full') {
  // 目录配置为空：扫描所有文档
  const docs = await this.getAllDocs()
  for (const doc of docs) {
    if (processedDocIds.has(doc.id)) continue
    processedDocIds.add(doc.id)
    // 排除未启用目录下的文档
    if (isExcludedByDisabledDirectories(doc.path, this.allDirectories)) continue
    try {
      const project = await this.parseProjectDocument(
```

- [ ] **步骤 5：运行测试验证**

运行：`npx vitest run`
预期：PASS

- [ ] **步骤 6：Commit**

```bash
git add src/parser/markdownParser.ts
git commit -m "feat: MarkdownParser 全库扫描模式下排除未启用目录`n`n构造函数保留完整目录列表(allDirectories)，`n全库扫描时调用 isExcludedByDisabledDirectories 过滤。"
```

---

### 任务 3：MCP 端 dataLoader 同步修改

**文件：**
- 修改：`src/mcp/dataLoader.ts`

- [ ] **步骤 1：添加 import**

在 `dataLoader.ts` 第 7 行 `import { matchGroupId } from '@/utils/directoryUtils'` 改为：

```typescript
import { isExcludedByDisabledDirectories, matchGroupId } from '@/utils/directoryUtils'
```

- [ ] **步骤 2：在全库扫描分支添加过滤**

将 `loadProjectsAndItems` 函数中全库扫描分支（约第 100-116 行）：

```typescript
if (useFullScan) {
    const docs = await getAllDocs()
    console.error('[Task Assistant MCP] Processing', docs.length, 'docs in full scan mode')
    for (const doc of docs) {
      if (processedDocIds.has(doc.id)) continue
      processedDocIds.add(doc.id)
      const kramdown = await client.getBlockKramdown(doc.id)
```

改为：

```typescript
if (useFullScan) {
    const docs = await getAllDocs()
    console.error('[Task Assistant MCP] Processing', docs.length, 'docs in full scan mode')
    for (const doc of docs) {
      if (processedDocIds.has(doc.id)) continue
      processedDocIds.add(doc.id)
      // 排除未启用目录下的文档
      if (isExcludedByDisabledDirectories(doc.path || '', directories)) continue
      const kramdown = await client.getBlockKramdown(doc.id)
```

注意：这里使用 `directories`（完整列表，含未启用的），而非 `enabledDirs`。

- [ ] **步骤 3：运行测试验证**

运行：`npx vitest run`
预期：PASS

- [ ] **步骤 4：Commit**

```bash
git add src/mcp/dataLoader.ts
git commit -m "feat: MCP dataLoader 全库扫描模式下排除未启用目录`n`n与插件端 MarkdownParser 保持一致，`n调用 isExcludedByDisabledDirectories 过滤文档。"
```

---

### 任务 4：更新 i18n 文案

**文件：**
- 修改：`src/i18n/zh_CN.json`
- 修改：`src/i18n/en_US.json`

- [ ] **步骤 1：更新中文 i18n**

在 `src/i18n/zh_CN.json` 中，将第 392 行：

```json
"fullScanDirectoriesHint": "以下目录配置仅用于分组归类"
```

改为：

```json
"fullScanDirectoriesHint": "以下目录配置用于分组归类和过滤。未启用的目录在全库扫描时将被排除"
```

- [ ] **步骤 2：更新英文 i18n**

在 `src/i18n/en_US.json` 中，将第 392 行：

```json
"fullScanDirectoriesHint": "Directory configuration is only used for grouping in full scan mode"
```

改为：

```json
"fullScanDirectoriesHint": "Directory configuration is used for grouping and filtering. Disabled directories are excluded in full scan mode"
```

- [ ] **步骤 3：运行 lint 验证**

运行：`npm run lint`
预期：PASS

- [ ] **步骤 4：Commit**

```bash
git add src/i18n/zh_CN.json src/i18n/en_US.json
git commit -m "docs: 更新全库扫描目录配置提示文案`n`n提示用户目录配置在全库扫描模式下同时用于分组归类和过滤，`n未启用的目录将被排除。"
```

---

### 任务 5：最终验证

- [ ] **步骤 1：运行完整测试套件**

运行：`npm run test`
预期：PASS

- [ ] **步骤 2：运行 lint**

运行：`npm run lint`
预期：PASS

- [ ] **步骤 3：运行 typecheck**

运行：`npm run typecheck`
预期：PASS
