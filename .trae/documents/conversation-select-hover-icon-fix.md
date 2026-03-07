# ConversationSelect.vue 悬停图标修复计划

## 问题描述
在 `ConversationSelect.vue` 组件中，当鼠标悬停到对话列表项时，删除按钮（红色垃圾桶 SVG 图标）显示过小。

## 当前实现分析

查看代码发现删除按钮的 SVG 尺寸设置为 16x16：

```vue
<button class="conversation-select__delete-btn">
  <svg width="16" height="16" viewBox="0 0 24 24" ...>
    <!-- 垃圾桶图标路径 -->
  </svg>
</button>
```

对应的样式：
```scss
&__delete-btn {
  width: 20px;
  height: 20px;
  // ...
  svg {
    width: 16px;
    height: 16px;
  }
}
```

## 修复方案

增大删除按钮和 SVG 图标的尺寸：

1. **增大按钮容器尺寸**：从 20px 增大到 24px
2. **增大 SVG 图标尺寸**：从 16px 增大到 20px
3. **同步调整 HTML 中的 SVG 属性**：将 `width="16" height="16"` 改为 `width="20" height="20"`

## 具体修改

### 文件: `src/components/ai/ConversationSelect.vue`

#### 修改 1: HTML 中的 SVG 尺寸
```vue
<!-- 修改前 -->
<svg width="16" height="16" viewBox="0 0 24 24" ...>

<!-- 修改后 -->
<svg width="20" height="20" viewBox="0 0 24 24" ...>
```

#### 修改 2: SCSS 样式
```scss
// 修改前
&__delete-btn {
  width: 20px;
  height: 20px;
  // ...
  svg {
    width: 16px;
    height: 16px;
  }
}

// 修改后
&__delete-btn {
  width: 24px;
  height: 24px;
  // ...
  svg {
    width: 20px;
    height: 20px;
  }
}
```

## 预期效果
删除按钮图标从 16px 增大到 20px，按钮容器从 20px 增大到 24px，使图标更加清晰可见。
