# Tasks

- [ ] Task 1: 添加 AI 番茄钟工具定义
  - [ ] SubTask 1.1: 在 `src/services/aiTools.ts` 中添加 `getPomodoroStatsTool` 工具定义
  - [ ] SubTask 1.2: 在 `src/services/aiTools.ts` 中添加 `getPomodoroRecordsTool` 工具定义
  - [ ] SubTask 1.3: 更新 `bulletJournalTools` 数组，包含新工具
  - [ ] SubTask 1.4: 更新 `ToolName` 类型，添加新工具名称

- [ ] Task 2: 实现 AI 番茄钟工具执行逻辑
  - [ ] SubTask 2.1: 在 `src/services/aiToolsExecutor.ts` 中添加 `executeGetPomodoroStats` 函数
  - [ ] SubTask 2.2: 在 `src/services/aiToolsExecutor.ts` 中添加 `executeGetPomodoroRecords` 函数
  - [ ] SubTask 2.3: 更新 `executeTool` 函数，处理新工具调用
  - [ ] SubTask 2.4: 更新 `ToolExecutionContext` 接口，添加番茄钟数据

- [ ] Task 3: 更新 AI Store 系统提示词
  - [ ] SubTask 3.1: 在 `src/stores/aiStore.ts` 的系统提示词中添加番茄钟工具说明
  - [ ] SubTask 3.2: 更新 `sendMessage` 函数，传递番茄钟数据到工具执行上下文

- [ ] Task 4: 添加 MCP 番茄钟工具
  - [ ] SubTask 4.1: 在 `src/mcp/server.ts` 中注册 `get_pomodoro_stats` 工具
  - [ ] SubTask 4.2: 在 `src/mcp/server.ts` 中注册 `get_pomodoro_records` 工具
  - [ ] SubTask 4.3: 创建 `src/mcp/pomodoroData.ts` 模块，提供番茄钟数据查询功能

# Task Dependencies

- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 can be done in parallel with Task 3
