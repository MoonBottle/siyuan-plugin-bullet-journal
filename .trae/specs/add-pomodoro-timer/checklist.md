# Checklist

## 数据模型
- [x] `PomodoroRecord` 接口包含 `status` 和 `itemContent` 字段
- [x] `PomodoroStatus` 类型已定义
- [x] `ActivePomodoro` 接口已定义

## 解析器
- [x] `lineParser.ts` 能解析 Kramdown 块属性 `{: ... }`
- [x] `parsePomodoroLine()` 返回包含 `status` 的 `PomodoroRecord`
- [x] 单元测试覆盖块属性解析

## Store
- [x] `pomodoroStore.ts` 已创建
- [x] `startPomodoro()` 正确创建块和设置属性
- [x] `completePomodoro()` 正确更新块内容和属性
- [x] `cancelPomodoro()` 正确删除块
- [x] `restorePomodoro()` 正确恢复专注状态

## UI 组件
- [x] `PomodoroTimerDialog.vue` 弹框组件已创建
- [x] 弹框左右两栏布局正确
- [x] 左侧待办列表展示过期和今天的事项
- [x] 事项选择功能正常工作
- [x] 右侧时长设置快捷按钮正常工作
- [x] 开始专注按钮在未选择事项时禁用
- [x] `PomodoroActiveTimer.vue` 专注中组件已创建
- [x] 倒计时显示正确（MM:SS）
- [x] 事项名称显示正确
- [x] 结束和取消按钮正常工作
- [x] 倒计时完成自动处理

## Dock 集成
- [x] `PomodoroDock.vue` 添加"开始专注"按钮
- [x] 专注中状态正确切换 Dock 展示
- [x] 状态恢复逻辑正常工作

## 思源 API 集成
- [x] `appendBlock` 调用正确
- [x] `setBlockAttrs` 调用正确
- [x] `updateBlock` 调用正确
- [x] `deleteBlock` 调用正确
- [x] `getBlockAttrs` 调用正确

## 测试
- [x] 块属性解析测试通过
- [x] 番茄钟行解析测试通过（带状态）
