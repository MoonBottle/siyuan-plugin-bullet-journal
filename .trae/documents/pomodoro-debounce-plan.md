# 防重复点击优化计划

## 问题描述
以下文件中存在点击事件可能导致重复执行的问题：
1. `PomodoroActiveTimer.vue` - `handleDone` 和 `handleAbandon` 函数
2. `TodoSidebar.vue` - `handleDone`、`handleAbandon`、`handleMigrate`、`handleMigrateToday`、`handleMigrateCustom` 函数，以及右键菜单的回调函数

**注意**：`contextMenu.ts` 本身不做修改，在使用 contextMenu 的地方（TodoSidebar.vue）加锁。

## 目标
为上述函数添加防止快速点击重复执行的逻辑。

## 实现方案

### 方案选择：使用 ref 实现简单的执行状态锁

考虑到：
1. 这是 Vue 3 组件，使用 Composition API
2. 需要防止的是同一个操作的重复执行
3. 操作完成后需要释放锁

使用 `isProcessing` ref 作为执行状态锁是最简单有效的方案。

---

## 文件一：PomodoroActiveTimer.vue

### 变更内容

1. **导入 ref**
```typescript
import { computed, onUnmounted, ref } from 'vue';
```

2. **添加状态变量**
```typescript
// 防止重复点击的执行锁
const isProcessing = ref(false);
```

3. **修改 handleDone**
```typescript
const handleDone = async () => {
  if (!currentItem.value?.blockId) return;
  if (isProcessing.value) return; // 防止重复点击

  isProcessing.value = true;
  try {
    const tag = getStatusTag('completed');
    const success = await updateBlockContent(currentItem.value.blockId, tag);
    if (success && plugin) {
      await projectStore.refresh(plugin, settingsStore.enabledDirectories);
    }
  } finally {
    isProcessing.value = false;
  }
};
```

4. **修改 handleAbandon**
```typescript
const handleAbandon = async () => {
  if (!currentItem.value?.blockId) return;
  if (isProcessing.value) return; // 防止重复点击

  isProcessing.value = true;
  try {
    const tag = getStatusTag('abandoned');
    const success = await updateBlockContent(currentItem.value.blockId, tag);
    if (success && plugin) {
      await projectStore.refresh(plugin, settingsStore.enabledDirectories);
    }
  } finally {
    isProcessing.value = false;
  }
};
```

---

## 文件二：TodoSidebar.vue

### 变更内容

1. **添加状态变量**（ref 已导入）
```typescript
// 防止重复点击的执行锁
const isProcessing = ref(false);
```

2. **修改 handleDone**
```typescript
const handleDone = async (item: Item) => {
  if (!item.blockId) return;
  if (isProcessing.value) return; // 防止重复点击

  isProcessing.value = true;
  try {
    const tag = getStatusTag('completed');
    const success = await updateBlockContent(item.blockId, tag);
    if (success && plugin) {
      await projectStore.refresh(plugin, settingsStore.enabledDirectories);
    }
  } finally {
    isProcessing.value = false;
  }
};
```

3. **修改 handleAbandon**
```typescript
const handleAbandon = async (item: Item) => {
  if (!item.blockId) return;
  if (isProcessing.value) return; // 防止重复点击

  isProcessing.value = true;
  try {
    const tag = getStatusTag('abandoned');
    const success = await updateBlockContent(item.blockId, tag);
    if (success && plugin) {
      await projectStore.refresh(plugin, settingsStore.enabledDirectories);
    }
  } finally {
    isProcessing.value = false;
  }
};
```

4. **修改 handleMigrate**
```typescript
const handleMigrate = async (item: Item) => {
  if (!item.blockId) return;
  if (isProcessing.value) return; // 防止重复点击

  isProcessing.value = true;
  try {
    // 计算明天的日期
    const tomorrowStr = dayjs().add(1, 'day').format('YYYY-MM-DD');

    // 构建完整的 siblingItems（包含当前日期）
    const completeSiblingItems = [
      ...(item.siblingItems || []),
      ...(item.date ? [{
        date: item.date,
        startDateTime: item.startDateTime,
        endDateTime: item.endDateTime
      }] : [])
    ];

    // 使用 updateBlockDateTime 更新日期，保留原时间
    const success = await updateBlockDateTime(
      item.blockId,
      tomorrowStr,
      item.startDateTime ? item.startDateTime.split(' ')[1] : undefined,
      item.endDateTime ? item.endDateTime.split(' ')[1] : undefined,
      !item.startDateTime,
      item.date,
      completeSiblingItems,
      item.status
    );

    if (success && plugin) {
      await projectStore.refresh(plugin, settingsStore.enabledDirectories);
    }
  } finally {
    isProcessing.value = false;
  }
};
```

