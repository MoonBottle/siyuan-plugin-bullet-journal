# Todo 卡片组件化重构计划

## 目标
将项目中分散的卡片 UI 统一封装成一个通用的卡片框架组件，以 `TodoSidebar.vue` 中的卡片样式为准。组件只负责卡片框架（header/content/footer）和整体样式，业务内容通过 slot 填充。

## 现状分析

### 当前代码中存在的卡片类型

1. **TodoSidebar.vue** (第 21-77 行、91-148 行等)
   - 已过期、今日、明日、未来、已完成、已放弃事项的卡片
   - 结构：header(时间/项目) + content(任务名/内容) + footer(操作按钮)
   - **作为新组件的样式基准**
   - **现有功能**：点击打开文档、右键菜单、完成/番茄钟/迁移/放弃/详情/日历按钮

2. **GanttView.vue** (悬浮提示 tooltip)
   - 使用 `buildEventDetailContent` 生成的 HTML 卡片
   - **现有功能**：展示项目/任务/事项信息、点击打开详情弹框、右键菜单

3. **CalendarView.vue** (悬浮提示 tooltip)
   - 同样使用 `buildEventDetailContent` 生成的 HTML 卡片
   - **现有功能**：展示项目/任务/事项信息、点击打开详情弹框、右键菜单

4. **dialog.ts** (弹框中的卡片)
   - 项目卡片、任务卡片、事项卡片
   - **现有功能**：复制按钮、链接、状态标签、时间显示、时长计算、专注时间、底部按钮
   - **特别注意：保持所有现有功能**

5. **PomodoroActiveTimer.vue** (第 63-141 行)
   - 项目卡片、任务卡片、事项卡片
   - **现有功能**：展示项目/任务/事项信息、点击事项卡片打开文档、链接点击

### 各文件现有功能清单（需要全部保留）

#### TodoSidebar.vue 功能清单
- ✅ 点击卡片：打开事项所在文档
- ✅ 右键菜单：完成/番茄钟/迁移/放弃/打开文档/查看详情/查看日历
- ✅ 操作按钮：
  - 完成按钮（标记完成）
  - 番茄钟按钮（打开番茄钟弹框）
  - 迁移按钮（迁移到今天/明天）
  - 放弃按钮（标记放弃）
  - 详情按钮（查看详情弹框）
  - 日历按钮（打开日历）
- ✅ 状态样式：已完成/已放弃/已过期/今天/明天/未来的不同边框颜色
- ✅ 悬停效果：显示操作按钮

#### GanttView.vue 功能清单
- ✅ 悬浮 tooltip：展示项目/任务/事项详情
- ✅ 点击任务条：打开详情弹框
- ✅ 右键菜单：完成/番茄钟/迁移/放弃/打开文档/查看详情

#### CalendarView.vue 功能清单
- ✅ 悬浮 tooltip：展示项目/任务/事项详情
- ✅ 点击事件：打开详情弹框
- ✅ 右键菜单：完成/番茄钟/迁移/放弃/打开文档/查看详情
- ✅ 拖拽事件：调整时间
- ✅ 调整大小：调整时长

#### dialog.ts 功能清单
- ✅ 项目卡片：标题、名称、复制按钮、链接
- ✅ 任务卡片：标题、层级标签（L1/L2/L3）、名称、复制按钮、链接
- ✅ 事项卡片：标题、状态标签、📅日期时间、🍅专注时间、⏱️时长、内容、复制按钮、链接
- ✅ 底部按钮：取消、查看日历、打开文档
- ✅ 复制功能：点击复制到剪贴板，2秒后恢复图标
- ✅ 链接点击：打开外部链接
- ✅ 链接 tooltip：hover 显示完整链接名称

#### PomodoroActiveTimer.vue 功能清单
- ✅ 项目卡片：标题、名称、链接
- ✅ 任务卡片：标题、层级标签、名称、链接
- ✅ 事项卡片：标题、内容、点击打开文档
- ✅ 链接点击：打开外部链接
- ✅ 链接 tooltip：hover 显示完整链接名称

### 统一后的卡片框架设计

以 TodoSidebar.vue 的 `.todo-item` 样式为基础，提取出通用的卡片框架：

