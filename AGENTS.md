# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

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
