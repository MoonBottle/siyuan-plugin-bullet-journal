# Tasks

- [x] Task 1: 添加新的配置项 `enableStatusBarTimer`
  - [x] SubTask 1.1: 在 `src/settings/types.ts` 的 `PomodoroSettings` 接口中添加 `enableStatusBarTimer?: boolean`
  - [x] SubTask 1.2: 在 `defaultPomodoroSettings` 中设置默认值为 `false`
  - [x] SubTask 1.3: 在 `src/settings/pomodoroConfig.ts` 中添加配置项 UI
  - [x] SubTask 1.4: 在 i18n 文件中添加配置项的文案

- [x] Task 2: 修改底栏倒计时 DOM 结构
  - [x] SubTask 2.1: 创建新的 `showStatusBarTimer()` 方法，创建包含图标、时间、按钮的完整面板
  - [x] SubTask 2.2: 添加播放/暂停按钮的点击事件处理
  - [x] SubTask 2.3: 添加番茄图标点击事件（打开番茄 Dock）

- [x] Task 3: 更新底栏倒计时显示逻辑
  - [x] SubTask 3.1: 修改 `updateFloatingTomatoDisplay()` 方法，更新底栏面板的时间显示
  - [x] SubTask 3.2: 根据专注状态（进行中/暂停）更新播放/暂停按钮图标
  - [x] SubTask 3.3: 休息时切换为咖啡图标并显示休息倒计时
  - [x] SubTask 3.4: 参考悬浮按钮的休息图标 SVG

- [x] Task 4: 添加底栏倒计时样式
  - [x] SubTask 4.1: 在 `index.scss` 中添加 `.bullet-journal-status-bar-timer` 面板样式
  - [x] SubTask 4.2: 添加按钮悬停效果
  - [x] SubTask 4.3: 使用思源主题变量

- [x] Task 5: 处理面板显示/隐藏
  - [x] SubTask 5.1: 专注开始时显示底栏面板
  - [x] SubTask 5.2: 专注完成或取消时隐藏底栏面板
  - [x] SubTask 5.3: 休息开始时显示休息倒计时
  - [x] SubTask 5.4: 休息结束时隐藏底栏面板

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 can be done in parallel with Task 2 and Task 3
- Task 5 depends on Task 2, Task 3 and Task 4
