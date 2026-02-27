# 更新 README 图片计划

## 目标
更新中英文 README 文件中的图片引用，将现有的图片正确放置到合适的位置。

## 图片分析

1. **asset/op.gif** - 操作点击交互图（动态演示）
   - 用途：展示插件的整体操作流程和交互
   - 放置位置：README 的 Features 部分或 Quick Start 之后

2. **asset/note.png** - 原始笔记图
   - 用途：展示原始 Markdown 笔记的格式
   - 放置位置：Quick Start 的 Step 3（编写任务格式）附近

3. **asset/todo-dock.png** - 日历和待办图
   - 用途：展示日历视图和待办 Dock 的组合效果
   - 放置位置：Features 表格下方或 Todo Dock 功能介绍处

## 当前 README 状态

### README.md (英文)
- 第 22 行：`![Plugin Preview](./preview.png)` - 需要确认 preview.png 是否存在
- 第 292 行：`![Feature Demo](./asset/action.png)` - 需要更新为 op.gif

### README_zh_CN.md (中文)
- 第 22 行：`![插件预览图](./preview.png)` - 需要确认 preview.png 是否存在
- 第 291 行：`![功能演示图](./asset/action.png)` - 需要更新为 op.gif

## 执行步骤

1. **检查现有图片引用**
   - 确认 preview.png 是否存在
   - 确认 action.png 是否需要替换

2. **更新 README.md (英文)**
   - 在 Features 表格后添加 todo-dock.png 展示日历和待办功能
   - 在 Quick Start Step 3 后添加 note.png 展示原始笔记格式
   - 将 action.png 替换为 op.gif

3. **更新 README_zh_CN.md (中文)**
   - 在 Features 表格后添加 todo-dock.png 展示日历和待办功能
   - 在 Quick Start Step 3 后添加 note.png 展示原始笔记格式
   - 将 action.png 替换为 op.gif

4. **清理占位符注释**
   - 移除 "<!-- Image placeholder: Replace with your plugin screenshot -->" 等注释

## 预期结果

- 中英文 README 都包含清晰的图片展示
- 图片位置合理，与文字内容对应
- 删除不再需要的占位符注释
