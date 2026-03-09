# Checklist

- [x] `parseItemLine` 方法能够正确解析 `[ ]` 标记并设置状态为 `pending`
- [x] `parseItemLine` 方法能够正确解析 `[x]` 标记并设置状态为 `completed`
- [x] `parseItemLine` 方法能够正确解析 `[X]` 标记并设置状态为 `completed`
- [x] 当任务列表标记与状态标签共存时，状态标签优先级更高
- [x] 任务列表标记能够从内容中正确移除，不影响其他解析
- [x] 思源笔记完整格式（含块属性）能够正确解析
- [x] 所有新增功能都有对应的单元测试覆盖
