# 番茄钟自动恢复计划

## 问题描述

当前番茄钟的恢复逻辑在 `PomodoroDock.vue` 组件的 `onMounted` 钩子中执行：
- 如果用户重新加载软件后没有点击打开番茄钟 dock
- 恢复逻辑不会执行
- 导致进行中的番茄计时无法自动恢复

## 解决方案

将番茄钟恢复逻辑从组件级别移到插件级别，在 `index.ts` 的 `onload()` 方法中自动恢复。

## 实现步骤

### 1. 在 `index.ts` 中导入 pomodoroStore

```typescript
import { usePomodoroStore } from '@/stores';
```

### 2. 在 `onload()` 方法末尾添加恢复逻辑

在 `initFloatingTomatoButton()` 调用之后，添加：

```typescript
// 自动恢复进行中的番茄钟（不依赖 dock 是否打开）
await this.restorePomodoroState();
```

### 3. 添加 `restorePomodoroState` 方法

在 `index.ts` 的 `HKWorkPlugin` 类中添加：

```typescript
/**
 * 恢复进行中的番茄钟状态
 * 在插件加载时自动调用，不依赖 dock 是否打开
 */
private async restorePomodoroState() {
  try {
    // 动态导入 store 避免初始化问题
    const { usePomodoroStore } = require('@/stores');
    const pomodoroStore = usePomodoroStore();
    
    // 从文件读取进行中的番茄钟
    const restored = await pomodoroStore.restorePomodoro(this);
    if (restored) {
      console.log('[HKWorkPlugin] 番茄钟状态已自动恢复');
    } else {
      console.log('[HKWorkPlugin] 没有进行中的番茄钟需要恢复');
    }
  } catch (error) {
    console.error('[HKWorkPlugin] 恢复番茄钟状态失败:', error);
  }
}
```

### 4. （可选）从 `PomodoroDock.vue` 中移除重复逻辑

如果担心重复恢复，可以考虑：
- 保留 dock 中的恢复逻辑作为备用
- 或者在 store 中添加标志位防止重复恢复

建议保留两者，因为：
- `index.ts` 的恢复确保插件加载时自动恢复
- `PomodoroDock.vue` 的恢复确保 dock 打开时状态是最新的
- `restorePomodoro` 方法内部有重复检查逻辑

## 文件变更

### 修改文件
1. `src/index.ts` - 添加恢复逻辑和方法

### 可选修改
2. `src/tabs/PomodoroDock.vue` - 可以保留或移除恢复逻辑

## 预期效果

- 用户重新加载思源笔记后，即使不打开番茄钟 dock
- 进行中的番茄计时也会自动恢复
- 悬浮番茄按钮会正常显示
- 倒计时正常进行
