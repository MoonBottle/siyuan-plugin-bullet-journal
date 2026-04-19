# 习惯打卡功能实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为任务助手插件增加习惯打卡功能，支持二元型和计数型习惯，用户可在 Dock UI 或笔记中打卡，统计数据实时计算。

**Architecture:** 习惯与任务同级，通过 `🎯` 标记识别，挂载在 `Project.habits[]` 下。打卡记录（CheckInRecord）是习惯的子级，通过 `📅日期` 行识别。JS 逻辑只写一套，桌面端和移动端各自写 UI，通过 service/utils 共享。

**Tech Stack:** Vue 3 + Pinia + TypeScript + SiYuan Plugin API + Vitest

---

## 任务依赖图

```
Task 1 (models) ──→ Task 2 (habitParser) ──→ Task 3 (core.ts 集成) ──→ Task 4 (projectStore)
                                                                   │
                                                                   ├──→ Task 5 (habitStatsUtils)
                                                                   │
                                                                   ├──→ Task 6 (habitService)
                                                                   │
                                                                   ├──→ Task 7 (constants + slash commands)
                                                                   │
                                                                   └──→ Task 8-11 (UI 层)
```

---

### Task 1: 数据模型 — Habit / CheckInRecord / HabitFrequency / HabitStats

**Files:**
- Modify: `src/types/models.ts:84-94` (Project 接口新增 habits 字段)
- Create: 无新文件（类型定义追加到 models.ts）
- Test: `test/parser/habitParser.test.ts`（Task 2 中验证类型正确性）

**Step 1: 在 models.ts 中新增 HabitFrequency 类型**

在 `src/types/models.ts` 的 `ReminderConfig` 接口之前（约第 119 行），添加：

```typescript
// 习惯频率规则
export type HabitFrequency = {
  type: 'daily' | 'every_n_days' | 'weekly' | 'n_per_week' | 'weekly_days';
  interval?: number;             // 每 N 天的间隔（如 2 = 每2天）
  daysPerWeek?: number;          // 每周 N 天（如 3 = 每周3天）
  daysOfWeek?: number[];         // 每周指定周几（0=周日, 1=周一, ...）
};
```

**Step 2: 新增 CheckInRecord 接口**

紧接 HabitFrequency 之后：

```typescript
// 打卡记录
export interface CheckInRecord {
  content: string;               // 打卡日志内容（默认等于习惯名，用户可自定义修改）
  date: string;                  // YYYY-MM-DD
  docId: string;
  blockId: string;               // SiYuan block ID，作为唯一标识
  // 计数型专用
  currentValue?: number;         // 当前值（如 3）
  targetValue?: number;          // 目标值（如 8）
  unit?: string;                 // 单位
  // 所属习惯引用
  habitId: string;               // 所属习惯的 blockId
}
```

**Step 3: 新增 Habit 接口**

紧接 CheckInRecord 之后：

```typescript
// 习惯
export interface Habit {
  name: string;                  // 习惯名（如"喝水"、"早起"）
  docId: string;                 // 所属文档 ID
  blockId: string;               // SiYuan block ID，作为唯一标识
  lastBlockId?: string;          // 最后一个 record 的 block ID（用于插入位置）
  type: 'binary' | 'count';     // 二元型 / 计数型
  startDate: string;             // 开始日期（YYYY-MM-DD，必填）
  durationDays?: number;         // 持续日历天数（可选，如30天），到达后习惯结束
  endDate?: string;              // 计算字段：startDate + durationDays - 1
  target?: number;               // 目标值（计数型，如 8）
  unit?: string;                 // 单位（计数型，如"杯"）
  frequency?: HabitFrequency;    // 频率规则（必填）
  reminder?: ReminderConfig;     // 提醒配置（可选，复用已有）
  records: CheckInRecord[];      // 打卡记录
  links?: Link[];                // 链接
  pomodoros?: PomodoroRecord[];  // 番茄钟记录
}
```

**Step 4: 新增 HabitStats 接口**

```typescript
// 习惯统计（纯计算，不持久化）
export interface HabitStats {
  habitId: string;
  monthlyCheckins: number;       // 本月打卡次数（达标天数）
  totalCheckins: number;         // 总打卡次数（达标天数）
  currentStreak: number;         // 当前连续
  longestStreak: number;         // 最长连续
  completionRate: number;        // 总完成率 (0-1)
  monthlyCompletionRate: number; // 本月完成率 (0-1)
  weeklyCompletionRate: number;  // 本周完成率 (0-1)
  totalValue?: number;           // 累计值（计数型）
  averageValue?: number;         // 日均值（计数型）
  isCompleted: boolean;          // 习惯是否已结束
  isPeriodCompleted: boolean;    // 当期是否已达标
}
```

**Step 5: 在 Project 接口中新增 habits 字段**

修改 `src/types/models.ts:84-94`：

```typescript
// 项目
export interface Project {
  id: string;
  name: string;
  description?: string;
  tasks: Task[];
  habits: Habit[];              // 新增：习惯列表
  path: string;
  groupId?: string;
  links?: Link[];
  pomodoros?: PomodoroRecord[];
}
```

**Step 6: 运行类型检查确认无报错**

Run: `npx tsc --noEmit`
Expected: 无类型错误

**Step 7: 修复现有代码中的 Project 初始化**

