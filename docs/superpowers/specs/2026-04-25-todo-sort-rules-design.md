# Todo Dock 多规则排序设计

## 一、功能概述

本设计为 Todo Dock 增加可持久化的多规则排序能力。用户可以像 SQL `order by` 一样，按顺序配置多条排序规则，每条规则由“字段 + 升降序”组成，运行时依次生效。

当前系统已经存在固定排序逻辑：先按优先级，再按时间。本次设计保留这一行为作为默认配置，确保旧用户升级后展示结果不变。

### 1.1 设计目标

- **兼容现有行为**：默认排序规则等价于当前 `优先级 -> 时间`
- **排序能力可组合**：支持用户自定义多条排序规则，按列表顺序依次比较
- **设置可持久化**：排序规则写入 `todoDock` 设置并随插件配置保存
- **排序逻辑单点收口**：统一由 `projectStore` 执行排序，避免 UI 层各自实现
- **Dock 空间克制**：排序入口使用图标 + tooltip，不在主界面占用额外文案空间

---

## 二、需求范围

### 2.1 已有能力

当前 Todo Dock 已经支持：

- 分组筛选
- 搜索过滤
- 日期范围过滤
- 优先级过滤
- 固定排序：优先级优先，时间次之
- `todoDock` 视图设置持久化（如隐藏已完成、隐藏已放弃、显示链接等）

### 2.2 本次新增能力

本次新增：

- Todo Dock 中增加排序设置图标入口
- 支持用户配置多条排序规则
- 支持规则新增、删除、上移、下移
- 支持每条规则设置升序 / 降序
- Todo Dock 中提醒 / 重复按钮样式与详情弹框保持一致
- Todo Dock 中提醒 / 重复 tooltip 逻辑与详情弹框保持一致
- Todo / 详情弹框 / 番茄钟专注视图中的链接 UI/UE 抽成共享组件
- 支持以下排序字段：
  - 优先级
  - 时间
  - 日期
  - 提醒时间
  - 项目名
  - 任务名
  - 内容
- 排序规则持久化到 `settingsStore.todoDock`

### 2.3 非目标

本次不做：

- 不改动移动端 Todo Dock 的 UI
- 不增加独立设置页入口
- 不提供拖拽排序规则，第一版使用上下移动按钮
- 不支持任意表达式或脚本化排序
- 不更改现有过滤逻辑，仅在过滤后改变排序行为

---

## 三、交互设计

### 3.1 入口位置

排序入口放在 `src/tabs/DesktopTodoDock.vue` 的现有筛选区中，与分组、日期、优先级控件处于同一层级。

入口仅显示图标，不显示当前排序规则文案：

- 默认状态和已配置状态外观一致
- hover 时通过 tooltip 展示文案，例如“排序设置”
- 点击图标打开排序规则编辑面板
- 图标使用 `docs/API/icons.md` 中已有可用图标，第一版固定采用 `iconSort`

这样可以避免 Dock 横向空间被长文案占用，也避免规则变化引发布局抖动。

### 3.2 编辑面板

点击排序图标后，打开轻量排序规则编辑面板。面板中展示一个有序规则列表，每行包含：

- 字段下拉框
- 升序 / 降序下拉框
- 上移按钮
- 下移按钮
- 删除按钮

面板底部包含：

- `新增规则`
- `恢复默认`

第一版不单独提供“保存”按钮，所有调整即时生效并即时持久化。

### 3.3 编辑约束

- 同一字段不能重复添加
- 新增规则时，字段下拉中自动排除已使用字段
- 至少保留一条规则，不允许用户删除到空列表
- 如果配置因异常变成空列表，加载时自动恢复默认规则

### 3.4 提醒 / 重复按钮对齐

Todo Dock 中事项卡片里的提醒 / 重复操作，视觉和交互需与 `ItemDetailDialog.vue` 对齐：

- 使用与详情弹框一致的按钮形态
- 保持一致的 `active / readonly / disabled / hover` 状态表达
- tooltip 文案逻辑保持一致
- 不修改提醒 / 重复当前使用的图标语义，本次只统一按钮形态与交互

这意味着 Todo Dock 中现有轻量 pill 样式不再单独维护，而是与详情弹框共享同一套按钮结构或样式抽象，避免后续继续漂移。

### 3.5 链接展示组件统一

当前桌面端多个位置已经在展示同一批链接语义，但 UI 实现仍然分散：

- `TodoItemMeta.vue`
- `ItemDetailDialog.vue`
- `PomodoroActiveTimer.vue`

本次需要把链接展示抽成共享组件，统一以下内容：

