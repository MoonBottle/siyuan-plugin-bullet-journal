# Desktop Pomodoro Floating Window Design

日期：2026-05-14
状态：设计已确认，可进入实现计划
范围：桌面端番茄钟独立悬浮窗、显示模式设置、页内悬浮回退与双宿主同步

## 1. 背景

当前项目的番茄钟悬浮能力已经具备两部分基础：

- `pomodoroStore` 负责专注状态、暂停、恢复、完成、休息与恢复逻辑
- `src/index.ts` 中已有页内悬浮番茄入口，配合 `floatingPomodoroViewState` 和 `floatingPomodoroDom` 渲染悬浮 UI

现状问题不在业务层，而在承载方式：

- 当前悬浮番茄仍属于主窗口 DOM
- 主窗口最小化后，页内悬浮也会一并消失
- 对于桌面专注场景，当前实现无法提供真正独立于主窗口的全局悬浮体验

参考 `pinch` 项目后，确认其“不受主窗口最小化影响”的关键不是普通浮层，而是单独创建 Electron `BrowserWindow`，并设置：

- `alwaysOnTop`
- `skipTaskbar`
- `minimizable: false`
- `setVisibleOnAllWorkspaces(true)`

因此，本次设计的核心不是重写番茄钟逻辑，而是将“悬浮番茄的显示宿主”从单一页内 DOM 扩展为可切换的多宿主模型。

## 2. 目标

本次设计目标：

1. 为桌面端番茄钟增加独立悬浮窗能力，使其不受主窗口最小化影响。
2. 保持 `pomodoroStore` 作为唯一真实状态源，不复制番茄业务逻辑。
3. 在设置中新增悬浮显示模式，支持：
   - 仅页内悬浮
   - 仅桌面悬浮窗
   - 同时显示
4. 在桌面悬浮窗不可用时，静默回退到现有页内悬浮。
5. 保持当前页内悬浮与胶囊式 UI 状态映射复用，避免维护两套独立视图逻辑。

## 3. 非目标

本次设计明确不包含：

- 休息阶段独立桌面悬浮窗
- 番茄完成弹窗迁移到独立桌面窗
- 通用化为任意模块可复用的全局窗口框架
- 新增复杂窗口布局、展开态、多尺寸切换
- 拖拽位置记忆、窗口尺寸记忆等增强特性
- 移动端桌面悬浮能力
- 替换或重做现有番茄 Dock 主界面

## 4. 产品决策

### 4.1 仅覆盖专注阶段

本次独立桌面悬浮窗只覆盖番茄钟专注中状态。

具体包含：

- 倒计时专注
- 正计时专注
- 暂停中的专注

不包含：

- 休息阶段
- 完成补填说明
- 统计列表

原因：

- 用户本次诉求是“主窗口最小化后仍保留专注悬浮窗”
- 休息与完成态仍可继续使用现有主界面流程
- 先收敛在专注态可显著降低跨窗口状态同步复杂度

### 4.2 保留现有总开关，新增显示模式

保留现有 `enableFloatingButton` 作为悬浮番茄总开关，并新增显示模式字段：

```ts
type FloatingDisplayMode = 'inline' | 'desktop' | 'both'
```

语义如下：

- `enableFloatingButton === false`
  - 不显示任何悬浮番茄
- `enableFloatingButton !== false` 且 `floatingDisplayMode === 'inline'`
  - 只显示页内悬浮
- `enableFloatingButton !== false` 且 `floatingDisplayMode === 'desktop'`
  - 优先显示桌面独立悬浮；若宿主不支持则静默回退为页内悬浮
- `enableFloatingButton !== false` 且 `floatingDisplayMode === 'both'`
  - 同时显示页内悬浮与桌面独立悬浮；若宿主不支持则只剩页内悬浮

### 4.3 静默回退，不改写用户设置

当用户选择 `desktop` 或 `both`，但当前运行环境不支持桌面独立悬浮时：

- 不弹提示
- 不报错中断
- 不自动改写设置项
- 直接回退到页内悬浮

原因：

- 用户已经明确选择静默回退
- 设置表达的是用户意图，不应因单次运行环境差异被自动覆盖

## 5. 架构设计

### 5.1 保持 `pomodoroStore` 为唯一状态源

本次不在桌面窗内维护独立番茄状态。

所有专注相关的真实状态继续来自：

- `activePomodoro`
- `remainingSeconds`
- `accumulatedSeconds`
- `isPaused`

桌面窗只消费派生后的显示状态，不直接参与业务判定。

