# 修复 npm run lint 问题 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 消除 `npm run lint` 输出的全部 11 个 errors 和 8 个 warnings，使 lint 退出码为 0

**当前状态（2026-06-01 运行结果）：**
- ❌ 11 errors
- ⚠️ 8 warnings
- 退出码：1
- 报告：10 errors 和 8 warnings 可通过 `--fix` 自动修复

**架构：** 优先使用 ESLint 的自动修复（`npm run lint:fix`）处理可机器修复的问题，剩余手工处理 `pnpm-workspace.yaml` 缺失配置项

**技术栈：** ESLint 10 (flat config)、@antfu/eslint-config、pnpm/yaml-enforce-settings

---

## Lint 问题清单

### Errors（11 个）

| # | 文件 | 行 | 规则 | 修复方式 |
|---|------|-----|------|----------|
| 1 | `pnpm-workspace.yaml` | 1:1 | `pnpm/yaml-enforce-settings` | 手动添加 `shellEmulator: true` |
| 2 | `pnpm-workspace.yaml` | 1:1 | `pnpm/yaml-enforce-settings` | 手动添加 `trustPolicy: "no-downgrade"` |
| 3 | `src/components/ai/ChatPanel.vue` | 216:28 | `import/no-duplicates` | --fix（合并导入） |
| 4 | `src/components/ai/ChatPanel.vue` | 217:31 | `import/no-duplicates` | --fix（合并导入） |
| 5 | `src/components/dialog/SkillEditDialog.vue` | 95:1 | `perfectionist/sort-imports` | --fix（按字母排序） |
| 6 | `src/components/dialog/SkillEditDialog.vue` | 95:8 | `object-curly-newline` | --fix（多行） |
| 7 | `src/components/dialog/SkillEditDialog.vue` | 95:25 | `object-curly-newline` | --fix（多行） |
| 8 | `src/components/dialog/SkillEditDialog.vue` | 96:1 | `perfectionist/sort-imports` | --fix |
| 9 | `src/components/dialog/SkillEditDialog.vue` | 101:1 | `perfectionist/sort-imports` | --fix |
| 10 | `src/components/dialog/SkillEditDialog.vue` | 412:56 | `format/prettier` | --fix（替换引号） |
| 11 | `src/components/settings/AiSkillConfigSection.vue` | 93:3 | `perfectionist/sort-named-imports` | --fix（按字母排序） |

### Warnings（8 个，全部为 `style/arrow-parens`）

| # | 文件 | 行 |
|---|------|----|
| 1 | `src/components/ai/ChatInput.vue` | 95 |
| 2 | `src/components/ai/ChatInput.vue` | 97 |
| 3 | `src/components/ai/ChatInput.vue` | 98 |
| 4 | `src/components/ai/ChatInput.vue` | 141 |
| 5 | `src/components/ai/ChatInput.vue` | 188 |
| 6 | `src/components/ai/ChatInput.vue` | 208 |
| 7 | `src/components/ai/ChatInput.vue` | 228 |
| 8 | `src/services/aiPromptService.ts` | 29 |

规则配置：`'style/arrow-parens': ['warn', 'always']`（单参数箭头函数也需加括号）

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `pnpm-workspace.yaml` | 修改 | 添加 `shellEmulator` 和 `trustPolicy` |
| `src/components/ai/ChatInput.vue` | 修改（自动） | 7 处 `s =>` 改写为 `(s) =>` |
| `src/components/ai/ChatPanel.vue` | 修改（自动） | 合并两次 `@/stores` 导入 |
| `src/components/dialog/SkillEditDialog.vue` | 修改（自动） | 排序 import、引号转换、对象换行 |
| `src/components/settings/AiSkillConfigSection.vue` | 修改（自动） | 排序 named imports |
| `src/services/aiPromptService.ts` | 修改（自动） | 1 处 `s =>` 改写为 `(s) =>` |

---

## 任务 1：运行 ESLint 自动修复

**操作：** 在仓库根目录执行 `npm run lint:fix`，让 ESLint 修复可自动处理的所有问题（10 个 errors + 8 个 warnings）

- [ ] **步骤 1：备份当前状态（可选）**

```powershell
git status
```

预期：记录未提交的修改，便于差异对比

- [ ] **步骤 2：执行 lint:fix**

```powershell
npm run lint:fix
```

预期：
- 输出应用了 18 处修复
- 退出码为 0
- 修改的文件包括：
  - `src/components/ai/ChatInput.vue`
  - `src/components/ai/ChatPanel.vue`
  - `src/components/dialog/SkillEditDialog.vue`
  - `src/components/settings/AiSkillConfigSection.vue`
  - `src/services/aiPromptService.ts`

- [ ] **步骤 3：查看修改后的差异**

```powershell
git diff --stat
```

预期：约 5 个文件被修改

- [ ] **步骤 4：再次运行 lint 确认剩余问题**

