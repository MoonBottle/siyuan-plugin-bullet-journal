# 移动端提醒与重复设置功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为移动端实现完整的提醒和重复设置功能，统一 MobileItemDetail 和 QuickCreateDrawer 的布局顺序

**Architecture:** 
- 提取公共保存逻辑到 `itemSettingUtils.ts`，供桌面端和移动端共用
- 桌面端设置组件通过 `layout` prop 适配移动端抽屉模式
- 新建 `MobileReminderDrawer` 和 `MobileRecurringDrawer` 作为移动端容器
- 统一两个组件的布局顺序：内容→项目→任务→日期→时间→优先级→提醒→重复

**Tech Stack:** Vue 3, TypeScript, SCSS, SiYuan API

---

## 文件结构

### 新增文件
| 文件 | 职责 |
|------|------|
| `src/utils/itemSettingUtils.ts` | 公共保存函数（提醒/重复的更新和 markdown 构建） |
| `src/tabs/mobile/drawers/MobileReminderDrawer.vue` | 移动端提醒设置抽屉容器 |
| `src/tabs/mobile/drawers/MobileRecurringDrawer.vue` | 移动端重复设置抽屉容器 |

### 修改文件
| 文件 | 修改内容 |
|------|----------|
| `src/utils/quickCreate.ts` | 扩展 `createItem` 参数支持 reminder/recurring |
| `src/utils/dialog.ts` | 使用 `itemSettingUtils` 中的公共函数 |
| `src/components/dialog/ReminderSettingDialog.vue` | 添加 `layout` prop 适配抽屉模式 |
| `src/components/dialog/RecurringSettingDialog.vue` | 添加 `layout` prop 适配抽屉模式 |
| `src/tabs/mobile/drawers/MobileItemDetail.vue` | 调整布局顺序（日期/时间/优先级） |
| `src/tabs/mobile/drawers/QuickCreateDrawer.vue` | 调整布局 + 添加入口 |
| `src/tabs/mobile/MobileTodoDock.vue` | 集成抽屉组件 |

---

## Phase 1: 基础设施

### Task 1: 创建公共保存函数

**Files:**
- Create: `src/utils/itemSettingUtils.ts`

**Context:**
- 当前 `dialog.ts` 中 `updateItemWithReminder` 和 `updateItemWithRecurring` 需要被移动端复用
- 需要新增 `buildItemContent` 函数供 QuickCreate 使用
- 依赖: `src/api.ts`, `src/parser/reminderParser.ts`, `src/parser/recurringParser.ts`

- [ ] **Step 1: 创建 itemSettingUtils.ts**

```typescript
/**
 * 事项设置工具函数
 * 供桌面端和移动端共用
 */

import * as siyuanAPI from '@/api';
import type { Item, ReminderConfig, RepeatRule, EndCondition, PriorityLevel } from '@/types/models';
import { 
  generateReminderMarker, 
  stripReminderMarker 
} from '@/parser/reminderParser';
import { 
  generateRepeatRuleMarker, 
  generateEndConditionMarker,
  stripRecurringMarkers 
} from '@/parser/recurringParser';

/**
 * 更新事项的提醒设置
 */
export async function updateItemWithReminder(
  item: Item, 
  config: ReminderConfig
): Promise<void> {
  if (!item.blockId) {
    throw new Error('Item blockId is required');
  }
  
  const block = await siyuanAPI.getBlockByID(item.blockId);
  if (!block) {
    throw new Error(`Block not found: ${item.blockId}`);
  }
  
  let content = block.content || block.markdown || '';
  content = stripReminderMarker(content);
  
  if (config.enabled) {
    const marker = generateReminderMarker(config);
    if (marker) {
      content += ` ${marker}`;
    }
  }
  
  await siyuanAPI.updateBlock('markdown', content.trim(), item.blockId);
}

/**
 * 更新事项的重复设置
 */
export async function updateItemWithRecurring(
  item: Item,
  repeatRule: RepeatRule | undefined,
  endCondition: EndCondition | undefined
): Promise<void> {
  if (!item.blockId) {
    throw new Error('Item blockId is required');
  }
  
  const block = await siyuanAPI.getBlockByID(item.blockId);
  if (!block) {
    throw new Error(`Block not found: ${item.blockId}`);
  }
  
  let content = block.content || block.markdown || '';
  content = stripRecurringMarkers(content);
  
  if (repeatRule) {
    content += ` ${generateRepeatRuleMarker(repeatRule)}`;
    
    if (endCondition) {
      const endMarker = generateEndConditionMarker(endCondition);
      if (endMarker) {
        content += ` ${endMarker}`;
      }
    }
  }
  
  await siyuanAPI.updateBlock('markdown', content.trim(), item.blockId);
}

/**
 * 构建包含所有标记的事项内容
 * 供 QuickCreate 使用
 */
export interface BuildItemContentOptions {
  startTime?: string;
  endTime?: string;
  priority?: PriorityLevel;
  reminder?: ReminderConfig;
  repeatRule?: RepeatRule;
  endCondition?: EndCondition;
}

export function buildItemContent(
  baseContent: string,
  date: string,
  options: BuildItemContentOptions = {}
): string {
  let content = baseContent.trim();
  
  // 日期部分
  let datePart = `📅${date}`;
  if (options.startTime && options.endTime) {
    datePart = `📅${date} ${options.startTime}~${options.endTime}`;
  } else if (options.startTime) {
    datePart = `📅${date} ${options.startTime}`;
  }
  content += ` ${datePart}`;
  
  // 优先级
  if (options.priority) {
    const priorityMap: Record<PriorityLevel, string> = {
      high: '🔥',
      medium: '🌱',
      low: '🍃'
    };
    content += ` ${priorityMap[options.priority]}`;
  }
  
  // 提醒
  if (options.reminder?.enabled) {
    content += ` ${generateReminderMarker(options.reminder)}`;
  }
  
  // 重复
  if (options.repeatRule) {
    content += ` ${generateRepeatRuleMarker(options.repeatRule)}`;
    if (options.endCondition) {
      const endMarker = generateEndConditionMarker(options.endCondition);
      if (endMarker) {
        content += ` ${endMarker}`;
      }
    }
  }
  
  return content;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/itemSettingUtils.ts
git commit -m "feat(utils): add itemSettingUtils for reminder/recurring operations"
```

