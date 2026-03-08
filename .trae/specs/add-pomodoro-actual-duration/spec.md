# 番茄钟实际专注时长记录 Spec

## 参考文档

完整功能说明见：`docs/prd/pomodoro.md`

## Why

用户需要支持暂停和继续功能，因此需要记录实际专注时长，而不是仅依赖开始和结束时间的差值。通过将实际时长放在番茄钟记录的最前面，可以更突出时长信息的重要性。

## What Changes

- 扩展番茄钟记录格式，支持 `🍅实际分钟数,YYYY-MM-DD HH:mm:ss~HH:mm:ss` 格式
- 支持中英文逗号（`,` 或 `，`）作为分隔符
- 支持逗号后任意数量的空格
- 修改解析器以识别和解析实际时长字段
- 修改番茄钟数据模型，添加 `actualDurationMinutes` 字段
- 更新统计计算逻辑，优先使用实际时长（如果存在）

## Impact

- 修改文件：
  - `src/types/models.ts` - 添加 `actualDurationMinutes` 字段到 `PomodoroRecord`
  - `src/parser/lineParser.ts` - 修改番茄钟行解析逻辑，支持解析时长前缀
  - `src/utils/pomodoroHelpers.ts` - 更新统计计算逻辑
  - `src/components/pomodoro/PomodoroStats.vue` - 更新统计显示（如有必要）

## ADDED Requirements

### Requirement: 番茄钟记录格式扩展
The system SHALL support recording actual focus duration at the beginning of pomodoro records.

#### Scenario: 带实际时长的记录格式
- **GIVEN** 用户在笔记中添加番茄钟记录
- **WHEN** 使用格式 `🍅N,YYYY-MM-DD HH:mm:ss~HH:mm:ss` 或 `🍅N，YYYY-MM-DD HH:mm:ss~HH:mm:ss`
- **THEN** 系统识别 `N` 为实际专注分钟数
- **AND** 支持中英文逗号作为分隔符
- **AND** 支持逗号后任意数量的空格（0个或多个）
- **AND** 优先使用实际时长进行统计计算

#### Scenario: 不带实际时长的记录格式（向后兼容）
- **GIVEN** 用户在笔记中添加番茄钟记录
- **WHEN** 使用格式 `🍅YYYY-MM-DD HH:mm:ss~HH:mm:ss`（无实际时长前缀）
- **THEN** 系统自动计算时长 = 结束时间 - 开始时间
- **AND** 保持与现有记录的兼容性

#### Scenario: 无结束时间的记录
- **GIVEN** 用户在笔记中添加番茄钟记录
- **WHEN** 使用格式 `🍅N,YYYY-MM-DD HH:mm:ss`（无结束时间，有实际时长）
- **THEN** 系统使用 `N` 作为实际专注分钟数
- **AND** 默认按25分钟计算（如果无实际时长）

### Requirement: 数据模型扩展
The system SHALL store actual duration in the data model.

#### Scenario: PomodoroRecord 接口
- **GIVEN** 解析番茄钟记录
- **WHEN** 创建 `PomodoroRecord` 对象
- **THEN** 包含 `actualDurationMinutes?: number` 字段
- **AND** 该字段仅在存在实际时长前缀时设置

#### Scenario: 时长计算逻辑
- **GIVEN** 需要计算番茄钟时长
- **WHEN** `actualDurationMinutes` 存在
- **THEN** 使用 `actualDurationMinutes` 作为时长
- **AND** 否则使用 `endTime - startTime` 计算

### Requirement: 统计计算更新
The system SHALL use actual duration in statistics calculations.

#### Scenario: 今日专注时长统计
- **GIVEN** 计算今日专注时长
- **WHEN** 统计包含带实际时长的记录
- **THEN** 使用实际时长累加
- **AND** 不包含实际时长的记录使用计算时长

#### Scenario: 总专注时长统计
- **GIVEN** 计算总专注时长
- **WHEN** 统计包含带实际时长的记录
- **THEN** 使用实际时长累加
- **AND** 不包含实际时长的记录使用计算时长

## MODIFIED Requirements

### Requirement: 番茄钟行解析
```typescript
// 原正则（示例）
/🍅(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(?:~(\d{2}:\d{2}:\d{2}))?\s*(.*)/

// 新正则（支持实际时长前缀，中英文逗号，逗号后任意空格）
/🍅(?:(\d+)[,，]\s*)?(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(?:~(\d{2}:\d{2}:\d{2}))?\s*(.*)/
```

## Technical Notes

### 正则表达式更新
```typescript
// 匹配番茄钟行，支持可选的实际时长前缀（中英文逗号，逗号后任意空格）
const POMODORO_REGEX = /🍅(?:(\d+)[,，]\s*)?(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(?:~(\d{2}:\d{2}:\d{2}))?\s*(.*)/;

// 捕获组说明：
// 1: 实际时长分钟数 (数字) - 可选，新增
// 2: 日期 (YYYY-MM-DD)
// 3: 开始时间 (HH:mm:ss)
// 4: 结束时间 (HH:mm:ss) - 可选
// 5: 描述文本 - 可选

// 逗号后空格说明：
// \s* 匹配0个或多个空白字符（空格、制表符等）
```

### 时长计算逻辑
```typescript
function calculateDuration(record: PomodoroRecord): number {
  // 优先使用实际时长
  if (record.actualDurationMinutes !== undefined) {
    return record.actualDurationMinutes;
  }
  
  // 否则根据开始和结束时间计算
  if (record.endTime) {
    const start = parseTime(record.startTime);
    const end = parseTime(record.endTime);
    return Math.round((end - start) / (1000 * 60));
  }
  
  // 默认25分钟
  return 25;
}
```

### 格式示例
```markdown
// 带实际时长的完整记录（英文逗号，无空格）
🍅5,2026-03-08 15:45:32~15:50:32 完成代码审查

// 带实际时长的完整记录（中文逗号）
🍅5，2026-03-08 15:45:32~15:50:32 完成代码审查

// 带实际时长的完整记录（逗号后1个空格）
🍅5, 2026-03-08 15:45:32~15:50:32 完成代码审查

// 带实际时长的完整记录（逗号后多个空格）
🍅5,   2026-03-08 15:45:32~15:50:32 完成代码审查

// 不带实际时长的记录（向后兼容）
🍅2026-03-08 15:45:32~15:50:32 完成代码审查

// 无结束时间但有实际时长
🍅5,2026-03-08 15:45:32 完成代码审查

// 无结束时间无实际时长（默认25分钟）
🍅2026-03-08 15:45:32 完成代码审查
```
