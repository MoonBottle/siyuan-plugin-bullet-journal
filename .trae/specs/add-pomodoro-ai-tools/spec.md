# AI/MCP 识别番茄钟功能 Spec

## Why

当前 AI 对话和 MCP 服务器只能查询任务分组、项目和事项，无法识别和查询番茄钟数据。用户希望通过 AI 能够：
1. 查询今日/某段时间的专注统计（番茄数、专注时长）
2. 查询番茄钟记录列表
3. 了解某个项目的番茄钟完成情况
4. 获取专注时间分析建议

## What Changes

- **ADDED**: AI 工具 `get_pomodoro_stats` - 获取番茄钟统计数据
- **ADDED**: AI 工具 `get_pomodoro_records` - 获取番茄钟记录列表
- **ADDED**: MCP 工具 `get_pomodoro_stats` - MCP 服务器支持番茄钟统计查询
- **ADDED**: MCP 工具 `get_pomodoro_records` - MCP 服务器支持番茄钟记录查询
- **MODIFIED**: AI Store 系统提示词 - 添加番茄钟相关工具说明

## Impact

- Affected specs: AI 对话功能、MCP 服务器功能
- Affected code:
  - `src/services/aiTools.ts` - 添加番茄钟工具定义
  - `src/services/aiToolsExecutor.ts` - 添加番茄钟工具执行逻辑
  - `src/stores/aiStore.ts` - 更新系统提示词
  - `src/mcp/server.ts` - 添加 MCP 番茄钟工具
  - `src/mcp/` - 可能需要新增番茄钟数据加载模块

## ADDED Requirements

### Requirement: AI 番茄钟统计工具

The system SHALL provide a `get_pomodoro_stats` tool for AI to query pomodoro statistics.

#### Scenario: 查询今日番茄统计
- **WHEN** AI 调用 `get_pomodoro_stats` 并传入 `date: "today"`
- **THEN** 返回今日番茄数、今日专注时长、总番茄数、总专注时长

#### Scenario: 查询指定日期范围统计
- **WHEN** AI 调用 `get_pomodoro_stats` 并传入 `startDate` 和 `endDate`
- **THEN** 返回该日期范围内的番茄统计

#### Scenario: 查询指定项目统计
- **WHEN** AI 调用 `get_pomodoro_stats` 并传入 `projectId`
- **THEN** 返回该项目的番茄统计

### Requirement: AI 番茄钟记录查询工具

The system SHALL provide a `get_pomodoro_records` tool for AI to query pomodoro records.

#### Scenario: 查询今日番茄记录
- **WHEN** AI 调用 `get_pomodoro_records` 并传入 `date: "today"`
- **THEN** 返回今日的番茄钟记录列表（包含时间、事项、时长）

#### Scenario: 查询指定日期范围记录
- **WHEN** AI 调用 `get_pomodoro_records` 并传入 `startDate` 和 `endDate`
- **THEN** 返回该日期范围内的番茄钟记录列表

#### Scenario: 查询指定项目记录
- **WHEN** AI 调用 `get_pomodoro_records` 并传入 `projectId`
- **THEN** 返回该项目的番茄钟记录列表

### Requirement: MCP 番茄钟工具

The system SHALL provide MCP server tools for external AI assistants to query pomodoro data.

#### Scenario: MCP 查询番茄统计
- **WHEN** MCP 客户端调用 `get_pomodoro_stats`
- **THEN** 返回番茄统计数据（与 AI 工具相同格式）

#### Scenario: MCP 查询番茄记录
- **WHEN** MCP 客户端调用 `get_pomodoro_records`
- **THEN** 返回番茄钟记录列表（与 AI 工具相同格式）

## MODIFIED Requirements

### Requirement: AI 系统提示词更新

The system SHALL update the system prompt in `aiStore.ts` to include pomodoro tool descriptions.

#### Scenario: AI 了解番茄钟工具
- **WHEN** AI 收到系统提示词
- **THEN** 提示词中包含 `get_pomodoro_stats` 和 `get_pomodoro_records` 的使用说明

## Data Format

### PomodoroStats Output
```typescript
interface PomodoroStatsOutput {
  todayCount: number;        // 今日番茄数
  todayMinutes: number;      // 今日专注分钟数
  totalCount: number;        // 总番茄数
  totalMinutes: number;      // 总专注分钟数
  dateRange?: {              // 查询的日期范围（可选）
    startDate: string;
    endDate: string;
  };
  projectId?: string;        // 查询的项目ID（可选）
}
```

### PomodoroRecord Output
```typescript
interface PomodoroRecordOutput {
  id: string;
  date: string;
  startTime: string;
  endTime?: string;
  durationMinutes: number;
  actualDurationMinutes?: number;
  itemContent?: string;
  projectName?: string;
  taskName?: string;
  description?: string;
}
```
