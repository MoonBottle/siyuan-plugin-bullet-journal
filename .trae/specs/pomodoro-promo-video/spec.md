# 番茄钟功能公众号宣传视频 Spec

## Why

任务助手插件 0.9.0 版本发布了全新的番茄钟功能，需要制作一个适合微信公众号发布的宣传视频，展示功能亮点，吸引用户更新体验。

视频目标：

1. 展示番茄钟核心功能（专注计时、统计数据、记录列表）
2. 突出与思源笔记深度集成的优势
3. 体现番茄工作法提升效率的价值
4. 适合公众号传播（竖版 9:16 或横版 16:9）

## What Changes

* **ADDED**: Remotion 视频项目结构

* **ADDED**: 视频场景组件（开场、功能展示、数据统计、结尾）

* **ADDED**: 动画效果（番茄图标动画、进度环、数字滚动）

* **ADDED**: 视频渲染配置（1080x1920 竖版，适配手机观看）

## Impact

* Affected code: 新建 `remotion-video/` 目录

* Affected files:

  * `remotion-video/src/Root.tsx` - 视频根组件

  * `remotion-video/src/scenes/` - 场景组件

  * `remotion-video/src/components/` - 可复用动画组件

  * `remotion-video/package.json` - 项目配置

## ADDED Requirements

### Requirement: 视频整体规格

The video SHALL be optimized for WeChat Official Account sharing.

#### Scenario: 视频尺寸

* **WHEN** 视频在手机上播放

* **THEN** 使用 1080x1920 (9:16 竖版) 或 1080x608 (16:9 横版)

* **AND** 帧率 30fps

* **AND** 总时长 60-65 秒

#### Scenario: 视频风格

* **WHEN** 用户观看视频

