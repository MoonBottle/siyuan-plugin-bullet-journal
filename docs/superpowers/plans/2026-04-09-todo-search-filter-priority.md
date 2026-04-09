# 待办列表搜索、筛选与优先级功能实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为任务助手插件的待办列表增加搜索功能、日期筛选功能和基于 emoji（🔥🌿🍃）的优先级系统

**Architecture:** 采用分层架构，新增 `priorityParser.ts` 处理优先级解析，扩展 `projectStore.ts` 支持筛选排序，改造 `TodoDock.vue` 添加搜索和筛选 UI，通过 props 传递筛选参数给 `TodoSidebar.vue`

**Tech Stack:** Vue 3 + TypeScript + Pinia + SiYuan API

---

## 文件结构

| 文件 | 类型 | 职责 |
|------|------|------|
| `src/types/models.ts` | 修改 | 添加 PriorityLevel 类型和 Item.priority 字段 |
| `src/parser/priorityParser.ts` | 创建 | 优先级解析、生成、排序工具函数 |
| `src/parser/lineParser.ts` | 修改 | 集成优先级解析逻辑 |
| `src/constants.ts` | 修改 | 添加 SET_PRIORITY 斜杠命令常量 |
| `src/i18n/zh_CN.json` | 修改 | 添加优先级相关中文翻译 |
| `src/i18n/en_US.json` | 修改 | 添加优先级相关英文翻译 |
| `src/stores/projectStore.ts` | 修改 | 添加 getFilteredAndSortedItems getter |
| `src/utils/dialog.ts` | 修改 | 添加 showPrioritySettingDialog 函数 |
| `src/utils/contextMenu.ts` | 修改 | 右键菜单添加"设置优先级"子菜单 |
| `src/utils/fileUtils.ts` | 修改 | 添加 updateBlockPriority API |
| `src/utils/slashCommands.ts` | 修改 | 添加 /priority 斜杠命令处理 |
| `src/components/dialog/PrioritySettingDialog.vue` | 创建 | 优先级选择弹框组件 |
| `src/components/dialog/ItemDetailDialog.vue` | 修改 | 显示和编辑优先级 |
| `src/components/todo/TodoSidebar.vue` | 修改 | 接收筛选参数，显示排序后的事项 |
| `src/tabs/TodoDock.vue` | 修改 | 新增搜索框和筛选栏布局 |

---

## Task 1: 定义优先级类型和配置

**Files:**
- Modify: `src/types/models.ts:110-180`
- Test: 通过后续解析器测试验证

- [ ] **Step 1: 在 models.ts 中添加 PriorityLevel 类型和 Item 扩展**

在 `ItemStatus` 类型定义后添加：

```typescript
// 优先级类型
export type PriorityLevel = 'high' | 'medium' | 'low';
```

在 `Item` 接口中添加 priority 字段（约第 175 行，在 repeatRule 字段附近）：

```typescript
// 提醒和重复功能
reminder?: ReminderConfig;     // 提醒配置
repeatRule?: RepeatRule;       // 重复规则
endCondition?: EndCondition;   // 结束条件
// 优先级
priority?: PriorityLevel;      // 优先级（可选）
```

- [ ] **Step 2: 提交**

```bash
git add src/types/models.ts
git commit -m "types: 添加 PriorityLevel 类型和 Item.priority 字段"
```

---

## Task 2: 创建优先级解析器

**Files:**
- Create: `src/parser/priorityParser.ts`
- Test: `src/parser/__tests__/priorityParser.test.ts`（如有测试目录）

- [ ] **Step 1: 创建 priorityParser.ts**

