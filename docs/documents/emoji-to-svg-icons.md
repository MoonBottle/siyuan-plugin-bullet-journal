# 计划：ItemDetailContent emoji 改 SVG 图标 + 时长短格式

## 摘要

1. 将 `ItemDetailContent.vue` meta 区域的 emoji 图标替换为 SVG 图标
2. 专注时长和偏差显示改为 `1h15m` 短格式，原国际化格式移到 tooltip
3. 工时 duration 格式不变（保持 `H:MM`）
4. 新增两个自定义 SVG 图标到 `icons.ts`
5. 提醒和重复的 emoji 也改成 SVG（`TodoItemActionButtons.vue`）

## 当前状态

### emoji 图标映射（需替换）

| 字段   | 当前 emoji     | 替换为 SVG                           |
| ---- | ------------ | --------------------------------- |
| 时间   | `📅`         | `#iconTaCalendarDays`（已有）         |
| 工时   | `⏱️`         | `#iconTaClockCheck`（新增）           |
| 专注时长 | `🍅`         | `#iconTaTomato`（已有）               |
| 计划 | 🍅xN / ⏳N 模板 | `#iconTaClockPlus`（已有）+ 番茄时`🍅xN` / 时长时`1h15m` |
| 偏差   | `📊`         | `#iconTaDiff`（新增）                 |
| 提醒   | `⏰`          | `#iconTaAlarmClock`（已有）           |
| 重复   | `🔁`         | `#iconTaRepeat`（已有）               |

### 时长格式

* `duration`：**不变**，保持 `H:MM` 格式

* `focusTotalTimeDisplay`：当前 `formatFocusDuration()` 输出如 `1小时 15分钟`，改为 `1h15m` 短格式

* `focusDeltaDisplay`：当前 `+1小时 15分钟`，改为 `+1h15m` 短格式

* 原国际化格式移到 tooltip 中显示

## 改动

### 1. `src/constants/icons.ts` — 新增两个图标

文件末尾添加：

```ts
export const ICON_CLOCK_CHECK = `<symbol id="iconTaClockCheck" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v6l4 2"/><path d="M22 12a10 10 0 1 0-11 9.95"/><path d="m22 16-5.5 5.5L14 19"/></symbol>`

export const ICON_DIFF = `<symbol id="iconTaDiff" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v14"/><path d="M5 10h14"/><path d="M5 21h14"/></symbol>`
```

### 2. `src/index.ts` — 注册新图标

import 区域添加 `ICON_CLOCK_CHECK` 和 `ICON_DIFF`。
`addIcons` 调用区域添加 `this.addIcons(ICON_CLOCK_CHECK)` 和 `this.addIcons(ICON_DIFF)`。

### 3. `src/utils/dialog.ts` — 新增短格式函数

添加 `formatFocusDurationShort`：

```ts
export function formatFocusDurationShort(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h${m}m` : `${h}h`
}
```

### 4. `src/components/dialog/ItemDetailContent.vue` — 主要改动

#### 4a. 模板：替换 emoji 为 SVG

**时间 📅 → iconTaCalendarDays**

```html
<span class="meta-icon" ...>
  <svg><use xlink:href="#iconTaCalendarDays"></use></svg>
</span>
```

**工时 ⏱️ → iconTaClockCheck**

```html
<span class="meta-icon" ...>
  <svg><use xlink:href="#iconTaClockCheck"></use></svg>
</span>
```

**专注时长 🍅 → iconTaTomato**

```html
<span class="meta-icon" ...>
  <svg><use xlink:href="#iconTaTomato"></use></svg>
</span>
```

**计划 → iconTaClockPlus + 条件文本**
番茄个数时显示 SVG + `🍅xN`，时长时显示 SVG + `1h15m`：
```html
<span class="meta-icon" ...>
  <svg><use xlink:href="#iconTaClockPlus"></use></svg>
</span>
<span class="meta-text">
  <template v-if="focusPlanDisplay.type === 'pomodoro'">🍅x{{ focusPlanDisplay.value }}</template>
  <template v-else>{{ focusPlanDurationShort }}</template>
</span>
```
其中 `focusPlanDurationShort` 是对 `focusPlanDisplay.value`（分钟数）用 `formatFocusDurationShort` 格式化。

**偏差 📊 → iconTaDiff**

```html
<span class="meta-icon" ...>
  <svg><use xlink:href="#iconTaDiff"></use></svg>
</span>
```

#### 4b. 脚本：专注时长/偏差改为短格式 + tooltip 显示国际化格式

* 导入 `formatFocusDurationShort`

* `focusTotalTimeDisplay`：改为 `formatFocusDurationShort` 短格式

* 新增 `focusTotalTimeTooltip`：保留 `formatFocusDuration` 国际化格式，用于 tooltip

* `focusDeltaDisplay`：改为短格式

* 新增 `focusDeltaTooltip`：保留国际化格式，用于 tooltip

* `duration`：**不变**

* 模板中 focusTotalTime 和偏差的 meta-text 增加 tooltip 显示国际化格式

#### 4c. 样式：meta-icon 改为 SVG 容器

```scss
.meta-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  cursor: help;

  svg {
    width: 14px;
    height: 14px;
    fill: currentColor;
  }
}
```

### 5. `src/components/todo/TodoItemActionButtons.vue` — 提醒/重复 emoji 改 SVG

**提醒 ⏰ → iconTaAlarmClock**

```html
<span class="action-icon"><svg><use xlink:href="#iconTaAlarmClock"></use></svg></span>
```

**重复 🔁 → iconTaRepeat**

```html
<span class="action-icon"><svg><use xlink:href="#iconTaRepeat"></use></svg></span>
```

样式调整 `.action-icon`：

```scss
.action-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;

  svg {
    width: 14px;
    height: 14px;
    fill: currentColor;
  }
}
```

## 验证

1. `npm run lint` 通过
2. `npm run typecheck` 通过
3. `npm run test` 通过

