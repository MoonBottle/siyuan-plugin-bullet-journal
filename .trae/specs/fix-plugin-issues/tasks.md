# Tasks

- [ ] Task 1: 修复 README.md 和 README_zh_CN.md 中的链接路径
  - [ ] SubTask 1.1: 修改 README.md 中的 `[简体中文](./README_zh_CN.md)` 为合适的格式
  - [ ] SubTask 1.2: 修改 README_zh_CN.md 中的 `[English](./README.md)` 为合适的格式

- [ ] Task 2: 移除 vite.config.ts 中的 asset 目录打包配置
  - [ ] SubTask 2.1: 删除 viteStaticCopy 中 asset 目录的复制配置

- [ ] Task 3: 添加插件卸载时的数据清理逻辑
  - [ ] SubTask 3.1: 在 src/index.ts 的 HKWorkPlugin 类中添加 uninstall() 方法
  - [ ] SubTask 3.2: 实现删除 settings 数据的逻辑
  - [ ] SubTask 3.3: 添加错误处理，使用 showMessage 显示错误信息

# Task Dependencies
- Task 1 和 Task 2 可以并行执行
- Task 3 依赖于代码结构理解，可以独立执行
