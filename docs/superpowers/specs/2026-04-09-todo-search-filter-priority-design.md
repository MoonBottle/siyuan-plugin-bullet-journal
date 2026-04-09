# 待办列表搜索、筛选与优先级功能设计

## 一、功能概述

为任务助手插件的待办列表（Todo Dock）增加三大核心能力：

1. **搜索功能** - 按关键字实时过滤事项内容、项目名称、任务名称
2. **日期筛选** - 选择日期范围查看特定时间段的任务
3. **优先级系统** - 使用 emoji 标记优先级（🔥高/🌿中/🍃低），支持按优先级排序和筛选

### 1.1 核心理念

- **记录驱动**: 优先级作为事项的附加属性，不改变现有的记录驱动理念
- **无侵入式**: 使用标准 Markdown 格式扩展（emoji 标记），保持数据可迁移性
- **单一优先级**: 一个事项只支持一个优先级，简化设计
- **排序优先**: 优先级主要用于排序（高→中→低→无），同优先级内按时间排序

---

## 二、优先级标记语法

### 2.1 标记规则

使用 emoji 作为优先级标记，位于事项内容中：

| 优先级 | Emoji | 标记 | 排序权重 | 说明 |
|--------|-------|------|---------|------|
| 高 | 🔥 | `🔥` | 0 | 紧急重要事项，置顶显示 |
| 中 | 🌿 | `🌿` | 1 | 普通优先级 |
| 低 | 🍃 | `🍃` | 2 | 低优先级，可延后处理 |
| 无 | - | - | 3 | 未设置优先级的事项排最后 |

**语法示例：**
```markdown
完成项目报告 @2026-04-09 🔥      # 高优先级
整理文档资料 @2026-04-09 🌿      # 中优先级
备份旧数据 @2026-04-09 🍃        # 低优先级
日常检查 @2026-04-09            # 无优先级
```

### 2.2 标记位置

优先级标记位于事项内容中，解析时会提取并移除，不影响内容显示：
```markdown
完成项目报告 📅2026-04-09 🔥     # 原始内容
↓ 解析后
content: "完成项目报告"
priority: "high"
```

---

## 三、交互方式

### 3.1 斜杠命令

| 命令 | 功能 | 交互 |
|------|------|------|
| `/priority` 或 `/yxj` | 设置优先级 | 唤起优先级选择弹框 |

弹框选项：
- 🔥 高优先级
- 🌿 中优先级  
- 🍃 低优先级
- ⚪ 清除优先级

### 3.2 右键菜单

在事项右键菜单中增加"设置优先级"子菜单：
```
设置优先级
├── 🔥 高优先级
├── 🌿 中优先级
├── 🍃 低优先级
└── ⚪ 清除优先级
```

### 3.3 事项详情弹框

在 ItemDetailDialog.vue 中增加优先级显示和编辑区域，显示当前优先级 emoji 和下拉选择器。

### 3.4 待办列表筛选栏

在 TodoDock 顶部增加筛选栏：
```
┌─────────────────────────────────────────┐
│ 🔍 搜索事项...                         │  <- 搜索框（第一行）
├─────────────────────────────────────────┤
│ 👤 所有分组 ▼  🔥 🌿 🍃  📅 近7天 ▼    │  <- 筛选器（第二行）
└─────────────────────────────────────────┘
```

- **搜索框**: 实时过滤事项内容、项目名称、任务名称
- **分组选择**: 现有分组筛选下拉框
- **优先级按钮**: 点击切换筛选（可多选，高亮表示激活）
- **日期筛选**: 下拉选择日期范围预设或自定义

---

## 四、数据模型

### 4.1 类型定义

```typescript
// src/types/models.ts

// 优先级类型
export type PriorityLevel = 'high' | 'medium' | 'low';

// 在 Item 接口中扩展 priority 字段
export interface Item {
  // ... 现有字段
  priority?: PriorityLevel;  // 优先级（可选）
}
```

### 4.2 优先级配置

