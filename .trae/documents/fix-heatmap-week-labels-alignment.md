# 修复 AnnualHeatmap 周标签对齐问题

## 问题描述

`heatmap-week-labels` 的高度需要整体调小一点，往下移动，使其与方格的 一、三、五行对齐。

## 当前样式分析

### 相关 CSS（第 292-306 行）

```scss
.heatmap-week-labels {
  display: flex;
  flex-direction: column;
  justify-content: space-around;  // 问题：均匀分布导致对齐不准
  padding-right: 4px;
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  flex-shrink: 0;
  width: 14px;
}

.week-label {
  height: 10px;  // 问题：与 CELL_SIZE (12px) 不一致
  line-height: 10px;
}
```

### 方格配置

* CELL\_SIZE = 12px

* 方格是 7 行（一周 7 天）

* 标签显示：一、三、五（第 0、2、4 行）

## 修改方案

### 1. 调整 `.heatmap-week-labels`

* 将 `justify-content: space-around` 改为 `justify-content: flex-start`

* 添加 `gap: 2px` 或调整 padding 来控制间距

* 添加 `margin-top: 1px` 使整体往下偏移对齐

### 2. 调整 `.week-label`

* 将 `height` 和 `line-height` 从 10px 改为 12px（与 CELL\_SIZE 一致）

### 3. 预期效果

* 每个标签占据 12px 高度，与方格大小一致

* 通过 margin-top 微调使标签与方格垂直居中对齐

## 具体修改代码

```scss
.heatmap-week-labels {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  padding-right: 4px;
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  flex-shrink: 0;
  width: 14px;
  margin-top: 1px;  // 新增：整体往下偏移
}

.week-label {
  height: 12px;  // 修改：与 CELL_SIZE 一致
  line-height: 12px;  // 修改：与 height 一致
}
```

## 验证步骤

1. 修改后查看热力图左侧标签是否与方格对齐
2. "一"标签应对齐第一行方格
3. "三"标签应对齐第三行方格
4. "五"标签应对

