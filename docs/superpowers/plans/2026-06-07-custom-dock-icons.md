# 自定义 Dock 图标实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 AI Chat Dock 和 Pomodoro Dock 的图标从思源内置图标替换为自定义 SVG 图标，提升品牌辨识度

**架构：** 使用 SiYuan 插件 API `this.addIcons()` 注册自定义 SVG `<symbol>`，在 `addDock()` 和菜单中引用 symbol ID。SVG 数据抽取到 `src/constants/icons.ts` 常量文件中集中管理。

**技术栈：** SiYuan Plugin API (`addIcons`)、TypeScript、Vue 3

---

### 任务 1：创建图标常量文件

**文件：**
- 创建：`src/constants/icons.ts`

- [ ] **步骤 1：创建 `src/constants/icons.ts`**

从 `src/components/icons/AiAssistantIcon.vue` 提取 SVG path 数据，从 `src/components/icons/TomatoIcon.vue` 提取 SVG path 数据，封装为 `<symbol>` 字符串常量。

```typescript
export const ICON_AI_ASSISTANT = `<symbol id="iconTaAiAssistant" viewBox="0 0 1024 1024"><path d="M683.7 922.7h-345c-73.5 0-133.3-59.8-133.3-133.3V459.8c0-73.5 59.8-133.3 133.3-133.3h345c73.5 0 133.3 59.8 133.3 133.3v329.6c0 73.5-59.8 133.3-133.3 133.3z m-345-506.9c-24.3 0-44.1 19.8-44.1 44.1v329.6c0 24.3 19.8 44.1 44.1 44.1h345c24.3 0 44.1-19.8 44.1-44.1V459.8c0-24.3-19.8-44.1-44.1-44.1h-345zM914.3 759.6c-24.6 0-44.6-20-44.6-44.6V534.3c0-24.6 20-44.6 44.6-44.6s44.6 20 44.6 44.6V715c0 24.7-20 44.6-44.6 44.6zM111.7 759.6c-24.6 0-44.6-20-44.6-44.6V534.3c0-24.6 20-44.6 44.6-44.6s44.6 20 44.6 44.6V715c0 24.7-19.9 44.6-44.6 44.6z"/><path d="M511.2 415.8c-24.6 0-44.6-20-44.6-44.6V239.3c0-24.6 20-44.6 44.6-44.6s44.6 20 44.6 44.6v131.9c0 24.6-20 44.6-44.6 44.6z"/><path d="M511.2 276.6c-49.2 0-89.2-40-89.2-89.2s40-89.2 89.2-89.2 89.2 40 89.2 89.2-40 89.2-89.2 89.2z m0-89.2h0.2-0.2z m0 0h0.2-0.2z m0 0h0.2-0.2z m0 0h0.2-0.2z m0 0z m0 0h0.2-0.2z m0 0h0.2-0.2z m0-0.1h0.2-0.2zM399 675.5c-28.1 0-50.9-22.8-50.9-50.9 0-28.1 22.8-50.9 50.9-50.9s50.9 22.8 50.9 50.9c0 28.1-22.8 50.9-50.9 50.9zM622.9 675.5c-28.1 0-50.9-22.8-50.9-50.9 0-28.1 22.8-50.9 50.9-50.9 28.1 0 50.9 22.8 50.9 50.9 0 28.1-22.8 50.9-50.9 50.9z"/></symbol>`

export const ICON_POMODORO = `<symbol id="iconTaPomodoro" viewBox="0 0 1024 1024"><path d="M963.05566 345.393457c-34.433245-59.444739-83.5084-112.04244-142.458001-152.926613 3.805482-11.402299 2.23519-23.908046-4.272326-34.008842a39.5855 39.5855 0 0 0-29.198939-17.938108L617.888552 123.076923l-73.365164-105.421751c-7.398762-10.638373-19.55084-16.976127-32.509284-16.976127s-25.110522 6.337754-32.509283 16.976127L406.111363 123.076923 236.887668 140.505747A39.625111 39.625111 0 0 0 207.688729 158.443855a39.676039 39.676039 0 0 0-4.286473 34.008842C77.170603 279.724138 2.716138 415.179487 2.716138 560.311229c-0.04244 62.72679 13.849691 124.689655 40.671972 181.38992 25.916888 55.129973 62.924845 104.587091 110.005305 146.956676 46.769231 42.100796 101.177719 75.119363 161.683466 98.164456a559.214854 559.214854 0 0 0 393.846153 0c60.519894-23.030946 114.928382-56.06366 161.71176-98.164456 47.08046-42.369584 84.088417-91.826702 110.005305-146.956676A423.347834 423.347834 0 0 0 1021.283777 560.311229a429.629001 429.629001 0 0 0-58.228117-214.917772z m-530.786914-145.372237c11.473033-1.188329 21.856764-7.299735 28.44916-16.778072L511.999958 109.609195l51.239611 73.633953c6.592396 9.464191 16.976127 15.589744 28.44916 16.778072l80.580017 8.304156-47.278514 32.679045a39.601061 39.601061 0 0 0-15.971707 41.874447l14.458002 59.784262-97.655172-36.413793a39.633599 39.633599 0 0 0-27.671088 0l-97.655172 36.399646 14.458001-59.784262a39.601061 39.601061 0 0 0-15.971706-41.874447l-47.278515-32.679045 80.565871-8.290009zM817.570249 829.778957a434.642617 434.642617 0 0 1-136.94076 83.013262 480.025464 480.025464 0 0 1-337.457118 0 434.642617 434.642617 0 0 1-136.94076-83.013262C126.132584 757.545535 81.938065 661.842617 81.938065 560.311229c0-125.496021 68.923077-242.758621 184.615385-314.553492l65.018568 44.944297-25.563219 105.81786a39.619452 39.619452 0 0 0 52.34306 46.401415L511.999958 385.669319l153.676392 57.280283c13.72237 5.106985 29.142352 2.23519 40.106101-7.483643a39.58267 39.58267 0 0 0 12.222812-38.917772l-25.605659-105.81786 65.018568-44.93015c2.900815-1.993575 5.778536-4.029543 8.633163-6.107903 115.692308 71.794871 184.615385 189.057471 184.615385 314.553492 0 101.531388-44.194519 197.234306-118.692546 269.467728z" fill="currentColor"/></symbol>`
```