```typescript
/**
 * 优先级解析器
 * 处理事项优先级的解析、生成和排序
 */

import type { PriorityLevel } from '@/types/models';

/**
 * 优先级配置
 */
export const PRIORITY_CONFIG: Record<PriorityLevel, {
  emoji: string;
  label: string;
  sortOrder: number;
}> = {
  high:   { emoji: '🔥', label: '高优先级', sortOrder: 0 },
  medium: { emoji: '🌿', label: '中优先级', sortOrder: 1 },
  low:    { emoji: '🍃', label: '低优先级', sortOrder: 2 },
};

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

- [ ] **Step 2: 提交**

```bash
git add src/parser/priorityParser.ts
git commit -m "feat(parser): 添加优先级解析器"
```

---

## Task 3: 在 lineParser 中集成优先级解析

**Files:**
- Modify: `src/parser/lineParser.ts:113-200`

- [ ] **Step 1: 导入优先级解析函数**

在文件顶部导入：

```typescript
import { parsePriorityFromLine, stripPriorityMarker } from './priorityParser';
```

- [ ] **Step 2: 在 parseItemLine 中解析优先级**

在 `parseItemLine` 方法中（约第 119-120 行，reminder 解析之后）：

```typescript
// 解析提醒配置
const reminder = parseReminderFromLine(line);

// 解析优先级
const priority = parsePriorityFromLine(line);
```

- [ ] **Step 3: 在内容清理中移除优先级标记**

在内容清理逻辑中（约第 177 行，移除提醒标记之后）：

```typescript
// 移除提醒标记
content = stripReminderMarker(content);

// 移除优先级标记
content = stripPriorityMarker(content);
```

- [ ] **Step 4: 在创建 Item 时包含 priority**

在 `items.push` 中（约第 268 行）：

```typescript
items.push({
  id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  content,
  date,
  startDateTime,
  endDateTime,
  lineNumber,
  docId: '',
  status,
  links: mergedLinks.length > 0 ? mergedLinks : undefined,
  siblingItems: siblingItems.length > 0 ? siblingItems : undefined,
  dateRangeStart,
  dateRangeEnd,
  reminder,
  repeatRule,
  endCondition,
  priority,  // 新增
});
```

- [ ] **Step 5: 提交**

```bash
git add src/parser/lineParser.ts
git commit -m "feat(parser): 在 lineParser 中集成优先级解析"
```

---

## Task 4: 添加常量定义

**Files:**
- Modify: `src/constants.ts:20-42`

- [ ] **Step 1: 添加 SET_PRIORITY 到斜杠命令 filters**

在 `SLASH_COMMAND_FILTERS` 中添加：

```typescript
// 斜杠命令 filter 配置
export const SLASH_COMMAND_FILTERS = {
  // ... 现有命令
  SET_RECURRING: ['/cf', '/recurring'],
  CREATE_SKILL: ['/cjskill', '/create-skill', '/skill'],
  SET_PRIORITY: ['/yxj', '/priority'],  // 新增
};
```

- [ ] **Step 2: 添加到 ALL_SLASH_COMMAND_FILTERS**

在 `ALL_SLASH_COMMAND_FILTERS` 数组末尾添加：

```typescript
export const ALL_SLASH_COMMAND_FILTERS = [
  // ... 现有命令
  ...SLASH_COMMAND_FILTERS.SET_RECURRING,
  ...SLASH_COMMAND_FILTERS.CREATE_SKILL,
  ...SLASH_COMMAND_FILTERS.SET_PRIORITY,  // 新增
];
```

- [ ] **Step 3: 提交**

```bash
git add src/constants.ts
git commit -m "chore(constants): 添加 SET_PRIORITY 斜杠命令常量"
```

---

## Task 5: 添加国际化文案

**Files:**
- Modify: `src/i18n/zh_CN.json:87-135`
- Modify: `src/i18n/en_US.json`

- [ ] **Step 1: 在 zh_CN.json 中添加优先级相关翻译**

在 `todo` 对象中添加：

```json
"todo": {
  "title": "待办事项",
  "today": "今天",
  "tomorrow": "明天",
  // ... 现有字段
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
}
```

在 `slash` 对象中添加：

```json
"slash": {
  // ... 现有字段
  "createSkill": "创建 AI Skill",
  "setPriority": "设置优先级"
}
```

- [ ] **Step 2: 在 en_US.json 中添加对应英文翻译**

```json
"todo": {
  "searchPlaceholder": "Search items...",
  "priority": {
    "title": "Priority",
    "high": "High Priority",
    "medium": "Medium Priority",
    "low": "Low Priority",
    "clear": "Clear Priority",
    "setPriority": "Set Priority"
  },
  "dateFilter": {
    "title": "Date Filter",
    "today": "Today",
    "tomorrow": "Tomorrow",
    "thisWeek": "Next 7 Days",
    "thisMonth": "This Month",
    "all": "All",
    "custom": "Custom"
  }
}
```

```json
"slash": {
  "setPriority": "Set Priority"
}
```

- [ ] **Step 3: 提交**

```bash
git add src/i18n/zh_CN.json src/i18n/en_US.json
git commit -m "i18n: 添加优先级、搜索、日期筛选相关文案"
```

---

## Task 6: 在 projectStore 中添加筛选排序 getter

**Files:**
- Modify: `src/stores/projectStore.ts:190-260`

- [ ] **Step 1: 导入优先级比较函数**

在文件顶部导入：

```typescript
import { comparePriority } from '@/parser/priorityParser';
import type { PriorityLevel } from '@/types/models';
```

- [ ] **Step 2: 添加 getFilteredAndSortedItems getter**

在 `getExpiredItems` getter 之后（约第 229 行），添加新的 getter：

```typescript
// 按分组获取过滤和排序后的事项（支持搜索、日期筛选、优先级筛选）
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