```
+-----------------------------+
|  Card Container             |
|  (边框、背景、圆角、hover效果) |
+-----------------------------+
|  Header Slot (可选)         |
|  - 标题、状态标签等          |
+-----------------------------+
|  Content Slot               |
|  - 内容、元数据等            |
+-----------------------------+
|  Footer Slot (可选)         |
|  - 链接、操作按钮等          |
+-----------------------------+
```

## 重构方案

### 创建通用的 Card 组件

**文件路径**: `src/components/common/Card.vue`

**设计原则**:
- 只负责卡片框架和基础样式
- 内容通过 slot 填充
- 支持不同的状态样式（过期/今天/明天/已完成/已放弃等）

**Props 设计**:
```typescript
interface CardProps {
  // 状态样式
  status?: 'expired' | 'today' | 'tomorrow' | 'future' | 'completed' | 'abandoned' | 'pending';
  
  // 显示控制
  showHeader?: boolean;                  // 是否显示 header 区域
  showFooter?: boolean;                  // 是否显示 footer 区域
  
  // 交互配置
  clickable?: boolean;                   // 是否可点击
  hoverEffect?: boolean;                 // 是否有悬停效果
}
```

**Slots 设计**:
```typescript
interface CardSlots {
  header?: Slot;                         // 头部内容
  default?: Slot;                        // 主要内容（content）
  footer?: Slot;                         // 底部内容
}
```

**Emits 设计**:
```typescript
interface CardEmits {
  click: (event: MouseEvent) => void;    // 点击卡片
  contextmenu: (event: MouseEvent) => void; // 右键菜单
}
```

### 组件结构

```vue
<template>
  <div 
    class="card" 
    :class="cardClasses"
    @click="handleClick"
    @contextmenu.prevent="handleContextMenu"
  >
    <!-- Header Slot -->
    <div v-if="showHeader" class="card-header">
      <slot name="header"></slot>
    </div>
    
    <!-- Content Slot -->
    <div class="card-content">
      <slot></slot>
    </div>
    
    <!-- Footer Slot -->
    <div v-if="showFooter" class="card-footer">
      <slot name="footer"></slot>
    </div>
  </div>
</template>
```

### 样式规范（基于 TodoSidebar.vue）

```scss
.card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  background: var(--b3-theme-background);
  border-radius: var(--b3-border-radius);
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid var(--b3-border-color);

  &:hover {
    background: var(--b3-theme-surface);
    border-color: var(--b3-theme-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  // 状态样式
  &.status-completed { border-left: 3px solid var(--b3-theme-success); }
  &.status-abandoned { border-left: 3px solid var(--b3-theme-on-surface); }
  &.status-expired { border-left: 3px solid #f44336; }
  &.status-today,
  &.status-tomorrow,
  &.status-future { border-left: 3px solid var(--b3-theme-primary); }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  margin: -8px -12px 0 -12px;
  padding: 6px 12px;
  font-size: 12px;
  background: var(--b3-theme-surface-lighter);
  border-bottom: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius) var(--b3-border-radius) 0 0;
}

.card-content {
  width: 100%;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
  margin-top: 4px;
  border-top: 1px solid var(--b3-border-color);
}
```

## 各文件修改计划

### 1. TodoSidebar.vue
- 使用 Card 组件替换所有 todo-item
- 将业务内容放入对应的 slot 中
- **保持所有现有功能**：点击打开文档、右键菜单、所有操作按钮、状态样式

### 2. PomodoroActiveTimer.vue
- 使用 Card 组件替换项目/任务/事项卡片
- 通过 slot 填充内容
- **保持所有现有功能**：链接点击、tooltip、点击事项打开文档

### 3. dialog.ts
- 创建 `ItemDetailDialog.vue` 组件
- 使用 Card 组件构建弹框内容
- **保持所有现有功能**：
  - 复制按钮功能（点击复制，2秒恢复）
  - 链接点击和 tooltip
  - 状态标签样式
  - 时间、时长、专注时间显示
  - 底部操作按钮（取消、查看日历、打开文档）

### 4. GanttView.vue
- 修改 tooltip 实现，使用 Vue 组件挂载
- 使用 Card 组件展示详情
- **保持所有现有功能**：悬浮显示、点击打开详情、右键菜单

