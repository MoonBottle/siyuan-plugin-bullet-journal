# 计划：WorkbenchTab 菜单改用思源 Menu 实现

## 摘要

将 `WorkbenchTab.vue` 中的"添加组件"自定义下拉菜单替换为思源 `Menu` API。菜单逻辑保持在 WorkbenchTab。

## 修改方案

### 1. 修改 `src/tabs/WorkbenchTab.vue`

**Template 变更**（L36-71）：
- 替换为单个按钮 + `@click.stop="handleAddWidgetMenu"`
- 添加 `ref="addWidgetTriggerRef"` 供 `openWidgetMenu` 使用
- 删除 `widgetMenuWrapRef` 包裹 div、`v-if="isWidgetMenuOpen"` 菜单 div 及所有子元素

**Script 变更**：
- 新增 `import { Menu } from 'siyuan'`
- 删除：`isWidgetMenuOpen` ref、`widgetMenuWrapRef` ref、`toggleWidgetMenu`、`handleWidgetMenuClickOutside`、`watch(isWidgetMenuOpen, ...)`、`onUnmounted` 中的 `removeEventListener`
- 新增 `addWidgetTriggerRef = ref<HTMLElement>()`
- 新增 `handleAddWidgetMenu(event: MouseEvent)` 函数：
  ```ts
  function handleAddWidgetMenu(event: MouseEvent) {
    event.stopPropagation()
    const target = event.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const menu = new Menu('workbench-add-widget-menu')
    for (const definition of widgetDefinitions.value) {
      menu.addItem({
        icon: definition.icon,
        label: definition.name,
        click: () => handleAddWidget(definition.type),
      })
    }
    menu.open({ x: rect.left, y: rect.bottom + 4, isLeft: true })
  }
  ```
- 修改 `openWidgetMenu`：改为 `addWidgetTriggerRef.value?.click()`
- 修改 `handleAddWidget`：移除 `isWidgetMenuOpen.value = false`

**Style 变更**：
- 删除 `.workbench-tab__toolbar-menu-wrap`
- 删除 `.workbench-tab__toolbar-menu`
- 删除 `.workbench-tab__toolbar-menu-item` 及其 hover 状态
- 删除 `.workbench-tab__toolbar-menu-icon` 及其 svg 样式

### 2. 修改 `test/tabs/WorkbenchTab.test.ts`

- 添加 `import { Menu } from 'siyuan'`
- 测试 `'shows add todoList widget action'`：改为通过 `Menu.lastInstance` 触发 click
- 测试 `'opens widget menu with all first-batch widget types'`：改为检查 `Menu.lastInstance.items`

### 3. DashboardCanvas.vue 无需修改

空状态按钮只 emit `requestAddWidget`，事件流不变。
