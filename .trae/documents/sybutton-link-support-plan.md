# SyButton 组件扩展计划：支持链接按钮

## 目标
扩展 `SyButton.vue` 组件的能力，使其支持类似 `ItemDetailDialog.vue` 中链接标签的样式和功能，并替换 `ItemDetailDialog.vue` 中的原生 `<a>` 标签。

## 当前状态分析

### ItemDetailDialog.vue 中的链接按钮（L26-36）
```vue
<a
  v-for="link in projectLinks"
  :key="link.url"
  :href="link.url"
  target="_blank"
  class="link-tag b3-tooltips"
  :aria-label="link.name"
  @click.prevent.stop="openLink(link.url)"
>
  {{ formatLinkDisplay(link.name).display }}
</a>
```

**样式特征（.link-tag）：**
- 内联弹性布局
- 内边距：4px 8px
- 字体大小：12px
- 主色调文字
- 浅色背景
- 圆角：4px
- 无下划线
- 悬停时背景变为主色，文字变为白色
- 最大宽度 150px，溢出时省略号

**Hover Tip 效果：**
- 使用 `b3-tooltips` 类实现 tooltip
- 链接名称超过 12 个字符时截断显示，hover 时显示完整名称
- 通过 `formatLinkForDisplay()` 和 `showLinkTooltip()` / `hideLinkTooltip()` 实现

### 当前 SyButton.vue
- 仅支持图标按钮（使用 SVG icon）
- 24x24 固定尺寸
- 支持 tooltip（通过 aria-label + `showIconTooltip` / `hideIconTooltip`）
- 支持点击和键盘事件

## 实现方案

### 1. 扩展 SyButton 组件 Props

新增以下 props：
- `type`: 'icon' | 'link' - 按钮类型，默认为 'icon'
- `text`: string - 链接按钮显示的文本（type='link' 时使用）
- `href`: string - 链接地址（type='link' 时使用）
- `maxWidth`: number - 最大宽度（链接类型时用于文本截断，默认 150）
- `tooltip`: string - 自定义 tooltip 文本（可选，不传时使用 text）

### 2. 模板调整

根据 `type` 动态渲染：
- `type='icon'`（默认）：保持现有图标按钮实现
- `type='link'`：渲染链接样式按钮，支持文本显示和 hover tip

### 3. 样式调整

新增链接按钮样式类 `.sy-link-btn`，移植 `.link-tag` 的所有样式特征：
- 内联弹性布局、内边距、字体大小、颜色、背景、圆角
- 悬停效果
- 文本截断和省略号

### 4. Hover Tip 实现

链接类型时：
- 如果文本被截断（超过 maxWidth），hover 时显示完整文本 tooltip
- 复用现有的 `showLinkTooltip` / `hideLinkTooltip` 函数
- 通过 `mouseenter` / `mouseleave` 事件触发

### 5. 替换 ItemDetailDialog.vue

将 `ItemDetailDialog.vue` 中的三个 `<a>` 标签循环替换为 `SyButton` 组件：
- 项目卡片 footer（L26-36）
- 任务卡片 footer（L65-75）
- 事项卡片 footer（L139-149）

## 详细步骤

### 步骤 1：扩展 SyButton.vue
1. 添加新的 props 定义（type, text, href, maxWidth, tooltip）
2. 修改模板以支持两种类型渲染
3. 添加链接按钮样式（.sy-link-btn）
4. 添加点击处理逻辑（链接类型时打开新窗口）
5. 添加 hover tip 逻辑（使用 showLinkTooltip / hideLinkTooltip）
6. 添加文本截断计算逻辑

### 步骤 2：更新 ItemDetailDialog.vue
1. 导入 SyButton 组件
2. 替换项目卡片的链接循环
3. 替换任务卡片的链接循环
4. 替换事项卡片的链接循环
5. 移除不再需要的 `.link-tag` 样式和 formatLinkDisplay 函数

## 预期结果
- SyButton 组件支持图标按钮和链接按钮两种模式
- 链接按钮支持 hover tip 效果（文本截断时显示完整文本）
- ItemDetailDialog.vue 使用 SyButton 替代原生 `<a>` 标签
- 视觉和交互效果保持一致
