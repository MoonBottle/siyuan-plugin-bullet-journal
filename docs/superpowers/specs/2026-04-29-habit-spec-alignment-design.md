# 习惯系统整体重构对齐设计

## 一、背景

`2026-04-07-habit-checkin-design.md` 已明确习惯系统的目标语义，但当前代码实现仍固化了旧口径，主要体现在：

- 周频习惯提醒仍按“今天是否是单一打卡日”推导
- 完成率和 streak 仍偏向自然天计数，而不是按频率要求计数
- UI 将“今天已打卡”和“当前周期已达标”混用为同一个布尔状态
- reminder、stats、UI 各自维护一套习惯周期判断逻辑，语义已开始分叉

本设计不是新增功能，而是对现有习惯系统做一次**整体重构**，让实现重新对齐既有 spec。

---

## 二、目标

### 2.1 重构目标

建立统一的习惯领域层，让以下语义只在一处定义：

- 某天是否完成
- 当前周期的起止范围
- 当前周期要求数、完成数、剩余数
- 当前周期是否已达标
- 今天是否允许提醒
- 总体 / 本周 / 本月完成率
- 当前连续 / 最长连续

### 2.2 非目标

本次不改变以下产品行为：

- Markdown 语法
- 打卡记录写入格式
- Dock / MobileHabitDock 的整体交互入口
- 习惯 record 的用户驱动创建方式

---

## 三、当前实现不一致点

### 3.1 提醒语义不一致

当前 `habitReminder.ts` 先判断“今天是不是打卡日”，再判断是否提醒。该模型只适合：

- `daily`
- `every_n_days`
- `weekly_days`

但不适合：

- `weekly`
- `n_per_week`

因为这两类频率在设计上属于“周期内完成即可”，不是绑定某个具体日期。

### 3.2 统计口径不一致

当前 `habitStatsUtils.ts` 主要按完成天数 / 预期天数计算，无法准确表达：

- `weekly`: 已完成周数 / 应完成周数
- `every_n_days`: 已完成周期数 / 应完成周期数
- `n_per_week`: 自然周窗口内的要求天数完成度

### 3.3 UI 状态混用

当前 UI 通过 `isPeriodCompleted` 同时承载：

- 今天是否已打卡
- 当前周期是否已达标

这会导致周频习惯在以下场景中无法正确表达：

- 今天未打卡，但本周已达标
- 今天不属于要求日，但本周仍未达标
- 查看历史日期时，单日状态和当前周期状态冲突

### 3.4 逻辑分散

当前代码中，习惯周期语义分散在：

- `habitReminder.ts`
- `habitStatsUtils.ts`
- `HabitListItem.vue`
- `MobileHabitDock.vue`
- 其他消费 `HabitStats` 的组件

这会持续导致 reminder、stats、UI 口径漂移。

### 3.5 既有功能存在漏实现

除语义不一致外，当前代码还存在一批已经进入设计但尚未闭环的功能：

- **习惯提醒时间设置 UI 未实现**
  - 底层 reminder 结构与调度已存在
  - 但 `HabitCreateDialog` 没有 reminder 输入能力，无法在创建 / 编辑习惯时设置提醒时间

- **`/xg` 仅支持创建，不支持编辑**
  - 弹框组件具备 `initialData` 预填能力
  - 但当前对话框打开入口没有传入习惯初始数据，也没有更新原习惯 block 的路径

- **`/dk` 仍是占位实现**
  - 当前没有根据“习惯定义行 / 今日 record / 历史 record”分流执行真实打卡行为

- **计数型“设置具体值”行为未闭环**
  - UI 的 `change` 事件传递的是目标值
  - 但当前消费方错误调用 `checkInCount`，实际执行的是“增量累加”
  - 导致详情页计数型加减按钮存在行为错误

- **计数型自定义输入值未实现**
  - 设计要求支持直接设定值
  - 当前只有 `+ / -` 交互，没有输入框、弹层、长按或右键路径

