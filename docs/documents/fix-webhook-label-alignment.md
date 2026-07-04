# 修复 WebhookChannelEditForm label 对齐问题

## 问题描述

`WebhookChannelEditForm.vue` 中表单 label 的宽度不一致，导致输入框和下拉框的左侧没有对齐。

具体表现：
1. **渠道名称**、**渠道类型**、**Webhook URL** 使用 `.form-label`（`min-width: 80px`，右对齐）
2. **订阅事件** 使用 `.form-label-row`（无固定宽度，左对齐）
3. **自定义模板** 区域内部的 **请求方法** 使用 `.form-label`（右对齐），但 **消息体模板** 使用 `.form-group > label.form-label`（左对齐）

从截图可见，输入框和下拉框的左边缘没有对齐。

## 修复方案

统一所有表单 label 的宽度为 `100px`（因为 "Webhook URL" 比 "渠道名称" 长，80px 不够），并保持右对齐。

### 具体修改

**文件**: `src/components/settings/WebhookChannelEditForm.vue`

1. **将 `.form-label` 的 `min-width` 从 `80px` 改为 `100px`**
2. **将 "订阅事件" 的 label 从 `.form-label-row` 改为使用 `.form-label` 样式**，使其与上方表单行保持一致的对齐方式
3. **将 "自定义模板" 的 label 同样改为使用 `.form-label` 样式**
4. **自定义模板内部的 "消息体模板" label** 目前使用 `.form-group > label.form-label`，需要确保它也有相同的 `min-width: 100px` 和右对齐

### 修改后的样式预期

- 所有 label 统一 `min-width: 100px`，`text-align: right`，`padding-right: 8px`
- 所有输入框/下拉框的左边缘对齐在同一垂直线上
- 保持现有的间距和视觉层次
