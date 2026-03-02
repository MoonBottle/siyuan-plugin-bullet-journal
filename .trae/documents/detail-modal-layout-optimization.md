# 详情弹框布局优化计划（左右分栏：左侧项目+分组链接 + 右侧任务+事项）

## 布局方案：左右分栏（链接分组在左下）

```
┌─────────────────────────────────────────────────────┐
│  📋 事项详情                                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────┬───────────────────────────┐  │
│  │                  │                           │  │
│  │  📁              │  📝 mqtt物模型及接口      │  │
│  │  智能门禁        │     文档编写              │  │
│  │                  │                           │  │
│  │                  │  🏷️ L1                    │  │
│  │                  │                           │  │
│  │                  │  ─────────────────────    │  │
│  │                  │                           │  │
│  │                  │  📅 2026-01-14            │  │
│  │                  │                           │  │
│  │                  │  参考安将军的接口文档     │  │
│  │                  │  编写mqtt物模型及接口...  │  │
│  │                  │                           │  │
│  ├──────────────────┤                           │  │
│  │  项目链接        │                           │  │
│  │  [甘特图]        │                           │  │
│  │                  │                           │  │
│  │  任务链接        │                           │  │
│  │  [查看任务]      │                           │  │
│  └──────────────────┴───────────────────────────┘  │
│                                                     │
│                          [取消]  [打开文档]         │
└─────────────────────────────────────────────────────┘
```

## 布局说明

| 区域 | 位置 | 内容 |
|------|------|------|
| **左上** | 左侧上部 | 项目图标 + 名称 |
| **左下** | 左侧下部 | 分组链接（项目链接一组、任务链接一组） |
| **右侧** | 整个右侧 | 任务（名称+级别）+ 事项（时间+内容） |

## 左侧链接分组结构

```
┌──────────┐
│          │
│   📁     │  ← 项目图标
│          │
│  智能门禁│  ← 项目名称
│          │
│          │  ← 弹性空间
├──────────┤
│ 项目链接 │  ← 分组标题（小字、灰色）
│ [甘特图] │  ← 项目链接
│          │
│ 任务链接 │  ← 分组标题（小字、灰色）
│ [查看任务│  ← 任务链接
└──────────┘
```

## 视觉层次

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  左侧（项目+链接）      右侧（任务+事项）            │
│  ┌──────────┐         ┌────────────────────────┐   │
│  │ 📁       │         │ 📝 任务名称            │   │
│  │ 项目名称 │         │ 🏷️ L1                  │   │
│  │          │         │ ─────────────────────  │   │
│  │          │         │ 📅 时间                │   │
│  │          │         │ 事项内容...            │   │
│  ├──────────┤         │                        │   │
│  │ 项目链接 │         │                        │   │
│  │ [链接]   │         │                        │   │
│  │          │         │                        │   │
│  │ 任务链接 │         │                        │   │
│  │ [链接]   │         │                        │   │
│  └──────────┘         └────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## 样式细节

### 左侧链接分组样式

```scss
.sy-dialog-link-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}

.sy-dialog-link-group-title {
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sy-dialog-link-group-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}
```

### 链接分组之间的间距

```scss
.sy-dialog-links {
  display: flex;
  flex-direction: column;
  gap: 16px;  // 项目链接组和任务链接组之间的间距
  align-items: center;
}
```

## 代码结构

### HTML 结构
```html
<div class="sy-dialog-body">
  <!-- 左侧：项目 + 分组链接 -->
  <div class="sy-dialog-left">
    <!-- 上部：项目信息 -->
    <div class="sy-dialog-project">
      <div class="sy-dialog-project-icon">📁</div>
      <div class="sy-dialog-project-name">智能门禁</div>
    </div>
    
    <!-- 下部：分组链接 -->
    <div class="sy-dialog-links">
      <!-- 项目链接组 -->
      <div class="sy-dialog-link-group">
        <div class="sy-dialog-link-group-title">项目链接</div>
        <div class="sy-dialog-link-group-items">
          <a class="sy-dialog-link-tag">甘特图</a>
        </div>
      </div>
      
      <!-- 任务链接组 -->
      <div class="sy-dialog-link-group">
        <div class="sy-dialog-link-group-title">任务链接</div>
        <div class="sy-dialog-link-group-items">
          <a class="sy-dialog-link-tag">查看任务</a>
        </div>
      </div>
    </div>
  </div>
  
  <!-- 右侧：任务 + 事项 -->
  <div class="sy-dialog-right">
    <!-- 任务 -->
    <div class="sy-dialog-task">
      <div class="sy-dialog-task-name">mqtt物模型及接口文档编写</div>
      <div class="sy-dialog-task-level">🏷️ L1</div>
    </div>
    
    <!-- 分隔线 -->
    <div class="sy-dialog-divider"></div>
    
    <!-- 事项 -->
    <div class="sy-dialog-item">
      <div class="sy-dialog-item-time">📅 2026-01-14</div>
      <div class="sy-dialog-item-content">
        参考安将军的接口文档编写mqtt物模型及接口文档提供给另一家人脸识别设备厂商
      </div>
    </div>
  </div>
</div>
```