- **撤销打卡 / 删除 record 仅有 service，无 UI 入口**
  - `deleteCheckIn` 已存在
  - 但日志列表和详情视图没有删除 / 撤销动作

- **历史 record 编辑未实现**
  - 当前只支持修改选中日期的顶部计数区
  - 不支持从日志列表中编辑历史 record

- **补打卡按日期顺序插入未实现**
  - 当前 record 创建统一追加到 `lastBlockId` 后
  - 不会按历史日期找到合适插入位置

- **桌面端 HabitDock 打卡后未刷新**
  - 移动端会主动 refresh
  - 桌面端当前仅记录日志，可能导致打卡后界面状态不即时更新

- **移动端详情抽屉未按设计落地**
  - 当前是页内切换，不是独立 drawer
  - 若以原始设计 spec 为准，仍属于未完成

---

## 四、总体方案

本次采用**整体重构**，不做局部修补。

### 4.1 重构原则

1. 周期语义只在领域层定义一次
2. reminder 层只消费领域结果，不重复推导周频逻辑
3. UI 只消费明确字段，不自行解释周期含义
4. habitService 保持写入职责，不承担统计和提醒语义
5. 本次重构同时补齐已进入设计但尚未闭环的习惯功能，不仅修语义，也修功能缺口

### 4.2 分层结构

建议新增习惯领域目录：

```text
src/domain/habit/
  habitPeriod.ts
  habitCompletion.ts
  habitStats.ts
```

职责如下：

- `habitPeriod.ts`
  - 周期切分
  - 周期起止边界
  - 周期要求数计算
  - 日期是否具备提醒 / 打卡资格

- `habitCompletion.ts`
  - record 按日聚合
  - 单日完成状态
  - 当前周期完成状态
  - 当前周期进度

- `habitStats.ts`
  - completion rate
  - streak
  - total/monthly aggregates
  - 供 UI 展示的习惯统计

---

## 五、领域模型设计

### 5.1 HabitDayState

面向单日状态：

```typescript
interface HabitDayState {
  date: string
  hasRecord: boolean
  isCompleted: boolean
  currentValue?: number
  targetValue?: number
}
```

用途：

- 列表中某天是否已打卡
- 详情页今日操作区
- 月历单格渲染

### 5.2 HabitPeriodState

面向当前周期状态：

```typescript
interface HabitPeriodState {
  periodType: 'day' | 'interval' | 'week'
  periodStart: string
  periodEnd: string
  requiredCount: number
  completedCount: number
  remainingCount: number
  isCompleted: boolean
  eligibleToday: boolean
}
```

语义说明：

- `eligibleToday`
  - 表示今天是否允许继续打卡 / 提醒
  - 不等于“今天必须打卡”
- `isCompleted`
  - 表示当前周期是否已达标
  - 与单日完成状态分离

### 5.3 HabitStats

面向统计展示：

```typescript
interface HabitStats {
  habitId: string
  totalCheckins: number
  monthlyCheckins: number
  completionRate: number
  weeklyCompletionRate: number
  monthlyCompletionRate: number
  currentStreak: number
  longestStreak: number
  totalValue?: number
  averageValue?: number
  isEnded: boolean
}
```

说明：

- 保留 `weeklyCompletionRate` / `monthlyCompletionRate`
- 这里的“周 / 月”表示统计窗口，不表示支持 `🔄每月`
- 原 `isCompleted` 字段改名为 `isEnded`，避免与“当前周期完成”混淆

---

## 六、周期规则设计

### 6.1 daily

- 周期类型：`day`
- 每天一个独立周期
- 完成率按应完成天数计算
- 提醒每天都有资格，已完成则停

### 6.2 every_n_days

- 周期类型：`interval`
- 周期边界由 `startDate + k * interval` 推导
- 一个周期内至少完成一次即可
- 完成率按应完成周期数计算
- 仅命中周期日提醒

### 6.3 weekly

