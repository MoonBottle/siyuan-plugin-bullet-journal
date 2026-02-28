# 子弹笔记

[English](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/README.md)

思源笔记子弹笔记风格的工作管理插件，提供日历视图、甘特图和项目列表功能，帮助您可视化管理工作任务。

## 功能特性

| 功能 | 描述 | 适用场景 |
|------|------|----------|
| **日历视图** | 以日历形式展示工作任务，支持月/周/日/列表视图 | 日/周计划和时间安排 |
| **甘特图** | 项目进度可视化，支持层级任务展示 | 了解项目时间线和任务依赖关系 |
| **项目列表** | 按项目分组展示任务，支持展开查看详情 | 组织和回顾所有项目任务 |
| **待办 Dock** | 在侧边栏显示即将到来的待办事项 | 快速查看今日及未来的待办 |

**核心特性：**
- 📅 **记录驱动** - 专注于记录已完成和待完成的事项，而非提醒
- 🔗 **双向链接** - 点击任意任务可直接跳转到笔记中的对应位置
- 🎯 **无侵入式** - 使用标准 Markdown 格式，无专有格式锁定
- ⚡ **实时同步** - 笔记中的修改会自动同步到所有视图

## 核心工作流

**用标记书写笔记，然后在视图中查看。**

### 1. 在笔记中书写标记

使用简单的标记语法记录任务和事项：

```markdown
## 项目名称
> 项目描述

任务名称 #任务 @L1
工作事项 @2026-02-28
另一个事项 @2026-03-01 10:00~12:00
```

**标记说明：**
- `#任务` - 标记该行为任务
- `@L1/@L2/@L3` - 任务层级
- `@YYYY-MM-DD` - 事项日期
- `@YYYY-MM-DD HH:mm:ss~HH:mm:ss` - 带时间范围

![笔记标记示例](https://raw.githubusercontent.com/MoonBottle/siyuan-plugin-bullet-journal/main/asset/note.png)

### 2. 在视图中查看

插件自动解析笔记中的标记，在日历、甘特图、待办 Dock 中展示：

![视图展示](https://raw.githubusercontent.com/MoonBottle/siyuan-plugin-bullet-journal/main/asset/todo-dock.png)

点击视图中的任务，可直接跳转到笔记中对应位置。

![功能演示](https://raw.githubusercontent.com/MoonBottle/siyuan-plugin-bullet-journal/main/asset/op.gif)

## 安装

### 从集市安装（推荐）

1. 打开思源笔记 → 设置 → 插件 → 集市
2. 搜索「子弹笔记」
3. 点击安装

### 手动安装

1. 从 [GitHub Release](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/releases) 下载 `package.zip`
2. 解压到思源数据目录 `data/plugins/siyuan-plugin-bullet-journal`
3. 在设置中启用插件

## 快速开始

1. **创建项目文档** - 在思源笔记中创建文档记录项目任务
2. **编写任务格式** - 使用 `#任务` 标记任务，`@日期` 标记事项
3. **配置插件** - 在设置中添加要扫描的目录路径
4. **查看视图** - 通过日历、甘特图、项目列表查看任务

详细步骤请参阅 [快速开始](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/quick-start.md)。

## 文档

- [用户指南](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/index.md)
  - [快速开始](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/quick-start.md)
  - [数据格式](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/data-format.md)
  - [视图功能](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/views.md)
  - [设计思想](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/design-philosophy.md)
  - [配置说明](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/configuration.md)
  - [完整示例](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/examples.md)
- [API 文档](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/API/)

## 开发

```bash
npm install      # 安装依赖
npm run dev      # 开发模式
npm run build    # 构建生产版本
```

## 技术栈

Vue 3 + TypeScript + Pinia + FullCalendar + dhtmlx-gantt

## 许可证

AGPL-3.0
