# 修复日历事件参数传递问题

## 问题描述
日历打开的弹框中，事项状态始终显示"待办"，链接也无法显示。

## 根本原因
数据转换器和弹框之间的字段名不匹配：

1. `dataConverter.ts` 第 93 行设置的是 `status` 字段
2. `dialog.ts` 读取的是 `itemStatus` 和 `itemLinks` 字段
3. `dataConverter.ts` 没有设置 `itemLinks` 字段

## 修复方案

### 方案选择：统一字段名
选择修改 `dataConverter.ts`，将字段名改为与 `dialog.ts` 一致：
- `status` → `itemStatus`
- 新增 `itemLinks`

原因：
- `dialog.ts` 已经使用 `itemStatus` 和 `itemLinks`，修改它会影响 `showItemDetailModal`
- `dataConverter.ts` 是数据转换层，更适合做适配

## 具体修改

### 1. 修改 `src/utils/dataConverter.ts`

**第 78-95 行 `itemToCalendarEvent` 方法：**

当前代码：
```typescript
extendedProps: {
  project: project.name,
  projectLinks: project.links,
  task: task.name,
  taskLinks: task.links,
  level: task.level,
  item: item.content,
  hasItems: true,
  docId: item.docId,
  lineNumber: item.lineNumber,
  blockId: item.blockId,
  date: item.date,
  originalStartDateTime: item.startDateTime,
  originalEndDateTime: item.endDateTime,
  siblingItems: item.siblingItems,
  status: item.status  // ❌ 字段名不匹配
}
```

修改为：
```typescript
extendedProps: {
  project: project.name,
  projectLinks: project.links,
  task: task.name,
  taskLinks: task.links,
  level: task.level,
  item: item.content,
  itemStatus: item.status,  // ✅ 改为 itemStatus
  itemLinks: item.links,    // ✅ 新增 itemLinks
  hasItems: true,
  docId: item.docId,
  lineNumber: item.lineNumber,
  blockId: item.blockId,
  date: item.date,
  originalStartDateTime: item.startDateTime,
  originalEndDateTime: item.endDateTime,
  siblingItems: item.siblingItems
}
```

### 2. 检查其他使用 `extendedProps.status` 的地方

需要检查是否有其他代码依赖于 `status` 字段，确保修改不会破坏其他功能。

搜索范围：
- `CalendarView.vue` 中的 `extendedProps` 使用
- 其他可能读取状态的地方

## 验证步骤

1. 修改 `dataConverter.ts`
2. 检查编译是否有错误
3. 在日历中点击事项，验证状态显示正确
4. 验证链接显示正确
