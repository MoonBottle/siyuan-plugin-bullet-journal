# 系统级通知支持计划

## 目标
将专注完成的通知从思源内部通知改为系统级通知（桌面通知），使用户在专注完成时即使不处于思源窗口也能收到提醒。

## 实现方案

### 方案：使用 Web Notifications API
使用浏览器原生的 Notification API 来发送系统级桌面通知。

**优点：**
- 原生支持，无需额外依赖
- 跨平台兼容（Windows、macOS、Linux）
- 思源插件环境已支持

**实现步骤：**

1. **请求通知权限**
   - 在插件初始化时请求用户授权显示通知
   - 如果用户拒绝，回退到思源内部通知

2. **创建通知工具函数**
   - 在 `src/utils/notification.ts` 创建 `showSystemNotification()` 函数
   - 封装 Notification API 的调用
   - 处理权限检查和错误回退

3. **修改专注完成通知**
   - 在 `pomodoroStore.ts` 的 `completePomodoro()` 方法中
   - 调用系统通知替代 `showMessage()`
   - 通知内容包含专注的事项名称和时长

4. **添加通知点击处理**
   - 点击通知时聚焦思源窗口
   - 使用思源的 `openWindow` 或类似 API

## 详细步骤

### Step 1: 创建通知工具模块
文件：`src/utils/notification.ts`

```typescript
/**
 * 请求通知权限
 */
export async function requestNotificationPermission(): Promise<boolean>

/**
 * 显示系统级通知
 * @param title 通知标题
 * @param body 通知内容
 * @param onClick 点击回调
 */
export function showSystemNotification(
  title: string,
  body: string,
  onClick?: () => void
): void
```

### Step 2: 修改 PomodoroStore
文件：`src/stores/pomodoroStore.ts`

- 导入通知工具函数
- 在 `completePomodoro()` 中调用系统通知
- 通知标题："专注完成"
- 通知内容："已完成：{事项内容}（{时长}分钟）"

### Step 3: 初始化权限请求
文件：`src/tabs/PomodoroDock.vue`

- 在 `onMounted` 中请求通知权限
- 可选：在设置中添加开关让用户控制是否启用系统通知

## 通知内容设计

### 专注完成通知
- **标题**：专注完成 🎉
- **内容**：已完成：{事项内容}
- **图标**：番茄钟图标 🍅

### 点击行为
- 点击通知后聚焦思源窗口
- 切换到番茄钟 Dock 面板

## 兼容性处理

1. **权限被拒绝**：回退到思源内部 `showMessage` 通知
2. **不支持 Notification API**：回退到思源内部通知
3. **思源处于后台**：系统通知仍能正常显示

## 文件变更

### 新增文件
- `src/utils/notification.ts` - 系统通知工具函数

### 修改文件
- `src/stores/pomodoroStore.ts` - 使用系统通知
- `src/tabs/PomodoroDock.vue` - 请求通知权限

## 验收标准

- [ ] 专注完成时显示系统级桌面通知
- [ ] 通知包含事项名称和专注时长
- [ ] 点击通知可聚焦思源窗口
- [ ] 权限被拒绝时回退到思源内部通知
- [ ] 不支持的浏览器回退到思源内部通知
