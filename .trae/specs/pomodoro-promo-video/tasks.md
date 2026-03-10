# Tasks

- [x] Task 1: 初始化 Remotion 视频项目
  - [x] SubTask 1.1: 创建 `remotion-video/` 目录结构
  - [x] SubTask 1.2: 初始化 package.json，安装 remotion 依赖
  - [x] SubTask 1.3: 配置 tsconfig.json 和 remotion.config.ts
  - [x] SubTask 1.4: 创建基础入口文件 src/index.ts

- [x] Task 2: 创建动画组件库
  - [x] SubTask 2.1: 创建 TomatoIcon 组件（带动画的番茄 SVG）
  - [x] SubTask 2.2: 创建 ProgressRing 组件（圆形进度条）
  - [x] SubTask 2.3: 创建 AnimatedNumber 组件（数字滚动动画）
  - [x] SubTask 2.4: 创建 Card 组件（带入场动画的卡片）
  - [x] SubTask 2.5: 创建 Background 组件（渐变背景）

- [x] Task 3: 实现开场场景 (0-8秒)
  - [x] SubTask 3.1: 创建 OpeningScene 组件
  - [x] SubTask 3.2: 实现番茄图标弹跳进入动画
  - [x] SubTask 3.3: 实现标题和副标题淡入效果
  - [x] SubTask 3.4: 添加品牌 Logo 展示

- [x] Task 4: 实现专注计时展示场景 (8-18秒)
  - [x] SubTask 4.1: 创建 FocusTimerScene 组件
  - [x] SubTask 4.2: 实现圆形进度条倒计时动画
  - [x] SubTask 4.3: 实现时间数字递减效果 (25:00 → 24:30)
  - [x] SubTask 4.4: 添加"专注中"状态标签和脉冲动画
  - [x] SubTask 4.5: 展示暂停/继续按钮 UI

- [x] Task 5: 实现统计数据展示场景 (18-28秒)
  - [x] SubTask 5.1: 创建 StatsScene 组件
  - [x] SubTask 5.2: 实现四宫格统计卡片布局
  - [x] SubTask 5.3: 实现数字递增动画（今日番茄 0→6）
  - [x] SubTask 5.4: 实现时长格式化动画（0m → 2h 30m）
  - [x] SubTask 5.5: 添加卡片依次入场动画

- [x] Task 6: 实现记录列表演示场景 (28-35秒)
  - [x] SubTask 6.1: 创建 RecordsScene 组件
  - [x] SubTask 6.2: 实现日期分组标题
  - [x] SubTask 6.3: 实现记录列表项滑入动画
  - [x] SubTask 6.4: 展示时间范围和事项名称
  - [x] SubTask 6.5: 添加番茄图标装饰

- [x] Task 7: 实现 AI 智能助手场景 (35-45秒)
  - [x] SubTask 7.1: 创建 AIAssistantScene 组件
  - [x] SubTask 7.2: 实现 AI 对话界面布局
  - [x] SubTask 7.3: 实现用户消息气泡动画
  - [x] SubTask 7.4: 实现 AI 回复打字机效果
  - [x] SubTask 7.5: 展示工具调用过程动画
  - [x] SubTask 7.6: 实现专注度报告卡片展示

- [x] Task 8: 实现价值主张场景 (45-55秒)
  - [x] SubTask 8.1: 创建 PomodoroIntroScene 组件
  - [x] SubTask 8.2: 实现"什么是番茄工作法"标题动画
  - [x] SubTask 8.3: 创建四个步骤图标（选择→设定→专注→休息）
  - [x] SubTask 8.4: 实现步骤图标依次展示动画
  - [x] SubTask 8.5: 添加"提升30%效率"数据显示
  - [x] SubTask 8.6: 实现传统 vs 番茄工作法对比（可选）

- [x] Task 9: 实现结尾场景 (55-65秒)
  - [x] SubTask 9.1: 创建 EndingScene 组件
  - [x] SubTask 9.2: 实现"立即体验"CTA 动画
  - [x] SubTask 9.3: 添加更新指引步骤
  - [x] SubTask 9.4: 展示 GitHub 链接
  - [x] SubTask 9.5: 添加二维码占位区域

- [x] Task 10: 整合视频和转场
  - [x] SubTask 10.1: 创建 Root.tsx 整合所有场景
  - [x] SubTask 10.2: 配置 TransitionSeries 转场
  - [x] SubTask 10.3: 设置各场景时长和顺序
  - [x] SubTask 10.4: 添加淡入淡出转场效果

- [x] Task 11: 配置和测试
  - [x] SubTask 11.1: 配置视频输出参数（1080x1920, 30fps, 65秒）
  - [x] SubTask 11.2: 本地预览测试视频效果
  - [x] SubTask 11.3: 渲染输出 MP4 文件
  - [x] SubTask 11.4: 验证视频时长和质量

# Task Dependencies

- Task 2 依赖 Task 1
- Task 3-9 依赖 Task 2（可并行开发）
- Task 10 依赖 Task 3-9
- Task 11 依赖 Task 10