* **THEN** 配色使用番茄红 (#FF6347) 作为主色调

* **AND** 背景使用深色/浅色渐变（适配思源笔记主题）

* **AND** 字体使用现代无衬线字体

### Requirement: 开场场景 (0-8秒)

The video SHALL have an engaging opening scene introducing the feature.

#### Scenario: 番茄图标动画

* **WHEN** 视频开始播放

* **THEN** 显示动画番茄图标（弹跳进入）

* **AND** 显示标题 "🍅 番茄钟功能上线"

* **AND** 显示副标题 "任务助手 v0.9.1"

#### Scenario: 品牌展示

* **WHEN** 开场动画完成

* **THEN** 显示思源笔记 Logo

* **AND** 显示插件名称 "任务助手"

### Requirement: 功能展示场景 (8-35秒)

The video SHALL showcase the three main features with smooth transitions.

#### Scenario: 专注计时展示 (8-18秒)

* **WHEN** 进入功能展示环节

* **THEN** 展示圆形进度条动画

* **AND** 显示倒计时 25:00 → 24:59 → 24:58

* **AND** 显示"专注中"状态

* **AND** 展示暂停/继续按钮交互

#### Scenario: 统计数据展示 (18-28秒)

* **WHEN** 展示完专注计时

* **THEN** 切换到统计面板

* **AND** 数字动画展示：今日番茄 6 个

* **AND** 数字动画展示：今日专注 2h 30m

* **AND** 展示总番茄数和总专注时长

#### Scenario: 记录列表演示 (28-35秒)

* **WHEN** 展示完统计数据

* **THEN** 展示历史记录列表

* **AND** 显示按日期分组的番茄记录

* **AND** 展示时间范围 14:00-14:25

* **AND** 展示关联的事项名称

### Requirement: AI 智能助手场景 (35-45秒)

The video SHALL showcase the AI integration for pomodoro queries.

#### Scenario: AI 查询番茄钟统计

* **WHEN** 进入 AI 功能展示环节

* **THEN** 展示 AI 对话界面

* **AND** 显示用户提问："帮我看看今天的专注统计"

* **AND** 展示 AI 回复：今日番茄数、专注时长

* **AND** 展示 AI 调用工具过程动画

#### Scenario: AI 查询番茄钟记录

* **WHEN** 展示完统计查询

* **THEN** 展示用户提问："我最近完成了哪些番茄钟？"

* **AND** 展示 AI 返回的记录列表

* **AND** 展示按日期分组的记录展示

### Requirement: 价值主张场景 (45-55秒)

The video SHALL communicate the value proposition of Pomodoro Technique.

#### Scenario: 番茄工作法介绍

* **WHEN** 功能展示完成

* **THEN** 显示"什么是番茄工作法？"

* **AND** 展示四个步骤图标：选择任务 → 设定计时 → 专注工作 → 短暂休息

* **AND** 显示效率提升数据 "提升 30% 工作效率"

#### Scenario: 核心优势对比

* **WHEN** 介绍完番茄工作法

* **THEN** 展示对比：传统工作方式 vs 番茄工作法

* **AND** 突出单任务专注、可视化记录、规律休息等优势

### Requirement: 结尾场景 (55-65秒)

The video SHALL have a clear call-to-action ending.

#### Scenario: CTA 结尾

* **WHEN** 视频接近尾声

* **THEN** 显示"立即体验"

* **AND** 显示更新指引：思源笔记 → 集市 → 更新任务助手

* **AND** 显示 GitHub 仓库链接

* **AND** 显示二维码占位（可放公众号二维码）

### Requirement: 动画组件库

The video SHALL provide reusable animation components.

#### Scenario: 番茄图标组件

* **WHEN** 需要展示番茄

* **THEN** 提供带动画的番茄 SVG 组件

* **AND** 支持弹跳、旋转、脉冲等动画效果

#### Scenario: 进度环组件

* **WHEN** 需要展示进度

* **THEN** 提供 SVG 圆形进度条组件

* **AND** 支持进度动画和颜色变化

#### Scenario: 数字滚动组件

* **WHEN** 需要展示统计数据

* **THEN** 提供数字递增动画组件

* **AND** 支持时长格式化 (2h 30m)

#### Scenario: 卡片组件

* **WHEN** 需要展示功能卡片

* **THEN** 提供带阴影和圆角的卡片容器

* **AND** 支持滑入、淡入等入场动画

### Requirement: 转场效果

The video SHALL use smooth transitions between scenes.

#### Scenario: 场景切换

* **WHEN** 从一个场景切换到另一个

* **THEN** 使用淡入淡出 (fade)

* **AND** 或滑动切换 (slide)

* **AND** 转场时长 15-20 帧 (0.5-0.7秒)

## Data Format

### VideoConfig

```typescript
interface VideoConfig {
  width: 1080;
  height: 1920; // 竖版 9:16
  fps: 30;
  durationInFrames: 1950; // 65秒
}
```

### Scene Timing

```typescript
interface SceneTiming {
  opening: [0, 240];           // 0-8秒
  focusTimer: [240, 540];      // 8-18秒
  stats: [540, 840];           // 18-28秒
  records: [840, 1050];        // 28-35秒
  aiAssistant: [1050, 1350];   // 35-45秒
  pomodoroIntro: [1350, 1650]; // 45-55秒
  ending: [1650, 1950];        // 55-65秒
}
```

## Assets Required

### 图片资源

* 思源笔记 Logo (SVG)

* 番茄图标 (SVG，可动画化)

* 功能截图（可选，可用代码实现 UI）

### 字体

* 标题字体：粗体无衬线

* 正文字体：常规无衬线

* 数字字体：等宽或tabular nums

### 配色方案

```
Primary: #FF6347 (番茄红)
Secondary: #4CAF50 (成功绿)
Background: #1a1a2e (深色背景)
Surface: #16213e (卡片背景)
Text Primary: #ffffff
Text Secondary: #a0a0a0
Accent: #e94560 (强调色)
```

