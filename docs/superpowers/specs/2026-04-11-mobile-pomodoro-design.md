# 移动端番茄钟适配设计方案

> 日期：2026-04-11  
> 项目：思源笔记任务助手插件  
> 作者：Claude

---

## 1. 概述

为「任务助手」插件优化移动端体验，包括：
- 移动端跳过桌面 Tab 注册
- 待办列表添加下拉刷新
- 底部导航刷新按钮改为番茄钟入口
- 创建完整的移动端番茄钟 UI 套件

---

## 2. 设计规范

### 2.1 视觉风格（参考 QuickCreateDrawer）

| 元素 | 规范 |
|------|------|
| **抽屉结构** | Teleport to body + fade/slide-up 双层动画 |
| **圆角** | 顶部 24px，内部卡片 12px，按钮 12px |
| **动画** | 0.2s ease，点击 scale(0.98)，滑入 cubic-bezier(0.32, 0.72, 0, 1) |
| **颜色** | 思源主题变量 `--b3-theme-*` |
| **阴影** | `0 -4px 24px rgba(0, 0, 0, 0.15)` |
| **安全区域** | `env(safe-area-inset-bottom)` 底部适配 |
| **表单区块** | `form-section` + `section-label` |
| **按钮** | 底部双按钮（cancel-btn + confirm-btn）|
| **字体** | 标题 17px font-weight: 600，正文 15px，辅助 13px |

### 2.2 交互规范

- **触摸目标**：最小 44×44px
- **点击反馈**：scale(0.98) + 0.2s ease
- **列表滚动**：原生滚动，支持下拉刷新
- **抽屉关闭**：点击遮罩、点击手柄、下滑手势

---

## 3. 功能设计

### 3.1 移动端 Tab 注册控制

**文件**：`src/index.ts`

**修改点**：
```typescript
private registerTabs() {
  // 桌面端才注册这些 Tabs
  if (!this.isMobile) {
    this.addTab({ type: TAB_TYPES.CALENDAR, ... });
    this.addTab({ type: TAB_TYPES.GANTT, ... });
    this.addTab({ type: TAB_TYPES.PROJECT, ... });
    this.addTab({ type: TAB_TYPES.POMODORO_STATS, ... });
  }
  // ...其他逻辑
}
```

**原因**：移动端屏幕空间有限，Tabs 体验不佳，统一使用 Dock 模式。

---

### 3.2 下拉刷新

**文件**：`src/tabs/mobile/components/MobileTodoList.vue`

**实现**：
- 添加 touch 事件监听（touchstart/touchmove/touchend）
- 下拉距离 > 80px 触发刷新
- 刷新指示器：旋转动画 + 文字提示（"下拉刷新"/"释放刷新"/"刷新中..."）
- 触发 `projectStore.refresh()` 重新加载数据

**视觉设计**：
```
┌─────────────────────┐
│    ↓ 下拉刷新        │  <- 下拉时显示
├─────────────────────┤
│                     │
│    待办列表内容       │
│                     │
└─────────────────────┘
```

---

### 3.3 底部导航重构

**文件**：`src/tabs/mobile/components/MobileBottomNav.vue`

**修改前**：
```
┌─────────────────────────────────────┐
│  [↻ 刷新]      [➕]    [⚙️ 更多]   │
└─────────────────────────────────────┘
```

**修改后**：
```
┌─────────────────────────────────────┐
│  [🍅 番茄钟]   [➕]    [⚙️ 更多]   │
└─────────────────────────────────────┘
```

**行为**：
- 点击番茄钟图标 → 打开 `MobilePomodoroDrawer`
- 中间创建按钮保持不变
- 右侧更多按钮保持不变

---

## 4. 番茄钟 UI 架构

### 4.1 组件结构

```
src/tabs/mobile/
├── MobileTodoDock.vue
├── components/
│   ├── MobileBottomNav.vue          # 修改：刷新 → 番茄钟
│   ├── MobileTodoList.vue           # 修改：添加下拉刷新
│   └── MobilePomodoroTrigger.vue    # 新增：番茄钟触发按钮
└── drawers/
    ├── MobilePomodoroDrawer.vue     # 新增：番茄钟主抽屉
    └── pomodoro/
        ├── MobileTimerStarter.vue   # 新增：开始专注
        ├── MobileActiveTimer.vue    # 新增：专注中
        ├── MobileBreakTimer.vue     # 新增：休息中
        └── MobileComplete.vue       # 新增：专注完成
```

