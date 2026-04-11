# 移动端番茄钟适配实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为思源笔记任务助手插件实现移动端番茄钟完整功能

**Architecture:** 复用 pomodoroStore，创建纯展示层移动端组件，使用 Drawer 模式

**Tech Stack:** Vue 3 + TypeScript + Pinia + SCSS

---

## 文件清单

### 修改文件
1. `src/index.ts` - 移动端跳过 Tab 注册
2. `src/tabs/mobile/components/MobileBottomNav.vue` - 刷新→番茄钟
3. `src/tabs/mobile/MobileTodoDock.vue` - 集成抽屉
4. `src/tabs/mobile/components/MobileTodoList.vue` - 下拉刷新

### 新建文件
1. `src/tabs/mobile/drawers/MobilePomodoroDrawer.vue` - 主抽屉
2. `src/tabs/mobile/drawers/pomodoro/MobileTimerStarter.vue` - 开始专注
3. `src/tabs/mobile/drawers/pomodoro/ItemSelectorSheet.vue` - 事项选择
4. `src/tabs/mobile/drawers/pomodoro/MobileActiveTimer.vue` - 专注中
5. `src/tabs/mobile/drawers/pomodoro/MobileBreakTimer.vue` - 休息中
6. `src/tabs/mobile/drawers/pomodoro/MobileComplete.vue` - 专注完成

---

## Task 1: 移动端跳过 Tab 注册

**Files:** Modify `src/index.ts`

- [ ] **Step 1: 修改 registerTabs 方法**

找到 `registerTabs()` 方法，为 Calendar、Gantt、Project、PomodoroStats Tab 添加 `if (!this.isMobile)` 判断。

关键代码位置：
- 第 755 行：Calendar Tab（已有判断，检查确认）
- 第 773 行：Gantt Tab（添加判断）
- 第 792 行：Project Tab（添加判断）
- 第 810 行：PomodoroStats Tab（添加判断）

每个 Tab 的注册代码应包裹在 `if (!this.isMobile) { ... }` 中。

- [ ] **Step 2: Commit**

```bash
git add src/index.ts
git commit -m "feat(mobile): 移动端跳过桌面 Tab 注册"
```

---

## Task 2: 底部导航改为番茄钟按钮

**Files:** Modify `src/tabs/mobile/components/MobileBottomNav.vue`

- [ ] **Step 1: 替换左侧按钮**

将第 4-9 行的刷新按钮：
```vue
<button class="nav-item" :class="{ active: false }" @click="emit('refresh')">
  <div class="nav-icon-wrapper">
    <svg class="nav-icon"><use xlink:href="#iconRefresh"></use></svg>
  </div>
  <span class="nav-label">{{ t('common').refresh }}</span>
</button>
```

改为番茄钟按钮：
```vue
<button class="nav-item" @click="emit('open-pomodoro')">
  <div class="nav-icon-wrapper">
    <svg class="nav-icon"><use xlink:href="#iconClock"></use></svg>
  </div>
  <span class="nav-label">{{ t('pomodoro').title || '番茄钟' }}</span>
</button>
```

- [ ] **Step 2: 更新 emits**

第 35-38 行改为：
```typescript
const emit = defineEmits<{
  'open-pomodoro': [];
  create: [];
}>();
```

- [ ] **Step 3: Commit**

```bash
git add src/tabs/mobile/components/MobileBottomNav.vue
git commit -m "feat(mobile): 底部导航刷新按钮改为番茄钟入口"
```

---

## Task 3: MobileTodoDock 集成番茄钟抽屉

**Files:** Modify `src/tabs/mobile/MobileTodoDock.vue`

- [ ] **Step 1: 导入组件**

第 105 行后添加：
```typescript
import MobilePomodoroDrawer from './drawers/MobilePomodoroDrawer.vue';
```

- [ ] **Step 2: 添加状态**

第 139 行的 state 对象添加：
```typescript
showPomodoroDrawer: false,
```

- [ ] **Step 3: 修改模板**

第 21-23 行改为：
```vue
<MobileBottomNav
  @open-pomodoro="state.showPomodoroDrawer = true"
  @create="openQuickCreate"
/>
```

第 91 行后添加：
```vue
<!-- Pomodoro Drawer -->
<MobilePomodoroDrawer v-model="state.showPomodoroDrawer" />
```

- [ ] **Step 4: Commit**

```bash
git add src/tabs/mobile/MobileTodoDock.vue
git commit -m "feat(mobile): MobileTodoDock 集成番茄钟抽屉"
```

---

## Task 4: 创建 MobilePomodoroDrawer 主抽屉

**Files:** Create `src/tabs/mobile/drawers/MobilePomodoroDrawer.vue`

- [ ] **Step 1: 创建文件**

复制 `src/components/pomodoro/MobilePomodoroTimerDrawer.vue` 的基础结构，修改为：