注意：ICON_POMODORO 的 `<path>` 需要包含 `fill="currentColor"` 属性（与 TomatoIcon.vue 一致），而 ICON_AI_ASSISTANT 不需要 fill 属性（AiAssistantIcon.vue 中 path 没有 fill）。

- [ ] **步骤 2：验证文件创建**

运行：`npx tsc --noEmit src/constants/icons.ts`
预期：无报错

---

### 任务 2：重命名 TomatoIcon.vue 为 PomodoroIcon.vue 并更新引用

**文件：**
- 重命名：`src/components/icons/TomatoIcon.vue` → `src/components/icons/PomodoroIcon.vue`
- 修改：`src/components/pomodoro/PomodoroRecordList.vue:84`
- 修改：`src/components/pomodoro/PomodoroActiveTimer.vue:319`
- 修改：`src/components/pomodoro/stats/FocusRecordsCard.vue:63`
- 修改：`src/components/pomodoro/review/FocusWorkbenchRecordPane.vue:80`
- 修改：`src/index.ts:2534`（注释中的 "TomatoIcon" → "PomodoroIcon"）

- [ ] **步骤 1：重命名文件**

将 `src/components/icons/TomatoIcon.vue` 重命名为 `src/components/icons/PomodoroIcon.vue`

- [ ] **步骤 2：更新 PomodoroRecordList.vue 的 import**

```typescript
// 旧
import TomatoIcon from '@/components/icons/TomatoIcon.vue'
// 新
import PomodoroIcon from '@/components/icons/PomodoroIcon.vue'
```

同时更新模板中的 `<TomatoIcon` 为 `<PomodoroIcon`（2 处，第 12 行和第 49 行）

- [ ] **步骤 3：更新 PomodoroActiveTimer.vue 的 import**

```typescript
// 旧
import TomatoIcon from '@/components/icons/TomatoIcon.vue'
// 新
import PomodoroIcon from '@/components/icons/PomodoroIcon.vue'
```

