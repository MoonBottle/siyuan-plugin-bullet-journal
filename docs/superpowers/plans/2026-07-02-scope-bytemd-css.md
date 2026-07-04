# 隔离 SkillEditDialog 第三方 CSS 全局泄漏 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 通过自定义 Vite 插件给 bytemd/index.css、github-markdown-light.css、highlight.js/styles/github.css 三个文件的选择器加 `.ta-skill-edit-dialog` 前缀，避免 `.hljs` 等全局样式泄漏到思源主应用。

**架构：** 在 vite.config.ts 中新增 `scopeBytemdCss()` 插件，`enforce: 'pre'` 的 `transform` 钩子拦截目标 CSS 文件，用 `postcss-prefix-selector` 给所有选择器加前缀。与现有 `removeGanttFontFace`、`piProviderOptimizer` 模式一致。

**技术栈：** Vite 8、postcss-prefix-selector、TypeScript

**规格说明：** [docs/superpowers/specs/2026-07-02-scope-bytemd-css-design.md](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/docs/superpowers/specs/2026-07-02-scope-bytemd-css-design.md)

---

## 文件结构

### 需要修改的文件

1. **`package.json`** —— 新增 devDependency `postcss-prefix-selector`
2. **`vite.config.ts`** —— 新增 `scopeBytemdCss()` 插件函数，注册到 `plugins` 数组

### 不需要修改的文件

- `src/components/dialog/SkillEditDialog.vue` —— import 语句和 `<style>` 块均不变（规格第 3 节已验证）

---

### 任务 1：安装 postcss-prefix-selector 依赖

**文件：**
- 修改：`package.json`（devDependencies）
- 修改：`package-lock.json`（由 npm 自动更新）

- [ ] **步骤 1：安装依赖**

运行：
```bash
pnpm add -D postcss-prefix-selector
```

预期：`package.json` 的 `devDependencies` 中新增 `"postcss-prefix-selector"`，`pnpm-lock.yaml` 更新。

- [ ] **步骤 2：验证依赖已安装**

运行：
```bash
node -e "require('postcss-prefix-selector'); console.log('OK')"
```

预期：输出 `OK`，无报错。

