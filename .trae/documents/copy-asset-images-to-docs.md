# 复制 asset 图片到用户指南目录

## 问题
README.md 和 README_zh_CN.md 中引用的图片位于 `asset/` 目录，需要复制到用户指南的 images 目录下，方便文档管理。

## 当前引用的图片

**asset 目录下的图片：**
- `note.png` - 笔记标记示例
- `todo-dock.png` - 视图展示
- `op.gif` - 功能演示
- `setting.png` - 设置界面

**当前 README 中的链接：**
- `https://raw.githubusercontent.com/.../asset/note.png`
- `https://raw.githubusercontent.com/.../asset/todo-dock.png`
- `https://raw.githubusercontent.com/.../asset/op.gif`

## 实施步骤

### Step 1: 复制图片到中文用户指南目录
将 asset 目录下的图片复制到 `docs/user-guide/images/`：
- `asset/note.png` → `docs/user-guide/images/note.png`
- `asset/todo-dock.png` → `docs/user-guide/images/todo-dock.png`
- `asset/op.gif` → `docs/user-guide/images/op.gif`
- `asset/setting.png` → `docs/user-guide/images/setting.png`

### Step 2: 复制图片到英文用户指南目录
将 asset 目录下的图片复制到 `docs/en/user-guide/images/`：
- `asset/note.png` → `docs/en/user-guide/images/note.png`
- `asset/todo-dock.png` → `docs/en/user-guide/images/todo-dock.png`
- `asset/op.gif` → `docs/en/user-guide/images/op.gif`
- `asset/setting.png` → `docs/en/user-guide/images/setting.png`

### Step 3: 更新 README_zh_CN.md 中的图片链接
将链接从 `asset/` 改为 `docs/user-guide/images/`：
- `asset/note.png` → `docs/user-guide/images/note.png`
- `asset/todo-dock.png` → `docs/user-guide/images/todo-dock.png`
- `asset/op.gif` → `docs/user-guide/images/op.gif`

### Step 4: 更新 README.md 中的图片链接
将链接从 `asset/` 改为 `docs/en/user-guide/images/`：
- `asset/note.png` → `docs/en/user-guide/images/note.png`
- `asset/todo-dock.png` → `docs/en/user-guide/images/todo-dock.png`
- `asset/op.gif` → `docs/en/user-guide/images/op.gif`

## 预期结果
- 图片统一存放在用户指南目录下
- README 中的图片链接指向用户指南目录
- 中英文用户指南各自有独立的图片副本
