# 自定义 Dock 图标设计

## 背景

AI Chat Dock 和 Pomodoro Dock 当前使用思源内置图标（`iconSparkles`、`iconClock`），缺乏品牌辨识度。参考 siyuan-plugin-copilot 的做法，通过 `this.addIcons()` API 注册自定义 SVG symbol，实现 Dock 图标自定义。

## 方案

使用 SiYuan 插件 API `this.addIcons()` 注册自定义 SVG `<symbol>`，在 `addDock()` 的 `config.icon` 中引用 symbol ID。

## 改动清单

### 新建文件

**`src/constants/icons.ts`** — 存放自定义 SVG symbol 字符串常量

导出两个常量：

* `ICON_AI_ASSISTANT` — 机器人头像 SVG，来自 `src/components/icons/AiAssistantIcon.vue`，symbol id 为 `iconTaAiAssistant`

*- `ICON_POMODORO` — 番茄 SVG，来自 `src/components/icons/PomodoroIcon.vue`（原 TomatoIcon.vue 重命名），symbol id 为 `iconTaPomodoro`

常量格式：`<symbol id="iconTaXxx" viewBox="0 0 1024 1024"><path d="..."/></symbol>`

Symbol ID 使用 `ta`（Task Assistant）前缀，防止与其他插件冲突。

### 重命名文件

- `src/components/icons/TomatoIcon.vue` → `src/components/icons/PomodoroIcon.vue`，并更新所有引用该组件的 import 路径

### 修改文件

**`src/index.ts`**

1. **导入图标常量**：从 `@/constants/icons` 导入 `ICON_AI_ASSISTANT` 和 `ICON_POMODORO`
2. **`onload()`** **中注册图标**：在 `registerDocks()` 调用之前添加：

   ```typescript
   this.addIcons(ICON_AI_ASSISTANT)
   this.addIcons(ICON_POMODORO)
   ```
3. **AI Chat Dock**：`config.icon` 从 `"iconSparkles"` 改为 `"iconTaAiAssistant"`
4. **Pomodoro Dock**：`config.icon` 从 `"iconClock"` 改为 `"iconTaPomodoro"`
5. **顶栏菜单**中对应菜单项图标同步更新：

   * AI 聊天菜单项：`icon: "iconSparkles"` → `icon: "iconTaAiAssistant"`

   * 番茄钟菜单项：`icon: "iconClock"` → `icon: "iconTaPomodoro"`

### 不改动的部分

* Todo Dock (`iconList`)、Habit Dock (`iconCheck`) 保持使用思源内置图标

* `getTabIcon()` 中的 Tab 图标映射不变

* 底栏倒计时中的内联 SVG 图标不变

* 帮助菜单中的图标不变

## 验证

* `npm run lint` 通过

* `npm run typecheck` 通过

* `npm run test` 通过

* 在思源中加载插件，确认 AI Dock 和 Pomodoro Dock 图标正确显示