```typescript
// 优先级配置常量
export const PRIORITY_CONFIG: Record<PriorityLevel, {
  emoji: string;
  label: string;
  sortOrder: number;
}> = {
  high:   { emoji: '🔥', label: '高优先级', sortOrder: 0 },
  medium: { emoji: '🌿', label: '中优先级', sortOrder: 1 },
  low:    { emoji: '🍃', label: '低优先级', sortOrder: 2 },
};
```

---

## 五、架构设计

### 5.1 模块结构

```
src/
├── parser/
│   ├── lineParser.ts              # 集成优先级标记解析
│   └── priorityParser.ts          # 优先级解析工具（新增）
├── utils/
│   ├── slashCommands.ts           # 添加 /priority 斜杠命令
│   ├── dialog.ts                  # 添加优先级选择弹框
│   └── contextMenu.ts             # 右键菜单添加优先级选项
│   └── fileUtils.ts               # 添加更新优先级的 API
├── components/
│   ├── dialog/
│   │   └── PrioritySettingDialog.vue    # 优先级设置弹框（新增）
│   ├── todo/
│   │   └── TodoSidebar.vue        # 接收筛选参数，调整排序
│   └── SiyuanTheme/
│       └── SyInput.vue            # 可能需要输入框组件
├── tabs/
│   └── TodoDock.vue               # 新增搜索框和筛选栏布局
├── stores/
│   └── projectStore.ts            # 添加支持筛选排序的 getters
├── constants.ts                   # 添加 SET_PRIORITY 斜杠命令
└── types/
    └── models.ts                  # 扩展 Item 类型
```

### 5.2 数据流

```
┌─────────────────────────────────────────────────────────────┐
│                      数据输入层                              │
├─────────────────────────────────────────────────────────────┤
│  笔记 Markdown → priorityParser.parsePriorityFromLine()     │
│  斜杠命令 /priority → PrioritySettingDialog → 更新 block   │
│  右键菜单 → contextMenu → 更新 block                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      解析层                                  │
├─────────────────────────────────────────────────────────────┤
│  lineParser.parseItemLine() 调用 parsePriorityFromLine()    │
│  → 提取 priority 字段，从 content 中移除 emoji 标记          │
│  → 生成带 priority 的 Item 对象                              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      状态管理层                              │
├─────────────────────────────────────────────────────────────┤
│  projectStore.getFilteredAndSortedItems({                   │
│    groupId, searchQuery, dateRange, priorities             │
│  })                                                          │
│  → 过滤（搜索、日期、优先级）                                │
│  → 排序（优先级 → 时间）                                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      视图层                                  │
├─────────────────────────────────────────────────────────────┤
│  TodoDock.vue: 搜索框 + 分组/优先级/日期筛选栏              │
│  TodoSidebar.vue: 接收 props，显示排序后的事项列表          │
└─────────────────────────────────────────────────────────────┘
```

---

## 六、核心模块设计

### 6.1 优先级解析器 (priorityParser.ts)

```typescript
/**
 * 从行内容解析优先级
 * @param line 事项行内容
 * @returns PriorityLevel 或 undefined
 */
export function parsePriorityFromLine(line: string): PriorityLevel | undefined {
  if (line.includes('🔥')) return 'high';
  if (line.includes('🌿')) return 'medium';
  if (line.includes('🍃')) return 'low';
  return undefined;
}

/**
 * 移除优先级标记
 */
export function stripPriorityMarker(content: string): string {
  return content.replace(/[🔥🌿🍃]/gu, '').trim();
}

/**
 * 生成优先级标记
 */
export function generatePriorityMarker(priority: PriorityLevel): string {
  const emojiMap: Record<PriorityLevel, string> = {
    high: '🔥',
    medium: '🌿',
    low: '🍃',
  };
  return emojiMap[priority] || '';
}

/**
 * 获取优先级排序权重（越小越靠前）
 */
export function getPrioritySortOrder(priority?: PriorityLevel): number {
  const orderMap: Record<PriorityLevel, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  return priority !== undefined ? orderMap[priority] : 3;
}

/**
 * 优先级比较函数（用于排序）
 * @returns 负数表示 a 在前，正数表示 b 在前
 */
export function comparePriority(
  a?: PriorityLevel,
  b?: PriorityLevel
): number {
  return getPrioritySortOrder(a) - getPrioritySortOrder(b);
}
```