---

### Task 2: 修改 quickCreate.ts 支持 reminder/recurring

**Files:**
- Modify: `src/utils/quickCreate.ts`

**Context:**
- 当前 `createItem` 只支持 `priority` 和 `tags`
- 需要扩展 `CreateItemOptions` 接口和 `createItem` 函数

- [ ] **Step 1: 修改 CreateItemOptions 接口**

在文件顶部找到 `CreateItemOptions` 接口（或创建）：

```typescript
export interface CreateItemOptions {
  priority?: 'high' | 'medium' | 'low';
  tags?: string[];
  reminder?: ReminderConfig;        // 新增
  repeatRule?: RepeatRule;          // 新增
  endCondition?: EndCondition;      // 新增
}
```

- [ ] **Step 2: 修改 createItem 函数**

找到 `createItem` 函数，修改其内部实现：

```typescript
// 原代码（约 247-271 行）
let itemContent = `${content} ${datePart}`;

// 添加优先级标记（使用 Emoji）
if (options?.priority) {
  const priorityMap: Record<string, string> = {
    high: '🔥',
    medium: '🌱',
    low: '🍃',
  };
  itemContent += ` ${priorityMap[options.priority]}`;
}

// 添加标签
if (options?.tags?.length) {
  itemContent += ` ${options.tags.map(t => `#${t}`).join(' ')}`;
}

// 替换为使用 buildItemContent
import { buildItemContent } from './itemSettingUtils';

const itemContent = buildItemContent(content, date, {
  startTime,
  endTime,
  priority: options?.priority,
  reminder: options?.reminder,
  repeatRule: options?.repeatRule,
  endCondition: options?.endCondition,
});
```

**注意:** 需要在文件顶部添加导入：
```typescript
import { buildItemContent } from './itemSettingUtils';
import type { ReminderConfig, RepeatRule, EndCondition } from '@/types/models';
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/quickCreate.ts
git commit -m "feat(quickCreate): extend createItem to support reminder/recurring"
```

---

### Task 3: 修改 dialog.ts 使用公共函数

**Files:**
- Modify: `src/utils/dialog.ts`

**Context:**
- 当前 `dialog.ts` 内部定义了 `updateItemWithReminder` 和 `updateItemWithRecurring`
- 需要改为从 `itemSettingUtils` 导入

- [ ] **Step 1: 添加导入**

在文件顶部找到导入区域（约第 1-30 行），添加：

```typescript
import { 
  updateItemWithReminder, 
  updateItemWithRecurring 
} from './itemSettingUtils';
```

- [ ] **Step 2: 删除原有函数定义**

删除约 1122-1232 行的两个函数定义：
- `updateItemWithReminder`
- `updateItemWithRecurring`

- [ ] **Step 3: Commit**

