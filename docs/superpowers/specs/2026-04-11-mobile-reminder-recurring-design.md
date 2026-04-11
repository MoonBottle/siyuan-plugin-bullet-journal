# 移动端提醒与重复设置功能设计文档

**日期**: 2026-04-11  
**类型**: 移动端功能增强  
**关联组件**: MobileItemDetail, QuickCreateDrawer, MobileReminderDrawer, MobileRecurringDrawer

---

## 一、设计目标

1. 为移动端提供完整的提醒和重复设置功能
2. 统一 MobileItemDetail 和 QuickCreateDrawer 的布局顺序
3. 最大化复用桌面端现有逻辑，避免重复实现
4. 遵循移动端 UX 最佳实践（触摸目标 44px+、清晰视觉反馈）

---

## 二、统一布局规范

### 2.1 元素优先级排序

两个组件统一采用以下顺序：

| 顺序 | 元素 | 优先级 | 说明 |
|------|------|--------|------|
| 1 | **事项内容** | P0 | 核心信息，用户首先关心"要做什么" |
| 2 | **所属项目** | P1 | 上下文信息，建立归属关系 |
| 3 | **所属任务** | P1 | 上下文信息，任务的层级结构 |
| 4 | **日期** | P1 | 核心时间属性，决定事项显示日期 |
| 5 | **时间范围** | P2 | 细化信息，开始/结束时间（可选） |
| 6 | **优先级** | P2 | 辅助排序属性，视觉颜色区分 |
| 7 | **提醒** | P3 | 增强功能，默认折叠/未设置状态 |
| 8 | **重复** | P3 | 增强功能，默认折叠/未设置状态 |

### 2.2 视觉层级

```
┌─────────────────────────────────────────┐
│  📄 事项内容                             │  ← 大字号、最突出
│  [具体内容文本...]                       │
├─────────────────────────────────────────┤
│  📁 所属项目        项目名称        >    │  ← 可点击行
│  📋 所属任务        任务名称 L1     >    │
├─────────────────────────────────────────┤
│  📅 日期            今天 04-11      >    │
│  🕐 时间范围        09:00 ~ 17:00   >    │
├─────────────────────────────────────────┤
│  🏷️ 优先级    [高] [中] [低]            │  ← 横向按钮组
├─────────────────────────────────────────┤
│  ⏰ 提醒            未设置          >    │  ← Action 行样式
│  🔄 重复            每周一三五      >    │
└─────────────────────────────────────────┘
```

---

## 三、组件设计

### 3.1 MobileItemDetail 调整

#### 当前 → 调整后

| 当前顺序 | 当前内容 | 调整后顺序 | 调整后内容 |
|----------|----------|------------|------------|
| 1 | 事项内容 | 1 | 事项内容（保持） |
| 2 | 项目 & 任务 | 2 | 项目 & 任务（保持） |
| 3 | 优先级 | 3 | **日期**（上移） |
| 4 | 时间（日期+时间） | 4 | **时间范围**（拆分） |
| 5 | 提醒 & 重复 | 5 | **优先级**（下移） |
| 6 | 链接、番茄钟 | 6 | 提醒 & 重复（保持） |
| - | - | 7 | 链接、番茄钟 |

#### 时间区域拆分

将当前合并的时间卡片拆分为两个独立可点击行：

```vue
<!-- 日期行 -->
<div class="info-item editable" @click="handleEditDate">
  <div class="info-left">
    <svg class="info-icon"><use xlink:href="#iconCalendar"></use></svg>
    <span class="info-label">日期</span>
  </div>
  <div class="info-right">
    <span class="info-value">{{ formatDateDisplay }}</span>
    <svg class="arrow-icon"><use xlink:href="#iconRight"></use></svg>
  </div>
</div>

<!-- 时间行（仅当有时间时显示或点击展开） -->
<div class="info-item editable" @click="handleEditTime">
  <div class="info-left">
    <svg class="info-icon"><use xlink:href="#iconClock"></use></svg>
    <span class="info-label">时间</span>
  </div>
  <div class="info-right">
    <span class="info-value">{{ formatTimeDisplay }}</span>
    <svg class="arrow-icon"><use xlink:href="#iconRight"></use></svg>
  </div>
</div>
```

