# 修复迁移功能 siblingItems 参数传递问题

## 问题描述

边界闰年 @2024-02-28, 2024-02-29, 2024-03-01 这样的多日期事项：
- **拖动能正常更新日期** ✅
- **迁移功能不正常** ❌

## 根本原因

`updateBlockDateTime` 函数需要 `originalDate` 和 `siblingItems` 参数来正确处理多日期事项的迁移：

1. `originalDate`: 用于定位要替换的原始日期
2. `siblingItems`: 包含同一块中的其他日期时间信息

**拖动功能**（CalendarTab.vue）正确传递了这些参数：
```typescript
await updateBlockDateTime(
  blockId,
  newDate,
  newStartTime,
  newEndTime,
  allDay,
  originalDate,        // ✅ 传递了
  completeSiblingItems, // ✅ 传递了
  status
);
```

**迁移功能**（CalendarView.vue 和 TodoSidebar.vue）**没有传递**这些参数：
```typescript
await updateBlockDateTime(item.blockId, todayStr); // ❌ 缺少 originalDate 和 siblingItems
```

## 修复方案

### 1. CalendarView.vue 修复

位置：`src/components/calendar/CalendarView.vue` 第 121-146 行

需要修改三个迁移处理函数：
- `onMigrateToday`
- `onMigrateTomorrow`
- `onMigrateCustom`

每个函数需要：
1. 获取当前项的 `siblingItems`（同一块的其他日期）
2. 构建 `completeSiblingItems`（包含当前日期）
3. 传递 `originalDate` 和 `completeSiblingItems` 给 `updateBlockDateTime`

### 2. TodoSidebar.vue 修复

位置：`src/components/todo/TodoSidebar.vue` 第 475-532 行

同样需要修改三个迁移处理函数：
- `handleMigrate`
- `handleMigrateToday`
- `handleMigrateCustom`

## 实现细节

### 修改后的调用方式

```typescript
// 1. 获取 siblingItems（从 item 或额外查询）
const siblingItems = item.siblingItems || []; // 需要从某处获取

// 2. 构建完整的 siblingItems（包含当前日期）
const completeSiblingItems = [
  ...(siblingItems || []),
  ...(item.date ? [{
    date: item.date,
    startDateTime: item.startDateTime,
    endDateTime: item.endDateTime
  }] : [])
];

// 3. 调用 updateBlockDateTime 时传递所有必要参数
await updateBlockDateTime(
  item.blockId,
  newDate,
  item.startDateTime ? item.startDateTime.split(' ')[1] : undefined,
  item.endDateTime ? item.endDateTime.split(' ')[1] : undefined,
  !item.startDateTime,
  item.date,              // originalDate - 要替换的原始日期
  completeSiblingItems,   // 所有日期（包括其他日期和当前日期）
  item.status             // 状态
);
```

## 需要修改的文件

1. `src/components/calendar/CalendarView.vue` - 修复迁移功能
2. `src/components/todo/TodoSidebar.vue` - 修复迁移功能

## 测试验证

修复后应能通过以下测试场景：
- 多日期事项（如 @2024-02-28, 2024-02-29, 2024-03-01）使用迁移功能时
- 应该只修改目标日期，保留其他日期
- 日期范围应该正确合并（如连续的 02-28 和 02-29 应该合并为 02-28~02-29）