```bash
git add src/utils/dialog.ts
git commit -m "refactor(dialog): use itemSettingUtils for reminder/recurring updates"
```

---

## Phase 2: 组件适配

### Task 4: 修改 ReminderSettingDialog 支持 drawer 模式

**Files:**
- Modify: `src/components/dialog/ReminderSettingDialog.vue`

**Context:**
- 当前组件假设在桌面弹框中使用
- 需要添加 `layout` prop 来适配移动端抽屉布局

- [ ] **Step 1: 添加 layout prop**

在 `<script setup>` 中找到 Props 定义（约 119-125 行），修改为：

```typescript
interface Props {
  blockId: string;
  initialConfig?: ReminderConfig;
  layout?: 'dialog' | 'drawer';  // 新增
}

const props = withDefaults(defineProps<Props>(), {
  layout: 'dialog'
});
```

- [ ] **Step 2: 调整样式类绑定**

在 `<template>` 根元素（约第 2 行），添加动态类：

```vue
<template>
  <div class="reminder-setting-dialog" :class="{ 'drawer-mode': layout === 'drawer' }">
```

- [ ] **Step 3: 添加 drawer 模式样式**

在 `<style>` 底部添加：

```scss
// Drawer 模式适配
.reminder-setting-dialog.drawer-mode {
  padding: 0;
  min-width: auto;
  max-width: 100%;
  
  .quick-buttons {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  
  .mode-btn {
    min-height: 48px;
    padding: 12px 8px;
    font-size: 14px;
  }
  
  .time-presets {
    grid-template-columns: repeat(3, 1fr);
  }
  
  .action-section {
    margin-top: 20px;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/dialog/ReminderSettingDialog.vue
git commit -m "feat(ReminderSettingDialog): add drawer mode support"
```

---

### Task 5: 修改 RecurringSettingDialog 支持 drawer 模式

**Files:**
- Modify: `src/components/dialog/RecurringSettingDialog.vue`

**Context:**
- 与 ReminderSettingDialog 相同的修改模式

- [ ] **Step 1: 添加 layout prop**

在 Props 定义处（约 115-122 行）：

```typescript
interface Props {
  blockId: string;
  initialRepeatRule?: RepeatRule;
  initialEndCondition?: EndCondition;
  layout?: 'dialog' | 'drawer';  // 新增
}

const props = withDefaults(defineProps<Props>(), {
  layout: 'drawer'  // 注意：为了测试方便可以先默认 drawer，后面改回 dialog
});
```

**更正:** 默认应该是 'dialog' 保持向后兼容：
```typescript
layout: 'dialog'
```

- [ ] **Step 2: 调整样式类绑定**

```vue
<template>
  <div class="recurring-setting-dialog" :class="{ 'drawer-mode': layout === 'drawer' }">
```

- [ ] **Step 3: 添加 drawer 模式样式**

```scss
// Drawer 模式适配
.recurring-setting-dialog.drawer-mode {
  padding: 0;
  min-width: auto;
  max-width: 100%;
  
  .quick-buttons {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  
  .mode-btn {
    min-height: 48px;
    padding: 12px 8px;
    font-size: 14px;
  }
  
  .weekday-buttons {
    grid-template-columns: repeat(7, 1fr);
    gap: 6px;
  }
  
  .weekday-btn {
    padding: 10px 4px;
    font-size: 12px;
  }
  
  .action-section {
    margin-top: 20px;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/dialog/RecurringSettingDialog.vue
git commit -m "feat(RecurringSettingDialog): add drawer mode support"
```

---

### Task 6: 创建 MobileReminderDrawer

**Files:**
- Create: `src/tabs/mobile/drawers/MobileReminderDrawer.vue`

**Context:**
- 作为移动端容器，包装 ReminderSettingDialog
- 提供底部滑出抽屉的交互

- [ ] **Step 1: 创建组件文件**