由于 `Project` 新增了 `habits` 必填字段，需要找到所有创建 `Project` 对象的地方并添加 `habits: []`。

搜索 `src/` 中所有 `tasks: []` 或 `project.tasks` 的初始化位置，补充 `habits: []`。

主要位置：
- `src/parser/core.ts:143-152` — `parseKramdown()` 中的 project 初始化
- 其他可能的测试文件或 mock 数据

Run: `npx tsc --noEmit`
Expected: 无类型错误

**Step 8: Commit**

```bash
git add src/types/models.ts src/parser/core.ts
git commit -m "feat(habit): add Habit/CheckInRecord/HabitStats data models"
```

---

### Task 2: 习惯行解析器 — habitParser.ts

**Files:**
- Create: `src/parser/habitParser.ts`
- Test: `test/parser/habitParser.test.ts`

**Step 1: 写失败测试**

创建 `test/parser/habitParser.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import { parseHabitLine, parseCheckInRecordLine } from '@/parser/habitParser';
import type { Habit, CheckInRecord } from '@/types/models';

describe('parseHabitLine', () => {
  it('二元型：早起 🎯2026-04-01 坚持30天 🔄每天', () => {
    const result = parseHabitLine('早起 🎯2026-04-01 坚持30天 🔄每天');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('binary');
    expect(result!.name).toBe('早起');
    expect(result!.startDate).toBe('2026-04-01');
    expect(result!.durationDays).toBe(30);
    expect(result!.endDate).toBe('2026-04-30');
    expect(result!.frequency?.type).toBe('daily');
  });

  it('二元型无坚持天数：冥想 🎯2026-04-01 🔄每天', () => {
    const result = parseHabitLine('冥想 🎯2026-04-01 🔄每天');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('binary');
    expect(result!.durationDays).toBeUndefined();
    expect(result!.endDate).toBeUndefined();
  });

  it('计数型：喝水 🎯2026-04-01 坚持21天 8杯 🔄每天', () => {
    const result = parseHabitLine('喝水 🎯2026-04-01 坚持21天 8杯 🔄每天');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('count');
    expect(result!.target).toBe(8);
    expect(result!.unit).toBe('杯');
    expect(result!.durationDays).toBe(21);
  });

  it('计数型无坚持天数：跑步 🎯2026-04-01 5公里 🔄每2天', () => {
    const result = parseHabitLine('跑步 🎯2026-04-01 5公里 🔄每2天');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('count');
    expect(result!.target).toBe(5);
    expect(result!.unit).toBe('公里');
    expect(result!.frequency?.type).toBe('every_n_days');
    expect(result!.frequency?.interval).toBe(2);
  });

  it('每周指定周几：周报 🎯2026-04-01 🔄每周五', () => {
    const result = parseHabitLine('周报 🎯2026-04-01 🔄每周五');
    expect(result).not.toBeNull();
    expect(result!.frequency?.type).toBe('weekly_days');
    expect(result!.frequency?.daysOfWeek).toEqual([5]);
  });

  it('带提醒：早起 🎯2026-04-01 坚持30天 ⏰07:00 🔄每天', () => {
    const result = parseHabitLine('早起 🎯2026-04-01 坚持30天 ⏰07:00 🔄每天');
    expect(result).not.toBeNull();
    expect(result!.reminder).toBeDefined();
    expect(result!.reminder!.type).toBe('absolute');
    expect(result!.reminder!.time).toBe('07:00');
  });

  it('无频率不识别为习惯：早起 🎯2026-04-01', () => {
    const result = parseHabitLine('早起 🎯2026-04-01');
    expect(result).toBeNull();
  });

  it('无🎯不识别为习惯：早起 📅2026-04-01 🔄每天', () => {
    const result = parseHabitLine('早起 📅2026-04-01 🔄每天');
    expect(result).toBeNull();
  });

  it('每周N天：阅读 🎯2026-04-01 30分钟 🔄每周3天', () => {
    const result = parseHabitLine('阅读 🎯2026-04-01 30分钟 🔄每周3天');
    expect(result).not.toBeNull();
    expect(result!.frequency?.type).toBe('n_per_week');
    expect(result!.frequency?.daysPerWeek).toBe(3);
  });

  it('每周多天：锻炼 🎯2026-04-01 🔄每周一三五', () => {
    const result = parseHabitLine('锻炼 🎯2026-04-01 🔄每周一三五');
    expect(result).not.toBeNull();
    expect(result!.frequency?.type).toBe('weekly_days');
    expect(result!.frequency?.daysOfWeek).toEqual([1, 3, 5]);
  });
});

describe('parseCheckInRecordLine', () => {
  it('二元型打卡：早起 📅2026-04-06 ✅', () => {
    const result = parseCheckInRecordLine('早起 📅2026-04-06 ✅', 'habit-block-1');
    expect(result).not.toBeNull();
    expect(result!.content).toBe('早起');
    expect(result!.date).toBe('2026-04-06');
    expect(result!.habitId).toBe('habit-block-1');
  });

  it('计数型打卡：喝水 3/8杯 📅2026-04-06', () => {
    const result = parseCheckInRecordLine('喝水 3/8杯 📅2026-04-06', 'habit-block-1');
    expect(result).not.toBeNull();
    expect(result!.currentValue).toBe(3);
    expect(result!.targetValue).toBe(8);
    expect(result!.unit).toBe('杯');
  });

  it('计数型达标：喝水 8/8杯 📅2026-04-06 ✅', () => {
    const result = parseCheckInRecordLine('喝水 8/8杯 📅2026-04-06 ✅', 'habit-block-1');
    expect(result).not.toBeNull();
    expect(result!.currentValue).toBe(8);
    expect(result!.targetValue).toBe(8);
  });

  it('使用@日期：早起 @2026-04-06 ✅', () => {
    const result = parseCheckInRecordLine('早起 @2026-04-06 ✅', 'habit-block-1');
    expect(result).not.toBeNull();
    expect(result!.date).toBe('2026-04-06');
  });

  it('自定义内容：今天喝了温水 3/8杯 📅2026-04-06', () => {
    const result = parseCheckInRecordLine('今天喝了温水 3/8杯 📅2026-04-06', 'habit-block-1');
    expect(result).not.toBeNull();
    expect(result!.content).toBe('今天喝了温水');
    expect(result!.currentValue).toBe(3);
  });

  it('无日期不识别为记录', () => {
    const result = parseCheckInRecordLine('喝水 3/8杯', 'habit-block-1');
    expect(result).toBeNull();
  });
});
```

