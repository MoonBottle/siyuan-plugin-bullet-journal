# Pomodoro 设置实时生效修复计划

## 问题描述

在 `PomodoroConfigSection.vue` 中修改番茄钟设置（如"底栏进度条"、"底栏倒计时"、"悬浮番茄按钮"）后，页面没有实时生效，需要刷新页面才能看到变化。

## 根本原因分析

### 1. 设置保存后缺少番茄钟 UI 更新机制

**文件**: `src/components/settings/SettingsDialog.vue`

`handleSave()` 方法保存设置后只触发了 `DATA_REFRESH` 事件：

```typescript
async function handleSave() {
  props.plugin.updateSettings(local);
  await props.plugin.saveSettings();
  const settings = props.plugin.getSettings();
  eventBus.emit(Events.DATA_REFRESH, settings);
  broadcastDataRefresh(settings as object);
  // ...
}
```

但 `DATA_REFRESH` 事件主要用于刷新数据，没有针对番茄钟 UI 控制（状态栏、悬浮按钮）的专门处理。

### 2. index.ts 中没有监听设置变更事件

**文件**: `src/index.ts`

- `initStatusBarTimer()` 只在 `onLayoutReady()` 中调用一次（L136-L138）
- 当用户修改 `enableStatusBarTimer` 后，没有机制来动态显示/隐藏底栏倒计时
- `showFloatingTomatoButton()` 和 `showStatusBarTimer()` 只在特定事件（如番茄钟开始）时被调用，没有监听设置变更来动态显示/隐藏

### 3. 缺少设置变更后的动态显示/隐藏逻辑

当前代码中：
- `showFloatingTomatoButton()` - 仅在番茄钟开始/恢复时调用
- `showStatusBar()` - 仅在番茄钟进行中根据设置显示
- `showStatusBarTimer()` - 仅在 `initStatusBarTimer()` 和番茄钟进行中调用
- `hideStatusBarTimer()` - 从未在设置变更时被调用

## 修复方案

### 方案概述

在设置保存后，通过事件通知插件主类更新番茄钟 UI 的显示/隐藏状态。

### 具体步骤

#### 1. 在 SettingsDialog.vue 中保存设置后触发番茄钟设置变更事件

**文件**: `src/components/settings/SettingsDialog.vue`

在 `handleSave()` 方法中，保存设置后添加对番茄钟设置变更的处理：

```typescript
async function handleSave() {
  // ... 现有代码 ...
  
  props.plugin.updateSettings(local);
  await props.plugin.saveSettings();
  const settings = props.plugin.getSettings();
  
  // 触发数据刷新事件
  eventBus.emit(Events.DATA_REFRESH, settings);
  broadcastDataRefresh(settings as object);
  
  // 触发设置变更事件，通知插件主类更新 UI
  eventBus.emit(Events.SETTINGS_CHANGED, settings);
  
  // ... 现有代码 ...
}
```

#### 2. 在 index.ts 中添加对 SETTINGS_CHANGED 事件的监听

**文件**: `src/index.ts`

在 `initFloatingTomatoButton()` 方法中添加对 `SETTINGS_CHANGED` 事件的监听：

```typescript
private initFloatingTomatoButton() {
  // ... 现有事件监听 ...
  
  // 监听设置变更事件，动态更新番茄钟 UI 显示/隐藏
  eventBus.on(Events.SETTINGS_CHANGED, () => {
    this.updatePomodoroUIVisibility();
  });
}
```

#### 3. 添加 updatePomodoroUIVisibility 方法

**文件**: `src/index.ts`

添加一个新方法来根据当前设置更新番茄钟 UI 的显示/隐藏：

```typescript
/**
 * 根据设置更新番茄钟 UI 的显示/隐藏
 * 在设置变更后调用，确保 UI 状态与设置同步
 */
private updatePomodoroUIVisibility() {
  const pomodoro = this.getSettings().pomodoro ?? defaultPomodoroSettings;
  const pinia = getSharedPinia();
  const pomodoroStore = pinia ? usePomodoroStore(pinia) : null;
  const hasActivePomodoro = pomodoroStore?.isFocusing || pomodoroStore?.isBreakActive;

  // 更新底栏倒计时显示
  if (pomodoro.enableStatusBarTimer === true) {
    this.showStatusBarTimer();
    // 如果没有进行中的番茄钟，显示默认状态
    if (!hasActivePomodoro) {
      this.updateStatusBarTimerDisplay(false, '', false);
    }
  } else {
    this.hideStatusBarTimer();
  }

  // 更新底栏进度条显示（仅在番茄钟进行中时）
  if (hasActivePomodoro) {
    if (pomodoro.enableStatusBar === true) {
      this.showStatusBar();
    } else {
      this.hideStatusBar();
    }

    // 更新悬浮按钮显示
    if (pomodoro.enableFloatingButton !== false) {
      this.showFloatingTomatoButton();
    } else {
      this.hideFloatingTomatoButton();
    }
  }
}
```

#### 4. 确保 onLayoutReady 中也调用 updatePomodoroUIVisibility

**文件**: `src/index.ts`

修改 `onLayoutReady()` 方法：

```typescript
onLayoutReady() {
  this.updatePomodoroUIVisibility();
}
```

### 修改文件清单

1. `src/components/settings/SettingsDialog.vue` - 添加 SETTINGS_CHANGED 事件触发
2. `src/index.ts` - 添加事件监听和 updatePomodoroUIVisibility 方法

### 验证步骤

1. 打开设置对话框
2. 修改番茄钟设置（如开启/关闭"底栏倒计时"）
3. 保存设置
4. 验证底栏倒计时立即显示/隐藏，无需刷新页面
5. 重复测试其他设置项（底栏进度条、悬浮番茄按钮）