```vue
<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="modelValue" class="drawer-overlay" @click="close">
        <Transition name="slide-up">
          <div v-if="modelValue" class="mobile-reminder-drawer" @click.stop>
            <!-- Handle Bar -->
            <div class="drawer-handle" @click="close">
              <div class="handle-bar"></div>
            </div>
            
            <!-- Header -->
            <div class="drawer-header">
              <h3 class="drawer-title">{{ t('reminder.settingTitle') || '设置提醒' }}</h3>
            </div>
            
            <!-- Content -->
            <div class="drawer-content">
              <ReminderSettingDialog
                :block-id="blockId || ''"
                :initial-config="initialConfig"
                layout="drawer"
                @save="handleSave"
                @cancel="close"
              />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ReminderSettingDialog from '@/components/dialog/ReminderSettingDialog.vue';
import { t } from '@/i18n';
import { updateItemWithReminder } from '@/utils/itemSettingUtils';
import type { ReminderConfig, Item } from '@/types/models';

interface Props {
  modelValue: boolean;
  blockId?: string;
  initialConfig?: ReminderConfig;
  item?: Item;  // 用于保存时更新
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'save': [config: ReminderConfig];
  'cancel': [];
}>();

const hasItem = computed(() => !!props.item);

async function handleSave(config: ReminderConfig) {
  // 如果有 item，直接保存
  if (props.item) {
    try {
      await updateItemWithReminder(props.item, config);
      emit('save', config);
      close();
    } catch (error) {
      console.error('[MobileReminderDrawer] Failed to save reminder:', error);
    }
  } else {
    // 否则只发射事件（QuickCreate 模式）
    emit('save', config);
    close();
  }
}

function close() {
  emit('update:modelValue', false);
  emit('cancel');
}
</script>

<style lang="scss" scoped>
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  z-index: 1003;
  display: flex;
  align-items: flex-end;
}

.mobile-reminder-drawer {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  max-height: 85vh;
  background: var(--b3-theme-background);
  border-radius: 24px 24px 0 0;
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
}

.drawer-handle {
  display: flex;
  justify-content: center;
  padding: 12px;
  cursor: pointer;
}

.handle-bar {
  width: 40px;
  height: 4px;
  background: var(--b3-theme-on-surface);
  opacity: 0.25;
  border-radius: 2px;
}

.drawer-header {
  padding: 4px 20px 16px;
  text-align: center;
}

.drawer-title {
  font-size: 17px;
  font-weight: 600;
  margin: 0;
  color: var(--b3-theme-on-background);
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 16px;
}

// Transitions
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/tabs/mobile/drawers/MobileReminderDrawer.vue
git commit -m "feat(mobile): add MobileReminderDrawer component"
```

---

### Task 7: 创建 MobileRecurringDrawer

**Files:**
- Create: `src/tabs/mobile/drawers/MobileRecurringDrawer.vue`

**Context:**
- 与 MobileReminderDrawer 结构相同，包装 RecurringSettingDialog

- [ ] **Step 1: 创建组件文件**

```vue
<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="modelValue" class="drawer-overlay" @click="close">
        <Transition name="slide-up">
          <div v-if="modelValue" class="mobile-recurring-drawer" @click.stop>
            <!-- Handle Bar -->
            <div class="drawer-handle" @click="close">
              <div class="handle-bar"></div>
            </div>
            
            <!-- Header -->
            <div class="drawer-header">
              <h3 class="drawer-title">{{ t('recurring.settingTitle') || '设置重复' }}</h3>
            </div>
            
            <!-- Content -->
            <div class="drawer-content">
              <RecurringSettingDialog
                :block-id="blockId || ''"
                :initial-repeat-rule="initialRepeatRule"
                :initial-end-condition="initialEndCondition"
                layout="drawer"
                @save="handleSave"
                @cancel="close"
              />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import RecurringSettingDialog from '@/components/dialog/RecurringSettingDialog.vue';
import { t } from '@/i18n';
import { updateItemWithRecurring } from '@/utils/itemSettingUtils';
import type { RepeatRule, EndCondition, Item } from '@/types/models';

interface Props {
  modelValue: boolean;
  blockId?: string;
  initialRepeatRule?: RepeatRule;
  initialEndCondition?: EndCondition;
  item?: Item;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'save': [repeatRule: RepeatRule | undefined, endCondition: EndCondition | undefined];
  'cancel': [];
}>();

const hasItem = computed(() => !!props.item);

async function handleSave(repeatRule: RepeatRule | undefined, endCondition: EndCondition | undefined) {
  // 如果有 item，直接保存
  if (props.item) {
    try {
      await updateItemWithRecurring(props.item, repeatRule, endCondition);
      emit('save', repeatRule, endCondition);
      close();
    } catch (error) {
      console.error('[MobileRecurringDrawer] Failed to save recurring:', error);
    }
  } else {
    // 否则只发射事件（QuickCreate 模式）
    emit('save', repeatRule, endCondition);
    close();
  }
}

function close() {
  emit('update:modelValue', false);
  emit('cancel');
}
</script>

<style lang="scss" scoped>
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  z-index: 1003;
  display: flex;
  align-items: flex-end;
}

.mobile-recurring-drawer {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  max-height: 85vh;
  background: var(--b3-theme-background);
  border-radius: 24px 24px 0 0;
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
}

.drawer-handle {
  display: flex;
  justify-content: center;
  padding: 12px;
  cursor: pointer;
}

.handle-bar {
  width: 40px;
  height: 4px;
  background: var(--b3-theme-on-surface);
  opacity: 0.25;
  border-radius: 2px;
}

.drawer-header {
  padding: 4px 20px 16px;
  text-align: center;
}

.drawer-title {
  font-size: 17px;
  font-weight: 600;
  margin: 0;
  color: var(--b3-theme-on-background);
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 16px;
}

// Transitions
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/tabs/mobile/drawers/MobileRecurringDrawer.vue
git commit -m "feat(mobile): add MobileRecurringDrawer component"
```

