# 修复 npm test 报错 实现计划

## 问题概述

`npm run test` 有 4 个测试失败，分属 2 个测试文件、2 类不同原因。

## 失败分析

### 失败 1：workbenchStore.test.ts — icon 名称不匹配

- **文件**: `test/stores/workbenchStore.test.ts:189`
- **错误**: `expected 'iconTaDashboard' to be 'iconBoard'`
- **原因**: 源码 `src/stores/workbenchStore.ts:32` 已将 dashboard 图标从 `iconBoard` 改为 `iconTaDashboard`，但测试未同步更新
- **修复**: 将测试第 189 行的 `'iconBoard'` 改为 `'iconTaDashboard'`

### 失败 2-4：FocusWorkbenchView.test.ts — selectSyOption 找不到选项元素

- **文件**: `test/components/pomodoro/FocusWorkbenchView.test.ts:362`
- **错误**: `TypeError: Cannot read properties of undefined (reading 'click')` — `option` 为 `undefined`
- **原因**: `selectSyOption` 辅助函数在第 360 行使用 `.sy-select__option` 选择器查找下拉选项，但 SySelect 组件实际使用的是 `.b3-menu__item` 类名（见 `src/components/SiyuanTheme/SySelect.vue:36`）。`.sy-select__option` 在整个源码中不存在。
- **修复**: 将第 360 行的 `'.sy-select__option'` 改为 `'.b3-menu__item'`

## 修改清单

| 文件 | 行号 | 修改内容 |
|------|------|---------|
| `test/stores/workbenchStore.test.ts` | 189 | `'iconBoard'` → `'iconTaDashboard'` |
| `test/components/pomodoro/FocusWorkbenchView.test.ts` | 360 | `'.sy-select__option'` → `'.b3-menu__item'` |

## 验证步骤

1. `npm run test` — 全部通过
2. `npm run lint` — 无错误
3. `npm run typecheck` — 无错误
