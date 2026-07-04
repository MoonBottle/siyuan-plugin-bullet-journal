# 修复 WebhookConfigSection 递归响应式更新导致崩溃

## 根因分析

### 错误现象
点击保存按钮时，`<SettingsDialog>` 组件报错：`Maximum recursive updates exceeded`

### 根本原因
`WebhookConfigSection.vue` 中存在 **双向 deep watch 闭环**，形成无限递归更新链：

```
localWebhook 变化
  → Watch B (L125-131) 触发 → emit('update:webhook', 新对象)
    → 父组件 SettingsDialog 更新 local.webhook
      → props.webhook 变化
        → Watch A (L115-123) 触发 → localWebhook.value = JSON.parse(JSON.stringify(val))
          → localWebhook 变化（新对象引用）
            → Watch B 再次触发 → ...无限循环
```

关键问题点：
1. **Watch A + Watch B 形成闭环**：Watch A 监听 `props.webhook` 写入 `localWebhook`，Watch B 监听 `localWebhook` emit 回父组件，两者通过 `JSON.parse(JSON.stringify())` 每次产生新引用，deep watch 无法通过引用相等打断循环
2. **`SySwitch v-model="channel.enabled"`（L43）** 直接修改 `localWebhook` 的深层属性，触发 Watch B
3. **`SySwitch v-model="localWebhook.enabled"`（L12）** 同理直接修改触发 Watch B

### 对比正常模式
`AiConfigSection` 和 `PomodoroConfigSection` **不使用双向 deep watch**，而是在事件处理函数中**显式调用 emit**，避免了闭环。

## 修复方案

### 核心思路：移除双向 deep watch，改为显式 emit

参照 `AiConfigSection` 的模式，删除 Watch A 和 Watch B，改为在数据变更时显式 emit。

### 修改文件：`WebhookConfigSection.vue`

#### 1. 删除 Watch A（L115-123）和 Watch B（L125-131）

移除两个 deep watch，消除闭环根源。

#### 2. 添加 `emitUpdate` 辅助函数

```typescript
function emitUpdate() {
  emit('update:webhook', JSON.parse(JSON.stringify(localWebhook.value)))
}
```

#### 3. 修改 `localWebhook.enabled` 的绑定方式

将 `v-model="localWebhook.enabled"` 改为显式事件处理：

```html
<SySwitch
  :model-value="localWebhook.enabled"
  @update:model-value="(val: boolean) => { localWebhook.enabled = val; emitUpdate() }"
/>
```

#### 4. 修改 `channel.enabled` 的绑定方式

将 `v-model="channel.enabled"` 改为显式事件处理：

```html
<SySwitch
  :model-value="channel.enabled"
  @update:model-value="(val: boolean) => { channel.enabled = val; emitUpdate() }"
/>
```

#### 5. 在 `saveFromDialog` 和 `deleteChannel` 中添加 emit

```typescript
function saveFromDialog() {
  if (!formRef.value) return
  const result = formRef.value.buildResult()
  const idx = localWebhook.value.channels.findIndex(c => c.id === result.id)
  if (idx >= 0) {
    localWebhook.value.channels[idx] = result
  } else {
    localWebhook.value.channels.push(result)
  }
  showEditDialog.value = false
  emitUpdate()
}

function deleteChannel(id: string) {
  if (!confirm(t('settings').webhook.deleteConfirm)) return
  localWebhook.value.channels = localWebhook.value.channels.filter(c => c.id !== id)
  emitUpdate()
}
```

#### 6. 处理 props.webhook 变化的同步需求

如果父组件的 `local.webhook` 确实需要从外部同步（如 SettingsDialog 的 deep watch 触发），改用**浅比较**避免不必要更新：

```typescript
watch(
  () => props.webhook,
  (val) => {
    if (val && JSON.stringify(val) !== JSON.stringify(localWebhook.value)) {
      localWebhook.value = JSON.parse(JSON.stringify(val))
    }
  },
  { deep: true },
)
```

这样当 emit 回来的值和当前值内容相同时，不会重新赋值，打破循环。

## 验证步骤

1. 打开设置 → Webhook 通知
2. 开启/关闭 webhook 总开关 → 不应报错
3. 添加 channel → 保存 → 不应报错
4. 编辑 channel → 保存 → 不应报错
5. 切换 channel 的 enabled 开关 → 不应报错
6. 删除 channel → 不应报错
7. 点击设置对话框底部"保存"按钮 → 不应报错