1. 导入三个子组件：MobileTimerStarter, MobileActiveTimer, MobileBreakTimer
2. 使用 `computed` 根据 `pomodoroStore.isFocusing` 和 `isBreakActive` 决定显示哪个组件
3. 使用 `fade` 和 `slide-up` 过渡动画
4. 样式参考 QuickCreateDrawer：圆角 24px、阴影、安全区域适配

- [ ] **Step 2: Commit**

```bash
git add src/tabs/mobile/drawers/MobilePomodoroDrawer.vue
git commit -m "feat(mobile): 创建 MobilePomodoroDrawer 主抽屉"
```

---

## Task 5: 创建 MobileTimerStarter

**Files:** Create `src/tabs/mobile/drawers/pomodoro/MobileTimerStarter.vue`

- [ ] **Step 1: 创建文件**

参考 `src/components/pomodoro/MobilePomodoroTimerDrawer.vue`，提取其中的选择事项、计时模式、时长选择 UI。

关键要素：
1. 使用 `selector-btn` 样式打开事项选择 Sheet
2. 使用 `mode-selector` 分段控制器选择倒计时/正计时
3. 使用 `duration-grid` 网格选择时长（15/25/45/60）
4. 底部双按钮（取消/开始专注）
5. 调用 `pomodoroStore.startPomodoro()` 开始专注

- [ ] **Step 2: Commit**

```bash
git add src/tabs/mobile/drawers/pomodoro/MobileTimerStarter.vue
git commit -m "feat(mobile): 创建 MobileTimerStarter 开始专注组件"
```

---

## Task 6: 创建 ItemSelectorSheet

**Files:** Create `src/tabs/mobile/drawers/pomodoro/ItemSelectorSheet.vue`

- [ ] **Step 1: 创建文件**

参考 `QuickCreateDrawer.vue` 中的 Sheet 实现：

1. 使用 `sheet-overlay` 和 `selector-sheet` 样式
2. 从 `projectStore` 获取过期事项（expiredItems）和今日事项（todayItems）
3. 分组显示：过期事项（红色标签）、今日事项（主色标签）
4. 点击选择后关闭 Sheet，通过 emit 传递选中项

- [ ] **Step 2: Commit**

```bash
git add src/tabs/mobile/drawers/pomodoro/ItemSelectorSheet.vue
git commit -m "feat(mobile): 创建 ItemSelectorSheet 事项选择器"
```

---

## Task 7: 创建 MobileActiveTimer

**Files:** Create `src/tabs/mobile/drawers/pomodoro/MobileActiveTimer.vue`

- [ ] **Step 1: 创建文件**

参考 `src/components/pomodoro/PomodoroActiveTimer.vue`，适配移动端：

1. 使用 SVG 圆形进度条（radius=54，周长约 339）
2. 中央大字体显示倒计时（48px，font-weight: 300）
3. 显示已专注时长
4. 暂停状态灰色显示
5. 项目/任务/事项信息卡片（简化版）
6. 底部双按钮：暂停/继续、结束专注
7. 调用 `pomodoroStore.pausePomodoro()`、`resumePomodoro()`、`completePomodoro()`

- [ ] **Step 2: Commit**

```bash
git add src/tabs/mobile/drawers/pomodoro/MobileActiveTimer.vue
git commit -m "feat(mobile): 创建 MobileActiveTimer 专注中组件"
```

---

## Task 8: 创建 MobileBreakTimer

**Files:** Create `src/tabs/mobile/drawers/pomodoro/MobileBreakTimer.vue`

- [ ] **Step 1: 创建文件**

1. 中央呼吸动画圆圈（使用 CSS animation: breathe 3s infinite）
2. 大字体显示休息倒计时
3. 提示文字"让眼睛休息一下"
4. 底部"跳过休息"按钮
5. 调用 `pomodoroStore.stopBreak()`

- [ ] **Step 2: Commit**

```bash
git add src/tabs/mobile/drawers/pomodoro/MobileBreakTimer.vue
git commit -m "feat(mobile): 创建 MobileBreakTimer 休息中组件"
```

---

## Task 9: 创建 MobileComplete

**Files:** Create `src/tabs/mobile/drawers/pomodoro/MobileComplete.vue`

- [ ] **Step 1: 创建文件**

参考 `src/components/pomodoro/PomodoroCompleteDialog.vue`，改为 Drawer 形式：

状态 1 - 补填说明：
1. 时长警告（如果专注时长 < 最小值）
2. 项目/任务/事项信息卡片
3. 时间信息（开始/结束/时长）
4. 说明输入 textarea
5. 底部按钮：废弃记录、保存记录

状态 2 - 休息选项：
1. 专注完成提示
2. 休息时长选择（5/10/15 分钟）
3. 底部按钮：跳过休息、开始休息

调用 `pomodoroStore.savePomodoroRecordFromPending()` 和 `startBreak()`

- [ ] **Step 2: Commit**

