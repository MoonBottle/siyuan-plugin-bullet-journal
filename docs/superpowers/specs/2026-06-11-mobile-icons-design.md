# Mobile 端图标统一为 iconTa 设计

## 背景

Mobile 端当前混用 SiYuan 内置图标（`#iconXxx`）和自定义图标（`#iconTaXxx`）。需要按功能语义对齐桌面端，将所有 SiYuan 内置图标替换为对应的 iconTa 版本。

## 映射关系

### 直接语义匹配

| SiYuan 内置 | iconTa 对应 | 说明 |
|---|---|---|
| `#iconCheck` | `#iconTaCheck` | 完成勾选 |
| `#iconClock` | `#iconTaTimer` | 时间/计时器 |
| `#iconForward` | `#iconTaSkipForward` | 跳过/前进 |
| `#iconInfo` | `#iconTaInfo` | 信息/详情 |
| `#iconCalendar` | `#iconTaCalendar` | 日历 |
| `#iconCloseRound` | `#iconTaSquareX` | 关闭/取消（X 图标） |

### 功能语义匹配（对齐桌面端）

| SiYuan 内置 | iconTa 对应 | 说明 |
|---|---|---|
| `#iconFolder` | `#iconTaProject` | 项目/文件夹（桌面端 WorkbenchSidebar 用 iconTaProject） |
| `#iconList` | `#iconTaTodo` | 待办/任务列表（桌面端用 iconTaTodo） |
| `#iconRefresh` | `#iconTaClockPlus` | 刷新/重复（桌面端 ItemActionBar 用 iconTaClockPlus 表示 recurring） |
| `#iconMark` | `#iconTaFlag` | 标记/优先级（桌面端用 iconTaFlag 表示优先级） |
| `#iconFire` | `#iconTaFlag` | 紧急/高优先级（同上，优先级标记） |
| `#iconEdit` | `#iconTaFileText` | 编辑/文件（桌面端 ItemActionBar 用 iconTaFileText 表示打开文档） |

### 无对应，保持 SiYuan 内置

| 图标 | 原因 |
|---|---|
| `#iconDown` | 展开箭头，icons.ts 无对应 |
| `#iconRight` | 右箭头，icons.ts 无对应 |
| `#iconLeft` | 左箭头，icons.ts 无对应 |
| `#iconClose` | 关闭按钮，icons.ts 无对应 |
| `#iconAdd` | 新增按钮，icons.ts 无对应 |
| `#iconSearch` | 搜索，icons.ts 无对应 |
| `#iconLeaf` | 特定语义，icons.ts 无对应 |
| `#iconEye` | 可见性切换，icons.ts 无对应 |
| `#iconSettings` | 设置，icons.ts 无对应 |
| `#iconCircle` | 圆形选择器，icons.ts 无对应 |
| `#iconInbox` | 空状态，icons.ts 无对应 |
| `#iconCopy` | 复制，icons.ts 无对应 |
| `#iconWeixin` | 微信图标，icons.ts 无对应 |
| `#iconHistory` | 历史记录，icons.ts 无对应 |

## 涉及文件

- ActionDrawer.vue — iconCheck、iconClock、iconForward、iconInfo、iconCalendar、iconCloseRound
- MobileItemDetail.vue — iconCheck、iconClock、iconForward、iconCalendar、iconFolder→iconTaProject、iconList→iconTaTodo、iconRefresh→iconTaClockPlus、iconMark→iconTaFlag、iconEdit→iconTaFileText
- MobileTodoList.vue — iconClock、iconList→iconTaTodo、iconRefresh→iconTaClockPlus
- SettingsDrawer.vue — iconCheck、iconInfo、iconCloseRound
- QuickCreateDrawer.vue — iconClock、iconInfo、iconCalendar、iconCheck、iconFolder→iconTaProject、iconList→iconTaTodo、iconRefresh→iconTaClockPlus
- MobileWeixinSheet.vue — iconCheck
- MobileTaskCard.vue — iconCheck、iconFolder→iconTaProject、iconList→iconTaTodo、iconCloseRound
- ProjectDetail.vue — iconFolder→iconTaProject、iconList→iconTaTodo、iconFire→iconTaFlag
- MobileHabitDetailSheet.vue — iconCloseRound
- MobileTimerStarter.vue — iconFolder→iconTaProject、iconList→iconTaTodo
- MobilePomodoroTimerDrawer.vue — (无替换，iconClose 保持)
- MobileAiConfig.vue — iconEdit→iconTaFileText
- MobileAiPanel.vue — (iconHistory、iconAdd 保持)
- ItemSelectorSheet.vue — (iconCircle、iconInbox 保持)
- MobileMcpConfig.vue — (iconCopy 保持)
- MobileActiveTimer.vue — iconFolder→iconTaProject、iconList→iconTaTodo

## 变更

纯字符串替换，无逻辑变更。
