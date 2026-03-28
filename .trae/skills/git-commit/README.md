# Git 提交技能

使用 AI 模型分析代码变更，智能生成符合 [Conventional Commits](https://www.conventionalcommits.org/) 规范的 Git 提交记录。

## 功能特性

- 🤖 **AI 智能分析**：AI 直接分析代码变更内容，理解修改意图
- 📝 **规范提交**：自动生成 `type(scope): description` 格式的提交信息
- 🎯 **交互确认**：生成后询问是否提交，支持修改后再提交
- 🔍 **完整检测**：检测暂存区、未暂存和未跟踪的文件变更

## 使用方法

### 触发方式

在 Trae 中使用以下方式触发：

```
/commit
/提交
git commit
提交代码
生成提交信息
```

### 工作流程

1. **获取变更** - 自动执行 `git diff` 获取所有变更文件
2. **AI 分析** - AI 分析变更内容，理解修改意图
3. **生成提交信息** - 输出符合规范的提交信息
4. **用户确认** - 提供三个选项：
   - ✅ 提交 - 直接执行 `git add -A && git commit`
   - 📝 修改 - 允许修改提交信息后提交
   - ❌ 取消 - 放弃本次提交

## 提交信息格式

```
<type>(<scope>): <description>
```

### 类型 (type)

| 类型 | 说明 |
|------|------|
| feat | 新功能 |
| fix | 修复问题 |
| docs | 文档更新 |
| style | 代码格式（空格、缩进等） |
| refactor | 重构 |
| perf | 性能优化 |
| test | 测试相关 |
| chore | 构建/配置/依赖 |
| revert | 回滚 |

### 作用域 (scope)

根据项目结构自动识别：

| 作用域 | 说明 |
|--------|------|
| parser | 解析器相关 |
| components | Vue 组件 |
| stores | Pinia 状态管理 |
| services | 服务层 |
| utils | 工具函数 |
| mcp | MCP 服务器 |
| settings | 设置配置 |
| i18n | 国际化 |
| test | 测试文件 |
| types | 类型定义 |
| styles | SCSS/CSS 样式 |
| build | 构建配置 |

### 示例输出

```
feat(parser): 添加日期解析功能

fix(utils): 修复日期计算错误

refactor(components): 重构 TodoSidebar 组件逻辑

docs(readme): 更新项目使用说明

test(stores): 添加 pomodoroStore 单元测试

chore(deps): 更新 dayjs 依赖版本
```

## 文件结构

```
.trae/skills/git-commit/
├── skill.yaml    # 技能配置文件
└── README.md     # 使用说明
```

## 注意事项

- 技能会自动执行 `git add -A` 添加所有变更
- 如果没有检测到变更，会提示错误
- 提交前会显示生成的提交信息供确认
- 支持破坏性变更标记（在类型后加 `!`）