---

## Phase 3: 布局调整与集成

### Task 8: 调整 MobileItemDetail 布局顺序

**Files:**
- Modify: `src/tabs/mobile/drawers/MobileItemDetail.vue`

**Context:**
- 当前顺序：内容 → 项目/任务 → 优先级 → 时间 → 提醒/重复
- 调整后：内容 → 项目/任务 → 日期 → 时间 → 优先级 → 提醒/重复

- [ ] **Step 1: 调整时间区域，拆分日期和时间**

找到时间区域（约第 84-112 行），修改为两个独立可点击行：

```vue
<!-- Date Info - 可编辑 -->
<div class="info-card">
  <div class="info-item editable" @click="handleEditDate">
    <div class="info-left">
      <svg class="info-icon"><use xlink:href="#iconCalendar"></use></svg>
      <span class="info-label">{{ t('mobile.detail.date') || '日期' }}</span>
    </div>
    <div class="info-right">
      <span class="info-value">{{ formatDateDisplay }}</span>
      <svg class="arrow-icon"><use xlink:href="#iconRight"></use></svg>
    </div>
  </div>
</div>

<!-- Time Info - 可编辑 -->
<div class="info-card">
  <div class="info-item editable" @click="handleEditTime">
    <div class="info-left">
      <svg class="info-icon"><use xlink:href="#iconClock"></use></svg>
      <span class="info-label">{{ t('mobile.detail.time') || '时间' }}</span>
    </div>
    <div class="info-right">
      <span class="info-value">{{ formatTimeOnlyDisplay }}</span>
      <svg class="arrow-icon"><use xlink:href="#iconRight"></use></svg>
    </div>
  </div>
  
  <!-- 时长（只读） -->
  <div v-if="duration" class="info-item readonly">
    <div class="info-left">
      <svg class="info-icon"><use xlink:href="#iconClock"></use></svg>
      <span class="info-label">{{ t('mobile.detail.duration') || '时长' }}</span>
    </div>
    <span class="info-value">{{ duration }}</span>
  </div>
</div>
```

- [ ] **Step 2: 调整优先级位置**

将优先级区域移动到时间区域之后（当前约第 67-82 行），保持代码不变只调整位置。

- [ ] **Step 3: 添加日期格式化计算属性**

在 `<script setup>` 中添加：

```typescript
// 仅显示日期
const formatDateDisplay = computed(() => {
  if (!props.item) return '';
  const todoTranslations = t('todo') as Record<string, string>;
  return formatDateLabel(
    props.item.date,
    todoTranslations.today || '今天',
    todoTranslations.tomorrow || '明天'
  );
});

// 仅显示时间
const formatTimeOnlyDisplay = computed(() => {
  if (!props.item) return t('mobile.detail.noTime') || '未设置';
  const timeRange = formatTimeRange(props.item.startDateTime, props.item.endDateTime);
  return timeRange || (t('mobile.detail.allDay') || '全天');
});
```

- [ ] **Step 4: 添加 handleEditDate 方法**

```typescript
const handleEditDate = () => {
  showDatePicker.value = true;
};
```

- [ ] **Step 5: Commit**

```bash
git add src/tabs/mobile/drawers/MobileItemDetail.vue
git commit -m "refactor(MobileItemDetail): reorder layout - date/time before priority"
```

---

### Task 9: 调整 QuickCreateDrawer 布局并添加入口

**Files:**
- Modify: `src/tabs/mobile/drawers/QuickCreateDrawer.vue`

**Context:**
- 调整顺序：事项内容移到顶部
- 新增提醒和重复设置入口

- [ ] **Step 1: 调整表单顺序**

重新排列表单区域（约第 15-96 行），新顺序：
1. 事项内容
2. 所属项目
3. 所属任务
4. 日期
5. 时间范围
6. 优先级
7. 提醒和重复（新增）

