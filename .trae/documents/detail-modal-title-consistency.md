# 详情弹框标题一致性修复计划

## 问题

弹框标题不一致：
- 从日历打开：显示"aaa联调"（事项名称）
- 从todo dock打开：显示"事项详情"

## 期望

统一显示为"事项详情"

## 代码分析

需要检查两个入口的弹框调用：

1. **日历入口** - `showEventDetailModal(event)`
   - 使用 `event.title` 作为弹框标题
   - 位置：`src/utils/dialog.ts` 中的 `showEventDetailModal`

2. **Todo Dock入口** - `showItemDetailModal(item)`
   - 使用固定标题"事项详情"
   - 位置：`src/utils/dialog.ts` 中的 `showItemDetailModal`

## 修复方案

统一两个函数的标题为"事项详情"：

### src/utils/dialog.ts

**showEventDetailModal 修改：**
```typescript
const dialog = createDialog({
  title: '事项详情',  // 统一为固定标题
  content,
  width: '520px',
});
```

**showItemDetailModal 保持不变：**
```typescript
const dialog = createDialog({
  title: '事项详情',
  content,
  width: '520px',
});
```

## 实现步骤

1. 修改 `showEventDetailModal` 的标题为固定值"事项详情"
2. 验证两个入口的弹框标题一致

## 文件变更

| 文件 | 变更 |
|------|------|
| `src/utils/dialog.ts` | `showEventDetailModal` 标题改为固定值"事项详情" |

## 预期效果

无论从日历还是todo dock打开，弹框标题都显示"事项详情"