**Step 2: 运行测试确认失败**

Run: `npx vitest run test/parser/habitParser.test.ts`
Expected: FAIL — `parseHabitLine` 和 `parseCheckInRecordLine` 不存在

**Step 3: 实现 habitParser.ts**

创建 `src/parser/habitParser.ts`，包含：

1. `parseHabitLine(line: string): Habit | null`
   - 检测 `🎯` 标记，无则返回 null
   - 提取习惯名（🎯 之前的文本）
   - 解析 `🎯` 后的开始日期（必填）
   - 解析 `坚持N天` → `durationDays`，计算 `endDate = startDate + durationDays - 1`
   - 解析目标值+单位（如 `8杯`、`5公里`、`30分钟`），有则 `type: 'count'`，无则 `type: 'binary'`
   - 解析 `🔄` 频率规则（必填），无则返回 null
   - 解析 `⏰` 提醒配置（可选，复用 `parseReminderFromLine`）

2. `parseCheckInRecordLine(line: string, habitId: string): CheckInRecord | null`
   - 必须包含 `📅` 或 `@` 日期
   - 提取日期
   - 解析计数型格式 `N/M单位`（如 `3/8杯`）
   - 检测 `✅` 标记
   - 提取内容（去除标记后的文本）

3. `parseHabitFrequency(freqStr: string): HabitFrequency | null`
   - `每天` / `daily` → `{ type: 'daily' }`
   - `每N天` / `every N days` → `{ type: 'every_n_days', interval: N }`
   - `每周` / `weekly` → `{ type: 'weekly' }`
   - `每周N天` / `N days/week` → `{ type: 'n_per_week', daysPerWeek: N }`
   - `每周一二三...` → `{ type: 'weekly_days', daysOfWeek: [...] }`

4. 辅助函数：
   - `isHabitLine(line: string): boolean` — 检测行是否包含 `🎯`
   - `buildHabitDefinitionMarkdown(habit: Partial<Habit>): string` — 生成习惯定义行 Markdown

**Step 4: 运行测试确认通过**

Run: `npx vitest run test/parser/habitParser.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/parser/habitParser.ts test/parser/habitParser.test.ts
git commit -m "feat(habit): add habit parser with frequency and check-in parsing"
```

---

### Task 3: core.ts 集成 — 识别 🎯 行为习惯定义

**Files:**
- Modify: `src/parser/core.ts:135-403` (parseKramdown 函数)
- Test: `test/parser/core.test.ts` (新增习惯解析用例)

**Step 1: 写失败测试**

在 `test/parser/core.test.ts` 中添加新的 describe 块：

