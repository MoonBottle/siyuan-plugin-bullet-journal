# 修复文档树右键菜单功能

## 问题分析
当前实现将事件处理逻辑放在 `main.ts` 中作为独立函数，可能导致：
1. `this` 上下文丢失
2. 事件回调绑定方式不正确

## 解决方案
参考 `siyuan-plugin-task-note-management` 插件的做法，将事件处理逻辑直接放在插件类中。

## 实现步骤

### Step 1: 修改 `src/index.ts`
- 在 `onload` 方法中直接使用 `this.eventBus.on('open-menu-doctree', this.handleDocTreeMenu.bind(this))`
- 添加 `handleDocTreeMenu` 方法作为类成员方法
- 在 `onunload` 方法中使用 `this.eventBus.off('open-menu-doctree', this.handleDocTreeMenu.bind(this))`

### Step 2: 清理 `src/main.ts`
- 移除 `registerDocTreeMenu` 和 `unregisterDocTreeMenu` 函数
- 保留其他必要的导出函数

### Step 3: 实现细节
参考代码结构：
```typescript
private handleDocTreeMenu({ detail }) {
    const { menu, elements, type } = detail;
    
    if (type !== 'doc' && type !== 'docs') {
        return;
    }
    
    // 获取文档ID
    const documentIds = Array.from(elements)
        .map((element: Element) => element.getAttribute('data-node-id'))
        .filter((id: string | null): id is string => id !== null);
    
    if (!documentIds.length) return;
    
    // 添加分隔符
    menu.addSeparator();
    
    // 添加菜单项
    menu.addItem({
        icon: 'iconCalendar',
        label: '添加到子弹笔记',
        click: async () => {
            // 处理逻辑
        }
    });
}
```