### 4.2 状态流转

```
                    点击番茄钟按钮
                         │
                         ↓
    ┌────────────────────┴────────────────────┐
    │           MobilePomodoroDrawer           │
    │    根据 pomodoroStore 状态显示不同视图     │
    └────────────────────┬────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ↓                ↓                ↓
   ┌─────────┐    ┌────────────┐    ┌───────────┐
   │  空闲   │    │  专注中    │    │  休息中   │
   │         │    │            │    │           │
   │Starter  │    │ActiveTimer │    │BreakTimer │
   │选择事项 │    │倒计时+控制 │    │休息倒计时 │
   │开始专注 │    │           │    │跳过休息  │
   └────┬────┘    └─────┬──────┘    └─────┬─────┘
        │               │                  │
        │ 开始专注      │ 专注完成         │ 休息结束
        ↓               ↓                  ↓
   ┌─────────┐    ┌────────────┐    ┌───────────┐
   │ActiveTimer│   │  Complete  │    │  Starter  │
   └─────────┘    │ 专注完成抽屉│    │  空闲状态 │
                  └─────┬──────┘    └───────────┘
                        │
           ┌────────────┴────────────┐
           ↓                         ↓
      ┌─────────┐              ┌───────────┐
      │ 保存记录 │              │ 废弃记录  │
      │ 显示休息选项│            │ 直接关闭  │
      └────┬────┘              └───────────┘
           │
           ↓
      ┌───────────┐
      │ 休息选项   │
      │ 5/10/15分钟│
      └─────┬─────┘
            │
    ┌───────┴───────┐
    ↓               ↓
┌───────────┐   ┌───────────┐
│ 开始休息  │   │ 跳过休息  │
│BreakTimer │   │ 关闭抽屉  │
└───────────┘   └───────────┘
```

---

## 5. 组件详细设计

### 5.1 MobilePomodoroDrawer.vue

**职责**：番茄钟主容器，根据 store 状态切换子视图

**Props**：
| 属性 | 类型 | 说明 |
|------|------|------|
| modelValue | boolean | 显示/隐藏 |

**状态判断**：
```typescript
const currentView = computed(() => {
  if (pomodoroStore.isFocusing) return 'active';
  if (pomodoroStore.isBreakActive) return 'break';
  return 'starter';
});
```

**结构**：
```vue
<Teleport to="body">
  <Transition name="fade">
    <div class="drawer-overlay" @click="close">
      <Transition name="slide-up">
        <div class="pomodoro-drawer" @click.stop>
          <!-- 拖动手柄 -->
          <div class="drawer-handle" @click="close">
            <div class="handle-bar"></div>
          </div>
          
          <!-- 动态内容 -->
          <div class="drawer-content">
            <MobileTimerStarter v-if="currentView === 'starter'" />
            <MobileActiveTimer v-else-if="currentView === 'active'" />
            <MobileBreakTimer v-else-if="currentView === 'break'" />
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</Teleport>
```

---

### 5.2 MobileTimerStarter.vue

**职责**：选择事项、设置时长、开始专注

**数据结构**：
```typescript
const selectedItem = ref<Item | null>(null);
const timerMode = ref<'countdown' | 'stopwatch'>('countdown');
const selectedDuration = ref(25); // 默认25分钟
const customDuration = ref(25);
```

**UI 结构**：
```
┌─────────────────────────────┐
│         拖动手柄             │
├─────────────────────────────┤
│                             │
│   ┌─────────────────────┐   │
│   │  📋 选择专注事项     │   │  <- selector-btn
│   │   Chest + Triceps   │   │
│   └─────────────────────┘   │
│                             │
│   计时模式                   │
│   ┌──────────┬──────────┐   │
│   │ 倒计时   │ 正计时   │   │  <- 分段控制器
│   └──────────┴──────────┘   │
│                             │
│   专注时长                   │
│   ┌────┬────┬────┬────┐    │
│   │ 15 │ 25 │ 45 │ 60 │    │  <- 快速选择
│   └────┴────┴────┴────┘    │
│                             │
│   自定义 __25__ 分钟        │
│                             │
├─────────────────────────────┤
│   [取消]      [开始专注]    │  <- 底部双按钮
└─────────────────────────────┘
```

**事项选择 Sheet**：
- 过期事项（Expired Items）
- 今日事项（Today Items）
- 空状态提示

---