```typescript
describe('parseKramdown 习惯打卡解析', () => {
  it('识别🎯行为习惯定义', () => {
    const kramdown = `## 习惯测试\n\n早起 🎯2026-04-01 坚持30天 🔄每天\n{: id="20260401000000-abcdef"}\n\n早起 📅2026-04-06 ✅\n{: id="20260406000000-ghijkl"}`;
    const result = parseKramdown(kramdown, 'doc-1');
    expect(result).not.toBeNull();
    expect(result!.habits).toHaveLength(1);
    expect(result!.habits[0].name).toBe('早起');
    expect(result!.habits[0].type).toBe('binary');
    expect(result!.habits[0].records).toHaveLength(1);
    expect(result!.habits[0].records[0].date).toBe('2026-04-06');
  });

  it('习惯与任务严格交替', () => {
    const kramdown = `## 交替测试\n\n任务1 #任务 @L1\n{: id="task1-block"}\n\n事项1 📅2026-04-01\n{: id="item1-block"}\n\n喝水 🎯2026-04-01 8杯 🔄每天\n{: id="habit1-block"}\n\n喝水 3/8杯 📅2026-04-06\n{: id="record1-block"}\n\n任务2 #任务 @L2\n{: id="task2-block"}`;
    const result = parseKramdown(kramdown, 'doc-2');
    expect(result).not.toBeNull();
    expect(result!.tasks).toHaveLength(2);
    expect(result!.tasks[0].items).toHaveLength(1);
    expect(result!.habits).toHaveLength(1);
    expect(result!.habits[0].name).toBe('喝水');
  });

  it('多个习惯并行', () => {
    const kramdown = `## 多习惯\n\n早起 🎯2026-04-01 🔄每天\n{: id="h1-block"}\n\n早起 📅2026-04-06 ✅\n{: id="r1-block"}\n\n喝水 🎯2026-04-01 8杯 🔄每天\n{: id="h2-block"}\n\n喝水 5/8杯 📅2026-04-06\n{: id="r2-block"}`;
    const result = parseKramdown(kramdown, 'doc-3');
    expect(result!.habits).toHaveLength(2);
  });
});
```

**Step 2: 运行测试确认失败**

Run: `npx vitest run test/parser/core.test.ts -t "习惯打卡解析"`
Expected: FAIL — habits 为空（core.ts 尚未识别 🎯）

**Step 3: 修改 core.ts 的 parseKramdown 函数**

在 `src/parser/core.ts` 中做以下修改：

1. 在文件顶部添加导入：
```typescript
import { parseHabitLine, parseCheckInRecordLine, isHabitLine } from './habitParser';
import type { Habit, CheckInRecord } from '@/types/models';
```

2. 在 `parseKramdown()` 函数中，`let currentTask: Task | null = null;` 后面添加：
```typescript
let currentHabit: Habit | null = null;
```

3. 在 `let lastBlockType` 后面添加习惯类型：
```typescript
let lastBlockType: 'project' | 'task' | 'item' | 'habit' | null = null;
```

4. 在 project 初始化中添加 `habits: []`

5. 在遍历 blocks 的循环中，在任务行检测（`#任务`）之前，添加习惯行检测：
```typescript
// 解析习惯行（包含 🎯 标记）
const cleanedContent = stripListAndBlockAttr(content);
if (isHabitLine(cleanedContent)) {
  const habit = parseHabitLine(cleanedContent);
  if (habit) {
    habit.docId = docId;
    habit.blockId = block.blockId;
    habit.records = [];
    currentHabit = habit;
    currentItem = null;
    currentTask = null;
    lastBlockType = 'habit';
    project.habits.push(habit);
  }
  continue;
}
```

6. 在事项行检测之前，添加打卡记录检测（习惯上下文中）：
```typescript
// 解析打卡记录（在当前习惯下，包含 📅 或 @ 日期的行）
if (currentHabit && (content.includes('@') || content.includes('📅')) && !hasTaskTag && !isHabitLine(stripListAndBlockAttr(content))) {
  const record = parseCheckInRecordLine(stripListAndBlockAttr(content), currentHabit.blockId);
  if (record) {
    record.docId = docId;
    record.blockId = block.blockId;
    currentHabit.records.push(record);
    currentHabit.lastBlockId = block.blockId;
    lastBlockType = 'habit';
    continue;
  }
}
```

7. 在遇到 `#任务` 行时，重置 `currentHabit = null`（严格交替）

**Step 4: 运行测试确认通过**

Run: `npx vitest run test/parser/core.test.ts -t "习惯打卡解析"`
Expected: PASS

**Step 5: 运行全部测试确认无回归**

Run: `npx vitest run`
Expected: 所有原有测试通过

**Step 6: Commit**

```bash
git add src/parser/core.ts test/parser/core.test.ts
git commit -m "feat(habit): integrate habit parsing into core parser with strict alternation"
```

---

### Task 4: projectStore 集成 — habits 数据挂载和 getters

**Files:**
- Modify: `src/stores/projectStore.ts`
- Test: `test/stores/projectStore.test.ts`（新增习惯相关用例）

**Step 1: 写失败测试**

在 `test/stores/projectStore.test.ts` 中添加：

```typescript
describe('habits getters', () => {
  it('getHabits 返回所有习惯', () => {
    const store = useProjectStore();
    store.$patch({
      projects: [{
        id: 'doc-1', name: '测试', tasks: [], habits: [
          { name: '早起', type: 'binary', startDate: '2026-04-01', records: [], blockId: 'b1', docId: 'doc-1', frequency: { type: 'daily' } },
          { name: '喝水', type: 'count', startDate: '2026-04-01', target: 8, unit: '杯', records: [], blockId: 'b2', docId: 'doc-1', frequency: { type: 'daily' } }
        ], path: '/test'
      }]
    });
    const habits = store.getHabits('');
    expect(habits).toHaveLength(2);
  });

  it('getTodayRecords 返回今日打卡记录', () => {
    const store = useProjectStore();
    store.$patch({
      projects: [{
        id: 'doc-1', name: '测试', tasks: [], habits: [{
          name: '早起', type: 'binary', startDate: '2026-04-01', records: [
            { content: '早起', date: '2026-04-06', blockId: 'r1', docId: 'doc-1', habitId: 'b1' }
          ], blockId: 'b1', docId: 'doc-1', frequency: { type: 'daily' }
        }], path: '/test'
      }],
      currentDate: '2026-04-06'
    });
    const records = store.getTodayRecords('');
    expect(records).toHaveLength(1);
  });
});
```

**Step 2: 运行测试确认失败**

Run: `npx vitest run test/stores/projectStore.test.ts -t "habits getters"`
Expected: FAIL — `getHabits` 方法不存在

**Step 3: 在 projectStore 中添加 habits 相关 getters**

在 `src/stores/projectStore.ts` 的 getters 中添加：

