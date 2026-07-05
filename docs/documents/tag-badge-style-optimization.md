# ItemDetailContent.vue Tag Badge 样式优化计划

## 摘要

将 `ItemDetailContent.vue` 中待办状态（`.tag-badge.status-*`）和等级（`.tag-badge.level-*`）标签从**实心背景+白色文字**改为**同色淡化背景+同色文字**，提升可读性。

## 当前状态分析

当前 `.tag-badge` 样式（[ItemDetailContent.vue](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/components/dialog/ItemDetailContent.vue#L726-L764)）：

* 基类：`color: var(--b3-theme-on-primary)` — 白色文字

* 各变体：实心深色背景（如 `background: var(--b3-theme-primary)`、`background: #ff9800` 等）

**问题**：实心背景+白色文字在小尺寸标签上对比度过强，视觉重量大，不够柔和。

项目中 `index.scss` 的 `.sy-dialog-status` 和 `.task-level` 已有**同色淡化背景**的成熟模式（`rgba(color, 0.15)` 背景 + 同色文字），可参考。

## 修改方案

### 修改文件

`src/components/dialog/ItemDetailContent.vue` — `<style>` 部分

### 具体改动

**1. 修改** **`.tag-badge`** **基类**（第726-738行）

移除 `color: var(--b3-theme-on-primary)` 白色文字，改为默认文字色，由各变体自行定义颜色：

```scss
.tag-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  height: 16px;
  white-space: nowrap;
  // color 由各变体定义
}
```

**2. 修改状态变体**（第739-754行）

从实心背景改为淡化背景+同色文字：

| 状态          | 当前                                                                          | 改为                                                                                    |
| ----------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| pending     | `background: var(--b3-theme-primary)`                                       | `background: rgba(var(--b3-theme-primary-rgb), 0.15); color: var(--b3-theme-primary)` |
| in-progress | `background: #ff9800`                                                       | `background: rgba(255, 152, 0, 0.15); color: #ff9800`                                 |
| completed   | `background: var(--b3-theme-success)`                                       | `background: rgba(76, 175, 80, 0.15); color: #4caf50`                                 |
| abandoned   | `background: var(--b3-theme-on-surface); color: var(--b3-theme-background)` | `background: rgba(120, 120, 120, 0.15); color: var(--b3-theme-on-surface)`            |
| expired     | `background: #f44336`                                                       | `background: rgba(244, 67, 54, 0.15); color: #f44336`                                 |

**3. 修改等级变体**（第755-763行）

| 等级 | 当前                    | 改为                                                    |
| -- | --------------------- | ----------------------------------------------------- |
| L1 | `background: #4caf50` | `background: rgba(76, 175, 80, 0.15); color: #4caf50` |
| L2 | `background: #ff9800` | `background: rgba(255, 152, 0, 0.15); color: #ff9800` |
| L3 | `background: #f44336` | `background: rgba(244, 67, 54, 0.15); color: #f44336` |

### 设计决策

1. **pending 使用** **`--b3-theme-primary-rgb`**：SiYuan 提供 `--b3-theme-primary-rgb` CSS 变量（项目中 QuickCreateDrawer 已使用），可动态适配主题色
2. **completed 使用硬编码绿色** **`#4caf50`**：SiYuan 不一定提供 `--b3-theme-success-rgb` 变量，使用硬编码 RGB 值更可靠，与 `index.scss` 中 `.sy-dialog-status.completed` 保持一致
3. **abandoned 使用中性灰色**：表示"已放弃"的语义，用灰色比红色更合适，且与当前实心深色风格保持语义一致
4. **不修改其他文件**：仅修改 `ItemDetailContent.vue`，不影响其他组件的标签样式

## 验证步骤

1. `npm run lint` — 确保 lint 通过
2. `npm run typecheck` — 确保类型检查通过
3. `npm run test` — 确保测试通过
4. 视觉验证：在思源中打开 Item 详情弹窗，确认待办状态和等级标签显示为淡化背景+同色文字

