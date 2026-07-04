# 修复重复图标重复显示问题

## 问题描述

在事项详情弹窗和待办列表中，重复规则的按钮文本前面多了一个 `🔁` 图标，与按钮自带的 `🔁` 图标重复。

截图显示：`🔁 🔁每月10日`（期望：`🔁 每月10日`）

## 根因分析

`generateRepeatRuleMarker()` 函数返回的字符串**包含 `🔁` emoji 前缀**：

```ts
// src/parser/recurringParser.ts
return `🔁${typeStr}`;  // 例如 "🔁每月10日"
```

而 `TodoItemActionButtons.vue` 按钮已经固定显示了一个 `🔁` 图标：

```vue
<span class="action-icon">🔁</span>
<span class="action-text">{{ recurringText }}</span>
```

当 `recurringText` 也包含 `🔁` 时，就造成了重复显示。

## 影响范围

`generateRepeatRuleMarker()` 被多处共用：

| 使用位置 | 用途 | 是否需要 `🔁` |
|---------|------|-------------|
| `src/services/recurringService.ts` | 写入 markdown 创建下次重复事项 | ✅ 必须 |
| `src/utils/itemSettingUtils.ts` | 写入 markdown 更新块内容 | ✅ 必须 |
| `src/components/todo/TodoItemMeta.vue` | UI 显示重复按钮文本 | ❌ 不需要（已处理） |
| `src/components/dialog/ItemDetailDialog.vue` | UI 显示重复按钮文本 | ❌ 未处理，**有问题** |
| `src/mobile/drawers/item/MobileItemDetail.vue` | UI 显示重复按钮文本 | ❌ 未处理，**有问题** |

## 修复方案

**方案：在 UI 显示层统一去掉 `🔁` 前缀**

原因：
- `generateRepeatRuleMarker()` 的核心职责是生成 markdown 标记（包含 `🔁`）
- UI 显示层应负责去掉图标前缀，避免与按钮图标重复
- 不影响 `recurringService.ts` 等写入 markdown 的逻辑

## 具体修改

### 1. `src/components/dialog/ItemDetailDialog.vue`

修改 `recurringText` 计算属性，去掉 `🔁` 前缀：

```ts
const recurringText = computed(() => {
  if (!hasRecurring.value) return t('recurring.setRecurring');
  const ruleMarker = generateRepeatRuleMarker(props.item.repeatRule);
  const endMarker = generateEndConditionMarker(props.item.endCondition);
  const compactRuleMarker = ruleMarker.replace(/^🔁\s*/, '');
  return endMarker ? `${compactRuleMarker} ${endMarker}` : compactRuleMarker;
});
```

### 2. `src/mobile/drawers/item/MobileItemDetail.vue`

修改 `recurringText` 计算属性，去掉 `🔁` 前缀：

```ts
const recurringText = computed(() => {
  if (!hasRecurring.value) return t('mobile.detail.setRecurring') || '设置重复';
  const rule = generateRepeatRuleMarker(props.item!.repeatRule!);
  const end = generateEndConditionMarker(props.item!.endCondition);
  const compactRule = rule.replace(/^🔁\s*/, '');
  return end ? `${compactRule} ${end}` : compactRule;
});
```

## 验证步骤

1. 运行 `npm run lint` 检查代码风格
2. 运行 `npm run build` 确保构建通过
