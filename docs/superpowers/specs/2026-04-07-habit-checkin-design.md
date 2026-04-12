# 习惯打卡功能设计

## 一、功能概述

为任务助手插件增加习惯打卡功能，支持用户追踪日常习惯的执行情况。习惯是与任务同级的概念，打卡记录是习惯的子级。支持二元型（做了/没做）和计数型（带目标值+单位）两种习惯类型。

### 1.1 核心理念

- **与任务同级**：习惯和任务并列，都是项目下的一级概念
- **记录驱动**：习惯定义和打卡记录都在 Markdown 中，统计数据实时计算不持久化
- **复用重复规则**：习惯使用 `🔁` 标记定义重复周期，复用已有的重复事项机制
- **多 block 设计**：每次打卡是独立的 block，天然支持 SiYuan 的块操作和搜索

---

## 二、标记语法

### 2.1 习惯定义

```markdown
习惯名 🎯 [目标值+单位] 🔁重复规则
```

`🎯` 标记与 `#任务` 处于同一层级，写在习惯名之后，风格与 `🔁`、`⏰` 等后缀标记一致。`core.ts` 解析时识别 `🎯` 行为习惯定义行。`🔁` 重复规则为必填项——习惯必须是周期性的，否则无法自动创建打卡记录。

**二元型**（无目标值）：
```markdown
早起 🎯 🔁每天
冥想 🎯 🔁每天
周报 🎯 🔁每周五
```

**计数型**（有目标值+单位）：
```markdown
喝水 🎯 8杯 🔁每天
跑步 🎯 5公里 🔁每天
阅读 🎯 30分钟 🔁每天
背单词 🎯 50个 🔁每天
```

**带提醒**：
```markdown
喝水 🎯 8杯 ⏰09:00 🔁每天           ← 每天早上9点提醒喝水
早起 🎯 ⏰07:00 🔁每天                ← 每天早上7点提醒早起
阅读 🎯 30分钟 ⏰提前30分钟 22:00 🔁每天  ← 晚上10点前30分钟提醒阅读
```

支持的单位：次、杯、分钟、小时、公里、页、毫升、自定义。

### 2.2 打卡记录

打卡记录由 `🔁` 规则自动创建，每天/每个周期一个独立 block，位于习惯定义行下方。

**二元型**：
```markdown
早起 🎯 🔁每天           ← 习惯定义

早起 @2026-04-06        ← 待打卡
早起 @2026-04-07 #done  ← 已打卡
```

**计数型**：
```markdown
喝水 🎯 8杯 🔁每天       ← 习惯定义

喝水 0杯 @2026-04-06    ← 待打卡（初始 0）
喝水 3杯 @2026-04-07    ← 进行中（3/8）
喝水 8杯 @2026-04-08 #done  ← 已达标，自动标 #done
```

### 2.3 标记顺序约定

```
习惯名 🎯 [目标值+单位] [⏰提醒时间] [🔁重复规则] [截止至日期|剩余次数]
```

### 2.4 解析规则

| Markdown | 解析结果 |
|----------|----------|
| `早起 🎯 🔁每天` | `Habit { type: 'binary', repeatRule: { type: 'daily' } }` |
| `喝水 🎯 8杯 🔁每天` | `Habit { type: 'count', target: 8, unit: '杯', repeatRule: { type: 'daily' } }` |
| `跑步 🎯 5公里 🔁工作日` | `Habit { type: 'count', target: 5, unit: '公里', repeatRule: { type: 'workday' } }` |
| `早起 @2026-04-06 #done` | `CheckInRecord { status: 'completed' }` |
| `喝水 3杯 @2026-04-06` | `CheckInRecord { currentValue: 3, targetValue: 8, status: 'pending' }` |
| `喝水 8杯 @2026-04-06 #done` | `CheckInRecord { currentValue: 8, targetValue: 8, status: 'completed' }` |

---

## 三、数据模型

### 3.1 Habit 接口

```typescript
interface Habit {
  id: string                    // 唯一 ID
  name: string                  // 习惯名（如"喝水"、"早起"）
  docId: string                 // 所属文档 ID
  blockId: string               // SiYuan block ID
  lastBlockId?: string          // 最后一个 record 的 block ID（用于插入位置）
  type: 'binary' | 'count'     // 二元型 / 计数型
  target?: number               // 目标值（计数型，如 8）
  unit?: string                 // 单位（计数型，如"杯"）
  repeatRule?: RepeatRule       // 复用已有的重复规则
  endCondition?: EndCondition   // 复用已有的结束条件
  records: CheckInRecord[]      // 打卡记录
  links?: Link[]                // 链接
  pomodoros?: PomodoroRecord[]  // 番茄钟记录
}
```

### 3.2 CheckInRecord 接口

