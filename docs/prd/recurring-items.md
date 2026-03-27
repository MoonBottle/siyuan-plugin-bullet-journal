# 重复事项设计

## 一、功能概述

为事项增加重复规则和结束条件，支持周期性事项（如周会、月度汇报）。每个 occurrence 为独立 block，用户完成一次后可通过「创建下次」生成下一 occurrence。

### 1.1 核心理念

- **多 block 设计**：每个 occurrence 独立 block，各自有 blockId、子块（链接、番茄钟等）
- **与提醒解耦**：重复规则用于「创建下次」，提醒仅负责单次通知（见 [reminder.md](./reminder.md)）
- **手动创建**：不自动创建下次，用户忘记点击「完成」时，事项会显示在「过期」分组中提醒
- **可选功能**：用户可选择是否为事项设置重复

---

## 二、标记语法

### 交互方式

| 方式 | 触发 | 说明 |
|------|------|------|
| **UI 面板** | 事项详情 → 设置重复 | 可视化规则选择器（每天/每周/每月等） |
| **右键菜单** | 右键点击事项 | 快捷设置：每天/每周/每月/工作日 |
| **斜杠命令** | `/重复` | 输入 `/重复` 唤起规则选择器 |
| **手动输入** | 直接编辑 Markdown | 支持 🔁每天、🔁每周 等语法 |

### 2.1 重复规则（使用 🔁 emoji）

| 标记 | 说明 | 创建下次时 |
|------|------|------------|
| `🔁每天` | 每天重复 | +1 天 |
| `🔁每周` | 每周重复 | +7 天，保持星期几 |
| `🔁每月` | 每月重复（保持当前日号） | +1 月，保持日号（边界处理见 2.4） |
| `🔁每月:15日` | 每月固定日期重复 | 每月 15 日 |
| `🔁每年` | 每年重复 | +1 年，保持月日 |
| `🔁工作日` | 工作日重复 | 跳到下一个工作日（见第 8 节） |

#### `🔁每月` vs `🔁每月:15日` 的区别

```markdown
# 场景：今天是 3月17日

# 🔁每月 - 保持当前日号（17日）
月度汇报 @2026-03-17 🔁每月
# 下次：4月17日 → 5月17日 → 6月17日...

# 🔁每月:15日 - 固定每月15日
月度汇报 @2026-03-17 🔁每月:15日
# 下次：4月15日 → 5月15日 → 6月15日...
# 注意：虽然当前是3月17日，但下次跳到4月15日
```

**选择建议**：
- `🔁每月`：适合「从某天开始，每月同一天」的事项（如每月17日发工资后做报表）
- `🔁每月:15日`：适合「固定在每月某号」的事项（如每月15日开例会）

### 2.2 结束条件（使用 🔚 和 🔢 emoji）

| 标记 | 说明 | 示例 |
|------|------|------|
| `🔚2026-12-31` | 按日期结束（🔚 = 结束/截止日期） | `🔁每月🔚2026-12-31` |
| `🔢10` | 按次数结束（🔢 = 数字/计数） | `🔁每天🔢10` |
| 无参数 | 永不结束 | 不附加 |

**`:count:N` 方案**：采用方案 A（不追踪），`:count:10` 表示「最多创建 10 次」，由用户自行决定何时停止，不强制限制。

### 2.3 完整示例

```markdown
月度汇报 @2026-03-17 ⏰14:00 🔁每月🔚2026-12-31
月度汇报 @2026-03-17 ⏰14:00 🔁每月:15日🔚2026-12-31  // 每月15号
周会 @2026-03-06 ⏰09:00 🔁每周🔢52
背单词 @2026-03-17 ⏰08:00 🔁每天🔢30
年度总结 @2026-03-17 ⏰10:00 🔁每年
日报 @2026-03-17 ⏰17:00 🔁工作日
```

### 2.4 月份边界处理

当原日期在目标月份不存在时，采用「月末对齐」策略：

| 原日期 | 规则 | 下月日期 | 说明 |
|--------|------|----------|------|
| 1月31日 | `🔁每月` | 2月28/29日 | 取月末最后一天 |
| 1月31日 | `🔁每月` | 3月31日 | 恢复正常 |
| 3月31日 | `🔁每月` | 4月30日 | 取月末最后一天 |
| 5月31日 | `🔁每月` | 6月30日 | 取月末最后一天 |

**算法**：
```typescript
function getNextMonthlyDate(currentDate: string): string {
  const date = new Date(currentDate);
  const currentDay = date.getDate();
  
  // 移动到下一月
  date.setMonth(date.getMonth() + 1);
  
  // 检查是否发生了「月份跳跃」（如 1月31日 → 3月3日）
  if (date.getDate() !== currentDay) {
    // 回退到当月第一天，再减去一天 = 上月最后一天
    date.setDate(0);
  }
  
  return formatDate(date);
}
```

