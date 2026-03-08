# 任务助手插件完整 PRD 计划

## 目标
完善 `docs/prd/` 目录下的 PRD 文档，包含目前所有实现的功能，包括需求及技术实现方案。

## 已完成工作

### 创建的 PRD 文件

1. ✅ **README.md** - PRD 文档索引和导航
2. ✅ **overview.md** - 产品概述与核心概念
3. ✅ **data-format.md** - 数据格式规范
4. ✅ **task-management.md** - 任务管理功能
5. ✅ **views.md** - 视图功能（日历/甘特图/项目列表）
6. ✅ **todo-dock.md** - 待办 Dock 功能
7. ✅ **pomodoro.md** - 番茄钟功能（已存在，内容已完善）
8. ✅ **ai-assistant.md** - AI 对话功能
9. ✅ **mcp-server.md** - MCP 服务器功能
10. ✅ **settings.md** - 设置与配置
11. ✅ **architecture.md** - 技术架构

## PRD 文档结构

```
docs/prd/
├── README.md           # 文档索引
├── overview.md         # 产品概述
├── data-format.md      # 数据格式规范
├── task-management.md  # 任务管理功能
├── views.md            # 视图功能
├── todo-dock.md        # 待办 Dock
├── pomodoro.md         # 番茄钟功能
├── ai-assistant.md     # AI 对话功能
├── mcp-server.md       # MCP 服务器
├── settings.md         # 设置与配置
└── architecture.md     # 技术架构
```

## 文档内容概览

### 1. overview.md
- 产品定位与核心理念
- 功能架构图
- 用户价值与目标用户
- 使用流程与核心概念
- 技术栈与版本历史

### 2. data-format.md
- 项目格式规范
- 任务格式规范
- 事项格式规范（含多日期支持）
- 番茄钟格式规范
- 完整示例文档
- 解析规则说明

### 3. task-management.md
- 项目/任务/事项三级结构需求
- 多日期支持需求
- 状态管理需求
- 数据模型定义
- 解析流程说明
- 核心模块介绍

### 4. views.md
- 日历视图功能规格
- 甘特图视图功能规格
- 项目列表视图功能规格
- 视图间联动机制
- 技术架构说明

### 5. todo-dock.md
- 分组展示需求（已过期/今天/明天/未来/已完成/已放弃）
- 事项操作功能（完成/迁移/放弃/详情/日历）
- 右键菜单与 Hover 操作
- 设置选项

### 6. pomodoro.md
- 番茄钟记录需求
- 统计分析需求
- 专注计时需求
- 状态持久化需求
- 技术实现方案

### 7. ai-assistant.md
- AI 对话功能需求
- 多供应商支持
- AI 工具定义（get_user_time/list_groups/list_projects/filter_items）
- 对话流程说明
- 配置管理

### 8. mcp-server.md
- MCP 服务器功能需求
- 工具列表与参数
- 架构设计
- 配置使用方法
- 故障排查

### 9. settings.md
- 目录配置
- 分组管理
- 午休时间设置
- AI 配置
- MCP 配置生成

### 10. architecture.md
- 整体架构图
- 模块划分
- 核心模块详解（解析器/状态管理/视图/AI/MCP）
- 数据模型
- 通信机制
- 性能优化策略

## 实施状态

所有 PRD 文档已创建完成，包含：
- ✅ 需求描述
- ✅ 验收标准
- ✅ 技术实现方案
- ✅ 数据模型
- ✅ 文件结构
- ✅ 使用流程
- ✅ 注意事项