```typescript
interface CheckInRecord {
  id: string                    // 唯一 ID
  content: string               // 内容（如"喝水 3杯"）
  date: string                  // YYYY-MM-DD
  docId: string
  blockId: string
  status: 'pending' | 'completed' | 'abandoned'

  // 计数型专用
  currentValue?: number         // 当前值（如 3）
  targetValue?: number          // 目标值（如 8）
  unit?: string                 // 单位

  // 所属习惯引用
  habitId: string               // 所属习惯的 blockId
}
```

### 3.3 Project 接口扩展

```typescript
interface Project {
  // ... 现有字段
  tasks: Task[]                 // 已有
  habits: Habit[]               // 新增
}
```

### 3.4 统计模型（纯计算，不持久化）

```typescript
interface HabitStats {
  habitId: string
  // 连续性
  currentStreak: number         // 当前连续天数
  longestStreak: number         // 最长连续天数
  // 完成率
  completionRate: number        // 总完成率 (0-1)
  weeklyCompletionRate: number  // 本周完成率
  monthlyCompletionRate: number // 本月完成率
  // 计数型专用
  totalValue?: number           // 累计值（如总共跑了 120 公里）
  averageValue?: number         // 日均值
}
```

---

## 四、解析流程

### 4.1 整体流程

```
笔记 Markdown (Kramdown)
  → core.ts 遍历 block 层级
  → 识别 🎯 行为习惯定义（类似识别 #任务）
  → habitParser.ts 解析习惯属性（类型、目标值、单位、重复规则）
  → 习惯下方的 @日期行 → 解析为 CheckInRecord（类似事项解析）
  → projectStore.habits[] 存储
```

### 4.2 core.ts 解析逻辑扩展

```
遍历 block 层级：
  ## 项目名          → project
  #任务 / 📋        → task 开始
  🎯                → habit 开始
  下方带 @日期的行   → 归属当前 task 的 item，或 habit 的 record
```

`🎯` 行和 `#任务` 行处于同一个层级，下方的 `@日期` 行归属最近的 `🎯` 或 `#任务`。

### 4.3 habitParser.ts

负责解析习惯定义行：

- 识别 `🎯` 标记（后缀风格，在习惯名之后），提取习惯名
- 解析目标值+单位（如 `8杯`、`5公里`、`30分钟`）
- 无目标值 → `type: 'binary'`
- 有目标值 → `type: 'count'`，填充 `target` 和 `unit`
- 复用 `recurringParser.ts` 解析 `🔁` 规则和结束条件

### 4.4 打卡记录解析

习惯下方的 `@日期` 行解析为 `CheckInRecord`：

- 提取日期（复用现有日期解析逻辑）
- 提取状态标签（`#done`/`#已完成`/`#abandoned`/`#已放弃`/`[x]`/`[ ]`）
- 计数型：从内容中提取 `N单位` 格式的当前值
- 关联到所属习惯的 `habitId`

---

## 五、打卡流程

### 5.1 自动创建今日 record

与重复事项的自动创建机制不同，习惯打卡在**每天/周期开始时自动创建** record block。

**触发时机**：
- 插件加载时
- 数据刷新时

**创建规则**：
```
1. 对每个有 🔁 的 habit，检查今天是否已有 record
2. 如果没有 → 自动创建一个 pending 的 record block
3. 位置：在最后一个 record 后面（或习惯定义行后面）
```

**生成的 record block**：

| 类型 | 生成的 Markdown |
|------|-----------------|
| 二元型 | `习惯名 @2026-04-07` |
| 计数型 | `习惯名 0单位 @2026-04-07` |

如果习惯定义有 `⏰` 提醒，record 自动继承（复用 `generateReminderMarker()` 逻辑）。

### 5.2 打卡操作

**二元型**：标记 `#done`（或 UI 点击打卡按钮）

**计数型**：更新当前值，判断是否达标
```
用户更新打卡值（如从 3杯 → 8杯）
  → 判断 currentValue >= targetValue
  → 是 → 自动追加 #done
  → 否 → 保持 pending
```

**计数型打卡值的更新方式**：

| 方式 | 操作 | 示例 |
|------|------|------|
| 直接编辑 | 修改 Markdown 中的数值 | `喝水 5杯` → `喝水 8杯` |
| UI 快捷 +1 | 点击 +1 按钮 | 3杯 → 4杯，自动更新 block |
| UI 设定值 | 输入框输入具体值 | 直接改为 8杯 |

---

## 六、统计计算

### 6.1 连续天数（Streak）

```
从今天往前遍历 records：
  二元型：status == 'completed' → 连续+1，否则中断
  计数型：currentValue >= targetValue → 连续+1，否则中断
  遇到第一个非完成/非达标 → 停止
```

**今日未打卡的特殊处理**：今天还没结束不算中断，`currentStreak` 从昨天开始算。

### 6.2 完成率