- [ ] **Step 3: 提交**

```bash
git add src/stores/projectStore.ts
git commit -m "feat(store): 添加 getFilteredAndSortedItems getter"
```

---

## Task 7: 添加优先级设置弹框

**Files:**
- Create: `src/components/dialog/PrioritySettingDialog.vue`
- Modify: `src/utils/dialog.ts`

- [ ] **Step 1: 创建 PrioritySettingDialog.vue**

```vue
<template>
  <div class="priority-setting-dialog">
    <div class="priority-options">
      <button
        v-for="option in priorityOptions"
        :key="option.value"
        :class="['priority-option', { active: selectedPriority === option.value }]"
        @click="selectPriority(option.value)"
      >
        <span class="priority-emoji">{{ option.emoji }}</span>
        <span class="priority-label">{{ option.label }}</span>
      </button>
      <button
        :class="['priority-option', { active: !selectedPriority }]"
        @click="selectPriority(undefined)"
      >
        <span class="priority-emoji">⚪</span>
        <span class="priority-label">{{ t('todo').priority.clear }}</span>
      </button>
    </div>
    <div class="dialog-actions">
      <button class="b3-button b3-button--cancel" @click="cancel">
        {{ t('common').cancel }}
      </button>
      <button class="b3-button b3-button--text" @click="confirm">
        {{ t('common').confirm }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { PriorityLevel } from '@/types/models';
import { PRIORITY_CONFIG } from '@/parser/priorityParser';
import { t } from '@/i18n';

const props = defineProps<{
  initialPriority?: PriorityLevel;
}>();

const emit = defineEmits<{
  confirm: [priority: PriorityLevel | undefined];
  cancel: [];
}>();

const selectedPriority = ref<PriorityLevel | undefined>(props.initialPriority);

const priorityOptions = [
  { value: 'high' as PriorityLevel, emoji: PRIORITY_CONFIG.high.emoji, label: PRIORITY_CONFIG.high.label },
  { value: 'medium' as PriorityLevel, emoji: PRIORITY_CONFIG.medium.emoji, label: PRIORITY_CONFIG.medium.label },
  { value: 'low' as PriorityLevel, emoji: PRIORITY_CONFIG.low.emoji, label: PRIORITY_CONFIG.low.label },
];

function selectPriority(priority: PriorityLevel | undefined) {
  selectedPriority.value = priority;
}

function confirm() {
  emit('confirm', selectedPriority.value);
}

function cancel() {
  emit('cancel');
}
</script>

<style lang="scss" scoped>
.priority-setting-dialog {
  padding: 16px;
  min-width: 200px;
}

.priority-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.priority-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  background: var(--b3-theme-background);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--b3-theme-surface);
  }

  &.active {
    border-color: var(--b3-theme-primary);
    background: var(--b3-theme-primary-lightest);
  }
}

.priority-emoji {
  font-size: 18px;
}

.priority-label {
  font-size: 14px;
  color: var(--b3-theme-on-background);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
```