### 5. CalendarView.vue
- 修改 tooltip 实现，使用 Vue 组件挂载
- 使用 Card 组件展示详情
- **保持所有现有功能**：悬浮显示、点击打开详情、右键菜单、拖拽调整、调整大小

## 实施步骤

### Step 1: 创建 Card 组件
- 创建 `src/components/common/Card.vue`
- 实现 Props 和 Slots 接口
- 迁移 TodoSidebar.vue 中的 `.todo-item` 样式作为基础样式

### Step 2: 重构 TodoSidebar.vue
- 导入 Card 组件
- 使用 Card 组件替换所有 todo-item
- 将业务内容放入对应的 slot 中
- **验证所有功能**：点击、右键菜单、操作按钮、状态样式
- 删除迁移到组件中的样式

### Step 3: 重构 PomodoroActiveTimer.vue
- 使用 Card 组件替换项目/任务/事项卡片
- 通过 slot 填充内容
- **验证所有功能**：链接点击、tooltip、点击事项打开文档

### Step 4: 重构 dialog.ts
- 创建 `ItemDetailDialog.vue` 组件
- 使用 Card 组件构建弹框内容
- **验证所有功能**：
  - 复制按钮是否正常
  - 链接是否可以点击和显示 tooltip
  - 状态标签是否正确显示
  - 时间、时长、专注时间是否正确
  - 底部按钮是否正常

### Step 5: 重构 GanttView.vue
- 修改 tooltip 实现，使用 Vue 组件挂载
- 使用 Card 组件展示详情
- **验证所有功能**：悬浮显示、点击打开详情、右键菜单

### Step 6: 重构 CalendarView.vue
- 修改 tooltip 实现，使用 Vue 组件挂载
- 使用 Card 组件展示详情
- **验证所有功能**：悬浮显示、点击打开详情、右键菜单、拖拽调整、调整大小

### Step 7: 最终验证
- 确保所有功能正常工作
- 检查样式一致性
- 确保没有功能遗漏

## 文件变更清单

### 新增文件
1. `src/components/common/Card.vue` - 通用卡片框架组件
2. `src/components/dialog/ItemDetailDialog.vue` - 事项详情弹框组件

### 修改文件
1. `src/components/todo/TodoSidebar.vue` - 使用 Card 组件
2. `src/components/gantt/GanttView.vue` - tooltip 使用 Card
3. `src/components/calendar/CalendarView.vue` - tooltip 使用 Card
4. `src/utils/dialog.ts` - 使用 ItemDetailDialog 组件
5. `src/components/pomodoro/PomodoroActiveTimer.vue` - 使用 Card 组件

## 风险与注意事项

### 功能保持检查清单
- [ ] TodoSidebar.vue：点击打开文档
- [ ] TodoSidebar.vue：右键菜单
- [ ] TodoSidebar.vue：所有操作按钮（完成/番茄钟/迁移/放弃/详情/日历）
- [ ] TodoSidebar.vue：状态样式
- [ ] GanttView.vue：悬浮 tooltip
- [ ] GanttView.vue：点击打开详情
- [ ] GanttView.vue：右键菜单
- [ ] CalendarView.vue：悬浮 tooltip
- [ ] CalendarView.vue：点击打开详情
- [ ] CalendarView.vue：右键菜单
- [ ] CalendarView.vue：拖拽调整
- [ ] CalendarView.vue：调整大小
- [ ] dialog.ts：复制按钮
- [ ] dialog.ts：链接点击
- [ ] dialog.ts：链接 tooltip
- [ ] dialog.ts：状态标签
- [ ] dialog.ts：时间/时长/专注时间显示
- [ ] dialog.ts：底部按钮
- [ ] PomodoroActiveTimer.vue：链接点击
- [ ] PomodoroActiveTimer.vue：链接 tooltip
- [ ] PomodoroActiveTimer.vue：点击事项打开文档

### 样式兼容性
- Card 组件的样式需要与思源主题变量兼容
- 不同状态的边框颜色需要保持一致

## 预期收益

1. **代码复用**: 消除多处重复的卡片框架代码
2. **一致性**: 所有卡片 UI 框架统一以 TodoSidebar 为准
3. **可维护性**: 修改卡片框架样式只需修改一处
4. **灵活性**: 通过 slot 机制，业务组件可自由填充内容
5. **可测试性**: 独立的组件更容易单元测试
