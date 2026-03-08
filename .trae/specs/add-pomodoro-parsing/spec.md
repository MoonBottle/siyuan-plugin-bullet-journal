# 番茄钟解析与统计 Dock 功能规格

## Why
用户希望在任务、事项、项目行下方添加番茄钟记录（以 🍅 开头），并能够在一个专门的 Dock 面板中查看番茄钟的统计数据和专注记录。

## What Changes

### 1. 数据模型扩展
- **ADDED**: `PomodoroRecord` 接口 - 表示单个番茄钟记录
  - 字段：id, date, startTime, endTime, description, durationMinutes, blockId, projectId?, taskId?, itemId?
- **ADDED**: `Project.pomodoros` 字段 - 项目关联的番茄钟列表（项目描述后的番茄钟行）
- **ADDED**: `Task.pomodoros` 字段 - 任务关联的番茄钟列表
- **ADDED**: `Item.pomodoros` 字段 - 事项关联的番茄钟列表

### 2. 解析器增强
- **ADDED**: `lineParser.ts` 新增 `parsePomodoroLine()` 方法 - 解析单行番茄钟记录
- **MODIFIED**: `core.ts` 解析逻辑 - 在解析项目描述后、任务/事项后，继续解析其下方的番茄钟行

### 3. 番茄钟 Dock 面板
- **ADDED**: `PomodoroDock.vue` - 番茄钟统计 Dock 组件
- **ADDED**: `PomodoroStats.vue` - 统计概览组件（今日番茄数、今日专注时长、总番茄数、总专注时长）
- **ADDED**: `PomodoroRecordList.vue` - 专注记录列表组件
- **ADDED**: 注册新的 Dock 类型 `POMODORO`

### 4. Store 扩展
- **ADDED**: `projectStore` 新增番茄钟相关 getters
  - `getAllPomodoros` - 获取所有番茄钟记录（包括项目、任务、事项的番茄钟）
  - `getTodayPomodoros` - 获取今日番茄钟记录
  - `getTodayFocusMinutes` - 获取今日专注分钟数
  - `getTotalPomodoros` - 获取总番茄数
  - `getTotalFocusMinutes` - 获取总专注分钟数
  - `getPomodorosByDate` - 按日期分组获取番茄钟记录

## Impact
- Affected specs: 任务解析、事项解析、Dock 面板系统
- Affected code: 
  - `src/types/models.ts` - 数据模型
  - `src/parser/lineParser.ts` - 行解析器
  - `src/parser/core.ts` - Kramdown 解析器
  - `src/stores/projectStore.ts` - 状态管理
  - `src/constants.ts` - Dock 类型常量
  - `src/index.ts` - Dock 注册
  - `src/tabs/PomodoroDock.vue` - 新增 Dock 组件

## ADDED Requirements

### Requirement: 番茄钟记录解析
The system SHALL 能够解析以 🍅 开头的番茄钟记录行。

#### Scenario: 解析单行番茄钟
- **GIVEN** 一行内容包含番茄钟格式
- **WHEN** 格式为 `🍅YYYY-MM-DD HH:mm:ss~HH:mm:ss 描述文字`
- **THEN** 解析出日期、开始时间、结束时间、描述

#### Scenario: 解析多行番茄钟
- **GIVEN** 一个项目/任务/事项下方有多行番茄钟
- **WHEN** 每行都以 🍅 开头
- **THEN** 将所有番茄钟记录关联到该项目/任务/事项

#### Scenario: 项目级别番茄钟
- **GIVEN** 项目描述行后有番茄钟行
- **WHEN** 番茄钟行以 🍅 开头且缩进层级与任务/事项不同
- **THEN** 将番茄钟记录关联到项目

### Requirement: 番茄钟统计展示
The system SHALL 在 Dock 面板中展示番茄钟统计数据。