---

## 三、数据模型

### 3.1 Item 扩展

```typescript
interface Item {
  // ... 现有字段
  reminder?: ReminderConfig;     // 来自 reminder.md
  repeatRule?: RepeatRule;       // 重复规则
  endCondition?: EndCondition;   // 结束条件
}

// 重复规则类型
type RepeatRule = 
  | { type: 'daily' }
  | { type: 'weekly' }
  | { type: 'monthly'; dayOfMonth?: number }  // dayOfMonth 指定每月几号
  | { type: 'yearly' }
  | { type: 'workday' };

// 结束条件类型
interface EndCondition {
  type: 'never' | 'date' | 'count';
  endDate?: string;    // YYYY-MM-DD，type=date 时使用
  maxCount?: number;   // type=count 时使用（仅作参考，不强制）
}
```

### 3.2 解析规则

| 标记 | 解析结果 |
|------|----------|
| `🔁每月` | `repeatRule: { type: 'monthly' }` |
| `🔁每月:15日` | `repeatRule: { type: 'monthly', dayOfMonth: 15 }` |
| `🔁每月🔚2026-12-31` | `repeatRule: { type: 'monthly' }`, `endCondition: { type: 'date', endDate: '2026-12-31' }` |
| `🔁每周🔢52` | `repeatRule: { type: 'weekly' }`, `endCondition: { type: 'count', maxCount: 52 }` |

---

## 四、创建下次

### 4.1 触发入口

- **事项详情弹框**中「创建下次」按钮
- 仅当事项有 `repeatRule` 时显示
- **完成（#done）后仍可点击**，用于提前创建下一 occurrence

### 4.2 不自动创建机制

**设计决策**：不自动创建下次 occurrence，原因：
1. **灵活性**：用户可能完成时间不确定，无需绑定严格周期
2. **遗忘提醒**：用户忘记点击完成/创建下次时，事项会显示在「**过期**」分组中，提醒用户处理
3. **简化实现**：无需后台定时任务检测周期

**过期提醒逻辑**：
- 事项日期 < 今天 且 状态为 pending → 显示在「过期」分组
- 用户看到过期事项后，可选择「完成」或「创建下次」

### 4.3 创建逻辑

```
输入：当前 Item（content, date, reminder, repeatRule, endCondition）
输出：新 block 内容

1. 根据 repeatRule 计算下一日期：
   - daily: date + 1 天
   - weekly: date + 7 天
   - monthly: 
     * 有 dayOfMonth: 下个月指定日期
     * 无 dayOfMonth: date + 1 月，边界处理见 2.4
   - yearly: date + 1 年
   - workday: 下一工作日（见第 8 节）

2. 检查结束条件：
   - type=date: 若 nextDate > endDate，不创建，提示用户
   - type=count: 仅提示用户已创建 N 次（不强制限制）
   - type=never: 不检查

3. 生成新 block 内容：
   内容 @nextDate ⏰reminderTime 🔁xxx:endCondition
   （继承 content、reminder、repeatRule、endCondition）

4. 在同级（与当前 block 同级）插入新 block
```

### 4.4 跳过本次功能

**使用场景**：用户某次无法执行（如生病、出差），需要跳过当前周期直接到下一个周期。

**实现方案**：
- 在事项详情弹框中增加「**跳过本次**」按钮
- **直接修改当前事项的日期**为下一个周期的日期
- 不涉及属性存储，简单直接

**示例**：
```markdown
# 当前事项（3月17日，用户生病无法参加）
周会 @2026-03-17 ⏰09:00 🔁每周

# 用户点击「跳过本次」后，直接修改为
周会 @2026-03-24 ⏰09:00 🔁每周
```

**UI 交互**：
1. 用户在 ItemDetailDialog 点击「跳过本次」
2. 系统根据 `repeatRule` 计算下一周期日期
3. 直接修改当前 block 的日期
4. 显示提示：「已跳过 3月17日，日期已更新为 3月24日」

---

## 五、与提醒的配合

- 创建下次时，新 block 继承 `⏰HH:mm` 提醒配置
- 提醒模块独立解析，每个 block 一条 ReminderRecord
- 事项完成（#done）后，该 block 的提醒被删除；新创建的 block 有独立提醒

---

## 六、集成点

### 6.1 解析层 (lineParser.ts)

- 解析 `🔁每天`/`🔁daily`、`🔁每周`/`🔁weekly` 等标记（支持中英文），填充 `Item.repeatRule`
- 解析 `🔚YYYY-MM-DD`、`🔢N`，填充 `Item.endCondition`
- 内容清理时移除 `🔁xxx` 和 `🔚xxx`、`🔢xxx`，避免显示在事项内容中

