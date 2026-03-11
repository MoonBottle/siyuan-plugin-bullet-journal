# 修复 Asri 主题下卡片变宽问题

## 问题描述
使用 Asri 主题后，PomodoroStatsTab 页面中的"专注详情"卡片（FocusDetailSection）变宽，破坏了网格布局。

## 问题分析

### 根本原因
FocusDetailSection 组件使用了固定宽度的内部元素，而没有使用弹性布局来适应网格单元格：

1. **stats-list 固定宽度**: `.stats-list { width: 280px; }` 设置了固定宽度
2. **缺少自适应属性**: 与其他卡片不同，FocusDetailSection 没有使用 `flex: 1` 或 `width: 100%`
3. **flex-shrink: 0**: 禁止收缩导致布局被撑开

### 对比其他卡片
- FocusRecordsCard: 使用 `flex: 1; overflow: hidden;` 自适应填充
- FocusTrendChart: 无固定宽度，自适应
- FocusDetailSection: 固定宽度 280px + 圆环图 140px + gap 24px = ~444px

## 修复方案

### 文件: `src/components/pomodoro/stats/FocusDetailSection.vue`

#### 修改 1: 为根元素添加自适应样式
```scss
.focus-detail-section {
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}
```

#### 修改 2: 为 detail-content 添加弹性布局
```scss
.detail-content {
  flex: 1;
  min-width: 0;
  justify-content: center; // 或 space-between
}
```

#### 修改 3: 调整 stats-list 宽度
```scss
.stats-list {
  max-width: 280px;  // 改为最大宽度而非固定宽度
  flex: 1;
  // 或者保持 width: 280px 但确保父元素可以正确处理溢出
}
```

## 预期结果
修复后，FocusDetailSection 卡片应该：
1. 与其他卡片保持一致的宽度
2. 在 Asri 主题下正常显示
3. 内容在卡片内部正确布局（居中或自适应）
