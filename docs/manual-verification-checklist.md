# 人工验证功能清单

> 这份清单按当前代码实现整理，目标是覆盖手工回归时最容易漏掉的入口和副作用：斜杠命令、页面按钮、抽屉/弹窗、后台事件链路、桌面/移动端差异。

## 1. 使用说明

- 建议至少执行一轮桌面端验证；移动端、AI、通知、微信、原生通知属于条件满足时补测。
- 每个“写入型”操作都额外检查 4 件事：
  1. UI 立即刷新或在一次正常刷新后反映结果。
  2. 原块内容/属性真的被改写，不只是内存态变了。
  3. 关闭并重新打开对应页面后结果仍然存在。
  4. 不产生重复日期、重复提醒、重复 recurrence、重复番茄记录。
- 对所有需要“当前事项”的按钮，分别至少覆盖两种数据形态：
  - 普通段落事项
  - 任务列表事项 `- [ ] ...`

## 2. 测试前置数据

- [ ] 已配置至少 1 个启用目录，且能正常扫描出项目/任务/事项。
- [ ] 已配置至少 2 个项目组，便于验证 group filter、默认 group、工作台 widget 配置。
- [ ] 准备以下事项样本：
  - [ ] 普通待办：无日期、无提醒、无重复、无优先级。
  - [ ] 今日事项：`YYYY-MM-DD`，无时间。
  - [ ] 今日时段事项：有开始时间和结束时间。
  - [ ] 过期事项：日期早于今天，状态仍为 pending。
  - [ ] 重复事项：带 repeat rule，至少 1 条是任务列表事项。
  - [ ] 提醒事项：absolute 和 relative 各至少 1 条。
  - [ ] 多日期事项：主日期 + siblingItems。
  - [ ] 带优先级事项：high / medium / low 各 1 条。
  - [ ] 已置顶事项 1 条。
  - [ ] 带 focus plan 的事项 1 条。
- [ ] 准备以下习惯样本：
  - [ ] binary habit 1 条。
  - [ ] count habit 1 条，带 target / unit。
  - [ ] 带 reminder 的 habit 1 条。
  - [ ] archived habit 1 条。
- [ ] 条件满足时准备：
  - [ ] 桌面通知权限已允许。
  - [ ] 移动端原生通知能力可用。
  - [ ] AI provider 已配置。
  - [ ] 微信 ClawBot 已配置。

## 3. 斜杠命令

| 功能 | 别名 | 手工验证点 |
| --- | --- | --- |
| 标记今天 | `/jt` `/today` | 移除斜杠文本；给事项追加今天日期；已有今天日期时只提示，不重复写入。 |
| 标记明天 | `/mt` `/tomorrow` | 移除斜杠文本；追加明天日期；已有明天日期时不重复写入。 |
| 选择日期 | `/rq` `/date` | 弹日期选择；保存后追加指定日期；已存在同日期时不重复写入。 |
| 标记完成 | `/wc` `/done` | 移除斜杠文本；事项变 completed；已完成时仅提示。任务列表场景额外验证 recurrence 自动续写。 |
| 标记放弃 | `/fq` `/abandon` | 移除斜杠文本；事项变 abandoned；已放弃时仅提示。 |
| 打开日历 | `/rl` `/calendar` | 移除斜杠文本；打开 Calendar Tab；初始日期落在事项最近日期。 |
| 打开日历-日 | `/rlt` `/calendarday` | 打开 Calendar，初始 view 为 day。 |
| 打开日历-周 | `/rlz` `/calendarweek` | 打开 Calendar，初始 view 为 week。 |
| 打开日历-月 | `/rly` `/calendarmonth` | 打开 Calendar，初始 view 为 month。 |
| 打开日历-列表 | `/rll` `/calendarlist` | 打开 Calendar，初始 view 为 list。 |
| 打开甘特 | `/gt` `/gantt` | 移除斜杠文本；打开 Gantt Tab；初始日期落在事项最近日期。 |
| 开始专注 | `/zz` `/focus` | 移除斜杠文本；打开番茄钟启动弹窗并预选当前事项；已有 active focus / break 时只提示。 |
| 打开待办面板 | `/db` `/todo` | 移除斜杠文本；打开 Todo Dock。 |
| 设为项目目录 | `/ml` `/projectdir` | 把当前文档路径加入目录设置；默认挂到默认 group；重复目录不重复添加。 |
| 标记任务 | `/rw` `/task` | 移除斜杠文本；给当前块追加任务标记；已有任务标记时只提示。 |
| 查看详情 | `/xq` `/detail` | 移除斜杠文本；打开事项详情弹窗；详情里显示全部日期。 |
| 设置 focus plan | `/yj` `/focusplan` | 移除斜杠文本；打开 focus plan 弹窗；保存/清空后块内容和 UI 同步更新。 |
| 设置提醒 | `/tx` `/reminder` | 移除斜杠文本；打开 reminder 弹窗；保存/关闭提醒后块内容和 UI 同步更新。 |
| 设置重复 | `/cf` `/recurring` | 移除斜杠文本；打开 recurring 弹窗；保存/清空后块内容和 UI 同步更新。 |
| 创建技能 | `/cjskill` `/create-skill` `/skill` | 在当前文档上打开创建技能弹窗；创建成功后文档转为技能文档并按技能名重命名。 |
| 设置优先级 | `/yxj` `/priority` | 移除斜杠文本；弹优先级选择；可设置 high/medium/low，也可清空。 |
| 新建/编辑习惯 | `/xg` `/habit` | 普通文本场景创建 habit；已有 habit 定义场景更新原定义；在 record 上输入时不创建新 habit。 |
| 习惯打卡 | `/dk` `/checkin` | habit 定义上执行会打卡；count habit 会 +1；今日已打卡/达标时提示；非 habit 块会打开 Habit Dock。 |
| 打开习惯面板 | `/xgd` `/habits` | 直接打开 Habit Dock。 |