| 指标 | 计算方式 |
|------|----------|
| 总完成率 | `已完成天数 / 总记录天数` |
| 本周完成率 | `本周已完成 / 本周应有天数`（根据 🔁 规则计算应有天数） |
| 本月完成率 | 同上，按月算 |

计数型的"完成"：`currentValue >= targetValue` 算完成。

### 6.3 热力图

支持两种展示模式：

**按全部习惯聚合**（默认）：
```
对每个日期格子：
  颜色深度 = 当日达标习惯数 / 当日应有习惯数
  全完成 → 深绿 #52c41a
  部分完成 → 浅绿 #95de64
  未完成 → 灰 #e8e8e8
  非打卡日 → 留空
```

**按单个习惯**：
```
达标 → 深绿
部分完成（计数型未达标）→ 浅绿
未打卡 → 灰
```

---

## 七、UI 设计

### 7.1 整体布局：上下分栏

采用上下分栏结构，上部为今日打卡列表，下部为统计概览。

**今日打卡列表**：
- 显示今天需要打卡的所有习惯
- 二元型：显示打卡/已打卡按钮
- 计数型：显示进度条 + 快捷 +1 按钮
- 头部显示 `今日打卡 N/M 已完成`

**统计概览**：
- 三个数字卡片：当前连续天数、本月完成率、最长连续
- 近 30 天迷你热力图
- 可点击展开详细统计

### 7.2 Store Getter 设计

```typescript
// projectStore 新增 getters
getHabits(groupId?)              → Habit[]
getTodayRecords(habitId?)        → CheckInRecord[]
getHabitStats(habitId)           → HabitStats
getAllHabitStats()               → Map<string, HabitStats>
getHabitHeatmapData(year)        → HeatmapData[]
```

---

## 八、集成点

### 8.1 不影响现有功能

| 现有功能 | 影响 |
|----------|------|
| 任务/事项解析 | 无影响，`🎯` 是新增标记不冲突 |
| 提醒服务 | 习惯定义可带 `⏰`，自动创建的 record 继承提醒。复用现有 reminderService |
| 番茄钟 | 无影响 |
| 日历/甘特图 | 无影响，打卡记录不入日历 |
| Todo 侧边栏 | 暂不集成 |

### 8.2 修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `src/parser/core.ts` | 识别 `🎯` 行为习惯定义 |
| `src/parser/lineParser.ts` | 习惯下的 `@日期` 行解析为 record |
| `src/stores/projectStore.ts` | 新增 habits 状态和 getters |
| `src/types/models.ts` | 新增 Habit、CheckInRecord、HabitStats |
| `src/index.ts` | 注册 HabitTab，启动时创建今日 record |
| `src/i18n/zh_CN.json` | 新增 habit.* keys |
| `src/i18n/en_US.json` | 新增 habit.* keys |

### 8.3 新增文件清单

| 文件 | 说明 |
|------|------|
| `src/parser/habitParser.ts` | `🎯` 解析 + 打卡值解析 |
| `src/services/habitService.ts` | 自动创建 record + 打卡逻辑 |
| `src/utils/habitStatsUtils.ts` | 连续天数、完成率等统计计算 |
| `src/components/habit/HabitTab.vue` | 习惯 Tab 主视图 |
| `src/components/habit/HabitTodayList.vue` | 今日打卡列表 |
| `src/components/habit/HabitStatsOverview.vue` | 统计概览 |
| `src/components/habit/HabitHeatmap.vue` | 年度热力图 |
| `src/components/habit/HabitRecordList.vue` | 近期打卡记录 |
| `src/components/habit/HabitCountInput.vue` | 计数型打卡输入 |

---

## 九、实现优先级

| 阶段 | 内容 | 依赖 |
|------|------|------|
| P0 | 数据模型 + 解析 + Store | 无 |
| P1 | 今日打卡列表（打卡/计数 UI） | P0 |
| P1 | 自动创建今日 record | P0 |
| P2 | 统计概览（连续天数/完成率） | P0 |
| P2 | 年度热力图 | P0 |
| P3 | 日历视图 | P2 |
| P3 | 笔记中直接编辑打卡值 | P0 |

---

## 十、验收标准

- [ ] 可解析 `🎯` 标记定义习惯（二元型和计数型）
- [ ] 计数型支持目标值+单位（杯、公里、分钟等）
- [ ] 复用 `🔁` 全部重复规则（每天/每周/每月/工作日/自定义周几）
- [ ] 打卡记录自动创建（每天/周期开始时）
- [ ] 二元型打卡标记 `#done`
- [ ] 计数型达标自动标记 `#done`
- [ ] 计数型 UI 支持 +1 和自定义值
- [ ] 统计：连续天数（当前+最长）
- [ ] 统计：完成率（总/本周/本月）
- [ ] 年度热力图
- [ ] 近期打卡记录列表
- [ ] 习惯与任务同级，不影响现有解析
- [ ] i18n 支持中英文
