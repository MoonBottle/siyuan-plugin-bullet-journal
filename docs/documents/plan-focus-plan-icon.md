# 计划：将专注计划按钮改为自定义 SVG 图标

## 概述

将 `ItemActionBar.vue` 中专注计划（Focus Plan）按钮的图标从思源内置 `#iconAttr` 替换为自定义的 Lucide clock-plus 图标。

## 当前状态

- `ItemActionBar.vue` 第 37 行使用 `<svg><use xlink:href="#iconAttr"></use></svg>` 作为专注计划按钮图标
- `#iconAttr` 是思源内置图标，语义上与"设置专注计划"不匹配
- 项目已有完善的自定义图标机制：`icons.ts` 定义 `<symbol>` → `index.ts` 调用 `addIcons()` 注册 → 组件通过 `#iconTaXxx` 引用

## 修改内容

### 1. `src/constants/icons.ts` — 添加新图标常量

在文件末尾添加：

```typescript
export const ICON_CLOCK_PLUS = `<symbol id="iconTaClockPlus" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v6l3.644 1.822"/><path d="M16 19h6"/><path d="M19 16v6"/><path d="M21.92 13.267a10 10 0 1 0-8.653 8.653"/></symbol>`
```

- `id` 遵循 `iconTa` 前缀命名规范（防止与其他插件冲突）
- SVG 内容来自用户提供的 Lucide clock-plus 图标，转换为 `<symbol>` 格式
- 属性风格与现有图标（如 `ICON_POMODORO`）保持一致

### 2. `src/index.ts` — 注册新图标

- 在 import 语句中添加 `ICON_CLOCK_PLUS`
- 在 `onload()` 的 `addIcons` 调用区域添加 `this.addIcons(ICON_CLOCK_PLUS)`

### 3. `src/components/todo/ItemActionBar.vue` — 使用新图标

将第 37 行：
```html
<svg><use xlink:href="#iconAttr"></use></svg>
```
替换为：
```html
<svg><use xlink:href="#iconTaClockPlus"></use></svg>
```

## 验证步骤

1. `npm run lint` — 确认无 lint 错误
2. `npm run typecheck` — 确认无类型错误
3. `npm run test` — 确认测试通过
4. 构建后视觉验证：专注计划按钮应显示为时钟+加号图标