```typescript
// 从 projects 计算所有习惯
habits: (state): Habit[] => {
  const habits: Habit[] = [];
  for (const project of state.projects) {
    for (const habit of project.habits || []) {
      habit.project = project;
      habits.push(habit);
    }
  }
  return habits;
},

// 按分组过滤的习惯
getHabits: (state) => (groupId: string): Habit[] => {
  const habits = (state as any).habits as Habit[];
  if (!groupId) return habits;
  return habits.filter(h => h.project?.groupId === groupId);
},

// 获取今日打卡记录
getTodayRecords: (state) => (groupId: string): CheckInRecord[] => {
  const records: CheckInRecord[] = [];
  const habits = (state as any).getHabits(groupId) as Habit[];
  for (const habit of habits) {
    for (const record of habit.records) {
      if (record.date === state.currentDate) {
        records.push(record);
      }
    }
  }
  return records;
},

// 按日期获取打卡记录
getRecordsByDate: (state) => (date: string, groupId: string): CheckInRecord[] => {
  const records: CheckInRecord[] = [];
  const habits = (state as any).getHabits(groupId) as Habit[];
  for (const habit of habits) {
    for (const record of habit.records) {
      if (record.date === date) {
        records.push(record);
      }
    }
  }
  return records;
},
```

需要在文件顶部添加导入：
```typescript
import type { Habit, CheckInRecord } from '@/types/models';
```

**Step 4: 运行测试确认通过**

Run: `npx vitest run test/stores/projectStore.test.ts -t "habits getters"`
Expected: PASS

**Step 5: 运行全部测试确认无回归**

Run: `npx vitest run`
Expected: 所有测试通过

**Step 6: Commit**

```bash
git add src/stores/projectStore.ts test/stores/projectStore.test.ts
git commit -m "feat(habit): add habits state and getters to projectStore"
```

---

### Task 5: 统计计算 — habitStatsUtils.ts

**Files:**
- Create: `src/utils/habitStatsUtils.ts`
- Test: `test/utils/habitStatsUtils.test.ts`

**Step 1: 写失败测试**

创建 `test/utils/habitStatsUtils.test.ts`，覆盖设计文档中的测试用例 #30-#43：

```typescript
import { describe, it, expect } from 'vitest';
import { calculateHabitStats } from '@/utils/habitStatsUtils';
import type { Habit, CheckInRecord } from '@/types/models';

function mkHabit(overrides: Partial<Habit> & { name: string }): Habit {
  return {
    docId: 'doc-1',
    blockId: 'habit-1',
    type: 'binary',
    startDate: '2026-04-01',
    records: [],
    frequency: { type: 'daily' },
    ...overrides
  };
}

function mkRecord(date: string, overrides?: Partial<CheckInRecord>): CheckInRecord {
  return {
    content: '早起',
    date,
    docId: 'doc-1',
    blockId: `record-${date}`,
    habitId: 'habit-1',
    ...overrides
  };
}

describe('calculateHabitStats', () => {
  it('#30: 每天打卡连续5天 → currentStreak=5', () => {
    const habit = mkHabit({
      name: '早起',
      records: [
        mkRecord('2026-04-03'), mkRecord('2026-04-04'),
        mkRecord('2026-04-05'), mkRecord('2026-04-06'), mkRecord('2026-04-07')
      ]
    });
    const stats = calculateHabitStats(habit, '2026-04-07');
    expect(stats.currentStreak).toBe(5);
    expect(stats.longestStreak).toBe(5);
  });

  it('#31: 昨天未打卡 → currentStreak=1', () => {
    const habit = mkHabit({
      name: '早起',
      records: [mkRecord('2026-04-05'), mkRecord('2026-04-07')]
    });
    const stats = calculateHabitStats(habit, '2026-04-07');
    expect(stats.currentStreak).toBe(1);
  });

  it('#32: 今天未打卡，昨天前天都打 → currentStreak=2（从昨天算起）', () => {
    const habit = mkHabit({
      name: '早起',
      records: [mkRecord('2026-04-05'), mkRecord('2026-04-06')]
    });
    const stats = calculateHabitStats(habit, '2026-04-07');
    expect(stats.currentStreak).toBe(2);
  });

  it('#33: 打卡3天→断1天→连续7天 → currentStreak=7, longestStreak=7', () => {
    const habit = mkHabit({
      name: '早起',
      records: [
        mkRecord('2026-04-01'), mkRecord('2026-04-02'), mkRecord('2026-04-03'),
        // 4月4日断
        mkRecord('2026-04-05'), mkRecord('2026-04-06'), mkRecord('2026-04-07'),
        mkRecord('2026-04-08'), mkRecord('2026-04-09'), mkRecord('2026-04-10'), mkRecord('2026-04-11')
      ]
    });
    const stats = calculateHabitStats(habit, '2026-04-11');
    expect(stats.currentStreak).toBe(7);
    expect(stats.longestStreak).toBe(7);
  });

  it('#36: 全部无打卡记录 → currentStreak=0, longestStreak=0', () => {
    const habit = mkHabit({ name: '早起', records: [] });
    const stats = calculateHabitStats(habit, '2026-04-07');
    expect(stats.currentStreak).toBe(0);
    expect(stats.longestStreak).toBe(0);
  });

  it('#37: 🔄每天，开始4/1，今天4/7，打卡5天 → 完成率=5/7≈71.4%', () => {
    const habit = mkHabit({
      name: '早起',
      startDate: '2026-04-01',
      records: [
        mkRecord('2026-04-01'), mkRecord('2026-04-02'), mkRecord('2026-04-03'),
        mkRecord('2026-04-05'), mkRecord('2026-04-07')
      ]
    });
    const stats = calculateHabitStats(habit, '2026-04-07');
    expect(stats.completionRate).toBeCloseTo(5 / 7, 1);
  });

  it('计数型：达标天计入完成', () => {
    const habit = mkHabit({
      name: '喝水',
      type: 'count',
      target: 8,
      unit: '杯',
      records: [
        mkRecord('2026-04-06', { currentValue: 5, targetValue: 8, unit: '杯' }),
        mkRecord('2026-04-07', { currentValue: 8, targetValue: 8, unit: '杯' })
      ]
    });
    const stats = calculateHabitStats(habit, '2026-04-07');
    expect(stats.totalCheckins).toBe(1); // 只有4/7达标
  });
});
```

