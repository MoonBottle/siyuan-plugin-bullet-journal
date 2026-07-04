# Webhook 列表样式对齐 AiConfigSection 计划

## 问题分析

对比 `WebhookConfigSection.vue` 和 `AiConfigSection.vue` 的桌面端列表样式，发现以下差异：

| 样式项 | WebhookConfigSection（当前） | AiConfigSection（目标） |
|--------|-----|-----|
| 空提示背景 | 无背景，仅文字 | `background: var(--b3-theme-surface); border-radius: 6px;` |
| 空提示内边距 | `padding: 20px` | `padding: 12px` |
| 空提示底部间距 | 无 | `margin-bottom: 16px` |
| 列表项间距 | `gap: 8px` | `gap: 12px` |
| 列表项背景 | `background: var(--b3-theme-background)` + `border: 1px solid` | `background: var(--b3-theme-surface)` 无边框 |
| 列表项圆角 | `border-radius: 4px` | `border-radius: 6px` |
| 列表底部间距 | `margin-bottom: 12px` | `margin-bottom: 16px` |
| 信息区布局 | `flex` 水平排列（name + type 并排） | `flex-direction: column` 垂直排列（name 上 model 下） |
| 信息区最小宽度 | 无 | `min-width: 0` |
| 信息区间距 | `gap: 8px` | `gap: 2px` |
| 名称样式 | `font-size: 14px; font-weight: 500` | `font-size: 13px; font-weight: 500; color: var(--b3-theme-on-background)` |
| 副标签样式 | `.channel-type` 使用 `background + padding` 标签样式 | `.custom-item-model` 纯文字 `font-size: 11px; color: var(--b3-theme-on-surface-light)` |
| 操作区间距 | `gap: 6px` | `gap: 8px` |

## 实施步骤

### 步骤 1：修改 WebhookConfigSection.vue 的 `<style>` 部分

将以下样式类从 Webhook 风格对齐到 AiConfig 风格：

1. **`.webhook-empty`** → 对齐 `.ai-provider-empty`
   - 添加 `background: var(--b3-theme-surface)`
   - 添加 `border-radius: 6px`
   - `padding: 20px` → `padding: 12px`
   - 添加 `margin-bottom: 16px`
   - `color` 改为 `var(--b3-theme-on-surface-light)`

2. **`.custom-list`**
   - `gap: 8px` → `gap: 12px`
   - `margin-bottom: 12px` → `margin-bottom: 16px`

3. **`.custom-item`** → 对齐 AiConfig 的 `.custom-item`
   - 移除 `border: 1px solid var(--b3-theme-surface-lighter)`
   - `background: var(--b3-theme-background)` → `background: var(--b3-theme-surface)`
   - `border-radius: 4px` → `border-radius: 6px`

4. **`.custom-item-info`** → 对齐 AiConfig 的 `.custom-item-info`
   - `flex` 默认水平 → `flex-direction: column`
   - `gap: 8px` → `gap: 2px`
   - 添加 `min-width: 0`

5. **`.channel-name`** → 对齐 `.custom-item-name`
   - `font-size: 14px` → `font-size: 13px`
   - 添加 `color: var(--b3-theme-on-background)`

6. **`.channel-type`** → 对齐 `.custom-item-model`（从标签样式改为纯文字样式）
   - 移除 `padding`、`border-radius`、`background`
   - `font-size: 12px` → `font-size: 11px`
   - `color` 改为 `var(--b3-theme-on-surface-light)`

7. **`.custom-item-actions`**
   - `gap: 6px` → `gap: 8px`

### 步骤 2：验证

运行 `npm run lint` 确认无 lint 错误。

## 影响范围

仅修改 `WebhookConfigSection.vue` 的 `<style scoped>` 部分，不影响模板和逻辑。