- 周期类型：`week`
- 周期边界为自然周（周一到周日）
- 当前周期要求数固定为 1
- 周期内任意一天完成一次即达标
- 提醒规则：当周未达标前，每天都可提醒；达标后本周停止提醒
- 完成率按已完成周数 / 应完成周数计算

### 6.4 n_per_week

- 周期类型：`week`
- 周期边界为自然周（周一到周日）
- 当前周期要求数为 `daysPerWeek`
- 达标条件为本周完成天数 >= `daysPerWeek`
- 提醒规则：当周未达标前，每天都可提醒；达标后本周停止提醒
- 完成率按要求天数计算，但窗口按自然周切分

### 6.5 weekly_days

- 周期类型：`week`
- 周期边界为自然周（周一到周日）
- 当前周期要求数为该周命中的 `daysOfWeek` 个数
- 达标条件为该周所有要求日都完成
- 仅要求日具备提醒资格
- 完成率按要求日总数计算

---

## 七、提醒层重构设计

### 7.1 新判断流程

`habitReminder` 不再直接回答“今天是不是打卡日”，而改成两步：

1. `isDateEligibleForHabit(habit, date)`
   - 今天是否具备提醒资格
2. `getHabitPeriodState(habit, date)`
   - 当前周期是否已达标

最终提醒条件：

```text
有效期内
AND 今日具备提醒资格
AND 当前周期未达标
AND 存在 reminder 配置
```

### 7.2 模块职责

`src/services/habitReminder.ts` 仅负责：

- 组合领域层结果
- 计算提醒时间
- 生成 reminder entries

不再负责：

- 解释 weekly / n_per_week 周期语义
- 自己维护周期完成规则

### 7.3 与 ReminderService 的关系

`ReminderService` 继续作为调度器存在，不承担习惯周期判断职责。  
习惯 reminder entry 的真值来源统一改为领域层。

---

## 八、统计层重构设计

### 8.1 单日聚合

先按日期聚合 records：

- 二元型：当天存在 record 即完成
- 计数型：当天取最大 `currentValue`
- 达标条件：`currentValue >= targetValue`

该聚合结果作为：

- 单日状态来源
- streak 计算输入
- 周期完成数统计输入

### 8.2 完成率定义

- `daily`
  - 已完成天数 / 应完成天数
- `every_n_days`
  - 已完成周期数 / 应完成周期数
- `weekly`
  - 已完成周数 / 应完成周数
- `n_per_week`
  - 已完成要求天数 / 应完成要求天数
- `weekly_days`
  - 已完成要求日数 / 应完成要求日数

### 8.3 streak 定义

- `daily`
  - 按连续自然日计算
- `every_n_days`
  - 按连续周期计算
- `weekly`
  - 按连续自然周计算
- `n_per_week`
  - 按连续自然周是否达标计算
- `weekly_days`
  - 按连续自然周是否全要求日达标计算

### 8.4 结束状态

- `durationDays` 到期只表示习惯结束，映射到 `isEnded`
- `isEnded` 不再与“当前周期已达标”混用

---

## 九、UI 消费设计

### 9.1 列表项

列表项应拆开消费：

- 单日按钮状态：`HabitDayState.isCompleted`
- 当前周期灰化 / 文案：`HabitPeriodState.isCompleted`
- 进度文案：`completedCount / requiredCount`

禁止继续使用一个字段同时表达：

- 今天是否打卡
- 当前周期是否达标

### 9.2 MobileHabitDock

移动端详情页同时展示两类状态：

- `selectedDate` 对应单日状态
- `currentDate` 对应当前周期状态

这两类状态必须分开显示，避免查看历史日期时误把历史单日完成等同于当前周期完成。

### 9.3 月历

月历只表达单日状态：

- completed
- partial
- empty / not completed

不承担周期达标表达，避免一格内混入两层语义。

---

## 十、迁移步骤

### P0：建立领域层

- 新建 `src/domain/habit/`
- 抽出周期切分、单日聚合、周期完成、stats 计算
- 保证可单测，不依赖 Vue / store / API

