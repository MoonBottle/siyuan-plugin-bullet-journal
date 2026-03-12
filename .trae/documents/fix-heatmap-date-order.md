# 修复 AnnualHeatmap 日期排列顺序

## 问题描述
当前热力图的日期排列是**自左往右**排列的，但 GitHub 风格的贡献热力图应该是**自左往下**排列（按列优先）。

## 当前实现分析

### 当前代码逻辑（第 126-149 行）
```typescript
const heatmapCells = computed(() => {
  const { startDate, endDate } = dateRange.value;
  const weekStart = dayjs(startDate).startOf('isoWeek');
  const end = dayjs(endDate);
  const cells: { key: string; date: string; minutes: number; level: string }[] = [];

  for (let c = 0; c < numCols.value; c++) {      // 外层：列循环
    for (let r = 0; r < 7; r++) {                // 内层：行循环
      const d = weekStart.add(c * 7 + r, 'day'); // 计算日期
      // ...
      cells.push({
        key: `${dateStr}`,
        date: dateStr,
        minutes: mins,
        level: getLevel(mins)
      });
    }
  }
  return cells;
});
```

### 当前网格样式（第 27-31 行）
```scss
.heatmap-grid {
  display: grid;
  gap: 1px;
  grid-template-columns: repeat(${numCols}, ${CELL_SIZE}px);  // 列优先
  grid-template-rows: repeat(7, ${CELL_SIZE}px);              // 7行
}
```

### 当前排列方式
- 循环顺序：先列(c)后行(r)
- 日期计算：`weekStart.add(c * 7 + r, 'day')`
- 结果：日期从左到右横向填充

```
当前排列（错误）：
列0    列1    列2
周一   周一   周一
周二   周二   周二
周三   周三   周三
...

期望排列（正确）：
列0    列1    列2
周一   周二   周三
周四   周五   周六
周日   周一   周二
...
```

## 修改方案

### 方案：改为按行优先排列

需要修改 `heatmapCells` 计算逻辑，让日期按行优先填充：

```typescript
const heatmapCells = computed(() => {
  const { startDate, endDate } = dateRange.value;
  const weekStart = dayjs(startDate).startOf('isoWeek');
  const end = dayjs(endDate);
  const cells: { key: string; date: string; minutes: number; level: string }[] = [];

  // 改为按行优先：外层行循环，内层列循环
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < numCols.value; c++) {
      const d = weekStart.add(c * 7 + r, 'day');
      if (d.isAfter(end)) {
        cells.push({ key: `e-${c}-${r}`, date: '', minutes: 0, level: 'level-0' });
        continue;
      }
      const dateStr = d.format('YYYY-MM-DD');
      const mins = focusByDay.value.get(dateStr) ?? 0;
      cells.push({
        key: `${dateStr}`,
        date: dateStr,
        minutes: mins,
        level: getLevel(mins)
      });
    }
  }
  return cells;
});
```

### 需要同时修改的样式

网格布局需要改为 `grid-auto-flow: column` 来支持列优先的视觉展示：

```scss
.heatmap-grid {
  display: grid;
  gap: 1px;
  grid-template-columns: repeat(${numCols}, ${CELL_SIZE}px);
  grid-template-rows: repeat(7, ${CELL_SIZE}px);
  grid-auto-flow: column;  // 新增：让网格按列填充
}
```

## 具体修改代码

### 1. 修改 heatmapCells 计算逻辑
```typescript
const heatmapCells = computed(() => {
  const { startDate, endDate } = dateRange.value;
  const weekStart = dayjs(startDate).startOf('isoWeek');
  const end = dayjs(endDate);
  const cells: { key: string; date: string; minutes: number; level: string }[] = [];

  // 按行优先遍历，但日期计算保持不变
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < numCols.value; c++) {
      const d = weekStart.add(c * 7 + r, 'day');
      if (d.isAfter(end)) {
        cells.push({ key: `e-${c}-${r}`, date: '', minutes: 0, level: 'level-0' });
        continue;
      }
      const dateStr = d.format('YYYY-MM-DD');
      const mins = focusByDay.value.get(dateStr) ?? 0;
      cells.push({
        key: `${dateStr}`,
        date: dateStr,
        minutes: mins,
        level: getLevel(mins)
      });
    }
  }
  return cells;
});
```

### 2. 修改网格样式
```scss
.heatmap-grid {
  display: grid;
  gap: 1px;
  grid-template-columns: repeat(${numCols}, ${CELL_SIZE}px);
  grid-template-rows: repeat(7, ${CELL_SIZE}px);
  grid-auto-flow: column;  // 按列填充
  flex-shrink: 0;
  width: fit-content;
}
```

## 验证步骤
1. 查看热力图，日期应该按列向下排列
2. 同一列内应该是连续的 7 天（一周）
3. 从左到右，列与列之间是连续的一周接一周
4. 鼠标悬停时 tooltip 显示的日期应该符合视觉位置