### 斜杠命令边界补测

- [ ] 同一事项重复执行 `/today`、`/tomorrow`、`/date`，不会写入重复日期。
- [ ] `/done`、`/abandon` 在普通段落和任务列表两种块形态下都生效。
- [ ] 斜杠命令执行后，块正文里不残留 slash token。
- [ ] 事项无效、blockId 缺失、非事项块时，有提示且不会写坏块内容。

## 4. 桌面端页面与按钮

### 4.1 Todo Dock

- [ ] 顶栏展开/收起全部正常工作，所有 section 同步折叠/展开。
- [ ] 顶栏刷新会重新拉取数据，且不会丢失当前 group / filter / sort 设定。
- [ ] 更多菜单可切换：隐藏已完成、隐藏已放弃、显示链接、显示 reminder/recurring。
- [ ] 搜索关键字过滤有效。
- [ ] 标签搜索、标签多选、点击标签 chip 取消筛选有效。
- [ ] group filter 有效。
- [ ] 日期过滤 today / thisWeek / thisMonth / recent7 / all / custom 都有效。
- [ ] custom date range 同时影响 pending 列表和 completed/abandoned 列表显示。
- [ ] priority filter 可叠加 high / medium / low。
- [ ] sort panel 可新增规则、删除规则、上移下移、重置为默认规则。
- [ ] 已置顶事项进入 pinned section，取消置顶后回到普通 section。
- [ ] 点击事项 tag 会回填到 tag filter。

### 4.2 Todo 列表项动作

- [ ] 完成按钮把事项设为 completed。
- [ ] 放弃按钮把事项设为 abandoned。
- [ ] 专注按钮打开番茄钟启动弹窗，并预选当前事项。
- [ ] focus plan 按钮可新增、编辑、清空计划。
- [ ] 迁移按钮对过期事项迁移到今天，对非过期事项迁移到明天。
- [ ] 打开文档按钮能定位到原块。
- [ ] 打开日历按钮能带当前日期跳转到 Calendar。
- [ ] pin/unpin 按钮可切换置顶状态。
- [ ] reminder 按钮可设置、修改、关闭提醒。
- [ ] recurring 按钮可设置、修改、清除重复规则与结束条件。
- [ ] 右键菜单中的完成、专注、迁移到今天/明天/自定义日期、放弃、打开文档、查看详情、打开日历、设置优先级都可用。

### 4.3 事项详情弹窗

