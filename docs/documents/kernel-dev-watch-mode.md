# Kernel Dev Watch Mode 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。

**目标：** 让 kernel 在 dev 模式下支持 watch（热更新），与 MCP 保持一致

**架构：** 修改 package.json 中的 dev 脚本，在初始构建时同时构建 MCP 和 Kernel，然后使用 concurrently 同时启动 MCP、Kernel 和主插件的 watch 模式

**技术栈：** npm scripts, concurrently, vite

---

## 文件清单

| 文件 | 职责 |
|------|------|
| `package.json` | 修改 dev 脚本，添加 kernel 的初始构建和 watch |

---

## 任务 1：修改 dev 脚本支持 Kernel Watch

**文件：**
- 修改：`package.json` 第 13 行

**变更内容：**

将原来的：
```json
"dev": "vite build --config vite.mcp.config.ts && concurrently \"vite build --config vite.mcp.config.ts -w\" \"vite build -w\"",
```

修改为：
```json
"dev": "vite build --config vite.mcp.config.ts && vite build --config vite.kernel.config.ts && concurrently \"vite build --config vite.mcp.config.ts -w\" \"vite build --config vite.kernel.config.ts -w\" \"vite build -w\"",
```

**变更说明：**
1. 在初始构建阶段，同时构建 MCP 和 Kernel
2. 在 watch 阶段，同时启动三个进程：
   - MCP server 的 watch 模式
   - Kernel 的 watch 模式
   - 主插件的 watch 模式

---

## 自检

**规格覆盖度：** ✓ 完全覆盖 - 只需修改 package.json 的 dev 脚本

**占位符扫描：** ✓ 无占位符，修改内容明确

**类型一致性：** N/A - 无类型定义变更

---

## 执行选项

计划已完成。两种执行方式：

**1. 子代理驱动（推荐）** - 每个任务调度一个新的子代理

**2. 内联执行** - 在当前会话中直接执行

请选择执行方式。