**Step 2: 运行测试确认失败**

Run: `npx vitest run test/utils/habitStatsUtils.test.ts`
Expected: FAIL

**Step 3: 实现 habitStatsUtils.ts**

创建 `src/utils/habitStatsUtils.ts`，核心函数：

1. `calculateHabitStats(habit: Habit, currentDate: string): HabitStats`
   - 计算连续天数（streak）：从今天/昨天往前遍历 records
   - 计算最长连续
   - 计算完成率
   - 计数型：累计值、日均值
   - 判断是否已结束（durationDays 到期）
   - 判断当期是否已达标

2. `calculateAllHabitStats(habits: Habit[], currentDate: string): Map<string, HabitStats>`

3. `isRecordCompleted(record: CheckInRecord, habit: Habit): boolean`
   - 二元型：record 存在即完成
   - 计数型：currentValue >= targetValue

4. `getHabitMonthCalendarData(habit: Habit, yearMonth: string, stats: HabitStats): CalendarData[]`
   - 返回月视图中每个日期的打卡状态（达标/部分/未打卡）

**Step 4: 运行测试确认通过**

Run: `npx vitest run test/utils/habitStatsUtils.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/habitStatsUtils.ts test/utils/habitStatsUtils.test.ts
git commit -m "feat(habit): add habit statistics calculation utilities"
```

---

### Task 6: 打卡服务 — habitService.ts

**Files:**
- Create: `src/services/habitService.ts`
- Test: `test/services/habitService.test.ts`

**Step 1: 写失败测试**

创建 `test/services/habitService.test.ts`，覆盖设计文档中的测试用例 #19-#29：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api', () => ({
  updateBlock: vi.fn(),
  insertBlock: vi.fn(),
  getBlockKramdown: vi.fn(),
  getBlockByID: vi.fn(),
}));

vi.mock('@/i18n', () => ({
  t: vi.fn((key: string) => key),
}));

import { checkIn, checkInCount } from '@/services/habitService';
import type { Habit } from '@/types/models';

// ...测试用例覆盖 #19-#29
```

**Step 2: 运行测试确认失败**

**Step 3: 实现 habitService.ts**

创建 `src/services/habitService.ts`，核心函数：

1. `checkIn(habit: Habit, date: string, writer?: BlockWriter): Promise<boolean>`
   - 二元型打卡：创建 `习惯名 📅日期 ✅` block
   - 插入位置：habit.lastBlockId 之后，或 habit.blockId 之后

2. `checkInCount(habit: Habit, date: string, incrementBy: number, writer?: BlockWriter): Promise<boolean>`
   - 计数型 +1：更新或创建 `习惯名 N/目标值单位 📅日期` block
   - 达标自动追加 `✅`

3. `setCheckInValue(habit: Habit, date: string, value: number, writer?: BlockWriter): Promise<boolean>`
   - 计数型设置具体值

4. `deleteCheckIn(record: CheckInRecord): Promise<boolean>`
   - 删除打卡记录 block

5. `buildCheckInMarkdown(habit: Habit, date: string, currentValue?: number): string`
   - 构建打卡记录行的 Markdown

**Step 4: 运行测试确认通过**

**Step 5: Commit**

```bash
git add src/services/habitService.ts test/services/habitService.test.ts
git commit -m "feat(habit): add habit check-in service with create/update/delete"
```

---

### Task 7: 常量与斜杠命令注册

**Files:**
- Modify: `src/constants.ts` (新增 DOCK_TYPES.HABIT 和斜杠命令)
- Modify: `src/utils/slashCommands.ts` (新增 /xg、/dk、/xgd 命令)
- Modify: `src/index.ts` (注册 HabitDock、斜杠命令)
- Test: 无（集成测试，手动验证）

**Step 1: 在 constants.ts 中新增习惯相关常量**

```typescript
// 在 DOCK_TYPES 中新增：
HABIT: 'bullet-journal-habit',

