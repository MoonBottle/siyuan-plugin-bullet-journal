# 修复：已置顶事项右键菜单应显示"取消置顶"

## 问题分析

`createItemMenu`（[contextMenu.ts:190-194](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/utils/contextMenu.ts#L190-L194)）已正确实现根据 `item.pinned` 切换显示"置顶"/"取消置顶"：

```ts
label: item.pinned ? t('todo').unpin : t('todo').pin,
icon: item.pinned ? 'iconUnpin' : 'iconPin',
```

但三个视图在调用 `createItemMenu` 时，构造的对象**缺少 `pinned` 字段**（`repeatRule` 也部分缺失），导致 `item.pinned` 始终为 `undefined`（falsy），右键菜单永远显示"置顶"而非"取消置顶"。

## 修改方案

### 1. TodoSidebarList.vue（L1233-1243）

直接补上 `pinned: item.pinned` 和 `repeatRule: item.repeatRule`（`item` 是完整的 `Item` 对象，字段一定存在）。

### 2. dataConverter.ts — itemToCalendarEvent（L172-198）

CalendarView 的 `extendedProps` 已有 `repeatRule`（L195），但**缺少 `pinned`**。需在 `extendedProps` 中补上 `pinned: item.pinned`。

### 3. CalendarView.vue（L298-312）

在构造传给 `createItemMenu` 的对象中补上 `pinned: props.pinned` 和 `repeatRule: props.repeatRule`。

### 4. dataConverter.ts — projectsToGanttTasks（L376-398）

GanttView 的 `extendedProps` **缺少 `pinned` 和 `repeatRule`**。需补上 `pinned: item.pinned` 和 `repeatRule: item.repeatRule`。

### 5. GanttView.vue（L210-224）

在构造传给 `createItemMenu` 的对象中补上 `pinned: props.pinned` 和 `repeatRule: props.repeatRule`。

## 验证步骤

1. `npm run lint` 通过
2. `npm run typecheck` 通过
3. `npm run test` 通过
