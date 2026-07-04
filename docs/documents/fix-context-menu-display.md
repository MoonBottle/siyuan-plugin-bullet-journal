# 修复右键菜单图标显示问题

## 摘要
右键上下文菜单中存在两个图标问题：
1. **"设置预计"菜单项**：使用了未注册的图标 `iconTaTarget`，导致该项可能无法正常显示
2. **"置顶/取消置顶"菜单项**：使用了未注册的图标 `iconTaPin`，导致图标不显示

需要将 contextMenu.ts 中的图标名称对齐 ItemActionBar.vue 中已验证可用的图标。

## 当前状态分析

### 对比：ItemActionBar.vue（正常显示） vs contextMenu.ts（有问题）

| 菜单项 | ItemActionBar.vue 图标 | contextMenu.ts 图标 | 状态 |
|--------|----------------------|---------------------|------|
| 完成 | `iconTaSquareCheck` | `iconTaSquareCheck` | OK |
| 开始专注 | `iconTaTimer` | `iconTaTimer` | OK |
| **设置预计** | **`iconTaClockPlus`** | **`iconTaTarget`** | **❌ iconTaTarget 未注册** |
| 迁移 | `iconTaSun` / `iconTaSunrise` | `iconTaSun` | OK |
| 放弃 | `iconTaSquareX` | `iconTaSquareX` | OK |
| 设置优先级 | — | `iconTaFlag` | OK |
| **置顶/取消置顶** | **`iconPin` / `iconUnpin`** (思源内置) | **`iconTaPin`** | **❌ iconTaPin 未注册** |
| 打开文档 | `iconTaFileText` | `iconTaFileText` | OK |
| 查看事项详情 | `iconTaInfo` | `iconTaInfo` | OK |

### 根因
- [index.ts:369-402](src/index.ts#L369-L402) 注册了 30+ 个自定义图标（均以 `iconTa` 前缀），但 **没有 `ICON_TARGET` 和 `ICON_PIN`**
- [contextMenu.ts:119](src/utils/contextMenu.ts#L119) 引用 `iconTaTarget` → 图标不存在
- [contextMenu.ts:192](src/utils/contextMenu.ts#L192) 引用 `iconTaPin` → 图标不存在
- [ItemActionBar.vue:37](src/components/todo/ItemActionBar.vue#L37) 使用 `iconTaClockPlus`（已注册）作为 focusPlan 图标
- [ItemActionBar.vue:95-96](src/components/todo/ItemActionBar.vue#L95-L96) 使用思源内置 `iconPin` / `iconUnpin`（无 Ta 前缀）作为 pin 图标

## 修改方案

### 文件: [src/utils/contextMenu.ts](src/utils/contextMenu.ts)

#### 修改 1：第 119 行 — "设置预计"图标 `iconTaTarget` → `iconTaClockPlus`

```diff
- icon: 'iconTaTarget',
+ icon: 'iconTaClockPlus',
```

对齐 ItemActionBar.vue 第 37 行的 `iconTaClockPlus`。

#### 修改 2：第 192 行 — "置顶"图标根据状态区分

```diff
- icon: item.pinned ? 'iconTaPin' : 'iconTaPin',
+ icon: item.pinned ? 'iconUnpin' : 'iconPin',
```

对齐 ItemActionBar.vue 第 95-96 行使用思源内置的 `iconPin` / `iconUnpin`。

## 验证步骤
1. `npm run lint` 确保无错误
2. `npm run test` 确保测试通过
3. 在思源中右键待办事项，确认：
   - "开始专注"下方出现"设置预计"菜单项且图标正确显示
   - "置顶"/"取消置顶"菜单项图标正确显示