### 6.2 事项详情 (ItemDetailDialog.vue)

- 有 `repeatRule` 时显示「**创建下次**」按钮
- 有 `repeatRule` 时显示「**跳过本次**」按钮（仅在当天可跳过）
- 显示已跳过的日期列表（可取消跳过）
- 点击「创建下次」后调用创建逻辑，插入新 block，触发 DATA_REFRESH

### 6.3 思源 API

- 使用 `insertBlock` 或等价 API 在同级插入新 block
- 需获取当前 block 的 parentId、nextBlockId 以确定插入位置
- 使用 `setBlockAttrs` 设置 `custom-skip-occurrences` 属性

---

## 七、实现步骤

### 阶段一：基础

1. 类型定义：`repeatRule`、`endCondition` 加入 Item
2. 解析：`parseItemLine` 中解析 `🔁xxx` 和结束条件（支持中英文）
3. 内容清理：移除重复与结束条件标记
4. 交互入口：实现 UI 面板、右键菜单、斜杠命令 `/重复`

### 阶段二：创建下次

5. 日期计算：实现 `getNextOccurrenceDate(date, repeatRule)` 
   - 包含月份边界处理
   - 支持 `dayOfMonth` 指定日期
6. 结束条件检查：实现 `canCreateNext(item)` 
7. 创建下次：实现 `createNextOccurrence(plugin, item)`，插入新 block
8. UI：ItemDetailDialog 添加「创建下次」「跳过本次」按钮

### 阶段三：工作日历（可选）

9. 工作日历：集成 `chinese-days` 库，`🔁工作日` 跳过节假日和周末

---

## 八、工作日获取方案

### 8.1 方案选择

采用 **`chinese-days` 库**（npm 包）：

| 特性 | 说明 |
|------|------|
| 数据源 | 跟随国务院发布自动更新 |
| 时间范围 | 2004-2024+ 年 |
| 体积 | gzip 后 7kb |
| 功能 | 节假日判断、调休识别、工作日计算 |
| CDN | 支持 `https://cdn.jsdelivr.net/npm/chinese-days/dist/index.min.js` |

### 8.2 实现方式

**Phase 1**：使用简单周一到周五（内置）
```typescript
function isWorkdaySimple(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6; // 非周末即工作日
}
```

**Phase 2**：引入 `chinese-days` 库
```typescript
import { isWorkday, getNextWorkday } from 'chinese-days';

function getNextWorkdayDate(date: string): string {
  const current = new Date(date);
  let next = new Date(current);
  next.setDate(next.getDate() + 1);
  
  // 跳过非工作日（周末+节假日）
  while (!isWorkday(formatDate(next))) {
    next.setDate(next.getDate() + 1);
  }
  
  return formatDate(next);
}
```

### 8.3 降级策略

- 若 `chinese-days` 数据缺失某年，降级为简单周一到周五判断
- 用户可手动配置「额外节假日」或「调休工作日」覆盖

---

## 九、验收标准

- [ ] 可解析 `🔁每天`/`🔁daily`、`🔁每周`/`🔁weekly` 等（支持中英文）
- [ ] 可解析 `🔚YYYY-MM-DD`、`🔢N` 结束条件
- [ ] 支持 UI 面板、右键菜单、斜杠命令 `/重复` 设置重复
- [ ] 事项详情中有 `repeatRule` 时显示「创建下次」
- [ ] 事项详情中有 `repeatRule` 时显示「跳过本次」
- [ ] 点击「跳过本次」直接修改当前事项日期为下一周期
- [ ] 点击「创建下次」能正确计算下一日期并插入新 block
- [ ] 月份边界处理正确（1月31日→2月28/29日）
- [ ] 支持 `🔁每月:15日` 指定日期重复
- [ ] 新 block 继承 content、reminder、repeatRule、endCondition
- [ ] 结束条件为 date 时，超过 endDate 不创建并提示
- [ ] 新 block 的提醒能正常触发
- [ ] 过期事项显示在「过期」分组中提醒用户
- [ ] （Phase 2）`🔁工作日` 正确跳过中国节假日和调休

---

## 十、与提醒的协作示例

```markdown
# 原始事项
月度汇报 @2026-03-17 ⏰14:00 🔁每月🔚2026-12-31

# 用户点击「完成」后
月度汇报 @2026-03-17 ⏰14:00 🔁每月🔚2026-12-31 #done

# 用户点击「创建下次」后，自动生成
月度汇报 @2026-04-17 ⏰14:00 🔁每月🔚2026-12-31

# 若用户跳过 2026-04-17（直接修改日期）
月度汇报 @2026-05-17 ⏰14:00 🔁每月🔚2026-12-31
```

**标记顺序约定**：
```
内容 @日期 [⏰提醒时间] [🔁重复规则] [:结束条件] [状态标签]
```