- [ ] **Step 2: 在 dialog.ts 中添加 showPrioritySettingDialog 函数**

在 `dialog.ts` 中添加：

```typescript
import PrioritySettingDialog from '@/components/dialog/PrioritySettingDialog.vue';
import type { PriorityLevel } from '@/types/models';

/**
 * 显示优先级设置弹框
 */
export function showPrioritySettingDialog(
  initialPriority: PriorityLevel | undefined,
  onConfirm: (priority: PriorityLevel | undefined) => void
) {
  const dialog = createDialog({
    title: t('todo').priority.setPriority,
    content: '<div id="priority-setting-dialog-mount"></div>',
    width: '280px',
    height: 'auto',
  });

  const mountEl = dialog.element.querySelector('#priority-setting-dialog-mount');
  if (mountEl) {
    const app = createApp(PrioritySettingDialog, {
      initialPriority,
      onConfirm: (priority: PriorityLevel | undefined) => {
        onConfirm(priority);
        dialog.destroy();
      },
      onCancel: () => {
        dialog.destroy();
      },
    });
    app.mount(mountEl);
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add src/components/dialog/PrioritySettingDialog.vue src/utils/dialog.ts
git commit -m "feat(dialog): 添加优先级设置弹框"
```

---

## Task 8: 在右键菜单中添加优先级选项

**Files:**
- Modify: `src/utils/contextMenu.ts`

- [ ] **Step 1: 导入优先级相关函数**

```typescript
import { showPrioritySettingDialog } from './dialog';
import { PRIORITY_CONFIG } from '@/parser/priorityParser';
import type { PriorityLevel } from '@/types/models';
```

- [ ] **Step 2: 在 createItemMenu 中添加优先级子菜单**

在菜单创建逻辑中，添加"设置优先级"选项：

```typescript
// 设置优先级子菜单
const prioritySubmenu: IMenuItemOption[] = [
  {
    icon: '',
    label: `${PRIORITY_CONFIG.high.emoji} ${t('todo').priority.high}`,
    click: () => handlers.onSetPriority?.('high'),
  },
  {
    icon: '',
    label: `${PRIORITY_CONFIG.medium.emoji} ${t('todo').priority.medium}`,
    click: () => handlers.onSetPriority?.('medium'),
  },
  {
    icon: '',
    label: `${PRIORITY_CONFIG.low.emoji} ${t('todo').priority.low}`,
    click: () => handlers.onSetPriority?.('low'),
  },
  { type: 'separator' },
  {
    icon: '',
    label: `⚪ ${t('todo').priority.clear}`,
    click: () => handlers.onSetPriority?.(undefined),
  },
];

menu.addItem({
  icon: 'iconFlag',
  label: t('todo').priority.setPriority,
  submenu: prioritySubmenu,
});
```

- [ ] **Step 3: 在 handlers 类型中添加 onSetPriority**

```typescript
export interface ItemMenuHandlers {
  // ... 现有 handlers
  onSetPriority?: (priority: PriorityLevel | undefined) => void;
}
```

- [ ] **Step 4: 提交**

```bash
git add src/utils/contextMenu.ts
git commit -m "feat(contextMenu): 右键菜单添加优先级设置选项"
```

---

## Task 9: 添加更新优先级 API

**Files:**
- Modify: `src/utils/fileUtils.ts`

- [ ] **Step 1: 导入优先级相关函数**