### 5.2 引入悬浮宿主抽象

现有实现本质上只有一个“页内 DOM 宿主”。本次将其扩展为双宿主模型：

1. `inline host`
   - 现有页内悬浮实现
2. `detached host`
   - 新增桌面独立 `BrowserWindow`

主插件运行时负责：

- 根据设置决定启用哪些 host
- 将统一的视图状态同步到一个或多个 host
- 接收 host 动作并转发到现有番茄逻辑

### 5.3 复用现有视图派生层

继续复用：

- `src/utils/floatingPomodoroViewState.ts`
- `src/utils/floatingPomodoroDom.ts`

职责保持不变：

- `floatingPomodoroViewState`
  - 将番茄业务状态映射成可渲染视图状态
- `floatingPomodoroDom`
  - 将视图状态映射到具体 DOM 节点

这样可以确保：

- 页内悬浮与桌面悬浮使用完全一致的文案、进度、按钮状态
- 后续修复番茄悬浮文案或进度问题时，不需要改两套实现

## 6. 桌面悬浮窗实现

### 6.1 运行时能力探测

桌面独立悬浮只在桌面主窗口环境尝试启用。

建议判定规则：

1. 当前前端环境必须是 `desktop`
2. 运行时能够访问 Electron remote 风格能力
3. 能成功取得 `BrowserWindow`

以下环境直接视为不支持：

- `mobile`
- `desktop-window`
- 无法访问 Electron 能力的受限环境

### 6.2 独立窗口特征

桌面悬浮窗采用最小能力集实现，关键目标只有一个：保持独立存在并置顶。

建议窗口属性：

- `frame: false`
- `transparent: true`
- `resizable: false`
- `movable: true`
- `minimizable: false`
- `maximizable: false`
- `fullscreenable: false`
- `skipTaskbar: true`
- `alwaysOnTop: true`
- `show: false`
- `backgroundThrottling: false`

并在窗口创建后追加：

- `setAlwaysOnTop(true, 'screen-saver')`
- `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })`

### 6.3 最小内容承载

本次不在独立窗口中挂完整 Vue 应用。

独立窗口只承载：

- 一份轻量 HTML 壳
- 与页内悬浮一致的悬浮胶囊 DOM 结构
- 最少量交互绑定

原因：

- 当前桌面窗只是现有悬浮番茄的承载体替换
- 若挂完整 Vue 应用，会显著增加状态同步和依赖注入复杂度
- 现有 `floatingPomodoroDom` 已足以支撑本次 UI 展示需求

### 6.4 仅支持核心操作

独立桌面悬浮窗只支持以下操作：

- `暂停`
- `继续`
- `结束专注`

不支持：

- 休息态 `跳过休息`
- 打开完整配置页
- 承载统计或补填说明弹窗

这使窗口职责保持单一：显示当前专注状态，并允许用户做最关键的专注控制。

## 7. 状态流

### 7.1 插件启动

插件启动后：

1. 初始化悬浮番茄宿主管理
2. 读取 `enableFloatingButton` 与 `floatingDisplayMode`
3. 判断当前是否允许启用 `inline`、`desktop` 或两者

### 7.2 开始专注与恢复专注

当发生以下任一情况：

- 用户开始专注
- 插件恢复未完成专注
- 专注状态从暂停恢复

主插件根据当前 `pomodoroStore` 状态构造统一的 `FloatingPomodoroSourceState`，再同步给所有已启用 host。

### 7.3 专注中的状态更新

以下变化都必须通过统一入口同步：

- 倒计时 tick
- 正计时累计时间变化
- 暂停
- 继续
- 自动延长后目标变化
- 当前事项标题回退变化

设计要求：

- 不允许页内 host 和桌面 host 各自独立推导业务状态
- 所有 host 都从主插件给出的统一派生状态渲染

### 7.4 从悬浮窗触发动作

动作分发规则：

- 页内 host 按现有方式触发
- 桌面 host 只发送动作意图，不执行业务逻辑
- 主插件收到动作后，调用现有 `pomodoroStore` action

也就是说，桌面窗只是一个“远端控制面板”，不是第二套番茄执行器。

### 7.5 专注结束与销毁

以下情况必须统一销毁桌面窗和隐藏页内悬浮：

- 专注结束
- 专注被手动终止
- 插件卸载
- 当前运行环境切换导致桌面窗不再可用

目标是避免留下孤儿窗口或过期 UI。

## 8. 设置界面设计

### 8.1 桌面设置

在 `PomodoroConfigSection` 中：

