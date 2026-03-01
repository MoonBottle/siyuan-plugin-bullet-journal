# 文档右键菜单功能 Spec

## Why
用户在文档树中右键点击文档时，希望能够快速将文档添加为子弹笔记的项目目录，提升操作效率。

## What Changes
- 使用思源原生 `eventBus` API 监听 `open-menu-doctree` 事件
- 在事件回调中通过 `menu.addItem` 添加插件菜单项
- 点击菜单项后将文档路径添加到插件设置的目录列表中

## Impact
- Affected specs: 插件设置系统
- Affected code: `src/main.ts`, `src/index.ts`

## ADDED Requirements

### Requirement: 文档树右键菜单扩展
系统应当使用思源原生 eventBus API 在文档树右键菜单中提供插件相关的菜单项。

#### Scenario: 添加文档到项目目录
- **WHEN** 用户在文档树中右键点击一个文档
- **THEN** 菜单中显示"添加到子弹笔记"选项
- **AND** 点击后该文档路径被添加到插件的目录配置中

#### Scenario: 右键点击多个文档
- **WHEN** 用户在文档树中选中多个文档后右键点击
- **THEN** 菜单中显示"添加到子弹笔记"选项
- **AND** 点击后所有选中文档的路径被添加到插件的目录配置中

#### Scenario: 路径已存在
- **WHEN** 用户右键点击的文档路径已存在于目录配置中
- **THEN** 菜单项显示为禁用状态或显示"已添加"提示

### Requirement: 使用思源原生 API
必须使用思源提供的 eventBus API 实现菜单扩展，而非自定义 DOM 监听。

#### Scenario: 注册事件监听
- **WHEN** 插件加载时
- **THEN** 通过 `this.eventBus.on('open-menu-doctree', callback)` 注册事件监听

#### Scenario: 移除事件监听
- **WHEN** 插件卸载时
- **THEN** 通过 `this.eventBus.off('open-menu-doctree', callback)` 移除事件监听

### Requirement: 菜单项国际化
菜单项文本应支持中英文显示。

#### Scenario: 中文环境
- **WHEN** 思源语言设置为中文
- **THEN** 菜单项显示"添加到子弹笔记"

#### Scenario: 英文环境
- **WHEN** 思源语言设置为英文
- **THEN** 菜单项显示"Add to Bullet Journal"

## Technical Notes

### 思源 API 参考
```typescript
// 事件数据结构
"open-menu-doctree": {
    menu: subMenu,           // 菜单对象，用于添加菜单项
    elements: NodeListOf<HTMLElement>,  // 选中的文档元素
    type: "doc" | "docs" | "notebook",  // 类型：单个文档、多个文档、笔记本
}

// 使用方式
this.eventBus.on('open-menu-doctree', (event) => {
    const { menu, elements, type } = event.detail;
    if (type === 'doc' || type === 'docs') {
        menu.addItem({
            icon: 'iconCalendar',
            label: '添加到子弹笔记',
            click: () => { /* 处理逻辑 */ }
        });
    }
});
```