```typescript
import { generatePriorityMarker, stripPriorityMarker } from '@/parser/priorityParser';
import type { PriorityLevel } from '@/types/models';
```

- [ ] **Step 2: 添加 updateBlockPriority 函数**

```typescript
/**
 * 更新块的优先级
 * @param blockId 块 ID
 * @param priority 优先级（undefined 表示清除）
 * @returns 是否成功
 */
export async function updateBlockPriority(
  blockId: string,
  priority: PriorityLevel | undefined
): Promise<boolean> {
  try {
    const block = await getBlockByID(blockId);
    if (!block) {
      console.error('[Task Assistant] Block not found:', blockId);
      return false;
    }

    let content = block.content || block.markdown || '';

    // 移除现有优先级标记
    content = stripPriorityMarker(content);

    // 添加新优先级标记
    if (priority) {
      const marker = generatePriorityMarker(priority);
      content = content.trimEnd() + ' ' + marker;
    }

    // 更新块内容
    const success = await updateBlock('markdown', content, blockId);
    return success;
  } catch (error) {
    console.error('[Task Assistant] Failed to update priority:', error);
    return false;
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add src/utils/fileUtils.ts
git commit -m "feat(fileUtils): 添加 updateBlockPriority API"
```

---

## Task 10: 添加斜杠命令处理

**Files:**
- Modify: `src/utils/slashCommands.ts`

- [ ] **Step 1: 导入优先级相关函数**

```typescript
import { showPrioritySettingDialog } from './dialog';
import type { PriorityLevel } from '@/types/models';
```

- [ ] **Step 2: 在 builtinCommands 中添加 SET_PRIORITY 命令**

在 createSlashCommands 函数中：

```typescript
{
  filter: SLASH_COMMAND_FILTERS.SET_PRIORITY,
  html: `<div class="b3-list-item__first">
      <span class="b3-list-item__text">${t('slash').setPriority}</span>
      <span class="b3-list-item__meta">🔥🌿🍃</span>
  </div>`,
  id: 'bullet-journal-set-priority',
  callback: getActionHandler('setPriority', config, SLASH_COMMAND_FILTERS.SET_PRIORITY)
},
```

- [ ] **Step 3: 在 getActionHandler 中添加 setPriority 处理**

```typescript
case 'setPriority':
  return (protyle, nodeElement) => {
    deleteSlashCommandContent(protyle, filter);
    setPriorityForBlock(nodeElement);
  };
```

- [ ] **Step 4: 添加 setPriorityForBlock 函数**

```typescript
/**
 * 为块设置优先级
 */
async function setPriorityForBlock(nodeElement: HTMLElement) {
  const blockId = nodeElement.getAttribute('data-node-id');
  if (!blockId) {
    showMessage('无法获取块ID', 2000, 'error');
    return;
  }

  // 从块内容提取当前优先级
  const blockContent = nodeElement.textContent || '';
  const { parsePriorityFromLine } = await import('@/parser/priorityParser');
  const currentPriority = parsePriorityFromLine(blockContent);

  showPrioritySettingDialog(currentPriority, async (priority) => {
    const success = await updateBlockPriority(blockId, priority);
    if (success) {
      showMessage(priority ? '优先级已设置' : '优先级已清除', 2000, 'info');
    } else {
      showMessage('设置优先级失败', 2000, 'error');
    }
  });
}
```

- [ ] **Step 5: 在 getActionLabel 中添加 setPriority**

```typescript
const labels: Record<string, string> = {
  // ... 现有 labels
  setReminder: 'Reminder',
  setRecurring: 'Recurring',
  createSkill: 'AI Skill',
  setPriority: 'Priority',  // 新增
};
```

- [ ] **Step 6: 提交**

```bash
git add src/utils/slashCommands.ts
git commit -m "feat(slashCommands): 添加 /priority 斜杠命令"
```

---

## Task 11: 改造 TodoDock 添加搜索和筛选栏

**Files:**
- Modify: `src/tabs/TodoDock.vue`

