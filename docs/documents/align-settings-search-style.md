# 设置弹框搜索框样式对齐 TodoFilterBar

## 目标

将 `SettingsDialog.vue` 中侧边栏搜索框的样式对齐到 `TodoFilterBar.vue` 中 `.search-box` 的样式规范。

## 当前差异对比

| 属性 | SettingsDialog (当前) | TodoFilterBar (目标) |
|------|----------------------|---------------------|
| gap | `8px` | `6px` |
| min-height | 无 | `36px` |
| box-sizing | 无 | `border-box` |
| padding | `8px 10px` | `5px 10px` |
| border-radius | `6px` | `var(--b3-border-radius)` |
| focus-within 高亮 | 无 | `border-color: var(--b3-theme-primary)` |
| icon fill | `var(--b3-theme-on-surface-light)` | `var(--b3-theme-on-surface)` + `opacity: 0.5` |
| input color | `var(--b3-theme-on-surface)` | `var(--b3-theme-on-background)` |
| input padding | `0 0 0 5px` | 无显式 padding |
| 清除按钮 | 无 | 有 |

## 实施步骤

### 1. 修改 `.sy-settings-search-wrap` 样式

- `gap: 8px` → `gap: 6px`
- 添加 `min-height: 36px`
- 添加 `box-sizing: border-box`
- `padding: 8px 10px` → `padding: 5px 10px`
- `border-radius: 6px` → `border-radius: var(--b3-border-radius)`
- 添加 `:focus-within` 规则：`border-color: var(--b3-theme-primary)`

### 2. 修改 `.sy-settings-search__icon` 样式

- `fill: var(--b3-theme-on-surface-light)` → `fill: var(--b3-theme-on-surface)`
- 添加 `opacity: 0.5`

### 3. 修改 `.sy-settings-search` (input) 样式

- `color: var(--b3-theme-on-surface)` → `color: var(--b3-theme-on-background)`
- 移除 `padding: 0 0 0 5px`

### 4. 添加清除按钮（可选增强）

在模板中为搜索框添加清除按钮，与 TodoFilterBar 的 `.clear-btn` 保持一致：
- 当 `searchQuery` 非空时显示
- 点击后清空 `searchQuery`
- 样式与 TodoFilterBar 的 `.clear-btn` 一致

## 涉及文件

- `src/components/settings/SettingsDialog.vue` — 模板 + 样式修改
