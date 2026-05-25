## Project 视图中间栏事项合并设计

### 背景

解析器将同一个 block 的事项按日期拆分为多个 `Item`（共享同一 `blockId`）。Gantt 视图已通过 `dataConverter.ts` 的 `blockId` 分组 + `mergeItemsToSegments` 实现了合并显示。但 Project 视图的中间栏树中，同一 `blockId` 的多个 Item 仍显示为多行，造成冗余。

### 需求

1. 中间栏树中，同一 `blockId` 的多个 Item 合并为一行显示
2. 合并后日期用范围格式显示，相同部分省略：同年同月 `2026-05-20 ~ 23`、同年不同月 `2026-05-20 ~ 06-03`、不同年 `2025-12-28 ~ 2026-01-03`
3. 右栏详情面板自动展示全部日期（利用已有 `siblingItems` + `showAllDates` 机制）
4. 状态圆点直接取第一个 Item 的状态（同一 block 状态一致）

### 设计

#### 1. 数据层：`projectTaskTree.ts` 新增合并逻辑

**新增类型 `MergedItem`：**

```typescript
export interface MergedItem {
  isMerged: true;
  blockId: string;
  items: Item[];
  content: string;
  status: Item['status'];
  priority?: string;
  dateRange: string; // 智能省略：同年同月 "2026-05-20 ~ 23"，同年不同月 "2026-05-20 ~ 06-03"，不同年 "2025-12-28 ~ 2026-01-03"
  firstItemId: string; // 用于 select-item 事件
}
```

**修改 `ProjectTaskTreeNode.items` 类型**为 `Item[]` → `(Item | MergedItem)[]`。

**新增 `mergeItemsByBlockId` 函数**，在 `buildProjectTaskTree` 中替代直接赋值 `task.items`：

- 按 `blockId`（回退 `item.id`）分组
- 单个 Item 的组：保留原始 `Item`
- 多个 Item 的组：按日期排序后创建 `MergedItem`
  - `dateRange` 由新增 `formatDateRange` 函数生成，省略与起始日期相同的年份和月份部分：同年同月 → `2026-05-20 ~ 23`，同年不同月 → `2026-05-20 ~ 06-03`，不同年 → `2025-12-28 ~ 2026-01-03`
  - `content` / `status` / `priority` 取第一个 Item 的值
  - `firstItemId` 取第一个 Item 的 `id`

#### 2. 搜索/过滤适配

- `itemMatchesQuery` 需要处理 `MergedItem`：对合并 Item 匹配其 `dateRange`、`content` 和所有子 Item 的日期
- `filterNode` 中 `matchedItems` 过滤逻辑需要适配
- `matchedItemIds` 在合并 Item 匹配时，将 `firstItemId` 加入集合

#### 3. 进度统计适配

- `getTaskItemProgress` 需要识别 `MergedItem`：合并 Item 计为 1 个（而非 N 个），状态取 `MergedItem.status`

#### 4. 渲染层：`ProjectTreeNode.vue`

- Item 的 `v-for` 遍历 `(Item | MergedItem)[]`
- 判断 `isMerged`：
  - 普通Item：保持现有渲染逻辑不变
  - 合并Item：`key` 用 `blockId`，meta 显示 `dateRange`，content / status 从合并对象取
- 点击合并 Item 时 `emit('select-item', mergedItem.firstItemId)`

#### 5. 右栏详情：`ProjectDetailPane.vue`

- `:show-all-dates="false"` 改为 `:show-all-dates="hasSiblingItems"`
- `hasSiblingItems` computed = `item?.siblingItems?.length > 0`
- 利用 `ItemDetailContent` 已有的多日期展示能力，无需修改该组件

#### 6. 键盘导航适配

- `ProjectTreePane` 的 `visibleNodes` 扁平化列表已经包含 items，合并后 Item 数量减少，导航自然生效
- 需确认 `visibleNodes` 构建逻辑能处理 `MergedItem` 类型

### 不变的部分

- 树的三级结构（L1 → L2 → L3）
- 展开/折叠逻辑
- Gantt 视图的合并逻辑（各自独立）
- Item 模型本身（不新增字段）
- 解析器（不修改）

### 影响范围

| 文件 | 改动 |
|------|------|
| `src/utils/projectTaskTree.ts` | 新增 `MergedItem` 类型、`mergeItemsByBlockId` 函数；修改 `buildProjectTaskTree`、`getTaskItemProgress`、`filterNode` |
| `src/components/project/ProjectTreeNode.vue` | 适配 `MergedItem` 渲染 |
| `src/components/project/ProjectDetailPane.vue` | 动态计算 `showAllDates` |
| `src/components/project/ProjectTreePane.vue` | 键盘导航适配 |
| `src/components/project/ProjectView.vue` | 无改动（`findItemById` 通过 `firstItemId` 找到原始 Item，siblingItems 已由解析器填充） |