#### Scenario: 显示概览统计
- **GIVEN** 用户打开番茄钟 Dock
- **WHEN** 面板加载完成
- **THEN** 显示今日番茄数、今日专注时长、总番茄数、总专注时长

#### Scenario: 显示专注记录列表
- **GIVEN** 用户有番茄钟记录
- **WHEN** 面板加载完成
- **THEN** 按日期分组显示专注记录，包含时间范围、关联项目/任务/事项、描述

#### Scenario: 点击番茄钟记录跳转
- **GIVEN** 用户点击某条番茄钟记录
- **WHEN** 记录包含 blockId
- **THEN** 打开思源笔记并跳转到对应块位置

## 番茄钟格式规范

### 番茄钟行格式
番茄钟行以 `🍅` 开头，可以是普通文本行或列表项形式。

**普通文本行**（适用于项目级别、任务级别、以及普通文本行形式的事项）
```
🍅YYYY-MM-DD HH:mm:ss~HH:mm:ss 描述文字
```

**列表项形式**（适用于列表项形式的事项，列表标记与父级事项保持一致）
```markdown
# 无序列表事项下的番茄钟（使用 - 标记）
- [ ] 事项内容 @2026-03-08
  - 🍅2026-03-08 15:45:32~15:45:36 哈哈哈
  - 🍅2026-03-08 16:00:00~16:25:00 专注工作

# 有序列表事项下的番茄钟（使用 1. 标记）
1. [ ] 事项内容 @2026-03-08
   1. 🍅2026-03-08 15:45:32~15:45:36 哈哈哈
   2. 🍅2026-03-08 16:00:00~16:25:00 专注工作
```

### 示例
```markdown
# 项目名称

项目描述
🍅2026-03-08 09:00:00~09:25:00 项目规划

## 任务名称 #任务 @L1
🍅2026-03-08 10:00:00~10:25:00 任务专注

# 普通文本行事项
事项A @2026-03-08
🍅2026-03-08 15:45:32~15:45:36 哈哈哈
🍅2026-03-08 16:00:00~16:25:00 专注工作

# 无序列表事项
- [ ] 事项B @2026-03-09
  - 🍅2026-03-09 09:00:00~09:25:00 第一次专注
  - 🍅2026-03-09 14:00:00~14:25:00 第二次专注
  
# 有序列表事项
1. [ ] 事项C @2026-03-10
   1. 🍅2026-03-10 09:00:00~09:25:00 第一次专注
   2. 🍅2026-03-10 14:00:00~14:25:00 第二次专注
```

### 字段说明
- `🍅` - 番茄钟标记（emoji）
- `YYYY-MM-DD` - 日期
- `HH:mm:ss` - 开始时间
- `~HH:mm:ss` - 结束时间（可选，如果没有则按 25 分钟计算）
- `描述文字` - 番茄钟描述（可选）

### 格式识别规则
- 行内容（去除列表标记 `-` 和缩进后）以 `🍅` 开头
- 后面紧跟日期时间格式

## UI 设计参考
- 概览区域：2x2 网格显示统计数据
  - 今日番茄数（大字体数字）
  - 今日专注时长（如 "25m"、"1h 30m"）
  - 总番茄数
  - 总专注时长
- 专注记录区域：按日期分组的时间线列表
  - 日期标题（如 "3月8日"）
  - 每条记录显示：番茄图标、时间范围（12:00 - 12:25）、关联项目/任务/事项名称、描述、时长
  - 点击记录可跳转到笔记对应位置（通过 blockId）

## 测试要求

### 单元测试
- `test/parser/lineParser.test.ts` 添加番茄钟解析测试
  - 测试 `parsePomodoroLine()` 方法
  - 测试各种格式：完整格式、无描述、无结束时间
- `test/parser/core.test.ts` 添加番茄钟关联测试
  - 测试项目级别番茄钟解析
  - 测试任务级别番茄钟解析
  - 测试事项级别番茄钟解析
  - 测试番茄钟 blockId 正确记录