```vue
<div class="drawer-content">
  <!-- Item Content - 移到第一位 -->
  <div class="form-section">
    <label class="section-label">{{ t('mobile.quickCreate.itemContent') || '事项内容' }}</label>
    <input
      v-model="itemForm.content"
      type="text"
      class="form-input"
      :placeholder="t('mobile.quickCreate.itemContentPlaceholder') || '输入事项内容'"
    />
  </div>
  
  <!-- Project Selection -->
  <div class="form-section">
    <label class="section-label">{{ t('mobile.quickCreate.project') || '所属项目' }}</label>
    <button class="selector-btn" :class="{ empty: !selectedProjectId }" @click="openProjectSelector">
      <span class="selector-text">{{ selectedProjectName || (t('mobile.quickCreate.selectProject') || '选择项目') }}</span>
      <svg class="selector-arrow"><use xlink:href="#iconRight"></use></svg>
    </button>
  </div>
  
  <!-- Task Selection/Input -->
  <div class="form-section">
    <label class="section-label">{{ t('mobile.quickCreate.belongingTask') || '所属任务' }}</label>
    <button 
      class="selector-btn" 
      :class="{ empty: !taskInput }" 
      @click="openTaskSelector"
      :disabled="!selectedProjectId"
    >
      <span class="selector-text">{{ taskInput || (t('mobile.quickCreate.selectOrInputTask') || '选择或输入新任务名称') }}</span>
      <svg class="selector-arrow"><use xlink:href="#iconRight"></use></svg>
    </button>
    <div v-if="taskInput && !isExistingTask" class="new-task-hint">
      <svg><use xlink:href="#iconInfo"></use></svg>
      <span>{{ t('mobile.quickCreate.willCreateNewTask') || '将创建新任务' }}</span>
    </div>
  </div>
  
  <!-- Date Selection -->
  <div class="form-section">
    <label class="section-label">{{ t('mobile.quickCreate.date') || '日期' }}</label>
    <button class="selector-btn" @click="openDatePicker">
      <div class="date-display">
        <span class="date-weekday">{{ formatWeekday(itemForm.date) }}</span>
        <span class="date-value">{{ formatDate(itemForm.date) }}</span>
      </div>
      <svg class="selector-icon"><use xlink:href="#iconCalendar"></use></svg>
    </button>
  </div>
  
  <!-- Time Selection -->
  <div class="form-section">
    <label class="section-label">{{ t('mobile.quickCreate.timeRange') || '时间范围' }}</label>
    <div class="time-selector">
      <button class="time-btn" :class="{ empty: !itemForm.startTime }" @click="openTimePicker('start')">
        <span class="time-label">{{ itemForm.startTime || '开始' }}</span>
      </button>
      <span class="time-separator">~</span>
      <button class="time-btn" :class="{ empty: !itemForm.endTime }" @click="openTimePicker('end')">
        <span class="time-label">{{ itemForm.endTime || '结束' }}</span>
      </button>
    </div>
  </div>
  
  <!-- Priority -->
  <div class="form-section">
    <label class="section-label">{{ t('mobile.quickCreate.priority') || '优先级' }}</label>
    <div class="priority-selector">
      <button
        v-for="p in priorityOptions"
        :key="p.value"
        class="priority-btn"
        :class="{ active: itemForm.priority === p.value, [`priority-${p.value}`]: true }"
        @click="itemForm.priority = itemForm.priority === p.value ? undefined : p.value"
      >
        <span class="priority-dot"></span>
        <span class="priority-label">{{ p.label }}</span>
      </button>
    </div>
  </div>
  
  <!-- Reminder & Recurring Actions -->
  <div class="form-section">
    <label class="section-label">{{ t('mobile.quickCreate.advanced') || '高级选项' }}</label>
    <div class="actions-card">
      <button 
        class="action-item"
        :class="{ active: reminderConfig?.enabled }"
        @click="handleSetReminder"
      >
        <div class="action-icon-wrapper">
          <svg><use xlink:href="#iconClock"></use></svg>
        </div>
        <span class="action-text">{{ reminderText }}</span>
        <svg class="action-arrow"><use xlink:href="#iconRight"></use></svg>
      </button>
      
      <button 
        class="action-item"
        :class="{ active: !!repeatRule }"
        @click="handleSetRecurring"
      >
        <div class="action-icon-wrapper">
          <svg><use xlink:href="#iconRefresh"></use></svg>
        </div>
        <span class="action-text">{{ recurringText }}</span>
        <svg class="action-arrow"><use xlink:href="#iconRight"></use></svg>
      </button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: 扩展表单数据模型**

在 `itemForm` ref 中添加 reminder/recurring 字段：

```typescript
// Item form
const itemForm = ref({
  content: '',
  date: dayjs().format('YYYY-MM-DD'),
  startTime: '',
  endTime: '',
  priority: undefined as PriorityLevel | undefined,
});