```powershell
npm run lint 2>&1 | Tee-Object -FilePath .lint-tmp.log
```

预期：仅剩 `pnpm-workspace.yaml` 的 2 个 errors，其他全部消失

---

## 任务 2：修复 pnpm-workspace.yaml 缺失设置

**文件：**
- 修改：`pnpm-workspace.yaml`

**背景：** `pnpm/yaml-enforce-settings` 规则要求 pnpm 10+ 显式声明 `shellEmulator` 和 `trustPolicy`，避免静默使用不安全默认值。

- [ ] **步骤 1：读取当前 pnpm-workspace.yaml**

读取 `pnpm-workspace.yaml` 确认现有内容（目前仅有 `allowBuilds:` 节）

- [ ] **步骤 2：添加缺失的 pnpm 顶层设置**

在 `allowBuilds:` 之前添加两个键：

```yaml
shellEmulator: true
trustPolicy: "no-downgrade"

allowBuilds:
  '@google/genai': set this to true or false
  '@parcel/watcher': set this to true or false
  core-js: set this to true or false
  openclaw: set this to true or false
  protobufjs: set this to true or false
  tree-sitter-bash: set this to true or false
```

**注意：**
- `shellEmulator: true` 启用 pnpm 的 shell 模拟器（避免 Windows 上 `&&` 链接命令时的兼容问题）
- `trustPolicy: "no-downgrade"` 防止依赖被静默降级到不信任的版本

- [ ] **步骤 3：验证 pnpm install 仍正常工作（可选但推荐）**

```powershell
pnpm install --frozen-lockfile
```

预期：依赖安装成功，lockfile 无变化

- [ ] **步骤 4：运行 lint 确认 pnpm 错误已消除**

```powershell
npm run lint 2>&1 | Select-String "pnpm-workspace"
```

预期：无输出（pnpm-workspace.yaml 已无错误）

---

## 任务 3：最终验证

- [ ] **步骤 1：运行完整 lint 检查**

```powershell
npm run lint 2>&1 | Tee-Object -FilePath .lint-final.log
Get-Content .lint-final.log -Tail 5
```

预期输出末尾类似：
```
✖ 0 problems (0 errors, 0 warnings)
```
且退出码为 0

- [ ] **步骤 2：运行测试套件验证无回归**

```powershell
npm run test 2>&1 | Select-String -Pattern "(Test Files|Tests )"
```

预期：所有测试通过，测试数与修复前一致

- [ ] **步骤 3：运行 TypeScript 类型检查**

```powershell
npm run typecheck
```

预期：tsc 退出码为 0，无新增类型错误

- [ ] **步骤 4：清理临时文件**

```powershell
Remove-Item .lint-tmp.log, .lint-final.log -ErrorAction SilentlyContinue
```

---

## 任务 4：提交修改

- [ ] **步骤 1：查看待提交内容**

```powershell
git status
git diff --stat
```

预期：6 个文件修改
- `pnpm-workspace.yaml`
- `src/components/ai/ChatInput.vue`
- `src/components/ai/ChatPanel.vue`
- `src/components/dialog/SkillEditDialog.vue`
- `src/components/settings/AiSkillConfigSection.vue`
- `src/services/aiPromptService.ts`

- [ ] **步骤 2：创建 commit**

使用中文 commit message 规范：

```powershell
git add pnpm-workspace.yaml src/components/ai/ChatInput.vue src/components/ai/ChatPanel.vue src/components/dialog/SkillEditDialog.vue src/components/settings/AiSkillConfigSection.vue src/services/aiPromptService.ts
git commit -m "fix: 解决 npm run lint 全部 errors 和 warnings

- 合并 ChatPanel.vue 中重复的 @/stores 导入
- 修复 SkillEditDialog.vue 的 import 排序与对象换行
- 修复 SkillEditDialog.vue 中 currentColor 引号风格
- 修复 AiSkillConfigSection.vue 的 named imports 排序
- 在 ChatInput.vue 和 aiPromptService.ts 中为单参数箭头函数加括号
- 在 pnpm-workspace.yaml 中添加 shellEmulator 和 trustPolicy 配置"
```

---

## 风险与注意事项

1. **自动修复可能改变 import 顺序：** perfectionist/sort-imports 是基于字母序排序，团队成员可能不习惯，但与现有 eslint 规则保持一致
2. **单参数箭头函数加括号：** 7 处 `s =>` → `(s) =>` 仅风格变更，不影响运行时行为
3. **pnpm 配置修改：** `shellEmulator: true` 是 pnpm 10+ 的安全默认值；`trustPolicy: "no-downgrade"` 可能导致 CI 上对新增不信任包的依赖失败，但当前 lockfile 已固定，不影响现有依赖
4. **若 lint:fix 后仍有 pnpm 错误，** 检查 `eslint.config.mjs` 是否将 `pnpm-workspace.yaml` 错误地加入了 `ignores`