- [ ] 项目、任务、事项卡片展示完整，链接可点击。
- [ ] 时间、时长、累计专注时长、focus plan、delta 显示正确。
- [ ] copy 按钮可复制项目名、任务名、事项内容、时长、专注时长。
- [ ] reminder / recurring 按钮在详情弹窗里也能打开对应设置弹窗。
- [ ] 过期且带 recurring 的事项会显示“跳过本次”，执行后当前事项日期推进到下一次 occurrence，而不是创建新块。
- [ ] 已完成/已放弃事项不再显示不该编辑的按钮，但已有 reminder / recurring 信息仍可展示。

### 4.4 Calendar

- [ ] 通过 slash command / item action 打开时，初始日期和初始 view 正确。
- [ ] 点击事件会打开事项详情。
- [ ] 右键菜单中的完成、专注、迁移、放弃、打开文档、详情、优先级都可用。
- [ ] 拖动事件会更新日期/开始时间/结束时间。
- [ ] 调整事件时长会更新结束时间。
- [ ] all-day 事项与带时间事项的拖拽写回都正确。
- [ ] 多日期事项在 Calendar 修改其中一个日期时，不会丢失 siblingItems。
- [ ] 番茄钟时间块展示正常，且不可被拖拽编辑。

### 4.5 Gantt

- [ ] 点击右侧任务条会打开事项详情。
- [ ] 右键菜单中的完成、专注、迁移、放弃、打开文档、详情都可用。
- [ ] Gantt 内项目/任务/事项分层展示正常，筛选到的数据与 Project / Todo 视图一致。

### 4.6 四象限

- [ ] 刷新按钮正常工作。
- [ ] 更多菜单可切换：隐藏已完成、隐藏已放弃、显示链接、显示 reminder/recurring。
- [ ] 搜索和 group filter 生效。
- [ ] 默认优先级象限配置下，可把事项拖到其他象限并写回优先级。
- [ ] 象限编辑器可修改单个 panel 规则，也可恢复默认配置。
- [ ] panel 内的 Todo 行为与 Todo Dock 保持一致：完成、专注、迁移、详情、pin、提醒、重复等都能用。

### 4.7 Project 视图

- [ ] 项目列表搜索有效。
- [ ] 左侧项目切换后，树和详情 pane 会同步更新。
- [ ] task tree 搜索有效。
- [ ] task tree tag filter 有效。
- [ ] 选中 task 时显示 task 详情；选中 item 时显示 item 详情、ItemActionBar、专注记录。

### 4.8 Habit Dock

- [ ] 周条切换日期后，habit 列表状态和 detail pane 同步变化。
- [ ] binary habit 点击可打卡；当天已打卡后再次点击不会重复创建记录。
- [ ] count habit 点击可 +1；达到 target 后状态变 completed。
- [ ] 右键菜单可把应打卡的 habit 标记为 missed。
- [ ] 对 completed / missed / partial 记录执行 reset，会删除或回退记录。
- [ ] 月历 cell 的 primary action、mark missed、reset 行为正常。
- [ ] archived habit 不能继续打卡；archive / unarchive 按钮生效。
- [ ] 打开文档按钮能定位到 habit 定义块或记录块。

### 4.9 Pomodoro / 专注

- [ ] 可从 Todo 行、右键菜单、slash command、Pomodoro Dock 启动专注。
- [ ] 启动弹窗支持选择事项、group、倒计时模式、正计时模式、快捷时长、自定义时长。
- [ ] 专注进行中支持暂停、继续、手动结束。
- [ ] Active Timer 中可直接完成事项、放弃事项、打开详情、打开文档、打开日历。
- [ ] 专注结束后会产生 pending completion 流程，而不是直接静默写记录。
- [ ] completion dialog 保存时，空描述、单行描述、多行描述都能正确写入番茄记录。
- [ ] completion dialog 保存时，如果原事项没有当天日期，会先补写番茄日期。
- [ ] 记录写入 block 模式和 attr 模式都能正常工作。
- [ ] 若专注时长低于 `minFocusMinutes`，弹窗仍允许“确认记录”或“丢弃记录”。
- [ ] auto extend 开启时，倒计时可自动延长；手动点击“专注延长”也可延长。
- [ ] 保存完成后可选择 break 时长并开始休息；也可跳过休息。
- [ ] break 进行中支持提前跳过；时间到会自动结束并提示。

### 4.10 Pomodoro Stats

