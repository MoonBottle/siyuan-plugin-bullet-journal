# Checklist

## 数据模型
- [x] `PomodoroRecord` 接口已正确定义在 `src/types/models.ts`
- [x] `Project` 接口包含 `pomodoros?: PomodoroRecord[]` 字段
- [x] `Task` 接口包含 `pomodoros?: PomodoroRecord[]` 字段
- [x] `Item` 接口包含 `pomodoros?: PomodoroRecord[]` 字段

## 解析器
- [x] `lineParser.ts` 中的 `parsePomodoroLine()` 方法能正确解析番茄钟格式
- [x] `core.ts` 在解析项目描述后能正确收集关联的番茄钟行
- [x] `core.ts` 在解析任务后能正确收集关联的番茄钟行
- [x] `core.ts` 在解析事项后能正确收集关联的番茄钟行
- [x] 番茄钟记录正确关联到父级项目/任务/事项
- [x] 番茄钟记录包含正确的 blockId

## Store
- [x] `getAllPomodoros` getter 能正确收集所有番茄钟记录
- [x] `getTodayPomodoros` getter 能正确过滤今日记录
- [x] `getTodayFocusMinutes` getter 计算正确
- [x] `getTotalPomodoros` getter 返回正确数量
- [x] `getTotalFocusMinutes` getter 计算正确
- [x] `getPomodorosByDate` getter 正确按日期分组

## UI 组件
- [x] `PomodoroStats.vue` 显示 2x2 网格统计概览
- [x] 今日番茄数显示正确
- [x] 今日专注时长格式化为 "25m" 或 "1h 30m"
- [x] 总番茄数显示正确
- [x] 总专注时长显示正确
- [x] `PomodoroRecordList.vue` 按日期分组显示记录
- [x] 每条记录显示番茄图标、时间范围、关联任务/事项、描述、时长
- [x] 点击记录可通过 blockId 跳转到思源笔记对应位置
- [x] `PomodoroDock.vue` 整合 Stats 和 RecordList 组件

## 测试
- [x] `test/parser/lineParser.test.ts` 包含番茄钟解析测试
- [x] `test/parser/core.test.ts` 包含番茄钟关联测试
- [x] 所有测试用例通过

## Dock 集成
- [x] `constants.ts` 中定义了 `POMODORO` Dock 类型
- [x] `index.ts` 中成功注册番茄钟 Dock
- [x] Dock 图标、标题、位置配置正确
- [x] Dock 在思源中正常显示和工作