### 5.3 MobileActiveTimer.vue

**职责**：专注中状态展示、倒计时、暂停/继续/结束

**核心逻辑**：完全复用 `pomodoroStore`

**UI 结构**：
```
┌─────────────────────────────┐
│         拖动手柄             │
├─────────────────────────────┤
│                             │
│        ┌─────────┐          │
│       /           \         │
│      │   23:45   │          │  <- 圆形进度条
│      │  已专注   │          │     大字体倒计时
│       \  18分钟 /          │
│        └─────────┘          │
│                             │
│   ⏱️ 预计结束 18:30         │
│                             │
│   ┌─────────────────────┐   │
│   │ 📁 2026 Weight Loss │   │  <- 项目卡片
│   └─────────────────────┘   │
│   ┌─────────────────────┐   │
│   │ 📋 Chest + Triceps  │   │  <- 任务卡片
│   └─────────────────────┘   │
│   ┌─────────────────────┐   │
│   │ ⏳ 健身计划          │   │  <- 事项卡片
│   └─────────────────────┘   │
│                             │
├─────────────────────────────┤
│  [暂停]        [结束专注]   │  <- 底部双按钮
└─────────────────────────────┘
```

**圆形进度条**：
- SVG circle
- 半径 54px，周长 339.292px
- stroke-dasharray + stroke-dashoffset 控制进度
- 颜色：`--b3-theme-primary`

**暂停状态**：
- 进度条颜色变为灰色
- 显示 "已暂停" badge
- 按钮变为 "继续"

---

### 5.4 MobileBreakTimer.vue

**职责**：休息倒计时展示、跳过休息

**UI 结构**：
```
┌─────────────────────────────┐
│         拖动手柄             │
├─────────────────────────────┤
│                             │
│           ☕                │
│                             │
│        ┌─────────┐          │
│       /   05:00   \         │  <- 呼吸动画圆圈
│      │    休息中   │          │
│       \           /          │
│        └─────────┘          │
│                             │
│      让眼睛休息一下 👀       │
│                             │
├─────────────────────────────┤
│      [跳过休息]             │
└─────────────────────────────┘
```

**呼吸动画**：
```css
@keyframes breathe {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.1); opacity: 1; }
}
.breathing-circle {
  animation: breathe 3s ease-in-out infinite;
}
```

---

### 5.5 MobileComplete.vue

**职责**：专注完成后补填说明、选择休息

**状态 1：补填说明（未保存）**
```
┌─────────────────────────────┐
│         拖动手柄             │
├─────────────────────────────┤
│  ⚠️ 专注时间较短（3 < 5分钟）│  <- 时长警告（可选）
├─────────────────────────────┤
│                             │
│   ┌─────────────────────┐   │
│   │ 📁 2026 Weight Loss │   │
│   └─────────────────────┘   │
│   ┌─────────────────────┐   │
│   │ 📋 Chest + Triceps  │   │
│   └─────────────────────┘   │
│   ┌─────────────────────┐   │
│   │ ⏳ 健身计划          │   │
│   └─────────────────────┘   │
│                             │
│   开始时间    14:30         │
│   结束时间    14:33         │
│   专注时长    3 分钟        │
│                             │
│   专注说明                   │
│   ┌─────────────────────┐   │
│   │                     │   │  <- textarea
│   │ 今天状态不错...      │   │
│   │                     │   │
│   └─────────────────────┘   │
│                             │
├─────────────────────────────┤
│ [废弃]        [保存记录]    │  <- 底部双按钮
└─────────────────────────────┘
```

**状态 2：休息选项（已保存）**
```
┌─────────────────────────────┐
│         拖动手柄             │
├─────────────────────────────┤
│                             │
│              ☕              │
│                             │
│        专注完成！ 🎉        │
│      本次专注 25 分钟       │
│                             │
│      是否开始休息？         │
│                             │
│   ┌────┬────┬────┐         │
│   │ 5  │ 10 │ 15 │         │  <- 休息时长选择
│   └────┴────┴────┘         │
│    分钟 分钟 分钟           │
│                             │
├─────────────────────────────┤
│ [跳过休息]    [开始休息]    │  <- 底部双按钮
└─────────────────────────────┘
```

**逻辑**：
- 调用 `pomodoroStore.savePomodoroRecordFromPending()` 保存记录
- 调用 `pomodoroStore.startBreak()` 开始休息
- 监听 `POMODORO_AUTO_EXTENDED` 事件（自动延迟时关闭弹窗）