### 完整 CSS 样式
```scss
.sy-dialog-body {
  display: flex;
  min-height: 240px;
}

// 左侧区域
.sy-dialog-left {
  width: 120px;
  background: var(--b3-theme-surface);
  border-radius: 8px 0 0 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

// 项目信息（上部）
.sy-dialog-project {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.sy-dialog-project-icon {
  font-size: 24px;
}

.sy-dialog-project-name {
  font-size: 14px;
  font-weight: 500;
  text-align: center;
  color: var(--b3-theme-on-background);
}

// 链接区域（下部）
.sy-dialog-links {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  width: 100%;
}

// 链接分组
.sy-dialog-link-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  width: 100%;
}

.sy-dialog-link-group-title {
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sy-dialog-link-group-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  width: 100%;
}

// 链接标签
.sy-dialog-link-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  background: var(--b3-theme-primary-light);
  color: var(--b3-theme-primary);
  border-radius: 4px;
  font-size: 12px;
  text-decoration: none;
  cursor: pointer;
  width: 100%;
  max-width: 90px;
  
  &:hover {
    opacity: 0.8;
  }
}

// 右侧区域
.sy-dialog-right {
  flex: 1;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sy-dialog-task {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sy-dialog-task-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
}

.sy-dialog-task-level {
  font-size: 13px;
  color: var(--b3-theme-on-surface);
}

.sy-dialog-divider {
  height: 1px;
  background: var(--b3-border-color);
  margin: 4px 0;
}

.sy-dialog-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sy-dialog-item-time {
  font-size: 13px;
  color: var(--b3-theme-on-surface);
}

.sy-dialog-item-content {
  font-size: 13px;
  line-height: 1.6;
  color: var(--b3-theme-on-background);
}
```

## 链接分组显示逻辑

| 场景 | 显示方式 |
|------|----------|
| 有项目链接，无任务链接 | 只显示"项目链接"组 |
| 无项目链接，有任务链接 | 只显示"任务链接"组 |
| 都有 | 两组都显示，中间有间距 |
| 都没有 | 左侧只显示项目名，链接区域隐藏 |

## 代码修改

### 1. src/index.scss

新增样式类：
- `.sy-dialog-body` - 左右分栏容器
- `.sy-dialog-left` - 左侧区域
- `.sy-dialog-project` - 项目信息（上部）
- `.sy-dialog-links` - 链接区域（下部）
- `.sy-dialog-link-group` - 链接分组
- `.sy-dialog-link-group-title` - 分组标题
- `.sy-dialog-link-group-items` - 分组内链接列表
- `.sy-dialog-link-tag` - 链接标签
- `.sy-dialog-right` - 右侧区域
- `.sy-dialog-task` - 任务区域
- `.sy-dialog-item` - 事项区域
- `.sy-dialog-divider` - 分隔线

### 2. src/utils/dialog.ts

重构 `showEventDetailModal`：
- 左侧：项目信息 + 分组链接（项目链接组、任务链接组）
- 右侧：任务 + 事项
- 链接按类型分组显示

## 实现步骤

1. 添加左右分栏样式（链接分组在左下）
2. 重构弹框 HTML 结构
3. 项目链接和任务链接分别放入不同组
4. 验证不同数据情况（只有项目链接、只有任务链接、都有、都没有）

## 文件变更

| 文件 | 变更 |
|------|------|
| `src/index.scss` | 添加左右分栏布局样式（链接分组） |
| `src/utils/dialog.ts` | 重构为左右分栏 HTML，链接按项目/任务分组 |

## 预期效果

- 项目突出：左侧独立展示
- 链接分组清晰：项目链接、任务链接分开显示
- 内容清晰：右侧专注展示任务和事项详情
- 层次分明：项目 → 任务 → 事项