- [ ] **步骤 3：Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: 新增 postcss-prefix-selector 开发依赖用于 CSS 选择器前缀化"
```

---

### 任务 2：在 vite.config.ts 中实现 scopeBytemdCss 插件

**文件：**
- 修改：`vite.config.ts`（新增 import 语句、新增 `scopeBytemdCss()` 函数、注册到 `plugins` 数组）

**参考：** 现有 `removeGanttFontFace()` 函数位于 [vite.config.ts:22-36](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/vite.config.ts#L22-L36)，遵循相同的 `enforce: 'pre'` + `transform` 模式。

- [ ] **步骤 1：新增 import 语句**

在 [vite.config.ts](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/vite.config.ts) 顶部 import 区域（第 1-13 行的 `import` 语句之后）新增：

```ts
import postcss from 'postcss'
import prefixSelector from 'postcss-prefix-selector'
```

注意：这两行应放在现有 import 语句中，按字母序或按现有风格排列。`postcss` 是 Vite 的内置依赖，无需额外安装；`postcss-prefix-selector` 在任务 1 中已安装。

- [ ] **步骤 2：新增 scopeBytemdCss() 函数**

在 [vite.config.ts](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/vite.config.ts) 中 `piProviderOptimizer()` 函数之后（第 77 行之后、`export default defineConfig` 之前）新增：

```ts
function scopeBytemdCss() {
  const TARGET_FILES = [
    'bytemd/dist/index.css',
    'github-markdown-css/github-markdown-light.css',
    'highlight.js/styles/github.css',
  ]
  const PREFIX = '.ta-skill-edit-dialog'

  return {
    name: 'scope-bytemd-css',
    enforce: 'pre',
    transform(code: string, id: string) {
      if (!id.endsWith('.css'))
        return null
      if (!TARGET_FILES.some(f => id.includes(f)))
        return null

      const result = postcss()
        .use(prefixSelector({ prefix: PREFIX }))
        .process(code, { from: undefined })
        .css

      return { code: result, map: null }
    },
  }
}
```

**关键点：**
- `TARGET_FILES` 数组使用相对路径片段，通过 `id.includes()` 匹配，兼容 pnpm 的 `.pnpm/highlight.js@11.11.1/...` 路径结构
- `PREFIX` 为 `.ta-skill-edit-dialog`，与 SkillEditDialog.vue 模板根元素的 class 一致
- `enforce: 'pre'` 确保在 Vite 内置 CSS 处理之前执行
- `postcss().process(code, { from: undefined })` —— `from: undefined` 避免生成 source map 路径警告

- [ ] **步骤 3：注册插件到 plugins 数组**

在 [vite.config.ts](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/vite.config.ts) 的 `plugins` 数组中（第 134-179 行），将 `scopeBytemdCss()` 添加到 `removeGanttFontFace()` 和 `piProviderOptimizer()` 之后、`vue()` 之前。

修改前（第 134-137 行）：
```ts
    plugins: [
      removeGanttFontFace(),
      piProviderOptimizer(),
      vue(),
```

修改后：
```ts
    plugins: [
      removeGanttFontFace(),
      piProviderOptimizer(),
      scopeBytemdCss(),
      vue(),
```

- [ ] **步骤 4：运行 typecheck 验证类型正确**

运行：
```bash
npm run typecheck
```

预期：无报错。`postcss` 和 `postcss-prefix-selector` 的类型声明应能被 TypeScript 正确解析。

- [ ] **步骤 5：运行 lint 验证代码风格**

运行：
```bash
npm run lint
```

预期：无报错。如有格式问题，运行 `npm run lint:fix` 自动修复。

- [ ] **步骤 6：Commit**

```bash
git add vite.config.ts
git commit -m "feat: 新增 scopeBytemdCss Vite 插件隔离第三方 CSS 全局样式`n`n给 bytemd/index.css、github-markdown-light.css、`nhighlight.js/styles/github.css 三个文件的选择器加 .ta-skill-edit-dialog 前缀，`n避免 .hljs 等全局样式泄漏到思源主应用。"
```

---

### 任务 3：构建验证与 CSS 输出检查

**文件：**
- 验证：`dist/index.css`（构建产物）

- [ ] **步骤 1：执行生产构建**

运行：
```bash
npm run build
```

预期：构建成功，无报错。`dist/index.css` 文件生成。

注意：`npm run build` 会先执行 `typecheck` 和 `lint`，再执行 vite build。如果前面任务已通过这些检查，此步应顺利。

- [ ] **步骤 2：验证 .hljs 不再作为全局样式存在**

运行：
```powershell
Select-String -Path "dist\index.css" -Pattern "^\.hljs\s*\{" -SimpleMatch:$false
```

预期：无匹配输出（或匹配到的行都以 `.ta-skill-edit-dialog` 开头）。

说明：检查是否存在未前缀化的全局 `.hljs {` 规则。前缀化后应为 `.ta-skill-edit-dialog .hljs {`。

- [ ] **步骤 3：验证前缀化后的规则存在**

运行：
```powershell
Select-String -Path "dist\index.css" -Pattern "\.ta-skill-edit-dialog \.hljs"
```

预期：有匹配输出，确认前缀化后的 `.ta-skill-edit-dialog .hljs` 规则存在。

- [ ] **步骤 4：验证 .markdown-body 也被前缀化**

运行：
```powershell
Select-String -Path "dist\index.css" -Pattern "^\.markdown-body\s*\{" -SimpleMatch:$false
```

预期：无匹配输出（不应存在未前缀化的全局 `.markdown-body {`）。

运行：
```powershell
Select-String -Path "dist\index.css" -Pattern "\.ta-skill-edit-dialog \.markdown-body"
```

预期：有匹配输出，确认前缀化后的规则存在。

- [ ] **步骤 5：验证 .bytemd 也被前缀化**

运行：
```powershell
Select-String -Path "dist\index.css" -Pattern "\.ta-skill-edit-dialog \.bytemd"
```

预期：有匹配输出，确认 bytemd 的选择器也被前缀化。

- [ ] **步骤 6：验证 @keyframes 未被前缀化（动画名保持不变）**

运行：
```powershell
Select-String -Path "dist\index.css" -Pattern "@keyframes"
```

预期：有匹配输出，且 `@keyframes` 后的动画名是原始名称（不是 `.ta-skill-edit-dialog @keyframes`）。`postcss-prefix-selector` 会跳过 `@keyframes` 规则。

---

### 任务 4：运行时验证（手动）

**说明：** 此任务为手动验证，无法自动化。需要在思源中实际加载插件并检查。

- [ ] **步骤 1：将构建产物部署到思源**

如果已配置 `VITE_SIYUAN_WORKSPACE_PATH`，运行 dev watch 模式：
```bash
npm run dev
```

否则手动将 `dist/` 目录复制到思源插件目录，或使用 `npm run build` 后安装 `package.zip`。

- [ ] **步骤 2：验证 SkillEditDialog 编辑器/预览渲染正常**

在思源中打开任务助手的 AI 技能设置，新建或编辑一个技能：
- 确认 bytemd 编辑器正常显示（工具栏、编辑区、预览区）
- 确认代码块高亮正常（语法着色可见）
- 确认 markdown 预览样式正常（标题、列表、表格、代码块）
- 确认 SiYuan 主题变量覆盖生效（使用思源主题色，非纯白背景）

- [ ] **步骤 3：验证思源主应用代码块不受影响**

在思源中打开任意非 SkillEditDialog 的文档，检查代码块：
- 确认代码块配色使用思源原生主题（非 github 主题的 `#333`/`#f8f8f8`）
- 确认没有 `.hljs { background: #f8f8f8 }` 的灰色背景泄漏
- 确认代码块字体、颜色与安装插件前一致

- [ ] **步骤 4：运行现有测试确保无回归**

运行：
```bash
npm run test
```

预期：所有现有测试通过（无回归）。

---

## 自检

### 规格覆盖度

| 规格需求 | 对应任务 |
|---------|---------|
| 新增 `postcss-prefix-selector` devDependency | 任务 1 |
| 新增 `scopeBytemdCss()` Vite 插件 | 任务 2 |
| 插件注册到 `plugins` 数组，位于 `vue()` 之前 | 任务 2 步骤 3 |
| 用 `postcss-prefix-selector` 处理选择器前缀化 | 任务 2 步骤 2 |
| 精确匹配 3 个目标文件 | 任务 2 步骤 2（TARGET_FILES） |
| `@keyframes`/`@media` 正确处理 | 任务 3 步骤 6（验证） |
| 现有 `<style>` 块无需修改 | 无需任务（规格已论证） |
| 构建验证 | 任务 3 步骤 1 |
| CSS 输出检查（.hljs/.markdown-body/.bytemd） | 任务 3 步骤 2-5 |
| lint/typecheck 通过 | 任务 2 步骤 4-5 |
| 运行时验证 | 任务 4 |
| 不新增 vitest 测试 | 无测试任务（符合规格） |

无遗漏。

### 占位符扫描

无 TODO、待定、模糊描述。所有步骤包含具体命令和预期输出。

### 类型一致性

- `scopeBytemdCss()` 函数签名与现有 `removeGanttFontFace()`、`piProviderOptimizer()` 一致：返回 `{ name, enforce, transform }` 对象
- `transform(code: string, id: string)` 参数类型与 Vite 插件接口一致
- `postcss().process(code, { from: undefined }).css` 返回 string，与 `{ code: result, map: null }` 的 `code` 字段类型匹配

无类型不一致。
