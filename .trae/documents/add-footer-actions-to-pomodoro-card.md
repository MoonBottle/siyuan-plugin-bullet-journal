# 计划：为 PomodoroActiveTimer 的事项卡片添加底部操作区域

## 目标
为 `PomodoroActiveTimer.vue` 中的事项卡片（L114-138）添加底部操作区域，与 `TodoSidebar.vue` 中的 Card 组件保持一致的风格。

## 当前状态分析

### TodoSidebar.vue 中的 Card footer 结构：
```vue
<template #footer>
  <div class="item-actions-hover">
    <!-- 悬停显示的操作按钮 -->
    <span class="block__icon b3-tooltips b3-tooltips__sw" :aria-label="t('todo').complete" @click.stop="handleDone(item)">
      <svg><use xlink:href="#iconCheck"></use></svg>
    </span>
    <!-- 其他操作按钮... -->
  </div>
  <div class="item-actions-fixed">
    <!-- 固定显示的操作按钮 -->
    <span class="block__icon b3-tooltips b3-tooltips__sw" :aria-label="t('todo').detail" @click.stop="openDetail(item)">
      <svg><use xlink:href="#iconInfo"></use></svg>
    </span>
    <!-- 其他固定按钮... -->
  </div>
</template>
```

### PomodoroActiveTimer.vue 当前的事项卡片 footer：
```vue
<template #footer>
  <SyButton
    v-for="link in currentItem?.links || []"
    :key="link.url"
    type="link"
    :text="link.name"
    :href="link.url"
  />
</template>
```

## 实施步骤

### 步骤 1：修改模板部分
在 `PomodoroActiveTimer.vue` 的事项卡片 footer 中，保留原有的链接按钮，同时添加操作按钮区域：

1. 将 footer 内容包裹在一个容器中
2. 添加 `item-actions` 区域包含操作按钮
3. 操作按钮包括：
   - 完成事项（check 图标）
   - 详情（info 图标）
   - 日历（calendar 图标）

### 步骤 2：添加处理函数
在 `<script setup>` 中添加以下函数：
1. `handleDone()` - 标记事项为已完成
2. `openDetail()` - 打开事项详情
3. `openCalendar()` - 在日历中打开事项

### 步骤 3：添加样式
在 `<style>` 部分添加与 `TodoSidebar.vue` 类似的样式：
1. `.item-actions` - 操作按钮容器
2. `.item-actions-hover` - 悬停显示的操作按钮
3. `.item-actions-fixed` - 固定显示的操作按钮
4. `.block__icon` 样式

### 步骤 4：导入必要的依赖
添加以下导入：
1. `updateBlockContent` 从 `@/utils/fileUtils`
2. `showItemDetailModal` 从 `@/utils/dialog`
3. `TAB_TYPES` 从 `@/constants`
4. `useSettingsStore` 从 `@/stores`

## 具体修改内容

#### 1. 模板修改（L129-137）
将：
```vue
<template #footer>
  <SyButton
    v-for="link in currentItem?.links || []"
    :key="link.url"
    type="link"
    :text="link.name"
    :href="link.url"
  />
</template>
```

修改为：
```vue
<template #footer>
  <div class="item-footer-content">
    <div class="item-links" v-if="currentItem?.links?.length > 0">
      <SyButton
        v-for="link in currentItem.links"
        :key="link.url"
        type="link"
        :text="link.name"
        :href="link.url"
      />
    </div>
    <div class="item-actions">
      <div class="item-actions-hover">
        <span
          class="block__icon b3-tooltips b3-tooltips__sw"
          :aria-label="t('todo').complete"
          @click.stop="handleDone"
        >
          <svg><use xlink:href="#iconCheck"></use></svg>
        </span>
      </div>
      <div class="item-actions-fixed">
        <span
          class="block__icon b3-tooltips b3-tooltips__sw"
          :aria-label="t('todo').detail"
          @click.stop="openDetail"
        >
          <svg><use xlink:href="#iconInfo"></use></svg>
        </span>
        <span
          class="block__icon b3-tooltips b3-tooltips__sw"
          :aria-label="t('todo').calendar"
          @click.stop="openCalendar"
        >
          <svg><use xlink:href="#iconCalendar"></use></svg>
        </span>
      </div>
    </div>
  </div>
</template>
```

#### 2. Script 修改
添加导入：
```typescript
import { updateBlockContent, openDocumentAtLine } from '@/utils/fileUtils';
import { showConfirmDialog, hideLinkTooltip, showItemDetailModal } from '@/utils/dialog';
import { TAB_TYPES } from '@/constants';
import { useSettingsStore } from '@/stores';
```

添加 store：
```typescript
const settingsStore = useSettingsStore();
```

添加处理函数：
```typescript
// 获取状态标签
const getStatusTag = (status: 'completed' | 'abandoned'): string => {
  return t('statusTag')[status] || '';
};

// 标记完成
const handleDone = async () => {
  if (!currentItem.value?.blockId) return;
  
  const tag = getStatusTag('completed');
  const success = await updateBlockContent(currentItem.value.blockId, tag);
  if (success && plugin) {
    await projectStore.refresh(plugin, settingsStore.enabledDirectories);
  }
};

// 打开详情
const openDetail = () => {
  if (!currentItem.value) return;
  showItemDetailModal(currentItem.value);
};

// 在日历中打开
const openCalendar = () => {
  if (!currentItem.value?.date) return;
  if (plugin && plugin.openCustomTab) {
    plugin.openCustomTab(TAB_TYPES.CALENDAR, { initialDate: currentItem.value.date });
  }
};
```

#### 3. 样式添加
在 `<style>` 部分添加：
```scss
.item-footer-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.item-links {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.item-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.item-actions-hover {
  display: flex;
  gap: 4px;

  .block__icon {
    opacity: 1;
    cursor: pointer;

    svg {
      width: 14px;
      height: 14px;
    }
  }
}

.item-actions-fixed {
  display: flex;
  gap: 4px;

  .block__icon {
    opacity: 1;
    cursor: pointer;

    svg {
      width: 14px;
      height: 14px;
    }
  }
}
```

## 验证清单
- [ ] 事项卡片底部显示操作按钮
- [ ] 点击完成按钮可以标记事项为已完成
- [ ] 点击详情按钮可以打开事项详情弹窗
- [ ] 点击日历按钮可以在日历中打开事项日期
- [ ] 样式与 TodoSidebar.vue 保持一致