- [ ] **Step 1: 添加响应式数据和导入**

```typescript
import { ref, computed } from 'vue';
import dayjs from 'dayjs';
import type { PriorityLevel } from '@/types/models';
import { PRIORITY_CONFIG } from '@/parser/priorityParser';

// 搜索和筛选状态
const searchQuery = ref('');
const selectedPriorities = ref<PriorityLevel[]>([]);
const showDateFilter = ref(false);
const startDate = ref(dayjs().format('YYYY-MM-DD'));
const endDate = ref(dayjs().add(7, 'day').format('YYYY-MM-DD'));

const priorityOptions = [
  { value: 'high' as PriorityLevel, emoji: PRIORITY_CONFIG.high.emoji },
  { value: 'medium' as PriorityLevel, emoji: PRIORITY_CONFIG.medium.emoji },
  { value: 'low' as PriorityLevel, emoji: PRIORITY_CONFIG.low.emoji },
];

const dateRange = computed(() => {
  if (!showDateFilter.value) return null;
  return { start: startDate.value, end: endDate.value };
});

function togglePriority(priority: PriorityLevel) {
  const index = selectedPriorities.value.indexOf(priority);
  if (index > -1) {
    selectedPriorities.value.splice(index, 1);
  } else {
    selectedPriorities.value.push(priority);
  }
}

function clearDateFilter() {
  showDateFilter.value = false;
  startDate.value = dayjs().format('YYYY-MM-DD');
  endDate.value = dayjs().add(7, 'day').format('YYYY-MM-DD');
}
```

- [ ] **Step 2: 改造模板添加搜索和筛选栏**

替换现有的 `todo-filter-card` 部分：

```vue
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
    <SySelect
      v-model="selectedGroup"
      :options="groupOptions"
      :placeholder="t('settings').projectGroups.allGroups"
      class="group-select"
    />
    
    <!-- 优先级快速筛选 -->
    <div class="priority-filter">
      <button 
        v-for="p in priorityOptions" 
        :key="p.value"
        :class="['priority-btn', { active: selectedPriorities.includes(p.value) }]"
        :title="PRIORITY_CONFIG[p.value].label"
        @click="togglePriority(p.value)"
      >
        {{ p.emoji }}
      </button>
    </div>

    <!-- 日期筛选 -->
    <div class="date-filter">
      <button 
        class="date-filter-btn"
        :class="{ active: showDateFilter }"
        @click="showDateFilter = !showDateFilter"
      >
        <svg class="date-icon"><use xlink:href="#iconCalendar"></use></svg>
        <span class="date-label">{{ showDateFilter ? '自定义' : '全部' }}</span>
      </button>
    </div>
  </div>

  <!-- 日期范围选择（展开时） -->
  <div v-if="showDateFilter" class="date-range-row">
    <input v-model="startDate" type="date" class="date-input" />
    <span>至</span>
    <input v-model="endDate" type="date" class="date-input" />
    <button class="clear-date-btn" @click="clearDateFilter">清除</button>
  </div>
</div>
```

- [ ] **Step 3: 更新 TodoSidebar 的 props 传递**

```vue
<TodoSidebar 
  :group-id="selectedGroup"
  :search-query="searchQuery"
  :date-range="dateRange"
  :priorities="selectedPriorities"
/>
```

- [ ] **Step 4: 添加样式**

在 `<style>` 中添加：