- 保留“悬浮番茄按钮”总开关
- 新增“悬浮显示方式”配置

显示方式候选值：

- `页内悬浮`
- `桌面悬浮窗`
- `同时显示`

### 8.2 移动设置

移动端设置界面保持与桌面端一致的数据结构，也显示同一组选项。

运行时解释：

- 移动端不会真的启用桌面独立悬浮
- 若用户在移动端选择 `desktop` 或 `both`，运行时仍会自然退化为页内悬浮或无悬浮

原因：

- 保持设置模型一致，减少多端分叉逻辑
- 避免“某端能配、某端完全没有该字段”的数据兼容问题

## 9. 文件边界

建议主要改动以下文件：

- `src/settings/types.ts`
  - 新增 `floatingDisplayMode`
- `src/i18n/zh_CN.json`
- `src/i18n/en_US.json`
  - 新增显示模式文案
- `src/components/settings/PomodoroConfigSection.vue`
  - 新增显示模式设置 UI
- `src/utils/floatingPomodoroViewState.ts`
  - 仅在需要时补充通用类型，不改职责
- `src/utils/floatingPomodoroDom.ts`
  - 继续复用；必要时补少量桌面窗绑定辅助方法
- `src/utils/detachedPomodoroWindow.ts`
  - 新增桌面独立悬浮窗管理
- `src/index.ts`
  - 将现有单宿主悬浮逻辑整理为多宿主调度

本次不应把桌面窗实现散落到多个组件中，避免生命周期和清理责任不清。

## 10. 风险与约束

### 10.1 Electron 宿主能力差异

SiYuan 插件运行环境对 Electron 能力暴露可能存在版本差异。

因此桌面悬浮设计必须满足：

- 能力存在时启用
- 能力缺失时回退
- 不把不可用环境视作错误

### 10.2 多窗口上下文

项目当前已区分 `desktop` 和 `desktop-window`。若在多个窗口上下文中重复创建桌面悬浮窗，可能导致：

- 重复显示
- 动作竞争
- 清理不完全

因此本次明确只允许在桌面主窗口尝试创建独立悬浮窗。

### 10.3 两类宿主状态不一致

如果页内 host 和桌面 host 各自从 store 拉数据，极易出现：

- 文案不同步
- 时间显示瞬时不一致
- 暂停按钮状态错位

因此必须坚持“统一派生状态 -> 广播到宿主”的模型。

### 10.4 孤儿窗口清理

桌面独立 `BrowserWindow` 的最大工程风险是清理不彻底。

必须确保：

- 专注结束时关闭
- 插件卸载时关闭
- 初始化失败时不残留半成品实例

## 11. 测试要求

### 11.1 单元测试

应新增或补充以下覆盖：

- `floatingDisplayMode` 的设置默认值与模式解释
- 桌面能力探测的可用 / 不可用分支
- `desktop` 模式下不可用时回退到页内悬浮
- `both` 模式下不可用时仅保留页内悬浮
- 桌面窗动作分发到主插件逻辑的映射

### 11.2 回归测试

需要确保现有页内悬浮在 `inline` 模式下行为不变：

- 文案不变
- 进度不变
- 点击与拖拽行为不回归

### 11.3 手工验收

至少验证以下路径：

1. 桌面端 `inline`
   - 仅页内悬浮显示
2. 桌面端 `desktop`
   - 主窗口存在时显示桌面独立悬浮
   - 主窗口最小化后悬浮仍存在
3. 桌面端 `both`
   - 页内悬浮和桌面悬浮同时存在
4. 不支持桌面窗的环境
   - `desktop` 静默退化为页内悬浮
   - `both` 仅剩页内悬浮
5. 从桌面窗执行 `暂停 / 继续 / 结束专注`
   - 状态同步到页内悬浮和 Dock
6. 专注结束或插件卸载
   - 独立窗口被正确关闭

## 12. 验收标准

1. 桌面端新增独立番茄悬浮窗，并且主窗口最小化后仍可见。
2. 不修改 `pomodoroStore` 的核心计时与完成逻辑。
3. 设置中可选择 `页内悬浮`、`桌面悬浮窗`、`同时显示` 三种模式。
4. `desktop` 与 `both` 模式在不支持桌面窗时会静默回退。
5. 页内悬浮与桌面悬浮复用同一套视图状态映射，不出现独立文案分叉。
6. 桌面悬浮窗支持 `暂停 / 继续 / 结束专注` 三个核心操作。
7. 专注结束、插件卸载后不会残留独立悬浮窗实例。
