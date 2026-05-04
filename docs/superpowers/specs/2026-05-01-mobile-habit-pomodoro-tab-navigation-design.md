# 移动端习惯 / 番茄钟 Tab 导航改造设计

## 一、背景

当前移动端入口主要挂在 [MobileTodoDock.vue](/c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/mobile/MobileTodoDock.vue)：

- 待办是默认主视图
- 习惯通过 `state.showHabitView` 临时切进 [MobileHabitDock.vue](/c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/mobile/MobileHabitDock.vue)
- 番茄钟主入口仍是 `MobilePomodoroDrawer`
- 底部导航只存在于待办视图中，进入习惯或番茄钟后会脱离同一套底栏心智

这导致两个问题：

1. 习惯打卡在移动端实际上仍沿用 PC 风格的独立承载方式，没有形成移动端主导航的一部分
2. 番茄钟作为高频功能仍以抽屉式入口承载，进入后看不到固定底栏，和待办、习惯不在同一导航层级

本设计目标是将移动端改造成 **固定底栏 + 四个主 tab 的统一宿主结构**，让待办、番茄钟、习惯打卡都处于同一主导航体系中，同时严格隔离 PC 端行为。

---

## 二、目标

### 2.1 目标行为

移动端改造后：

- 底部固定显示四个 tab：`待办 / 番茄钟 / 习惯打卡 / 更多`
- 底栏在这四个主视图中始终常驻
- `待办` tab 才显示右下角悬浮 `+` 按钮
- `番茄钟` 从“抽屉主入口”改为“完整 tab 主视图”
- `习惯打卡` 从“待办里的临时分支视图”改为“完整 tab 主视图”
- 从待办事项发起番茄钟时，切换到番茄钟 tab，并保留底栏

### 2.2 非目标

本次不改动以下内容：

- PC 端 `DesktopTodoDock` / `DesktopHabitDock` / `PomodoroDock` 的交互和布局
- 习惯统计、打卡、记录、月历的业务规则
- 番茄钟计时、暂停、完成、休息的业务规则
- 为移动端重新设计一整套习惯详情视觉
- 改造桌面端的 tab / dock 注册策略

---

## 三、信息架构

### 3.1 主导航结构

移动端统一采用四个主 tab：

1. `待办`
2. `番茄钟`
3. `习惯打卡`
4. `更多`

顺序固定，不使用中央加号占位。

### 3.2 各 tab 职责

#### 待办

- 承载当前 `MobileTodoDock` 中除习惯视图、番茄钟主入口之外的待办功能
- 保留筛选、详情抽屉、项目/任务详情、提醒/重复设置等能力
- 唯一显示右下角悬浮 `+` 按钮

#### 番茄钟

- 承载原 `MobilePomodoroDrawer` 的主内容
- 作为主页面进入，而不是作为待办页上的抽屉主入口
- 仍允许局部使用抽屉或 sheet 处理次级流程，例如选择事项、结束确认、补录说明

#### 习惯打卡

- 承载当前 `MobileHabitDock` 的习惯列表、详情、日历、记录
- 作为底栏主 tab 呈现，而不是待办里的临时切换页

#### 更多

- 承接不适合进入主任务流、但仍需要从移动端底栏快速到达的入口
- 第一阶段可以保持轻量，只放现有次级入口

---

## 四、交互设计

### 4.1 底栏常驻规则

底栏在以下视图中常驻：

- 待办主视图
- 番茄钟主视图
- 习惯打卡主视图
- 更多主视图

允许被以下覆盖层视觉盖住，但不应从组件树中移除：

- 全屏 drawer
- 底部 sheet
- 弹窗 / 遮罩层

### 4.2 `+` 按钮规则

原底栏中的创建入口改为 `待办` tab 专属右下角悬浮按钮：

- 只在 `activeTab === 'todo'` 时显示
- 行为与现有 `openQuickCreate` 一致
- 不再占用底栏中间导航位

### 4.3 习惯与番茄钟切换规则

#### 习惯

- 点击底栏 `习惯打卡`：切到习惯主视图
- 不再使用 `state.showHabitView = true` 的分支模型

#### 番茄钟

- 点击底栏 `番茄钟`：切到番茄钟主视图
- 不再使用“打开番茄钟抽屉”作为主导航行为

### 4.4 从待办发起番茄钟

从待办项中点击“番茄钟”时：

- 切换到底栏 `番茄钟` tab
- 将当前事项 `blockId` 作为预选参数传入番茄钟主视图
- 底栏保持可见

这保证“从事项发起专注”仍然是一条连续路径，而不是跳进与主导航脱节的抽屉世界。

### 4.5 深层页面规则

各主 tab 内部仍可拥有自己的详情层级，例如：

- 待办的事项详情、项目详情、任务详情
- 习惯的详情页
- 番茄钟的选择事项、完成补录等流程

这些深层页面由对应 panel 内部管理，不改变底栏所属的主导航层级。

---

## 五、架构设计

### 5.1 新的移动端宿主

新增统一宿主组件，建议命名：

- `MobileMainShell.vue`

职责：

- 持有移动端主导航状态
- 渲染固定底栏
- 切换四个主 panel
- 控制 `+` 悬浮按钮只在待办 tab 出现

该宿主只存在于移动端，不进入 PC 端组件体系。

### 5.2 Panel 拆分

建议拆分为：

- `MobileTodoPanel.vue`
- `MobilePomodoroPanel.vue`
- `MobileHabitPanel.vue`
- `MobileMorePanel.vue`
- `MobileBottomTabBar.vue`
- `MobileCreateFab.vue`

其中：