```scss
.todo-filter-card {
  padding: 8px;
  background: var(--b3-theme-surface);
  border-radius: var(--b3-border-radius);
  display: flex;
  flex-direction: column;
  gap: 8px;

  .search-row {
    .search-box {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      background: var(--b3-theme-background);
      border-radius: var(--b3-border-radius);
      border: 1px solid var(--b3-border-color);

      &:focus-within {
        border-color: var(--b3-theme-primary);
      }

      .search-icon {
        width: 14px;
        height: 14px;
        fill: var(--b3-theme-on-surface);
        opacity: 0.5;
      }

      .search-input {
        flex: 1;
        border: none;
        background: transparent;
        font-size: 13px;
        outline: none;
      }

      .clear-btn {
        width: 16px;
        height: 16px;
        padding: 0;
        border: none;
        background: transparent;
        cursor: pointer;
        opacity: 0.4;

        &:hover { opacity: 0.8; }
      }
    }
  }

  .filter-row {
    display: flex;
    align-items: center;
    gap: 8px;

    .group-select {
      flex: 1;
      min-width: 80px;
    }

    .priority-filter {
      display: flex;
      gap: 2px;

      .priority-btn {
        width: 26px;
        height: 26px;
        border: none;
        border-radius: 4px;
        background: transparent;
        cursor: pointer;
        font-size: 14px;
        opacity: 0.35;
        transition: all 0.2s;

        &:hover, &.active {
          opacity: 1;
          background: var(--b3-theme-primary-lightest);
        }
      }
    }

    .date-filter-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      height: 28px;
      padding: 0 8px;
      border: 1px solid var(--b3-border-color);
      border-radius: 6px;
      background: var(--b3-theme-background);
      cursor: pointer;
      font-size: 12px;

      &.active {
        border-color: var(--b3-theme-primary);
        color: var(--b3-theme-primary);
      }
    }
  }

  .date-range-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-top: 4px;

    .date-input {
      padding: 4px;
      border: 1px solid var(--b3-border-color);
      border-radius: 4px;
      font-size: 12px;
    }

    .clear-date-btn {
      padding: 4px 8px;
      border: none;
      background: transparent;
      color: var(--b3-theme-primary);
      cursor: pointer;
      font-size: 12px;
    }
  }
}
```

- [ ] **Step 5: 提交**

```bash
git add src/tabs/TodoDock.vue
git commit -m "feat(TodoDock): 添加搜索框和优先级/日期筛选栏"
```

---

## Task 12: 改造 TodoSidebar 支持筛选参数

**Files:**
- Modify: `src/components/todo/TodoSidebar.vue`

- [ ] **Step 1: 添加 props 定义**

```typescript
const props = withDefaults(defineProps<{
  groupId?: string;
  searchQuery?: string;
  dateRange?: { start: string; end: string } | null;
  priorities?: PriorityLevel[];
}>(), {
  groupId: '',
  searchQuery: '',
  dateRange: null,
  priorities: () => [],
});
```

- [ ] **Step 2: 修改事项获取逻辑**

将原有的各分组 items computed 改为使用新的 getter。以 `todayItems` 为例：

```typescript
// 获取所有过滤后的事项
const filteredItems = computed(() => {
  return projectStore.getFilteredAndSortedItems({
    groupId: props.groupId,
    searchQuery: props.searchQuery,
    dateRange: props.dateRange,
    priorities: props.priorities.length > 0 ? props.priorities : undefined,
  });
});

// 今日待办事项
const todayItems = computed(() => {
  const todayStr = getTodayStr();
  return filteredItems.value.filter(item => item.date === todayStr);
});

// 明日待办事项
const tomorrowItems = computed(() => {
  const tomorrowStr = getTomorrowStr();
  return filteredItems.value.filter(item => item.date === tomorrowStr);
});

// 未来待办事项
const futureItems = computed(() => {
  const todayStr = getTodayStr();
  const tomorrowStr = getTomorrowStr();
  return filteredItems.value.filter(item => 
    item.date !== todayStr && item.date !== tomorrowStr
  );
});

// 过期事项
const expiredItems = computed(() => {
  const todayStr = getTodayStr();
  return filteredItems.value.filter(item => {
    const effectiveDate = getEffectiveDate(item);
    return effectiveDate < todayStr;
  });
});
```

- [ ] **Step 3: 在事项内容中显示优先级 emoji**

修改 `getStatusEmoji` 函数，在返回的 emoji 前添加优先级：