### 6.2 行解析器集成 (lineParser.ts)

在 `parseItemLine` 方法中集成优先级解析：

```typescript
public static parseItemLine(line: string, lineNumber: number, links?: Link[]): Item[] {
  // ... 现有代码

  // 解析优先级（在清理内容前）
  const priority = parsePriorityFromLine(line);

  // 提取内容时移除优先级标记
  // ... 现有清理逻辑
  content = stripPriorityMarker(content);
  // ... 其他清理

  // 创建 Item 时包含 priority
  items.push({
    // ... 其他字段
    priority,
  });
}
```

### 6.3 Store Getters 扩展 (projectStore.ts)

添加支持搜索、筛选、排序的 getter：

```typescript
// 按分组获取过滤和排序后的事项
getFilteredAndSortedItems: (state) => (params: {
  groupId: string;
  searchQuery?: string;
  dateRange?: { start: string; end: string } | null;
  priorities?: PriorityLevel[];
}) => {
  // 1. 获取基础事项列表（多日期去重）
  let items = computeDisplayItems(
    (state as any).items as Item[],
    state.currentDate,
    params.groupId
  );

  // 2. 应用搜索过滤
  if (params.searchQuery?.trim()) {
    const query = params.searchQuery.toLowerCase().trim();
    items = items.filter(item => 
      item.content.toLowerCase().includes(query) ||
      item.project?.name.toLowerCase().includes(query) ||
      item.task?.name.toLowerCase().includes(query)
    );
  }

  // 3. 应用日期筛选
  if (params.dateRange) {
    items = items.filter(item => 
      item.date >= params.dateRange!.start && 
      item.date <= params.dateRange!.end
    );
  }

  // 4. 应用优先级筛选
  if (params.priorities && params.priorities.length > 0) {
    items = items.filter(item => 
      item.priority && params.priorities!.includes(item.priority)
    );
  }

  // 5. 按优先级和时间排序
  items.sort((a, b) => {
    // 先按优先级排序（高→中→低→无）
    const priorityDiff = comparePriority(a.priority, b.priority);
    if (priorityDiff !== 0) return priorityDiff;

    // 同优先级按时间排序（开始时间或日期）
    const timeA = a.startDateTime || a.date;
    const timeB = b.startDateTime || b.date;
    return timeA.localeCompare(timeB);
  });

  return items;
}
```

### 6.4 TodoDock 布局改造

搜索框置顶，筛选器第二行：

```vue
<template>
  <div class="todo-filter-card">
    <!-- 第一行：搜索框 -->
    <div class="search-row">
      <div class="search-box">
        <svg class="search-icon"><use xlink:href="#iconSearch"></use></svg>
        <input 
          v-model="searchQuery" 
          type="text" 
          :placeholder="t('todo').searchPlaceholder"
          class="search-input"
        />
        <button v-if="searchQuery" class="clear-btn" @click="searchQuery = ''">
          <svg><use xlink:href="#iconClose"></use></svg>
        </button>
      </div>
    </div>

    <!-- 第二行：分组 + 优先级 + 日期 -->
    <div class="filter-row">
      <SySelect v-model="selectedGroup" :options="groupOptions" class="group-select" />
      
      <div class="priority-filter">
        <button 
          v-for="p in priorityOptions" 
          :key="p.value"
          :class="['priority-btn', { active: selectedPriorities.includes(p.value) }]"
          @click="togglePriority(p.value)"
        >
          {{ p.emoji }}
        </button>
      </div>

      <DateFilter v-model="dateRange" />
    </div>
  </div>
</template>
```

---

