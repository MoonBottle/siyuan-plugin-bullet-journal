# Tasks

## Task 1: 数据模型扩展
- [x] SubTask 1.1: 在 `src/types/models.ts` 中扩展 `PomodoroRecord` 接口
  - 添加 `actualDurationMinutes?: number` 字段
  - 添加 JSDoc 注释说明该字段用途

## Task 2: 解析器增强
- [x] SubTask 2.1: 修改 `src/parser/lineParser.ts` 中的番茄钟正则表达式
  - 更新正则以支持可选的实际时长前缀
  - 支持中英文逗号（`,` 或 `，`）作为分隔符
  - 支持逗号后任意数量的空格（`\s*`）
  - 新正则：`/🍅(?:(\d+)[,，]\s*)?(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(?:~(\d{2}:\d{2}:\d{2}))?\s*(.*)/`
- [x] SubTask 2.2: 修改 `parsePomodoroLine()` 方法
  - 提取第1个捕获组作为 `actualDurationMinutes`
  - 注意：由于添加了可选的前缀组，后续捕获组编号会变化
  - 将解析结果添加到返回的 `PomodoroRecord` 对象
- [x] SubTask 2.3: 在 `test/parser/lineParser.test.ts` 添加实际时长解析测试
  - 测试英文逗号格式（无空格）：`🍅5,2026-03-08 15:45:32~15:50:32 描述`
  - 测试中文逗号格式：`🍅5，2026-03-08 15:45:32~15:50:32 描述`
  - 测试逗号后1个空格：`🍅5, 2026-03-08 15:45:32~15:50:32 描述`
  - 测试逗号后多个空格：`🍅5,   2026-03-08 15:45:32~15:50:32 描述`
  - 测试无结束时间但有实际时长：`🍅5,2026-03-08 15:45:32 描述`
  - 测试不带实际时长的记录（向后兼容）

## Task 3: 统计计算更新
- [x] SubTask 3.1: 在 `src/stores/projectStore.ts` 中更新统计计算
  - 修改 `getTodayFocusMinutes()` 优先使用 `actualDurationMinutes`
  - 修改 `getTotalFocusMinutes()` 优先使用 `actualDurationMinutes`

## Task 4: 测试验证
- [x] SubTask 4.1: 运行解析器单元测试
  - 确保所有新测试用例通过
  - 确保现有测试用例仍然通过（向后兼容）

# Task Dependencies
- Task 2 依赖 Task 1（需要类型定义）
- Task 3 依赖 Task 1 和 Task 2（需要类型定义和解析器）
- Task 4 依赖 Task 2 和 Task 3（需要解析器和统计逻辑）