### P1：重写 reminder 语义

- `habitReminder.ts` 改为消费领域层
- `weekly` / `n_per_week` 改成“期内每日提醒直到达标”
- 更新 `ReminderService` 相关测试
- 补上习惯提醒时间设置入口（创建 / 编辑习惯）

### P2：重写 stats 语义

- `habitStatsUtils` 改为调用领域层
- 对齐 completionRate / streak / ended 状态
- 替换旧的 `isPeriodCompleted`
- 修正计数型“设置具体值”与“增量打卡”的调用边界

### P3：调整 UI

- HabitListItem
- MobileHabitDock
- HabitStatsCards
- 其他消费习惯 stats 的组件
- HabitCreateDialog
- HabitRecordLog
- DesktopHabitDock

改为分别读取：

- day state
- current period state
- stats

同时补齐：

- `/xg` 编辑习惯
- `/dk` 真实打卡行为
- 撤销打卡 / 删除 record UI 入口
- 历史 record 编辑入口
- 桌面端打卡后 refresh
- 移动端详情抽屉是否对齐原始设计

### P4：清理兼容层

- 删除旧的语义混用字段
- 删除已废弃辅助函数
- 清理旧测试和过时注释

---

## 十一、测试策略

### 11.1 新增领域层测试

按模块分：

- `habitPeriod.test.ts`
- `habitCompletion.test.ts`
- `habitStats.test.ts`

覆盖：

- daily
- every_n_days
- weekly
- n_per_week
- weekly_days
- `durationDays`
- 历史补打卡

### 11.2 reminder 测试迁移

替换旧的“非打卡日”心智模型，重点覆盖：

- `weekly` 未达标时周内每天提醒
- `weekly` 达标后本周停止
- `n_per_week` 未达标前继续提醒
- `weekly_days` 非要求日不提醒
- 习惯创建 / 编辑时 reminder 配置可正确写入 Markdown

### 11.3 UI 测试迁移

至少补以下断言：

- 今天未打卡但当前周期已达标
- 今天不属于要求日但当前周期未达标
- 查看历史日期时单日状态与当前周期状态同时存在
- `/xg` 在习惯行触发时进入编辑而非插入
- `/dk` 在不同触发行类型下执行正确动作
- 计数型详情页设值不会误变成增量累加
- 撤销打卡后日志与统计同步更新

---

## 十二、风险与控制

### 12.1 风险

- 现有 UI 假设 `isPeriodCompleted` 表示“今日完成”，改动后最容易引入显示回归
- weekly / n_per_week 统计口径切换后，旧测试会大面积失效
- reminder 行为变化会直接影响用户感知
- 同步补功能缺口会扩大改动面，尤其是 slash command、dialog 和桌面 / 移动双端联动

### 12.2 控制策略

- 先建立领域测试，再迁移 service 测试，再动 UI
- UI 改动前保留临时适配层，避免一次性爆炸
- 每一阶段都跑对应测试集，避免大范围联动后难以定位
- 将“语义对齐”和“功能补齐”拆成清晰子任务，但保持同一份统一 spec 和测试口径

---

## 十三、验收标准

- 周期语义只在领域层定义一次
- `weekly` / `n_per_week` 提醒行为符合“期内每日提醒直到达标”
- completion rate 与 streak 计算符合 `2026-04-07-habit-checkin-design.md`
- UI 不再混用“今天已打卡”和“当前周期已达标”
- 习惯创建 / 编辑支持 reminder 配置
- `/xg` 支持创建与编辑两种模式
- `/dk` 在习惯定义行、今日 record、历史 record 上行为正确
- 计数型设值不再误用增量接口
- 撤销打卡、历史 record 编辑、补打卡插入顺序具备可用闭环
- 桌面端与移动端打卡后状态都能及时刷新
- 习惯相关测试按新语义全部通过
- 旧的歧义字段和临时逻辑被清理