// 在 SLASH_COMMAND_FILTERS 中新增：
HABIT: ['/xg', '/habit'],
CHECK_IN: ['/dk', '/checkin'],
HABIT_DOCK: ['/xgd', '/habits'],
```

同时更新 `ALL_SLASH_COMMAND_FILTERS` 数组。

**Step 2: 在 slashCommands.ts 中新增斜杠命令**

在 `createSlashCommands` 函数的 `builtinCommands` 数组中新增三个命令：

1. `/xg` `/habit` — 创建/编辑习惯
   - callback: 打开 HabitCreateDialog

2. `/dk` `/checkin` — 打卡
   - callback: 调用 habitService.checkIn 或 checkInCount

3. `/xgd` `/habits` — 打开习惯 Dock
   - callback: 调用 config.openHabitDock()

**Step 3: 在 SlashCommandConfig 接口中新增**

```typescript
openHabitDock: () => void;
```

**Step 4: 在 index.ts 中注册 HabitDock**

在 `registerDocks()` 方法中，参照 TodoDock 的注册模式，新增 HabitDock 注册：

```typescript
this.addDock({
  config: {
    position: 'RightBottom',
    size: { width: 320, height: 400 },
    icon: 'iconCheck',
    title: t('habit').title
  },
  data: {},
  type: DOCK_TYPES.HABIT,
  init() {
    this.element.style.height = '100%';
    this.element.style.overflow = 'hidden';
    this.element.style.display = 'flex';
    this.element.style.flexDirection = 'column';
    const pinia = getSharedPinia() ?? createPinia();
    const app = createApp(HabitDock, { plugin });
    app.use(pinia);
    app.mount(this.element);
  },
  destroy() {
    this.element.innerHTML = '';
  }
});
```

**Step 5: 新增 openHabitDock 方法**

```typescript
private openHabitDock() {
  const rightDock = (window as any).siyuan?.layout?.rightDock;
  if (rightDock) {
    rightDock.toggleModel(`${this.name}${DOCK_TYPES.HABIT}`, true);
  }
}
```

**Step 6: 更新 registerSlashCommands 中的 config**

```typescript
openHabitDock: () => { this.openHabitDock(); },
```

**Step 7: Commit**

```bash
git add src/constants.ts src/utils/slashCommands.ts src/index.ts
git commit -m "feat(habit): register habit dock, slash commands /xg /dk /xgd"
```

---

### Task 8: 桌面端 HabitDock — 第一层（周日期 + 习惯列表）

**Files:**
- Create: `src/tabs/HabitDock.vue` (路由组件，同 TodoDock 模式)
- Create: `src/tabs/DesktopHabitDock.vue` (桌面端主视图)
- Create: `src/components/habit/HabitWeekBar.vue` (周日期行)
- Create: `src/components/habit/HabitListItem.vue` (习惯列表项)
- Modify: `src/i18n/zh_CN.json` / `src/i18n/en_US.json` (新增 habit.* keys)

**Step 1: 创建 i18n 条目**

在 `src/i18n/zh_CN.json` 中新增：
```json
"habit": {
  "title": "习惯打卡",
  "todayChecked": "已打卡",
  "todayUnchecked": "待打卡",
  "periodCompleted": "本周已达标",
  "streakDays": "连续{n}天",
  "checkIn": "打卡",
  "addOne": "+1",
  "completed": "已完成"
}
```

**Step 2: 创建 HabitDock.vue 路由组件**

参照 `src/tabs/TodoDock.vue`，创建桌面/移动分发组件。

**Step 3: 创建 DesktopHabitDock.vue**

参照 `src/tabs/DesktopTodoDock.vue` 的结构：
- 顶栏（标题 + 更多按钮）
- 周日期行组件 `HabitWeekBar`
- 习惯列表（使用 `HabitListItem`）
- 通过 `useProjectStore()` 获取 habits 数据

**Step 4: 创建 HabitWeekBar.vue**

- 显示本周周一到周日
- 当天高亮
- 点击可切换查看某天的习惯

**Step 5: 创建 HabitListItem.vue**

- 显示习惯名 + 进度/状态
- 二元型：已打卡/待打卡
- 计数型：当前值/目标值+单位 + +1 按钮
- 点击展开详情（Task 9）

**Step 6: Commit**

```bash
git add src/tabs/HabitDock.vue src/tabs/DesktopHabitDock.vue src/components/habit/ src/i18n/
git commit -m "feat(habit): add desktop HabitDock with week bar and habit list"
```

---

### Task 9: 桌面端 HabitDock — 第二层（统计 + 打卡日历 + 日志）

**Files:**
- Create: `src/components/habit/HabitStatsCards.vue` (4个统计卡片)
- Create: `src/components/habit/HabitMonthCalendar.vue` (打卡月历)
- Create: `src/components/habit/HabitRecordLog.vue` (打卡日志列表)
- Create: `src/components/habit/HabitCountInput.vue` (计数型输入)

**Step 1: 创建 HabitStatsCards.vue**

2x2 网格布局，4个卡片：
- 月打卡次数
- 总打卡次数
- 月完成率
- 连续打卡（当前/最长）

**Step 2: 创建 HabitMonthCalendar.vue**

- 月视图日历
- 颜色深浅表示达标程度（深绿=达标，浅绿=部分，灰=未打卡）
- 支持切换月份

**Step 3: 创建 HabitRecordLog.vue**

- 打卡日志列表，按时间倒序
- 每条记录显示日期、内容、状态
- 计数型每条可 +1 或修改值

**Step 4: 创建 HabitCountInput.vue**

- +1 按钮（快速递增）
- 自定义输入（长按/右键弹出输入框）

**Step 5: 在 DesktopHabitDock 中集成第二层**

点击习惯项 → 展开统计面板（返回按钮 + 统计卡片 + 月历 + 日志）

**Step 6: Commit**

```bash
git add src/components/habit/
git commit -m "feat(habit): add habit detail view with stats, calendar and record log"
```

---

### Task 10: 移动端习惯打卡 UI

**Files:**
- Modify: `src/mobile/MobileTodoDock.vue` (底部导航新增打卡按钮)
- Modify: `src/mobile/components/todo/MobileBottomNav.vue` (新增打卡导航项)
- Create: `src/mobile/components/habit/MobileHabitList.vue` (移动端习惯列表)
- Create: `src/mobile/drawers/habit/HabitDetailDrawer.vue` (习惯详情抽屉)

**Step 1: 修改 MobileBottomNav.vue**

在现有的「番茄钟 | [+创建] | 更多」基础上新增打卡按钮：

```html
<button class="nav-item" @click="emit('open-habit')">
  <div class="nav-icon-wrapper">
    <svg class="nav-icon"><use xlink:href="#iconCheck"></use></svg>
  </div>
  <span class="nav-label">{{ t('habit').title }}</span>