// 新增：提醒和重复配置（不显示在表单中，通过抽屉设置）
const reminderConfig = ref<ReminderConfig | undefined>(undefined);
const repeatRule = ref<RepeatRule | undefined>(undefined);
const endCondition = ref<EndCondition | undefined>(undefined);
```

- [ ] **Step 3: 添加计算属性和方法**

```typescript
import type { ReminderConfig, RepeatRule, EndCondition } from '@/types/models';
import { formatReminderDisplay } from '@/utils/displayUtils';
import { generateRepeatRuleMarker, generateEndConditionMarker } from '@/parser/recurringParser';

// 抽屉显示状态
const showReminderDrawer = ref(false);
const showRecurringDrawer = ref(false);

// 提醒显示文本
const reminderText = computed(() => {
  if (!reminderConfig.value?.enabled) {
    return t('mobile.detail.setReminder') || '设置提醒';
  }
  return formatReminderDisplay(reminderConfig.value, t);
});

// 重复显示文本
const recurringText = computed(() => {
  if (!repeatRule.value) {
    return t('mobile.detail.setRecurring') || '设置重复';
  }
  const rule = generateRepeatRuleMarker(repeatRule.value);
  const end = generateEndConditionMarker(endCondition.value);
  return end ? `${rule} ${end}` : rule;
});

// 处理设置提醒
const handleSetReminder = () => {
  showReminderDrawer.value = true;
};

// 处理设置重复
const handleSetRecurring = () => {
  showRecurringDrawer.value = true;
};

// 处理保存提醒
const handleReminderSave = (config: ReminderConfig) => {
  reminderConfig.value = config;
};

// 处理保存重复
const handleRecurringSave = (rule: RepeatRule | undefined, end: EndCondition | undefined) => {
  repeatRule.value = rule;
  endCondition.value = end;
};
```

- [ ] **Step 4: 修改 handleSubmit 使用新配置**

找到 `handleSubmit` 函数（约第 649 行），修改 `createItem` 调用：

```typescript
// Create item
const result = await createItem(
  taskBlockId,
  itemForm.value.content.trim(),
  itemForm.value.date,
  itemForm.value.startTime || undefined,
  itemForm.value.endTime || undefined,
  {
    priority: itemForm.value.priority,
    reminder: reminderConfig.value,
    repeatRule: repeatRule.value,
    endCondition: endCondition.value,
  }
);
```

- [ ] **Step 5: 添加抽屉组件到模板**

在 `<template>` 底部，关闭标签之前添加：

```vue
<!-- Reminder Drawer -->
<MobileReminderDrawer
  v-model="showReminderDrawer"
  :initial-config="reminderConfig"
  @save="handleReminderSave"
/>

<!-- Recurring Drawer -->
<MobileRecurringDrawer
  v-model="showRecurringDrawer"
  :initial-repeat-rule="repeatRule"
  :initial-end-condition="endCondition"
  @save="handleRecurringSave"
/>
```

- [ ] **Step 6: 添加组件导入**

```typescript
import MobileReminderDrawer from './MobileReminderDrawer.vue';
import MobileRecurringDrawer from './MobileRecurringDrawer.vue';
```

- [ ] **Step 7: 添加样式**

在 `<style>` 部分添加 Action Card 样式：

```scss
// Actions Card（提醒/重复入口）
.actions-card {
  background: var(--b3-theme-surface);
  border-radius: 16px;
  padding: 8px 16px;
}

.action-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: opacity 0.2s;
  
  &:hover {
    opacity: 0.8;
  }
  
  &:not(:last-child) {
    border-bottom: 1px solid var(--b3-border-color);
  }
  
  &.active {
    .action-icon-wrapper {
      background: rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.15);
    }
    
    .action-text {
      color: var(--b3-theme-primary);
    }
  }
}

.action-icon-wrapper {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--b3-theme-surface-lighter);
  border-radius: 10px;
  flex-shrink: 0;
  
  svg {
    width: 18px;
    height: 18px;
    fill: var(--b3-theme-primary);
  }
}

.action-text {
  flex: 1;
  font-size: 14px;
  color: var(--b3-theme-on-surface);
  text-align: left;
}

