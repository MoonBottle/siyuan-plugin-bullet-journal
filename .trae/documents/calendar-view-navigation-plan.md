# 日历视图双击进入日视图后操作问题 - 实现计划

## 问题描述 (Issue #6)

在【日历视图】的月/周视图下，双击特定日期可以进入日视图，此时：

1. **左上角视图标题（如：2026年3月）未更新**，仍显示某月/周
2. **右上角视图分类（如：月）未更新**，仍显示月/周
3. **缺少返回按钮可以退回上一级月/周视图**，因为第2点问题，需要进行2次切换才能回到原视图

## 推荐解决方案

不更新视图分类选项，增加一个**重置/返回按钮**，回到设置的视图。

## 实现步骤

### 1. 修改 CalendarView.vue

在 `CalendarView.vue` 中，当点击日期切换到日视图时，需要通知父组件更新标题：

- 修改 `dateClick` 回调函数，在切换视图后触发 `navigated` 事件
- 确保标题能够正确更新

### 2. 修改 CalendarTab.vue

在 `CalendarTab.vue` 中实现以下功能：

#### 2.1 记录上一个视图状态
- 添加 `previousView` 变量记录切换前的视图类型
- 添加 `isDayViewFromClick` 标记用于区分是用户手动切换视图还是双击日期进入日视图

#### 2.2 监听视图变化
- 监听 `currentView` 的变化，当从非日视图切换到日视图时，记录上一个视图

#### 2.3 添加返回按钮
- 在工具栏添加返回按钮（只在双击进入日视图时显示）
- 点击返回按钮时，恢复到之前的视图

#### 2.4 更新标题逻辑
- 确保双击日期进入日视图后，标题能够正确更新为日期格式（如：2026年3月9日）

### 3. 添加 i18n 翻译

在 `zh_CN.json` 和 `en_US.json` 中添加返回按钮的翻译：
- `calendarNav.back`: "返回"
- `calendarNav.resetView`: "返回原视图"

## 具体代码修改

### CalendarView.vue
```typescript
// dateClick 回调中，切换视图后触发 navigated 事件
dateClick: (info) => {
  if (calendarInstance) {
    calendarInstance.changeView('timeGridDay');
    calendarInstance.gotoDate(info.dateStr);
    // 触发 navigated 事件，通知父组件更新标题
    emit('navigated');
  }
}
```

### CalendarTab.vue
```typescript
// 添加状态变量
const previousView = ref('');
const isDayViewFromClick = ref(false);

// 监听视图切换
watch(currentView, (newView, oldView) => {
  calendarRef.value?.changeView(newView);
  // 如果是从非日视图切换到日视图，记录上一个视图
  if (newView === 'timeGridDay' && oldView && oldView !== 'timeGridDay') {
    previousView.value = oldView;
    isDayViewFromClick.value = true;
  }
  updateTitle();
});

// 返回按钮处理
const handleBack = () => {
  if (previousView.value) {
    currentView.value = previousView.value;
    isDayViewFromClick.value = false;
  }
};
```

### 模板修改
```vue
<!-- 返回按钮 -->
<span 
  v-if="isDayViewFromClick && previousView" 
  class="block__icon b3-tooltips b3-tooltips__se" 
  :aria-label="t('calendarNav').back" 
  @click="handleBack"
>
  <svg><use xlink:href="#iconUndo"></use></svg>
</span>
```

## 验证清单

- [ ] 双击月/周视图的日期进入日视图后，标题正确更新为日期格式
- [ ] 双击进入日视图后，显示返回按钮
- [ ] 点击返回按钮，恢复到之前的月/周视图
- [ ] 返回后标题正确更新
- [ ] 手动切换视图（通过下拉选择）不显示返回按钮
- [ ] 多语言翻译正常工作
