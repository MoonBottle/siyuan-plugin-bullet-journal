- [ ] AI 工具定义代码实现
  - [ ] `getPomodoroStatsTool` 工具定义正确
  - [ ] `getPomodoroRecordsTool` 工具定义正确
  - [ ] `bulletJournalTools` 数组包含新工具
  - [ ] `ToolName` 类型包含新工具名称

- [ ] AI 工具执行逻辑实现
  - [ ] `executeGetPomodoroStats` 函数正确实现
  - [ ] `executeGetPomodoroRecords` 函数正确实现
  - [ ] `executeTool` 函数能处理新工具调用
  - [ ] `ToolExecutionContext` 接口包含番茄钟数据

- [ ] AI Store 系统提示词更新
  - [ ] 系统提示词包含番茄钟工具说明
  - [ ] `sendMessage` 函数传递番茄钟数据到上下文

- [ ] MCP 番茄钟工具实现
  - [ ] `get_pomodoro_stats` 工具在 MCP 服务器注册
  - [ ] `get_pomodoro_records` 工具在 MCP 服务器注册
  - [ ] `src/mcp/pomodoroData.ts` 模块正确提供数据查询

- [ ] 功能验证
  - [ ] AI 能正确调用番茄钟统计工具
  - [ ] AI 能正确调用番茄钟记录工具
  - [ ] MCP 客户端能查询番茄钟统计
  - [ ] MCP 客户端能查询番茄钟记录