</button>
```

新增 emit：`'open-habit': []`

**Step 2: 修改 MobileTodoDock.vue**

- 监听 `@open-habit` 事件
- 新增 `state.showHabitView` 状态
- 当 showHabitView 为 true 时，替换 MobileTodoList 区域显示 MobileHabitList

**Step 3: 创建 MobileHabitList.vue**

- 周日期行 + 习惯列表
- 每个习惯项显示名称、状态/进度、打卡按钮
- 点击习惯项 → 打开 HabitDetailDrawer

**Step 4: 创建 HabitDetailDrawer.vue**

- slide-up 抽屉模式
- 4个统计卡片
- 打卡月历
- 打卡日志

**Step 5: Commit**

```bash
git add src/mobile/ src/components/habit/
git commit -m "feat(habit): add mobile habit check-in UI with bottom nav and detail drawer"
```

---

### Task 11: 习惯创建/编辑弹框 — HabitCreateDialog

**Files:**
- Create: `src/components/dialog/HabitCreateDialog.vue`
- 修改: `src/utils/slashCommands.ts` (集成 /xg 命令)

**Step 1: 创建 HabitCreateDialog.vue**

参照现有的 `ReminderSettingDialog` / `RecurringSettingDialog` 模式：

表单字段：
- 习惯名（文本输入）
- 开始日期（日期选择器，默认今天）
- 坚持天数（数字输入，可选）
- 类型切换（二元型 / 计数型）
- 目标值+单位（计数型时显示）
- 提醒时间（可选，复用 ReminderSettingDialog）
- 频率（选择：每天 / 每N天 / 每周 / 每周N天 / 指定周几）

**创建模式**：确认后在当前光标位置插入完整的习惯定义行
**编辑模式**：预填当前值，确认后更新习惯定义行

**Step 2: 在 slashCommands.ts 中集成 /xg 命令**

```typescript
case 'habit':
  return (protyle, nodeElement) => {
    deleteSlashCommandContent(protyle, filter);
    openHabitCreateDialog(nodeElement);
  };
```

**Step 3: Commit**

```bash
git add src/components/dialog/HabitCreateDialog.vue src/utils/slashCommands.ts
git commit -m "feat(habit): add habit create/edit dialog for /xg slash command"
```

---

### Task 12: 提醒服务扩展 — habitReminder

**Files:**
- Create: `src/services/habitReminder.ts`
- Modify: `src/services/reminderService.ts` (集成习惯提醒)

**Step 1: 创建 habitReminder.ts**

核心逻辑：
- 遍历所有有 `⏰` 的 habit
- 根据频率判断今天是否应为打卡日
- 如果是打卡日且未打卡 → 计算提醒时间
- 返回提醒列表

**Step 2: 在 reminderService.ts 中集成**

在 `checkReminders()` 方法中，除了检查 item reminders，也检查 habit reminders。

**Step 3: Commit**

```bash
git add src/services/habitReminder.ts src/services/reminderService.ts
git commit -m "feat(habit): add habit reminder service with frequency-based scheduling"
```

---

## 实施顺序总结

| 阶段 | Task | 依赖 | 预计时长 |
|------|-------|------|----------|
| P0-解析 | Task 1: 数据模型 | 无 | 30min |
| P0-解析 | Task 2: habitParser | Task 1 | 1h |
| P0-解析 | Task 3: core.ts 集成 | Task 2 | 1h |
| P0-存储 | Task 4: projectStore | Task 3 | 45min |
| P0-计算 | Task 5: habitStatsUtils | Task 1 | 1h |
| P0-写入 | Task 6: habitService | Task 4 | 1h |
| P0-注册 | Task 7: constants + slash | Task 6 | 45min |
| P1-桌面 | Task 8: DesktopHabitDock L1 | Task 7 | 2h |
| P1-桌面 | Task 9: DesktopHabitDock L2 | Task 8 | 2h |
| P1-移动 | Task 10: Mobile UI | Task 8 | 2h |
| P1-弹框 | Task 11: HabitCreateDialog | Task 7 | 1.5h |
| P2-提醒 | Task 12: habitReminder | Task 4 | 1h |

**总计：约 14 小时**
