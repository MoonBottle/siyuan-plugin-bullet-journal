# Tasks

- [x] Task 1: 修改项目名默认值为文档路径中的文件名
  - [x] SubTask 1.1: 在 parseKramdown 方法中提取 docPath 的文件名
  - [x] SubTask 1.2: 当没有 `## ` 标题时，使用文件名作为默认项目名
  - [x] SubTask 1.3: 当 docPath 为空时，保持原有逻辑使用 docId

- [x] Task 2: 过滤任务数量为 0 的项目
  - [x] SubTask 2.1: 在 parseKramdown 方法末尾添加任务数量检查
  - [x] SubTask 2.2: 任务数量为 0 时返回 null
  - [x] SubTask 2.3: 任务数量为 0 时不打印解析日志

# Task Dependencies
- Task 2 依赖 Task 1（需要在确定项目名之后再判断任务数量）