- [ ] 刷新按钮会重新拉取统计数据。
- [ ] 概览卡片、热力图、趋势图、时间线、最佳专注时段图正常展示。
- [ ] 切换 today / week / month 统计范围时，图表和明细联动更新。

### 4.11 Focus Review

- [ ] 顶部刷新按钮可刷新统计。
- [ ] mini calendar 可切换日期，左侧 summary / 右侧 detail 联动变化。
- [ ] group filter 和 status filter 有效。
- [ ] “添加计划”可从候选事项中选中 item，并把 focus plan 写回该事项。
- [ ] 如果为未来日期添加 plan，且事项原本没有该日期，会先补日期再写 focus plan。
- [ ] detail pane 内的 ItemActionBar 与 ItemDetailContent 展示正确，专注记录列表正确。

### 4.12 Workbench

- [ ] 可创建 Dashboard。
- [ ] 可创建 Todo / Habit / Quadrant / Pomodoro Stats / Focus Review / Project 视图入口。
- [ ] 侧边栏支持选择、重命名、删除、拖拽排序、折叠。
- [ ] Dashboard 支持新增 widget：todoList、quadrantSummary、habitWeek、miniCalendar、pomodoroStats。
- [ ] 每个 widget 的配置弹窗都能打开、保存并持久化。
- [ ] 刷新/设置变更后，Workbench 里的嵌入视图和 widget 数据同步更新。

### 4.13 设置与持久化

- [ ] 目录、group、default group 保存后立即生效，刷新后仍保留。
- [ ] Todo 设置中的排序规则、默认 group、显示链接、显示 reminder/recurring、隐藏已完成/已放弃可持久化。
- [ ] Calendar / 时间相关设置修改后，对时长、午休扣减、日期展示、番茄块展示有实际影响。
- [ ] Pomodoro 设置中的默认时长、快捷时长、break 预设、auto extend、recordMode、浮动按钮、状态栏开关都可持久化并影响运行时。
- [ ] Slash Command 配置增删改后，命令注册结果和触发动作正确。
- [ ] AI / MCP / 微信等外部能力配置可保存、重开后仍存在。

### 4.14 AI 对话 / 技能（条件满足时）

- [ ] 可新建对话、切换对话、删除对话、清空当前对话。
- [ ] 发送消息后，消息流和 loading 状态正常。
- [ ] “插入到笔记”会把 AI 消息以引用块形式 append 到当前文档。
- [ ] slash command 创建技能成功后，技能列表可见，文档重命名正确。
- [ ] 显示 tool calls 开关生效。
- [ ] 微信会话已配置时，可打开微信登录弹窗、切换微信会话、显示未读状态。

## 5. 移动端页面与抽屉

### 5.1 Mobile Main Shell

- [ ] 底部 tab 可切换 Todo / AI / Pomodoro / Habit / More。
- [ ] Todo tab 上 FAB 可打开 Quick Create。
- [ ] 从 Todo 行触发“专注”后，会自动跳转到 Pomodoro tab。

### 5.2 Mobile Todo

- [ ] 刷新按钮生效。
- [ ] Filter Drawer 的 group / 日期 / priority / 隐藏已完成 / 隐藏已放弃等筛选生效。
- [ ] Quick Create 可创建到现有 task，也可先创建新 task 再创建 item。
- [ ] Quick Create 支持 date / time / priority / reminder / recurring / endCondition。
- [ ] Action Drawer 支持完成、专注、迁移、放弃、详情、日历按钮链路。
- [ ] Mobile item list / task card / project detail / task detail 之间导航正常。

### 5.3 Mobile 事项详情

- [ ] 可编辑内容并写回。
- [ ] 可编辑日期并写回。
- [ ] 可编辑时间范围/全天状态并写回。
- [ ] 可编辑优先级并写回。
- [ ] 可设置 reminder / recurring。
- [ ] 可完成、放弃、迁移到今天/明天/自定义日期、开始专注、打开日历。

### 5.4 Mobile Pomodoro

- [ ] 可从预选事项启动专注。
- [ ] Active Timer 支持暂停、继续、结束。
- [ ] completion sheet 保存记录、丢弃记录、延长专注都正常。
- [ ] break timer 可跳过。
- [ ] 重新进入页面时，进行中的 focus / break 能恢复。

