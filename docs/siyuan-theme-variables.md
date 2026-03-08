# 思源笔记主题 CSS 变量参考

本文档整理了思源笔记中常用的 CSS 主题变量，开发插件时可使用这些变量来保持与思源主题的一致性。

## 基础颜色变量

### 主题色
| 变量名 | 说明 |
|--------|------|
| `--b3-theme-primary` | 主题主色（强调色） |
| `--b3-theme-primary-light` | 主题主色浅色版 |
| `--b3-theme-primary-lighter` | 主题主色更浅色版 |

### 背景色
| 变量名 | 说明 |
|--------|------|
| `--b3-theme-background` | 背景色（最深） |
| `--b3-theme-surface` | 表面色（中等） |
| `--b3-theme-surface-light` | 表面浅色 |
| `--b3-theme-surface-lighter` | 表面更浅色（边框常用） |

### 文字色
| 变量名 | 说明 |
|--------|------|
| `--b3-theme-on-background` | 背景上的文字色 |
| `--b3-theme-on-surface` | 表面上的文字色 |
| `--b3-theme-on-primary` | 主色上的文字色 |

## 语义化颜色变量

### 错误/警告/成功
| 变量名 | 说明 |
|--------|------|
| `--b3-theme-error` | 错误色 |
| `--b3-theme-warning` | 警告色 |
| `--b3-theme-success` | 成功色 |
| `--b3-theme-info` | 信息色 |

### 文字颜色
| 变量名 | 说明 |
|--------|------|
| `--b3-theme-on-error` | 错误色上的文字 |
| `--b3-theme-on-warning` | 警告色上的文字 |
| `--b3-theme-on-success` | 成功色上的文字 |
| `--b3-theme-on-info` | 信息色上的文字 |

## 布局变量

### 圆角
| 变量名 | 说明 |
|--------|------|
| `--b3-border-radius` | 默认圆角大小 |
| `--b3-border-radius-s` | 小圆角 |
| `--b3-border-radius-l` | 大圆角 |

### 间距
| 变量名 | 说明 |
|--------|------|
| `--b3-margin` | 默认外边距 |
| `--b3-padding` | 默认内边距 |

## 使用示例

### Vue 组件中使用

```vue
<style lang="scss" scoped>
.my-component {
  // 背景使用思源表面色
  background: var(--b3-theme-surface);
  
  // 文字使用思源背景上的文字色
  color: var(--b3-theme-on-background);
  
  // 边框使用思源表面更浅色
  border: 1px solid var(--b3-theme-surface-lighter);
  
  // 圆角使用思源默认圆角
  border-radius: var(--b3-border-radius);
  
  // 卡片使用思源背景色（与表面色形成层次）
  .card {
    background: var(--b3-theme-background);
  }
}
</style>
```

### 颜色层次建议

在插件开发中，建议按以下层次使用颜色：

1. **最外层容器**: `--b3-theme-surface`
2. **卡片/面板**: `--b3-theme-background`
3. **日期行/标题行**: `--b3-theme-background` 或 `--b3-theme-surface-light`
4. **列表项**: 透明或 `--b3-theme-background`
5. **边框**: `--b3-theme-surface-lighter`

### 深色模式适配

使用这些 CSS 变量的好处是，当用户切换思源的浅色/深色主题时，颜色会自动适配，无需额外处理。

## 参考

- 思源笔记官方文档: https://github.com/siyuan-note/siyuan
- 主题开发指南: https://github.com/siyuan-note/siyuan/blob/master/app/appearance/themes/daylight/theme.css
