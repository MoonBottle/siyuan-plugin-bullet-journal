# 通知图标添加计划

## 目标
为系统通知（Notification）添加图标，在通知左上角显示插件 logo 或相关图标。

## 当前状态
当前 `notification.ts` 中的 `showPomodoroCompleteNotification` 函数没有设置 icon 参数：

```typescript
export function showPomodoroCompleteNotification(
  itemContent: string,
  durationMinutes: number,
  onClick?: () => void
): Notification | null {
  const title = '专注完成 🎉';
  const body = `已完成：${itemContent}（${durationMinutes}分钟）`;

  return showSystemNotification(title, body, {
    tag: 'pomodoro-complete',
    onClick,
  });
}
```

## 可用图标资源
- 插件图标：`/icon.png`（位于项目根目录）

## 实施方案

### 方案：使用插件图标
在 `showPomodoroCompleteNotification` 函数中添加 icon 参数，使用插件的 icon.png 作为通知图标。

由于系统通知需要完整的 URL，需要：
1. 构建时获取插件图标的完整路径
2. 或者使用 data URL 嵌入图标

### 具体修改

修改 `notification.ts` 中的 `showPomodoroCompleteNotification` 函数：

```typescript
export function showPomodoroCompleteNotification(
  itemContent: string,
  durationMinutes: number,
  onClick?: () => void
): Notification | null {
  const title = '专注完成 🎉';
  const body = `已完成：${itemContent}（${durationMinutes}分钟）`;

  return showSystemNotification(title, body, {
    tag: 'pomodoro-complete',
    icon: '/icon.png', // 添加图标
    onClick,
  });
}
```

## 注意事项
1. 系统通知的图标需要是完整的 URL 或相对于当前页面的路径
2. 在思源笔记环境中，可能需要使用绝对路径或 data URL
3. 如果图标加载失败，通知仍会正常显示，只是没有图标

## 实施步骤
1. 修改 `notification.ts`，在 `showPomodoroCompleteNotification` 中添加 icon 参数
2. 测试通知是否正常显示图标
