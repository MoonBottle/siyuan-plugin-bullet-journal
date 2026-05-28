# 用户消息复制按钮实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 AI 聊天面板的用户消息气泡左侧增加一个 hover 时才显示的复制按钮。

**架构：** 在 `ChatMessage.vue` 组件中，为用户消息（`role === 'user'`）添加一个绝对定位的复制按钮，通过 CSS hover 控制显示/隐藏。复用现有的 `handleCopyMessage` 方法处理复制逻辑。

**技术栈：** Vue 3 + SCSS

---

## 文件结构

| 文件                                | 职责                                        |
| ----------------------------------- | ------------------------------------------- |
| `src/components/ai/ChatMessage.vue` | 修改：在用户消息气泡左侧添加 hover 复制按钮 |

---

## 任务 1：修改 ChatMessage.vue 添加用户消息复制按钮

**文件：**

- 修改：`src/components/ai/ChatMessage.vue`

### 步骤 1：在模板中添加复制按钮元素

在用户消息的 `.chat-message__content` 同级添加复制按钮：

```vue
<!-- 在 .chat-message 内部，.chat-message__content 之前或之后添加 -->
<span
  v-if="message.role === 'user' && message.content"
  class="chat-message__copy-btn block__icon b3-tooltips b3-tooltips__ne"
  :aria-label="t('aiChat').copyMessage"
  @click="handleCopyMessage"
>
  <svg><use xlink:href="#iconCopy"></use></svg>
</span>
```

放置位置：在 `chat-message__content` div 的**前面**（因为用户消息是右对齐，按钮需要在气泡左侧）。

### 步骤 2：添加 SCSS 样式

在 `.chat-message` 的样式块中添加：

```scss
&__copy-btn {
  position: absolute;
  right: calc(100% + 8px); // 在气泡左侧 8px
  top: 50%;
  transform: translateY(-50%);
  opacity: 0;
  transition: opacity 0.2s ease;
  cursor: pointer;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;

  svg {
    width: 14px;
    height: 14px;
    fill: var(--b3-theme-on-surface-light);
  }

  &:hover {
    background: var(--b3-theme-surface-lighter);

    svg {
      fill: var(--b3-theme-primary);
    }
  }
}

// 用户消息 hover 时显示复制按钮
&--user:hover &__copy-btn {
  opacity: 0.7;
}

&--user &__copy-btn:hover {
  opacity: 1;
}
```

同时需要给 `.chat-message--user` 添加 `position: relative`（如果还没有的话），以便绝对定位生效。

检查现有代码：`.chat-message--user` 当前没有 `position: relative`，需要添加。

### 步骤 3：验证 i18n 键存在

检查 `t('aiChat').copyMessage` 是否已定义。根据已有代码，第 110 行已经使用了 `t('aiChat').copyMessage`，所以键已存在，无需修改 i18n 文件。

### 步骤 4：运行 lint 检查

```bash
npm run lint
```

预期：无错误，无新警告。

### 步骤 5：Commit

```bash
git add src/components/ai/ChatMessage.vue
git commit -m "feat: 为用户消息气泡添加 hover 复制按钮"
```

---

## 自检

**1. 规格覆盖度：**

- ✅ 仅在用户消息上添加复制按钮
- ✅ hover 时才显示
- ✅ 位于气泡左侧
- ✅ 复用现有复制逻辑

**2. 占位符扫描：** 无占位符。

**3. 类型一致性：** `handleCopyMessage` 方法已存在，签名一致。
