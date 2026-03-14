# 番茄钟弹框 UI 改进计划

## 任务概述

改进 `PomodoroTimerDialog.vue` 的 UI：
1. 将预选事项信息从简单的文本块改为卡片样式（参考 TodoSidebar.vue 中的 Card 组件样式）
2. 修复弹框高度问题，避免"自定义"输入框与"开始专注"按钮重叠
3. **新增**：将右侧选中事项展示区域抽离为独立 Vue 组件，支持预选模式和非预选模式联动展示

## 具体步骤

### 1. 创建 SelectedItemCard 组件

新建文件 `src/components/pomodoro/SelectedItemCard.vue`：

**Props:**
- `item: Item` - 要展示的事项
- `showHeader?: boolean` - 是否显示 header（项目名称）

**模板结构：**
- 使用 Card 组件包裹
- Header：项目名称（如果有）
- Content：任务名称（如果有）+ 事项内容
- 无 Footer

### 2. 修改 PomodoroTimerDialog.vue

#### 2.1 导入新组件
```typescript
import SelectedItemCard from './SelectedItemCard.vue';
```

#### 2.2 模板修改

**预选模式（hideItemList=true）：**
```vue
<!-- 预选事项信息 -->
<div v-if="hideItemList && selectedItem" class="selected-item-section">
  <SelectedItemCard :item="selectedItem" :show-header="true" />
</div>
```

**非预选模式（hideItemList=false）：**
```vue
<!-- 右侧：选中事项展示 + 专注时长设置 -->
<div class="right-panel" :class="{ 'full-width': hideItemList }">
  <!-- 选中事项展示（联动左侧选择） -->
  <div v-if="selectedItem" class="selected-item-section">
    <SelectedItemCard :item="selectedItem" :show-header="true" />
  </div>
  
  <!-- 原有的计时模式、时长设置等 -->
  ...
</div>
```

### 3. 修复弹框高度问题

当前问题：
- 弹框高度设置为 `height: 'auto'`（见 TodoSidebar.vue L680）
- 在预选模式下，右侧面板内容过多时，"自定义"输入框与"开始专注"按钮重叠

解决方案：
- 调整弹框的最小高度或增加内容区域的间距
- 调整 `.duration-section` 的样式，确保有足够空间
- 增加 `.dialog-body` 的 `min-height` 或调整 `.right-panel` 的样式

### 4. 具体修改内容

#### 4.1 新建 SelectedItemCard.vue

```vue
<template>
  <Card :status="status" :show-header="showHeader && !!item.project" :show-footer="false">
    <template #header>
      <span v-if="item.project" class="item-project">{{ item.project.name }}</span>
    </template>
    <div v-if="item.task" class="item-task">{{ item.task.name }}</div>
    <div class="item-content">{{ item.content }}</div>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Card from '@/components/common/Card.vue';
import type { Item } from '@/types/models';
import dayjs from '@/utils/dayjs';

interface Props {
  item: Item;
  showHeader?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showHeader: true
});

// 根据事项日期确定卡片状态
const status = computed(() => {
  const today = dayjs().format('YYYY-MM-DD');
  if (props.item.date === today) return 'today';
  if (props.item.date < today) return 'expired';
  return 'future';
});
</script>

<style lang="scss" scoped>
.item-project {
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
}

.item-task {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
  margin-bottom: 4px;
}

.item-content {
  font-size: 14px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
  word-break: break-word;
}
</style>
```

#### 4.2 修改 PomodoroTimerDialog.vue

**模板部分：**
- 替换原有的 `preselected-item-info` 为 `SelectedItemCard` 组件
- 在非预选模式下，右侧也展示当前选中的事项

**样式部分：**
- 调整 `.selected-item-section` 样式
- 调整 `.dialog-body` 的 `min-height`
- 调整 `.right-panel` 的间距，确保不重叠

#### 4.3 调整弹框高度（TodoSidebar.vue）

```typescript
const dialog = createDialog({
  title: t('pomodoro').startFocusTitle,
  content: '<div id="pomodoro-timer-dialog-mount"></div>',
  width: '400px',
  height: '480px'  // 从 'auto' 改为固定高度
});
```

## 预期结果

1. 预选模式下的事项信息以卡片形式展示，与 TodoSidebar 中的事项卡片风格一致
2. 非预选模式下，右侧也会展示当前选中的事项，与左侧选择联动
3. 弹框高度足够，"自定义"输入框与"开始专注"按钮之间有足够的间距，不会重叠
4. 选中事项展示逻辑抽离为独立组件，便于维护和复用