### 5.5 Mobile Habit

- [ ] 列表页可 binary check-in、count +1。
- [ ] missed / reset 行为正常。
- [ ] detail sheet 内 archive / unarchive 正常。
- [ ] 月历和记录列表切换正常。

### 5.6 Mobile AI（条件满足时）

- [ ] 可新建、切换、删除对话。
- [ ] 发送消息、清空对话、微信会话切换正常。

### 5.7 Mobile More / Settings

- [ ] More 页可进入设置相关抽屉。
- [ ] 移动端设置抽屉修改目录、group、番茄钟、日历、AI、MCP、slash command 后会保存并生效。

## 6. 事件触发与后台链路

### 6.1 事项完成与 recurring

- [ ] 任务列表勾选完成时，WebSocket 完成检测能识别“新完成”而不是普通编辑。
- [ ] 任务列表 recurring 事项完成后，会自动创建下一次 occurrence，且只创建一次。
- [ ] 普通写操作把事项设为 completed 时，不会重复触发两次 recurring 创建。
- [ ] repeating item 的结束条件是按日期/次数正确生效的，达到终止条件后不再生成下一次。

### 6.2 Reminder / Habit Reminder

- [ ] 桌面端启动后会建立 item reminder 调度。
- [ ] 数据刷新后会重建 reminder 调度。
- [ ] 页面从后台回到前台后会重建 reminder 调度。
- [ ] 跨过零点后会重建 reminder 调度，并把 currentDate 推进到真实日期。
- [ ] 过期但仍在宽限窗口内的 reminder 会立刻补发；超出宽限窗口的不补发。
- [ ] 点击桌面通知会打开对应 block。
- [ ] habit reminder 只对未归档、当日应打卡、当前周期未完成的 habit 生效。

### 6.3 移动端原生通知（条件满足时）

- [ ] 首次加载会同步 item reminder 和 habit reminder 到原生通知注册表。
- [ ] 数据刷新、回到前台、跨过零点后会重建原生通知计划。
- [ ] pending/completed/abandoned 事项不会继续保留无效原生通知。
- [ ] 番茄结束通知和 break 结束通知会被正确调度/取消。

### 6.4 LOCAL_DATA_MUTATED 刷新链路

- [ ] 更新 reminder 后会发出 `LOCAL_DATA_MUTATED`，并触发刷新请求。
- [ ] 更新 recurring 后会发出 `LOCAL_DATA_MUTATED`，并触发刷新请求。
- [ ] pin/unpin 后会发出 `LOCAL_DATA_MUTATED`，并触发刷新请求。
- [ ] 更新/清空 focus plan 后会发出 `LOCAL_DATA_MUTATED`，并触发刷新请求。

### 6.5 Pomodoro 恢复链路

- [ ] 应用重开时，有 active pomodoro 会自动恢复。
- [ ] 应用重开时，有 pending completion 会直接弹出 completion dialog。
- [ ] 应用重开时，有 active break 会自动恢复剩余时间。
- [ ] 恢复时如果专注早已到点，会自动转成完成记录，而不是卡死在进行中。

## 7. 数据形态回归矩阵

- [ ] 对“完成 / 放弃 / 迁移 / reminder / recurring / priority / focus plan / pin”至少分别验证：
  - [ ] 普通段落事项
  - [ ] 任务列表事项
  - [ ] 单日期事项
  - [ ] 多日期事项
  - [ ] 全天事项
  - [ ] 仅开始时间事项
  - [ ] 有开始+结束时间事项
- [ ] 对“番茄记录写回”至少分别验证：
  - [ ] item 原本已有日期
  - [ ] item 原本无日期，需要自动补日期
  - [ ] recordMode=`block`
  - [ ] recordMode=`attr`
- [ ] 对 habit 至少分别验证：
  - [ ] binary
  - [ ] count
  - [ ] archived
  - [ ] 带 reminder

## 8. 建议的执行顺序

1. 先做桌面端：Todo -> Slash Commands -> Calendar -> Habit -> Pomodoro -> Event 链路。
2. 再做移动端：Quick Create -> Item Detail -> Pomodoro -> Habit。
3. 最后做条件型能力：通知、AI、微信、工作台、Focus Review。
