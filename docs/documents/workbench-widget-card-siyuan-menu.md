# 计划：WorkbenchWidgetCard 改用思源 Menu 实现

## 摘要

将 `WorkbenchWidgetCard.vue` 中的自定义下拉菜单替换为思源 `Menu` API，与 `WorkbenchSidebar.vue` 中的实现模式保持一致。

## 现状分析

**当前实现**（`WorkbenchWidgetCard.vue`）：
- 使用自定义下拉菜单：`isMenuOpen` ref 控制显隐，`v-if` 条件渲染菜单 DOM
- 手动实现点击外部关闭（`handleClickOutside` + `watch` + `onUnmounted`）
- 自定义 CSS 样式（`.workbench-widget-card__menu`、`.workbench-widget-card__menu-item`）
- 菜单项：配置（条件显示）、重命名、删除

**参考实现**（`WorkbenchSidebar.vue` L569-607）：
- 使用 `import { Menu } from 'siyuan'`
- `new Menu('menu-id')` → `menu.addItem({...})` → `menu.open({ x, y })`
- 无需手动管理菜单状态、点击外部关闭、自定义样式

**辅助工具**（`src/utils/menuPosition.ts`）：
- `resolveMenuPosition(event)` 可优雅处理菜单定位，支持坐标缺失时回退到元素位置

## 修改方案

### 1. 修改 `src/components/workbench/dashboard/WorkbenchWidgetCard.vue`

**Template 变更**：
- 保留按钮（L23-31），但移除 `@click="toggleMenu"`，改为 `@click="handleMenuClick"`
- 删除整个自定义菜单 DOM（L32-62，即 `v-if="isMenuOpen"` 的 div 及其子元素）
- 删除 `menuWrapRef` 包裹 div（L19-22, L63），按钮直接放在 `controls` div 中

**Script 变更**：
- 新增 `import { Menu } from 'siyuan'`
- 删除：`isMenuOpen` ref、`menuWrapRef` ref、`toggleMenu`、`handleClickOutside`、`watch(isMenuOpen, ...)`、`onUnmounted` 中的 `removeEventListener`
- 删除：`onUnmounted` import（如果不再需要）
- 新增 `handleMenuClick(event: MouseEvent)` 函数：
  ```ts
  function handleMenuClick(event: MouseEvent) {
    const menu = new Menu('workbench-widget-card-menu')
    if (props.showConfigure) {
      menu.addItem({
        icon: 'iconSettings',
        label: t('workbench').configure,
        click: () => emit('configure'),
      })
    }
    menu.addItem({
      icon: 'iconEdit',
      label: t('workbench').rename,
      click: () => emit('rename'),
    })
    menu.addItem({
      icon: 'iconTrashcan',
      label: t('workbench').delete,
      click: () => emit('delete'),
    })
    menu.open({
      x: event.clientX,
      y: event.clientY,
    })
  }
  ```
- `handleRename`、`handleConfigure`、`handleDelete` 三个函数可删除，逻辑直接内联到 menu item 的 click 回调中

**Style 变更**：
- 删除 `.workbench-widget-card__menu-wrap`
- 删除 `.workbench-widget-card__menu`
- 删除 `.workbench-widget-card__menu-item` 及其 hover 状态

### 2. 修改 `test/__mocks__/siyuan.ts`

新增 `Menu` 类的 mock：
```ts
export class Menu {
  private items: any[] = []
  addItem(item: any) { this.items.push(item) }
  addSeparator() { this.items.push({ type: 'separator' }) }
  open(_position: { x: number, y: number }) {}
}
```

### 3. 测试验证

- 现有测试 `test/components/workbench/WorkbenchWidgetCard.test.ts` 不涉及菜单交互，应继续通过
- 运行 `npm run test`、`npm run lint`、`npm run typecheck` 验证

## 假设与决策

- **图标选择**：配置用 `iconSettings`、重命名用 `iconEdit`、删除用 `iconTrashcan`，与 `WorkbenchSidebar.vue` 中的 rename/delete 图标保持一致
- **不使用 `resolveMenuPosition`**：因为按钮点击事件本身有可靠的 `clientX/clientY`，无需回退逻辑
- **菜单 ID**：使用 `'workbench-widget-card-menu'`，与 sidebar 的 `'workbench-entry-menu'` 命名风格一致