- `MobileTodoPanel` 由当前 `MobileTodoDock.vue` 演化而来
- `MobileHabitPanel` 由当前 `MobileHabitDock.vue` 演化而来
- `MobilePomodoroPanel` 从现有 `MobilePomodoroDrawer` 主内容抽出

### 5.3 状态边界

主导航状态仅存在于 `MobileMainShell`：

- `activeTab: 'todo' | 'pomodoro' | 'habit' | 'more'`
- `pendingTabPayload`（可选）

业务状态继续留在各自 panel 内：

- Todo panel 管待办筛选、详情抽屉、创建入口
- Habit panel 管日期、选中习惯、详情展开
- Pomodoro panel 管预选事项、当前计时主视图

不把移动端 tab 状态塞进 Pinia 全局 store，避免污染桌面端和业务 store。

---

## 六、迁移设计

### 6.1 `MobileTodoDock.vue`

当前文件承担了过多职责：

- 待办主内容
- 习惯视图切换
- 番茄钟抽屉主入口
- 移动端底栏

迁移后它应收敛为 `MobileTodoPanel`，只保留：

- FilterBar
- TodoList
- Item / Project / Task 详情
- QuickCreate
- Reminder / Recurring 设置
- 从待办项发起番茄钟的事件

需要移除：

- `showHabitView`
- `MobileBottomNav` 的习惯/番茄钟主导航职责
- “番茄钟作为底栏主入口时只开抽屉”的交互模型

### 6.2 `MobileHabitDock.vue`

当前文件假设自己是一个独立移动端页面根节点。

迁移后它应收敛为 `MobileHabitPanel`：

- 保留习惯列表、周条、详情、月历、打卡日志
- 去除“自己是移动端一级页面”的假设
- 不再负责底栏和主导航

### 6.3 番茄钟抽屉迁移

当前番茄钟核心承载仍在 `MobilePomodoroDrawer`。

迁移策略：

- 抽出一个可嵌入页面容器的 `MobilePomodoroPanel`
- 第一阶段允许复用现有番茄钟 drawer 中的内部内容组件
- 第二阶段再按需要继续清理“只适合 drawer 的容器壳”

目标是让“番茄钟主入口”进入的是 tab 页面，而不是 drawer。

### 6.4 移动端入口接线

`TodoDock.vue` 的移动端分支改为挂 `MobileMainShell`。

兼容要求：

- `HabitDock.vue` 在移动端不再展示独立的 habit 页面根结构
- 如果有旧入口尝试打开移动端 habit dock，应转发到 shell 的 `habit` tab
- 如果有旧入口尝试打开移动端 pomodoro dock，应转发到 shell 的 `pomodoro` tab

桌面端分支保持不动。

---

## 七、PC 隔离边界

本次改造必须满足以下硬约束：

1. 不修改 PC 端 dock 的主交互
2. 不让移动端宿主状态进入桌面共用 store
3. 不将桌面专属组件重写成偏移动端职责
4. 所有新增宿主/底栏/panel 组件均放在 `src/mobile/` 目录下
5. 双端入口文件只调整 `isMobile` 分支

允许的共享仅限于：

- Pinia 业务 store 数据读取
- 习惯/番茄钟底层业务服务
- 通用工具函数

---

## 八、测试设计

### 8.1 导航测试

需要补充移动端 shell 级测试：

- 默认进入 `待办` tab
- 点击底栏可在 `待办 / 番茄钟 / 习惯 / 更多` 间切换
- 切到非待办 tab 时不显示 `+`
- 切回待办 tab 时显示 `+`

### 8.2 行为测试

需要验证：

- 从待办项点击番茄钟，会切到 `番茄钟` tab，并带预选事项
- 点击底栏 `习惯打卡`，能进入习惯主视图且底栏仍在
- 点击底栏 `番茄钟`，能进入番茄钟主视图且底栏仍在

### 8.3 回归测试

需要确认：

- PC 端 todo / habit / pomodoro 入口与视图不受影响
- 现有待办抽屉与详情功能不回归
- 现有习惯数据刷新、导航事件不回归
- 现有番茄钟计时和记录流程不回归

---

## 九、实现顺序

推荐分三阶段推进：

### 阶段 1：壳层到位

- 新增 `MobileMainShell`
- 新增 `MobileBottomTabBar`
- 新增 `MobileCreateFab`
- 接入 `TodoDock.vue` 移动端分支

此阶段先让底栏常驻和四个 tab 切换成立。

### 阶段 2：内容拆分

- `MobileTodoDock.vue` 收敛为 `MobileTodoPanel`
- `MobileHabitDock.vue` 收敛为 `MobileHabitPanel`
- 新增 `MobilePomodoroPanel`

此阶段完成主内容迁移。

### 阶段 3：兼容和回归

- 旧 habit / pomodoro 移动端入口转发到 shell
- 修正事件流和参数传递
- 补齐测试并跑回归

---

## 十、权衡

本设计选择“单宿主 + 四个主 tab”，而不是继续让 `MobileTodoDock` 内部承载一切，原因是：

- 底栏常驻是宿主级能力，不适合分散在业务页面里
- 习惯和番茄钟都已经具备主功能属性，继续作为待办的次级分支会让移动端结构越来越混乱
- 导航状态与业务状态拆分后，更容易保证 PC 不受影响

代价是：

- 需要拆开现有 `MobileTodoDock.vue` 的复合职责
- 番茄钟需要从 drawer 入口思路迁移到 panel 入口思路
- 移动端入口接线需要做一轮兼容梳理

这个代价是可接受的，因为它换来的是更稳定的移动端导航骨架，后续加功能时不会继续在一个超重组件里堆分支。