5. **修改 handleMigrateToday**
```typescript
const handleMigrateToday = async (item: Item) => {
  if (!item.blockId) return;
  if (isProcessing.value) return; // 防止重复点击

  isProcessing.value = true;
  try {
    const todayStr = dayjs().format('YYYY-MM-DD');

    // 构建完整的 siblingItems（包含当前日期）
    const completeSiblingItems = [
      ...(item.siblingItems || []),
      ...(item.date ? [{
        date: item.date,
        startDateTime: item.startDateTime,
        endDateTime: item.endDateTime
      }] : [])
    ];

    const success = await updateBlockDateTime(
      item.blockId,
      todayStr,
      item.startDateTime ? item.startDateTime.split(' ')[1] : undefined,
      item.endDateTime ? item.endDateTime.split(' ')[1] : undefined,
      !item.startDateTime,
      item.date,
      completeSiblingItems,
      item.status
    );

    if (success && plugin) {
      await projectStore.refresh(plugin, settingsStore.enabledDirectories);
    }
  } finally {
    isProcessing.value = false;
  }
};
```

6. **修改 handleMigrateCustom**
```typescript
const handleMigrateCustom = (item: Item) => {
  if (!item.blockId) return;
  if (isProcessing.value) return; // 防止重复点击

  // 构建完整的 siblingItems（包含当前日期）
  const completeSiblingItems = [
    ...(item.siblingItems || []),
    ...(item.date ? [{
      date: item.date,
      startDateTime: item.startDateTime,
      endDateTime: item.endDateTime
    }] : [])
  ];

  showDatePickerDialog(t('todo').chooseMigrateDate, item.date, async (newDate) => {
    if (isProcessing.value) return; // 防止在回调中重复点击
    isProcessing.value = true;
    try {
      const success = await updateBlockDateTime(
        item.blockId,
        newDate,
        item.startDateTime ? item.startDateTime.split(' ')[1] : undefined,
        item.endDateTime ? item.endDateTime.split(' ')[1] : undefined,
        !item.startDateTime,
        item.date,
        completeSiblingItems,
        item.status
      );

      if (success && plugin) {
        await projectStore.refresh(plugin, settingsStore.enabledDirectories);
      }
    } finally {
      isProcessing.value = false;
    }
  });
};
```

7. **修改 handleContextMenu**（为右键菜单回调加锁）
```typescript
// 右键菜单处理
const handleContextMenu = (event: MouseEvent, item: Item) => {
  const menuOptions = createItemMenu(
    {
      id: item.id,
      content: item.content,
      date: item.date,
      blockId: item.blockId,
      docId: item.docId,
      lineNumber: item.lineNumber,
      status: item.status,
      task: item.task
    },
    {
      onComplete: () => {
        if (isProcessing.value) return;
        handleDone(item);
      },
      onStartPomodoro: () => {
        if (isProcessing.value) return;
        openPomodoroDialog(item);
      },
      onMigrateToday: () => {
        if (isProcessing.value) return;
        handleMigrateToday(item);
      },
      onMigrateTomorrow: () => {
        if (isProcessing.value) return;
        handleMigrate(item);
      },
      onMigrateCustom: () => {
        if (isProcessing.value) return;
        handleMigrateCustom(item);
      },
      onAbandon: () => {
        if (isProcessing.value) return;
        handleAbandon(item);
      },
      onOpenDoc: () => openItem(item),
      onShowDetail: () => openDetail(item),
      onShowCalendar: () => openCalendar(item)
    },
    { showCalendarMenu: true, isFocusing: pomodoroStore.isFocusing }
  );

  menuOptions.x = event.clientX;
  menuOptions.y = event.clientY;
  showContextMenu(menuOptions);
};
```

---

## 总结

### 需要修改的文件
1. **PomodoroActiveTimer.vue** - 导入 `ref`，添加 `isProcessing` ref，修改 `handleDone` 和 `handleAbandon`
2. **TodoSidebar.vue** - 添加 `isProcessing` ref，修改 `handleDone`、`handleAbandon`、`handleMigrate`、`handleMigrateToday`、`handleMigrateCustom`、`handleContextMenu`

### 不修改的文件
- **contextMenu.ts** - 保持原样，锁逻辑在调用方（TodoSidebar.vue）处理

### 注意事项
- 使用 `try...finally` 确保锁一定会被释放
- 对于异步回调（如 `handleMigrateCustom` 中的 `showDatePickerDialog`），需要在回调内部再次检查锁状态
- 右键菜单的回调函数通过检查 `isProcessing.value` 来防止重复执行
