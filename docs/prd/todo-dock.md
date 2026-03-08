# 待办 Dock 功能

## 一、功能概述

待办 Dock 是侧边栏组件，展示即将到来的待办事项，帮助用户快速查看今日及未来的工作安排。

## 二、需求规格

### 2.1 分组展示

| 分组 | 描述 | 显示条件 |
|------|------|----------|
| 已过期 | 日期已过但未完成未放弃的事项 | 有过期事项时显示 |
| 今天 | 今天的事项 | 始终显示 |
| 明天 | 明天的事项 | 有明天事项时显示 |
| 未来 | 明天之后的事项 | 有未来事项时显示 |
| 已完成 | 已完成的事项 | 可配置显示/隐藏 |
| 已放弃 | 已放弃的事项 | 可配置显示/隐藏 |

### 2.2 功能需求

#### 2.2.1 事项展示

- [x] 按日期分组展示事项
- [x] 显示事项内容和状态
- [x] 显示所属项目名称
- [x] 显示事项时间（如有）

#### 2.2.2 事项操作

- [x] 右键菜单：完成、迁移、放弃、详情、日历
- [x] Hover 操作按钮：同上
- [x] 点击事项跳转到笔记
- [x] 分组筛选支持

#### 2.2.3 显示控制

- [x] 隐藏/显示已完成事项
- [x] 隐藏/显示已放弃事项
- [x] 设置持久化

### 2.3 验收标准

- [x] 正确按日期分组事项
- [x] 过期事项正确识别
- [x] 状态 emoji 正确显示
- [x] 右键菜单功能正常
- [x] Hover 按钮功能正常
- [x] 点击正确跳转
- [x] 设置正确保存

## 三、技术实现

### 3.1 数据模型

```typescript
// 待办状态
interface TodoDockSettings {
  hideCompleted: boolean;
  hideAbandoned: boolean;
}

// 分组事项
interface GroupedItems {
  expired: Item[];      // 已过期
  today: Item[];        // 今天
  tomorrow: Item[];     // 明天
  future: Item[];       // 未来
  completed: Item[];    // 已完成
  abandoned: Item[];    // 已放弃
}
```

### 3.2 分组逻辑

```typescript
// ProjectStore Getters
getExpiredItems: (state) => (groupId: string) => {
  return items.filter(item =>
    item.date < state.currentDate &&
    item.status !== 'completed' &&
    item.status !== 'abandoned'
  );
}

getFutureItems: (state) => (groupId: string) => {
  return items.filter(item =>
    item.date >= state.currentDate &&
    item.status !== 'completed' &&
    item.status !== 'abandoned'
  );
}
```

### 3.3 右键菜单

```typescript
// 可用操作
interface ContextMenuAction {
  complete: () => void;   // 标记为完成
  migrate: () => void;    // 迁移日期
  abandon: () => void;    // 标记为放弃
  detail: () => void;     // 查看详情
  calendar: () => void;   // 在日历中打开
}

// 按状态显示不同菜单
- 待办事项（过期/今天/明天/未来）: 完成、迁移、放弃、详情、日历
- 已完成/已放弃: 详情、日历
```

### 3.4 文件结构

```
src/
├── tabs/
│   └── TodoDock.vue           # Dock 主组件
├── components/
│   └── todo/
│       └── TodoSidebar.vue    # 待办侧边栏内容
└── utils/
    └── contextMenu.ts         # 右键菜单
```

## 四、UI 设计

### 4.1 布局

```
┌─────────────────────────────┐
│  待办事项          [设置图标] │
├─────────────────────────────┤
│ 📅 今天 (3)                 │
│ ☐ 事项A              [项目A]│
│ ☐ 事项B              [项目B]│
│ ☑ 事项C              [项目C]│
├─────────────────────────────┤
│ 📅 明天 (2)                 │
│ ☐ 事项D              [项目A]│
│ ☐ 事项E              [项目B]│
├─────────────────────────────┤
│ ⚠️ 已过期 (1)               │
│ ☐ 事项F              [项目C]│
└─────────────────────────────┘
```

### 4.2 状态图标

| 状态 | 图标 |
|------|------|
| 待办 | ☐ |
| 已完成 | ☑ |
| 已放弃 | 🚫 |

### 4.3 交互设计

- **Hover 效果**: 显示操作按钮（完成、迁移、放弃、详情、日历）
- **右键菜单**: 同上操作
- **点击**: 跳转到笔记对应位置

## 五、操作功能详解

### 5.1 完成事项

- 在事项后添加 `#done` 或 `#已完成` 标记
- 事项移动到「已完成」分组
- 触发数据刷新

### 5.2 迁移事项

- 弹出日期选择对话框
- 修改事项日期
- 更新笔记内容
- 触发数据刷新

### 5.3 放弃事项

- 在事项后添加 `#abandoned` 或 `#已放弃` 标记
- 事项移动到「已放弃」分组
- 触发数据刷新

### 5.4 查看详情

- 弹出事项详情对话框
- 显示完整信息：内容、日期、时间、状态、链接
- 支持复制信息

### 5.5 在日历中打开

- 打开日历视图 Tab
- 自动跳转到事项所在日期
- 高亮显示该事项

## 六、设置选项

### 6.1 显示设置

```typescript
// 设置存储
interface TodoDockSettings {
  hideCompleted: boolean;  // 隐藏已完成
  hideAbandoned: boolean;  // 隐藏已放弃
}

// 默认设置
const defaultSettings = {
  hideCompleted: false,
  hideAbandoned: false
};
```

### 6.2 设置持久化

- 设置保存到插件数据
- 重启后恢复设置
- 多 Tab 同步

## 七、性能优化

### 7.1 虚拟滚动

- 大量事项时使用虚拟滚动
- 只渲染可视区域事项

### 7.2 懒加载

- 初始只加载必要数据
- 展开分组时动态加载

### 7.3 缓存

- 事项数据缓存
- 避免重复解析
