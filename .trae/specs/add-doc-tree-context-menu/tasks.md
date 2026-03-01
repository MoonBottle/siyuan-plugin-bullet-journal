# Tasks

- [x] Task 1: 在 main.ts 中创建文档树菜单处理方法
  - [x] SubTask 1.1: 创建 `registerDocTreeMenu` 方法
  - [x] SubTask 1.2: 创建 `handleDocTreeMenu` 事件处理函数
  - [x] SubTask 1.3: 创建 `unregisterDocTreeMenu` 方法用于移除监听

- [x] Task 2: 实现菜单项添加逻辑
  - [x] SubTask 2.1: 在事件处理中判断 type 是否为 `doc` 或 `docs`
  - [x] SubTask 2.2: 使用 `menu.addItem` 添加"添加到子弹笔记"菜单项
  - [x] SubTask 2.3: 实现获取文档路径的辅助方法（从 elements 中获取）

- [x] Task 3: 实现添加目录到设置的功能
  - [x] SubTask 3.1: 点击菜单项后，将文档路径添加到 `settings.directories`
  - [x] SubTask 3.2: 自动保存设置
  - [x] SubTask 3.3: 显示成功提示消息

- [x] Task 4: 在 index.ts 中集成
  - [x] SubTask 4.1: 在 `onload` 方法中调用 `registerDocTreeMenu`
  - [x] SubTask 4.2: 在 `onunload` 方法中调用 `unregisterDocTreeMenu`

- [x] Task 5: 修复 - 将事件处理逻辑移到插件类中
  - [x] SubTask 5.1: 在插件类中添加 `handleDocTreeMenu` 方法
  - [x] SubTask 5.2: 使用 `this.eventBus.on('open-menu-doctree', this.handleDocTreeMenu.bind(this))` 注册
  - [x] SubTask 5.3: 清理 main.ts 中不再需要的函数

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 3
- Task 5 depends on Task 4
