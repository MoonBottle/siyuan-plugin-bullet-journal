# 修正 README 文档链接为绝对路径

## 问题
README_zh_CN.md 和 README.md 中的文档链接目前使用相对路径，需要改为绝对路径。

## 当前链接（相对路径）

**README_zh_CN.md:**
- `[快速开始](./docs/user-guide/quick-start.md)`
- `[用户指南](./docs/user-guide/index.md)`
- `[数据格式](./docs/user-guide/data-format.md)`
- 等等...

**README.md:**
- `[Quick Start](./docs/en/user-guide/quick-start.md)`
- `[User Guide](./docs/en/user-guide/index.md)`
- 等等...

## 实施步骤

### Step 1: 修正 README_zh_CN.md 链接
将所有相对路径链接改为 GitHub 绝对路径：
- `./docs/user-guide/xxx.md` → `https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/xxx.md`

需要修改的链接：
1. 快速开始链接
2. 用户指南目录链接
3. 各个子文档链接
4. API 文档链接

### Step 2: 修正 README.md 链接
将所有相对路径链接改为 GitHub 绝对路径：
- `./docs/en/user-guide/xxx.md` → `https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/xxx.md`

需要修改的链接：
1. Quick Start 链接
2. User Guide 目录链接
3. 各个子文档链接
4. API Documentation 链接

## 预期结果
所有文档链接使用 GitHub 绝对路径，确保在任何地方查看 README 都能正确跳转。