### 3.2 QuickCreateDrawer 调整

#### 当前 → 调整后

| 当前顺序 | 当前内容 | 调整后顺序 | 调整后内容 |
|----------|----------|------------|------------|
| 1 | 所属项目 | 1 | **事项内容**（移到顶部） |
| 2 | 所属任务 | 2 | 所属项目（下移） |
| 3 | 事项内容 | 3 | 所属任务（下移） |
| 4 | 日期 | 4 | 日期（保持） |
| 5 | 时间范围 | 5 | 时间范围（保持） |
| 6 | 优先级 | 6 | 优先级（保持） |
| - | - | 7 | **提醒**（新增） |
| - | - | 8 | **重复**（新增） |

#### 新增入口样式

与 MobileItemDetail 的 Action Card 样式一致：

```vue
<!-- Quick Actions Section -->
<div class="actions-card">
  <button 
    class="action-item"
    :class="{ active: hasReminder }"
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
    :class="{ active: hasRecurring }"
    @click="handleSetRecurring"
  >
    <div class="action-icon-wrapper">
      <svg><use xlink:href="#iconRefresh"></use></svg>
    </div>
    <span class="action-text">{{ recurringText }}</span>
    <svg class="action-arrow"><use xlink:href="#iconRight"></use></svg>
  </button>
</div>
```

### 3.3 MobileReminderDrawer（新增）

从底部滑出的抽屉，包装桌面端 `ReminderSettingDialog` 组件。

#### Props

```typescript
interface MobileReminderDrawerProps {
  modelValue: boolean;              // 显示/隐藏
  blockId?: string;                 // 事项块ID（编辑模式）
  initialConfig?: ReminderConfig;   // 初始配置
  itemDate?: string;                // 事项日期（用于计算相对提醒）
  itemStartTime?: string;           // 事项开始时间
  itemEndTime?: string;             // 事项结束时间
}

interface MobileReminderDrawerEmits {
  'update:modelValue': [value: boolean];
  'save': [config: ReminderConfig]; // 保存时触发
  'cancel': [];                     // 取消时触发
}
```

#### 与桌面端组件的关系

```
MobileReminderDrawer.vue
├── 抽屉容器（底部滑出动画）
├── 抽屉头部（标题 + 关闭手柄）
└── ReminderSettingDialog.vue（复用桌面端组件）
    ├── layout="drawer" 模式适配
    └── 相同的逻辑和事件
```

#### 样式适配

```scss
.mobile-reminder-drawer {
  max-height: 85vh;
  border-radius: 24px 24px 0 0;
  
  .reminder-setting-dialog {
    // 覆盖桌面端样式适配移动端
    padding: 16px;
    min-width: auto;
    max-width: 100%;
  }
  
  .quick-buttons {
    grid-template-columns: repeat(2, 1fr); // 移动端双列
    gap: 12px;
  }
  
  .mode-btn {
    min-height: 48px; // 44px+ touch target
    padding: 12px 16px;
  }
}
```

### 3.4 MobileRecurringDrawer（新增）

与 MobileReminderDrawer 结构相同，包装 `RecurringSettingDialog`。

#### Props

```typescript
interface MobileRecurringDrawerProps {
  modelValue: boolean;
  blockId?: string;
  initialRepeatRule?: RepeatRule;
  initialEndCondition?: EndCondition;
  itemDate?: string;  // 用于默认周几选择
}

interface MobileRecurringDrawerEmits {
  'update:modelValue': [value: boolean];
  'save': [repeatRule: RepeatRule | undefined, endCondition: EndCondition | undefined];
  'cancel': [];
}
```

---

## 四、逻辑复用策略

### 4.1 提取公共保存函数

新建 `src/utils/itemSettingUtils.ts`：

