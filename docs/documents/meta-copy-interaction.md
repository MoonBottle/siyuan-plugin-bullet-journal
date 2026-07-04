# 计划：meta-item 复制交互改造

## 摘要

将 `ItemDetailContent.vue` 中 duration 和 focusTotalTime 的独立复制按钮移除，改为点击文本触发复制，并使用 `showMessage` 提供复制成功反馈。

## 当前状态

- duration 和 focusTotalTimeDisplay 各有一个 `.copy-btn.small` 复制按钮（L171-182, L194-205）
- 复制成功后通过 `copiedState[key]` 切换图标（复制图标→对勾图标）作为反馈
- `meta-text` span 当前只显示文本，无点击事件

## 改动

### 文件：`src/components/dialog/ItemDetailContent.vue`

#### 1. 模板：移除 duration 的独立复制按钮，给 meta-text 加点击复制

**L170-182** 改为：
- 移除 `<span class="copy-btn small ...">` 整个 span
- 给 `<span class="meta-text">` 添加 `@click` 事件和样式类

```html
<span
  class="meta-text copyable"
  :class="{ copied: copiedState.duration }"
  @click="!readonly && handleCopy(duration, 'duration')"
>{{ duration }}</span>
```

#### 2. 模板：移除 focusTotalTimeDisplay 的独立复制按钮，给 meta-text 加点击复制

**L193-205** 改为：
- 移除 `<span class="copy-btn small ...">` 整个 span
- 给 `<span class="meta-text">` 添加 `@click` 事件和样式类

```html
<span
  class="meta-text copyable"
  :class="{ copied: copiedState.focusTime }"
  @click="!readonly && handleCopy(focusTotalTimeDisplay, 'focusTime')"
>{{ focusTotalTimeDisplay }}</span>
```

#### 3. 脚本：handleCopy 增加 showMessage 反馈

**L544-555** `handleCopy` 函数中，复制成功后调用 `showMessage`：

```ts
async function handleCopy(text: string, key: string) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copiedState[key] = true
    showMessage(t('common').copySuccess, 2000, 'info')
    setTimeout(() => {
      copiedState[key] = false
    }, 2000)
  } catch (err) {
    console.error('复制失败:', err)
  }
}
```

#### 4. 样式：添加 `.copyable` 和 `.copied` 样式

在 `.meta-text` 样式块后添加：

```scss
.meta-text {
  font-weight: 500;

  &.has-tooltip {
    cursor: help;
  }

  &.copyable {
    cursor: pointer;
    border-radius: 4px;
    padding: 0 4px;
    margin: 0 -4px;
    transition: background-color 0.2s;

    &:hover {
      background-color: var(--b3-theme-background);
    }

    &.copied {
      color: var(--b3-theme-success);
    }
  }
}
```

同时移除不再需要的 `.copy-btn.small` 样式（L658-666），因为 meta 区域不再使用小号复制按钮。

## 验证

1. `npm run lint` 通过
2. `npm run typecheck` 通过
3. `npm run test` 通过