- 链接按钮形态
- 链接类型样式（如 `external` / `siyuan` / `block-ref`）
- hover / tooltip 表达
- 点击交互语义
- 多链接排列方式

`PomodoroActiveTimer.vue` 中项目、任务、事项卡片里的链接，也要切换到该共享组件，确保番茄钟专注视图与 Todo / 详情弹框使用一致的链接 UI/UE。

共享组件职责保持单一，只负责“链接集合展示”或“单个链接胶囊展示”，不吸收 project / task / item 卡片本身的业务结构。

---

## 四、数据模型设计

### 4.1 新增排序类型

在类型层新增 Todo Dock 排序规则模型：

```ts
export type TodoSortField =
  | 'priority'
  | 'time'
  | 'date'
  | 'reminderTime'
  | 'project'
  | 'task'
  | 'content';

export type TodoSortDirection = 'asc' | 'desc';

export interface TodoSortRule {
  field: TodoSortField;
  direction: TodoSortDirection;
}
```

### 4.2 设置结构

在 `todoDock` 设置对象中新增：

```ts
todoDock: {
  hideCompleted: boolean;
  hideAbandoned: boolean;
  showLinks: boolean;
  showReminderAndRecurring: boolean;
  sortRules: TodoSortRule[];
}
```

### 4.3 默认配置

默认排序规则为：

```ts
[
  { field: 'priority', direction: 'asc' },
  { field: 'time', direction: 'asc' },
]
```

该默认值语义上等价于当前行为：

- 优先级顺序：高 -> 中 -> 低 -> 无
- 同优先级下按时间从早到晚

旧配置升级时，如果未包含 `sortRules`，自动补入该默认值。

---

## 五、排序语义设计

### 5.1 总体规则

Todo Dock 的排序发生在过滤之后。

执行顺序为：

1. 分组过滤
2. 搜索过滤
3. 日期范围过滤
4. 优先级过滤
5. 已完成 / 已放弃过滤
6. 多规则排序

排序时按 `sortRules` 从前到后依次比较。前一条规则比较结果不为 0 时直接返回，相等时继续比较下一条。

### 5.2 各字段比较语义

#### 优先级

- 复用现有 `comparePriority`
- `asc` 表示：高 -> 中 -> 低 -> 无
- `desc` 表示：无 -> 低 -> 中 -> 高

#### 时间

时间字段取事项的具体时间值：

- 优先使用 `startDateTime`
- 没有具体时间时视为“无时间”

排序语义：

- 有具体时间的事项优先参与时间比较
- 无具体时间的事项排在有具体时间的事项之后
- 对于有具体时间的事项，按时间先后比较

#### 日期

- 使用 `item.date` 比较
- `asc` 为日期早的在前
- `desc` 为日期晚的在前

#### 提醒时间

- 使用提醒计算逻辑得到的提醒触发时间
- 有提醒时间的事项先参与比较
- 无提醒时间的事项固定排在有提醒时间的事项之后
- `asc` 为更早提醒的在前
- `desc` 为更晚提醒的在前，无提醒仍在最后

#### 项目名 / 任务名 / 内容

- 使用字符串比较
- 缺失值视为空字符串
- `asc` 为字典序升序
- `desc` 为字典序降序

### 5.3 空值处理

为保持列表扫描稳定性，空值处理固定如下：

- `提醒时间`：无提醒始终排最后
- `时间`：无具体时间（全天事项）始终排最后
- `项目名 / 任务名 / 内容`：缺失按空字符串处理

### 5.4 稳定性

当所有排序规则比较结果都相等时，保持原有数组顺序，避免界面在刷新时出现无意义抖动。

---

## 六、实现边界

### 6.1 `settingsStore` 与配置加载

需要修改：

- `src/settings/types.ts`
- `src/stores/settingsStore.ts`
- `src/index.ts`

职责：

- 扩展 `todoDock` 设置类型
- 在插件设置加载时为 `sortRules` 提供默认值
- 在保存时带上 `sortRules`
- 保证旧版本配置兼容升级

### 6.2 `projectStore`

需要修改：

- `src/stores/projectStore.ts`

职责：

- 抽出统一的 Todo 排序 comparator
- 将 `getFilteredAndSortedItems`
- `getFilteredCompletedItems`
- `getFilteredAbandonedItems`
  三处写死排序逻辑改为复用 `sortRules`
- 默认情况下使用 `settingsStore.todoDock.sortRules`

### 6.3 `DesktopTodoDock`

需要修改：

- `src/tabs/DesktopTodoDock.vue`

职责：