```bash
git add src/tabs/mobile/drawers/pomodoro/MobileComplete.vue
git commit -m "feat(mobile): 创建 MobileComplete 专注完成组件"
```

---

## Task 10: MobilePomodoroDrawer 集成完成流程

**Files:** Modify `src/tabs/mobile/drawers/MobilePomodoroDrawer.vue`

- [ ] **Step 1: 导入 MobileComplete**

```typescript
import MobileComplete from './pomodoro/MobileComplete.vue';
```

- [ ] **Step 2: 添加完成状态管理**

```typescript
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { eventBus, Events } from '@/utils/eventBus';
import type { PendingPomodoroCompletion } from '@/types/models';

const showComplete = ref(false);
const pendingCompletion = ref<PendingPomodoroCompletion | null>(null);

// 监听专注完成事件
let unsubscribeCompletion: (() => void) | null = null;

onMounted(() => {
  unsubscribeCompletion = eventBus.on(Events.POMODORO_PENDING_COMPLETION, (pending: PendingPomodoroCompletion) => {
    pendingCompletion.value = pending;
    showComplete.value = true;
  });
});

onUnmounted(() => {
  if (unsubscribeCompletion) unsubscribeCompletion();
});
```

- [ ] **Step 3: 修改模板显示逻辑**

```vue
<div class="drawer-content">
  <MobileComplete
    v-if="showComplete && pendingCompletion"
    :pending="pendingCompletion"
    @close="showComplete = false"
  />
  <component :is="currentComponent" v-else />
</div>
```

- [ ] **Step 4: Commit**

```bash
git add src/tabs/mobile/drawers/MobilePomodoroDrawer.vue
git commit -m "feat(mobile): MobilePomodoroDrawer 集成专注完成流程"
```

---

## Task 11: MobileTodoList 下拉刷新

**Files:** Modify `src/tabs/mobile/components/MobileTodoList.vue`

- [ ] **Step 1: 添加下拉刷新状态和方法**

在 script setup 中添加：
```typescript
const isRefreshing = ref(false);
const pullDistance = ref(0);
const isPulling = ref(false);
const startY = ref(0);

const REFRESH_THRESHOLD = 80;

const handleTouchStart = (e: TouchEvent) => {
  if (scrollContainer.value?.scrollTop === 0) {
    startY.value = e.touches[0].clientY;
    isPulling.value = true;
  }
};

const handleTouchMove = (e: TouchEvent) => {
  if (!isPulling.value) return;
  const currentY = e.touches[0].clientY;
  const diff = currentY - startY.value;
  if (diff > 0) {
    pullDistance.value = Math.min(diff * 0.5, REFRESH_THRESHOLD + 20);
    e.preventDefault();
  }
};

const handleTouchEnd = async () => {
  if (!isPulling.value) return;
  isPulling.value = false;
  
  if (pullDistance.value >= REFRESH_THRESHOLD) {
    isRefreshing.value = true;
    await emit('refresh');
    isRefreshing.value = false;
  }
  pullDistance.value = 0;
};
```

- [ ] **Step 2: 添加下拉刷新 UI**

在模板最外层添加刷新指示器：
```vue
<div class="mobile-todo-list" ref="scrollContainer">
  <!-- 下拉刷新指示器 -->
  <div 
    class="pull-refresh-indicator"
    :style="{ transform: `translateY(${pullDistance}px)` }"
  >
    <div v-if="isRefreshing" class="refresh-spinner">
      <SyLoading :text="t('common').refreshing || '刷新中...'" />
    </div>
    <div v-else class="pull-text">
      {{ pullDistance >= REFRESH_THRESHOLD ? '释放刷新' : '下拉刷新' }}
    </div>
  </div>
  
  <!-- 原有内容 -->
  <div class="todo-content" ...>
</div>
```

- [ ] **Step 3: 添加样式**

```scss
.pull-refresh-indicator {
  position: absolute;
  top: -60px;
  left: 0;
  right: 0;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}

.pull-text {
  font-size: 14px;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/tabs/mobile/components/MobileTodoList.vue
git commit -m "feat(mobile): MobileTodoList 添加下拉刷新"
```

---

## 验证清单

- [ ] 移动端不显示 Calendar/Gantt/Project/PomodoroStats Tab
- [ ] 底部导航左侧是番茄钟按钮，点击打开抽屉
- [ ] 空闲状态显示开始专注界面（选择事项+时长）
- [ ] 专注中显示倒计时界面（圆环进度条+暂停/结束）
- [ ] 休息中显示休息倒计时（呼吸动画+跳过）
- [ ] 专注完成显示补填说明+休息选项
- [ ] 下拉刷新正常工作
- [ ] 所有功能复用 pomodoroStore，不重复实现逻辑

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-11-mobile-pomodoro-implementation.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch fresh subagent per task
2. **Inline Execution** - Execute tasks in this session

Which approach would you like?