```typescript
const getStatusEmoji = (item: Item): string => {
  // 优先级 emoji
  let priorityEmoji = '';
  if (item.priority === 'high') priorityEmoji = '🔥 ';
  else if (item.priority === 'medium') priorityEmoji = '🌿 ';
  else if (item.priority === 'low') priorityEmoji = '🍃 ';
  
  // 原有逻辑
  if (pomodoroStore.activePomodoro?.blockId && item.blockId === pomodoroStore.activePomodoro.blockId) {
    return priorityEmoji + '🍅 ';
  }
  if (item.status === 'completed') return priorityEmoji + '✅ ';
  if (item.status === 'abandoned') return priorityEmoji + '❌ ';
  // ... 其他状态
  return priorityEmoji + '⏳ ';
};
```

- [ ] **Step 4: 提交**

```bash
git add src/components/todo/TodoSidebar.vue
git commit -m "feat(TodoSidebar): 支持搜索、日期、优先级筛选参数"
```

---

## Task 13: 在 ItemDetailDialog 中显示和编辑优先级

**Files:**
- Modify: `src/components/dialog/ItemDetailDialog.vue`

- [ ] **Step 1: 导入优先级相关函数**

```typescript
import { PRIORITY_CONFIG, generatePriorityMarker } from '@/parser/priorityParser';
import { showPrioritySettingDialog } from '@/utils/dialog';
import { updateBlockPriority } from '@/utils/fileUtils';
```

- [ ] **Step 2: 在模板中添加优先级显示和编辑**

在事项详情中合适位置（如时间信息旁边）添加：

```vue
<div class="detail-item">
  <span class="detail-label">{{ t('todo').priority.title }}:</span>
  <div class="priority-display">
    <span v-if="item.priority" class="priority-badge">
      {{ PRIORITY_CONFIG[item.priority].emoji }} {{ PRIORITY_CONFIG[item.priority].label }}
    </span>
    <span v-else class="priority-empty">{{ t('todo').priority.clear }}</span>
    <button class="edit-priority-btn" @click="editPriority">
      {{ t('common').edit }}
    </button>
  </div>
</div>
```

- [ ] **Step 3: 添加 editPriority 方法**

```typescript
function editPriority() {
  showPrioritySettingDialog(props.item.priority, async (priority) => {
    if (!props.item.blockId) return;
    const success = await updateBlockPriority(props.item.blockId, priority);
    if (success) {
      // 更新本地显示的优先级
      props.item.priority = priority;
    }
  });
}
```

- [ ] **Step 4: 添加样式**

```scss
.priority-display {
  display: flex;
  align-items: center;
  gap: 8px;
}

.priority-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--b3-theme-surface);
  border-radius: 4px;
  font-size: 13px;
}

.priority-empty {
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
  font-size: 13px;
}

.edit-priority-btn {
  padding: 2px 8px;
  font-size: 12px;
  border: none;
  background: transparent;
  color: var(--b3-theme-primary);
  cursor: pointer;
}
```

- [ ] **Step 5: 提交**

```bash
git add src/components/dialog/ItemDetailDialog.vue
git commit -m "feat(ItemDetailDialog): 显示和编辑优先级"
```

---

## 验证清单

- [ ] 可以使用 `🔥/🌿/🍃` emoji 标记事项优先级
- [ ] 斜杠命令 `/priority` 或 `/yxj` 可唤起优先级选择弹框
- [ ] 右键菜单可设置/清除优先级
- [ ] 事项详情弹框显示并支持修改优先级
- [ ] 优先级标记从内容中解析并移除，不干扰内容显示
- [ ] 待办列表顶部有搜索框，支持实时过滤
- [ ] 搜索范围包括事项内容、项目名称、任务名称
- [ ] 支持日期范围筛选
- [ ] 支持优先级筛选（可多选）
- [ ] 事项按优先级排序：高(🔥) → 中(🌿) → 低(🍃) → 无
- [ ] 优先级 emoji 显示在事项卡片内容前
- [ ] 无优先级的事项正常显示，排在最后
