# SyButton.vue 修复计划

## 问题分析

### 问题 1: Tooltip 被遮挡

**现象**: 从截图可以看到，tooltip 显示在按钮的上方时，左侧有一部分被截断了。

**原因分析**:
1. 在 `src/utils/dialog.ts` 中，`showLinkTooltip` 和 `showIconTooltip` 函数将 tooltip 挂载到 body，使用 `position: fixed` 定位
2. 当前 tooltip 的位置计算逻辑：
   ```typescript
   const left = rect.left + rect.width / 2;
   tip.style.left = `${left}px`;
   tip.style.top = `${rect.top - 4}px`;
   tip.style.transform = 'translate(-50%, -100%)';
   ```
3. 虽然代码中有边界检测逻辑，但只检测了左右边界是否超出视口，没有考虑 tooltip 被其他元素遮挡的情况
4. 在 `src/index.scss` 中，tooltip 的 z-index 设置为 `2147483647`，理论上应该在最上层

**根本原因**: 从截图看，tooltip 左侧被截断，可能是由于：
- 按钮靠近弹框左边缘，tooltip 向左偏移后被弹框或父容器裁剪
- `translate(-50%, -100%)` 使 tooltip 向左偏移了自身宽度的一半，如果按钮靠近左边缘，tooltip 会超出父容器

### 问题 2: Hover 样式看不清

**现象**: 链接按钮的 hover 效果在深色主题下看不清。

**当前样式** (`src/components/SiyuanTheme/SyButton.vue` 第 151-171 行):
```scss
.sy-link-btn {
  color: var(--b3-theme-primary);
  background: var(--b3-theme-surface-lighter);
  
  &:hover {
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    z-index: 1;
  }
}
```

**问题分析**:
- 当前 hover 样式将背景色改为主色，文字改为 on-primary
- 但在某些思源主题（特别是深色主题）中，这种对比度可能不够明显
- 应该使用思源主题提供的 hover 专用变量

**思源主题可用变量**:
- `--b3-theme-primary-light`: 主色浅色版（适合 hover 背景）
- `--b3-theme-primary-lightest`: 主色最浅色版
- `--b3-theme-surface`: 表面色
- `--b3-theme-surface-light`: 表面色浅色版（适合 hover）

## 修复方案

### 修复 1: Tooltip 位置优化

**文件**: `src/utils/dialog.ts`

**修改内容**:
在 `showLinkTooltip` 和 `showIconTooltip` 函数中，优化 tooltip 的位置计算逻辑：

1. 保持现有的边界检测逻辑
2. 确保 tooltip 不会被弹框或其他容器裁剪（由于 tooltip 已经挂载到 body 并使用 fixed 定位，理论上不会被裁剪）
3. 如果问题仍然存在，考虑调整 tooltip 的显示位置（比如改为显示在按钮下方）

**具体修改**:
- 检查 tooltip 的 `left` 值是否小于 0，如果是，将其设置为 `tipRect.width / 2 + margin`
- 确保 tooltip 不会超出视口右边界

### 修复 2: Hover 样式优化

**文件**: `src/components/SiyuanTheme/SyButton.vue`

**修改内容**:
将链接按钮的 hover 样式从：
```scss
&:hover {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  z-index: 1;
}
```

改为使用思源主题的 hover 专用变量：
```scss
&:hover {
  background: var(--b3-theme-primary-light);
  color: var(--b3-theme-primary);
  z-index: 1;
}
```

或者使用表面色的 hover 样式：
```scss
&:hover {
  background: var(--b3-theme-surface-light);
  color: var(--b3-theme-primary);
  z-index: 1;
}
```

**推荐方案**: 使用 `--b3-theme-primary-light` 作为 hover 背景，这样既能体现主色，又不会过于突兀。

## 实施步骤

1. **修改 `src/utils/dialog.ts`**:
   - 优化 `showLinkTooltip` 和 `showIconTooltip` 函数中的 tooltip 位置计算
   - 确保 tooltip 不会超出视口边界

2. **修改 `src/components/SiyuanTheme/SyButton.vue`**:
   - 更新 `.sy-link-btn:hover` 的样式，使用思源主题变量

## 验证方法

1. 打开事项详情弹框
2. 将鼠标悬停在链接按钮上，检查 tooltip 是否完整显示
3. 检查 hover 样式在不同主题下是否清晰可见
