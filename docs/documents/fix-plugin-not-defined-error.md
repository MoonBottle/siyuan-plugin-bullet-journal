# 修复 `ReferenceError: plugin is not defined` 错误

## 根因分析

**错误信息：** `ReferenceError: plugin is not defined`
**触发位置：** [index.ts:1602](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/index.ts#L1602) — HabitDock 的 `init()` 回调

**根因：** 在 `registerDocks()` 方法中，习惯打卡 Dock（HabitDock）的 `init()` 回调使用了 `{ plugin }` 传递插件实例，但 `plugin` 变量在该作用域中**未定义**。

对比其他 Dock 的写法：
- **TodoDock**（第 1517 行）：`createApp(TodoDock, { plugin: self })` ✅ 使用了 `self`（第 1471 行 `const self = this`）
- **HabitDock**（第 1602 行）：`createApp(HabitDock, { plugin })` ❌ 直接引用了 `plugin`，但 `plugin` 在此作用域不存在

`registerDocks()` 方法开头定义了 `const self = this`（第 1471 行），所有 `init()` 回调应通过 `self` 访问插件实例。HabitDock 的 `init()` 遗漏了这一点，直接使用了不存在的 `plugin` 变量。

## 修复方案

将 [index.ts:1602](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/index.ts#L1602) 的：

```ts
const app = createApp(HabitDock, { plugin })
```

改为：

```ts
const app = createApp(HabitDock, { plugin: self })
```

## 验证步骤

1. 修改后执行 `npm run build` 确认编译通过
2. 执行 `npm run lint` 确认无 lint 错误
3. 在思源中重新加载插件，确认不再报 `plugin is not defined` 错误