```typescript
/**
 * 更新事项的提醒设置
 * 从 dialog.ts 迁移，供桌面端和移动端共用
 */
export async function updateItemWithReminder(
  item: Item, 
  config: ReminderConfig
): Promise<void> {
  if (!item.blockId) return;
  
  const block = await siyuanAPI.getBlockByID(item.blockId);
  if (!block) return;
  
  let content = block.content || block.markdown || '';
  content = stripReminderMarker(content);
  
  if (config.enabled) {
    const marker = generateReminderMarker(config);
    if (marker) content += ` ${marker}`;
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
  if (!item.blockId) return;
  
  const block = await siyuanAPI.getBlockByID(item.blockId);
  if (!block) return;
  
  let content = block.content || block.markdown || '';
  content = stripRecurringMarkers(content);
  
  if (repeatRule) {
    content += ` ${generateRepeatRuleMarker(repeatRule)}`;
    if (endCondition) {
      const endMarker = generateEndConditionMarker(endCondition);
      if (endMarker) content += ` ${endMarker}`;
    }
  }
  
  await siyuanAPI.updateBlock('markdown', content.trim(), item.blockId);
}

/**
 * 构建包含提醒/重复的 markdown 内容
 * 供 QuickCreate 使用
 */
export function buildItemContent(
  baseContent: string,
  date: string,
  options: {
    startTime?: string;
    endTime?: string;
    priority?: PriorityLevel;
    reminder?: ReminderConfig;
    repeatRule?: RepeatRule;
    endCondition?: EndCondition;
  }
): string {
  let content = baseContent;
  
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
    const priorityMap = { high: '🔥', medium: '🌱', low: '🍃' };
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
      if (endMarker) content += ` ${endMarker}`;
    }
  }
  
  return content;
}
```

### 4.2 扩展 QuickCreate 参数

修改 `src/utils/quickCreate.ts` 中的 `createItem`：

```typescript
export interface CreateItemOptions {
  priority?: 'high' | 'medium' | 'low';
  tags?: string[];
  reminder?: ReminderConfig;        // 新增
  repeatRule?: RepeatRule;          // 新增
  endCondition?: EndCondition;      // 新增
}

export async function createItem(
  taskBlockId: string,
  content: string,
  date: string,
  startTime?: string,
  endTime?: string,
  options?: CreateItemOptions
): Promise<CreateResult> {
  // ... 使用 buildItemContent 构建完整内容
}
```

### 4.3 桌面端 dialog.ts 迁移

`src/utils/dialog.ts` 中的 `updateItemWithReminder` 和 `updateItemWithRecurring` 改为从 `itemSettingUtils.ts` 导入，保持向后兼容。

---

## 五、交互流程

### 5.1 MobileItemDetail 设置流程

```
用户点击"设置提醒"
        ↓
MobileItemDetail 发出 @set-reminder 事件
        ↓
MobileTodoDock 接收事件
        ↓
打开 MobileReminderDrawer (v-model=true)
        ↓
用户在抽屉中选择提醒方式
        ↓
点击"保存"
        ↓
调用 updateItemWithReminder() 保存到思源
        ↓
触发 refresh 事件更新数据
        ↓
关闭抽屉
```

### 5.2 QuickCreate 设置流程

```
用户在 QuickCreateDrawer 填写信息
        ↓
点击"设置提醒"
        ↓
打开 MobileReminderDrawer
        ↓
配置完成，点击"保存"
        ↓
数据暂存在 QuickCreateDrawer 状态中
        ↓
用户点击"确认创建"
        ↓
调用 createItem() 传入 reminder/recurring 配置
        ↓
生成包含标记的 markdown 并创建
```

---

## 六、样式规范

### 6.1 通用样式变量

两个组件共享以下 CSS 模式：