同时更新模板中的 `<TomatoIcon` 为 `<PomodoroIcon`（第 4 行）

- [ ] **步骤 4：更新 FocusRecordsCard.vue 的 import**

```typescript
// 旧
import TomatoIcon from '@/components/icons/TomatoIcon.vue'
// 新
import PomodoroIcon from '@/components/icons/PomodoroIcon.vue'
```

同时更新模板中的 `<TomatoIcon` 为 `<PomodoroIcon`（第 30 行）

- [ ] **步骤 5：更新 FocusWorkbenchRecordPane.vue 的 import**

```typescript
// 旧
import TomatoIcon from '@/components/icons/TomatoIcon.vue'
// 新
import PomodoroIcon from '@/components/icons/PomodoroIcon.vue'
```

同时更新模板中的 `<TomatoIcon` 为 `<PomodoroIcon`（第 42 行）

- [ ] **步骤 6：更新 index.ts 中的注释**

```typescript
// 旧（第 2534 行附近）
* 使用 TomatoIcon 组件的 SVG 内容
// 新
* 使用 PomodoroIcon 组件的 SVG 内容
```

- [ ] **步骤 7：运行 typecheck 验证**

运行：`npm run typecheck`
预期：通过

---

### 任务 3：修改 index.ts 注册自定义图标并更新 Dock/菜单引用

**文件：**
- 修改：`src/index.ts`

- [ ] **步骤 1：添加 import**

在 `src/index.ts` 的 import 区域添加：

```typescript
import {
  ICON_AI_ASSISTANT,
  ICON_POMODORO,
} from "@/constants/icons"
```

- [ ] **步骤 2：在 onload() 中注册图标**

在 `this.registerDocks()` 调用之前（约第 333 行附近）添加：

```typescript
// 注册自定义 Dock 图标（ta 前缀防止与其他插件冲突）
this.addIcons(ICON_AI_ASSISTANT)
this.addIcons(ICON_POMODORO)
```

- [ ] **步骤 3：更新 AI Chat Dock 的 icon**

```typescript
// 旧（第 1514 行）
icon: "iconSparkles",
// 新
icon: "iconTaAiAssistant",
```

- [ ] **步骤 4：更新 Pomodoro Dock 的 icon**

```typescript
// 旧（第 1541 行）
icon: "iconClock",
// 新
icon: "iconTaPomodoro",
```

- [ ] **步骤 5：更新顶栏菜单中 AI 聊天菜单项的 icon**

```typescript
// 旧（第 1676 行）
icon: "iconSparkles",
// 新
icon: "iconTaAiAssistant",
```

- [ ] **步骤 6：更新顶栏菜单中番茄钟菜单项的 icon**

```typescript
// 旧（第 1662 行）
icon: "iconClock",
// 新
icon: "iconTaPomodoro",
```

注意：顶栏菜单中还有一处 `icon: "iconClock"` 在专注工作台菜单项（第 1654 行），以及帮助菜单中的番茄钟图标（第 1736 行），这些保持不变（它们代表的是专注工作台和帮助文档，不是番茄钟 Dock）。

- [ ] **步骤 7：运行 lint 验证**

运行：`npm run lint`
预期：通过

- [ ] **步骤 8：运行 typecheck 验证**

运行：`npm run typecheck`
预期：通过

- [ ] **步骤 9：运行测试验证**

运行：`npm run test`
预期：全部通过

---

### 任务 4：最终验证

- [ ] **步骤 1：运行完整验证**

```bash
npm run lint && npm run typecheck && npm run test
```

预期：全部通过

- [ ] **步骤 2：Commit**

```bash
git add src/constants/icons.ts src/components/icons/PomodoroIcon.vue src/components/pomodoro/PomodoroRecordList.vue src/components/pomodoro/PomodoroActiveTimer.vue src/components/pomodoro/stats/FocusRecordsCard.vue src/components/pomodoro/review/FocusWorkbenchRecordPane.vue src/index.ts
git commit -m "feat: 自定义 AI 和番茄钟 Dock 图标，重命名 TomatoIcon 为 PomodoroIcon"
```