---

## 6. 数据流设计

### 6.1 状态管理

**完全复用现有 Store**：
- `pomodoroStore.ts` - 番茄钟所有状态和方法
- `projectStore.ts` - 事项数据、项目数据

**不重复实现**：
- 专注计时逻辑
- 数据持久化（active-pomodoro.json）
- 记录保存（appendBlock/setBlockAttrs）
- 休息计时逻辑

### 6.2 事件通信

```typescript
// 监听事件（与桌面版一致）
eventBus.on(Events.POMODORO_STARTED, () => {
  // 刷新 UI
});

eventBus.on(Events.POMODORO_COMPLETED, () => {
  // 显示完成抽屉
});

eventBus.on(Events.POMODORO_AUTO_EXTENDED, () => {
  // 自动延迟时关闭弹窗
});

eventBus.on(Events.BREAK_STARTED, () => {
  // 切换到休息视图
});

eventBus.on(Events.BREAK_ENDED, () => {
  // 切换到空闲视图
});
```

---

## 7. 样式规范

### 7.1 抽屉基础样式

```scss
.drawer-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  z-index: 1002;
  display: flex;
  align-items: flex-end;
}

.pomodoro-drawer {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  background: var(--b3-theme-background);
  border-radius: 24px 24px 0 0;
  max-height: 90vh;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
}

.drawer-handle {
  display: flex;
  justify-content: center;
  padding: 12px;
  cursor: pointer;
}

.handle-bar {
  width: 40px;
  height: 4px;
  background: var(--b3-theme-on-surface);
  opacity: 0.25;
  border-radius: 2px;
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 16px;
}

.drawer-footer {
  padding: 16px;
  border-top: 1px solid var(--b3-border-color);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
```

### 7.2 按钮样式

```scss
.cancel-btn {
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 500;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:active { transform: scale(0.98); }
}

.confirm-btn {
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 500;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:active { transform: scale(0.98); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}
```

### 7.3 卡片样式

```scss
.info-card {
  background: var(--b3-theme-surface);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 12px;
}

.card-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 6px;
  text-transform: uppercase;
}

.card-value {
  font-size: 15px;
  color: var(--b3-theme-on-background);
  font-weight: 500;
}
```

### 7.4 动画

```scss
// 淡入淡出
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

// 上滑
.slide-up-enter-active, .slide-up-leave-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.slide-up-enter-from, .slide-up-leave-to {
  transform: translateY(100%);
}

// 点击反馈
.clickable {
  transition: transform 0.2s ease;
  &:active { transform: scale(0.98); }
}
```

---

## 8. 实现清单

### Phase 1：基础改造
- [ ] 修改 `src/index.ts` - 移动端跳过 Tab 注册
- [ ] 修改 `MobileBottomNav.vue` - 刷新按钮改为番茄钟按钮
- [ ] 修改 `MobileTodoList.vue` - 添加下拉刷新

### Phase 2：番茄钟核心
- [ ] 创建 `MobilePomodoroDrawer.vue` - 主抽屉容器
- [ ] 创建 `MobileTimerStarter.vue` - 开始专注
- [ ] 创建 `MobileActiveTimer.vue` - 专注中
- [ ] 创建 `MobileBreakTimer.vue` - 休息中

### Phase 3：完成流程
- [ ] 创建 `MobileComplete.vue` - 专注完成抽屉
- [ ] 集成完成流程到 MobilePomodoroDrawer

### Phase 4：测试优化
- [ ] 测试各种状态流转
- [ ] 测试响应式适配
- [ ] 测试深色模式

---

## 9. 注意事项

1. **逻辑复用**：所有业务逻辑必须复用 `pomodoroStore`，不得重写
2. **事件监听**：与桌面版共用事件系统（eventBus）
3. **样式隔离**：使用 scoped style，避免污染全局
4. **主题适配**：使用思源主题变量，支持深色模式
5. **安全区域**：底部按钮适配 iPhone 刘海屏
6. **性能优化**：使用 `v-once` 或 `shallowRef` 优化大列表

---

## 10. 参考文件

- `QuickCreateDrawer.vue` - 抽屉交互和样式规范
- `PomodoroCompleteDialog.vue` - 专注完成逻辑
- `PomodoroActiveTimer.vue` - 专注中 UI 参考
- `MobilePomodoroTimerDrawer.vue` - 已有移动端开始专注抽屉
