# 重复事项设计

## 一、功能概述

为事项增加重复规则和结束条件，支持周期性事项（如周会、月度汇报）。每个 occurrence 为独立 block，用户完成一次后可通过「创建下次」生成下一 occurrence。

### 1.1 核心理念

- **多 block 设计**：每个 occurrence 独立 block，各自有 blockId、子块（链接、番茄钟等）
- **与提醒解耦**：重复规则用于「创建下次」，提醒仅负责单次通知（见 [reminder.md](./reminder.md)）
- **可选功能**：用户可选择是否为事项设置重复

## 二、标记语法

### 2.1 重复规则

| 标记 | 说明 | 创建下次时 |
|------|------|------------|
| `#重复:每天` | 每天重复 | +1 天 |
| `#重复:每周` | 每周重复 | +7 天，保持星期几 |
| `#重复:每月` | 每月重复 | +1 月，保持日号 |
| `#重复:每年` | 每年重复 | +1 年，保持月日 |
| `#重复:工作日` | 工作日重复 | 跳到下一个工作日 |

### 2.2 结束条件

| 标记 | 说明 | 示例 |
|------|------|------|
| `:until:YYYY-MM-DD` | 按日期结束 | `:until:2026-12-31` |
| `:count:N` | 按次数结束 | `:count:10` |
| 无参数 | 永不结束 | 不附加 |

### 2.3 完整示例

```markdown
月度汇报 @2026-03-17 !14:00 #重复:每月:until:2026-12-31
周会 @2026-03-06 !09:00 #重复:每周:count:52
背单词 @2026-03-17 !08:00 #重复:每天:count:30
年度总结 @2026-03-17 !10:00 #重复:每年
```

## 三、数据模型

### 3.1 Item 扩展

```typescript
interface Item {
  // ... 现有字段
  reminder?: ReminderConfig;
  repeatRule?: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'workday';
  endCondition?: {
    type: 'never' | 'date' | 'count';
    endDate?: string;   // YYYY-MM-DD
    maxCount?: number;
  };
}
```

### 3.2 解析规则

- `#重复:每月` → `repeatRule: 'monthly'`
- `#重复:每月:until:2026-12-31` → `repeatRule: 'monthly'`, `endCondition: { type: 'date', endDate: '2026-12-31' }`
- `#重复:每周:count:52` → `repeatRule: 'weekly'`, `endCondition: { type: 'count', maxCount: 52 }`

## 四、创建下次

### 4.1 触发入口

- 事项详情弹框中「创建下次」按钮
- 仅当事项有 `repeatRule` 时显示
- 完成（#done）后仍可点击，用于提前创建下一 occurrence

### 4.2 创建逻辑

```
输入：当前 Item（content, date, reminder, repeatRule, endCondition）
输出：新 block 内容

1. 根据 repeatRule 计算下一日期：
   - daily: date + 1 天
   - weekly: date + 7 天
   - monthly: date 的日号不变，月+1（跨年则年+1）
   - yearly: date + 1 年
   - workday: 下一工作日

2. 检查结束条件：
   - type=date: 若 nextDate > endDate，不创建，提示用户
   - type=count: 需追踪已创建次数（见 4.3）
   - type=never: 不检查

3. 生成新 block 内容：
   内容 @nextDate !reminderTime #重复:xxx:endCondition
   （继承 content、reminder、repeatRule、endCondition）

4. 在同级（与当前 block 同级）插入新 block
```

### 4.3 次数追踪

**方案 A**：不追踪，用户自行控制。`:count:10` 表示「最多创建 10 次」，由用户决定何时停止。

**方案 B**：在 block 属性或插件数据中记录「已创建次数」。创建下次时 +1，达到 maxCount 时禁用按钮。

**建议**：MVP 采用方案 A，Phase 2 可考虑方案 B。

## 五、与提醒的配合

- 创建下次时，新 block 继承 `!HH:mm` 或 `!-Xm` 提醒配置
- 提醒模块独立解析，每个 block 一条 ReminderRecord
- 事项完成（#done）后，该 block 的提醒被删除；新创建的 block 有独立提醒

## 六、集成点

### 6.1 解析层 (lineParser.ts)

- 解析 `#重复:每月` 等标记，填充 `Item.repeatRule`
- 解析 `:until:YYYY-MM-DD`、`:count:N`，填充 `Item.endCondition`
- 内容清理时移除 `#重复:xxx` 和 `:until:xxx`、`:count:N`，避免显示在事项内容中

### 6.2 事项详情 (ItemDetailDialog.vue)

- 有 `repeatRule` 时显示「创建下次」按钮
- 点击后调用创建下次逻辑，插入新 block，触发 DATA_REFRESH

### 6.3 思源 API

- 使用 `insertBlock` 或等价 API 在同级插入新 block
- 需获取当前 block 的 parentId、nextBlockId 以确定插入位置

## 七、实现步骤

### 阶段一：基础

1. 类型定义：`repeatRule`、`endCondition` 加入 Item
2. 解析：`parseItemLine` 中解析 `#重复:xxx` 和结束条件
3. 内容清理：移除重复与结束条件标记

### 阶段二：创建下次

4. 日期计算：实现 `getNextOccurrenceDate(date, repeatRule)` 
5. 结束条件检查：实现 `canCreateNext(item)` 
6. 创建下次：实现 `createNextOccurrence(plugin, item)`，插入新 block
7. UI：ItemDetailDialog 添加「创建下次」按钮

### 阶段三：增强（可选）

8. 次数追踪：实现 `:count:N` 的已创建次数记录
9. 工作日历：集成节假日/调休，`workday` 跳过节假日

## 八、验收标准

- [ ] 可解析 `#重复:每天`、`#重复:每周`、`#重复:每月`、`#重复:每年`、`#重复:工作日`
- [ ] 可解析 `:until:YYYY-MM-DD`、`:count:N` 结束条件
- [ ] 事项详情中有 `repeatRule` 时显示「创建下次」
- [ ] 点击「创建下次」能正确计算下一日期并插入新 block
- [ ] 新 block 继承 content、reminder、repeatRule、endCondition
- [ ] 结束条件为 date 时，超过 endDate 不创建并提示
- [ ] 新 block 的提醒能正常触发