- 增加排序图标入口
- 渲染排序规则编辑面板
- 维护规则编辑交互（新增、删除、上下移动、改字段、改方向）
- 每次修改后即时写入 `settingsStore.todoDock.sortRules` 并保存
- 排序按钮使用 `iconSort`

### 6.4 `TodoSidebar`

原则上不新增排序职责。

`TodoSidebar.vue` 继续消费 store 返回的已排序结果，仅在必要时接收很轻的展示态信息，不自行重复实现排序逻辑。

### 6.5 `TodoItemMeta` 与 `ItemDetailDialog`

需要修改：

- `src/components/todo/TodoItemMeta.vue`
- `src/components/dialog/ItemDetailDialog.vue`

职责：

- 抽出提醒 / 重复按钮的共享样式或共享渲染结构
- 让 Todo Dock 与详情弹框在按钮形态、状态反馈、tooltip 文案上保持一致
- 保持提醒 / 重复当前图标不变，不将这两个按钮切换到新的图标集合

### 6.6 链接展示组件与 `PomodoroActiveTimer`

需要修改：

- `src/components/todo/TodoItemMeta.vue`
- `src/components/dialog/ItemDetailDialog.vue`
- `src/components/pomodoro/PomodoroActiveTimer.vue`
- 新增共享链接组件文件（命名在 implementation plan 中确定）

职责：

- 抽出共享链接展示组件，承载统一的链接 UI/UE
- 替换当前分散的 `SyButton type="link"` 与局部 `typed-link` 渲染
- 让 Todo、详情弹框、番茄钟专注视图中的链接视觉和交互一致
- 保持链接类型视觉区分能力不丢失

---

## 七、错误处理与兼容性

### 7.1 配置异常

以下场景自动回退到默认排序规则：

- `sortRules` 不是数组
- `sortRules` 为空数组
- 规则字段不存在于允许列表中
- 规则方向不是 `asc` / `desc`

### 7.2 字段缺失

某些字段并非所有事项都存在，例如：

- 无提醒时间
- 无任务名
- 无项目名
- 无具体时间

排序逻辑需要显式处理这些缺失值，不能依赖运行时报错或隐式类型转换。

### 7.3 老用户升级

对于未配置 `sortRules` 的历史用户：

- UI 中直接看到默认排序规则生效
- 列表顺序与升级前一致
- 首次修改排序后再写入新配置结构

---

## 八、测试设计

### 8.1 单元测试

重点覆盖：

- 默认规则与当前排序行为一致
- 多规则按顺序生效
- `priority asc + time asc`
- `time asc + priority desc`
- `reminderTime asc` 时无提醒排最后
- `reminderTime desc` 时无提醒仍排最后
- 字符串字段升降序比较
- 空配置自动回退默认规则

### 8.2 组件行为验证

重点验证：

- 排序图标始终展示，不显示长文案
- hover tooltip 正确
- 排序按钮图标为 `iconSort`
- 新增规则时不允许重复字段
- 上移 / 下移 / 删除后列表立即刷新
- 刷新插件或重新打开 Dock 后排序配置仍生效
- Todo Dock 中提醒 / 重复按钮与详情弹框形态一致
- Todo Dock 中提醒 / 重复 tooltip 与详情弹框逻辑一致
- Todo / 详情弹框 / 番茄钟中的链接都复用共享组件
- 链接类型样式与点击体验在三个场景中保持一致

### 8.3 回归验证

重点回归：

- 搜索、日期、优先级过滤与排序叠加后结果正确
- 已完成 / 已放弃分组仍能正确显示
- 未来日期分组、今日、明日、过期分组展示不受破坏

---

## 九、实施建议

建议按以下顺序实施：

1. 先补类型与默认配置
2. 再抽 `projectStore` 统一 comparator，并补单元测试
3. 最后接入 `DesktopTodoDock.vue` 的图标入口和规则编辑面板

这样可以先把排序语义稳定下来，再做 UI，降低调试成本。

---

## 十、结论

本方案以最小的 UI 占用，为 Todo Dock 增加完整的多规则排序能力，并顺带收敛桌面端几个主要视图之间已经出现分叉的提醒 / 重复按钮与链接展示样式。排序配置采用有序规则数组建模，既能保持当前默认行为兼容，也能满足用户对“类似 SQL `order by`”的自定义需求；提醒 / 重复按钮和链接展示则通过共享样式、共享结构或共享组件实现一致的视觉与交互语义。运行时排序逻辑统一收口到 `projectStore`，展示层样式统一收口到共享 UI 抽象，保证后续维护时不再出现同类控件各自漂移的问题。
