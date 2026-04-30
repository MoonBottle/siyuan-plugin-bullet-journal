# PC 习惯 Dock 导航交互设计

## 一、背景

当前 PC 端习惯 Dock 的列表视图里，习惯项整行点击会进入习惯详情页：

- 在 [DesktopHabitDock.vue](/c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/tabs/DesktopHabitDock.vue) 中，`HabitListItem` 的 `click` 事件直接设置 `selectedHabit`
- 在 [HabitListItem.vue](/c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/components/habit/HabitListItem.vue) 中，整行点击统一发出 `click`

这与待办列表的主交互不一致。待办列表主点击是打开文档，详情、日历等属于次级入口。

本设计的目标是让 **PC 习惯列表主点击对齐待办列表：点击打开文档**，同时保留一个明确的“进入打卡日历/习惯详情”入口。

---

## 二、目标

### 2.1 目标行为

在 PC 端习惯 Dock 列表页中：

- 点击习惯列表项主体：打开该习惯所在文档，并尽量定位到习惯 block
- 点击右侧新增的“日历/详情”入口：进入现有习惯详情页
- 点击右侧“打卡”或“+1”按钮：继续执行原有打卡行为，不触发打开文档或进入详情

### 2.2 非目标

本次不改动以下内容：

- MobileHabitDock 交互
- 习惯详情页内部布局
- 习惯统计与打卡逻辑
- 新增独立的“轻量日历页”

---

## 三、交互设计

### 3.1 列表页主交互

`HabitListItem` 拆分为三类动作：

- `open-doc`
  - 绑定在列表项主体区域
  - 语义为打开习惯所在文档
- `open-calendar`
  - 绑定在右侧新增图标按钮
  - 语义为进入现有习惯详情页
- `check-in` / `increment`
  - 保持现有按钮语义

不再使用“整行点击进入详情”的单入口模型。

### 3.2 右侧新增入口

在 `HabitListItem` 的操作区新增一个次级图标按钮：

- 建议使用日历图标，语义对用户更接近“进入打卡日历”
- 行为上进入现有详情页，而不是新页面
- 需要 `@click.stop`，避免冒泡触发主点击

按钮顺序建议：

- 二元型：`日历入口` + `打卡`
- 计数型：`日历入口` + `+1`

这样右侧操作区形成固定心智：

- 左侧主体 = 打开文档
- 右侧第一个小图标 = 进入打卡日历
- 右侧最后一个主按钮 = 立即打卡

### 3.3 详情页补回文档入口

主点击改为打开文档后，进入详情页的路径会变成次级入口。为了避免进入详情后失去回文档入口，`DesktopHabitDock` 顶栏在 `selectedHabit` 状态下增加一个“打开文档”图标按钮：

- 保留现有返回列表按钮
- 标题仍显示当前习惯名
- 在右侧增加“打开文档”按钮

行为：

- 打开 `selectedHabit.docId`
- 优先定位到 `selectedHabit.blockId`

这使得：

- 列表页可以快速打开文档
- 详情页里仍能回到原文
- 习惯详情不再是“单向钻取”

---

## 四、实现设计

### 4.1 `HabitListItem.vue`

调整事件模型：

- 删除现有泛化的 `click`
- 新增：
  - `open-doc`
  - `open-calendar`

DOM 结构建议：

- 将左侧主体区单独包裹为可点击区域，负责 `open-doc`
- 右侧 actions 区新增日历图标按钮，负责 `open-calendar`
- 原有打卡按钮继续 `stop propagation`

### 4.2 `DesktopHabitDock.vue`

列表页事件绑定改为：

- `@open-doc="handleOpenHabitDoc"`
- `@open-calendar="selectedHabit = $event"`
- `@check-in="handleCheckIn"`
- `@increment="handleIncrement"`

新增 `handleOpenHabitDoc(habit)`：

- 复用待办现有模式，调用 `openDocumentAtLine`
- 传入 `habit.docId`、可能存在的 `habit.lineNumber`、`habit.blockId`

详情页顶栏新增：

- `handleOpenSelectedHabitDoc()`

若 `selectedHabit` 缺少必要文档信息，则静默返回或提示错误，但不影响详情浏览。

### 4.3 文档打开策略

打开文档时遵循与待办一致的策略：

- 若有 `docId`，则优先打开文档
- 若同时有 `blockId`，则尽量定位到该 block
- 若有 `lineNumber`，则作为辅助定位信息传入

不新增新的文件打开工具函数，优先复用现有 `openDocumentAtLine`。

---

## 五、测试设计

### 5.1 组件测试

为 `HabitListItem` 补充测试：

- 点击主体区域触发 `open-doc`
- 点击日历按钮触发 `open-calendar`
- 点击打卡按钮只触发 `check-in`
- 点击 `+1` 按钮只触发 `increment`

### 5.2 Dock 交互测试

为 `DesktopHabitDock` 补充测试：

- 接收到 `open-doc` 时调用 `openDocumentAtLine`
- 接收到 `open-calendar` 时进入 `selectedHabit` 详情态
- 详情态顶栏“打开文档”按钮可再次打开对应文档

### 5.3 回归要求

需要确认以下行为不回归：

- 当前打卡按钮仍可正常打卡
- 计数型 `+1` 行为不变
- 进入详情页后现有周条、月历、记录列表仍正常显示

---

## 六、权衡

本设计选择“主点击打开文档，次级按钮进入详情”，而不是继续保留“主点击进详情”，原因是：

- 与待办列表心智统一
- 习惯列表作为文档索引入口更自然
- 不需要新造“轻量日历页”
- 保留现有详情页，改动面可控

代价是：

- 列表右侧操作区会比现在多一个图标按钮
- 需要更仔细处理点击冒泡，避免主点击和次级按钮串扰

这个代价是可接受的。
