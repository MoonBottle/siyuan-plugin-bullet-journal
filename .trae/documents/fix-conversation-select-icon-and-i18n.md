# 修复 ConversationSelect 图标样式和国际化问题

## 问题描述

1. **图标样式不一致**: `ConversationSelect.vue` 中使用的图标样式需要与 `AiChatDock.vue` 右上角的图标样式保持一致
2. **国际化缺失**: `ConversationSelect.vue` 第6-7行的 `aria-label` 使用了 `t('aiChat').conversations`，但国际化文件中没有定义 `conversations` 字段

## 分析结果

### 当前代码状态

**ConversationSelect.vue (第3-13行)**:
```vue
<span
  ref="triggerRef"
  class="block__icon b3-tooltips b3-tooltips__sw"
  :aria-label="t('aiChat').conversations"
  :class="{ 'is-open': isOpen }"
  @click="toggleDropdown"
>
  <svg>
    <use xlink:href="#iconHistory"></use>
  </svg>
</span>
```

**AiChatDock.vue (第23-31行) 参考样式**:
```vue
<span
  class="block__icon b3-tooltips b3-tooltips__sw"
  :aria-label="t('aiChat').newConversation"
  @click="handleNewConversation"
>
  <svg>
    <use xlink:href="#iconAdd"></use>
  </svg>
</span>
```

### 差异点

1. `ConversationSelect.vue` 的图标按钮与 `AiChatDock.vue` 的图标按钮样式基本一致（都有 `block__icon b3-tooltips b3-tooltips__sw` 类），但 `ConversationSelect.vue` 多了一个 `:class="{ 'is-open': isOpen }"` 用于下拉状态显示
2. 国际化文件中 `aiChat` 对象缺少 `conversations` 字段

### 可用图标参考 (icons.md)

根据 icons.md，可选的合适图标包括：
- `iconHistory` - 历史记录（当前使用的）
- `iconList` - 列表
- `iconMenu` - 菜单
- `iconSelect` - 选择
- `iconExpand` - 展开

考虑到这是"对话选择"功能，`iconHistory` 或 `iconList` 比较合适，当前使用的 `iconHistory` 是合理的。

## 修复方案

### 1. 添加国际化字段

在 `zh_CN.json` 和 `en_US.json` 的 `aiChat` 对象中添加 `conversations` 字段：

**zh_CN.json**:
```json
"conversations": "对话历史"
```

**en_US.json**:
```json
"conversations": "Conversations"
```

### 2. 图标样式调整

`ConversationSelect.vue` 的图标样式已经与 `AiChatDock.vue` 保持一致（都使用了 `block__icon b3-tooltips b3-tooltips__sw`），无需修改样式类。

但可以考虑将图标从 `iconHistory` 改为更合适的图标（如 `iconList` 或 `iconMenu`），不过这不是必须的。

## 实施步骤

1. **添加国际化字段到 zh_CN.json**
   - 在 `aiChat` 对象中添加 `"conversations": "对话历史"`

2. **添加国际化字段到 en_US.json**
   - 在 `aiChat` 对象中添加 `"conversations": "Conversations"`

3. **验证 ConversationSelect.vue 样式**
   - 确认图标按钮样式与 AiChatDock.vue 保持一致
   - 当前代码已经一致，无需修改

## 文件变更清单

1. `src/i18n/zh_CN.json` - 添加 `conversations` 字段
2. `src/i18n/en_US.json` - 添加 `conversations` 字段