.action-arrow {
  width: 16px;
  height: 16px;
  fill: var(--b3-theme-on-surface);
  opacity: 0.4;
  flex-shrink: 0;
}
```

- [ ] **Step 8: Commit**

```bash
git add src/tabs/mobile/drawers/QuickCreateDrawer.vue
git commit -m "feat(QuickCreateDrawer): reorder layout and add reminder/recurring entries"
```

---

### Task 10: 集成抽屉到 MobileTodoDock

**Files:**
- Modify: `src/tabs/mobile/MobileTodoDock.vue`

**Context:**
- 需要集成 MobileReminderDrawer 和 MobileRecurringDrawer
- 处理 MobileItemDetail 的 set-reminder/set-recurring 事件

- [ ] **Step 1: 添加抽屉组件导入**

```typescript
import MobileReminderDrawer from './drawers/MobileReminderDrawer.vue';
import MobileRecurringDrawer from './drawers/MobileRecurringDrawer.vue';
```

- [ ] **Step 2: 添加状态和方法**

```typescript
// 抽屉显示状态
const showReminderDrawer = ref(false);
const showRecurringDrawer = ref(false);
const selectedItemForSetting = ref<Item | null>(null);

// 处理设置提醒
const handleSetReminder = (item: Item) => {
  selectedItemForSetting.value = item;
  showReminderDrawer.value = true;
};

// 处理设置重复
const handleSetRecurring = (item: Item) => {
  selectedItemForSetting.value = item;
  showRecurringDrawer.value = true;
};

// 抽屉关闭后刷新
const handleSettingDrawerClose = () => {
  selectedItemForSetting.value = null;
  handleRefresh();
};
```

- [ ] **Step 3: 添加抽屉组件到模板**

在模板底部添加：

```vue
<!-- Reminder Drawer -->
<MobileReminderDrawer
  v-model="showReminderDrawer"
  :item="selectedItemForSetting"
  :initial-config="selectedItemForSetting?.reminder"
  @save="handleSettingDrawerClose"
  @cancel="selectedItemForSetting = null"
/>

<!-- Recurring Drawer -->
<MobileRecurringDrawer
  v-model="showRecurringDrawer"
  :item="selectedItemForSetting"
  :initial-repeat-rule="selectedItemForSetting?.repeatRule"
  :initial-end-condition="selectedItemForSetting?.endCondition"
  @save="handleSettingDrawerClose"
  @cancel="selectedItemForSetting = null"
/>
```

- [ ] **Step 4: Commit**

```bash
git add src/tabs/mobile/MobileTodoDock.vue
git commit -m "feat(MobileTodoDock): integrate reminder/recurring drawers"
```

---

## Phase 4: 验证与测试

### Task 11: 类型检查与构建

- [ ] **Step 1: 运行类型检查**

```bash
npx vue-tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 2: 运行构建**

```bash
npm run build
```

Expected: 构建成功，无错误

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: verify TypeScript and build"
```

---

### Task 12: 运行现有测试

- [ ] **Step 1: 运行测试**

```bash
npm test
```

Expected: 所有测试通过（特别关注 reminder/recurring/parser 相关测试）

- [ ] **Step 2: Commit（如有修复）**

```bash
git commit -m "test: fix any test failures"
```

---

## Summary

### 文件变更清单

| 文件 | 操作 | 任务 |
|------|------|------|
| `src/utils/itemSettingUtils.ts` | 创建 | Task 1 |
| `src/utils/quickCreate.ts` | 修改 | Task 2 |
| `src/utils/dialog.ts` | 修改 | Task 3 |
| `src/components/dialog/ReminderSettingDialog.vue` | 修改 | Task 4 |
| `src/components/dialog/RecurringSettingDialog.vue` | 修改 | Task 5 |
| `src/tabs/mobile/drawers/MobileReminderDrawer.vue` | 创建 | Task 6 |
| `src/tabs/mobile/drawers/MobileRecurringDrawer.vue` | 创建 | Task 7 |
| `src/tabs/mobile/drawers/MobileItemDetail.vue` | 修改 | Task 8 |
| `src/tabs/mobile/drawers/QuickCreateDrawer.vue` | 修改 | Task 9 |
| `src/tabs/mobile/MobileTodoDock.vue` | 修改 | Task 10 |

### 验收标准

- [ ] MobileItemDetail 中日期/时间在优先级之前显示
- [ ] QuickCreateDrawer 中事项内容在最顶部
- [ ] QuickCreateDrawer 可以设置提醒和重复
- [ ] 提醒/重复设置在两个组件中样式一致
- [ ] 桌面端弹框功能不受影响
- [ ] 所有测试通过
- [ ] TypeScript 无错误
- [ ] 构建成功