```scss
// 卡片容器
.info-card, .actions-card {
  background: var(--b3-theme-surface);
  border-radius: 16px;
  padding: 12px 16px;
  margin-bottom: 12px;
}

// 可点击行
.info-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 44px; // UX 规范: 触摸目标 44px+
  padding: 10px 0;
  cursor: pointer;
  
  &:active {
    opacity: 0.7;
  }
  
  &:not(:last-child) {
    border-bottom: 1px solid var(--b3-border-color);
  }
}

// Action 行（提醒/重复）
.action-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  width: 100%;
  border: none;
  background: transparent;
  cursor: pointer;
  
  &:not(:last-child) {
    border-bottom: 1px solid var(--b3-border-color);
  }
  
  &.active {
    .action-icon-wrapper {
      background: rgba(var(--b3-theme-primary-rgb), 0.15);
    }
    .action-text {
      color: var(--b3-theme-primary);
    }
  }
}

// 图标包装
.action-icon-wrapper {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--b3-theme-surface-lighter);
  border-radius: 10px;
  flex-shrink: 0;
}
```

### 6.2 抽屉动画

```scss
// 统一使用与 MobileItemDetail 相同的动画
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
```

---

## 七、实现计划

### Phase 1: 基础设施
1. 创建 `src/utils/itemSettingUtils.ts`（提取公共函数）
2. 修改 `src/utils/quickCreate.ts`（扩展参数）
3. 修改 `src/utils/dialog.ts`（使用新的公共函数）

### Phase 2: 组件实现
1. 创建 `src/tabs/mobile/drawers/MobileReminderDrawer.vue`
2. 创建 `src/tabs/mobile/drawers/MobileRecurringDrawer.vue`
3. 修改 `src/components/dialog/ReminderSettingDialog.vue`（适配 drawer 模式）
4. 修改 `src/components/dialog/RecurringSettingDialog.vue`（适配 drawer 模式）

### Phase 3: 布局调整
1. 修改 `src/tabs/mobile/drawers/MobileItemDetail.vue`（调整顺序）
2. 修改 `src/tabs/mobile/drawers/QuickCreateDrawer.vue`（调整顺序 + 添加入口）
3. 修改 `src/tabs/mobile/MobileTodoDock.vue`（集成抽屉）

### Phase 4: 测试
1. 桌面端弹框功能回归测试
2. 移动端抽屉功能测试
3. QuickCreate 创建带提醒/重复的事项测试

---

## 八、风险与注意事项

1. **桌面端兼容性**: 修改 `ReminderSettingDialog` 和 `RecurringSettingDialog` 时需确保桌面端弹框模式正常工作
2. **z-index 层级**: 抽屉嵌套时注意层级管理（QuickCreate z-index 1002，设置抽屉 z-index 1003）
3. **数据同步**: QuickCreate 中的 reminder/recurring 配置在关闭抽屉后需要正确保留到创建时
4. **国际化**: 所有新增文本需通过 `t()` 函数处理

---

## 九、附录

### 相关文件清单

| 文件路径 | 操作 | 说明 |
|----------|------|------|
| `src/utils/itemSettingUtils.ts` | 新增 | 公共保存函数 |
| `src/utils/quickCreate.ts` | 修改 | 扩展 createItem 参数 |
| `src/utils/dialog.ts` | 修改 | 使用公共函数 |
| `src/tabs/mobile/drawers/MobileReminderDrawer.vue` | 新增 | 提醒设置抽屉 |
| `src/tabs/mobile/drawers/MobileRecurringDrawer.vue` | 新增 | 重复设置抽屉 |
| `src/components/dialog/ReminderSettingDialog.vue` | 修改 | 适配 drawer 模式 |
| `src/components/dialog/RecurringSettingDialog.vue` | 修改 | 适配 drawer 模式 |
| `src/tabs/mobile/drawers/MobileItemDetail.vue` | 修改 | 调整布局顺序 |
| `src/tabs/mobile/drawers/QuickCreateDrawer.vue` | 修改 | 调整布局 + 添加入口 |
| `src/tabs/mobile/MobileTodoDock.vue` | 修改 | 集成抽屉组件 |
