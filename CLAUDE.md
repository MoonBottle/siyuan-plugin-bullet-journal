# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Task Assistant (任务助手) — a SiYuan note-taking app plugin for task management. Users write markers in notes (`#task`, `@date`, `#done`, `🍅` pomodoro records), and the plugin renders them as Calendar, Gantt, Todo, Pomodoro, and AI Chat views. Documents are tasks; the plugin is non-invasive and uses bidirectional links.

## Build & Development Commands

```bash
npm run dev          # Build MCP server + plugin in watch mode (requires VITE_SIYUAN_WORKSPACE_PATH for dev into SiYuan)
npm run build        # Production build (MCP server first, then plugin with zip)
npm run test         # Run vitest once
npm run test:watch   # Run vitest in watch mode
npm run mcp          # Run standalone MCP server (node dist/mcp-server.js)
npm run lint         # Lint with ESLint
npm run lint:fix     # Lint and auto-fix
```

**Single test file:** `npx vitest run test/parser/core.test.ts`

## Environment Variables

- `VITE_SIYUAN_WORKSPACE_PATH` — SiYuan workspace path; dev mode builds directly into the plugin directory
- `SIYUAN_TOKEN` / `SIYUAN_API_URL` — For MCP server integration tests

## Architecture

### Plugin Entry & Lifecycle

