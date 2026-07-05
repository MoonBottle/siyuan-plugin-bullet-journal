# 计划：移除 TodoSidebarList 事项名称左边的 emoji 状态代码

## 摘要

从 `TodoSidebarList.vue` 中移除事项名称（`.item-content`）左侧的 `getStatusEmoji()` 调用及相关代码。

## 当前状态分析

在 [TodoSidebarList.vue](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/components/todo/TodoSidebarList.vue) 中：

1. **模板**：7 个 section（pinned/expired/today/tomorrow/future/completed/abandoned）的 `.item-content` 都有 `{{ getStatusEmoji(item) }} {{ item.content }}`，在事项名称前显示状态 emoji（🍅✅❌⚠️⏳ 等）
2. **函数 `getStatusEmoji`**（第 925-943 行）：根据番茄钟状态、完成/放弃状态、日期范围状态、过期状态返回不同 emoji
3. **相关 import**（第 827-831 行）：`dateRangeStatusToEmoji`、`getDateRangeStatus`、`getTimeRangeStatus` 仅在 `getStatusEmoji` 中使用

注意：`getStatusEmoji` 在其他 4 个文件中也有同名函数（CalendarView、MobileTimerStarter 等），但它们是各自独立定义的，不受本次修改影响。

## 修改内容

### 文件：`src/components/todo/TodoSidebarList.vue`

#### 1. 模板：移除 7 处 `getStatusEmoji(item)` 调用

将所有 `{{ getStatusEmoji(item) }} {{ item.content }}` 改为 `{{ item.content }}`：

- 第 144 行（pinned section）
- 第 245 行（expired section）
- 第 346 行（today section）
- 第 447 行（tomorrow section）
- 第 556 行（future section）
- 第 659 行（completed section）
- 第 757 行（abandoned section）

#### 2. 脚本：删除 `getStatusEmoji` 函数定义

删除第 925-943 行的 `getStatusEmoji` 函数。

#### 3. 脚本：清理仅被 `getStatusEmoji` 使用的 import

从 `@/utils/dateRangeUtils` 的 import 中移除：
- `dateRangeStatusToEmoji`
- `getDateRangeStatus`
- `getTimeRangeStatus`

检查 `getEffectiveDate` 是否还有其他使用（它在 `expiredItems` computed 中使用），需保留。

#### 4. 脚本：检查 `dayjs` 是否还有其他使用

`dayjs` 在 `getTodayStr`、`getTomorrowStr` 等多处使用，需保留。

## 验证步骤

1. `npm run lint` — 确认无 lint 错误（包括 noUnusedLocals 检查）
2. `npm run typecheck` — 确认无类型错误
3. `npm run test` — 确认测试通过
