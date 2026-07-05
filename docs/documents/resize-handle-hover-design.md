# ResizeHandle 悬停显示设计

## 目标
让 ProjectTab 中的拖拽调整宽度分割线默认隐藏，仅在 hover 时显示。

## 当前状态
- 文件: [ResizeHandle.vue](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/components/project/ResizeHandle.vue)
- 当前样式: 默认 `opacity: 0.5` 显示，hover 时 `opacity: 0.8`

## 修改方案
将默认状态的 `opacity: 0.5` 改为 `opacity: 0`，使分割线默认完全透明，hover 时才显示。

## 具体修改

修改 `ResizeHandle.vue` 中的样式：

```scss
&::after {
  // ... 其他样式保持不变
  opacity: 0;        // 从 0.5 改为 0
  // ...
}

&:hover::after {
  opacity: 0.8;      // 保持不变
  // ...
}

&--active::after {
  opacity: 1;        // 保持不变
  // ...
}
```

## 验证步骤
1. 修改后运行 `npm run lint` 检查代码风格
2. 在浏览器中查看 ProjectTab，确认分割线默认不可见
3. 鼠标悬停在分割线上，确认分割线显示
4. 拖拽时确认分割线保持显示（active 状态）