`src/index.ts` exports `TaskAssistantPlugin extends Plugin` (SiYuan's plugin base class). `onload()`:

1. Inits i18n and settings
2. Creates a **shared Pinia instance** (all tabs/docks share one store to prevent state divergence via `src/utils/sharedPinia.ts`)
3. Registers 4 Tabs (Calendar, Gantt, Project, PomodoroStats) and 3 Docks (Todo, AI Chat, Pomodoro)
4. Loads project data via `projectStore.loadProjects()`
5. Listens to SiYuan WebSocket events for debounced/incremental data refresh (`dirtyDocTracker`)

### Data Flow

```
SiYuan notes (markdown with markers)
  → src/parser/ (Kramdown block parser → Project[] → Task[] → Item[])
  → projectStore (central Pinia store)
  → Views (Calendar, Gantt, Todo, Pomodoro) read from stores
  → eventBus for cross-component communication (typed Events enum)
```

### Key Modules

- **`src/parser/`** — Shared markdown parser (`core.ts` block-level, `lineParser.ts` line-level, `markdownParser.ts` high-level orchestration). Parses projects, tasks, items, dates, tags, pomodoro records, recurring rules, and reminders from SiYuan's Kramdown format.
- **`src/stores/`** — Pinia stores: `projectStore` (projects/tasks/items/calendar events), `aiStore` (AI config, conversations, ReAct agent), `pomodoroStore` (timer state), `settingsStore`, `skillStore`.
- **`src/services/`** — Business logic: `aiService` (OpenAI-compatible API), `aiToolsExecutor` (tool execution), `recurringService` (recurring tasks), `reminderService` (reminders), `skillService` (AI skill CRUD), `clawBotService` (WeChat integration).
- **`src/agents/`** — ReAct Agent implementation for AI reasoning+acting loop.
- **`src/mcp/`** — Standalone Node.js MCP server (built separately via `vite.mcp.config.ts`). Shares `src/parser/` and `src/types/` with the browser plugin. Tools: `list_groups`, `list_projects`, `filter_items`, `get_pomodoro_stats/records`.
- **`src/api.ts`** — SiYuan Kernel API wrapper (notebooks, blocks, SQL, files).
- **`src/components/SiyuanTheme/`** — SiYuan-styled UI primitives (SyButton, SyInput, SySelect, etc.) used throughout components.

### Build Pipeline

Two separate Vite builds:

1. **MCP server** (`vite.mcp.config.ts`) — ESM, Node 18 target, bundles all deps into `dist/mcp-server.js`
2. **Plugin** (`vite.config.ts`) — CJS library (SiYuan requirement), Vue + SCSS, static file copy. Production removes console.log and creates `package.zip`

### Incremental Refresh

`src/utils/dirtyDocTracker.ts` tracks changed documents via SiYuan WebSocket events. `projectStore` re-parses only dirty docs instead of full reload.

## Tech Stack

Vue 3.5 + Pinia 3 + TypeScript 5.8 + Vite 8 + SASS | FullCalendar 6 | dhtmlx-gantt 9 | Chart.js 4 | dayjs | Zod 4 | `@modelcontextprotocol/sdk` | `@tencent-weixin/openclaw-weixin`

## Code Conventions

- **Path alias:** `@` → `src/` (configured in both vite and tsconfig)
- **ESLint:** `@antfu/eslint-config` — single quotes, 2-space indent, trailing commas (`always-multiline`), object properties on separate lines
- **Vue SFC order:** `<template>` → `<script>` → `<style>`
- **Vue attributes:** one per line (enforced by `vue/max-attributes-per-line`)
- **TypeScript:** `strict: false`, but `noUnusedLocals` and `noUnusedParameters` enabled
- **Module format:** ESM source (`"type": "module"`) but plugin output is CJS (SiYuan requirement)
- **i18n:** Custom lightweight system — `t('key.path')` function, JSON files in `src/i18n/`
- **Testing:** Vitest with `@` alias; `siyuan` module mocked at `test/__mocks__/siyuan.ts`
- **Custom ESLint plugin:** `src/utils/eslint/i18n-validate-keys.mjs` validates i18n key usage

<!-- superpowers-zh:begin (do not edit between these markers) -->

# Superpowers-ZH 中文增强版

本项目已安装 superpowers-zh 技能框架（20 个 skills）。

## 核心规则

1. **收到任务时，先检查是否有匹配的 skill** — 哪怕只有 1% 的可能性也要检查
2. **设计先于编码** — 收到功能需求时，先用 brainstorming skill 做需求分析
3. **测试先于实现** — 写代码前先写测试（TDD）
4. **验证先于完成** — 声称完成前必须运行验证命令

## 可用 Skills

Skills 位于 `.claude/skills/` 目录，每个 skill 有独立的 `SKILL.md` 文件。

- **brainstorming**: 在任何创造性工作之前必须使用此技能——创建功能、构建组件、添加功能或修改行为。在实现之前先探索用户意图、需求和设计。
- **chinese-code-review**: 中文代码审查规范——在保持专业严谨的同时，用符合国内团队文化的方式给出有效反馈
- **chinese-commit-conventions**: 中文 Git 提交规范 — 适配国内团队的 commit message 规范和 changelog 自动化
- **chinese-documentation**: 中文技术文档写作规范——排版、术语、结构一步到位，告别机翻味
- **chinese-git-workflow**: 适配国内 Git 平台和团队习惯的工作流规范——Gitee、Coding、极狐 GitLab、CNB 全覆盖
- **dispatching-parallel-agents**: 当面对 2 个以上可以独立进行、无共享状态或顺序依赖的任务时使用
- **executing-plans**: 当你有一份书面实现计划需要在单独的会话中执行，并设有审查检查点时使用
- **finishing-a-development-branch**: 当实现完成、所有测试通过、需要决定如何集成工作时使用——通过提供合并、PR 或清理等结构化选项来引导开发工作的收尾
- **mcp-builder**: MCP 服务器构建方法论 — 系统化构建生产级 MCP 工具，让 AI 助手连接外部能力
- **receiving-code-review**: 收到代码审查反馈后、实施建议之前使用，尤其当反馈不明确或技术上有疑问时——需要技术严谨性和验证，而非敷衍附和或盲目执行
- **requesting-code-review**: 完成任务、实现重要功能或合并前使用，用于验证工作成果是否符合要求
- **subagent-driven-development**: 当在当前会话中执行包含独立任务的实现计划时使用
- **systematic-debugging**: 遇到任何 bug、测试失败或异常行为时使用，在提出修复方案之前执行
- **test-driven-development**: 在实现任何功能或修复 bug 时使用，在编写实现代码之前
- **using-git-worktrees**: 当需要开始与当前工作区隔离的功能开发或执行实现计划之前使用——创建具有智能目录选择和安全验证的隔离 git 工作树
- **using-superpowers**: 在开始任何对话时使用——确立如何查找和使用技能，要求在任何响应（包括澄清性问题）之前调用 Skill 工具
- **verification-before-completion**: 在宣称工作完成、已修复或测试通过之前使用，在提交或创建 PR 之前——必须运行验证命令并确认输出后才能声称成功；始终用证据支撑断言
- **workflow-runner**: 在 Claude Code / OpenClaw / Cursor 中直接运行 agency-orchestrator YAML 工作流——无需 API key，使用当前会话的 LLM 作为执行引擎。当用户提供 .yaml 工作流文件或要求多角色协作完成任务时触发。
- **writing-plans**: 当你有规格说明或需求用于多步骤任务时使用，在动手写代码之前
- **writing-skills**: 当创建新技能、编辑现有技能或在部署前验证技能是否有效时使用

## 如何使用

当任务匹配某个 skill 时，使用 `Skill` 工具加载对应 skill 并严格遵循其流程。绝不要用 Read 工具读取 SKILL.md 文件。

如果你认为哪怕只有 1% 的可能性某个 skill 适用于你正在做的事情，你必须调用该 skill 检查。

<!-- superpowers-zh:end -->

## 重要
- 禁止使用动态 import，必须使用静态 import
- 修改后需要验证 npm run test 是否成功
- 修改后需要验证 npm run lint 是否成功
- 修改后需要验证 npm run typecheck 是否成功