## 七、文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/types/models.ts` | 修改 | 添加 PriorityLevel 类型和 Item.priority 字段 |
| `src/parser/priorityParser.ts` | 新增 | 优先级解析、生成、排序工具函数 |
| `src/parser/lineParser.ts` | 修改 | 集成优先级解析逻辑 |
| `src/constants.ts` | 修改 | 添加 SET_PRIORITY 斜杠命令常量 |
| `src/utils/slashCommands.ts` | 修改 | 添加 /priority 斜杠命令处理 |
| `src/utils/dialog.ts` | 修改 | 添加 showPrioritySettingDialog 函数 |
| `src/utils/contextMenu.ts` | 修改 | 右键菜单添加"设置优先级"子菜单 |
| `src/utils/fileUtils.ts` | 修改 | 添加 updateBlockPriority API |
| `src/components/dialog/PrioritySettingDialog.vue` | 新增 | 优先级选择弹框组件 |
| `src/components/dialog/ItemDetailDialog.vue` | 修改 | 显示和编辑优先级 |
| `src/components/todo/TodoSidebar.vue` | 修改 | 接收筛选参数，调整 props |
| `src/tabs/TodoDock.vue` | 修改 | 新增搜索框和筛选栏布局 |
| `src/stores/projectStore.ts` | 修改 | 添加 getFilteredAndSortedItems getter |
| `src/i18n/zh_CN.json` | 修改 | 添加优先级相关中文翻译 |
| `src/i18n/en_US.json` | 修改 | 添加优先级相关英文翻译 |

---

## 八、界面文案（国际化）

### zh_CN.json

```json
{
  "todo": {
    "searchPlaceholder": "搜索事项...",
    "priority": {
      "title": "优先级",
      "high": "高优先级",
      "medium": "中优先级",
      "low": "低优先级",
      "clear": "清除优先级",
      "setPriority": "设置优先级"
    },
    "dateFilter": {
      "title": "日期筛选",
      "today": "今天",
      "tomorrow": "明天",
      "thisWeek": "近7天",
      "thisMonth": "本月",
      "all": "全部",
      "custom": "自定义"
    }
  },
  "slash": {
    "setPriority": "设置优先级"
  }
}
```

---

## 九、验收标准

### 9.1 优先级标记

- [ ] 可以使用 `🔥/🌿/🍃` emoji 标记事项优先级
- [ ] 斜杠命令 `/priority` 或 `/yxj` 可唤起优先级选择弹框
- [ ] 右键菜单可设置/清除优先级
- [ ] 事项详情弹框显示并支持修改优先级
- [ ] 优先级标记从内容中解析并移除，不干扰内容显示

### 9.2 搜索功能

- [ ] 待办列表顶部有搜索框，支持实时过滤
- [ ] 搜索范围包括事项内容、项目名称、任务名称
- [ ] 搜索不区分大小写，支持部分匹配
- [ ] 清空搜索框后恢复显示全部事项

### 9.3 日期筛选

- [ ] 支持日期范围筛选（预设：今天/明天/近7天/本月/全部）
- [ ] 支持自定义日期范围
- [ ] 日期筛选与搜索、优先级筛选可叠加使用

### 9.4 排序逻辑

- [ ] 事项按优先级排序：高(🔥) → 中(🌿) → 低(🍃) → 无
- [ ] 同优先级内按时间排序（开始时间或日期）
- [ ] 已过期/今日/明日/未来各分组内独立排序
- [ ] 优先级 emoji 显示在事项卡片内容前

### 9.5 兼容性

- [ ] 无优先级的事项正常显示，排在最后
- [ ] 现有事项无需修改即可兼容
- [ ] 切换分组、刷新数据后筛选状态保持

---

## 十、注意事项

1. **Emoji 兼容性**: 使用标准 Unicode emoji（🔥🌿🍃），确保在各平台正常显示
2. **性能考虑**: 搜索和筛选在 client 端完成，利用 computed 缓存避免重复计算
3. **状态持久化**: 考虑将筛选状态（搜索词、日期范围、选中优先级）保存到 settings，下次打开恢复
4. **移动端适配**: Dock 可能在窄屏显示，筛选栏需要支持横向滚动或折叠
5. **与现有功能兼容**: 优先级标记与提醒(⏰)、重复(🔁)等标记独立，可同时存在

---

## 十一、未来扩展

1. **优先级统计**: 在统计页面显示各优先级任务数量
2. **优先级快捷设置**: 拖拽事项到不同优先级区域快速设置
3. **智能优先级**: AI 根据事项内容自动建议优先级
4. **优先级权重**: 允许用户自定义优先级权重值
